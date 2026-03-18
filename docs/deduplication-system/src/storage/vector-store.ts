/**
 * 向量数据库存储接口
 * 
 * 支持多种向量数据库：
 * - pgvector (PostgreSQL)
 * - Qdrant
 * - Milvus
 * - Pinecone
 */

import { Pool } from 'pg';

export interface VectorDocument {
  id: string;
  vector: number[];
  metadata?: Record<string, any>;
  content?: string;
}

export interface SearchResult {
  id: string;
  score: number;
  metadata?: Record<string, any>;
  content?: string;
}

export interface VectorStore {
  upsert(documents: VectorDocument[]): Promise<void>;
  search(vector: number[], topK: number, filter?: Record<string, any>): Promise<SearchResult[]>;
  delete(ids: string[]): Promise<void>;
  get(id: string): Promise<VectorDocument | null>;
}

/**
 * pgvector 实现
 */
export class PgVectorStore implements VectorStore {
  private pool: Pool;
  private tableName: string;
  private dimension: number;

  constructor(options: {
    connectionString: string;
    tableName?: string;
    dimension?: number;
  }) {
    this.pool = new Pool({ connectionString: options.connectionString });
    this.tableName = options.tableName || 'embeddings';
    this.dimension = options.dimension || 384;
  }

  /**
   * 初始化表
   */
  async init(): Promise<void> {
    await this.pool.query(`
      CREATE EXTENSION IF NOT EXISTS vector;
      
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id TEXT PRIMARY KEY,
        vector vector(${this.dimension}),
        metadata JSONB DEFAULT '{}',
        content TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_vector 
      ON ${this.tableName} USING ivfflat (vector vector_cosine_ops);
    `);
  }

  async upsert(documents: VectorDocument[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      for (const doc of documents) {
        await client.query(
          `INSERT INTO ${this.tableName} (id, vector, metadata, content)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO UPDATE SET
             vector = EXCLUDED.vector,
             metadata = EXCLUDED.metadata,
             content = EXCLUDED.content`,
          [
            doc.id,
            `[${doc.vector.join(',')}]`,
            JSON.stringify(doc.metadata || {}),
            doc.content,
          ]
        );
      }
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async search(
    vector: number[],
    topK: number,
    filter?: Record<string, any>
  ): Promise<SearchResult[]> {
    let query = `
      SELECT id, 1 - (vector <=> $1) as score, metadata, content
      FROM ${this.tableName}
    `;
    
    const params: any[] = [`[${vector.join(',')}]`];
    
    if (filter) {
      const conditions = Object.entries(filter).map(([key, value], index) => {
        params.push(value);
        return `metadata->>'${key}' = $${index + 2}`;
      });
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` ORDER BY vector <=> $1 LIMIT $${params.length + 1}`;
    params.push(topK);
    
    const result = await this.pool.query(query, params);
    
    return result.rows.map(row => ({
      id: row.id,
      score: parseFloat(row.score),
      metadata: row.metadata,
      content: row.content,
    }));
  }

  async delete(ids: string[]): Promise<void> {
    await this.pool.query(
      `DELETE FROM ${this.tableName} WHERE id = ANY($1)`,
      [ids]
    );
  }

  async get(id: string): Promise<VectorDocument | null> {
    const result = await this.pool.query(
      `SELECT id, vector, metadata, content FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return {
      id: row.id,
      vector: row.vector.slice(1, -1).split(',').map(Number),
      metadata: row.metadata,
      content: row.content,
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

/**
 * Qdrant 实现
 */
export class QdrantVectorStore implements VectorStore {
  private baseUrl: string;
  private collectionName: string;
  private apiKey?: string;

  constructor(options: {
    url: string;
    collectionName: string;
    apiKey?: string;
  }) {
    this.baseUrl = options.url;
    this.collectionName = options.collectionName;
    this.apiKey = options.apiKey;
  }

  private async request(path: string, method: string, body?: any): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (this.apiKey) {
      headers['api-key'] = this.apiKey;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Qdrant error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async init(dimension: number = 384): Promise<void> {
    try {
      await this.request(`/collections/${this.collectionName}`, 'PUT', {
        vectors: {
          size: dimension,
          distance: 'Cosine',
        },
      });
    } catch (error) {
      // 集合可能已存在
    }
  }

  async upsert(documents: VectorDocument[]): Promise<void> {
    const points = documents.map(doc => ({
      id: doc.id,
      vector: doc.vector,
      payload: {
        ...doc.metadata,
        content: doc.content,
      },
    }));

    await this.request(`/collections/${this.collectionName}/points?wait=true`, 'PUT', {
      points,
    });
  }

  async search(
    vector: number[],
    topK: number,
    filter?: Record<string, any>
  ): Promise<SearchResult[]> {
    const response = await this.request(
      `/collections/${this.collectionName}/points/search`,
      'POST',
      {
        vector,
        limit: topK,
        with_payload: true,
        filter: filter ? this.buildFilter(filter) : undefined,
      }
    );

    return response.result.map((item: any) => ({
      id: item.id,
      score: item.score,
      metadata: item.payload,
      content: item.payload?.content,
    }));
  }

  private buildFilter(filter: Record<string, any>): any {
    const conditions = Object.entries(filter).map(([key, value]) => ({
      key,
      match: { value },
    }));

    return { must: conditions };
  }

  async delete(ids: string[]): Promise<void> {
    await this.request(`/collections/${this.collectionName}/points/delete?wait=true`, 'POST', {
      points: ids,
    });
  }

  async get(id: string): Promise<VectorDocument | null> {
    const response = await this.request(
      `/collections/${this.collectionName}/points/${id}`,
      'GET'
    );

    if (!response.result) return null;

    return {
      id: response.result.id,
      vector: response.result.vector,
      metadata: response.result.payload,
      content: response.result.payload?.content,
    };
  }
}

/**
 * 内存向量存储（用于测试）
 */
export class InMemoryVectorStore implements VectorStore {
  private documents: Map<string, VectorDocument> = new Map();

  async upsert(documents: VectorDocument[]): Promise<void> {
    for (const doc of documents) {
      this.documents.set(doc.id, doc);
    }
  }

  async search(
    vector: number[],
    topK: number,
    filter?: Record<string, any>
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    for (const doc of this.documents.values()) {
      // 应用过滤器
      if (filter) {
        const matches = Object.entries(filter).every(
          ([key, value]) => doc.metadata?.[key] === value
        );
        if (!matches) continue;
      }

      const score = this.cosineSimilarity(vector, doc.vector);
      results.push({
        id: doc.id,
        score,
        metadata: doc.metadata,
        content: doc.content,
      });
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async delete(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.documents.delete(id);
    }
  }

  async get(id: string): Promise<VectorDocument | null> {
    return this.documents.get(id) || null;
  }
}

/**
 * 多层去重引擎
 * 
 * 整合多种算法实现高效准确的去重
 */

import {
  Content,
  ContentFingerprint,
  DuplicateCheckResult,
  DuplicateLevel,
  DeduplicationConfig,
  DEFAULT_CONFIG,
} from './types';
import { TextProcessor } from './utils/text-processing';
import { md5Hash } from './utils/hash';
import { BloomFilter } from './algorithms/bloom-filter';
import { SimHash, SimHashIndex } from './algorithms/simhash';
import { MinHash, MinHashLSH } from './algorithms/minhash';
import { SemanticSimilarityCalculator } from './algorithms/semantic-similarity';
import { VectorStore, InMemoryVectorStore } from './storage/vector-store';

export interface DeduplicationEngineOptions {
  config?: Partial<DeduplicationConfig>;
  vectorStore?: VectorStore;
  useBloomFilter?: boolean;
}

export class DeduplicationEngine {
  private config: DeduplicationConfig;
  private textProcessor: TextProcessor;
  
  // 算法实例
  private bloomFilter?: BloomFilter;
  private exactHashes: Set<string> = new Set();
  private simHash: SimHash;
  private simHashIndex: SimHashIndex;
  private minHash: MinHash;
  private minHashLSH: MinHashLSH;
  private semanticCalculator: SemanticSimilarityCalculator;
  
  // 存储
  private vectorStore: VectorStore;
  private fingerprints: Map<string, ContentFingerprint> = new Map();

  constructor(options: DeduplicationEngineOptions = {}) {
    this.config = { ...DEFAULT_CONFIG, ...options.config };
    this.textProcessor = new TextProcessor();
    
    // 初始化算法
    if (options.useBloomFilter !== false) {
      this.bloomFilter = new BloomFilter({ 
        expectedItems: 1000000, 
        falsePositiveRate: 0.01 
      });
    }
    
    this.simHash = new SimHash(this.config.simHash);
    this.simHashIndex = new SimHashIndex(this.config.simHash);
    this.minHash = new MinHash(this.config.minHash);
    this.minHashLSH = new MinHashLSH(this.config.minHash);
    this.semanticCalculator = new SemanticSimilarityCalculator(this.config.semantic);
    
    this.vectorStore = options.vectorStore || new InMemoryVectorStore();
  }

  /**
   * 检查内容是否重复
   */
  async checkDuplicate(content: Content): Promise<DuplicateCheckResult> {
    // L1: 精确哈希检查
    const exactResult = await this.checkExactHash(content);
    if (exactResult.isDuplicate) return exactResult;

    // L2: SimHash 快速筛选
    const simHashResult = this.checkSimHash(content);
    if (simHashResult.isDuplicate) return simHashResult;

    // L3: MinHash LSH
    const minHashResult = this.checkMinHash(content);
    if (minHashResult.isDuplicate) return minHashResult;

    // L4: 语义相似度
    const semanticResult = await this.checkSemantic(content);
    if (semanticResult.isDuplicate) return semanticResult;

    return {
      isDuplicate: false,
      level: 'none',
      confidence: 0,
      similarityScore: 0,
      method: 'none',
    };
  }

  /**
   * L1: 精确哈希检查
   */
  private async checkExactHash(content: Content): Promise<DuplicateCheckResult> {
    const normalized = this.textProcessor.normalize(content.content);
    const hash = md5Hash(normalized);

    // Bloom Filter 快速排除
    if (this.bloomFilter) {
      if (this.bloomFilter.definitelyNotContain(hash)) {
        return {
          isDuplicate: false,
          level: 'none',
          confidence: 0,
          similarityScore: 0,
          method: 'bloom_filter',
        };
      }
    }

    // 精确匹配
    if (this.exactHashes.has(hash)) {
      const existing = this.findByExactHash(hash);
      return {
        isDuplicate: true,
        level: 'exact',
        confidence: 1.0,
        matchedContentId: existing?.contentId,
        similarityScore: 1.0,
        method: 'exact_hash',
      };
    }

    return {
      isDuplicate: false,
      level: 'none',
      confidence: 0,
      similarityScore: 0,
      method: 'exact_hash',
    };
  }

  /**
   * L2: SimHash 检查
   */
  private checkSimHash(content: Content): DuplicateCheckResult {
    const simHash = this.simHash.compute(content.content);
    const candidates = this.simHashIndex.findSimilar(
      content.content,
      1 - this.config.simHash.hammingThreshold / this.config.simHash.hashBits
    );

    if (candidates.length > 0 && candidates[0].similarity >= 0.9) {
      return {
        isDuplicate: true,
        level: 'near',
        confidence: candidates[0].similarity,
        matchedContentId: candidates[0].id,
        similarityScore: candidates[0].similarity,
        method: 'simhash',
      };
    }

    return {
      isDuplicate: false,
      level: 'none',
      confidence: 0,
      similarityScore: candidates[0]?.similarity || 0,
      method: 'simhash',
    };
  }

  /**
   * L3: MinHash 检查
   */
  private checkMinHash(content: Content): DuplicateCheckResult {
    const candidates = this.minHashLSH.query(content.content);

    if (candidates.length > 0 && candidates[0].similarity >= this.config.minHash.jaccardThreshold) {
      return {
        isDuplicate: true,
        level: 'near',
        confidence: candidates[0].similarity,
        matchedContentId: candidates[0].id,
        similarityScore: candidates[0].similarity,
        method: 'minhash',
      };
    }

    return {
      isDuplicate: false,
      level: 'none',
      confidence: 0,
      similarityScore: candidates[0]?.similarity || 0,
      method: 'minhash',
    };
  }

  /**
   * L4: 语义相似度检查
   */
  private async checkSemantic(content: Content): Promise<DuplicateCheckResult> {
    // 生成embedding
    const embedding = await this.semanticCalculator.generateEmbedding(content.content);

    // 向量数据库搜索
    const results = await this.vectorStore.search(embedding, 5);

    if (results.length > 0 && results[0].score >= this.config.semantic.cosineThreshold) {
      return {
        isDuplicate: true,
        level: 'semantic',
        confidence: results[0].score,
        matchedContentId: results[0].id,
        similarityScore: results[0].score,
        method: 'semantic',
      };
    }

    return {
      isDuplicate: false,
      level: 'none',
      confidence: 0,
      similarityScore: results[0]?.score || 0,
      method: 'semantic',
    };
  }

  /**
   * 添加内容到索引
   */
  async addContent(content: Content): Promise<ContentFingerprint> {
    // 计算所有指纹
    const normalized = this.textProcessor.normalize(content.content);
    const exactHash = md5Hash(normalized);
    const simHash = this.simHash.compute(content.content);
    const minHash = this.minHash.compute(content.content);
    const shingles = this.textProcessor.getShingles(content.content, 3);
    const features = this.textProcessor.extractFeatures(content.content);

    const fingerprint: ContentFingerprint = {
      contentId: content.id,
      exactHash,
      simHash,
      minHash,
      shingles,
      features,
      createdAt: new Date(),
    };

    // 添加到各层索引
    if (this.bloomFilter) {
      this.bloomFilter.add(exactHash);
    }
    this.exactHashes.add(exactHash);
    this.simHashIndex.add(content.id, content.content);
    this.minHashLSH.add(content.id, content.content);
    
    // 添加到向量数据库
    const embedding = await this.semanticCalculator.generateEmbedding(content.content);
    await this.vectorStore.upsert([{
      id: content.id,
      vector: embedding,
      metadata: {
        platform: content.platform,
        authorId: content.authorId,
        contentType: content.contentType,
      },
      content: content.content,
    }]);

    this.fingerprints.set(content.id, fingerprint);
    return fingerprint;
  }

  /**
   * 批量添加内容
   */
  async addContents(contents: Content[]): Promise<ContentFingerprint[]> {
    const fingerprints: ContentFingerprint[] = [];
    
    for (const content of contents) {
      const fp = await this.addContent(content);
      fingerprints.push(fp);
    }
    
    return fingerprints;
  }

  /**
   * 查找相似内容
   */
  async findSimilar(
    content: Content,
    options: { 
      checkExact?: boolean;
      checkSimHash?: boolean;
      checkMinHash?: boolean;
      checkSemantic?: boolean;
      topK?: number;
    } = {}
  ): Promise<Array<{ id: string; similarity: number; method: string }>> {
    const results: Array<{ id: string; similarity: number; method: string }> = [];
    const seen = new Set<string>();

    if (options.checkExact !== false) {
      const exactResult = await this.checkExactHash(content);
      if (exactResult.matchedContentId) {
        results.push({
          id: exactResult.matchedContentId,
          similarity: 1.0,
          method: 'exact',
        });
        seen.add(exactResult.matchedContentId);
      }
    }

    if (options.checkSimHash !== false) {
      const simHashResults = this.simHashIndex.findSimilar(content.content);
      for (const r of simHashResults.slice(0, options.topK || 5)) {
        if (!seen.has(r.id)) {
          results.push({ id: r.id, similarity: r.similarity, method: 'simhash' });
          seen.add(r.id);
        }
      }
    }

    if (options.checkMinHash !== false) {
      const minHashResults = this.minHashLSH.query(content.content);
      for (const r of minHashResults.slice(0, options.topK || 5)) {
        if (!seen.has(r.id)) {
          results.push({ id: r.id, similarity: r.similarity, method: 'minhash' });
          seen.add(r.id);
        }
      }
    }

    if (options.checkSemantic !== false) {
      const embedding = await this.semanticCalculator.generateEmbedding(content.content);
      const semanticResults = await this.vectorStore.search(embedding, options.topK || 5);
      for (const r of semanticResults) {
        if (!seen.has(r.id)) {
          results.push({ id: r.id, similarity: r.score, method: 'semantic' });
          seen.add(r.id);
        }
      }
    }

    return results.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * 删除内容
   */
  async removeContent(contentId: string): Promise<void> {
    const fingerprint = this.fingerprints.get(contentId);
    if (!fingerprint) return;

    this.exactHashes.delete(fingerprint.exactHash);
    this.simHashIndex.remove(contentId);
    this.minHashLSH.remove(contentId);
    await this.vectorStore.delete([contentId]);
    
    this.fingerprints.delete(contentId);
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalContents: number;
    exactHashes: number;
    simHashIndex: number;
    minHashIndex: number;
    bloomFilterItemCount?: number;
  } {
    return {
      totalContents: this.fingerprints.size,
      exactHashes: this.exactHashes.size,
      simHashIndex: this.simHashIndex.size(),
      minHashIndex: this.minHashLSH.size(),
      bloomFilterItemCount: this.bloomFilter?.getItemCount(),
    };
  }

  private findByExactHash(hash: string): ContentFingerprint | undefined {
    for (const fp of this.fingerprints.values()) {
      if (fp.exactHash === hash) return fp;
    }
    return undefined;
  }
}

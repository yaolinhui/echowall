/**
 * 语义相似度计算
 * 
 * 使用BERT/Sentence-BERT embeddings计算余弦相似度
 */

export interface SemanticSimilarityOptions {
  vectorDimension?: number;
  cosineThreshold?: number;
}

/**
 * 余弦相似度计算
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same dimension');
  }

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

/**
 * 欧几里得距离
 */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same dimension');
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * 曼哈顿距离
 */
export function manhattanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same dimension');
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += Math.abs(a[i] - b[i]);
  }

  return sum;
}

/**
 * 语义相似度计算器
 * 
 * 注意：实际项目中需要接入真实的Embedding模型
 * 这里提供模拟实现和接口定义
 */
export class SemanticSimilarityCalculator {
  private vectorDimension: number;
  private cosineThreshold: number;

  constructor(options: SemanticSimilarityOptions = {}) {
    this.vectorDimension = options.vectorDimension || 384;
    this.cosineThreshold = options.cosineThreshold || 0.92;
  }

  /**
   * 生成文本embedding（模拟实现）
   * 
   * 实际项目中应调用：
   * - OpenAI API
   * - Hugging Face Transformers
   * - Sentence-BERT
   * - 本地部署的模型服务
   */
  async generateEmbedding(text: string): Promise<number[]> {
    // 模拟生成embedding（实际项目中替换为真实模型调用）
    const normalized = text.toLowerCase().trim();
    const embedding: number[] = [];
    
    // 使用哈希生成伪随机但稳定的embedding
    for (let i = 0; i < this.vectorDimension; i++) {
      let hash = 0;
      const str = normalized + i;
      for (let j = 0; j < str.length; j++) {
        const char = str.charCodeAt(j);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      embedding.push(Math.sin(hash) * 0.5);
    }

    // 归一化
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    return embedding.map(v => v / norm);
  }

  /**
   * 计算两个文本的相似度
   */
  async calculateSimilarity(text1: string, text2: string): Promise<number> {
    const [emb1, emb2] = await Promise.all([
      this.generateEmbedding(text1),
      this.generateEmbedding(text2),
    ]);

    return cosineSimilarity(emb1, emb2);
  }

  /**
   * 批量计算相似度
   */
  async calculateSimilarityBatch(
    text: string,
    candidates: string[]
  ): Promise<Array<{ text: string; similarity: number }>> {
    const textEmbedding = await this.generateEmbedding(text);
    
    const results = await Promise.all(
      candidates.map(async (candidate) => {
        const candidateEmbedding = await this.generateEmbedding(candidate);
        const similarity = cosineSimilarity(textEmbedding, candidateEmbedding);
        return { text: candidate, similarity };
      })
    );

    return results.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * 判断是否语义相似
   */
  async isSimilar(text1: string, text2: string, threshold?: number): Promise<boolean> {
    const similarity = await this.calculateSimilarity(text1, text2);
    return similarity >= (threshold ?? this.cosineThreshold);
  }

  /**
   * 获取最相似的候选
   */
  async findMostSimilar(
    text: string,
    candidates: string[],
    topK: number = 5
  ): Promise<Array<{ text: string; similarity: number }>> {
    const results = await this.calculateSimilarityBatch(text, candidates);
    return results.slice(0, topK);
  }
}

/**
 * 向量工具函数
 */
export class VectorUtils {
  /**
   * 向量加法
   */
  static add(a: number[], b: number[]): number[] {
    return a.map((v, i) => v + b[i]);
  }

  /**
   * 向量减法
   */
  static subtract(a: number[], b: number[]): number[] {
    return a.map((v, i) => v - b[i]);
  }

  /**
   * 向量数乘
   */
  static scale(a: number[], scalar: number): number[] {
    return a.map(v => v * scalar);
  }

  /**
   * 向量归一化
   */
  static normalize(a: number[]): number[] {
    const norm = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
    if (norm === 0) return a;
    return a.map(v => v / norm);
  }

  /**
   * 向量平均
   */
  static average(vectors: number[][]): number[] {
    if (vectors.length === 0) return [];
    
    const sum = vectors.reduce((acc, v) => this.add(acc, v));
    return this.scale(sum, 1 / vectors.length);
  }

  /**
   * 向量量化 (Int8)
   */
  static quantizeInt8(vector: number[]): Int8Array {
    return new Int8Array(vector.map(v => Math.round(v * 127)));
  }

  /**
   * 向量反量化
   */
  static dequantizeInt8(quantized: Int8Array): number[] {
    return Array.from(quantized).map(v => v / 127);
  }
}

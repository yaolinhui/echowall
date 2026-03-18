/**
 * SimHash 算法实现
 * 
 * 原理：
 * 1. 将文本分词，计算每个词的权重（如TF-IDF）
 * 2. 每个词通过哈希函数生成固定位数的二进制哈希
 * 3. 对每一位，如果该位为1则加上权重，为0则减去权重
 * 4. 最终正数为1，负数为0，得到SimHash
 * 5. 相似文本的汉明距离小
 */

import { TextProcessor } from '../utils/text-processing';
import { MurmurHash3, hammingDistance } from '../utils/hash';

export interface SimHashOptions {
  hashBits?: number;
  hammingThreshold?: number;
  shingleSize?: number;
}

export class SimHash {
  private textProcessor: TextProcessor;
  private hashBits: number;
  private hammingThreshold: number;
  private shingleSize: number;

  constructor(options: SimHashOptions = {}) {
    this.textProcessor = new TextProcessor();
    this.hashBits = options.hashBits || 64;
    this.hammingThreshold = options.hammingThreshold || 3;
    this.shingleSize = options.shingleSize || 4;
  }

  /**
   * 计算SimHash值
   */
  compute(text: string): bigint {
    const shingles = this.textProcessor.getShingles(text, this.shingleSize);
    const weights = this.computeWeights(shingles);
    
    // 初始化向量
    const vector: number[] = new Array(this.hashBits).fill(0);
    
    for (const [shingle, weight] of weights) {
      const hash = MurmurHash3.hash32(shingle, 0);
      
      for (let i = 0; i < this.hashBits; i++) {
        const bit = (hash >> i) & 1;
        if (bit === 1) {
          vector[i] += weight;
        } else {
          vector[i] -= weight;
        }
      }
    }
    
    // 转换为二进制
    let simHash = 0n;
    for (let i = 0; i < this.hashBits; i++) {
      if (vector[i] > 0) {
        simHash |= 1n << BigInt(i);
      }
    }
    
    return simHash;
  }

  /**
   * 计算权重（使用词频作为权重）
   */
  private computeWeights(shingles: string[]): Map<string, number> {
    const freq = new Map<string, number>();
    
    for (const shingle of shingles) {
      freq.set(shingle, (freq.get(shingle) || 0) + 1);
    }
    
    // TF-IDF简化版：使用对数频率
    const weights = new Map<string, number>();
    for (const [shingle, count] of freq) {
      weights.set(shingle, Math.log(1 + count));
    }
    
    return weights;
  }

  /**
   * 计算相似度
   */
  similarity(hash1: bigint, hash2: bigint): number {
    const distance = hammingDistance(hash1, hash2);
    return 1 - distance / this.hashBits;
  }

  /**
   * 判断是否相似
   */
  isSimilar(hash1: bigint, hash2: bigint): boolean {
    return hammingDistance(hash1, hash2) <= this.hammingThreshold;
  }

  /**
   * 获取哈希的字符串表示
   */
  toString(hash: bigint): string {
    return hash.toString(16).padStart(this.hashBits / 4, '0');
  }

  /**
   * 从字符串解析哈希
   */
  fromString(str: string): bigint {
    return BigInt('0x' + str);
  }

  /**
   * LSH分桶（用于快速候选筛选）
   * 
   * 将64位hash分成b个bands，每个band有r行
   * 相似文档至少在一个band上匹配
   */
  getLSHBuckets(hash: bigint, bands: number = 8): string[] {
    const r = Math.floor(this.hashBits / bands);
    const buckets: string[] = [];
    
    for (let i = 0; i < bands; i++) {
      const start = i * r;
      const mask = (1n << BigInt(r)) - 1n;
      const band = (hash >> BigInt(start)) & mask;
      buckets.push(`${i}:${band.toString(16)}`);
    }
    
    return buckets;
  }
}

/**
 * SimHash索引 - 用于快速查找相似文档
 */
export class SimHashIndex {
  private hashes: Map<string, bigint> = new Map();
  private buckets: Map<string, Set<string>> = new Map();
  private simHash: SimHash;
  private bands: number;

  constructor(options: SimHashOptions & { bands?: number } = {}) {
    this.simHash = new SimHash(options);
    this.bands = options.bands || 8;
  }

  /**
   * 添加文档
   */
  add(id: string, text: string): void {
    const hash = this.simHash.compute(text);
    this.hashes.set(id, hash);
    
    // 添加到LSH桶
    const buckets = this.simHash.getLSHBuckets(hash, this.bands);
    for (const bucket of buckets) {
      if (!this.buckets.has(bucket)) {
        this.buckets.set(bucket, new Set());
      }
      this.buckets.get(bucket)!.add(id);
    }
  }

  /**
   * 查找相似文档
   */
  findSimilar(text: string, threshold?: number): Array<{ id: string; similarity: number }> {
    const hash = this.simHash.compute(text);
    const candidates = new Set<string>();
    
    // 获取候选（同一LSH桶）
    const buckets = this.simHash.getLSHBuckets(hash, this.bands);
    for (const bucket of buckets) {
      const bucketIds = this.buckets.get(bucket);
      if (bucketIds) {
        for (const id of bucketIds) {
          candidates.add(id);
        }
      }
    }
    
    // 精确计算相似度
    const results: Array<{ id: string; similarity: number }> = [];
    const hammingThresh = threshold !== undefined 
      ? Math.floor((1 - threshold) * this.simHash['hashBits'])
      : this.simHash['hammingThreshold'];
    
    for (const id of candidates) {
      const candidateHash = this.hashes.get(id)!;
      const distance = hammingDistance(hash, candidateHash);
      
      if (distance <= hammingThresh) {
        const similarity = 1 - distance / this.simHash['hashBits'];
        results.push({ id, similarity });
      }
    }
    
    return results.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * 删除文档
   */
  remove(id: string): void {
    const hash = this.hashes.get(id);
    if (!hash) return;
    
    const buckets = this.simHash.getLSHBuckets(hash, this.bands);
    for (const bucket of buckets) {
      this.buckets.get(bucket)?.delete(id);
    }
    
    this.hashes.delete(id);
  }

  /**
   * 获取大小
   */
  size(): number {
    return this.hashes.size;
  }
}

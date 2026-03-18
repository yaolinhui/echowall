/**
 * MinHash 算法实现
 * 
 * 原理：
 * 1. 将文档转换为shingle集合
 * 2. 使用k个哈希函数，对每个shingle计算哈希
 * 3. 对每个哈希函数，取最小值作为签名
 * 4. 两个文档的Jaccard相似度 ≈ 签名匹配比例
 */

import { TextProcessor } from '../utils/text-processing';
import { MurmurHash3 } from '../utils/hash';

export interface MinHashOptions {
  numHashes?: number;
  shingleSize?: number;
  seed?: number;
}

export class MinHash {
  private textProcessor: TextProcessor;
  private numHashes: number;
  private shingleSize: number;
  private seeds: number[];

  constructor(options: MinHashOptions = {}) {
    this.textProcessor = new TextProcessor();
    this.numHashes = options.numHashes || 128;
    this.shingleSize = options.shingleSize || 3;
    
    // 生成不同的种子
    const baseSeed = options.seed || 42;
    this.seeds = Array.from({ length: this.numHashes }, (_, i) => 
      MurmurHash3.hash32(`seed_${i}`, baseSeed)
    );
  }

  /**
   * 计算MinHash签名
   */
  compute(text: string): number[] {
    const shingles = this.textProcessor.getShingles(text, this.shingleSize);
    const signature: number[] = new Array(this.numHashes).fill(Infinity);
    
    for (const shingle of shingles) {
      for (let i = 0; i < this.numHashes; i++) {
        const hash = MurmurHash3.hash32(shingle, this.seeds[i]);
        if (hash < signature[i]) {
          signature[i] = hash;
        }
      }
    }
    
    return signature;
  }

  /**
   * 计算Jaccard相似度
   */
  jaccardSimilarity(sig1: number[], sig2: number[]): number {
    if (sig1.length !== sig2.length) {
      throw new Error('Signatures must have the same length');
    }
    
    let matches = 0;
    for (let i = 0; i < sig1.length; i++) {
      if (sig1[i] === sig2[i]) {
        matches++;
      }
    }
    
    return matches / sig1.length;
  }

  /**
   * 估计原始Jaccard相似度
   */
  estimateJaccard(text1: string, text2: string): number {
    const sig1 = this.compute(text1);
    const sig2 = this.compute(text2);
    return this.jaccardSimilarity(sig1, sig2);
  }
}

/**
 * LSH (Locality Sensitive Hashing) for MinHash
 * 
 * 将签名分成b个bands，每个band有r行
 * 两个文档如果在一个band上完全匹配，则是候选对
 * 
 * 相似度s的文档被捕获的概率：1 - (1 - s^r)^b
 */
export class MinHashLSH {
  private minHash: MinHash;
  private bands: number;
  private rowsPerBand: number;
  private buckets: Map<string, Set<string>> = new Map();
  private signatures: Map<string, number[]> = new Map();

  constructor(options: MinHashOptions & { bands?: number } = {}) {
    this.minHash = new MinHash(options);
    this.bands = options.bands || 16;
    this.rowsPerBand = Math.floor(this.minHash['numHashes'] / this.bands);
  }

  /**
   * 添加文档
   */
  add(id: string, text: string): void {
    const signature = this.minHash.compute(text);
    this.signatures.set(id, signature);
    
    // 分配到LSH桶
    for (let i = 0; i < this.bands; i++) {
      const start = i * this.rowsPerBand;
      const end = start + this.rowsPerBand;
      const band = signature.slice(start, end);
      const bucketKey = `${i}:${band.join(',')}`;
      
      if (!this.buckets.has(bucketKey)) {
        this.buckets.set(bucketKey, new Set());
      }
      this.buckets.get(bucketKey)!.add(id);
    }
  }

  /**
   * 查询候选对
   */
  query(text: string): Array<{ id: string; similarity: number }> {
    const signature = this.minHash.compute(text);
    const candidates = new Set<string>();
    
    // 收集候选
    for (let i = 0; i < this.bands; i++) {
      const start = i * this.rowsPerBand;
      const end = start + this.rowsPerBand;
      const band = signature.slice(start, end);
      const bucketKey = `${i}:${band.join(',')}`;
      
      const bucket = this.buckets.get(bucketKey);
      if (bucket) {
        for (const id of bucket) {
          candidates.add(id);
        }
      }
    }
    
    // 计算精确相似度
    const results: Array<{ id: string; similarity: number }> = [];
    for (const id of candidates) {
      const sig = this.signatures.get(id)!;
      const similarity = this.minHash.jaccardSimilarity(signature, sig);
      results.push({ id, similarity });
    }
    
    return results.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * 查找所有相似对（用于批量处理）
   */
  findAllPairs(threshold: number = 0.8): Array<[string, string, number]> {
    const pairs: Array<[string, string, number]> = [];
    const processed = new Set<string>();
    
    for (const [bucketKey, ids] of this.buckets) {
      const idArray = Array.from(ids);
      
      for (let i = 0; i < idArray.length; i++) {
        for (let j = i + 1; j < idArray.length; j++) {
          const id1 = idArray[i];
          const id2 = idArray[j];
          const pairKey = id1 < id2 ? `${id1}:${id2}` : `${id2}:${id1}`;
          
          if (processed.has(pairKey)) continue;
          processed.add(pairKey);
          
          const sig1 = this.signatures.get(id1)!;
          const sig2 = this.signatures.get(id2)!;
          const similarity = this.minHash.jaccardSimilarity(sig1, sig2);
          
          if (similarity >= threshold) {
            pairs.push([id1, id2, similarity]);
          }
        }
      }
    }
    
    return pairs.sort((a, b) => b[2] - a[2]);
  }

  /**
   * 删除文档
   */
  remove(id: string): void {
    const signature = this.signatures.get(id);
    if (!signature) return;
    
    for (let i = 0; i < this.bands; i++) {
      const start = i * this.rowsPerBand;
      const end = start + this.rowsPerBand;
      const band = signature.slice(start, end);
      const bucketKey = `${i}:${band.join(',')}`;
      
      this.buckets.get(bucketKey)?.delete(id);
    }
    
    this.signatures.delete(id);
  }

  /**
   * 获取大小
   */
  size(): number {
    return this.signatures.size;
  }
}

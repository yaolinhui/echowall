/**
 * 缓存管理器
 * 支持语义相似度缓存
 */

import { SentimentResult, CacheEntry } from '../core/types';

interface CacheConfig {
  enabled: boolean;
  ttl: number; // 毫秒
  similarityThreshold: number;
  maxSize?: number;
}

export class CacheManager {
  private cache: Map<string, CacheEntry>;
  private config: CacheConfig;

  constructor(config: CacheConfig) {
    this.config = config;
    this.cache = new Map();
  }

  /**
   * 获取缓存结果
   */
  async get(text: string): Promise<SentimentResult | null> {
    if (!this.config.enabled) return null;

    const key = this.generateKey(text);
    const entry = this.cache.get(key);

    if (entry && this.isValid(entry)) {
      entry.accessCount++;
      return entry.result;
    }

    // 尝试语义相似匹配
    const similarResult = this.findSimilar(text);
    if (similarResult) {
      return similarResult;
    }

    return null;
  }

  /**
   * 设置缓存
   */
  async set(text: string, result: SentimentResult): Promise<void> {
    if (!this.config.enabled) return;

    // 清理过期条目
    this.cleanup();

    const key = this.generateKey(text);
    const entry: CacheEntry = {
      key,
      result,
      timestamp: Date.now(),
      accessCount: 1,
    };

    this.cache.set(key, entry);
  }

  /**
   * 获取缓存统计
   */
  getStats(): {
    size: number;
    hitRate: number;
    avgAccessCount: number;
  } {
    const entries = Array.from(this.cache.values());
    const totalAccess = entries.reduce((sum, e) => sum + e.accessCount, 0);

    return {
      size: this.cache.size,
      hitRate: this.calculateHitRate(),
      avgAccessCount: entries.length > 0 ? totalAccess / entries.length : 0,
    };
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
  }

  private generateKey(text: string): string {
    // 简单哈希 - 实际项目中可使用更复杂的哈希
    let hash = 0;
    const normalized = text.toLowerCase().trim().replace(/\s+/g, ' ');
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return `sentiment_${hash}`;
  }

  private isValid(entry: CacheEntry): boolean {
    const age = Date.now() - entry.timestamp;
    return age < this.config.ttl;
  }

  private findSimilar(text: string): SentimentResult | null {
    if (this.config.similarityThreshold >= 1) return null;

    const normalizedText = this.normalize(text);

    for (const entry of this.cache.values()) {
      if (!this.isValid(entry)) continue;

      const similarity = this.calculateSimilarity(
        normalizedText,
        this.normalize(entry.result.text)
      );

      if (similarity >= this.config.similarityThreshold) {
        entry.accessCount++;
        return entry.result;
      }
    }

    return null;
  }

  private normalize(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[\s\p{P}]+/gu, '')
      .replace(/\d+/g, '');
  }

  private calculateSimilarity(a: string, b: string): number {
    // 基于编辑距离的简单相似度
    const distance = this.levenshteinDistance(a, b);
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1;
    return 1 - distance / maxLen;
  }

  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (!this.isValid(entry)) {
        this.cache.delete(key);
      }
    }

    // LRU 清理
    if (this.config.maxSize && this.cache.size > this.config.maxSize) {
      const sorted = Array.from(this.cache.entries()).sort(
        (a, b) => a[1].accessCount - b[1].accessCount
      );
      const toRemove = sorted.slice(0, Math.floor(this.cache.size * 0.2));
      for (const [key] of toRemove) {
        this.cache.delete(key);
      }
    }
  }

  private hitCount = 0;
  private missCount = 0;

  recordHit(): void {
    this.hitCount++;
  }

  recordMiss(): void {
    this.missCount++;
  }

  private calculateHitRate(): number {
    const total = this.hitCount + this.missCount;
    return total > 0 ? this.hitCount / total : 0;
  }
}

/**
 * Bloom Filter 实现
 * 
 * 原理：
 * - 使用k个哈希函数和m位的位数组
 * - 添加元素时，将k个哈希位置置为1
 * - 查询时，如果所有k个位置都是1，则可能存在；如果有0，则一定不存在
 * - 允许假阳性，不允许假阴性
 */

import { MurmurHash3 } from '../utils/hash';

export interface BloomFilterOptions {
  size?: number;           // 位数组大小
  hashFunctions?: number;  // 哈希函数数量
  expectedItems?: number;  // 预期元素数量
  falsePositiveRate?: number; // 期望假阳性率
}

export class BloomFilter {
  private bits: Uint8Array;
  private size: number;
  private hashFunctions: number;
  private itemCount: number = 0;

  constructor(options: BloomFilterOptions = {}) {
    if (options.expectedItems && options.falsePositiveRate) {
      // 根据预期元素和假阳性率计算最优参数
      const n = options.expectedItems;
      const p = options.falsePositiveRate;
      this.size = Math.ceil(-(n * Math.log(p)) / (Math.log(2) ** 2));
      this.hashFunctions = Math.ceil((this.size / n) * Math.log(2));
    } else {
      this.size = options.size || 10000;
      this.hashFunctions = options.hashFunctions || 7;
    }
    
    this.bits = new Uint8Array(Math.ceil(this.size / 8));
  }

  /**
   * 添加元素
   */
  add(item: string): void {
    const positions = this.getPositions(item);
    
    for (const pos of positions) {
      const byteIndex = Math.floor(pos / 8);
      const bitIndex = pos % 8;
      this.bits[byteIndex] |= 1 << bitIndex;
    }
    
    this.itemCount++;
  }

  /**
   * 检查可能存在
   */
  mayContain(item: string): boolean {
    const positions = this.getPositions(item);
    
    for (const pos of positions) {
      const byteIndex = Math.floor(pos / 8);
      const bitIndex = pos % 8;
      if ((this.bits[byteIndex] & (1 << bitIndex)) === 0) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * 检查一定不存在（便捷方法）
   */
  definitelyNotContain(item: string): boolean {
    return !this.mayContain(item);
  }

  /**
   * 获取哈希位置
   */
  private getPositions(item: string): number[] {
    const positions: number[] = [];
    
    // 使用双哈希技术生成k个哈希值
    const hash1 = MurmurHash3.hash32(item, 0);
    const hash2 = MurmurHash3.hash32(item, hash1);
    
    for (let i = 0; i < this.hashFunctions; i++) {
      const combined = (hash1 + i * hash2) >>> 0;
      positions.push(combined % this.size);
    }
    
    return positions;
  }

  /**
   * 计算当前假阳性率
   */
  currentFalsePositiveRate(): number {
    const bitsSet = this.bits.reduce((count, byte) => {
      return count + this.countBits(byte);
    }, 0);
    
    const fraction = bitsSet / this.size;
    return Math.pow(fraction, this.hashFunctions);
  }

  /**
   * 统计字节中1的个数
   */
  private countBits(byte: number): number {
    let count = 0;
    let b = byte;
    while (b) {
      count += b & 1;
      b >>= 1;
    }
    return count;
  }

  /**
   * 获取元素数量
   */
  getItemCount(): number {
    return this.itemCount;
  }

  /**
   * 清空过滤器
   */
  clear(): void {
    this.bits.fill(0);
    this.itemCount = 0;
  }

  /**
   * 序列化
   */
  serialize(): { bits: string; size: number; hashFunctions: number; itemCount: number } {
    return {
      bits: Buffer.from(this.bits).toString('base64'),
      size: this.size,
      hashFunctions: this.hashFunctions,
      itemCount: this.itemCount,
    };
  }

  /**
   * 反序列化
   */
  static deserialize(data: { bits: string; size: number; hashFunctions: number; itemCount: number }): BloomFilter {
    const filter = new BloomFilter({
      size: data.size,
      hashFunctions: data.hashFunctions,
    });
    filter.bits = new Uint8Array(Buffer.from(data.bits, 'base64'));
    filter.itemCount = data.itemCount;
    return filter;
  }
}

/**
 * Counting Bloom Filter
 * 支持删除操作，使用计数器代替位
 */
export class CountingBloomFilter {
  private counters: Uint8Array;
  private size: number;
  private hashFunctions: number;
  private itemCount: number = 0;

  constructor(options: BloomFilterOptions = {}) {
    this.size = options.size || 10000;
    this.hashFunctions = options.hashFunctions || 7;
    this.counters = new Uint8Array(this.size);
  }

  add(item: string): void {
    const positions = this.getPositions(item);
    
    for (const pos of positions) {
      if (this.counters[pos] < 255) {
        this.counters[pos]++;
      }
    }
    
    this.itemCount++;
  }

  remove(item: string): void {
    if (!this.mayContain(item)) return;
    
    const positions = this.getPositions(item);
    
    for (const pos of positions) {
      if (this.counters[pos] > 0) {
        this.counters[pos]--;
      }
    }
    
    this.itemCount--;
  }

  mayContain(item: string): boolean {
    const positions = this.getPositions(item);
    
    for (const pos of positions) {
      if (this.counters[pos] === 0) {
        return false;
      }
    }
    
    return true;
  }

  private getPositions(item: string): number[] {
    const positions: number[] = [];
    const hash1 = MurmurHash3.hash32(item, 0);
    const hash2 = MurmurHash3.hash32(item, hash1);
    
    for (let i = 0; i < this.hashFunctions; i++) {
      const combined = (hash1 + i * hash2) >>> 0;
      positions.push(combined % this.size);
    }
    
    return positions;
  }
}

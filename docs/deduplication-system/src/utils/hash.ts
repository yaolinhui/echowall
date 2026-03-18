/**
 * 哈希工具函数
 */

/**
 * MurmurHash3 实现
 */
export class MurmurHash3 {
  /**
   * 32位哈希
   */
  static hash32(key: string, seed: number = 0): number {
    const remainder = key.length & 3;
    const bytes = key.length - remainder;
    const c1 = 0xcc9e2d51;
    const c2 = 0x1b873593;
    
    let h1 = seed;
    let i = 0;
    
    while (i < bytes) {
      let k1 =
        (key.charCodeAt(i) & 0xff) |
        ((key.charCodeAt(i + 1) & 0xff) << 8) |
        ((key.charCodeAt(i + 2) & 0xff) << 16) |
        ((key.charCodeAt(i + 3) & 0xff) << 24);
      
      k1 = this.x86Multiply(k1, c1);
      k1 = this.x86Rotl(k1, 15);
      k1 = this.x86Multiply(k1, c2);
      
      h1 ^= k1;
      h1 = this.x86Rotl(h1, 13);
      h1 = this.x86Multiply(h1, 5) + 0xe6546b64;
      
      i += 4;
    }
    
    let k1 = 0;
    
    switch (remainder) {
      case 3:
        k1 ^= (key.charCodeAt(i + 2) & 0xff) << 16;
      case 2:
        k1 ^= (key.charCodeAt(i + 1) & 0xff) << 8;
      case 1:
        k1 ^= key.charCodeAt(i) & 0xff;
        k1 = this.x86Multiply(k1, c1);
        k1 = this.x86Rotl(k1, 15);
        k1 = this.x86Multiply(k1, c2);
        h1 ^= k1;
    }
    
    h1 ^= key.length;
    h1 = this.x86Fmix(h1);
    
    return h1 >>> 0;
  }
  
  private static x86Multiply(m: number, n: number): number {
    return ((m & 0xffff) * n) + ((((m >>> 16) * n) & 0xffff) << 16);
  }
  
  private static x86Rotl(n: number, b: number): number {
    return (n << b) | (n >>> (32 - b));
  }
  
  private static x86Fmix(h: number): number {
    h ^= h >>> 16;
    h = this.x86Multiply(h, 0x85ebca6b);
    h ^= h >>> 13;
    h = this.x86Multiply(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return h;
  }
}

/**
 * MD5 哈希实现 (简化版)
 */
export function md5Hash(input: string): string {
  // 简化实现，生产环境建议使用 crypto 库
  const encoded = new TextEncoder().encode(input);
  let hash = 0;
  for (let i = 0; i < encoded.length; i++) {
    const char = encoded[i];
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(32, '0');
}

/**
 * 计算汉明距离
 */
export function hammingDistance(a: bigint, b: bigint): number {
  let xor = a ^ b;
  let distance = 0;
  
  while (xor > 0n) {
    distance += Number(xor & 1n);
    xor >>= 1n;
  }
  
  return distance;
}

/**
 * 计算两个哈希数组的相似度
 */
export function hashArraySimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) matches++;
  }
  
  return matches / a.length;
}

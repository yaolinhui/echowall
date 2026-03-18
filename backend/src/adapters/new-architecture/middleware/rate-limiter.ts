/**
 * 限流器实现
 * 
 * 支持多种限流算法：令牌桶、滑动窗口、固定窗口、漏桶
 */

import { Injectable, Logger } from '@nestjs/common';
import { RateLimitConfig, RateLimitStrategy } from '../types';

/**
 * 限流器接口
 */
export interface IRateLimiter {
  /**
   * 尝试获取执行许可
   * @param key 限流键（通常是平台标识）
   * @param tokens 需要的令牌数
   * @returns 是否允许执行
   */
  acquire(key: string, tokens?: number): Promise<boolean>;

  /**
   * 获取执行许可，如果受限则等待
   * @param key 限流键
   * @param tokens 需要的令牌数
   * @param maxWaitMs 最大等待时间
   */
  acquireOrWait(key: string, tokens?: number, maxWaitMs?: number): Promise<boolean>;

  /**
   * 获取当前限流状态
   * @param key 限流键
   */
  getStatus(key: string): {
    remaining: number;
    resetAt: Date;
    limited: boolean;
  };

  /**
   * 重置限流计数
   * @param key 限流键
   */
  reset(key: string): void;
}

/**
 * 限流器工厂
 */
@Injectable()
export class RateLimiterFactory {
  private readonly logger = new Logger(RateLimiterFactory.name);

  create(config: RateLimitConfig): IRateLimiter {
    switch (config.strategy) {
      case RateLimitStrategy.TOKEN_BUCKET:
        return new TokenBucketRateLimiter(config);
      case RateLimitStrategy.SLIDING_WINDOW:
        return new SlidingWindowRateLimiter(config);
      case RateLimitStrategy.FIXED_WINDOW:
        return new FixedWindowRateLimiter(config);
      case RateLimitStrategy.LEAKY_BUCKET:
        return new LeakyBucketRateLimiter(config);
      default:
        this.logger.warn(`Unknown rate limit strategy: ${config.strategy}, using token bucket`);
        return new TokenBucketRateLimiter(config);
    }
  }
}

// ============================================================================
// 令牌桶算法
// ============================================================================

/**
 * 令牌桶限流器
 * 
 * 特点：
 * - 允许突发流量（桶容量内的请求可以立即执行）
 * - 平滑限流，令牌以固定速率生成
 * - 适合 API 限流场景
 */
class TokenBucketRateLimiter implements IRateLimiter {
  private readonly logger = new Logger(TokenBucketRateLimiter.name);
  private buckets = new Map<string, {
    tokens: number;
    lastUpdate: number;
  }>();

  constructor(private config: RateLimitConfig) {
    this.config.burstSize = config.burstSize || config.requestsPerWindow;
  }

  async acquire(key: string, tokens = 1): Promise<boolean> {
    const bucketKey = `${this.config.keyPrefix || 'ratelimit'}:${key}`;
    const now = Date.now();
    
    let bucket = this.buckets.get(bucketKey);
    if (!bucket) {
      bucket = {
        tokens: this.config.burstSize!,
        lastUpdate: now,
      };
      this.buckets.set(bucketKey, bucket);
    }

    // 计算新增令牌
    const timePassed = now - bucket.lastUpdate;
    const tokensToAdd = (timePassed / this.config.windowSizeMs) * this.config.requestsPerWindow;
    bucket.tokens = Math.min(this.config.burstSize!, bucket.tokens + tokensToAdd);
    bucket.lastUpdate = now;

    // 检查是否有足够令牌
    if (bucket.tokens >= tokens) {
      bucket.tokens -= tokens;
      return true;
    }

    return false;
  }

  async acquireOrWait(key: string, tokens = 1, maxWaitMs = 30000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitMs) {
      if (await this.acquire(key, tokens)) {
        return true;
      }

      // 计算等待时间
      const bucket = this.buckets.get(`${this.config.keyPrefix || 'ratelimit'}:${key}`);
      if (bucket) {
        const tokensNeeded = tokens - bucket.tokens;
        const waitTime = (tokensNeeded / this.config.requestsPerWindow) * this.config.windowSizeMs;
        const actualWait = Math.min(waitTime, 100, maxWaitMs - (Date.now() - startTime));
        
        if (actualWait > 0) {
          await sleep(actualWait);
        }
      }
    }

    return false;
  }

  getStatus(key: string): { remaining: number; resetAt: Date; limited: boolean } {
    const bucketKey = `${this.config.keyPrefix || 'ratelimit'}:${key}`;
    const bucket = this.buckets.get(bucketKey);
    
    if (!bucket) {
      return {
        remaining: this.config.burstSize!,
        resetAt: new Date(Date.now() + this.config.windowSizeMs),
        limited: false,
      };
    }

    const now = Date.now();
    const timePassed = now - bucket.lastUpdate;
    const tokensToAdd = (timePassed / this.config.windowSizeMs) * this.config.requestsPerWindow;
    const currentTokens = Math.min(this.config.burstSize!, bucket.tokens + tokensToAdd);
    
    // 计算重置时间
    const tokensToFill = this.config.burstSize! - currentTokens;
    const resetTimeMs = (tokensToFill / this.config.requestsPerWindow) * this.config.windowSizeMs;

    return {
      remaining: Math.floor(currentTokens),
      resetAt: new Date(now + resetTimeMs),
      limited: currentTokens < 1,
    };
  }

  reset(key: string): void {
    const bucketKey = `${this.config.keyPrefix || 'ratelimit'}:${key}`;
    this.buckets.delete(bucketKey);
  }
}

// ============================================================================
// 滑动窗口算法
// ============================================================================

/**
 * 滑动窗口限流器
 * 
 * 特点：
 * - 平滑限流，避免固定窗口的临界突发问题
 * - 内存开销相对较大（需要记录每个请求时间）
 * - 精度高
 */
class SlidingWindowRateLimiter implements IRateLimiter {
  private windows = new Map<string, number[]>();

  constructor(private config: RateLimitConfig) {}

  async acquire(key: string, tokens = 1): Promise<boolean> {
    const windowKey = `${this.config.keyPrefix || 'ratelimit'}:${key}`;
    const now = Date.now();
    const windowStart = now - this.config.windowSizeMs;

    let timestamps = this.windows.get(windowKey) || [];
    
    // 清理过期请求记录
    timestamps = timestamps.filter(t => t > windowStart);
    
    // 检查是否超过限制
    if (timestamps.length + tokens > this.config.requestsPerWindow) {
      this.windows.set(windowKey, timestamps);
      return false;
    }

    // 添加新请求记录
    for (let i = 0; i < tokens; i++) {
      timestamps.push(now);
    }
    this.windows.set(windowKey, timestamps);

    return true;
  }

  async acquireOrWait(key: string, tokens = 1, maxWaitMs = 30000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitMs) {
      if (await this.acquire(key, tokens)) {
        return true;
      }

      // 计算下一个可用时间
      const windowKey = `${this.config.keyPrefix || 'ratelimit'}:${key}`;
      const timestamps = this.windows.get(windowKey) || [];
      
      if (timestamps.length >= tokens) {
        const waitForIndex = timestamps.length - this.config.requestsPerWindow + tokens;
        if (waitForIndex >= 0) {
          const waitUntil = timestamps[Math.floor(waitForIndex)] + this.config.windowSizeMs;
          const waitTime = Math.min(waitUntil - Date.now(), maxWaitMs - (Date.now() - startTime));
          
          if (waitTime > 0) {
            await sleep(waitTime);
          }
        }
      }
    }

    return false;
  }

  getStatus(key: string): { remaining: number; resetAt: Date; limited: boolean } {
    const windowKey = `${this.config.keyPrefix || 'ratelimit'}:${key}`;
    const now = Date.now();
    const windowStart = now - this.config.windowSizeMs;

    let timestamps = this.windows.get(windowKey) || [];
    timestamps = timestamps.filter(t => t > windowStart);

    const remaining = Math.max(0, this.config.requestsPerWindow - timestamps.length);
    
    // 计算重置时间
    let resetAt = new Date(now + this.config.windowSizeMs);
    if (timestamps.length > 0) {
      resetAt = new Date(timestamps[0] + this.config.windowSizeMs);
    }

    return {
      remaining,
      resetAt,
      limited: remaining < 1,
    };
  }

  reset(key: string): void {
    const windowKey = `${this.config.keyPrefix || 'ratelimit'}:${key}`;
    this.windows.delete(windowKey);
  }
}

// ============================================================================
// 固定窗口算法
// ============================================================================

/**
 * 固定窗口限流器
 * 
 * 特点：
 * - 实现简单，内存开销小
 * - 可能存在临界突发问题（窗口边界处）
 * - 适合简单场景
 */
class FixedWindowRateLimiter implements IRateLimiter {
  private windows = new Map<string, {
    count: number;
    windowStart: number;
  }>();

  constructor(private config: RateLimitConfig) {}

  async acquire(key: string, tokens = 1): Promise<boolean> {
    const windowKey = `${this.config.keyPrefix || 'ratelimit'}:${key}`;
    const now = Date.now();
    const currentWindow = Math.floor(now / this.config.windowSizeMs) * this.config.windowSizeMs;

    let window = this.windows.get(windowKey);
    
    if (!window || window.windowStart !== currentWindow) {
      window = { count: 0, windowStart: currentWindow };
    }

    if (window.count + tokens > this.config.requestsPerWindow) {
      this.windows.set(windowKey, window);
      return false;
    }

    window.count += tokens;
    this.windows.set(windowKey, window);

    return true;
  }

  async acquireOrWait(key: string, tokens = 1, maxWaitMs = 30000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitMs) {
      if (await this.acquire(key, tokens)) {
        return true;
      }

      // 等待下一个窗口
      const now = Date.now();
      const currentWindow = Math.floor(now / this.config.windowSizeMs) * this.config.windowSizeMs;
      const nextWindow = currentWindow + this.config.windowSizeMs;
      const waitTime = Math.min(nextWindow - now, maxWaitMs - (Date.now() - startTime));
      
      if (waitTime > 0) {
        await sleep(waitTime);
      }
    }

    return false;
  }

  getStatus(key: string): { remaining: number; resetAt: Date; limited: boolean } {
    const windowKey = `${this.config.keyPrefix || 'ratelimit'}:${key}`;
    const now = Date.now();
    const currentWindow = Math.floor(now / this.config.windowSizeMs) * this.config.windowSizeMs;

    const window = this.windows.get(windowKey);
    
    if (!window || window.windowStart !== currentWindow) {
      return {
        remaining: this.config.requestsPerWindow,
        resetAt: new Date(currentWindow + this.config.windowSizeMs),
        limited: false,
      };
    }

    return {
      remaining: Math.max(0, this.config.requestsPerWindow - window.count),
      resetAt: new Date(currentWindow + this.config.windowSizeMs),
      limited: window.count >= this.config.requestsPerWindow,
    };
  }

  reset(key: string): void {
    const windowKey = `${this.config.keyPrefix || 'ratelimit'}:${key}`;
    this.windows.delete(windowKey);
  }
}

// ============================================================================
// 漏桶算法
// ============================================================================

/**
 * 漏桶限流器
 * 
 * 特点：
 * - 严格匀速处理请求
 * - 无突发能力
 * - 适合需要严格平滑处理的场景
 */
class LeakyBucketRateLimiter implements IRateLimiter {
  private buckets = new Map<string, {
    volume: number;
    lastLeak: number;
  }>();

  constructor(private config: RateLimitConfig) {}

  async acquire(key: string, tokens = 1): Promise<boolean> {
    const bucketKey = `${this.config.keyPrefix || 'ratelimit'}:${key}`;
    const now = Date.now();
    const leakRate = this.config.requestsPerWindow / this.config.windowSizeMs; // 每秒泄漏量

    let bucket = this.buckets.get(bucketKey);
    if (!bucket) {
      bucket = { volume: 0, lastLeak: now };
    }

    // 计算泄漏量
    const timePassed = now - bucket.lastLeak;
    const leaked = timePassed * leakRate;
    bucket.volume = Math.max(0, bucket.volume - leaked);
    bucket.lastLeak = now;

    // 检查是否溢出（桶容量 = requestsPerWindow）
    if (bucket.volume + tokens > this.config.requestsPerWindow) {
      this.buckets.set(bucketKey, bucket);
      return false;
    }

    bucket.volume += tokens;
    this.buckets.set(bucketKey, bucket);

    return true;
  }

  async acquireOrWait(key: string, tokens = 1, maxWaitMs = 30000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitMs) {
      if (await this.acquire(key, tokens)) {
        return true;
      }

      // 计算等待时间
      const bucketKey = `${this.config.keyPrefix || 'ratelimit'}:${key}`;
      const bucket = this.buckets.get(bucketKey);
      
      if (bucket) {
        const leakRate = this.config.requestsPerWindow / this.config.windowSizeMs;
        const waitTime = Math.ceil(bucket.volume / leakRate);
        const actualWait = Math.min(waitTime, maxWaitMs - (Date.now() - startTime));
        
        if (actualWait > 0) {
          await sleep(actualWait);
        }
      }
    }

    return false;
  }

  getStatus(key: string): { remaining: number; resetAt: Date; limited: boolean } {
    const bucketKey = `${this.config.keyPrefix || 'ratelimit'}:${key}`;
    const now = Date.now();
    const leakRate = this.config.requestsPerWindow / this.config.windowSizeMs;

    let bucket = this.buckets.get(bucketKey);
    if (!bucket) {
      return {
        remaining: this.config.requestsPerWindow,
        resetAt: new Date(now),
        limited: false,
      };
    }

    // 计算当前水量
    const timePassed = now - bucket.lastLeak;
    const leaked = timePassed * leakRate;
    const currentVolume = Math.max(0, bucket.volume - leaked);

    // 计算排空时间
    const timeToEmpty = currentVolume / leakRate;

    return {
      remaining: Math.max(0, this.config.requestsPerWindow - Math.ceil(currentVolume)),
      resetAt: new Date(now + timeToEmpty),
      limited: currentVolume >= this.config.requestsPerWindow,
    };
  }

  reset(key: string): void {
    const bucketKey = `${this.config.keyPrefix || 'ratelimit'}:${key}`;
    this.buckets.delete(bucketKey);
  }
}

// ============================================================================
// 工具函数
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

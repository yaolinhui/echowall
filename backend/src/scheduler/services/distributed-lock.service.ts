import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { REDIS_KEY_PREFIXES } from '../constants/queue.constants';

/**
 * 分布式锁选项
 */
export interface LockOptions {
  /** 锁超时时间 (ms) */
  ttl: number;
  
  /** 是否自动续期 */
  autoRenew?: boolean;
  
  /** 续期间隔 (ms) */
  renewInterval?: number;
  
  /** 重试次数 */
  retryCount?: number;
  
  /** 重试延迟 (ms) */
  retryDelay?: number;
}

/**
 * 锁对象
 */
export interface Lock {
  /** 锁标识 */
  token: string;
  
  /** 资源名称 */
  resource: string;
  
  /** 释放锁 */
  release: () => Promise<void>;
  
  /** 续期锁 */
  renew: (ttl: number) => Promise<boolean>;
  
  /** 是否已释放 */
  isReleased: () => boolean;
}

/**
 * 分布式锁服务
 * 
 * 基于 Redis 实现分布式锁，支持：
 * - 非阻塞锁获取
 * - 自动续期
 * - 安全释放
 * - 锁超时保护
 */
@Injectable()
export class DistributedLockService {
  private readonly logger = new Logger(DistributedLockService.name);
  private readonly redis: Redis;
  private readonly defaultLockTTL: number;
  private readonly renewIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(private configService: ConfigService) {
    this.redis = new Redis({
      host: this.configService.get('redis.host', 'localhost'),
      port: this.configService.get('redis.port', 6379),
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });
    
    this.defaultLockTTL = this.configService.get('scheduler.lockTTL', 30000);
  }

  /**
   * 获取分布式锁
   * 
   * @param resource 资源名称
   * @param options 锁选项
   * @returns 锁对象，获取失败返回 null
   * 
   * @example
   * ```typescript
   * const lock = await lockService.acquire('task:123', { ttl: 60000 });
   * if (lock) {
   *   try {
   *     // 执行任务
   *   } finally {
   *     await lock.release();
   *   }
   * }
   * ```
   */
  async acquire(resource: string, options?: Partial<LockOptions>): Promise<Lock | null> {
    const opts: LockOptions = {
      ttl: this.defaultLockTTL,
      autoRenew: false,
      renewInterval: Math.floor(this.defaultLockTTL / 3),
      retryCount: 0,
      retryDelay: 100,
      ...options,
    };

    const token = uuidv4();
    const key = this.getLockKey(resource);
    
    // 尝试获取锁，支持重试
    for (let attempt = 0; attempt <= opts.retryCount; attempt++) {
      try {
        const acquired = await this.tryAcquireLock(key, token, opts.ttl);
        
        if (acquired) {
          this.logger.debug(`Lock acquired: ${resource} (token: ${token})`);
          
          const lock = this.createLock(resource, token, key, opts);
          
          // 启用自动续期
          if (opts.autoRenew) {
            this.startAutoRenew(lock, opts);
          }
          
          return lock;
        }
        
        // 最后一次不重试
        if (attempt < opts.retryCount) {
          await this.sleep(opts.retryDelay);
        }
      } catch (error) {
        this.logger.error(`Failed to acquire lock ${resource}:`, error);
        throw error;
      }
    }
    
    this.logger.debug(`Failed to acquire lock: ${resource}`);
    return null;
  }

  /**
   * 尝试获取锁（原子操作）
   */
  private async tryAcquireLock(key: string, token: string, ttl: number): Promise<boolean> {
    // 使用 NX 选项：只有当键不存在时才设置
    // 使用 PX 选项：设置过期时间（毫秒）
    const result = await this.redis.set(key, token, 'PX', ttl, 'NX');
    return result === 'OK';
  }

  /**
   * 创建锁对象
   */
  private createLock(
    resource: string,
    token: string,
    key: string,
    options: LockOptions
  ): Lock {
    let released = false;
    
    return {
      token,
      resource,
      
      isReleased: () => released,
      
      release: async () => {
        if (released) {
          return;
        }
        
        // 停止自动续期
        this.stopAutoRenew(token);
        
        // 使用 Lua 脚本原子释放锁
        // 只有当值匹配时才删除，防止误删其他客户端的锁
        const luaScript = `
          if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
          else
            return 0
          end
        `;
        
        try {
          await this.redis.eval(luaScript, 1, key, token);
          released = true;
          this.logger.debug(`Lock released: ${resource}`);
        } catch (error) {
          this.logger.error(`Failed to release lock ${resource}:`, error);
          throw error;
        }
      },
      
      renew: async (ttl: number) => {
        if (released) {
          return false;
        }
        
        const luaScript = `
          if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("pexpire", KEYS[1], ARGV[2])
          else
            return 0
          end
        `;
        
        try {
          const result = await this.redis.eval(
            luaScript,
            1,
            key,
            token,
            ttl.toString()
          );
          
          const renewed = result === 1;
          if (renewed) {
            this.logger.debug(`Lock renewed: ${resource} (ttl: ${ttl}ms)`);
          }
          return renewed;
        } catch (error) {
          this.logger.error(`Failed to renew lock ${resource}:`, error);
          return false;
        }
      },
    };
  }

  /**
   * 启动自动续期
   */
  private startAutoRenew(lock: Lock, options: LockOptions): void {
    const interval = setInterval(async () => {
      try {
        const renewed = await lock.renew(options.ttl);
        if (!renewed) {
          this.logger.warn(`Lock auto-renew failed: ${lock.resource}`);
          this.stopAutoRenew(lock.token);
        }
      } catch (error) {
        this.logger.error(`Lock auto-renew error: ${lock.resource}`, error);
      }
    }, options.renewInterval);
    
    this.renewIntervals.set(lock.token, interval);
  }

  /**
   * 停止自动续期
   */
  private stopAutoRenew(token: string): void {
    const interval = this.renewIntervals.get(token);
    if (interval) {
      clearInterval(interval);
      this.renewIntervals.delete(token);
    }
  }

  /**
   * 获取任务去重锁
   * 用于防止同一任务在短时间内重复执行
   * 
   * @param taskId 任务 ID
   * @param window 时间窗口 (ms)
   */
  async acquireTaskLock(taskId: string, window: number = 60000): Promise<boolean> {
    const key = `${REDIS_KEY_PREFIXES.TASK_DEDUP}${taskId}`;
    const result = await this.redis.set(key, '1', 'PX', window, 'NX');
    return result === 'OK';
  }

  /**
   * 释放任务去重锁
   */
  async releaseTaskLock(taskId: string): Promise<void> {
    const key = `${REDIS_KEY_PREFIXES.TASK_DEDUP}${taskId}`;
    await this.redis.del(key);
  }

  /**
   * 检查任务是否已锁定
   */
  async isTaskLocked(taskId: string): Promise<boolean> {
    const key = `${REDIS_KEY_PREFIXES.TASK_DEDUP}${taskId}`;
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  /**
   * 获取锁的剩余时间
   */
  async getLockTTL(resource: string): Promise<number> {
    const key = this.getLockKey(resource);
    return await this.redis.pttl(key);
  }

  /**
   * 强制释放锁（危险操作，谨慎使用）
   */
  async forceRelease(resource: string): Promise<void> {
    const key = this.getLockKey(resource);
    await this.redis.del(key);
    this.logger.warn(`Lock force released: ${resource}`);
  }

  /**
   * 获取锁的 Redis Key
   */
  private getLockKey(resource: string): string {
    return `${REDIS_KEY_PREFIXES.TASK_LOCK}${resource}`;
  }

  /**
   * 延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 应用关闭时清理资源
   */
  async onModuleDestroy(): Promise<void> {
    // 停止所有自动续期
    for (const [token, interval] of this.renewIntervals.entries()) {
      clearInterval(interval);
      this.logger.debug(`Stopped auto-renew for token: ${token}`);
    }
    this.renewIntervals.clear();
    
    // 关闭 Redis 连接
    await this.redis.quit();
    this.logger.log('DistributedLockService destroyed');
  }
}

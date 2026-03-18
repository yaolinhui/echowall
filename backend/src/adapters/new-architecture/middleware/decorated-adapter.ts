/**
 * 装饰器适配器
 * 
 * 包装基础适配器，添加以下功能：
 * - 限流控制
 * - 自动重试
 * - 熔断保护
 * - 指标收集
 * - 错误处理
 */

import { Logger } from '@nestjs/common';
import { IAdapter } from '../core/adapter.interface';
import {
  AdapterConfig,
  AdapterStatus,
  FetchOptions,
  FetchResult,
  AdapterMetrics,
  UnifiedMention,
  ErrorCategory,
  RateLimitConfig,
  RetryConfig,
  CircuitBreakerConfig,
} from '../types';
import { IRateLimiter, RateLimiterFactory } from './rate-limiter';
import { RetryHandler, RetryResult } from './retry-handler';
import { CircuitBreaker, CircuitBreakerManager } from './circuit-breaker';

/**
 * 装饰器配置
 */
export interface DecoratorConfig {
  rateLimit?: RateLimitConfig;
  retry?: RetryConfig;
  circuitBreaker?: CircuitBreakerConfig;
  metricsEnabled?: boolean;
  loggingEnabled?: boolean;
}

/**
 * 装饰器适配器
 * 
 * 使用装饰器模式包装基础适配器，添加横切关注点
 */
export class DecoratedAdapter implements IAdapter {
  private readonly logger: Logger;
  private rateLimiter?: IRateLimiter;
  private retryHandler: RetryHandler;
  private circuitBreaker?: CircuitBreaker;
  private decoratorConfig: DecoratorConfig;
  private requestTimestamps: number[] = [];

  constructor(
    private readonly baseAdapter: IAdapter,
    config?: Partial<DecoratorConfig>
  ) {
    this.logger = new Logger(`DecoratedAdapter:${baseAdapter.platform}`);
    this.decoratorConfig = {
      metricsEnabled: true,
      loggingEnabled: true,
      ...config,
    };

    // 初始化限流器
    if (this.decoratorConfig.rateLimit) {
      const factory = new RateLimiterFactory();
      this.rateLimiter = factory.create(this.decoratorConfig.rateLimit);
    }

    // 初始化重试处理器
    this.retryHandler = new RetryHandler(baseAdapter.platform);

    // 初始化熔断器
    if (this.decoratorConfig.circuitBreaker?.enabled) {
      const manager = new CircuitBreakerManager();
      this.circuitBreaker = manager.getOrCreate(
        baseAdapter.platform,
        this.decoratorConfig.circuitBreaker
      );
    }
  }

  // ============================================================================
  // IAdapter 实现（委托给基础适配器，添加增强功能）
  // ============================================================================

  get platform(): string {
    return this.baseAdapter.platform;
  }

  get status(): AdapterStatus {
    return this.baseAdapter.status;
  }

  get config(): AdapterConfig {
    return this.baseAdapter.config;
  }

  async initialize(adapterConfig: AdapterConfig): Promise<void> {
    this.log('Initializing...');
    await this.baseAdapter.initialize(adapterConfig);
    
    // 合并配置
    if (adapterConfig.rateLimit) {
      this.decoratorConfig.rateLimit = { ...this.decoratorConfig.rateLimit, ...adapterConfig.rateLimit };
    }
    if (adapterConfig.retry) {
      this.decoratorConfig.retry = { ...this.decoratorConfig.retry, ...adapterConfig.retry };
    }
    if (adapterConfig.circuitBreaker) {
      this.decoratorConfig.circuitBreaker = { 
        ...this.decoratorConfig.circuitBreaker, 
        ...adapterConfig.circuitBreaker 
      };
    }
  }

  async validateConfig(adapterConfig: AdapterConfig): Promise<boolean> {
    return this.baseAdapter.validateConfig(adapterConfig);
  }

  async testConnection(): Promise<{ success: boolean; message?: string }> {
    this.log('Testing connection...');
    return this.baseAdapter.testConnection();
  }

  async fetch(options?: FetchOptions): Promise<FetchResult> {
    const operationName = 'fetch';
    
    // 1. 检查限流
    if (this.rateLimiter) {
      const allowed = await this.rateLimiter.acquireOrWait(
        this.platform,
        1,
        30000
      );
      
      if (!allowed) {
        this.logger.warn('Rate limit exceeded');
        throw new Error(`Rate limit exceeded for ${this.platform}`);
      }
    }

    // 2. 定义操作
    const operation = async () => {
      return this.baseAdapter.fetch(options);
    };

    // 3. 执行（带熔断和重试）
    return this.executeWithProtection(operationName, operation);
  }

  async fetchById(externalId: string): Promise<UnifiedMention | null> {
    const operationName = 'fetchById';
    
    // 限流检查
    if (this.rateLimiter) {
      const allowed = await this.rateLimiter.acquireOrWait(this.platform, 1, 30000);
      if (!allowed) {
        throw new Error(`Rate limit exceeded for ${this.platform}`);
      }
    }

    const operation = async () => {
      return this.baseAdapter.fetchById(externalId);
    };

    return this.executeWithProtection(operationName, operation);
  }

  transform(raw: any): UnifiedMention | null {
    return this.baseAdapter.transform(raw);
  }

  transformBatch(rawItems: any[]): UnifiedMention[] {
    return this.baseAdapter.transformBatch(rawItems);
  }

  getMetrics(): AdapterMetrics {
    const baseMetrics = this.baseAdapter.getMetrics();
    
    // 添加装饰器层面的指标
    if (this.decoratorConfig.metricsEnabled) {
      return {
        ...baseMetrics,
        // 可以添加额外的指标，如限流命中率等
      };
    }
    
    return baseMetrics;
  }

  resetMetrics(): void {
    this.requestTimestamps = [];
    this.baseAdapter.resetMetrics();
  }

  async pause(): Promise<void> {
    this.log('Pausing...');
    await this.baseAdapter.pause();
  }

  async resume(): Promise<void> {
    this.log('Resuming...');
    await this.baseAdapter.resume();
  }

  async disable(): Promise<void> {
    this.log('Disabling...');
    await this.baseAdapter.disable();
  }

  async enable(): Promise<void> {
    this.log('Enabling...');
    await this.baseAdapter.enable();
  }

  async updateConfig(newConfig: Partial<AdapterConfig>): Promise<void> {
    this.log('Updating config...');
    
    // 更新装饰器配置
    if (newConfig.rateLimit) {
      this.decoratorConfig.rateLimit = { ...this.decoratorConfig.rateLimit, ...newConfig.rateLimit };
      // 重新创建限流器
      if (this.decoratorConfig.rateLimit) {
        const factory = new RateLimiterFactory();
        this.rateLimiter = factory.create(this.decoratorConfig.rateLimit);
      }
    }
    
    if (newConfig.circuitBreaker) {
      this.decoratorConfig.circuitBreaker = { 
        ...this.decoratorConfig.circuitBreaker, 
        ...newConfig.circuitBreaker 
      };
      this.circuitBreaker?.updateConfig(this.decoratorConfig.circuitBreaker);
    }

    await this.baseAdapter.updateConfig(newConfig);
  }

  async dispose(): Promise<void> {
    this.log('Disposing...');
    await this.baseAdapter.dispose();
  }

  handleError(error: Error, context?: Record<string, any>): { category: ErrorCategory; retryable: boolean } {
    return this.baseAdapter.handleError(error, context);
  }

  // ============================================================================
  // 保护执行方法
  // ============================================================================

  private async executeWithProtection<T>(
    operationName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    // 包装操作为支持熔断的形式
    const protectedOperation = async (): Promise<T> => {
      // 如果有重试配置，使用重试处理器
      if (this.decoratorConfig.retry && this.decoratorConfig.retry.maxAttempts > 1) {
        const result: RetryResult<T> = await this.retryHandler.execute(
          async () => operation(),
          this.decoratorConfig.retry!
        );

        if (result.success) {
          return result.data!;
        } else {
          throw result.error!;
        }
      }

      // 无重试配置，直接执行
      return operation();
    };

    // 如果有熔断器，使用熔断保护
    if (this.circuitBreaker) {
      return this.circuitBreaker.execute(protectedOperation);
    }

    return protectedOperation();
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  private log(message: string): void {
    if (this.decoratorConfig.loggingEnabled) {
      this.logger.log(message);
    }
  }

  /**
   * 获取限流状态
   */
  getRateLimitStatus(): { remaining: number; resetAt: Date; limited: boolean } | undefined {
    if (!this.rateLimiter) return undefined;
    return this.rateLimiter.getStatus(this.platform);
  }

  /**
   * 重置限流
   */
  resetRateLimit(): void {
    this.rateLimiter?.reset(this.platform);
  }

  /**
   * 获取熔断器状态
   */
  getCircuitBreakerState(): string | undefined {
    return this.circuitBreaker?.getState();
  }

  /**
   * 强制关闭熔断器
   */
  forceCloseCircuitBreaker(): void {
    this.circuitBreaker?.forceClose();
  }

  /**
   * 强制打开熔断器
   */
  forceOpenCircuitBreaker(): void {
    this.circuitBreaker?.forceOpen();
  }

  /**
   * 获取熔断器指标
   */
  getCircuitBreakerMetrics() {
    return this.circuitBreaker?.getMetrics();
  }
}

/**
 * 装饰器构建器
 */
export class DecoratedAdapterBuilder {
  private config: DecoratorConfig = {};

  withRateLimit(config: RateLimitConfig): this {
    this.config.rateLimit = config;
    return this;
  }

  withRetry(config: RetryConfig): this {
    this.config.retry = config;
    return this;
  }

  withCircuitBreaker(config: CircuitBreakerConfig): this {
    this.config.circuitBreaker = config;
    return this;
  }

  withMetrics(enabled: boolean): this {
    this.config.metricsEnabled = enabled;
    return this;
  }

  withLogging(enabled: boolean): this {
    this.config.loggingEnabled = enabled;
    return this;
  }

  build(baseAdapter: IAdapter): DecoratedAdapter {
    return new DecoratedAdapter(baseAdapter, this.config);
  }
}

/**
 * 创建装饰器适配器的便捷函数
 */
export function withEnhancements(
  adapter: IAdapter,
  config?: Partial<DecoratorConfig>
): DecoratedAdapter {
  return new DecoratedAdapter(adapter, config);
}

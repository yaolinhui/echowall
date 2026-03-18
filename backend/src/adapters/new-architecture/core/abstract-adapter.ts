/**
 * 抽象适配器基类
 * 
 * 提供适配器的通用实现，具体平台适配器应继承此类
 */

import { Logger } from '@nestjs/common';
import {
  IAdapter,
  IAdapterLifecycleHooks,
  IAdapterCapabilities,
} from './adapter.interface';
import {
  AdapterConfig,
  AdapterStatus,
  FetchOptions,
  FetchResult,
  AdapterMetrics,
  UnifiedMention,
  ErrorCategory,
  RetryConfig,
  DEFAULT_RETRY_CONFIG,
} from '../types';

/**
 * 抽象适配器基类
 * 
 * 实现了 IAdapter 接口的通用逻辑，具体平台适配器只需实现抽象方法
 */
export abstract class AbstractAdapter implements IAdapter, IAdapterLifecycleHooks {
  protected readonly logger: Logger;
  protected _status: AdapterStatus = AdapterStatus.LOADED;
  protected _config: AdapterConfig;
  protected _metrics: AdapterMetrics;
  protected _lastFetchAt?: Date;
  protected _lastErrorAt?: Date;
  protected _initialized = false;

  constructor(
    public readonly platform: string,
  ) {
    this.logger = new Logger(`${platform.toUpperCase()}Adapter`);
    this._config = this.getDefaultConfig();
    this._metrics = this.createInitialMetrics();
  }

  // ============================================================================
  // 抽象方法 - 子类必须实现
  // ============================================================================

  /**
   * 执行实际的获取操作
   * @param options 获取选项
   */
  protected abstract doFetch(options?: FetchOptions): Promise<FetchResult>;

  /**
   * 执行实际的单条获取操作
   * @param externalId 外部ID
   */
  protected abstract doFetchById(externalId: string): Promise<UnifiedMention | null>;

  /**
   * 将平台原始数据转换为统一格式
   * @param raw 原始数据
   */
  abstract transform(raw: any): UnifiedMention | null;

  /**
   * 验证平台特定配置
   * @param config 待验证配置
   */
  protected abstract validatePlatformConfig(config: AdapterConfig): Promise<boolean>;

  /**
   * 执行平台特定的初始化
   * @param config 配置
   */
  protected abstract initializePlatform(config: AdapterConfig): Promise<void>;

  /**
   * 执行平台特定的资源释放
   */
  protected abstract disposePlatform(): Promise<void>;

  /**
   * 分类错误
   * @param error 错误对象
   */
  protected abstract categorizeError(error: Error): ErrorCategory;

  // ============================================================================
  // 通用方法实现
  // ============================================================================

  get status(): AdapterStatus {
    return this._status;
  }

  get config(): AdapterConfig {
    return { ...this._config };
  }

  async initialize(config: AdapterConfig): Promise<void> {
    if (this._initialized) {
      this.logger.warn('Adapter already initialized');
      return;
    }

    try {
      this._status = AdapterStatus.LOADED;
      
      // 生命周期钩子：初始化前
      await this.beforeInitialize?.(config);

      // 合并配置
      this._config = { ...this.getDefaultConfig(), ...config };
      
      // 验证配置
      const isValid = await this.validateConfig(this._config);
      if (!isValid) {
        throw new Error('Invalid adapter configuration');
      }
      this._status = AdapterStatus.VALID;

      // 平台特定初始化
      await this.initializePlatform(this._config);
      
      this._initialized = true;
      this._status = AdapterStatus.ACTIVE;
      
      // 生命周期钩子：初始化后
      await this.afterInitialize?.();
      
      this.logger.log(`Adapter initialized successfully`);
    } catch (error) {
      this._status = AdapterStatus.ERROR;
      this._lastErrorAt = new Date();
      this.logger.error(`Failed to initialize adapter: ${error.message}`, error.stack);
      throw error;
    }
  }

  async validateConfig(config: AdapterConfig): Promise<boolean> {
    // 基础验证
    if (!config.platform) {
      this.logger.error('Platform is required');
      return false;
    }

    if (config.platform !== this.platform) {
      this.logger.error(`Platform mismatch: expected ${this.platform}, got ${config.platform}`);
      return false;
    }

    // 平台特定验证
    return this.validatePlatformConfig(config);
  }

  async testConnection(): Promise<{ success: boolean; message?: string }> {
    if (!this._initialized) {
      return { success: false, message: 'Adapter not initialized' };
    }

    if (this._status !== AdapterStatus.ACTIVE) {
      return { success: false, message: `Adapter status is ${this._status}` };
    }

    try {
      // 尝试执行一个简单的请求来测试连接
      const result = await this.doFetch({ limit: 1 });
      return { 
        success: true, 
        message: `Connection successful, fetched ${result.data.length} items` 
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async fetch(options?: FetchOptions): Promise<FetchResult> {
    this.ensureActive();

    const startTime = Date.now();
    this._metrics.requestsTotal++;

    try {
      // 生命周期钩子：获取前
      await this.beforeFetch?.(options);

      const result = await this.doFetch(options);

      // 更新指标
      this._metrics.requestsSuccess++;
      this._metrics.itemsFetched += result.data.length;
      this._metrics.itemsTransformed += result.data.length;
      this._lastFetchAt = new Date();

      // 更新延迟指标
      this.updateLatencyMetrics(Date.now() - startTime);

      // 生命周期钩子：获取后
      await this.afterFetch?.(result);

      return result;
    } catch (error) {
      this._metrics.requestsFailed++;
      this._lastErrorAt = new Date();
      
      const { category } = this.handleError(error, { operation: 'fetch', options });
      this._metrics.errorsByCategory[category] = (this._metrics.errorsByCategory[category] || 0) + 1;

      throw error;
    }
  }

  async fetchById(externalId: string): Promise<UnifiedMention | null> {
    this.ensureActive();

    const startTime = Date.now();
    this._metrics.requestsTotal++;

    try {
      const result = await this.doFetchById(externalId);

      this._metrics.requestsSuccess++;
      if (result) {
        this._metrics.itemsFetched++;
        this._metrics.itemsTransformed++;
      }
      this._lastFetchAt = new Date();

      this.updateLatencyMetrics(Date.now() - startTime);

      return result;
    } catch (error) {
      this._metrics.requestsFailed++;
      this._lastErrorAt = new Date();
      
      const { category } = this.handleError(error, { operation: 'fetchById', externalId });
      this._metrics.errorsByCategory[category] = (this._metrics.errorsByCategory[category] || 0) + 1;

      throw error;
    }
  }

  transformBatch(rawItems: any[]): UnifiedMention[] {
    if (!Array.isArray(rawItems)) {
      this.logger.warn('transformBatch expected an array');
      return [];
    }

    const results: UnifiedMention[] = [];
    
    for (const raw of rawItems) {
      try {
        const transformed = this.transform(raw);
        if (transformed) {
          results.push(transformed);
        } else {
          this._metrics.itemsFiltered++;
        }
      } catch (error) {
        this.logger.warn(`Failed to transform item: ${error.message}`);
        this._metrics.itemsFiltered++;
      }
    }

    return results;
  }

  getMetrics(): AdapterMetrics {
    return { ...this._metrics };
  }

  resetMetrics(): void {
    this._metrics = this.createInitialMetrics();
  }

  async pause(): Promise<void> {
    if (this._status !== AdapterStatus.ACTIVE) {
      this.logger.warn(`Cannot pause adapter with status ${this._status}`);
      return;
    }

    this._status = AdapterStatus.PAUSED;
    this.logger.log('Adapter paused');
  }

  async resume(): Promise<void> {
    if (this._status !== AdapterStatus.PAUSED) {
      this.logger.warn(`Cannot resume adapter with status ${this._status}`);
      return;
    }

    this._status = AdapterStatus.ACTIVE;
    this.logger.log('Adapter resumed');
  }

  async disable(): Promise<void> {
    this._status = AdapterStatus.DISABLED;
    this.logger.log('Adapter disabled');
  }

  async enable(): Promise<void> {
    if (this._status === AdapterStatus.DISABLED) {
      this._status = AdapterStatus.ACTIVE;
      this.logger.log('Adapter enabled');
    }
  }

  async updateConfig(config: Partial<AdapterConfig>): Promise<void> {
    const oldConfig = { ...this._config };
    this._config = { ...this._config, ...config };

    try {
      await this.onConfigUpdate?.(config);
      this.logger.log('Config updated successfully');
    } catch (error) {
      // 回滚配置
      this._config = oldConfig;
      throw error;
    }
  }

  async dispose(): Promise<void> {
    if (!this._initialized) {
      return;
    }

    try {
      await this.beforeDispose?.();
      await this.disposePlatform();
      this._status = AdapterStatus.UNLOADED;
      this._initialized = false;
      this.logger.log('Adapter disposed');
    } catch (error) {
      this.logger.error(`Error during dispose: ${error.message}`);
      throw error;
    }
  }

  handleError(error: Error, context?: Record<string, any>): { category: ErrorCategory; retryable: boolean } {
    const category = this.categorizeError(error);
    const retryable = this.isRetryableError(category);

    this.logger.error(
      `Error in ${context?.operation || 'unknown operation'}: ${error.message}`,
      { category, retryable, context, stack: error.stack }
    );

    // 生命周期钩子
    this.onError?.(error, context || {}).catch(e => {
      this.logger.error(`Error in error handler: ${e.message}`);
    });

    return { category, retryable };
  }

  // ============================================================================
  // 受保护的方法
  // ============================================================================

  protected ensureActive(): void {
    if (!this._initialized) {
      throw new Error('Adapter not initialized');
    }

    if (this._status === AdapterStatus.PAUSED) {
      throw new Error('Adapter is paused');
    }

    if (this._status === AdapterStatus.DISABLED) {
      throw new Error('Adapter is disabled');
    }

    if (this._status === AdapterStatus.ERROR) {
      throw new Error('Adapter is in error state');
    }
  }

  protected isRetryableError(category: ErrorCategory): boolean {
    const retryableCategories: ErrorCategory[] = [
      ErrorCategory.NETWORK_ERROR,
      ErrorCategory.RATE_LIMITED,
      ErrorCategory.SERVER_ERROR,
      ErrorCategory.TIMEOUT_ERROR,
    ];
    return retryableCategories.includes(category);
  }

  protected getDefaultConfig(): AdapterConfig {
    return {
      platform: this.platform,
      enabled: true,
      retry: DEFAULT_RETRY_CONFIG,
    };
  }

  protected createInitialMetrics(): AdapterMetrics {
    return {
      platform: this.platform,
      status: this._status,
      requestsTotal: 0,
      requestsSuccess: 0,
      requestsFailed: 0,
      latencyAvg: 0,
      latencyMin: Infinity,
      latencyMax: 0,
      latencyP95: 0,
      latencyP99: 0,
      rateLimitHits: 0,
      rateLimitWaits: 0,
      queuedRequests: 0,
      errorsByCategory: {},
      itemsFetched: 0,
      itemsTransformed: 0,
      itemsFiltered: 0,
      circuitBreakerOpens: 0,
    };
  }

  protected updateLatencyMetrics(durationMs: number): void {
    const m = this._metrics;
    
    // 更新平均延迟
    m.latencyAvg = (m.latencyAvg * (m.requestsSuccess - 1) + durationMs) / m.requestsSuccess;
    
    // 更新最小/最大延迟
    m.latencyMin = Math.min(m.latencyMin, durationMs);
    m.latencyMax = Math.max(m.latencyMax, durationMs);

    // TODO: 实现 P95/P99 计算（需要维护延迟历史或使用近似算法）
  }

  protected createFetchResult(
    data: UnifiedMention[],
    meta?: Partial<FetchResult['meta']>
  ): FetchResult {
    return {
      data,
      meta: {
        hasMore: false,
        ...meta,
      },
    };
  }
}

/**
 * 默认重试配置
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  backoffStrategy: 'exponential',
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  retryableErrors: [
    ErrorCategory.NETWORK_ERROR,
    ErrorCategory.RATE_LIMITED,
    ErrorCategory.SERVER_ERROR,
    ErrorCategory.TIMEOUT_ERROR,
  ],
};

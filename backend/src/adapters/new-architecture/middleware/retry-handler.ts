/**
 * 重试处理器
 * 
 * 提供智能重试机制，支持多种退避策略
 */

import { Logger } from '@nestjs/common';
import { RetryConfig, ErrorCategory } from '../types';

/**
 * 重试上下文
 */
export interface RetryContext {
  attempt: number;
  lastError: Error;
  lastErrorCategory: ErrorCategory;
  startTime: number;
  totalDelay: number;
}

/**
 * 重试结果
 */
export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  totalDelay: number;
}

/**
 * 退避策略接口
 */
export interface IBackoffStrategy {
  /**
   * 计算下次重试延迟
   * @param attempt 当前尝试次数（从1开始）
   * @param config 重试配置
   */
  calculateDelay(attempt: number, config: RetryConfig): number;
}

/**
 * 重试处理器
 */
export class RetryHandler {
  private readonly logger: Logger;
  private readonly backoffStrategies: Map<string, IBackoffStrategy>;

  constructor(private namespace: string) {
    this.logger = new Logger(`RetryHandler:${namespace}`);
    this.backoffStrategies = new Map([
      ['fixed', new FixedBackoffStrategy()],
      ['linear', new LinearBackoffStrategy()],
      ['exponential', new ExponentialBackoffStrategy()],
      ['jitter', new JitterBackoffStrategy()],
    ]);
  }

  /**
   * 执行带重试的操作
   * @param operation 要执行的操作
   * @param config 重试配置
   * @param shouldRetry 自定义是否重试的判断函数
   */
  async execute<T>(
    operation: (context: RetryContext) => Promise<T>,
    config: RetryConfig,
    shouldRetry?: (error: Error, category: ErrorCategory, context: RetryContext) => boolean
  ): Promise<RetryResult<T>> {
    const startTime = Date.now();
    let totalDelay = 0;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        const context: RetryContext = {
          attempt,
          lastError: null as any,
          lastErrorCategory: ErrorCategory.UNKNOWN_ERROR,
          startTime,
          totalDelay,
        };

        const data = await operation(context);
        
        if (attempt > 1) {
          this.logger.log(`Operation succeeded after ${attempt} attempts`);
        }

        return {
          success: true,
          data,
          attempts: attempt,
          totalDelay,
        };
      } catch (error) {
        const errorCategory = this.categorizeError(error);
        const isLastAttempt = attempt === config.maxAttempts;

        this.logger.warn(
          `Attempt ${attempt}/${config.maxAttempts} failed: ${error.message} ` +
          `(category: ${errorCategory})`
        );

        if (isLastAttempt) {
          return {
            success: false,
            error,
            attempts: attempt,
            totalDelay,
          };
        }

        // 检查是否应该重试
        const context: RetryContext = {
          attempt,
          lastError: error as Error,
          lastErrorCategory: errorCategory,
          startTime,
          totalDelay,
        };

        const retryable = shouldRetry 
          ? shouldRetry(error as Error, errorCategory, context)
          : config.retryableErrors.includes(errorCategory);

        if (!retryable) {
          this.logger.warn(`Error not retryable, aborting: ${errorCategory}`);
          return {
            success: false,
            error,
            attempts: attempt,
            totalDelay,
          };
        }

        // 计算延迟
        const delay = this.calculateDelay(attempt, config);
        totalDelay += delay;

        this.logger.log(`Waiting ${delay}ms before retry...`);
        await this.sleep(delay);
      }
    }

    // 不应该到达这里
    return {
      success: false,
      attempts: config.maxAttempts,
      totalDelay,
    };
  }

  /**
   * 计算延迟时间
   */
  private calculateDelay(attempt: number, config: RetryConfig): number {
    const strategy = this.backoffStrategies.get(config.backoffStrategy);
    if (!strategy) {
      this.logger.warn(`Unknown backoff strategy: ${config.backoffStrategy}`);
      return config.initialDelayMs;
    }

    const delay = strategy.calculateDelay(attempt, config);
    return Math.min(delay, config.maxDelayMs);
  }

  /**
   * 错误分类
   */
  private categorizeError(error: any): ErrorCategory {
    const message = error?.message?.toLowerCase() || '';
    const code = error?.code || '';
    const statusCode = error?.response?.status || error?.status;

    // HTTP 状态码判断
    if (statusCode) {
      switch (statusCode) {
        case 401:
          return ErrorCategory.AUTHENTICATION_ERROR;
        case 403:
          return ErrorCategory.AUTHORIZATION_ERROR;
        case 404:
          return ErrorCategory.NOT_FOUND;
        case 408:
          return ErrorCategory.TIMEOUT_ERROR;
        case 409:
          return ErrorCategory.VALIDATION_ERROR;
        case 422:
          return ErrorCategory.VALIDATION_ERROR;
        case 429:
          return ErrorCategory.RATE_LIMITED;
        case 500:
        case 502:
        case 503:
        case 504:
          return ErrorCategory.SERVER_ERROR;
      }
    }

    // 错误码判断
    if (code) {
      if (code.includes('ECONNREFUSED') || code.includes('ENOTFOUND') || code.includes('EHOSTUNREACH')) {
        return ErrorCategory.NETWORK_ERROR;
      }
      if (code.includes('ETIMEDOUT') || code.includes('ECONNABORTED')) {
        return ErrorCategory.TIMEOUT_ERROR;
      }
      if (code.includes('RATE_LIMIT')) {
        return ErrorCategory.RATE_LIMITED;
      }
    }

    // 错误消息判断
    if (message.includes('rate limit') || message.includes('too many requests')) {
      return ErrorCategory.RATE_LIMITED;
    }
    if (message.includes('timeout') || message.includes('timed out')) {
      return ErrorCategory.TIMEOUT_ERROR;
    }
    if (message.includes('network') || message.includes('connection') || message.includes('econnrefused')) {
      return ErrorCategory.NETWORK_ERROR;
    }
    if (message.includes('unauthorized') || message.includes('authentication')) {
      return ErrorCategory.AUTHENTICATION_ERROR;
    }
    if (message.includes('forbidden') || message.includes('permission')) {
      return ErrorCategory.AUTHORIZATION_ERROR;
    }
    if (message.includes('not found')) {
      return ErrorCategory.NOT_FOUND;
    }
    if (message.includes('invalid') || message.includes('validation')) {
      return ErrorCategory.VALIDATION_ERROR;
    }
    if (message.includes('server error') || message.includes('internal error')) {
      return ErrorCategory.SERVER_ERROR;
    }
    if (message.includes('circuit breaker')) {
      return ErrorCategory.CIRCUIT_OPEN;
    }
    if (message.includes('parse') || message.includes('json')) {
      return ErrorCategory.PARSING_ERROR;
    }

    return ErrorCategory.UNKNOWN_ERROR;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// 退避策略实现
// ============================================================================

/**
 * 固定间隔退避
 */
class FixedBackoffStrategy implements IBackoffStrategy {
  calculateDelay(attempt: number, config: RetryConfig): number {
    return config.initialDelayMs;
  }
}

/**
 * 线性退避
 */
class LinearBackoffStrategy implements IBackoffStrategy {
  calculateDelay(attempt: number, config: RetryConfig): number {
    return config.initialDelayMs * attempt;
  }
}

/**
 * 指数退避
 */
class ExponentialBackoffStrategy implements IBackoffStrategy {
  calculateDelay(attempt: number, config: RetryConfig): number {
    return config.initialDelayMs * Math.pow(2, attempt - 1);
  }
}

/**
 * 抖动退避（指数退避 + 随机抖动）
 * 
 * 优点：避免多个客户端同时重试导致的"重试风暴"
 */
class JitterBackoffStrategy implements IBackoffStrategy {
  calculateDelay(attempt: number, config: RetryConfig): number {
    const baseDelay = config.initialDelayMs * Math.pow(2, attempt - 1);
    // 添加 0-50% 的随机抖动
    const jitter = baseDelay * 0.5 * Math.random();
    return Math.floor(baseDelay + jitter);
  }
}

// ============================================================================
// 装饰器模式实现
// ============================================================================

/**
 * 重试装饰器
 * 
 * 可以包装任意函数，添加重试能力
 */
export function withRetry<T extends (...args: any[]) => Promise<any>>(
  config: Partial<RetryConfig>,
  namespace: string = 'default'
): (target: T) => T {
  const handler = new RetryHandler(namespace);
  
  const fullConfig: RetryConfig = {
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
    ...config,
  };

  return (target: T): T => {
    return (async (...args: any[]) => {
      const result = await handler.execute(async () => {
        return target(...args);
      }, fullConfig);

      if (result.success) {
        return result.data;
      } else {
        throw result.error;
      }
    }) as T;
  };
}

/**
 * 方法装饰器版本（用于类方法）
 */
export function Retryable(config: Partial<RetryConfig> = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const handler = new RetryHandler(`${target.constructor.name}.${propertyKey}`);
    
    const fullConfig: RetryConfig = {
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
      ...config,
    };

    descriptor.value = async function (...args: any[]) {
      const result = await handler.execute(async () => {
        return originalMethod.apply(this, args);
      }, fullConfig);

      if (result.success) {
        return result.data;
      } else {
        throw result.error;
      }
    };

    return descriptor;
  };
}

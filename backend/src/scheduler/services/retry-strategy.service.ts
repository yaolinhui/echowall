import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RetryDecision, TaskError } from '../interfaces/task.interface';
import {
  ExponentialBackoffOptions,
  LinearBackoffOptions,
  CircuitBreakerOptions,
  CircuitBreakerState,
} from '../interfaces/retry.interface';
import { ErrorCategory } from '../enums/task-type.enum';
import { HTTP_RETRY_MAP, ERROR_PATTERNS } from '../constants/queue.constants';

/**
 * 智能重试策略服务
 * 
 * 提供多种重试策略：
 * - 指数退避
 * - 固定间隔
 * - 线性退避
 * - 根据 HTTP 状态码智能重试
 * - 熔断器模式
 */
@Injectable()
export class RetryStrategyService {
  private readonly logger = new Logger(RetryStrategyService.name);
  
  // 熔断器状态
  private circuitStates: Map<string, CircuitBreakerState> = new Map();
  private failureCounts: Map<string, number> = new Map();
  private successCounts: Map<string, number> = new Map();
  private lastFailureTime: Map<string, number> = new Map();

  // 默认配置
  private readonly defaultExponentialOptions: ExponentialBackoffOptions;
  private readonly defaultCircuitBreakerOptions: CircuitBreakerOptions;

  constructor(private configService: ConfigService) {
    this.defaultExponentialOptions = {
      baseDelay: this.configService.get('scheduler.retry.baseDelay', 1000),
      maxDelay: this.configService.get('scheduler.retry.maxDelay', 60000),
      factor: 2,
      jitter: true,
      jitterFactor: 0.2,
    };
    
    this.defaultCircuitBreakerOptions = {
      failureThreshold: 5,
      successThreshold: 3,
      timeout: 60000,
      halfOpenMaxCalls: 3,
    };
  }

  /**
   * 判断是否重试并计算延迟
   * 
   * @param error 错误对象
   * @param attempt 当前尝试次数
   * @param maxAttempts 最大尝试次数
   * @param taskType 任务类型
   */
  async shouldRetry(
    error: Error,
    attempt: number,
    maxAttempts: number,
    taskType?: string
  ): Promise<RetryDecision> {
    // 超过最大重试次数
    if (attempt >= maxAttempts) {
      return {
        shouldRetry: false,
        delay: 0,
        errorCategory: ErrorCategory.UNKNOWN_ERROR,
      };
    }

    // 检查熔断器
    const circuitKey = taskType || 'default';
    if (this.isCircuitOpen(circuitKey)) {
      this.logger.warn(`Circuit breaker is open for ${circuitKey}, rejecting retry`);
      return {
        shouldRetry: false,
        delay: 0,
        errorCategory: ErrorCategory.UNKNOWN_ERROR,
      };
    }

    // 分析错误类型
    const taskError = this.analyzeError(error);
    
    // 根据错误类型决定重试策略
    switch (taskError.category) {
      case ErrorCategory.CLIENT_ERROR:
      case ErrorCategory.BUSINESS_ERROR:
        // 客户端错误和业务错误不重试
        return {
          shouldRetry: false,
          delay: 0,
          errorCategory: taskError.category,
        };

      case ErrorCategory.RATE_LIMITED:
        // 限流错误，使用响应头中的 Retry-After 或默认延迟
        const rateLimitDelay = taskError.retryDelay || 60000;
        this.recordFailure(circuitKey);
        return {
          shouldRetry: true,
          delay: rateLimitDelay,
          priority: 1, // 降低优先级
          errorCategory: taskError.category,
        };

      case ErrorCategory.NETWORK_ERROR:
      case ErrorCategory.TIMEOUT_ERROR:
        // 网络和超时错误，使用指数退避
        this.recordFailure(circuitKey);
        return {
          shouldRetry: true,
          delay: this.calculateExponentialDelay(attempt),
          errorCategory: taskError.category,
        };

      case ErrorCategory.SERVER_ERROR:
        // 服务端错误，使用较短延迟
        this.recordFailure(circuitKey);
        return {
          shouldRetry: true,
          delay: Math.min(5000 * attempt, 30000),
          errorCategory: taskError.category,
        };

      default:
        // 默认使用指数退避
        this.recordFailure(circuitKey);
        return {
          shouldRetry: true,
          delay: this.calculateExponentialDelay(attempt),
          errorCategory: ErrorCategory.UNKNOWN_ERROR,
        };
    }
  }

  /**
   * 计算指数退避延迟
   * 
   * 公式: delay = baseDelay * (factor ^ attempt) + jitter
   * 
   * @param attempt 尝试次数
   * @param options 配置选项
   */
  calculateExponentialDelay(
    attempt: number,
    options?: Partial<ExponentialBackoffOptions>
  ): number {
    const opts = { ...this.defaultExponentialOptions, ...options };
    
    // 指数计算
    let delay = opts.baseDelay * Math.pow(opts.factor, attempt);
    
    // 上限控制
    delay = Math.min(delay, opts.maxDelay);
    
    // 添加抖动
    if (opts.jitter) {
      const jitterFactor = 1 - (opts.jitterFactor || 0.2) + Math.random() * (opts.jitterFactor || 0.2) * 2;
      delay = Math.floor(delay * jitterFactor);
    }
    
    return delay;
  }

  /**
   * 计算线性退避延迟
   */
  calculateLinearDelay(
    attempt: number,
    options: LinearBackoffOptions
  ): number {
    const delay = options.initialDelay + (options.increment * attempt);
    return Math.min(delay, options.maxDelay);
  }

  /**
   * 计算固定延迟
   */
  calculateFixedDelay(fixedDelay: number): number {
    return fixedDelay;
  }

  /**
   * 解析 HTTP 错误并获取重试策略
   * 
   * @param error 错误对象
   */
  parseHttpError(error: Error): { statusCode: number; retryAfter?: number } {
    const statusCode = this.extractStatusCode(error) ?? 0;
    const retryAfter = this.extractRetryAfter(error);
    
    return { statusCode, retryAfter };
  }

  /**
   * 分析错误类型
   */
  private analyzeError(error: Error): TaskError {
    const message = error.message || '';
    const stack = error.stack || '';
    
    // 提取 HTTP 状态码
    const statusCode = this.extractStatusCode(error);
    
    if (statusCode) {
      // 根据 HTTP 状态码分类
      if (statusCode === 429) {
        return {
          type: 'RateLimitError',
          message: error.message,
          statusCode,
          category: ErrorCategory.RATE_LIMITED,
          retryable: true,
          retryDelay: this.extractRetryAfter(error),
        };
      }
      
      if (statusCode >= 500) {
        return {
          type: 'ServerError',
          message: error.message,
          statusCode,
          category: ErrorCategory.SERVER_ERROR,
          retryable: true,
        };
      }
      
      if (statusCode >= 400 && statusCode < 500) {
        return {
          type: 'ClientError',
          message: error.message,
          statusCode,
          category: ErrorCategory.CLIENT_ERROR,
          retryable: false,
        };
      }
    }
    
    // 检查网络错误模式
    for (const pattern of ERROR_PATTERNS.NETWORK_ERRORS) {
      if (message.includes(pattern) || stack.includes(pattern)) {
        return {
          type: 'NetworkError',
          message: error.message,
          category: ErrorCategory.NETWORK_ERROR,
          retryable: true,
        };
      }
    }
    
    // 检查超时错误模式
    for (const pattern of ERROR_PATTERNS.TIMEOUT_ERRORS) {
      if (message.includes(pattern) || stack.includes(pattern)) {
        return {
          type: 'TimeoutError',
          message: error.message,
          category: ErrorCategory.TIMEOUT_ERROR,
          retryable: true,
        };
      }
    }
    
    // 检查限流错误模式
    for (const pattern of ERROR_PATTERNS.RATE_LIMIT_ERRORS) {
      if (message.toLowerCase().includes(pattern.toLowerCase())) {
        return {
          type: 'RateLimitError',
          message: error.message,
          category: ErrorCategory.RATE_LIMITED,
          retryable: true,
          retryDelay: 60000,
        };
      }
    }
    
    // 默认未知错误
    return {
      type: error.constructor.name,
      message: error.message,
      category: ErrorCategory.UNKNOWN_ERROR,
      retryable: true,
    };
  }

  /**
   * 从错误中提取 HTTP 状态码
   */
  private extractStatusCode(error: Error): number | undefined {
    // 检查常见的 HTTP 错误结构
    const errorObj = error as any;
    
    if (errorObj.statusCode) {
      return errorObj.statusCode;
    }
    
    if (errorObj.response?.status) {
      return errorObj.response.status;
    }
    
    if (errorObj.status) {
      return errorObj.status;
    }
    
    // 从消息中解析
    const match = error.message.match(/\b(\d{3})\b/);
    if (match) {
      const code = parseInt(match[1], 10);
      if (code >= 100 && code < 600) {
        return code;
      }
    }
    
    return undefined;
  }

  /**
   * 从错误/响应中提取 Retry-After
   */
  private extractRetryAfter(error: Error): number | undefined {
    const errorObj = error as any;
    
    // 检查响应头
    if (errorObj.response?.headers?.['retry-after']) {
      const value = errorObj.response.headers['retry-after'];
      // 可能是秒数或 HTTP 日期
      const seconds = parseInt(value, 10);
      if (!isNaN(seconds)) {
        return seconds * 1000; // 转换为毫秒
      }
    }
    
    if (errorObj.retryAfter) {
      return errorObj.retryAfter * 1000;
    }
    
    return undefined;
  }

  // ==================== 熔断器实现 ====================

  /**
   * 检查熔断器是否打开
   */
  private isCircuitOpen(key: string): boolean {
    const state = this.circuitStates.get(key) || CircuitBreakerState.CLOSED;
    
    if (state === CircuitBreakerState.OPEN) {
      // 检查是否已经超过超时时间，可以进入半开状态
      const lastFailure = this.lastFailureTime.get(key) || 0;
      const timeout = this.defaultCircuitBreakerOptions.timeout;
      
      if (Date.now() - lastFailure > timeout) {
        this.circuitStates.set(key, CircuitBreakerState.HALF_OPEN);
        this.logger.log(`Circuit breaker moved to HALF_OPEN for ${key}`);
        return false;
      }
      
      return true;
    }
    
    return false;
  }

  /**
   * 记录失败
   */
  private recordFailure(key: string): void {
    const currentCount = (this.failureCounts.get(key) || 0) + 1;
    this.failureCounts.set(key, currentCount);
    this.lastFailureTime.set(key, Date.now());
    
    // 检查是否达到熔断阈值
    if (currentCount >= this.defaultCircuitBreakerOptions.failureThreshold) {
      this.circuitStates.set(key, CircuitBreakerState.OPEN);
      this.logger.warn(`Circuit breaker OPENED for ${key} after ${currentCount} failures`);
    }
  }

  /**
   * 记录成功
   */
  recordSuccess(key: string): void {
    const state = this.circuitStates.get(key);
    
    if (state === CircuitBreakerState.HALF_OPEN) {
      const currentCount = (this.successCounts.get(key) || 0) + 1;
      this.successCounts.set(key, currentCount);
      
      // 检查是否达到恢复阈值
      if (currentCount >= this.defaultCircuitBreakerOptions.successThreshold) {
        this.resetCircuit(key);
        this.logger.log(`Circuit breaker CLOSED for ${key} after ${currentCount} successes`);
      }
    } else {
      // 正常状态下，清除失败计数
      this.failureCounts.delete(key);
    }
  }

  /**
   * 重置熔断器
   */
  resetCircuit(key: string): void {
    this.circuitStates.set(key, CircuitBreakerState.CLOSED);
    this.failureCounts.delete(key);
    this.successCounts.delete(key);
  }

  /**
   * 获取熔断器状态
   */
  getCircuitState(key: string): CircuitBreakerState {
    return this.circuitStates.get(key) || CircuitBreakerState.CLOSED;
  }

  /**
   * 手动设置熔断器状态
   */
  setCircuitState(key: string, state: CircuitBreakerState): void {
    this.circuitStates.set(key, state);
    this.logger.log(`Circuit breaker manually set to ${state} for ${key}`);
  }
}

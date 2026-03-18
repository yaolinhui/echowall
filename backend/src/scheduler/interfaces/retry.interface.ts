import { RetryDecision } from './task.interface';

/**
 * 重试策略接口
 */
export interface RetryStrategy {
  /**
   * 判断是否重试
   * @param error 错误对象
   * @param attempt 当前尝试次数
   * @param maxAttempts 最大尝试次数
   */
  shouldRetry(error: Error, attempt: number, maxAttempts: number): RetryDecision;
  
  /**
   * 计算重试延迟
   * @param attempt 当前尝试次数
   */
  calculateDelay(attempt: number): number;
}

/**
 * 指数退避配置
 */
export interface ExponentialBackoffOptions {
  /** 基础延迟 (ms) */
  baseDelay: number;
  
  /** 最大延迟 (ms) */
  maxDelay: number;
  
  /** 退避因子 */
  factor: number;
  
  /** 是否启用抖动 */
  jitter: boolean;
  
  /** 抖动范围 (0-1) */
  jitterFactor?: number;
}

/**
 * 固定延迟配置
 */
export interface FixedDelayOptions {
  /** 固定延迟 (ms) */
  delay: number;
}

/**
 * 线性退避配置
 */
export interface LinearBackoffOptions {
  /** 初始延迟 (ms) */
  initialDelay: number;
  
  /** 增量 (ms) */
  increment: number;
  
  /** 最大延迟 (ms) */
  maxDelay: number;
}

/**
 * 自定义重试策略配置
 */
export interface CustomRetryOptions {
  /** 重试条件 */
  retryIf: (error: Error, attempt: number) => boolean;
  
  /** 延迟计算函数 */
  delayCalculator: (attempt: number) => number;
  
  /** 最大重试次数 */
  maxRetries: number;
}

/**
 * HTTP 状态码映射配置
 */
export interface HttpStatusCodeMapping {
  /** 状态码 */
  statusCode: number;
  
  /** 是否可重试 */
  retryable: boolean;
  
  /** 固定延迟 (ms)，可选 */
  fixedDelay?: number;
  
  /** 是否使用响应头中的 Retry-After */
  useRetryAfter?: boolean;
  
  /** 优先级调整 */
  priorityAdjustment?: number;
}

/**
 * 限流策略配置
 */
export interface RateLimitStrategy {
  /** 每秒最大请求数 */
  requestsPerSecond: number;
  
  /** 突发容量 */
  burstCapacity?: number;
  
  /** 限流时的等待策略 */
  waitStrategy: 'block' | 'drop' | 'backpressure';
}

/**
 * 熔断器配置
 */
export interface CircuitBreakerOptions {
  /** 失败阈值 */
  failureThreshold: number;
  
  /** 成功阈值 */
  successThreshold: number;
  
  /** 超时时间 (ms) */
  timeout: number;
  
  /** 半开状态测试请求数 */
  halfOpenMaxCalls?: number;
}

/**
 * 熔断器状态
 */
export enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open',
}

/**
 * 错误分类配置
 */
export interface ErrorClassificationConfig {
  /** 网络错误模式 */
  networkErrors: string[];
  
  /** 超时错误模式 */
  timeoutErrors: string[];
  
  /** 限流错误模式 */
  rateLimitErrors: string[];
  
  /** 服务端错误模式 */
  serverErrors: string[];
  
  /** 客户端错误模式 */
  clientErrors: string[];
}

/**
 * 熔断器实现
 * 
 * 防止级联故障，当错误率超过阈值时自动熔断
 * 
 * 状态转换：
 * CLOSED -> OPEN: 错误率达到阈值
 * OPEN -> HALF_OPEN: 超时时间过后
 * HALF_OPEN -> CLOSED: 成功次数达到阈值
 * HALF_OPEN -> OPEN: 出现任何错误
 */

import { Logger } from '@nestjs/common';
import { CircuitBreakerConfig } from '../types';

export enum CircuitState {
  CLOSED = 'closed',       // 正常状态，允许请求通过
  OPEN = 'open',           // 熔断状态，拒绝请求
  HALF_OPEN = 'half_open', // 半开状态，测试恢复
}

export interface CircuitBreakerMetrics {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  consecutiveSuccesses: number;
  consecutiveFailures: number;
  totalRequests: number;
  rejectedRequests: number;
}

export class CircuitBreakerError extends Error {
  constructor(message: string = 'Circuit breaker is open') {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

export class CircuitBreaker {
  private readonly logger: Logger;
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private consecutiveSuccesses = 0;
  private consecutiveFailures = 0;
  private lastFailureTime?: Date;
  private lastSuccessTime?: Date;
  private totalRequests = 0;
  private rejectedRequests = 0;
  private halfOpenCalls = 0;
  private nextAttemptTime?: Date;

  constructor(
    private name: string,
    private config: CircuitBreakerConfig
  ) {
    this.logger = new Logger(`CircuitBreaker:${name}`);
    
    if (!config.enabled) {
      this.logger.log('Circuit breaker is disabled');
    }
  }

  /**
   * 执行操作，自动处理熔断逻辑
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.config.enabled) {
      return operation();
    }

    // 检查是否可以执行
    if (!this.canExecute()) {
      this.rejectedRequests++;
      throw new CircuitBreakerError(
        `Circuit breaker is ${this.state}. Try again after ${this.nextAttemptTime?.toISOString()}`
      );
    }

    this.totalRequests++;

    try {
      const result = await operation();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * 检查是否可以执行操作
   */
  private canExecute(): boolean {
    switch (this.state) {
      case CircuitState.CLOSED:
        return true;

      case CircuitState.OPEN:
        // 检查超时时间是否已过
        if (this.nextAttemptTime && new Date() >= this.nextAttemptTime) {
          this.logger.log('Timeout elapsed, transitioning to HALF_OPEN');
          this.transitionToHalfOpen();
          return true;
        }
        return false;

      case CircuitState.HALF_OPEN:
        // 限制半开状态下的并发请求数
        if (this.halfOpenCalls < this.config.halfOpenMaxCalls) {
          this.halfOpenCalls++;
          return true;
        }
        return false;

      default:
        return false;
    }
  }

  /**
   * 记录成功
   */
  private recordSuccess(): void {
    this.successes++;
    this.consecutiveSuccesses++;
    this.consecutiveFailures = 0;
    this.lastSuccessTime = new Date();

    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenCalls--;
      
      if (this.consecutiveSuccesses >= this.config.successThreshold) {
        this.logger.log(`Success threshold reached (${this.config.successThreshold}), closing circuit`);
        this.transitionToClosed();
      }
    }
  }

  /**
   * 记录失败
   */
  private recordFailure(): void {
    this.failures++;
    this.consecutiveFailures++;
    this.consecutiveSuccesses = 0;
    this.lastFailureTime = new Date();

    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenCalls--;
      this.logger.log('Failure in HALF_OPEN state, opening circuit');
      this.transitionToOpen();
      return;
    }

    if (this.state === CircuitState.CLOSED) {
      if (this.consecutiveFailures >= this.config.failureThreshold) {
        this.logger.log(`Failure threshold reached (${this.config.failureThreshold}), opening circuit`);
        this.transitionToOpen();
      }
    }
  }

  /**
   * 转换为关闭状态
   */
  private transitionToClosed(): void {
    this.state = CircuitState.CLOSED;
    this.reset();
    this.logger.log('Circuit closed');
  }

  /**
   * 转换为打开状态
   */
  private transitionToOpen(): void {
    this.state = CircuitState.OPEN;
    this.nextAttemptTime = new Date(Date.now() + this.config.timeoutMs);
    this.halfOpenCalls = 0;
    this.logger.log(`Circuit opened, will retry after ${this.nextAttemptTime.toISOString()}`);
  }

  /**
   * 转换为半开状态
   */
  private transitionToHalfOpen(): void {
    this.state = CircuitState.HALF_OPEN;
    this.consecutiveSuccesses = 0;
    this.halfOpenCalls = 0;
    this.logger.log('Circuit half-opened, testing recovery');
  }

  /**
   * 重置计数器
   */
  private reset(): void {
    this.failures = 0;
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.halfOpenCalls = 0;
    this.nextAttemptTime = undefined;
  }

  /**
   * 获取当前指标
   */
  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      consecutiveSuccesses: this.consecutiveSuccesses,
      consecutiveFailures: this.consecutiveFailures,
      totalRequests: this.totalRequests,
      rejectedRequests: this.rejectedRequests,
    };
  }

  /**
   * 获取当前状态
   */
  getState(): CircuitState {
    // 检查是否需要从 OPEN 转换到 HALF_OPEN
    if (this.state === CircuitState.OPEN && this.nextAttemptTime) {
      if (new Date() >= this.nextAttemptTime) {
        this.transitionToHalfOpen();
      }
    }
    return this.state;
  }

  /**
   * 强制关闭熔断器
   */
  forceClose(): void {
    this.logger.log('Circuit forcibly closed');
    this.transitionToClosed();
  }

  /**
   * 强制打开熔断器
   */
  forceOpen(): void {
    this.logger.log('Circuit forcibly opened');
    this.transitionToOpen();
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<CircuitBreakerConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.log('Circuit breaker config updated');
  }
}

/**
 * 熔断器管理器
 * 
 * 管理多个熔断器实例
 */
export class CircuitBreakerManager {
  private breakers = new Map<string, CircuitBreaker>();
  private readonly logger = new Logger(CircuitBreakerManager.name);

  /**
   * 获取或创建熔断器
   */
  getOrCreate(name: string, config: CircuitBreakerConfig): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.logger.log(`Creating circuit breaker for ${name}`);
      this.breakers.set(name, new CircuitBreaker(name, config));
    }
    return this.breakers.get(name)!;
  }

  /**
   * 获取熔断器
   */
  get(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }

  /**
   * 移除熔断器
   */
  remove(name: string): boolean {
    const breaker = this.breakers.get(name);
    if (breaker) {
      this.logger.log(`Removing circuit breaker for ${name}`);
      return this.breakers.delete(name);
    }
    return false;
  }

  /**
   * 获取所有熔断器指标
   */
  getAllMetrics(): Record<string, CircuitBreakerMetrics> {
    const metrics: Record<string, CircuitBreakerMetrics> = {};
    for (const [name, breaker] of this.breakers) {
      metrics[name] = breaker.getMetrics();
    }
    return metrics;
  }

  /**
   * 强制关闭所有熔断器
   */
  forceCloseAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.forceClose();
    }
  }

  /**
   * 强制打开所有熔断器
   */
  forceOpenAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.forceOpen();
    }
  }
}

// ============================================================================
// 装饰器
// ============================================================================

/**
 * 熔断器装饰器
 * 
 * 为方法添加熔断保护
 */
export function CircuitBreakerProtected(
  breakerName: string,
  config: CircuitBreakerConfig
) {
  const manager = new CircuitBreakerManager();

  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const breaker = manager.getOrCreate(breakerName, config);
      return breaker.execute(() => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}

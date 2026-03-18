import { Logger } from '@nestjs/common';

/**
 * 任务追踪装饰器
 * 
 * 自动追踪任务执行：
 * - 记录开始/结束时间
 * - 捕获异常
 * - 记录执行时长
 * - 自动重试
 */
export function TaskTracker(options: {
  taskType: string;
  logStart?: boolean;
  logComplete?: boolean;
  measureTime?: boolean;
}): MethodDecorator {
  const { taskType, logStart = true, logComplete = true, measureTime = true } = options;
  const logger = new Logger(`TaskTracker:${taskType}`);

  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      
      if (logStart) {
        logger.log(`Starting task: ${String(propertyKey)}`);
      }

      try {
        const result = await originalMethod.apply(this, args);
        
        if (logComplete) {
          const duration = measureTime ? ` (${Date.now() - startTime}ms)` : '';
          logger.log(`Task completed: ${String(propertyKey)}${duration}`);
        }

        return result;
      } catch (error) {
        const duration = measureTime ? ` (${Date.now() - startTime}ms)` : '';
        logger.error(`Task failed: ${String(propertyKey)}${duration}`, error.message);
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * 幂等性装饰器
 * 
 * 确保方法在同一参数下只执行一次
 */
export function Idempotent(ttl: number = 60000): MethodDecorator {
  const executionMap = new Map<string, { promise: Promise<any>; timestamp: number }>();

  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // 生成唯一键
      const key = `${target.constructor.name}:${String(propertyKey)}:${JSON.stringify(args)}`;
      const now = Date.now();

      // 清理过期条目
      for (const [k, v] of executionMap.entries()) {
        if (now - v.timestamp > ttl) {
          executionMap.delete(k);
        }
      }

      // 检查是否有正在进行的执行
      const existing = executionMap.get(key);
      if (existing && now - existing.timestamp < ttl) {
        return existing.promise;
      }

      // 执行方法
      const promise = originalMethod.apply(this, args).finally(() => {
        // 执行完成后延迟删除
        setTimeout(() => executionMap.delete(key), ttl);
      });

      executionMap.set(key, { promise, timestamp: now });
      return promise;
    };

    return descriptor;
  };
}

/**
 * 断路器装饰器
 * 
 * 实现熔断器模式
 */
export function CircuitBreaker(options: {
  failureThreshold: number;
  resetTimeout: number;
}): MethodDecorator {
  const { failureThreshold, resetTimeout } = options;

  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    const state = {
      failures: 0,
      lastFailureTime: 0,
      isOpen: false,
    };

    descriptor.value = async function (...args: any[]) {
      // 检查熔断器状态
      if (state.isOpen) {
        if (Date.now() - state.lastFailureTime > resetTimeout) {
          // 进入半开状态
          state.isOpen = false;
          state.failures = 0;
        } else {
          throw new Error('Circuit breaker is OPEN');
        }
      }

      try {
        const result = await originalMethod.apply(this, args);
        
        // 成功，重置失败计数
        state.failures = 0;
        
        return result;
      } catch (error) {
        // 失败，增加计数
        state.failures++;
        state.lastFailureTime = Date.now();
        
        if (state.failures >= failureThreshold) {
          state.isOpen = true;
        }
        
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * 限速装饰器
 * 
 * 限制方法调用频率
 */
export function RateLimit(options: {
  maxCalls: number;
  windowMs: number;
}): MethodDecorator {
  const { maxCalls, windowMs } = options;

  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const callTimes: number[] = [];

    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const now = Date.now();
      
      // 清理过期记录
      while (callTimes.length > 0 && callTimes[0] < now - windowMs) {
        callTimes.shift();
      }
      
      // 检查是否超过限制
      if (callTimes.length >= maxCalls) {
        const waitTime = callTimes[0] + windowMs - now;
        throw new Error(`Rate limit exceeded. Try again in ${waitTime}ms`);
      }
      
      // 记录调用
      callTimes.push(now);
      
      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

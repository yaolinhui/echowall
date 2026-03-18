/**
 * 多平台 API 适配器架构 - 统一导出
 * 
 * 使用示例：
 * 
 * ```typescript
 * // 1. 基础使用
 * const adapter = new GitHubAdapter();
 * await adapter.initialize({
 *   platform: 'github',
 *   enabled: true,
 *   auth: { type: 'bearer', accessToken: 'xxx' },
 *   options: { owner: 'facebook', repo: 'react' }
 * });
 * 
 * const result = await adapter.fetch({ limit: 100 });
 * ```
 * 
 * ```typescript
 * // 2. 使用增强装饰器
 * const enhanced = withEnhancements(adapter, {
 *   rateLimit: {
 *     strategy: RateLimitStrategy.TOKEN_BUCKET,
 *     requestsPerWindow: 60,
 *     windowSizeMs: 60000
 *   },
 *   retry: {
 *     maxAttempts: 3,
 *     backoffStrategy: 'exponential',
 *     initialDelayMs: 1000
 *   },
 *   circuitBreaker: {
 *     enabled: true,
 *     failureThreshold: 5,
 *     timeoutMs: 60000
 *   }
 * });
 * ```
 * 
 * ```typescript
 * // 3. 使用注册表管理多个适配器
 * const registry = new AdapterRegistry(eventEmitter);
 * 
 * // 注册适配器类型
 * registry.registerType('github', GitHubAdapter);
 * registry.registerType('twitter', TwitterAdapter);
 * 
 * // 创建适配器实例
 * await registry.createAdapter({
 *   platform: 'github',
 *   enabled: true,
 *   // ...
 * });
 * 
 * // 获取适配器
 * const githubAdapter = registry.getAdapter('github');
 * ```
 */

// ============================================================================
// 类型定义
// ============================================================================

export * from './types';

// ============================================================================
// 核心接口和基类
// ============================================================================

export {
  IAdapter,
  IRefreshableAdapter,
  IStreamingAdapter,
  IWebhookAdapter,
  IAdapterFactory,
  IAdapterDecorator,
  IAdapterLifecycleHooks,
  IAdapterCapabilities,
  AdapterConstructor,
} from './core/adapter.interface';

export { AbstractAdapter } from './core/abstract-adapter';

// ============================================================================
// 中间件
// ============================================================================

export {
  IRateLimiter,
  RateLimiterFactory,
} from './middleware/rate-limiter';

export {
  RetryHandler,
  RetryContext,
  RetryResult,
  IBackoffStrategy,
  withRetry,
  Retryable,
} from './middleware/retry-handler';

export {
  CircuitBreaker,
  CircuitBreakerError,
  CircuitBreakerManager,
  CircuitState,
  CircuitBreakerMetrics,
  CircuitBreakerProtected,
} from './middleware/circuit-breaker';

export {
  DecoratedAdapter,
  DecoratedAdapterBuilder,
  DecoratorConfig,
  withEnhancements,
} from './middleware/decorated-adapter';

// ============================================================================
// 管理器
// ============================================================================

export {
  AdapterRegistry,
  RegistryConfig,
} from './manager/adapter-registry';

export {
  HotReloadManager,
  HotReloadConfig,
  HotReloadEvent,
} from './manager/hot-reload-manager';

// ============================================================================
// 平台适配器
// ============================================================================

export { GitHubAdapter, GitHubConfig } from './platforms/github.adapter';
export { TwitterAdapter, TwitterConfig } from './platforms/twitter.adapter';
export { ZhihuAdapter, ZhihuConfig } from './platforms/zhihu.adapter';

// ============================================================================
// 便捷函数
// ============================================================================

import { AdapterRegistry } from './manager/adapter-registry';
import { GitHubAdapter } from './platforms/github.adapter';
import { TwitterAdapter } from './platforms/twitter.adapter';
import { ZhihuAdapter } from './platforms/zhihu.adapter';

/**
 * 快速注册所有内置适配器
 */
export function registerBuiltInAdapters(registry: AdapterRegistry): void {
  registry.registerTypes({
    github: GitHubAdapter,
    twitter: TwitterAdapter,
    zhihu: ZhihuAdapter,
    // 更多适配器...
  });
}

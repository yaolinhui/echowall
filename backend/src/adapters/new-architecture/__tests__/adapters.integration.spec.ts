/**
 * 适配器集成测试
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AdaptersModule, AdaptersService } from '../adapters.module';
import { AdapterRegistry } from '../manager/adapter-registry';
import { GitHubAdapter } from '../platforms/github.adapter';
import { TwitterAdapter } from '../platforms/twitter.adapter';
import { RateLimitStrategy, ErrorCategory } from '../types';
import { withEnhancements } from '../middleware/decorated-adapter';

describe('Adapters Integration', () => {
  let module: TestingModule;
  let registry: AdapterRegistry;
  let service: AdaptersService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        AdaptersModule.forRoot({
          useBuiltInAdapters: true,
          hotReload: { enabled: false },
        }),
      ],
    }).compile();

    registry = module.get<AdapterRegistry>(AdapterRegistry);
    service = module.get<AdaptersService>(AdaptersService);
  });

  afterAll(async () => {
    await module.close();
  });

  describe('Adapter Registry', () => {
    it('should register adapter types', () => {
      registry.registerTypes({
        github: GitHubAdapter,
        twitter: TwitterAdapter,
      });

      expect(registry.hasType('github')).toBe(true);
      expect(registry.hasType('twitter')).toBe(true);
    });

    it('should create adapter instances', async () => {
      const adapter = await registry.createAdapter({
        platform: 'github',
        enabled: true,
        options: {
          owner: 'facebook',
          repo: 'react',
        },
      });

      expect(adapter).toBeDefined();
      expect(adapter.platform).toBe('github');
      expect(registry.hasAdapter('github')).toBe(true);
    });

    it('should get adapter by platform', () => {
      const adapter = registry.getAdapter('github');
      expect(adapter).toBeDefined();
      expect(adapter?.platform).toBe('github');
    });

    it('should return health status', () => {
      const health = registry.getHealth();
      expect(health.healthy).toBeDefined();
      expect(health.adapters).toBeDefined();
    });

    it('should return stats', () => {
      const stats = registry.getStats();
      expect(stats.total).toBeGreaterThanOrEqual(0);
      expect(stats.registeredTypes).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Enhanced Adapter', () => {
    it('should wrap adapter with enhancements', async () => {
      const baseAdapter = new GitHubAdapter();
      await baseAdapter.initialize({
        platform: 'github',
        enabled: true,
        options: {
          owner: 'test',
          repo: 'test',
        },
      });

      const enhanced = withEnhancements(baseAdapter, {
        rateLimit: {
          strategy: RateLimitStrategy.TOKEN_BUCKET,
          requestsPerWindow: 10,
          windowSizeMs: 60000,
        },
        retry: {
          maxAttempts: 3,
          backoffStrategy: 'exponential',
          initialDelayMs: 100,
          maxDelayMs: 1000,
          retryableErrors: [ErrorCategory.NETWORK_ERROR],
        },
        circuitBreaker: {
          enabled: true,
          failureThreshold: 3,
          successThreshold: 2,
          timeoutMs: 5000,
          halfOpenMaxCalls: 1,
        },
      });

      expect(enhanced).toBeDefined();
      expect(enhanced.platform).toBe('github');
      
      // 检查增强功能
      expect(enhanced.getRateLimitStatus()).toBeDefined();
      expect(enhanced.getCircuitBreakerState()).toBeDefined();
    });
  });

  describe('AdaptersService', () => {
    it('should get all adapters', () => {
      const adapters = service.getAllAdapters();
      expect(Array.isArray(adapters)).toBe(true);
    });

    it('should get supported platforms', () => {
      const platforms = service.getSupportedPlatforms();
      expect(Array.isArray(platforms)).toBe(true);
    });

    it('should get active adapters', () => {
      const adapters = service.getActiveAdapters();
      expect(Array.isArray(adapters)).toBe(true);
    });

    it('should get health status', () => {
      const health = service.getHealth();
      expect(health).toHaveProperty('healthy');
      expect(health).toHaveProperty('adapters');
    });

    it('should get stats', () => {
      const stats = service.getStats();
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('byStatus');
    });
  });
});

describe('Error Handling', () => {
  it('should categorize errors correctly', () => {
    const adapter = new GitHubAdapter();
    
    // 模拟不同类型的错误
    const networkError = new Error('Network request failed');
    const rateLimitError = new Error('API rate limit exceeded');
    const authError = new Error('Unauthorized');

    // 错误分类测试
    expect(adapter.handleError(networkError).retryable).toBe(true);
    expect(adapter.handleError(rateLimitError).retryable).toBe(true);
    expect(adapter.handleError(authError).retryable).toBe(false);
  });
});

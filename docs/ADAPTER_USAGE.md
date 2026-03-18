# 多平台 API 适配器使用指南

## 快速开始

### 1. 安装模块

```typescript
import { AdaptersModule } from './adapters/new-architecture/adapters.module';

@Module({
  imports: [
    AdaptersModule.forRoot({
      isGlobal: true,
      useBuiltInAdapters: true,
      hotReload: {
        enabled: true,
        mode: 'manual', // 'filesystem' | 'database' | 'webhook' | 'manual'
      },
    }),
  ],
})
export class AppModule {}
```

### 2. 配置适配器

```typescript
// config/adapters.config.ts
export const adapterConfigs = {
  github: {
    platform: 'github',
    enabled: true,
    auth: {
      type: 'bearer' as const,
      accessToken: process.env.GITHUB_TOKEN,
    },
    rateLimit: {
      strategy: 'token_bucket' as const,
      requestsPerWindow: 60,
      windowSizeMs: 60000,
      burstSize: 10,
    },
    retry: {
      maxAttempts: 3,
      backoffStrategy: 'exponential' as const,
      initialDelayMs: 1000,
      maxDelayMs: 30000,
    },
    circuitBreaker: {
      enabled: true,
      failureThreshold: 5,
      successThreshold: 2,
      timeoutMs: 60000,
      halfOpenMaxCalls: 3,
    },
    options: {
      owner: 'facebook',
      repo: 'react',
      includeIssues: true,
      includeComments: true,
      issueState: 'all',
    },
  },

  twitter: {
    platform: 'twitter',
    enabled: true,
    auth: {
      type: 'oauth2' as const,
      accessToken: process.env.TWITTER_ACCESS_TOKEN,
      refreshToken: process.env.TWITTER_REFRESH_TOKEN,
      clientId: process.env.TWITTER_CLIENT_ID,
      clientSecret: process.env.TWITTER_CLIENT_SECRET,
      autoRefresh: true,
    },
    rateLimit: {
      strategy: 'sliding_window' as const,
      requestsPerWindow: 300,
      windowSizeMs: 900000, // 15 minutes
    },
    options: {
      searchQuery: '#reactjs OR @reactjs',
      includeReplies: false,
      includeRetweets: false,
      maxResults: 100,
    },
  },

  zhihu: {
    platform: 'zhihu',
    enabled: true,
    auth: {
      type: 'none' as const,
      // 知乎可以不认证，但有限流
    },
    rateLimit: {
      strategy: 'fixed_window' as const,
      requestsPerWindow: 10,
      windowSizeMs: 60000,
    },
    options: {
      contentTypes: ['answer', 'article'] as const,
      keywords: ['React', '前端开发'],
      minVoteups: 10,
      includeAnonymous: false,
    },
  },
};
```

### 3. 初始化适配器

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { AdapterRegistry } from './adapters/new-architecture';
import { adapterConfigs } from './config/adapters.config';

@Injectable()
export class AdapterInitializer implements OnModuleInit {
  constructor(private registry: AdapterRegistry) {}

  async onModuleInit() {
    // 注册适配器类型
    this.registry.registerTypes({
      github: GitHubAdapter,
      twitter: TwitterAdapter,
      zhihu: ZhihuAdapter,
    });

    // 创建适配器实例
    for (const config of Object.values(adapterConfigs)) {
      if (config.enabled) {
        await this.registry.createAdapter(config);
      }
    }
  }
}
```

### 4. 使用适配器

```typescript
import { Injectable } from '@nestjs/common';
import { AdaptersService } from './adapters/new-architecture';

@Injectable()
export class MentionService {
  constructor(private adaptersService: AdaptersService) {}

  async getAllMentions() {
    // 从所有适配器获取数据
    const mentions = await this.adaptersService.fetchAndMerge({
      limit: 100,
      since: new Date(Date.now() - 24 * 60 * 60 * 1000), // 最近24小时
    });

    return mentions;
  }

  async getMentionsByPlatform(platform: string) {
    const adapter = this.adaptersService.getAdapter(platform);
    if (!adapter) {
      throw new Error(`Adapter not found: ${platform}`);
    }

    const result = await adapter.fetch({ limit: 50 });
    return result.data;
  }

  async getHealthStatus() {
    return this.adaptersService.getHealth();
  }
}
```

## 高级用法

### 使用装饰器增强适配器

```typescript
import { withEnhancements, RateLimitStrategy } from './adapters/new-architecture';

const enhancedAdapter = withEnhancements(githubAdapter, {
  rateLimit: {
    strategy: RateLimitStrategy.TOKEN_BUCKET,
    requestsPerWindow: 60,
    windowSizeMs: 60000,
  },
  retry: {
    maxAttempts: 5,
    backoffStrategy: 'jitter', // 使用抖动避免重试风暴
    initialDelayMs: 1000,
    maxDelayMs: 60000,
  },
  circuitBreaker: {
    enabled: true,
    failureThreshold: 5,
    timeoutMs: 60000,
  },
});
```

### 自定义适配器

```typescript
import { AbstractAdapter } from './adapters/new-architecture';
import { AdapterConfig, FetchResult, UnifiedMention, ErrorCategory } from './adapters/new-architecture/types';

class CustomAdapter extends AbstractAdapter {
  constructor() {
    super('custom_platform');
  }

  protected async doFetch(options?: FetchOptions): Promise<FetchResult> {
    // 实现获取逻辑
    const rawData = await this.fetchFromApi(options);
    
    // 转换为统一格式
    const mentions = this.transformBatch(rawData);

    return this.createFetchResult(mentions, {
      hasMore: rawData.hasMore,
      nextCursor: rawData.nextCursor,
    });
  }

  transform(raw: any): UnifiedMention | null {
    // 实现数据转换
    return {
      id: `custom:${raw.id}`,
      platform: this.platform,
      externalId: raw.id,
      content: raw.text,
      rawContent: raw.html,
      contentType: 'html',
      author: {
        id: raw.author.id,
        name: raw.author.name,
        avatar: raw.author.avatar,
      },
      source: {
        type: 'post',
        url: raw.url,
      },
      postedAt: new Date(raw.created_at),
      fetchedAt: new Date(),
      engagement: {
        likes: raw.likes,
        replies: raw.comments,
      },
      metadata: {},
    };
  }

  protected categorizeError(error: Error): ErrorCategory {
    // 实现错误分类
    if (error.message.includes('rate limit')) {
      return ErrorCategory.RATE_LIMITED;
    }
    return ErrorCategory.UNKNOWN_ERROR;
  }
}
```

### 热更新

```typescript
// 手动触发重载
await this.adaptersService.reloadAdapter('github', newConfig);

// 从文件系统监听（开发环境）
AdaptersModule.forRoot({
  hotReload: {
    enabled: true,
    mode: 'filesystem',
    watchPath: './config/adapters',
  },
});

// Webhook 触发（生产环境）
// POST /webhooks/adapter-reload
{
  "platform": "github",
  "action": "reload",
  "config": { ... },
  "secret": "webhook_secret"
}
```

### 事件监听

```typescript
import { OnEvent } from '@nestjs/event-emitter';
import { AdapterEvent } from './adapters/new-architecture/types';

@Injectable()
export class AdapterEventListener {
  @OnEvent('adapter:fetch:success')
  handleFetchSuccess(event: AdapterEvent) {
    console.log(`Adapter ${event.platform} fetched successfully`);
  }

  @OnEvent('adapter:rate_limited')
  handleRateLimited(event: AdapterEvent) {
    console.warn(`Adapter ${event.platform} rate limited`);
    // 发送告警
  }

  @OnEvent('adapter:circuit_open')
  handleCircuitOpen(event: AdapterEvent) {
    console.error(`Adapter ${event.platform} circuit opened`);
    // 发送紧急告警
  }
}
```

## 限流策略对比

| 策略 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| 令牌桶 | 允许突发流量，平滑限流 | 实现稍复杂 | API 限流，GitHub |
| 滑动窗口 | 精确平滑，无临界问题 | 内存开销大 | Twitter，高精度要求 |
| 固定窗口 | 简单高效 | 临界突发问题 | 简单场景，低精度要求 |
| 漏桶 | 严格匀速，平滑输出 | 无突发能力 | 严格匀速场景 |

## 最佳实践

1. **限流配置**：根据平台文档设置合理的限流值，通常保守一些
2. **重试策略**：使用抖动退避避免重试风暴
3. **熔断器**：生产环境务必启用熔断器，防止级联故障
4. **错误处理**：实现详细的错误分类，便于问题定位
5. **监控指标**：关注延迟 P95/P99、错误率、限流命中率
6. **热更新**：生产环境使用数据库或 Webhook 模式，避免文件系统监听

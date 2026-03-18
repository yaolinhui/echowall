# 多平台 API 适配器架构 - 完整指南

## 📋 目录

1. [架构概述](#架构概述)
2. [核心组件](#核心组件)
3. [快速开始](#快速开始)
4. [高级功能](#高级功能)
5. [扩展适配器](#扩展适配器)
6. [最佳实践](#最佳实践)

---

## 架构概述

本架构提供了一个完整的、生产级的多平台 API 适配器解决方案，用于统一访问各种社交媒体平台（GitHub、Twitter、知乎等）。

### 设计原则

1. **单一职责**：每个组件只负责一个功能
2. **开闭原则**：对扩展开放，对修改关闭
3. **依赖倒置**：依赖抽象接口而非具体实现
4. **装饰器模式**：通过装饰器增强功能，而非修改原有代码

### 技术栈

- **框架**：NestJS + TypeScript
- **HTTP 客户端**：@nestjs/axios
- **事件系统**：@nestjs/event-emitter
- **限流算法**：令牌桶、滑动窗口、固定窗口、漏桶
- **重试策略**：固定、线性、指数、抖动退避
- **熔断器**：三态状态机（Closed/Open/Half-Open）

---

## 核心组件

### 1. 类型系统 (`types/`)

```typescript
// 统一数据格式
interface UnifiedMention {
  id: string;
  platform: string;
  content: string;
  author: { id; name; avatar; };
  source: { type; url; };
  postedAt: Date;
  engagement: { likes; replies; shares; };
}

// 错误分类
enum ErrorCategory {
  NETWORK_ERROR,    // 网络错误 - 可重试
  RATE_LIMITED,     // 限流 - 指数退避重试
  AUTH_ERROR,       // 认证失败 - 不重试
  SERVER_ERROR,     // 服务端错误 - 可重试
  // ...
}
```

### 2. 适配器核心 (`core/`)

```typescript
// 适配器接口
interface IAdapter {
  readonly platform: string;
  initialize(config): Promise<void>;
  fetch(options?): Promise<FetchResult>;
  transform(raw): UnifiedMention;
  handleError(error): { category, retryable };
}

// 抽象基类（模板方法模式）
abstract class AbstractAdapter implements IAdapter {
  abstract doFetch(options);     // 子类实现
  abstract transform(raw);        // 子类实现
  
  async fetch(options) {          // 模板方法
    await this.beforeFetch();
    const result = await this.doFetch(options);
    await this.afterFetch(result);
    return result;
  }
}
```

### 3. 中间件层 (`middleware/`)

```typescript
// 装饰器适配器 - 包装基础适配器
class DecoratedAdapter implements IAdapter {
  constructor(
    private baseAdapter: IAdapter,
    private config: DecoratorConfig
  ) {
    // 初始化限流器、熔断器、重试处理器
  }
  
  async fetch(options) {
    // 1. 限流检查
    await this.rateLimiter.acquireOrWait();
    
    // 2. 熔断器保护
    return this.circuitBreaker.execute(() => {
      // 3. 重试机制
      return this.retryHandler.execute(() => 
        this.baseAdapter.fetch(options)
      );
    });
  }
}
```

### 4. 管理器 (`manager/`)

```typescript
// 适配器注册表
class AdapterRegistry {
  private adapters = new Map<string, IAdapter>();
  
  registerType(platform, constructor);  // 注册类型
  createAdapter(config);                // 创建实例
  getAdapter(platform);                 // 获取实例
  reloadAdapter(platform, config);      // 热重载
}

// 热更新管理器
class HotReloadManager {
  // 支持：filesystem / database / webhook / manual
  reloadAdapter(platform, config, source);
}
```

---

## 快速开始

### 1. 安装依赖

```bash
npm install @nestjs/axios @nestjs/event-emitter
```

### 2. 导入模块

```typescript
import { AdaptersModule } from './adapters/new-architecture';

@Module({
  imports: [
    AdaptersModule.forRoot({
      isGlobal: true,
      useBuiltInAdapters: true,
    }),
  ],
})
export class AppModule {}
```

### 3. 配置适配器

```typescript
// adapters.config.ts
export const githubConfig: AdapterConfig = {
  platform: 'github',
  enabled: true,
  auth: {
    type: 'bearer',
    accessToken: process.env.GITHUB_TOKEN,
  },
  rateLimit: {
    strategy: RateLimitStrategy.TOKEN_BUCKET,
    requestsPerWindow: 60,
    windowSizeMs: 60000,
  },
  options: {
    owner: 'facebook',
    repo: 'react',
  },
};
```

### 4. 使用服务

```typescript
@Injectable()
export class MentionService {
  constructor(private adaptersService: AdaptersService) {}

  async getMentions() {
    // 从所有平台获取
    const mentions = await this.adaptersService.fetchAndMerge({
      limit: 100,
      since: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });

    return mentions;
  }
}
```

---

## 高级功能

### 限流策略选择

| 策略 | 突发流量 | 平滑度 | 内存占用 | 适用场景 |
|------|----------|--------|----------|----------|
| 令牌桶 | ✅ 支持 | ⭐⭐⭐ | 低 | GitHub、大多数 API |
| 滑动窗口 | ❌ 不支持 | ⭐⭐⭐⭐⭐ | 高 | Twitter、高精度要求 |
| 固定窗口 | ❌ 不支持 | ⭐⭐ | 最低 | 简单场景 |
| 漏桶 | ❌ 不支持 | ⭐⭐⭐⭐ | 低 | 严格匀速 |

### 重试策略选择

```typescript
// 指数退避（推荐）
{
  backoffStrategy: 'exponential',
  initialDelayMs: 1000,  // 1s, 2s, 4s, 8s...
}

// 抖动退避（避免重试风暴）
{
  backoffStrategy: 'jitter',
  initialDelayMs: 1000,  // 随机 1s ~ 1.5s
}
```

### 熔断器配置

```typescript
{
  enabled: true,
  failureThreshold: 5,    // 5次失败后打开
  successThreshold: 2,    // 2次成功后关闭
  timeoutMs: 60000,       // 打开60秒后进入半开
  halfOpenMaxCalls: 3,    // 半开状态最多3次请求
}
```

### 热更新

```typescript
// 方式1：手动触发
await adaptersService.reloadAdapter('github', newConfig);

// 方式2：文件监听（开发环境）
AdaptersModule.forRoot({
  hotReload: {
    enabled: true,
    mode: 'filesystem',
    watchPath: './config/adapters',
  },
});

// 方式3：Webhook（生产环境）
// POST /webhooks/adapter-reload
{
  "platform": "github",
  "action": "reload",
  "config": { ... },
  "secret": "your-secret"
}
```

---

## 扩展适配器

### 1. 创建适配器类

```typescript
import { AbstractAdapter } from './core/abstract-adapter';

class CustomAdapter extends AbstractAdapter {
  constructor() {
    super('custom_platform');
  }

  protected async doFetch(options): Promise<FetchResult> {
    const rawData = await this.fetchFromApi(options);
    return this.createFetchResult(
      this.transformBatch(rawData),
      { hasMore: rawData.hasMore }
    );
  }

  transform(raw): UnifiedMention | null {
    return {
      id: `custom:${raw.id}`,
      platform: this.platform,
      content: raw.text,
      author: {
        id: raw.user.id,
        name: raw.user.name,
      },
      // ...
    };
  }

  protected categorizeError(error): ErrorCategory {
    if (error.status === 429) return ErrorCategory.RATE_LIMITED;
    return ErrorCategory.UNKNOWN_ERROR;
  }
}
```

### 2. 注册适配器

```typescript
registry.registerType('custom', CustomAdapter);
await registry.createAdapter({
  platform: 'custom',
  enabled: true,
  options: { /* ... */ },
});
```

---

## 最佳实践

### 1. 错误处理

```typescript
// 详细的错误分类
protected categorizeError(error): ErrorCategory {
  const status = error.response?.status;
  
  switch (status) {
    case 401: return ErrorCategory.AUTHENTICATION_ERROR;
    case 403: 
      return error.message.includes('rate') 
        ? ErrorCategory.RATE_LIMITED 
        : ErrorCategory.AUTHORIZATION_ERROR;
    case 429: return ErrorCategory.RATE_LIMITED;
    case 500:
    case 502:
    case 503: return ErrorCategory.SERVER_ERROR;
    default: return ErrorCategory.UNKNOWN_ERROR;
  }
}
```

### 2. 日志记录

```typescript
// 使用结构化日志
this.logger.log('Fetching mentions', {
  platform: this.platform,
  options,
  duration: Date.now() - startTime,
});
```

### 3. 监控指标

```typescript
// 关注关键指标
const metrics = adapter.getMetrics();

// 延迟 P95/P99
expect(metrics.latencyP95).toBeLessThan(1000);

// 错误率
const errorRate = metrics.requestsFailed / metrics.requestsTotal;
expect(errorRate).toBeLessThan(0.01);

// 限流命中率
expect(metrics.rateLimitHits).toBeLessThan(10);
```

### 4. 安全配置

```typescript
// 使用环境变量
auth: {
  accessToken: process.env.API_TOKEN,
  clientSecret: process.env.API_SECRET,
}

// 敏感配置不输出到日志
logger.log('Config loaded', {
  ...config,
  auth: '[REDACTED]',
});
```

### 5. 测试策略

```typescript
describe('Adapter', () => {
  // 单元测试
  it('should transform data correctly', () => {
    const mention = adapter.transform(mockData);
    expect(mention.platform).toBe('github');
    expect(mention.content).toBeDefined();
  });

  // 集成测试（使用 nock 拦截 HTTP）
  it('should fetch from API', async () => {
    nock('https://api.github.com')
      .get('/repos/test/test/issues')
      .reply(200, mockIssues);
    
    const result = await adapter.fetch();
    expect(result.data).toHaveLength(2);
  });

  // 错误处理测试
  it('should handle rate limit', async () => {
    nock('https://api.github.com')
      .get('/repos/test/test/issues')
      .reply(429, { message: 'Rate limited' });
    
    await expect(adapter.fetch()).rejects.toThrow();
    expect(adapter.getMetrics().errorsByCategory[ErrorCategory.RATE_LIMITED]).toBe(1);
  });
});
```

---

## 性能优化

### 1. 连接池

```typescript
HttpModule.register({
  timeout: 5000,
  maxRedirects: 5,
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true }),
});
```

### 2. 缓存策略

```typescript
// 添加缓存层
@Injectable()
class CachedAdapter extends DecoratedAdapter {
  private cache = new Map<string, { data; expiry }>();

  async fetch(options) {
    const key = JSON.stringify(options);
    const cached = this.cache.get(key);
    
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }
    
    const result = await super.fetch(options);
    this.cache.set(key, {
      data: result,
      expiry: Date.now() + 60000, // 1分钟缓存
    });
    
    return result;
  }
}
```

### 3. 批处理

```typescript
// 批量获取而不是逐个获取
async fetchBatch(ids: string[]): Promise<UnifiedMention[]> {
  const batchSize = 100;
  const results: UnifiedMention[] = [];
  
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(id => this.fetchById(id).catch(() => null))
    );
    results.push(...batchResults.filter(Boolean));
  }
  
  return results;
}
```

---

## 故障排除

### 常见问题

1. **Rate Limit 频繁触发**
   - 检查限流配置是否与平台文档一致
   - 考虑使用更保守的限流值
   - 实现请求队列

2. **熔断器频繁打开**
   - 检查平台服务状态
   - 调高 `failureThreshold`
   - 检查网络连接稳定性

3. **热更新不生效**
   - 确认 `HotReloadManager` 已启用
   - 检查文件监听路径是否正确
   - 查看日志中的错误信息

4. **内存泄漏**
   - 确保调用 `adapter.dispose()`
   - 清理事件监听器
   - 限制缓存大小

---

## 贡献指南

1. 新增平台适配器：在 `platforms/` 目录添加
2. 新增中间件：在 `middleware/` 目录添加
3. 遵循现有代码风格
4. 编写单元测试
5. 更新文档

---

## 许可证

MIT License

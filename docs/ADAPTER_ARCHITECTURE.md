# 多平台 API 适配器架构设计文档

## 1. 架构概述

### 1.1 设计目标
- **可扩展性**: 支持 10+ 平台，轻松添加新平台
- **可维护性**: 统一接口，清晰的职责分离
- **可靠性**: 限流、重试、熔断、降级
- **热更新**: 无需重启服务即可更新适配器

### 1.2 核心模式
- **Adapter Pattern**: 统一不同平台的接口差异
- **Strategy Pattern**: 不同的限流、重试策略可插拔
- **Plugin Architecture**: 动态加载/卸载适配器
- **Factory Pattern**: 创建适配器实例
- **Decorator Pattern**: 增强适配器功能（限流、重试等）

## 2. 架构分层

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
│  (Fetcher Service, API Controllers, Background Jobs)        │
├─────────────────────────────────────────────────────────────┤
│                    Adapter Manager Layer                    │
│  (AdapterRegistry, HotReloadManager, LifecycleManager)      │
├─────────────────────────────────────────────────────────────┤
│                    Adapter Core Layer                       │
│  (IAdapter, AbstractAdapter, BaseAdapter)                   │
├─────────────────────────────────────────────────────────────┤
│                    Middleware Layer                         │
│  (RateLimiter, RetryHandler, CircuitBreaker, AuthManager)   │
├─────────────────────────────────────────────────────────────┤
│                    Platform Adapters                        │
│  (GitHub, Twitter, ProductHunt, Zhihu, etc.)                │
├─────────────────────────────────────────────────────────────┤
│                    Infrastructure Layer                     │
│  (HTTP Client, Redis, Logger, Metrics)                      │
└─────────────────────────────────────────────────────────────┘
```

## 3. 核心组件

### 3.1 数据模型统一

```typescript
// 标准化数据格式，所有平台返回统一结构
interface UnifiedMention {
  // 基础信息
  id: string;                    // 全局唯一ID
  platform: string;              // 平台标识
  externalId: string;            // 平台原始ID
  
  // 内容信息
  content: string;               // 处理后的内容（纯文本/摘要）
  rawContent: string;            // 原始内容（HTML/Markdown）
  contentType: 'text' | 'html' | 'markdown';
  
  // 作者信息
  author: {
    id: string;
    name: string;
    avatar?: string;
    url?: string;
    followers?: number;
    verified?: boolean;
  };
  
  // 来源信息
  source: {
    type: 'issue' | 'comment' | 'review' | 'post' | 'tweet' | 'answer';
    url: string;
    title?: string;
    parentId?: string;           // 父级内容ID（如评论所属的问题）
  };
  
  // 时间信息
  postedAt: Date;
  fetchedAt: Date;
  
  // 互动数据
  engagement: {
    likes?: number;
    replies?: number;
    shares?: number;
    views?: number;
  };
  
  // 元数据
  metadata: Record<string, any>;
  
  // 情感分析（可选）
  sentiment?: {
    score: number;               // -1 到 1
    label: 'positive' | 'negative' | 'neutral';
  };
}
```

### 3.2 限流策略

```typescript
// 支持多种限流算法
enum RateLimitStrategy {
  TOKEN_BUCKET = 'token_bucket',       // 令牌桶 - 适合突发流量
  SLIDING_WINDOW = 'sliding_window',   // 滑动窗口 - 平滑限流
  FIXED_WINDOW = 'fixed_window',       // 固定窗口 - 简单高效
  LEAKY_BUCKET = 'leaky_bucket',       // 漏桶 - 严格匀速
}

// 每个平台可配置不同的限流参数
interface RateLimitConfig {
  strategy: RateLimitStrategy;
  requestsPerWindow: number;
  windowSizeMs: number;
  burstSize?: number;                   // 令牌桶专用
  keyPrefix?: string;                   // Redis key 前缀
}
```

### 3.3 错误分类与重试

```typescript
// 错误分类
enum ErrorCategory {
  NETWORK_ERROR = 'network_error',           // 网络错误 - 可重试
  RATE_LIMITED = 'rate_limited',             // 限流 - 指数退避重试
  AUTHENTICATION_ERROR = 'auth_error',       // 认证失败 - 不重试
  AUTHORIZATION_ERROR = 'forbidden',         // 权限不足 - 不重试
  NOT_FOUND = 'not_found',                   // 资源不存在 - 不重试
  VALIDATION_ERROR = 'validation_error',     // 参数错误 - 不重试
  SERVER_ERROR = 'server_error',             // 服务端错误 - 可重试
  TIMEOUT_ERROR = 'timeout',                 // 超时 - 可重试
  UNKNOWN_ERROR = 'unknown',                 // 未知错误
}

// 重试策略
interface RetryPolicy {
  maxAttempts: number;
  backoffStrategy: 'fixed' | 'linear' | 'exponential';
  initialDelayMs: number;
  maxDelayMs: number;
  retryableErrors: ErrorCategory[];
}
```

## 4. 适配器生命周期

```
    ┌──────────┐
    │  Loaded  │◄── 从文件/数据库加载
    └────┬─────┘
         │
         ▼
    ┌──────────┐
    │  Valid   │◄── 配置验证
    └────┬─────┘
         │
         ▼
    ┌──────────┐
    │  Active  │◄── 注册到 Registry，可接收请求
    └────┬─────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌─────────┐
│Paused │ │ Disabled│
└───┬───┘ └────┬────┘
    │          │
    └────┬─────┘
         ▼
    ┌──────────┐
    │  Error   │◄── 错误状态，记录错误信息
    └────┬─────┘
         │
         ▼
    ┌──────────┐
    │Unloaded  │◄── 清理资源，从 Registry 移除
    └──────────┘
```

## 5. 热更新机制

```typescript
// 支持两种热更新方式：
// 1. 文件系统监听（开发环境）
// 2. 数据库配置变更（生产环境）

interface HotReloadConfig {
  enabled: boolean;
  mode: 'filesystem' | 'database' | 'webhook';
  watchPath?: string;           // 文件监听路径
  checkIntervalMs?: number;     // 数据库轮询间隔
  webhookEndpoint?: string;     // Webhook 端点
}
```

## 6. 监控与指标

```typescript
interface AdapterMetrics {
  // 请求指标
  requestsTotal: number;
  requestsSuccess: number;
  requestsFailed: number;
  
  // 延迟指标
  latencyAvg: number;
  latencyP95: number;
  latencyP99: number;
  
  // 限流指标
  rateLimitHits: number;
  rateLimitWaits: number;
  
  // 错误指标
  errorsByCategory: Record<ErrorCategory, number>;
  
  // 数据指标
  itemsFetched: number;
  itemsTransformed: number;
}
```

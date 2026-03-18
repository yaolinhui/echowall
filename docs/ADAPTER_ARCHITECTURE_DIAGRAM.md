# 多平台 API 适配器架构图

## 整体架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Application Layer                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │  API Controller │  │ Fetcher Service │  │  Background Job Processor   │  │
│  │                 │  │                 │  │                             │  │
│  │  GET /mentions  │  │  scheduleFetch  │  │  processQueue()             │  │
│  │  GET /health    │  │  fetchFromAll   │  │  retryFailed()              │  │
│  └────────┬────────┘  └────────┬────────┘  └──────────────┬──────────────┘  │
│           │                    │                          │                  │
└───────────┼────────────────────┼──────────────────────────┼──────────────────┘
            │                    │                          │
            └────────────────────┼──────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Adapter Service Layer                                 │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                      AdaptersService                                   │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐ │  │
│  │  │ getAdapter  │  │fetchFromAll │  │fetchAndMerge│  │  getHealth   │ │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └──────────────┘ │  │
│  └───────────────────────────────────┬───────────────────────────────────┘  │
└──────────────────────────────────────┼──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Adapter Manager Layer                                 │
│  ┌─────────────────────────┐    ┌─────────────────────────────────────────┐  │
│  │    AdapterRegistry      │    │        HotReloadManager                  │  │
│  │                         │    │                                          │  │
│  │  ┌───────────────────┐  │    │  ┌────────────────────────────────────┐  │  │
│  │  │  Map<string,      │  │    │  │  Modes:                            │  │  │
│  │  │  AdapterReg>      │  │    │  │  • Filesystem (dev)               │  │  │
│  │  └───────────────────┘  │    │  │  • Database (prod)                │  │  │
│  │                         │    │  │  • Webhook (CI/CD)                │  │  │
│  │  • registerType()     │    │  │  • Manual                         │  │  │
│  │  • createAdapter()    │    │  └────────────────────────────────────┘  │  │
│  │  • getAdapter()       │    │                                          │  │
│  │  • reloadAdapter()    │    │  reloadAdapter(platform, config, source) │  │
│  │  • disposeAll()       │    │  loadFromManifest(path)                  │  │
│  └─────────────────────────┘    └─────────────────────────────────────────┘  │
└──────────────────────────────────────┼──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Adapter Core Layer                                    │
│                                                                              │
│  ┌──────────────────┐    ┌───────────────────────────────────────────────┐  │
│  │   IAdapter       │    │            AbstractAdapter                     │  │
│  │   (Interface)    │◄───┤                                              │  │
│  │                  │    │  ┌─────────────────────────────────────────┐   │  │
│  │ • initialize()   │    │  │  Template Method Pattern                │   │  │
│  │ • fetch()        │    │  │                                         │   │  │
│  │ • transform()    │    │  │  doFetch() ──► fetchIssues()           │   │  │
│  │ • handleError()  │    │  │               fetchComments()          │   │  │
│  └──────────────────┘    │  │                                         │   │  │
│                          │  │  transform() ──► transformIssue()      │   │  │
│  ┌──────────────────┐    │  │                transformComment()      │   │  │
│  │ IRefreshable     │    │  │                                         │   │  │
│  │ IStreaming       │    │  │  categorizeError() ──► map to          │   │  │
│  │ IWebhook         │    │  │                        ErrorCategory   │   │  │
│  └──────────────────┘    │  └─────────────────────────────────────────┘   │  │
│                          └───────────────────────────────────────────────┘  │
└──────────────────────────────────────┼──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Middleware Layer (Decorators)                         │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │  DecoratedAdapter │  Decorator Pattern: Wraps IAdapter               │  │
│  │                   │                                                  │  │
│  │  acquire()        │  ┌─────────────┐    ┌─────────────┐    ┌────────┐ │  │
│  │  acquireOrWait()  │  │  fetch()    │───►│  Circuit    │───►│  Base  │ │  │
│  │  getStatus()      │  │             │    │  Breaker    │    │Adapter │ │  │
│  │  reset()          │  └─────────────┘    └─────────────┘    └────────┘ │  │
│  └─────────────────┘                                                  │  │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │  RetryHandler   │  │  CircuitBreaker │  │  RateLimiterFactory         │  │
│  │                 │  │                 │  │                             │  │
│  │  Strategies:    │  │  States:        │  │  Strategies:                │  │
│  │  • Fixed        │  │  • CLOSED       │  │  • Token Bucket             │  │
│  │  • Linear       │  │  • OPEN         │  │  • Sliding Window           │  │
│  │  • Exponential  │  │  • HALF_OPEN    │  │  • Fixed Window             │  │
│  │  • Jitter       │  │                 │  │  • Leaky Bucket             │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘  │
└──────────────────────────────────────┼──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Platform Adapters                                     │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │  GitHubAdapter  │  │  TwitterAdapter │  │      ZhihuAdapter           │  │
│  │                 │  │                 │  │                             │  │
│  │  API: REST v3   │  │  API: v2        │  │  API: Mobile Web            │  │
│  │  Auth: OAuth/Bearer│  Auth: OAuth 2.0 │  Auth: Cookie/None           │  │
│  │                 │  │                 │  │                             │  │
│  │  Resources:     │  │  Resources:     │  │  Resources:                 │  │
│  │  • Issues       │  │  • Tweets       │  │  • Answers                  │  │
│  │  • Comments     │  │  • Mentions     │  │  • Articles                 │  │
│  │  • Discussions  │  │  • Search       │  │  • Pins                     │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘  │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │  ProductHunt    │  │  RedditAdapter  │  │    [Your Adapter]           │  │
│  │  ChromeWebStore │  │  YouTubeAdapter │  │                             │  │
│  │  HackerNews     │  │  BilibiliAdapter│  │  Easy to extend...          │  │
│  │  WeiboAdapter   │  │  CustomAdapter  │  │                             │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Infrastructure Layer                                  │
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ HttpService │  │   Logger    │  │  EventEmitter│  │    Redis (opt)      │ │
│  │  (@nestjs/  │  │  (@nestjs/  │  │  (@nestjs/   │  │  (for distributed   │ │
│  │   axios)    │  │  common)    │  │  event-      │  │   rate limiting)    │ │
│  │             │  │             │  │  emitter)    │  │                     │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 数据流图

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Client  │────►│   Adapter    │────►│  Middleware  │────►│   Platform   │
│  Request │     │   Registry   │     │  Chain       │     │   API        │
└──────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                                              │
                                              ▼
                                       ┌──────────────┐
                                       │  1. Rate     │
                                       │     Limiter  │
                                       └──────────────┘
                                              │
                                              ▼
                                       ┌──────────────┐
                                       │  2. Circuit  │
                                       │   Breaker    │
                                       └──────────────┘
                                              │
                                              ▼
                                       ┌──────────────┐
                                       │  3. Retry    │
                                       │   Handler    │
                                       └──────────────┘
                                              │
                                              ▼
                                       ┌──────────────┐
                                       │  4. Base     │
                                       │   Adapter    │
                                       └──────────────┘


┌──────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Client  │◄────│   Unified    │◄────│  Transform   │◄────│   Platform   │
│ Response │     │   Response   │     │   & Filter   │     │   Response   │
└──────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

## 状态机图

### 适配器生命周期

```
                    ┌──────────┐
         ┌─────────►│  LOADED  │◄────────┐
         │          └────┬─────┘         │
         │               │ initialize()   │
         │               ▼                │
         │          ┌──────────┐         │
         │          │  VALID   │         │
         │          └────┬─────┘         │
         │               │                │
         │               ▼                │
    dispose()      ┌──────────┐      create()
         │         │  ACTIVE  │──────────┘
         │         └────┬─────┘
         │              │
         │    ┌─────────┼─────────┐
         │    │         │         │
         │    ▼         ▼         ▼
         │ ┌──────┐ ┌───────┐ ┌────────┐
         │ │PAUSED│ │DISABLED│ │ ERROR  │
         │ └──┬───┘ └───┬───┘ └───┬────┘
         │    │         │         │
         └────┴─────────┴─────────┘
                              ▲
                              │
                              │ handleError()
                              │
```

### 熔断器状态

```
                    ┌─────────┐
         ┌─────────►│  CLOSED │◄────────┐
         │          │ (normal)│         │
         │          └────┬────┘         │
         │               │ failure       │ success
         │               ▼ threshold     │ threshold
         │          ┌─────────┐          │
         │          │  OPEN   │──────────┘
         │          │(blocked)│
         │          └────┬────┘
         │               │ timeout
         │               ▼
         │          ┌─────────┐
         └──────────┤HALF_OPEN│
    failure         │(testing)│
                    └─────────┘
```

## 类图

```
┌─────────────────────────────────────────────────────────────────┐
│                         <<interface>>                            │
│                          IAdapter                                │
├─────────────────────────────────────────────────────────────────┤
│ + platform: string                                               │
│ + status: AdapterStatus                                          │
│ + config: AdapterConfig                                          │
├─────────────────────────────────────────────────────────────────┤
│ + initialize(config): Promise<void>                              │
│ + validateConfig(config): Promise<boolean>                       │
│ + testConnection(): Promise<{success, message}>                  │
│ + fetch(options?): Promise<FetchResult>                          │
│ + fetchById(id): Promise<UnifiedMention|null>                    │
│ + transform(raw): UnifiedMention|null                            │
│ + getMetrics(): AdapterMetrics                                   │
│ + dispose(): Promise<void>                                       │
└─────────────────────────────────────────────────────────────────┘
                              △
                              │ extends
                              │
┌─────────────────────────────────────────────────────────────────┐
│                      AbstractAdapter                             │
│                    (Template Method)                             │
├─────────────────────────────────────────────────────────────────┤
│ # logger: Logger                                                 │
│ # _status: AdapterStatus                                         │
│ # _config: AdapterConfig                                         │
│ # _metrics: AdapterMetrics                                       │
├─────────────────────────────────────────────────────────────────┤
│ # doFetch(options): Promise<FetchResult>           {abstract}    │
│ # doFetchById(id): Promise<UnifiedMention|null>    {abstract}    │
│ # transform(raw): UnifiedMention|null              {abstract}    │
│ # categorizeError(error): ErrorCategory            {abstract}    │
│ # validatePlatformConfig(config): Promise<boolean> {abstract}    │
├─────────────────────────────────────────────────────────────────┤
│ + fetch(options): Promise<FetchResult>           {final}         │
│ + handleError(error): {category, retryable}      {final}         │
│ # createFetchResult(data, meta): FetchResult     {final}         │
└─────────────────────────────────────────────────────────────────┘
                              △
                              │ extends
              ┌───────────────┼───────────────┐
              │               │               │
    ┌─────────┴────┐  ┌──────┴──────┐  ┌─────┴──────┐
    │ GitHubAdapter │  │TwitterAdapter│  │ZhihuAdapter│
    ├───────────────┤  ├─────────────┤  ├────────────┤
    │# fetchIssues()│  │# searchTweets│  │# search()  │
    │# fetchComments│  │# getTimeline │  │# fetchAns()│
    │# transformIssue│ │# refreshAuth │  │# transform │
    └───────────────┘  └─────────────┘  └────────────┘
```

## 部署架构

```
┌─────────────────────────────────────────────────────────────────┐
│                          Load Balancer                           │
└──────────────────────────────────┬──────────────────────────────┘
                                   │
           ┌───────────────────────┼───────────────────────┐
           │                       │                       │
           ▼                       ▼                       ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│   NestJS App     │    │   NestJS App     │    │   NestJS App     │
│   Instance 1     │    │   Instance 2     │    │   Instance 3     │
│                  │    │                  │    │                  │
│ ┌──────────────┐ │    │ ┌──────────────┐ │    │ ┌──────────────┐ │
│ │ Adapter      │ │    │ │ Adapter      │ │    │ │ Adapter      │ │
│ │ Registry     │ │    │ │ Registry     │ │    │ │ Registry     │ │
│ │              │ │    │ │              │ │    │ │              │ │
│ │ GitHub ✓     │ │    │ │ GitHub ✓     │ │    │ │ GitHub ✓     │ │
│ │ Twitter ✓    │ │    │ │ Twitter ✓    │ │    │ │ Twitter ✓    │ │
│ │ Zhihu ✓      │ │    │ │ Zhihu ✓      │ │    │ │ Zhihu ✓      │ │
│ └──────────────┘ │    │ └──────────────┘ │    │ └──────────────┘ │
└────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
                    ▼                         ▼
         ┌──────────────────┐      ┌──────────────────┐
         │      Redis       │      │   PostgreSQL     │
         │  (Rate Limiting, │      │  (Config Store,  │
         │   Sessions)      │      │   Metrics)       │
         └──────────────────┘      └──────────────────┘
```

/**
 * 多平台 API 适配器架构 - 核心类型定义
 * 
 * 提供统一的数据模型、配置类型和枚举定义
 */

// ============================================================================
// 平台与适配器类型
// ============================================================================

export enum AdapterStatus {
  LOADED = 'loaded',
  VALID = 'valid',
  ACTIVE = 'active',
  PAUSED = 'paused',
  DISABLED = 'disabled',
  ERROR = 'error',
  UNLOADED = 'unloaded',
}

export enum PlatformType {
  GITHUB = 'github',
  TWITTER = 'twitter',
  PRODUCT_HUNT = 'producthunt',
  ZHIHU = 'zhihu',
  CHROME_WEB_STORE = 'chromewebstore',
  REDDIT = 'reddit',
  HACKER_NEWS = 'hackernews',
  YOUTUBE = 'youtube',
  BILIBILI = 'bilibili',
  WEIBO = 'weibo',
  CUSTOM = 'custom',
}

// ============================================================================
// 数据模型
// ============================================================================

/**
 * 统一的社交媒体提及数据结构
 * 所有平台适配器必须将原始数据转换为此格式
 */
export interface UnifiedMention {
  // 基础信息
  id: string;
  platform: string;
  externalId: string;

  // 内容信息
  content: string;
  rawContent: string;
  contentType: 'text' | 'html' | 'markdown';
  language?: string;

  // 作者信息
  author: {
    id: string;
    name: string;
    username?: string;
    avatar?: string;
    url?: string;
    followers?: number;
    verified?: boolean;
    location?: string;
  };

  // 来源信息
  source: {
    type: 'issue' | 'comment' | 'review' | 'post' | 'tweet' | 'answer' | 'video' | 'thread';
    url: string;
    title?: string;
    description?: string;
    parentId?: string;
    parentUrl?: string;
  };

  // 时间信息
  postedAt: Date;
  fetchedAt: Date;
  updatedAt?: Date;

  // 互动数据
  engagement: {
    likes?: number;
    dislikes?: number;
    replies?: number;
    shares?: number;
    views?: number;
    bookmarks?: number;
  };

  // 元数据（平台特定字段）
  metadata: Record<string, any>;

  // 情感分析（可选，后续处理）
  sentiment?: {
    score: number;
    label: 'positive' | 'negative' | 'neutral' | 'mixed';
    confidence?: number;
  };

  // 标签和分类
  tags?: string[];
  categories?: string[];
}

/**
 * 原始数据包装器，保留原始响应以便调试
 */
export interface RawDataWrapper<T = any> {
  platform: string;
  endpoint: string;
  raw: T;
  fetchedAt: Date;
  headers?: Record<string, string>;
}

// ============================================================================
// 错误分类
// ============================================================================

export enum ErrorCategory {
  NETWORK_ERROR = 'network_error',
  RATE_LIMITED = 'rate_limited',
  AUTHENTICATION_ERROR = 'auth_error',
  AUTHORIZATION_ERROR = 'forbidden',
  NOT_FOUND = 'not_found',
  VALIDATION_ERROR = 'validation_error',
  SERVER_ERROR = 'server_error',
  TIMEOUT_ERROR = 'timeout',
  PARSING_ERROR = 'parsing_error',
  CIRCUIT_OPEN = 'circuit_open',
  UNKNOWN_ERROR = 'unknown',
}

/**
 * 可重试的错误类型
 */
export const RETRYABLE_ERRORS: ErrorCategory[] = [
  ErrorCategory.NETWORK_ERROR,
  ErrorCategory.RATE_LIMITED,
  ErrorCategory.SERVER_ERROR,
  ErrorCategory.TIMEOUT_ERROR,
  ErrorCategory.CIRCUIT_OPEN,
];

/**
 * 需要更新认证的错误类型
 */
export const AUTH_ERRORS: ErrorCategory[] = [
  ErrorCategory.AUTHENTICATION_ERROR,
  ErrorCategory.AUTHORIZATION_ERROR,
];

// ============================================================================
// 配置类型
// ============================================================================

/**
 * 适配器配置基类
 */
export interface AdapterConfig {
  platform: string;
  enabled: boolean;
  
  // 认证配置
  auth?: AuthConfig;
  
  // 限流配置
  rateLimit?: RateLimitConfig;
  
  // 重试配置
  retry?: RetryConfig;
  
  // 熔断配置
  circuitBreaker?: CircuitBreakerConfig;
  
  // 平台特定配置
  options?: Record<string, any>;
  
  // 元数据
  metadata?: {
    name: string;
    description?: string;
    version?: string;
    author?: string;
    icon?: string;
    website?: string;
  };
}

/**
 * 认证配置
 */
export interface AuthConfig {
  type: 'none' | 'api_key' | 'oauth1' | 'oauth2' | 'bearer' | 'basic';
  
  // API Key
  apiKey?: string;
  apiKeyHeader?: string;
  
  // OAuth
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: Date;
  
  // Basic Auth
  username?: string;
  password?: string;
  
  // 自定义认证
  customHeaders?: Record<string, string>;
  
  // Token 刷新配置
  autoRefresh?: boolean;
  refreshBeforeExpiryMs?: number;
}

// ============================================================================
// 限流配置
// ============================================================================

export enum RateLimitStrategy {
  TOKEN_BUCKET = 'token_bucket',
  SLIDING_WINDOW = 'sliding_window',
  FIXED_WINDOW = 'fixed_window',
  LEAKY_BUCKET = 'leaky_bucket',
}

export interface RateLimitConfig {
  strategy: RateLimitStrategy;
  requestsPerWindow: number;
  windowSizeMs: number;
  burstSize?: number;
  keyPrefix?: string;
  
  // 高级配置
  priorityLevels?: number;
  queueEnabled?: boolean;
  queueMaxSize?: number;
}

// ============================================================================
// 重试配置
// ============================================================================

export interface RetryConfig {
  maxAttempts: number;
  backoffStrategy: 'fixed' | 'linear' | 'exponential' | 'jitter';
  initialDelayMs: number;
  maxDelayMs: number;
  retryableErrors: ErrorCategory[];
  
  // 高级配置
  timeoutMs?: number;
  abortOnTimeout?: boolean;
}

// ============================================================================
// 熔断配置
// ============================================================================

export interface CircuitBreakerConfig {
  enabled: boolean;
  failureThreshold: number;
  successThreshold: number;
  timeoutMs: number;
  halfOpenMaxCalls: number;
}

// ============================================================================
// 请求/响应类型
// ============================================================================

export interface FetchOptions {
  // 分页
  page?: number;
  limit?: number;
  cursor?: string;
  
  // 过滤
  since?: Date;
  until?: Date;
  keywords?: string[];
  authors?: string[];
  
  // 排序
  sortBy?: 'date' | 'relevance' | 'engagement';
  sortOrder?: 'asc' | 'desc';
  
  // 其他
  includeReplies?: boolean;
  includeMetadata?: boolean;
  language?: string;
}

export interface FetchResult {
  data: UnifiedMention[];
  meta: {
    totalCount?: number;
    hasMore: boolean;
    nextCursor?: string;
    page?: number;
    limit?: number;
  };
  raw?: RawDataWrapper[];
}

// ============================================================================
// 指标类型
// ============================================================================

export interface AdapterMetrics {
  // 基本信息
  platform: string;
  status: AdapterStatus;
  lastFetchedAt?: Date;
  lastErrorAt?: Date;
  
  // 请求指标
  requestsTotal: number;
  requestsSuccess: number;
  requestsFailed: number;
  
  // 延迟指标（毫秒）
  latencyAvg: number;
  latencyMin: number;
  latencyMax: number;
  latencyP95: number;
  latencyP99: number;
  
  // 限流指标
  rateLimitHits: number;
  rateLimitWaits: number;
  queuedRequests: number;
  
  // 错误分类统计
  errorsByCategory: Partial<Record<ErrorCategory, number>>;
  
  // 数据指标
  itemsFetched: number;
  itemsTransformed: number;
  itemsFiltered: number;
  
  // 熔断指标
  circuitBreakerOpens: number;
  circuitBreakerState?: 'closed' | 'open' | 'half-open';
}

// ============================================================================
// 热更新类型
// ============================================================================

export interface HotReloadConfig {
  enabled: boolean;
  mode: 'filesystem' | 'database' | 'webhook' | 'manual';
  watchPath?: string;
  checkIntervalMs?: number;
  webhookEndpoint?: string;
  webhookSecret?: string;
}

export interface AdapterManifest {
  id: string;
  platform: string;
  version: string;
  entryPoint: string;
  dependencies?: string[];
  permissions?: string[];
  configSchema?: Record<string, any>;
}

// ============================================================================
// 事件类型
// ============================================================================

export enum AdapterEventType {
  LOADED = 'adapter:loaded',
  UNLOADED = 'adapter:unloaded',
  ACTIVATED = 'adapter:activated',
  DEACTIVATED = 'adapter:deactivated',
  ERROR = 'adapter:error',
  FETCH_START = 'adapter:fetch:start',
  FETCH_SUCCESS = 'adapter:fetch:success',
  FETCH_ERROR = 'adapter:fetch:error',
  RATE_LIMITED = 'adapter:rate_limited',
  CIRCUIT_OPEN = 'adapter:circuit_open',
  CONFIG_UPDATED = 'adapter:config:updated',
}

export interface AdapterEvent {
  type: AdapterEventType;
  platform: string;
  timestamp: Date;
  data?: any;
  error?: Error;
}

// ============================================================================
// 工具类型
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Nullable<T> = T | null | undefined;

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

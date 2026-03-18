/**
 * 适配器接口定义
 * 
 * 所有平台适配器必须实现此接口
 */

import {
  AdapterConfig,
  AdapterStatus,
  FetchOptions,
  FetchResult,
  AdapterMetrics,
  UnifiedMention,
  ErrorCategory,
} from '../types';

/**
 * 适配器接口 - 所有平台适配器必须实现
 */
export interface IAdapter {
  /**
   * 平台唯一标识
   */
  readonly platform: string;
  
  /**
   * 当前状态
   */
  readonly status: AdapterStatus;
  
  /**
   * 当前配置
   */
  readonly config: AdapterConfig;
  
  /**
   * 初始化适配器
   * @param config 适配器配置
   */
  initialize(config: AdapterConfig): Promise<void>;
  
  /**
   * 验证配置是否有效
   * @param config 待验证的配置
   */
  validateConfig(config: AdapterConfig): Promise<boolean>;
  
  /**
   * 测试连接（验证认证信息）
   */
  testConnection(): Promise<{ success: boolean; message?: string }>;
  
  /**
   * 获取提及数据
   * @param options 获取选项
   */
  fetch(options?: FetchOptions): Promise<FetchResult>;
  
  /**
   * 获取单条提及详情
   * @param externalId 平台外部ID
   */
  fetchById(externalId: string): Promise<UnifiedMention | null>;
  
  /**
   * 转换原始数据为统一格式
   * @param raw 平台原始数据
   */
  transform(raw: any): UnifiedMention | null;
  
  /**
   * 批量转换
   * @param rawItems 原始数据数组
   */
  transformBatch(rawItems: any[]): UnifiedMention[];
  
  /**
   * 获取适配器指标
   */
  getMetrics(): AdapterMetrics;
  
  /**
   * 重置指标
   */
  resetMetrics(): void;
  
  /**
   * 暂停适配器
   */
  pause(): Promise<void>;
  
  /**
   * 恢复适配器
   */
  resume(): Promise<void>;
  
  /**
   * 禁用适配器
   */
  disable(): Promise<void>;
  
  /**
   * 启用适配器
   */
  enable(): Promise<void>;
  
  /**
   * 更新配置
   * @param config 新配置（部分更新）
   */
  updateConfig(config: Partial<AdapterConfig>): Promise<void>;
  
  /**
   * 释放资源
   */
  dispose(): Promise<void>;
  
  /**
   * 处理错误
   * @param error 原始错误
   * @param context 错误上下文
   */
  handleError(error: Error, context?: Record<string, any>): { category: ErrorCategory; retryable: boolean };
}

/**
 * 可刷新的适配器接口（支持 Token 刷新）
 */
export interface IRefreshableAdapter extends IAdapter {
  /**
   * 是否需要刷新
   */
  needsRefresh(): boolean;
  
  /**
   * 刷新认证信息
   */
  refreshAuth(): Promise<void>;
  
  /**
   * 获取当前认证状态
   */
  getAuthStatus(): {
    authenticated: boolean;
    expiresAt?: Date;
    scopes?: string[];
  };
}

/**
 * 支持实时推送的适配器接口
 */
export interface IStreamingAdapter extends IAdapter {
  /**
   * 是否支持实时推送
   */
  supportsStreaming(): boolean;
  
  /**
   * 开始监听
   * @param callback 数据回调
   */
  startStreaming(callback: (mention: UnifiedMention) => void): Promise<void>;
  
  /**
   * 停止监听
   */
  stopStreaming(): Promise<void>;
  
  /**
   * 是否正在监听
   */
  isStreaming(): boolean;
}

/**
 * 支持 Webhook 的适配器接口
 */
export interface IWebhookAdapter extends IAdapter {
  /**
   * 获取 Webhook 配置
   */
  getWebhookConfig(): {
    path: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    verifySignature?: boolean;
    secret?: string;
  };
  
  /**
   * 验证 Webhook 签名
   * @param payload 请求体
   * @param signature 签名
   * @param secret 密钥
   */
  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean;
  
  /**
   * 处理 Webhook 请求
   * @param payload 请求数据
   */
  handleWebhook(payload: any): Promise<UnifiedMention | null>;
}

/**
 * 适配器构造函数类型
 */
export type AdapterConstructor = new (...args: any[]) => IAdapter;

/**
 * 适配器工厂接口
 */
export interface IAdapterFactory {
  /**
   * 创建适配器实例
   * @param platform 平台类型
   * @param config 适配器配置
   */
  create(platform: string, config: AdapterConfig): Promise<IAdapter>;
  
  /**
   * 注册适配器类型
   * @param platform 平台标识
   * @param constructor 适配器构造函数
   */
  register(platform: string, constructor: AdapterConstructor): void;
  
  /**
   * 检查是否支持某平台
   * @param platform 平台标识
   */
  supports(platform: string): boolean;
  
  /**
   * 获取支持的平台列表
   */
  getSupportedPlatforms(): string[];
}

/**
 * 适配器装饰器接口 - 用于增强适配器功能
 */
export interface IAdapterDecorator {
  /**
   * 装饰适配器
   * @param adapter 原始适配器
   */
  decorate(adapter: IAdapter): IAdapter;
}

/**
 * 适配器生命周期钩子
 */
export interface IAdapterLifecycleHooks {
  /**
   * 初始化前调用
   */
  beforeInitialize?(config: AdapterConfig): Promise<void>;
  
  /**
   * 初始化后调用
   */
  afterInitialize?(): Promise<void>;
  
  /**
   * 获取数据前调用
   */
  beforeFetch?(options: FetchOptions): Promise<void>;
  
  /**
   * 获取数据后调用
   */
  afterFetch?(result: FetchResult): Promise<void>;
  
  /**
   * 释放资源前调用
   */
  beforeDispose?(): Promise<void>;
  
  /**
   * 配置更新时调用
   */
  onConfigUpdate?(config: Partial<AdapterConfig>): Promise<void>;
  
  /**
   * 发生错误时调用
   */
  onError?(error: Error, context: Record<string, any>): Promise<void>;
}

/**
 * 适配器能力描述
 */
export interface IAdapterCapabilities {
  /**
   * 支持的操作
   */
  operations: {
    fetch: boolean;
    fetchById: boolean;
    streaming: boolean;
    webhook: boolean;
    historical: boolean;
    realtime: boolean;
  };
  
  /**
   * 支持的认证方式
   */
  authMethods: string[];
  
  /**
   * 默认限流配置
   */
  defaultRateLimit: {
    requestsPerWindow: number;
    windowSizeMs: number;
  };
  
  /**
   * 数据限制
   */
  limitations: {
    maxHistoricalDays?: number;
    maxResultsPerRequest?: number;
    minRequestIntervalMs?: number;
  };
  
  /**
   * 获取能力描述
   */
  getCapabilities(): Record<string, any>;
}

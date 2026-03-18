/**
 * 任务类型枚举
 * 定义了系统中所有支持的异步任务类型
 */
export enum TaskType {
  // ==================== 实时抓取任务 ====================
  /** 实时抓取 - 最高优先级，用于即时数据更新 */
  REALTIME_FETCH = 'realtime-fetch',
  
  /** Webhook 触发抓取 - 由外部事件触发 */
  WEBHOOK_FETCH = 'webhook-fetch',
  
  // ==================== 定时抓取任务 ====================
  /** 定时抓取 - 周期性执行的数据抓取 */
  SCHEDULED_FETCH = 'scheduled-fetch',
  
  /** 增量抓取 - 只抓取最新数据 */
  INCREMENTAL_FETCH = 'incremental-fetch',
  
  // ==================== 批量任务 ====================
  /** 批量抓取 - 大量数据的批量处理 */
  BATCH_FETCH = 'batch-fetch',
  
  /** 历史数据抓取 - 抓取历史数据，优先级较低 */
  HISTORICAL_FETCH = 'historical-fetch',
  
  /** 全量同步 - 完整数据同步 */
  FULL_SYNC = 'full-sync',
  
  // ==================== 数据处理任务 ====================
  /** 数据清洗 - 清理和规范化数据 */
  DATA_CLEANUP = 'data-cleanup',
  
  /** 数据迁移 - 数据迁移任务 */
  DATA_MIGRATION = 'data-migration',
  
  // ==================== 分析任务 ====================
  /** 情感分析 - 对内容进行情感分析 */
  SENTIMENT_ANALYSIS = 'sentiment-analysis',
  
  /** 趋势分析 - 分析数据趋势 */
  TREND_ANALYSIS = 'trend-analysis',
  
  /** 生成报告 - 生成分析报告 */
  GENERATE_REPORT = 'generate-report',
  
  // ==================== 通知任务 ====================
  /** 邮件通知 */
  EMAIL_NOTIFICATION = 'email-notification',
  
  /** Webhook 通知 */
  WEBHOOK_NOTIFICATION = 'webhook-notification',
  
  /** 站内通知 */
  IN_APP_NOTIFICATION = 'in-app-notification',
}

/**
 * 任务优先级枚举
 * 数值越大优先级越高
 */
export enum TaskPriority {
  /** 最低优先级 - 后台任务 */
  LOWEST = 1,
  
  /** 低优先级 - 批量任务 */
  LOW = 2,
  
  /** 中等优先级 - 分析任务 */
  NORMAL = 3,
  
  /** 高优先级 - 定时抓取 */
  HIGH = 6,
  
  /** 最高优先级 - 实时任务 */
  HIGHEST = 10,
  
  /** 紧急优先级 - 关键业务 */
  CRITICAL = 15,
}

/**
 * 任务状态枚举
 */
export enum TaskStatus {
  /** 等待中 */
  PENDING = 'pending',
  
  /** 处理中 */
  PROCESSING = 'processing',
  
  /** 已完成 */
  COMPLETED = 'completed',
  
  /** 失败 */
  FAILED = 'failed',
  
  /** 重试中 */
  RETRYING = 'retrying',
  
  /** 已取消 */
  CANCELLED = 'cancelled',
  
  /** 已超时 */
  TIMEOUT = 'timeout',
  
  /** 进入死信队列 */
  DEAD_LETTER = 'dead-letter',
}

/**
 * 平台类型枚举
 */
export enum PlatformType {
  GITHUB = 'github',
  PRODUCTHUNT = 'producthunt',
  CHROME_WEBSTORE = 'chromewebstore',
  TWITTER = 'twitter',
  REDDIT = 'reddit',
  HACKERNEWS = 'hackernews',
}

/**
 * 错误分类枚举
 */
export enum ErrorCategory {
  /** 网络错误 - 可重试 */
  NETWORK_ERROR = 'network_error',
  
  /** API 限流 - 可重试，需等待 */
  RATE_LIMITED = 'rate_limited',
  
  /** 服务端错误 - 可重试 */
  SERVER_ERROR = 'server_error',
  
  /** 客户端错误 - 不可重试 */
  CLIENT_ERROR = 'client_error',
  
  /** 业务逻辑错误 - 不可重试 */
  BUSINESS_ERROR = 'business_error',
  
  /** 超时错误 - 可重试 */
  TIMEOUT_ERROR = 'timeout_error',
  
  /** 未知错误 */
  UNKNOWN_ERROR = 'unknown_error',
}

/**
 * 队列名称枚举
 */
export enum QueueName {
  /** 默认队列 */
  DEFAULT = 'default',
  
  /** 抓取队列 */
  FETCHER = 'fetcher',
  
  /** 高优先级队列 */
  HIGH_PRIORITY = 'high-priority',
  
  /** 低优先级队列 */
  LOW_PRIORITY = 'low-priority',
  
  /** 通知队列 */
  NOTIFICATION = 'notification',
  
  /** 分析队列 */
  ANALYSIS = 'analysis',
  
  /** 死信队列 */
  DEAD_LETTER = 'dead-letter',
  
  /** 重试队列 */
  RETRY = 'retry',
}

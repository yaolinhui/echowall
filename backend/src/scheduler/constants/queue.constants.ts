import { TaskConfig } from '../interfaces/task.interface';
import { TaskPriority } from '../enums/task-type.enum';

/**
 * 队列名称常量
 */
export const QUEUE_NAMES = {
  FETCHER: 'fetcher',
  HIGH_PRIORITY: 'high-priority',
  LOW_PRIORITY: 'low-priority',
  NOTIFICATION: 'notification',
  ANALYSIS: 'analysis',
  DEAD_LETTER: 'dead-letter',
  RETRY: 'retry',
  SCHEDULED: 'scheduled',
} as const;

/**
 * 任务处理器名称
 */
export const PROCESSOR_NAMES = {
  FETCH_SOURCE: 'fetch-source',
  BATCH_FETCH: 'batch-fetch',
  REALTIME_FETCH: 'realtime-fetch',
  ANALYZE_SENTIMENT: 'analyze-sentiment',
  GENERATE_REPORT: 'generate-report',
  SEND_NOTIFICATION: 'send-notification',
  PROCESS_DEAD_LETTER: 'process-dead-letter',
  HANDLE_RETRY: 'handle-retry',
  DATA_CLEANUP: 'data-cleanup',
} as const;

/**
 * 任务事件名称
 */
export const TASK_EVENTS = {
  // 任务生命周期事件
  TASK_CREATED: 'task:created',
  TASK_STARTED: 'task:started',
  TASK_COMPLETED: 'task:completed',
  TASK_FAILED: 'task:failed',
  TASK_RETRYING: 'task:retrying',
  TASK_CANCELLED: 'task:cancelled',
  TASK_TIMEOUT: 'task:timeout',
  TASK_STALLED: 'task:stalled',
  
  // 队列事件
  QUEUE_PAUSED: 'queue:paused',
  QUEUE_RESUMED: 'queue:resumed',
  QUEUE_CLEANED: 'queue:cleaned',
  
  // 死信事件
  DEAD_LETTER_RECEIVED: 'dead-letter:received',
  DEAD_LETTER_PROCESSED: 'dead-letter:processed',
  
  // 监控事件
  METRICS_COLLECTED: 'metrics:collected',
  ALERT_TRIGGERED: 'alert:triggered',
} as const;

/**
 * 默认任务配置
 */
export const DEFAULT_TASK_CONFIG: TaskConfig = {
  maxRetries: 3,
  baseRetryDelay: 1000,
  maxRetryDelay: 60000,
  timeout: 120000,
  concurrency: 3,
  enableDeadLetter: true,
  deadLetterMaxRetries: 3,
  deduplicationWindow: 60000,
  lockTTL: 30000,
};

/**
 * 任务类型默认配置映射
 */
export const TASK_TYPE_CONFIG: Record<string, Partial<TaskConfig>> = {
  'realtime-fetch': {
    maxRetries: 5,
    baseRetryDelay: 500,
    maxRetryDelay: 30000,
    timeout: 60000,
    concurrency: 5,
    lockTTL: 30000,
  },
  'scheduled-fetch': {
    maxRetries: 3,
    baseRetryDelay: 2000,
    maxRetryDelay: 60000,
    timeout: 120000,
    concurrency: 3,
    lockTTL: 60000,
  },
  'batch-fetch': {
    maxRetries: 3,
    baseRetryDelay: 5000,
    maxRetryDelay: 300000,
    timeout: 300000,
    concurrency: 2,
    lockTTL: 300000,
  },
  'historical-fetch': {
    maxRetries: 2,
    baseRetryDelay: 10000,
    maxRetryDelay: 600000,
    timeout: 600000,
    concurrency: 1,
    lockTTL: 600000,
  },
  'sentiment-analysis': {
    maxRetries: 2,
    baseRetryDelay: 1000,
    maxRetryDelay: 30000,
    timeout: 300000,
    concurrency: 2,
    lockTTL: 60000,
  },
  'notification': {
    maxRetries: 3,
    baseRetryDelay: 1000,
    maxRetryDelay: 30000,
    timeout: 30000,
    concurrency: 10,
    lockTTL: 30000,
  },
};

/**
 * 任务类型优先级映射
 */
export const TASK_TYPE_PRIORITY: Record<string, TaskPriority> = {
  'realtime-fetch': TaskPriority.HIGHEST,
  'webhook-fetch': TaskPriority.HIGHEST,
  'notification': TaskPriority.HIGH,
  'scheduled-fetch': TaskPriority.HIGH,
  'incremental-fetch': TaskPriority.NORMAL,
  'data-cleanup': TaskPriority.NORMAL,
  'sentiment-analysis': TaskPriority.LOW,
  'batch-fetch': TaskPriority.LOW,
  'trend-analysis': TaskPriority.LOW,
  'historical-fetch': TaskPriority.LOWEST,
  'full-sync': TaskPriority.LOWEST,
  'generate-report': TaskPriority.LOWEST,
};

/**
 * Redis 键前缀
 */
export const REDIS_KEY_PREFIXES = {
  TASK_LOCK: 'task:lock:',
  TASK_DEDUP: 'task:dedup:',
  TASK_PROGRESS: 'task:progress:',
  TASK_STATS: 'task:stats:',
  WORKER_LOCK: 'worker:lock:',
  CIRCUIT_BREAKER: 'circuit:breaker:',
  RATE_LIMITER: 'rate:limiter:',
  METRICS: 'metrics:',
} as const;

/**
 * 监控指标名称
 */
export const METRIC_NAMES = {
  // 队列指标
  QUEUE_DEPTH: 'queue_depth',
  QUEUE_ACTIVE: 'queue_active',
  QUEUE_COMPLETED: 'queue_completed',
  QUEUE_FAILED: 'queue_failed',
  QUEUE_DELAYED: 'queue_delayed',
  
  // 性能指标
  TASK_DURATION: 'task_duration',
  TASK_QUEUE_TIME: 'task_queue_time',
  TASK_PROCESSING_TIME: 'task_processing_time',
  
  // 成功率指标
  TASK_SUCCESS_RATE: 'task_success_rate',
  TASK_ERROR_RATE: 'task_error_rate',
  TASK_RETRY_RATE: 'task_retry_rate',
  
  // 业务指标
  ITEMS_PROCESSED: 'items_processed',
  API_CALLS: 'api_calls',
  RATE_LIMIT_HITS: 'rate_limit_hits',
} as const;

/**
 * HTTP 状态码重试映射
 */
export const HTTP_RETRY_MAP: Record<number, { retryable: boolean; delay?: number }> = {
  429: { retryable: true, delay: 60000 }, // Too Many Requests
  500: { retryable: true, delay: 5000 },  // Internal Server Error
  502: { retryable: true, delay: 5000 },  // Bad Gateway
  503: { retryable: true, delay: 30000 }, // Service Unavailable
  504: { retryable: true, delay: 5000 },  // Gateway Timeout
  400: { retryable: false },              // Bad Request
  401: { retryable: false },              // Unauthorized
  403: { retryable: false },              // Forbidden
  404: { retryable: false },              // Not Found
};

/**
 * 错误模式匹配
 */
export const ERROR_PATTERNS = {
  NETWORK_ERRORS: [
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'EAI_AGAIN',
    'ECONNABORTED',
    'socket hang up',
    'network timeout',
  ],
  RATE_LIMIT_ERRORS: [
    'rate limit',
    'too many requests',
    'quota exceeded',
    'EAPI:Rate limit exceeded',
    'API rate limit exceeded',
  ],
  TIMEOUT_ERRORS: [
    'timeout',
    'ETIMEDOUT',
    'request timeout',
    'operation timeout',
    'deadline exceeded',
  ],
} as const;

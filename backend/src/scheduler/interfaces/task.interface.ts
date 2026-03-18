import { TaskType, TaskPriority, TaskStatus, PlatformType } from '../enums/task-type.enum';

/**
 * 基础任务数据接口
 */
export interface BaseTaskData {
  /** 任务唯一标识 */
  taskId: string;
  
  /** 任务类型 */
  taskType: TaskType;
  
  /** 优先级 */
  priority?: TaskPriority;
  
  /** 创建时间 */
  createdAt: Date;
  
  /** 任务创建者 */
  createdBy?: string;
  
  /** 跟踪 ID */
  traceId: string;
  
  /** 父任务 ID */
  parentTaskId?: string;
  
  /** 任务标签 */
  tags?: string[];
  
  /** 元数据 */
  metadata?: Record<string, any>;
}

/**
 * 抓取任务数据
 */
export interface FetchTaskData extends BaseTaskData {
  /** 数据源 ID */
  sourceId: string;
  
  /** 平台类型 */
  platform: PlatformType;
  
  /** 抓取配置 */
  config: Record<string, any>;
  
  /** 是否增量抓取 */
  incremental?: boolean;
  
  /** 时间范围开始 */
  since?: Date;
  
  /** 时间范围结束 */
  until?: Date;
  
  /** 最大抓取数量 */
  limit?: number;
  
  /** 项目 ID */
  projectId: string;
}

/**
 * 批量抓取任务数据
 */
export interface BatchFetchTaskData extends BaseTaskData {
  /** 数据源 ID 列表 */
  sourceIds: string[];
  
  /** 是否并行处理 */
  parallel?: boolean;
  
  /** 并发数 */
  concurrency?: number;
  
  /** 批量大小 */
  batchSize?: number;
}

/**
 * 分析任务数据
 */
export interface AnalysisTaskData extends BaseTaskData {
  /** 分析类型 */
  analysisType: 'sentiment' | 'trend' | 'report';
  
  /** 项目 ID */
  projectId: string;
  
  /** 提及 ID 列表 */
  mentionIds?: string[];
  
  /** 时间范围 */
  dateRange?: {
    start: Date;
    end: Date;
  };
  
  /** 分析参数 */
  parameters?: Record<string, any>;
}

/**
 * 通知任务数据
 */
export interface NotificationTaskData extends BaseTaskData {
  /** 通知类型 */
  notificationType: 'email' | 'webhook' | 'in-app';
  
  /** 收件人 */
  recipients: string[];
  
  /** 通知标题 */
  subject: string;
  
  /** 通知内容 */
  content: string;
  
  /** 模板 ID */
  templateId?: string;
  
  /** 模板变量 */
  templateData?: Record<string, any>;
  
  /** 附件 */
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
  }>;
}

/**
 * 任务执行结果
 */
export interface TaskResult {
  /** 是否成功 */
  success: boolean;
  
  /** 结果数据 */
  data?: any;
  
  /** 错误信息 */
  error?: TaskError;
  
  /** 执行统计 */
  stats: TaskExecutionStats;
}

/**
 * 任务错误信息
 */
export interface TaskError {
  /** 错误类型 */
  type: string;
  
  /** 错误消息 */
  message: string;
  
  /** 错误码 */
  code?: string;
  
  /** 堆栈跟踪 */
  stack?: string;
  
  /** HTTP 状态码 */
  statusCode?: number;
  
  /** 错误分类 */
  category?: string;
  
  /** 是否可重试 */
  retryable: boolean;
  
  /** 建议重试延迟 */
  retryDelay?: number;
}

/**
 * 任务执行统计
 */
export interface TaskExecutionStats {
  /** 排队时间 (ms) */
  queueTime: number;
  
  /** 处理时间 (ms) */
  processingTime: number;
  
  /** 总时间 (ms) */
  totalTime: number;
  
  /** 重试次数 */
  retryCount: number;
  
  /** 内存使用 */
  memoryUsage?: number;
  
  /** 处理的数据量 */
  itemsProcessed?: number;
}

/**
 * 任务配置
 */
export interface TaskConfig {
  /** 最大重试次数 */
  maxRetries: number;
  
  /** 基础重试延迟 (ms) */
  baseRetryDelay: number;
  
  /** 最大重试延迟 (ms) */
  maxRetryDelay: number;
  
  /** 超时时间 (ms) */
  timeout: number;
  
  /** 并发数 */
  concurrency: number;
  
  /** 限速 (每秒任务数) */
  rateLimit?: number;
  
  /** 是否启用死信队列 */
  enableDeadLetter: boolean;
  
  /** 死信队列最大重试次数 */
  deadLetterMaxRetries?: number;
  
  /** 任务去重时间窗口 (ms) */
  deduplicationWindow?: number;
  
  /** 任务锁超时时间 (ms) */
  lockTTL: number;
}

/**
 * 死信消息
 */
export interface DeadLetterMessage {
  /** 原始任务数据 */
  originalJob: {
    id: string | number;
    data: any;
    opts: any;
    attemptsMade: number;
  };
  
  /** 失败原因 */
  failedReason: string;
  
  /** 失败统计 */
  failureStats: {
    attemptCount: number;
    firstFailedAt: Date;
    lastFailedAt: Date;
    errorTypes: string[];
  };
  
  /** 上下文信息 */
  context: {
    workerId: string;
    timestamp: Date;
    stackTrace?: string;
    previousErrors?: TaskError[];
  };
  
  /** 元数据 */
  metadata: {
    queueName: string;
    jobId: string | number;
    enqueuedAt: Date;
    processedAt?: Date;
  };
}

/**
 * 队列状态
 */
export interface QueueStatus {
  /** 队列名称 */
  name: string;
  
  /** 等待中 */
  waiting: number;
  
  /** 活跃中 */
  active: number;
  
  /** 已完成 */
  completed: number;
  
  /** 失败 */
  failed: number;
  
  /** 延迟 */
  delayed: number;
  
  /** 暂停 */
  paused: number;
  
  /** 最后更新时间 */
  lastUpdated: Date;
}

/**
 * 任务进度
 */
export interface TaskProgress {
  /** 任务 ID */
  taskId: string;
  
  /** 当前进度 (0-100) */
  progress: number;
  
  /** 已处理数量 */
  processed: number;
  
  /** 总数量 */
  total: number;
  
  /** 阶段描述 */
  stage: string;
  
  /** 预计剩余时间 (秒) */
  eta?: number;
  
  /** 更新时间 */
  updatedAt: Date;
}

/**
 * 重试决策
 */
export interface RetryDecision {
  /** 是否重试 */
  shouldRetry: boolean;
  
  /** 重试延迟 (ms) */
  delay: number;
  
  /** 优先级调整 */
  priority?: TaskPriority;
  
  /** 错误分类 */
  errorCategory?: string;
}

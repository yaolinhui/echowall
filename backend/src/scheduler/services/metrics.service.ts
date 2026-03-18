import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import Redis from 'ioredis';
import {
  METRIC_NAMES,
  REDIS_KEY_PREFIXES,
  TASK_EVENTS,
  QUEUE_NAMES,
} from '../constants/queue.constants';
import { QueueStatus, TaskExecutionStats } from '../interfaces/task.interface';

/**
 * 指标数据点
 */
export interface MetricDataPoint {
  timestamp: number;
  value: number;
  labels?: Record<string, string>;
}

/**
 * 指标序列
 */
export interface MetricSeries {
  name: string;
  help: string;
  type: 'gauge' | 'counter' | 'histogram';
  data: MetricDataPoint[];
}

/**
 * 告警规则
 */
export interface AlertRule {
  name: string;
  metric: string;
  condition: 'gt' | 'lt' | 'eq';
  threshold: number;
  duration: number;
  severity: 'warning' | 'critical';
  message: string;
}

/**
 * 告警事件
 */
export interface AlertEvent {
  rule: AlertRule;
  value: number;
  timestamp: Date;
  context: Record<string, any>;
}

/**
 * 监控和指标服务
 * 
 * 提供：
 * - 队列状态监控
 * - 任务执行指标收集
 * - 性能指标统计
 * - 告警规则管理
 * - 历史数据存储
 */
@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly logger = new Logger(MetricsService.name);
  private readonly redis: Redis;
  private readonly metrics: Map<string, MetricSeries> = new Map();
  private readonly alertRules: AlertRule[] = [];
  private readonly alertStates: Map<string, { triggered: boolean; since: number }> = new Map();
  
  // 配置
  private readonly retentionDays: number;
  private readonly alertCheckInterval: number;
  private alertCheckTimer?: NodeJS.Timeout;

  constructor(
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
    @InjectQueue(QUEUE_NAMES.FETCHER) private fetcherQueue: Queue,
    @InjectQueue(QUEUE_NAMES.HIGH_PRIORITY) private highPriorityQueue: Queue,
    @InjectQueue(QUEUE_NAMES.LOW_PRIORITY) private lowPriorityQueue: Queue,
    @InjectQueue(QUEUE_NAMES.NOTIFICATION) private notificationQueue: Queue,
  ) {
    this.redis = new Redis({
      host: this.configService.get('redis.host', 'localhost'),
      port: this.configService.get('redis.port', 6379),
    });
    
    this.retentionDays = this.configService.get('scheduler.metrics.retentionDays', 7);
    this.alertCheckInterval = this.configService.get('scheduler.metrics.alertCheckInterval', 60000);
    
    // 初始化指标
    this.initializeMetrics();
    
    // 注册默认告警规则
    this.registerDefaultAlertRules();
  }

  async onModuleInit(): Promise<void> {
    // 启动告警检查
    this.startAlertChecking();
    
    this.logger.log('MetricsService initialized');
  }

  /**
   * 获取队列状态
   */
  async getQueueStatus(queueName?: string): Promise<QueueStatus | QueueStatus[]> {
    if (queueName) {
      const queue = this.getQueueByName(queueName);
      return this.fetchQueueStatus(queue, queueName);
    }
    
    // 获取所有队列状态
    const queues = [
      { queue: this.fetcherQueue, name: QUEUE_NAMES.FETCHER },
      { queue: this.highPriorityQueue, name: QUEUE_NAMES.HIGH_PRIORITY },
      { queue: this.lowPriorityQueue, name: QUEUE_NAMES.LOW_PRIORITY },
      { queue: this.notificationQueue, name: QUEUE_NAMES.NOTIFICATION },
    ];
    
    return Promise.all(
      queues.map(({ queue, name }) => this.fetchQueueStatus(queue, name))
    );
  }

  /**
   * 记录任务指标
   */
  async recordTaskMetrics(
    taskType: string,
    stats: TaskExecutionStats,
    success: boolean
  ): Promise<void> {
    const timestamp = Date.now();
    const labels = { taskType };
    
    // 记录处理时间
    await this.recordMetric(
      METRIC_NAMES.TASK_PROCESSING_TIME,
      stats.processingTime,
      labels,
      timestamp
    );
    
    // 记录排队时间
    await this.recordMetric(
      METRIC_NAMES.TASK_QUEUE_TIME,
      stats.queueTime,
      labels,
      timestamp
    );
    
    // 记录总时间
    await this.recordMetric(
      METRIC_NAMES.TASK_DURATION,
      stats.totalTime,
      labels,
      timestamp
    );
    
    // 记录成功率
    const successValue = success ? 1 : 0;
    await this.recordMetric(
      METRIC_NAMES.TASK_SUCCESS_RATE,
      successValue,
      labels,
      timestamp
    );
    
    // 记录重试率
    const retryValue = stats.retryCount > 0 ? 1 : 0;
    await this.recordMetric(
      METRIC_NAMES.TASK_RETRY_RATE,
      retryValue,
      labels,
      timestamp
    );
    
    // 存储到 Redis 时间序列
    await this.storeMetricToRedis(taskType, stats, success);
    
    // 触发指标收集事件
    this.eventEmitter.emit(TASK_EVENTS.METRICS_COLLECTED, {
      taskType,
      stats,
      success,
      timestamp,
    });
  }

  /**
   * 记录业务指标
   */
  async recordBusinessMetrics(
    metricName: string,
    value: number,
    labels?: Record<string, string>
  ): Promise<void> {
    await this.recordMetric(metricName, value, labels);
  }

  /**
   * 获取任务执行统计
   */
  async getTaskStats(
    taskType: string,
    timeRange: '1h' | '24h' | '7d' | '30d' = '24h'
  ): Promise<{
    total: number;
    success: number;
    failed: number;
    avgDuration: number;
    avgQueueTime: number;
  }> {
    const rangeMs = this.parseTimeRange(timeRange);
    const cutoff = Date.now() - rangeMs;
    
    const key = `${REDIS_KEY_PREFIXES.TASK_STATS}${taskType}`;
    const entries = await this.redis.zrangebyscore(key, cutoff, '+inf');
    
    let total = 0;
    let success = 0;
    let totalDuration = 0;
    let totalQueueTime = 0;
    
    for (const entry of entries) {
      const data = JSON.parse(entry);
      total++;
      if (data.success) success++;
      totalDuration += data.duration;
      totalQueueTime += data.queueTime;
    }
    
    return {
      total,
      success,
      failed: total - success,
      avgDuration: total > 0 ? totalDuration / total : 0,
      avgQueueTime: total > 0 ? totalQueueTime / total : 0,
    };
  }

  /**
   * 获取指标数据
   */
  getMetric(name: string): MetricSeries | undefined {
    return this.metrics.get(name);
  }

  /**
   * 获取所有指标
   */
  getAllMetrics(): MetricSeries[] {
    return Array.from(this.metrics.values());
  }

  /**
   * 注册告警规则
   */
  registerAlertRule(rule: AlertRule): void {
    this.alertRules.push(rule);
    this.logger.log(`Registered alert rule: ${rule.name}`);
  }

  /**
   * 获取 Prometheus 格式的指标
   */
  getPrometheusMetrics(): string {
    const lines: string[] = [];
    
    for (const series of this.metrics.values()) {
      lines.push(`# HELP ${series.name} ${series.help}`);
      lines.push(`# TYPE ${series.name} ${series.type}`);
      
      for (const point of series.data.slice(-100)) { // 只输出最近 100 个点
        const labels = point.labels
          ? Object.entries(point.labels)
              .map(([k, v]) => `${k}="${v}"`)
              .join(',')
          : '';
        const labelStr = labels ? `{${labels}}` : '';
        lines.push(`${series.name}${labelStr} ${point.value} ${point.timestamp}`);
      }
      
      lines.push('');
    }
    
    return lines.join('\n');
  }

  /**
   * 获取队列深度（用于告警）
   */
  private async getQueueDepth(): Promise<number> {
    const statuses = await this.getQueueStatus() as QueueStatus[];
    return statuses.reduce((sum, s) => sum + s.waiting, 0);
  }

  /**
   * 获取错误率
   */
  async getErrorRate(timeRange: '1h' | '24h' = '1h'): Promise<number> {
    const rangeMs = this.parseTimeRange(timeRange);
    const cutoff = Date.now() - rangeMs;
    
    const pattern = `${REDIS_KEY_PREFIXES.TASK_STATS}*`;
    const keys = await this.redis.keys(pattern);
    
    let total = 0;
    let failed = 0;
    
    for (const key of keys) {
      const entries = await this.redis.zrangebyscore(key, cutoff, '+inf');
      for (const entry of entries) {
        const data = JSON.parse(entry);
        total++;
        if (!data.success) failed++;
      }
    }
    
    return total > 0 ? (failed / total) * 100 : 0;
  }

  // ==================== 私有方法 ====================

  private async fetchQueueStatus(queue: Queue, name: string): Promise<QueueStatus> {
    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.isPaused(),
    ]);
    
    return {
      name,
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused: paused ? 1 : 0,
      lastUpdated: new Date(),
    };
  }

  private getQueueByName(name: string): Queue {
    switch (name) {
      case QUEUE_NAMES.FETCHER:
        return this.fetcherQueue;
      case QUEUE_NAMES.HIGH_PRIORITY:
        return this.highPriorityQueue;
      case QUEUE_NAMES.LOW_PRIORITY:
        return this.lowPriorityQueue;
      case QUEUE_NAMES.NOTIFICATION:
        return this.notificationQueue;
      default:
        throw new Error(`Unknown queue: ${name}`);
    }
  }

  private initializeMetrics(): void {
    // 初始化队列深度指标
    this.metrics.set(METRIC_NAMES.QUEUE_DEPTH, {
      name: METRIC_NAMES.QUEUE_DEPTH,
      help: 'Current depth of the queue',
      type: 'gauge',
      data: [],
    });
    
    // 初始化任务处理时间指标
    this.metrics.set(METRIC_NAMES.TASK_PROCESSING_TIME, {
      name: METRIC_NAMES.TASK_PROCESSING_TIME,
      help: 'Task processing time in milliseconds',
      type: 'histogram',
      data: [],
    });
    
    // 初始化成功率指标
    this.metrics.set(METRIC_NAMES.TASK_SUCCESS_RATE, {
      name: METRIC_NAMES.TASK_SUCCESS_RATE,
      help: 'Task success rate',
      type: 'gauge',
      data: [],
    });
  }

  private async recordMetric(
    name: string,
    value: number,
    labels?: Record<string, string>,
    timestamp?: number
  ): Promise<void> {
    const series = this.metrics.get(name);
    if (series) {
      series.data.push({
        timestamp: timestamp || Date.now(),
        value,
        labels,
      });
      
      // 保留最近 10000 个点
      if (series.data.length > 10000) {
        series.data = series.data.slice(-10000);
      }
    }
  }

  private async storeMetricToRedis(
    taskType: string,
    stats: TaskExecutionStats,
    success: boolean
  ): Promise<void> {
    const key = `${REDIS_KEY_PREFIXES.TASK_STATS}${taskType}`;
    const score = Date.now();
    const member = JSON.stringify({
      success,
      duration: stats.processingTime,
      queueTime: stats.queueTime,
      timestamp: score,
    });
    
    // 使用有序集合存储，按时间排序
    await this.redis.zadd(key, score, member);
    
    // 设置过期时间
    const retentionMs = this.retentionDays * 24 * 60 * 60 * 1000;
    await this.redis.pexpire(key, retentionMs);
    
    // 清理过期数据
    const cutoff = Date.now() - retentionMs;
    await this.redis.zremrangebyscore(key, 0, cutoff);
  }

  private registerDefaultAlertRules(): void {
    // 队列深度告警
    this.registerAlertRule({
      name: 'high_queue_depth',
      metric: 'queue_depth',
      condition: 'gt',
      threshold: 1000,
      duration: 5 * 60 * 1000, // 5分钟
      severity: 'warning',
      message: 'Queue depth exceeded 1000 for more than 5 minutes',
    });
    
    // 错误率告警
    this.registerAlertRule({
      name: 'high_error_rate',
      metric: 'error_rate',
      condition: 'gt',
      threshold: 5, // 5%
      duration: 10 * 60 * 1000, // 10分钟
      severity: 'critical',
      message: 'Error rate exceeded 5% for more than 10 minutes',
    });
  }

  private startAlertChecking(): void {
    this.alertCheckTimer = setInterval(async () => {
      await this.checkAlerts();
    }, this.alertCheckInterval);
  }

  private async checkAlerts(): Promise<void> {
    for (const rule of this.alertRules) {
      try {
        let value: number;
        
        switch (rule.metric) {
          case 'queue_depth':
            value = await this.getQueueDepth();
            break;
          case 'error_rate':
            value = await this.getErrorRate();
            break;
          default:
            continue;
        }
        
        const triggered = this.evaluateCondition(value, rule.condition, rule.threshold);
        const state = this.alertStates.get(rule.name);
        
        if (triggered) {
          if (!state || !state.triggered) {
            // 开始计时
            this.alertStates.set(rule.name, { triggered: false, since: Date.now() });
          } else if (!state.triggered) {
            // 检查持续时间
            if (Date.now() - state.since >= rule.duration) {
              state.triggered = true;
              this.triggerAlert(rule, value);
            }
          }
        } else {
          // 清除状态
          if (state?.triggered) {
            this.logger.log(`Alert cleared: ${rule.name}`);
          }
          this.alertStates.delete(rule.name);
        }
      } catch (error) {
        this.logger.error(`Failed to check alert ${rule.name}:`, error);
      }
    }
  }

  private evaluateCondition(value: number, condition: string, threshold: number): boolean {
    switch (condition) {
      case 'gt':
        return value > threshold;
      case 'lt':
        return value < threshold;
      case 'eq':
        return value === threshold;
      default:
        return false;
    }
  }

  private triggerAlert(rule: AlertRule, value: number): void {
    const alert: AlertEvent = {
      rule,
      value,
      timestamp: new Date(),
      context: {
        queueStatus: this.getQueueStatus(),
      },
    };
    
    this.logger.warn(`ALERT [${rule.severity.toUpperCase()}]: ${rule.message} (value: ${value})`);
    
    this.eventEmitter.emit(TASK_EVENTS.ALERT_TRIGGERED, alert);
  }

  private parseTimeRange(range: string): number {
    const match = range.match(/^(\d+)([hd])$/);
    if (!match) return 24 * 60 * 60 * 1000; // 默认24小时
    
    const value = parseInt(match[1], 10);
    const unit = match[2];
    
    if (unit === 'h') {
      return value * 60 * 60 * 1000;
    } else if (unit === 'd') {
      return value * 24 * 60 * 60 * 1000;
    }
    
    return 24 * 60 * 60 * 1000;
  }

  onModuleDestroy(): void {
    if (this.alertCheckTimer) {
      clearInterval(this.alertCheckTimer);
    }
    this.redis.disconnect();
  }
}

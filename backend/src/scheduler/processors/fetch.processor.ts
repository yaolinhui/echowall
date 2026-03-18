import { Processor, Process, OnQueueFailed, OnQueueCompleted, OnQueueStalled } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FetchTaskData, TaskResult, TaskExecutionStats } from '../interfaces/task.interface';
import { PROCESSOR_NAMES, TASK_EVENTS, TASK_TYPE_CONFIG } from '../constants/queue.constants';
import { TaskType, ErrorCategory } from '../enums/task-type.enum';
import { DistributedLockService } from '../services/distributed-lock.service';
import { RetryStrategyService } from '../services/retry-strategy.service';
import { MetricsService } from '../services/metrics.service';

/**
 * 抓取任务处理器
 * 
 * 处理各类抓取任务：
 * - 实时抓取
 * - 定时抓取
 * - 批量抓取
 * - 历史数据抓取
 */
@Processor('fetcher')
@Processor('high-priority')
@Processor('low-priority')
export class FetchProcessor {
  private readonly logger = new Logger(FetchProcessor.name);

  constructor(
    private eventEmitter: EventEmitter2,
    private lockService: DistributedLockService,
    private retryStrategy: RetryStrategyService,
    private metricsService: MetricsService,
  ) {}

  /**
   * 处理抓取任务
   */
  @Process(PROCESSOR_NAMES.FETCH_SOURCE)
  async handleFetchSource(job: Job<FetchTaskData>): Promise<TaskResult> {
    const startTime = Date.now();
    const { data } = job;
    
    this.logger.log(`[${job.id}] Starting fetch task: ${data.taskType} for source ${data.sourceId}`);
    
    // 获取分布式锁，防止同一任务并发执行
    const lock = await this.lockService.acquire(`fetch:${data.sourceId}`, {
      ttl: TASK_TYPE_CONFIG[data.taskType]?.lockTTL || 60000,
      autoRenew: true,
    });
    
    if (!lock) {
      throw new Error(`Failed to acquire lock for source ${data.sourceId}`);
    }

    try {
      // 触发任务开始事件
      this.eventEmitter.emit(TASK_EVENTS.TASK_STARTED, {
        jobId: job.id,
        taskType: data.taskType,
        sourceId: data.sourceId,
      });

      // 根据任务类型调用不同的处理方法
      let result: any;
      
      switch (data.taskType) {
        case TaskType.REALTIME_FETCH:
          result = await this.handleRealtimeFetch(job);
          break;
        case TaskType.SCHEDULED_FETCH:
        case TaskType.INCREMENTAL_FETCH:
          result = await this.handleScheduledFetch(job);
          break;
        case TaskType.HISTORICAL_FETCH:
          result = await this.handleHistoricalFetch(job);
          break;
        default:
          result = await this.handleDefaultFetch(job);
      }

      // 计算执行统计
      const stats = this.calculateStats(job, startTime);
      
      // 记录成功指标
      await this.metricsService.recordTaskMetrics(data.taskType, stats, true);
      
      this.logger.log(`[${job.id}] Fetch task completed: ${data.taskType}, processed ${result.count || 0} items`);
      
      return {
        success: true,
        data: result,
        stats,
      };
    } catch (error) {
      // 计算执行统计
      const stats = this.calculateStats(job, startTime);
      
      // 记录失败指标
      await this.metricsService.recordTaskMetrics(data.taskType, stats, false);
      
      // 处理错误，判断是否需要重试
      const retryDecision = await this.retryStrategy.shouldRetry(
        error,
        job.attemptsMade,
        job.opts.attempts || 3,
        data.taskType
      );
      
      if (!retryDecision.shouldRetry) {
        this.logger.error(`[${job.id}] Fetch task failed permanently: ${error.message}`);
        // 发送到死信队列
        await this.sendToDeadLetter(job, error);
      }
      
      throw error;
    } finally {
      await lock.release();
    }
  }

  /**
   * 处理实时抓取
   */
  private async handleRealtimeFetch(job: Job<FetchTaskData>): Promise<any> {
    const { data } = job;
    
    // 模拟实时抓取逻辑
    this.logger.debug(`[${job.id}] Realtime fetch for ${data.sourceId}`);
    
    // 更新进度
    await job.progress(10);
    
    // 执行抓取（这里应该调用实际的抓取服务）
    const result = await this.executeFetch(data);
    
    await job.progress(100);
    
    return result;
  }

  /**
   * 处理定时抓取
   */
  private async handleScheduledFetch(job: Job<FetchTaskData>): Promise<any> {
    const { data } = job;
    
    this.logger.debug(`[${job.id}] Scheduled fetch for ${data.sourceId}`);
    
    // 检查是否已有更新的数据
    if (data.incremental && data.since) {
      // 只抓取增量数据
    }
    
    await job.progress(20);
    
    const result = await this.executeFetch(data);
    
    await job.progress(100);
    
    return result;
  }

  /**
   * 处理历史数据抓取
   */
  private async handleHistoricalFetch(job: Job<FetchTaskData>): Promise<any> {
    const { data } = job;
    
    this.logger.debug(`[${job.id}] Historical fetch for ${data.sourceId}`);
    
    // 历史数据抓取通常数据量较大，需要分批处理
    const batchSize = data.limit || 100;
    let totalFetched = 0;
    let hasMore = true;
    let page = 1;
    
    while (hasMore && totalFetched < batchSize) {
      await job.progress(Math.min((totalFetched / batchSize) * 100, 99));
      
      // 抓取一批数据
      const batchResult = await this.executeFetch(data, { page, limit: 50 });
      
      totalFetched += batchResult.count || 0;
      hasMore = batchResult.hasMore || false;
      page++;
      
      // 添加延迟避免限流
      if (hasMore) {
        await this.sleep(1000);
      }
    }
    
    await job.progress(100);
    
    return { count: totalFetched, pages: page - 1 };
  }

  /**
   * 默认抓取处理
   */
  private async handleDefaultFetch(job: Job<FetchTaskData>): Promise<any> {
    return this.executeFetch(job.data);
  }

  /**
   * 批量抓取任务
   */
  @Process(PROCESSOR_NAMES.BATCH_FETCH)
  async handleBatchFetch(job: Job<any>): Promise<TaskResult> {
    const startTime = Date.now();
    const { sourceIds, parallel = false, concurrency = 3 } = job.data;
    
    this.logger.log(`[${job.id}] Starting batch fetch for ${sourceIds.length} sources`);
    
    const results = [];
    const errors = [];
    
    if (parallel) {
      // 并行处理
      const batches = this.chunkArray(sourceIds, concurrency);
      
      for (const batch of batches) {
        const batchPromises = batch.map(sourceId =>
          this.fetchSingleSource(sourceId).catch(error => {
            errors.push({ sourceId, error: error.message });
            return null;
          })
        );
        
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults.filter(Boolean));
        
        // 更新进度
        await job.progress(Math.min((results.length / sourceIds.length) * 100, 99));
      }
    } else {
      // 串行处理
      for (let i = 0; i < sourceIds.length; i++) {
        try {
          const result = await this.fetchSingleSource(sourceIds[i]);
          results.push(result);
        } catch (error) {
          errors.push({ sourceId: sourceIds[i], error: error.message });
        }
        
        await job.progress(Math.min(((i + 1) / sourceIds.length) * 100, 99));
      }
    }
    
    await job.progress(100);
    
    const stats = this.calculateStats(job, startTime);
    await this.metricsService.recordTaskMetrics(TaskType.BATCH_FETCH, stats, errors.length === 0);
    
    this.logger.log(`[${job.id}] Batch fetch completed: ${results.length} success, ${errors.length} failed`);
    
    return {
      success: errors.length === 0,
      data: { results, errors },
      stats,
    };
  }

  /**
   * 任务失败处理
   */
  @OnQueueFailed()
  async handleFailed(job: Job, error: Error): Promise<void> {
    this.logger.error(`[${job.id}] Job failed:`, error.message);
    
    // 发布任务失败事件
    this.eventEmitter.emit(TASK_EVENTS.TASK_FAILED, {
      jobId: job.id,
      taskType: job.data.taskType,
      error: error.message,
      stack: error.stack,
      attemptsMade: job.attemptsMade,
    });
  }

  /**
   * 任务完成处理
   */
  @OnQueueCompleted()
  handleCompleted(job: Job, result: any): void {
    this.logger.debug(`[${job.id}] Job completed with result:`, result);
  }

  /**
   * 任务停滞处理
   */
  @OnQueueStalled()
  handleStalled(job: Job): void {
    this.logger.warn(`[${job.id}] Job stalled`);
  }

  // ==================== 私有方法 ====================

  /**
   * 执行实际抓取
   */
  private async executeFetch(
    data: FetchTaskData,
    options?: { page?: number; limit?: number }
  ): Promise<any> {
    // 这里应该调用实际的抓取服务
    // 现在用模拟数据演示
    
    // 模拟 API 调用
    await this.sleep(Math.random() * 1000 + 500);
    
    // 模拟随机错误（用于测试重试）
    if (Math.random() < 0.1) {
      const errors = [
        new Error('Network timeout'),
        new Error('ECONNREFUSED'),
        new Error('429 Too Many Requests'),
      ];
      throw errors[Math.floor(Math.random() * errors.length)];
    }
    
    return {
      count: Math.floor(Math.random() * 50) + 10,
      hasMore: Math.random() < 0.3,
      platform: data.platform,
      sourceId: data.sourceId,
    };
  }

  /**
   * 抓取单个数据源
   */
  private async fetchSingleSource(sourceId: string): Promise<any> {
    // 模拟单个数据源抓取
    await this.sleep(Math.random() * 500 + 200);
    
    return {
      sourceId,
      fetched: Math.floor(Math.random() * 20) + 5,
      timestamp: new Date(),
    };
  }

  /**
   * 发送到死信队列
   */
  private async sendToDeadLetter(job: Job, error: Error): Promise<void> {
    // 实际的死信队列处理逻辑在 DlqProcessor 中
    this.eventEmitter.emit(TASK_EVENTS.DEAD_LETTER_RECEIVED, {
      originalJob: {
        id: job.id,
        data: job.data,
        opts: job.opts,
        attemptsMade: job.attemptsMade,
      },
      failedReason: error.message,
      timestamp: new Date(),
    });
  }

  /**
   * 计算执行统计
   */
  private calculateStats(job: Job, startTime: number): TaskExecutionStats {
    const now = Date.now();
    const processingTime = now - startTime;
    const queueTime = startTime - (job.processedOn || startTime);
    
    return {
      queueTime: Math.max(0, queueTime),
      processingTime,
      totalTime: queueTime + processingTime,
      retryCount: job.attemptsMade,
    };
  }

  /**
   * 将数组分块
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * 延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

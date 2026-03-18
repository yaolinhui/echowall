import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeadLetterMessage, TaskResult } from '../interfaces/task.interface';
import { TaskType } from '../enums/task-type.enum';
import { PROCESSOR_NAMES, TASK_EVENTS, QUEUE_NAMES } from '../constants/queue.constants';
import { TaskSchedulerService } from '../services/task-scheduler.service';
import { MetricsService } from '../services/metrics.service';

/**
 * 死信消息实体
 * 用于持久化存储死信消息
 */
export class DeadLetterEntity {
  id: string;
  originalJobId: string | number;
  queueName: string;
  taskType: string;
  failedReason: string;
  attemptCount: number;
  firstFailedAt: Date;
  lastFailedAt: Date;
  errorTypes: string[];
  payload: any;
  metadata: any;
  status: 'pending' | 'processed' | 'archived' | 'manually_resolved';
  resolution?: string;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 死信队列处理器
 * 
 * 功能：
 * - 接收处理失败的消息
 * - 分析失败原因
 * - 尝试自动恢复
 * - 发送告警通知
 * - 持久化存储
 * - 支持手动重试
 */
@Processor(QUEUE_NAMES.DEAD_LETTER)
export class DlqProcessor {
  private readonly logger = new Logger(DlqProcessor.name);
  private readonly errorPatterns: Map<string, number> = new Map();

  constructor(
    private eventEmitter: EventEmitter2,
    private taskScheduler: TaskSchedulerService,
    private metricsService: MetricsService,
  ) {}

  /**
   * 处理死信消息
   */
  @Process(PROCESSOR_NAMES.PROCESS_DEAD_LETTER)
  async handleDeadLetter(job: Job<DeadLetterMessage>): Promise<TaskResult> {
    const { data } = job;
    
    this.logger.warn(
      `[${job.id}] Processing dead letter: ${data.metadata.queueName}/${data.originalJob.id}, ` +
      `failed ${data.failureStats.attemptCount} times, reason: ${data.failedReason}`
    );

    try {
      // 1. 分析失败模式
      await this.analyzeFailurePattern(data);

      // 2. 尝试自动恢复
      const autoRecovered = await this.attemptAutoRecovery(data);
      
      if (autoRecovered) {
        this.logger.log(`[${job.id}] Auto-recovered dead letter: ${data.originalJob.id}`);
        return {
          success: true,
          data: { action: 'auto_recovered' },
          stats: {
            queueTime: 0,
            processingTime: Date.now() - job.timestamp,
            totalTime: Date.now() - job.timestamp,
            retryCount: 0,
          },
        };
      }

      // 3. 持久化存储
      await this.persistDeadLetter(data);

      // 4. 发送告警通知
      await this.sendAlert(data);

      // 5. 记录指标
      await this.metricsService.recordBusinessMetrics(
        'dead_letter_received',
        1,
        {
          taskType: data.originalJob.data?.taskType || 'unknown',
          queueName: data.metadata.queueName,
          errorCategory: this.categorizeError(data.failedReason),
        }
      );

      this.logger.log(`[${job.id}] Dead letter processed and archived: ${data.originalJob.id}`);

      return {
        success: true,
        data: { action: 'archived' },
        stats: {
          queueTime: 0,
          processingTime: Date.now() - job.timestamp,
          totalTime: Date.now() - job.timestamp,
          retryCount: 0,
        },
      };
    } catch (error) {
      this.logger.error(`[${job.id}] Failed to process dead letter:`, error);
      throw error;
    }
  }

  /**
   * 监听死信事件
   */
  @OnEvent(TASK_EVENTS.DEAD_LETTER_RECEIVED)
  async onDeadLetterReceived(payload: {
    originalJob: any;
    failedReason: string;
    timestamp: Date;
  }): Promise<void> {
    // 构造死信消息
    const deadLetter: DeadLetterMessage = {
      originalJob: payload.originalJob,
      failedReason: payload.failedReason,
      failureStats: {
        attemptCount: payload.originalJob.attemptsMade || 1,
        firstFailedAt: payload.timestamp,
        lastFailedAt: payload.timestamp,
        errorTypes: [this.categorizeError(payload.failedReason)],
      },
      context: {
        workerId: `worker-${process.pid}`,
        timestamp: new Date(),
        stackTrace: undefined,
      },
      metadata: {
        queueName: payload.originalJob.data?.queueName || 'unknown',
        jobId: payload.originalJob.id,
        enqueuedAt: new Date(payload.originalJob.opts?.timestamp || Date.now()),
      },
    };

    // 提交到死信队列
    await this.taskScheduler.scheduleTask(
      TaskType.DATA_CLEANUP,
      deadLetter as any,
      QUEUE_NAMES.DEAD_LETTER,
      {
        priority: 5, // 中等优先级
        attempts: 3, // 处理死信的尝试次数
      }
    );
  }

  /**
   * 手动重试死信
   */
  async retryDeadLetter(deadLetterId: string): Promise<boolean> {
    // 从数据库获取死信消息
    const deadLetter = await this.getDeadLetterFromStorage(deadLetterId);
    
    if (!deadLetter) {
      this.logger.warn(`Dead letter not found: ${deadLetterId}`);
      return false;
    }

    if (deadLetter.status === 'manually_resolved') {
      this.logger.warn(`Dead letter already resolved: ${deadLetterId}`);
      return false;
    }

    try {
      // 重新提交任务
      const originalData = deadLetter.payload;
      
      await this.taskScheduler.scheduleTask(
        originalData.taskType,
        {
          ...originalData,
          taskId: `${originalData.taskId}-retry-${Date.now()}`,
          parentTaskId: originalData.taskId,
        },
        deadLetter.queueName,
        {
          priority: 10, // 提高优先级
          attempts: 3,
        }
      );

      // 更新状态
      await this.updateDeadLetterStatus(deadLetterId, 'manually_resolved', 'Manual retry');
      
      this.logger.log(`Manually retried dead letter: ${deadLetterId}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to retry dead letter ${deadLetterId}:`, error);
      return false;
    }
  }

  /**
   * 获取死信列表
   */
  async getDeadLetters(options: {
    status?: string;
    taskType?: string;
    queueName?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  } = {}): Promise<{ items: DeadLetterEntity[]; total: number }> {
    // 这里应该从数据库查询
    // 简化示例返回空数组
    return { items: [], total: 0 };
  }

  /**
   * 归档死信
   */
  async archiveDeadLetter(deadLetterId: string, reason: string): Promise<boolean> {
    await this.updateDeadLetterStatus(deadLetterId, 'archived', reason);
    this.logger.log(`Archived dead letter: ${deadLetterId}`);
    return true;
  }

  /**
   * 获取错误统计
   */
  async getErrorStatistics(timeRange: '1h' | '24h' | '7d' = '24h'): Promise<{
    totalDeadLetters: number;
    byErrorType: Record<string, number>;
    byTaskType: Record<string, number>;
    autoRecoveryRate: number;
  }> {
    // 这里应该从数据库统计
    // 简化示例返回模拟数据
    return {
      totalDeadLetters: 0,
      byErrorType: {},
      byTaskType: {},
      autoRecoveryRate: 0,
    };
  }

  // ==================== 私有方法 ====================

  /**
   * 分析失败模式
   */
  private async analyzeFailurePattern(message: DeadLetterMessage): Promise<void> {
    const errorKey = this.categorizeError(message.failedReason);
    const currentCount = this.errorPatterns.get(errorKey) || 0;
    this.errorPatterns.set(errorKey, currentCount + 1);

    // 如果某种错误频繁出现，触发告警
    if (currentCount + 1 >= 10) {
      this.logger.error(`High frequency error detected: ${errorKey} (${currentCount + 1} occurrences)`);
      
      this.eventEmitter.emit(TASK_EVENTS.ALERT_TRIGGERED, {
        type: 'high_error_frequency',
        errorType: errorKey,
        count: currentCount + 1,
        timestamp: new Date(),
      });
    }
  }

  /**
   * 尝试自动恢复
   */
  private async attemptAutoRecovery(message: DeadLetterMessage): Promise<boolean> {
    const errorCategory = this.categorizeError(message.failedReason);

    // 根据错误类型决定是否尝试自动恢复
    switch (errorCategory) {
      case 'transient_network_error':
        // 临时网络错误，可以稍后重试
        if (message.failureStats.attemptCount < 10) {
          await this.scheduleDelayedRetry(message, 5 * 60 * 1000); // 5分钟后重试
          return true;
        }
        return false;

      case 'rate_limited':
        // 限流错误，延长延迟后重试
        if (message.failureStats.attemptCount < 5) {
          await this.scheduleDelayedRetry(message, 15 * 60 * 1000); // 15分钟后重试
          return true;
        }
        return false;

      case 'data_validation_error':
        // 尝试修复数据后重试
        const fixed = await this.attemptDataFix(message);
        if (fixed) {
          await this.scheduleDelayedRetry(message, 1000);
          return true;
        }
        return false;

      default:
        return false;
    }
  }

  /**
   * 调度延迟重试
   */
  private async scheduleDelayedRetry(
    message: DeadLetterMessage,
    delay: number
  ): Promise<void> {
    const originalData = message.originalJob.data;
    
    await this.taskScheduler.scheduleDelayed(
      originalData.taskType,
      {
        ...originalData,
        taskId: `${originalData.taskId}-dlq-retry`,
        parentTaskId: originalData.taskId,
        dlqRetry: true,
        originalAttempts: message.failureStats.attemptCount,
      },
      delay,
      message.metadata.queueName
    );
  }

  /**
   * 尝试修复数据
   */
  private async attemptDataFix(message: DeadLetterMessage): Promise<boolean> {
    // 实现数据修复逻辑
    // 例如：修复日期格式、填充缺失字段等
    return false; // 简化示例，返回 false
  }

  /**
   * 持久化存储死信
   */
  private async persistDeadLetter(message: DeadLetterMessage): Promise<void> {
    const entity: Partial<DeadLetterEntity> = {
      id: `dlq-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      originalJobId: message.originalJob.id,
      queueName: message.metadata.queueName,
      taskType: message.originalJob.data?.taskType || 'unknown',
      failedReason: message.failedReason,
      attemptCount: message.failureStats.attemptCount,
      firstFailedAt: message.failureStats.firstFailedAt,
      lastFailedAt: message.failureStats.lastFailedAt,
      errorTypes: message.failureStats.errorTypes,
      payload: message.originalJob.data,
      metadata: message.metadata,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // 这里应该保存到数据库
    // await this.deadLetterRepository.save(entity);
    
    this.logger.debug(`Persisted dead letter: ${entity.id}`);
  }

  /**
   * 发送告警通知
   */
  private async sendAlert(message: DeadLetterMessage): Promise<void> {
    // 发送通知
    await this.taskScheduler.scheduleNotification({
      taskType: TaskType.EMAIL_NOTIFICATION,
      notificationType: 'in-app',
      recipients: ['admin'],
      subject: `Task Failed: ${message.originalJob.data?.taskType}`,
      content: `Task ${message.originalJob.id} failed after ${message.failureStats.attemptCount} attempts. ` +
               `Reason: ${message.failedReason}`,
    });

    // 发布告警事件
    this.eventEmitter.emit(TASK_EVENTS.ALERT_TRIGGERED, {
      type: 'dead_letter',
      severity: message.failureStats.attemptCount > 5 ? 'critical' : 'warning',
      jobId: message.originalJob.id,
      taskType: message.originalJob.data?.taskType,
      failedReason: message.failedReason,
      timestamp: new Date(),
    });
  }

  /**
   * 错误分类
   */
  private categorizeError(errorMessage: string): string {
    const message = errorMessage.toLowerCase();
    
    if (message.includes('timeout') || message.includes('etimedout')) {
      return 'transient_network_error';
    }
    if (message.includes('econnrefused') || message.includes('enotfound')) {
      return 'connection_error';
    }
    if (message.includes('429') || message.includes('rate limit')) {
      return 'rate_limited';
    }
    if (message.includes('500') || message.includes('502') || message.includes('503')) {
      return 'server_error';
    }
    if (message.includes('400') || message.includes('401') || message.includes('403')) {
      return 'client_error';
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return 'data_validation_error';
    }
    
    return 'unknown_error';
  }

  /**
   * 从存储获取死信
   */
  private async getDeadLetterFromStorage(id: string): Promise<DeadLetterEntity | null> {
    // 这里应该从数据库查询
    return null;
  }

  /**
   * 更新死信状态
   */
  private async updateDeadLetterStatus(
    id: string,
    status: string,
    resolution?: string
  ): Promise<void> {
    // 这里应该更新数据库
    this.logger.debug(`Updated dead letter ${id} status to ${status}`);
  }
}

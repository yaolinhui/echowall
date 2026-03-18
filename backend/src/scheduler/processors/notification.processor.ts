import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { NotificationTaskData, TaskResult, TaskExecutionStats } from '../interfaces/task.interface';
import { PROCESSOR_NAMES, TASK_EVENTS } from '../constants/queue.constants';
import { TaskType } from '../enums/task-type.enum';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MetricsService } from '../services/metrics.service';

/**
 * 通知任务处理器
 * 
 * 处理各类通知：
 * - 邮件通知
 * - Webhook 通知
 * - 站内通知
 */
@Processor('notification')
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private eventEmitter: EventEmitter2,
    private metricsService: MetricsService,
  ) {}

  /**
   * 处理邮件通知
   */
  @Process(PROCESSOR_NAMES.SEND_NOTIFICATION)
  async handleNotification(job: Job<NotificationTaskData>): Promise<TaskResult> {
    const startTime = Date.now();
    const { data } = job;

    this.logger.log(`[${job.id}] Sending ${data.notificationType} notification to ${data.recipients.join(', ')}`);

    try {
      let result: any;

      switch (data.notificationType) {
        case 'email':
          result = await this.sendEmail(data);
          break;
        case 'webhook':
          result = await this.sendWebhook(data);
          break;
        case 'in-app':
          result = await this.sendInAppNotification(data);
          break;
        default:
          throw new Error(`Unknown notification type: ${data.notificationType}`);
      }

      const stats = this.calculateStats(job, startTime);
      await this.metricsService.recordTaskMetrics(TaskType.EMAIL_NOTIFICATION, stats, true);

      this.logger.log(`[${job.id}] Notification sent successfully`);

      return {
        success: true,
        data: result,
        stats,
      };
    } catch (error) {
      const stats = this.calculateStats(job, startTime);
      await this.metricsService.recordTaskMetrics(TaskType.EMAIL_NOTIFICATION, stats, false);
      throw error;
    }
  }

  @OnQueueFailed()
  handleFailed(job: Job, error: Error): void {
    this.logger.error(`[${job.id}] Notification failed:`, error.message);
  }

  // ==================== 私有方法 ====================

  private async sendEmail(data: NotificationTaskData): Promise<{ messageId: string }> {
    // 模拟发送邮件
    await this.sleep(200);
    
    this.logger.debug(`Sending email to ${data.recipients.join(', ')}: ${data.subject}`);
    
    return { messageId: `email-${Date.now()}` };
  }

  private async sendWebhook(data: NotificationTaskData): Promise<{ statusCode: number }> {
    // 模拟发送 Webhook
    await this.sleep(300);
    
    // 模拟限流场景（10% 概率）
    if (Math.random() < 0.1) {
      const error = new Error('429 Too Many Requests');
      (error as any).statusCode = 429;
      throw error;
    }
    
    this.logger.debug(`Sending webhook to ${data.recipients[0]}`);
    
    return { statusCode: 200 };
  }

  private async sendInAppNotification(data: NotificationTaskData): Promise<{ notificationId: string }> {
    // 模拟发送站内通知
    await this.sleep(100);
    
    this.logger.debug(`Sending in-app notification to ${data.recipients.join(', ')}`);
    
    // 触发通知事件
    this.eventEmitter.emit(TASK_EVENTS.TASK_COMPLETED, {
      type: 'notification',
      recipients: data.recipients,
      subject: data.subject,
    });
    
    return { notificationId: `notif-${Date.now()}` };
  }

  private calculateStats(job: Job, startTime: number): TaskExecutionStats {
    const now = Date.now();
    return {
      queueTime: startTime - (job.processedOn || startTime),
      processingTime: now - startTime,
      totalTime: now - (job.processedOn || startTime),
      retryCount: job.attemptsMade,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

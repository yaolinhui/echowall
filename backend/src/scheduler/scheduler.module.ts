import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Controllers
import { SchedulerController } from './scheduler.controller';

// Services
import { DistributedLockService } from './services/distributed-lock.service';
import { RetryStrategyService } from './services/retry-strategy.service';
import { MetricsService } from './services/metrics.service';
import { TaskSchedulerService } from './services/task-scheduler.service';

// Processors

import { AnalysisProcessor } from './processors/analysis.processor';
import { NotificationProcessor } from './processors/notification.processor';
import { DlqProcessor } from './processors/dlq.processor';

// Constants
import { QUEUE_NAMES } from './constants/queue.constants';

/**
 * 任务调度模块
 * 
 * 提供完整的异步任务调度能力：
 * - 任务提交和管理
 * - 优先级队列
 * - 分布式锁
 * - 智能重试
 * - 死信队列
 * - 监控告警
 */
@Global()
@Module({
  imports: [
    // 事件发射器
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: ':',
    }),

    // 注册队列
    BullModule.registerQueue(
      {
        name: QUEUE_NAMES.FETCHER,
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      },
      {
        name: QUEUE_NAMES.HIGH_PRIORITY,
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      },
      {
        name: QUEUE_NAMES.LOW_PRIORITY,
        defaultJobOptions: {
          removeOnComplete: 50,
          removeOnFail: 25,
        },
      },
      {
        name: QUEUE_NAMES.NOTIFICATION,
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      },
      {
        name: QUEUE_NAMES.ANALYSIS,
        defaultJobOptions: {
          removeOnComplete: 50,
          removeOnFail: 25,
        },
      },
      {
        name: QUEUE_NAMES.DEAD_LETTER,
        defaultJobOptions: {
          removeOnComplete: 200,
          removeOnFail: 100,
        },
      },
      {
        name: QUEUE_NAMES.RETRY,
        defaultJobOptions: {
          removeOnComplete: 50,
          removeOnFail: 25,
        },
      },
    ),
  ],
  controllers: [SchedulerController],
  providers: [
    // Services
    DistributedLockService,
    RetryStrategyService,
    MetricsService,
    TaskSchedulerService,

    // Processors
    AnalysisProcessor,
    NotificationProcessor,
    DlqProcessor,
  ],
  exports: [
    // 导出服务供其他模块使用
    TaskSchedulerService,
    DistributedLockService,
    RetryStrategyService,
    MetricsService,
  ],
})
export class SchedulerModule {}

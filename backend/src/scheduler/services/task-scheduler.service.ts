import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job, JobOptions } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import {
  BaseTaskData,
  FetchTaskData,
  BatchFetchTaskData,
  NotificationTaskData,
  AnalysisTaskData,
  TaskResult,
  TaskConfig,
  QueueStatus,
} from '../interfaces/task.interface';
import {
  TaskType,
  TaskPriority,
  TaskStatus,
  QueueName,
} from '../enums/task-type.enum';
import {
  QUEUE_NAMES,
  TASK_EVENTS,
  DEFAULT_TASK_CONFIG,
  TASK_TYPE_CONFIG,
  TASK_TYPE_PRIORITY,
} from '../constants/queue.constants';
import { DistributedLockService } from './distributed-lock.service';
import { RetryStrategyService } from './retry-strategy.service';
import { MetricsService } from './metrics.service';

type JobStatus = 'completed' | 'wait' | 'active' | 'delayed' | 'failed' | 'paused';

@Injectable()
export class TaskSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(TaskSchedulerService.name);
  private readonly workerId: string;

  constructor(
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
    private lockService: DistributedLockService,
    private retryStrategy: RetryStrategyService,
    private metricsService: MetricsService,
    @InjectQueue(QUEUE_NAMES.FETCHER) private fetcherQueue: Queue,
    @InjectQueue(QUEUE_NAMES.HIGH_PRIORITY) private highPriorityQueue: Queue,
    @InjectQueue(QUEUE_NAMES.LOW_PRIORITY) private lowPriorityQueue: Queue,
    @InjectQueue(QUEUE_NAMES.NOTIFICATION) private notificationQueue: Queue,
    @InjectQueue(QUEUE_NAMES.ANALYSIS) private analysisQueue: Queue,
    @InjectQueue(QUEUE_NAMES.DEAD_LETTER) private deadLetterQueue: Queue,
  ) {
    this.workerId = `worker-${process.pid}-${Date.now()}`;
  }

  async onModuleInit(): Promise<void> {
    this.logger.log(`TaskSchedulerService initialized (worker: ${this.workerId})`);
    this.setupQueueEventListeners();
  }

  async scheduleFetch(
    data: Omit<FetchTaskData, 'taskId' | 'createdAt' | 'traceId'>,
    options?: JobOptions
  ): Promise<Job<FetchTaskData>> {
    const taskData: FetchTaskData = {
      ...data,
      taskId: uuidv4(),
      createdAt: new Date(),
      traceId: uuidv4(),
    };

    return this.scheduleTask(
      taskData.taskType || TaskType.SCHEDULED_FETCH,
      taskData,
      this.getQueueForTaskType(taskData.taskType),
      options
    );
  }

  async scheduleBatchFetch(
    data: Omit<BatchFetchTaskData, 'taskId' | 'createdAt' | 'traceId'>,
    options?: JobOptions
  ): Promise<Job<BatchFetchTaskData>> {
    const taskData: BatchFetchTaskData = {
      ...data,
      taskId: uuidv4(),
      createdAt: new Date(),
      traceId: uuidv4(),
      taskType: TaskType.BATCH_FETCH,
    };

    return this.scheduleTask(
      TaskType.BATCH_FETCH,
      taskData,
      QUEUE_NAMES.LOW_PRIORITY,
      options
    );
  }

  async scheduleAnalysis(
    data: Omit<AnalysisTaskData, 'taskId' | 'createdAt' | 'traceId'>,
    options?: JobOptions
  ): Promise<Job<AnalysisTaskData>> {
    const taskData: AnalysisTaskData = {
      ...data,
      taskId: uuidv4(),
      createdAt: new Date(),
      traceId: uuidv4(),
    };

    return this.scheduleTask(
      taskData.taskType,
      taskData,
      QUEUE_NAMES.ANALYSIS,
      options
    );
  }

  async scheduleNotification(
    data: Omit<NotificationTaskData, 'taskId' | 'createdAt' | 'traceId'>,
    options?: JobOptions
  ): Promise<Job<NotificationTaskData>> {
    const taskData: NotificationTaskData = {
      ...data,
      taskId: uuidv4(),
      createdAt: new Date(),
      traceId: uuidv4(),
    };

    return this.scheduleTask(
      TaskType.EMAIL_NOTIFICATION,
      taskData,
      QUEUE_NAMES.NOTIFICATION,
      options
    );
  }

  async scheduleTask<T extends BaseTaskData>(
    taskType: TaskType,
    data: T,
    queueName: string,
    options?: JobOptions
  ): Promise<Job<T>> {
    const queue = this.getQueueByName(queueName);
    const config = this.getTaskConfig(taskType);
    
    const dedupWindow = config.deduplicationWindow || 0;
    if (dedupWindow > 0) {
      const dedupKey = this.generateDedupKey(data);
      const isDuplicate = await this.lockService.isTaskLocked(dedupKey);
      
      if (isDuplicate) {
        this.logger.warn(`Duplicate task rejected: ${taskType} (${data.taskId})`);
        throw new Error(`Duplicate task: ${taskType}`);
      }
      
      await this.lockService.acquireTaskLock(dedupKey, dedupWindow);
    }

    const jobOptions: JobOptions = {
      jobId: data.taskId,
      priority: data.priority || this.getTaskPriority(taskType),
      attempts: config.maxRetries,
      backoff: {
        type: 'exponential',
        delay: config.baseRetryDelay,
      },
      timeout: config.timeout,
      removeOnComplete: 100,
      removeOnFail: 50,
      ...options,
    };

    const job = await queue.add(taskType, data, jobOptions);
    
    this.logger.log(`Task scheduled: ${taskType} (${job.id}) in queue ${queueName}`);
    
    this.eventEmitter.emit(TASK_EVENTS.TASK_CREATED, {
      jobId: job.id,
      taskType,
      queueName,
      data,
    });
    
    return job;
  }

  async scheduleBatch<T extends BaseTaskData>(
    tasks: Array<{
      taskType: TaskType;
      data: Omit<T, 'taskId' | 'createdAt' | 'traceId'>;
      queueName?: string;
      options?: JobOptions;
    }>
  ): Promise<Job<T>[]> {
    const jobs: Job<T>[] = [];
    
    for (const task of tasks) {
      try {
        const fullData = {
          ...task.data,
          taskId: uuidv4(),
          createdAt: new Date(),
          traceId: uuidv4(),
        } as T;
        
        const job = await this.scheduleTask(
          task.taskType,
          fullData,
          task.queueName || this.getQueueForTaskType(task.taskType),
          task.options
        );
        
        jobs.push(job);
      } catch (error) {
        this.logger.error(`Failed to schedule task ${task.taskType}:`, error);
      }
    }
    
    return jobs;
  }

  async scheduleDelayed<T extends BaseTaskData>(
    taskType: TaskType,
    data: Omit<T, 'taskId' | 'createdAt' | 'traceId'>,
    delay: number,
    queueName?: string
  ): Promise<Job<T>> {
    const fullData = {
      ...data,
      taskId: uuidv4(),
      createdAt: new Date(),
      traceId: uuidv4(),
    } as T;

    return this.scheduleTask(taskType, fullData, queueName || this.getQueueForTaskType(taskType), {
      delay,
    });
  }

  async scheduleCron<T extends BaseTaskData>(
    taskType: TaskType,
    data: Omit<T, 'taskId' | 'createdAt' | 'traceId'>,
    cron: string,
    queueName?: string
  ): Promise<Job<T>> {
    const fullData = {
      ...data,
      taskId: uuidv4(),
      createdAt: new Date(),
      traceId: uuidv4(),
    } as T;

    return this.scheduleTask(taskType, fullData, queueName || this.getQueueForTaskType(taskType), {
      repeat: { cron },
    });
  }

  async cancelTask(queueName: string, jobId: string | number): Promise<boolean> {
    try {
      const queue = this.getQueueByName(queueName);
      const job = await queue.getJob(jobId);
      
      if (!job) {
        return false;
      }

      await job.remove();
      
      this.logger.log(`Task cancelled: ${jobId}`);
      this.eventEmitter.emit(TASK_EVENTS.TASK_CANCELLED, { jobId });
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to cancel task ${jobId}:`, error);
      return false;
    }
  }

  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.getQueueByName(queueName);
    await queue.pause();
    this.logger.log(`Queue paused: ${queueName}`);
    this.eventEmitter.emit(TASK_EVENTS.QUEUE_PAUSED, { queueName });
  }

  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.getQueueByName(queueName);
    await queue.resume();
    this.logger.log(`Queue resumed: ${queueName}`);
    this.eventEmitter.emit(TASK_EVENTS.QUEUE_RESUMED, { queueName });
  }

  async cleanQueue(queueName: string, status: JobStatus = 'completed'): Promise<void> {
    const queue = this.getQueueByName(queueName);
    await queue.clean(0, status);
    this.logger.log(`Queue cleaned: ${queueName} (${status})`);
    this.eventEmitter.emit(TASK_EVENTS.QUEUE_CLEANED, { queueName, status });
  }

  async getQueueStatus(queueName?: string): Promise<QueueStatus | QueueStatus[]> {
    return this.metricsService.getQueueStatus(queueName);
  }

  async getJob(queueName: string, jobId: string | number): Promise<Job | null> {
    const queue = this.getQueueByName(queueName);
    return queue.getJob(jobId);
  }

  async getWaitingJobs(queueName: string, start = 0, end = 100): Promise<Job[]> {
    const queue = this.getQueueByName(queueName);
    return queue.getWaiting(start, end);
  }

  async getActiveJobs(queueName: string, start = 0, end = 100): Promise<Job[]> {
    const queue = this.getQueueByName(queueName);
    return queue.getActive(start, end);
  }

  async getFailedJobs(queueName: string, start = 0, end = 100): Promise<Job[]> {
    const queue = this.getQueueByName(queueName);
    return queue.getFailed(start, end);
  }

  async retryJob(queueName: string, jobId: string | number): Promise<void> {
    const queue = this.getQueueByName(queueName);
    const job = await queue.getJob(jobId);
    
    if (job) {
      await job.retry();
      this.logger.log(`Job retried: ${jobId}`);
    }
  }

  private setupQueueEventListeners(): void {
    const queues = [
      { queue: this.fetcherQueue, name: QUEUE_NAMES.FETCHER },
      { queue: this.highPriorityQueue, name: QUEUE_NAMES.HIGH_PRIORITY },
      { queue: this.lowPriorityQueue, name: QUEUE_NAMES.LOW_PRIORITY },
      { queue: this.notificationQueue, name: QUEUE_NAMES.NOTIFICATION },
      { queue: this.analysisQueue, name: QUEUE_NAMES.ANALYSIS },
    ];

    for (const { queue, name } of queues) {
      queue.on('completed', (job, result) => {
        this.logger.debug(`Job completed in ${name}: ${job.id}`);
        this.eventEmitter.emit(TASK_EVENTS.TASK_COMPLETED, {
          jobId: job.id,
          queueName: name,
          result,
        });
        
        const taskType = job.data.taskType || 'unknown';
        this.retryStrategy.recordSuccess(taskType);
      });

      queue.on('failed', (job, error) => {
        this.logger.error(`Job failed in ${name}: ${job.id}`, error.message);
        this.eventEmitter.emit(TASK_EVENTS.TASK_FAILED, {
          jobId: job.id,
          queueName: name,
          error: error.message,
        });
      });

      queue.on('stalled', (job) => {
        this.logger.warn(`Job stalled in ${name}: ${job.id}`);
        this.eventEmitter.emit(TASK_EVENTS.TASK_STALLED, {
          jobId: job.id,
          queueName: name,
        });
      });

      queue.on('progress', (job, progress) => {
        this.logger.debug(`Job progress in ${name}: ${job.id} - ${progress}%`);
      });
    }
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
      case QUEUE_NAMES.ANALYSIS:
        return this.analysisQueue;
      case QUEUE_NAMES.DEAD_LETTER:
        return this.deadLetterQueue;
      default:
        return this.fetcherQueue;
    }
  }

  private getQueueForTaskType(taskType: TaskType): string {
    const priority = this.getTaskPriority(taskType);
    
    if (priority >= TaskPriority.HIGH) {
      return QUEUE_NAMES.HIGH_PRIORITY;
    } else if (priority <= TaskPriority.LOW) {
      return QUEUE_NAMES.LOW_PRIORITY;
    }
    
    return QUEUE_NAMES.FETCHER;
  }

  private getTaskConfig(taskType: TaskType): TaskConfig {
    const typeConfig = TASK_TYPE_CONFIG[taskType] || {};
    return {
      ...DEFAULT_TASK_CONFIG,
      ...typeConfig,
    };
  }

  private getTaskPriority(taskType: TaskType): TaskPriority {
    return TASK_TYPE_PRIORITY[taskType] || TaskPriority.NORMAL;
  }

  private generateDedupKey(data: BaseTaskData): string {
    const keyParts = [data.taskType];
    
    if ('sourceId' in data) {
      keyParts.push((data as any).sourceId);
    }
    if ('projectId' in data) {
      keyParts.push((data as any).projectId);
    }
    
    return keyParts.join(':');
  }
}

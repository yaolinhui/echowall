# 异步任务调度系统 - 使用示例

## 目录

1. [基础使用](#基础使用)
2. [抓取任务](#抓取任务)
3. [批量任务](#批量任务)
4. [定时任务](#定时任务)
5. [监控告警](#监控告警)
6. [死信队列管理](#死信队列管理)

---

## 基础使用

### 提交简单任务

```typescript
import { Injectable } from '@nestjs/common';
import { TaskSchedulerService } from './scheduler/services/task-scheduler.service';
import { PlatformType } from './scheduler/enums/task-type.enum';

@Injectable()
export class SourceService {
  constructor(private taskScheduler: TaskSchedulerService) {}

  async fetchSource(sourceId: string) {
    // 提交抓取任务
    const job = await this.taskScheduler.scheduleFetch({
      sourceId,
      platform: PlatformType.GITHUB,
      projectId: 'project-123',
      config: { owner: 'facebook', repo: 'react' },
    });

    return { jobId: job.id };
  }
}
```

### 使用分布式锁

```typescript
import { Injectable } from '@nestjs/common';
import { DistributedLockService } from './scheduler/services/distributed-lock.service';

@Injectable()
export class SyncService {
  constructor(private lockService: DistributedLockService) {}

  async syncData(sourceId: string) {
    // 获取分布式锁，防止并发执行
    const lock = await this.lockService.acquire(`sync:${sourceId}`, {
      ttl: 60000,
      autoRenew: true,
    });

    if (!lock) {
      throw new Error('Another sync is in progress');
    }

    try {
      // 执行同步逻辑
      await this.performSync(sourceId);
    } finally {
      await lock.release();
    }
  }
}
```

---

## 抓取任务

### 实时抓取

```typescript
async realtimeFetch(projectId: string) {
  const job = await this.taskScheduler.scheduleTask(
    TaskType.REALTIME_FETCH,
    {
      taskId: uuidv4(),
      taskType: TaskType.REALTIME_FETCH,
      sourceId: 'source-123',
      platform: PlatformType.TWITTER,
      projectId,
      config: { keywords: ['#nestjs', '#typescript'] },
      traceId: uuidv4(),
      createdAt: new Date(),
    },
    QUEUE_NAMES.HIGH_PRIORITY,
    {
      priority: TaskPriority.HIGHEST,
      attempts: 5,
    }
  );

  return job;
}
```

### 增量抓取

```typescript
async incrementalFetch(sourceId: string, lastFetchTime: Date) {
  const job = await this.taskScheduler.scheduleFetch({
    sourceId,
    platform: PlatformType.GITHUB,
    projectId: 'project-123',
    config: { owner: 'facebook', repo: 'react' },
    incremental: true,
    since: lastFetchTime,
    taskType: TaskType.INCREMENTAL_FETCH,
  });

  return job;
}
```

### 历史数据抓取

```typescript
async historicalFetch(sourceId: string, startDate: Date, endDate: Date) {
  const job = await this.taskScheduler.scheduleFetch({
    sourceId,
    platform: PlatformType.REDDIT,
    projectId: 'project-123',
    config: { subreddit: 'programming' },
    since: startDate,
    until: endDate,
    limit: 1000,
    taskType: TaskType.HISTORICAL_FETCH,
  });

  return job;
}
```

---

## 批量任务

### 批量提交

```typescript
async batchFetch(sourceIds: string[]) {
  const tasks = sourceIds.map(sourceId => ({
    taskType: TaskType.SCHEDULED_FETCH,
    data: {
      sourceId,
      platform: PlatformType.GITHUB,
      projectId: 'project-123',
      config: {},
    },
    options: {
      priority: TaskPriority.NORMAL,
    },
  }));

  const jobs = await this.taskScheduler.scheduleBatch(tasks);

  return {
    submitted: jobs.length,
    jobIds: jobs.map(j => j.id),
  };
}
```

### 批量抓取处理器

```typescript
// 批量任务会自动分发到多个 Worker 处理
async scheduleBatchFetch(sourceIds: string[]) {
  const job = await this.taskScheduler.scheduleBatchFetch({
    sourceIds,
    parallel: true,
    concurrency: 3,  // 最多3个并发
    batchSize: 50,   // 每批50个
    taskId: uuidv4(),
    createdAt: new Date(),
    traceId: uuidv4(),
  });

  return job;
}
```

---

## 定时任务

### Cron 定时任务

```typescript
// 每小时执行一次
async scheduleHourlyFetch(sourceId: string) {
  const job = await this.taskScheduler.scheduleCron(
    TaskType.SCHEDULED_FETCH,
    {
      sourceId,
      platform: PlatformType.GITHUB,
      projectId: 'project-123',
      config: {},
    },
    '0 * * * *',  // 每小时第0分钟
    QUEUE_NAMES.FETCHER
  );

  return job;
}

// 每天凌晨2点执行
async scheduleDailyReport(projectId: string) {
  const job = await this.taskScheduler.scheduleCron(
    TaskType.GENERATE_REPORT,
    {
      projectId,
      analysisType: 'report',
    },
    '0 2 * * *',  // 每天凌晨2点
    QUEUE_NAMES.ANALYSIS
  );

  return job;
}
```

### 延迟任务

```typescript
// 5分钟后执行
async delayedNotification(userId: string, message: string) {
  const delayMs = 5 * 60 * 1000;  // 5分钟

  const job = await this.taskScheduler.scheduleDelayed(
    TaskType.NOTIFICATION,
    {
      notificationType: 'in-app',
      recipients: [userId],
      subject: 'Delayed Message',
      content: message,
    },
    delayMs,
    QUEUE_NAMES.NOTIFICATION
  );

  return job;
}
```

---

## 监控告警

### 自定义告警规则

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { MetricsService } from './scheduler/services/metrics.service';

@Injectable()
export class AlertService implements OnModuleInit {
  constructor(private metricsService: MetricsService) {}

  onModuleInit() {
    // 注册自定义告警规则
    this.metricsService.registerAlertRule({
      name: 'high_processing_time',
      metric: 'task_processing_time',
      condition: 'gt',
      threshold: 300000,  // 5分钟
      duration: 60000,    // 持续1分钟
      severity: 'warning',
      message: 'Task processing time exceeded 5 minutes',
    });

    // 监听告警事件
    this.eventEmitter.on('alert:triggered', (alert) => {
      console.log(`ALERT: ${alert.rule.message}`);
      // 发送邮件/短信通知
    });
  }
}
```

### 获取指标数据

```typescript
// 获取队列深度
const queueDepth = await this.metricsService.getQueueDepth();
console.log(`Current queue depth: ${queueDepth}`);

// 获取错误率
const errorRate = await this.metricsService.getErrorRate('24h');
console.log(`Error rate (24h): ${errorRate}%`);

// 获取任务统计
const stats = await this.metricsService.getTaskStats('scheduled-fetch', '7d');
console.log(`Task stats:`, stats);
```

### Prometheus 指标导出

```typescript
// 在控制器中提供 Prometheus 指标端点
@Controller('metrics')
export class MetricsController {
  constructor(private metricsService: MetricsService) {}

  @Get('prometheus')
  async getPrometheusMetrics() {
    return this.metricsService.getPrometheusMetrics();
  }
}
```

---

## 死信队列管理

### 自动死信处理

系统会自动处理失败任务：

1. 任务重试耗尽后自动进入死信队列
2. 死信处理器尝试自动恢复
3. 自动恢复失败则发送告警通知
4. 支持手动重试

### 手动重试死信

```typescript
import { DlqProcessor } from './scheduler/processors/dlq.processor';

@Injectable()
export class AdminService {
  constructor(private dlqProcessor: DlqProcessor) {}

  async retryDeadLetter(deadLetterId: string) {
    const success = await this.dlqProcessor.retryDeadLetter(deadLetterId);
    
    if (success) {
      console.log('Dead letter scheduled for retry');
    } else {
      console.log('Failed to retry dead letter');
    }
  }
}
```

### 查询死信

```typescript
// 获取死信列表
const deadLetters = await this.dlqProcessor.getDeadLetters({
  status: 'pending',
  page: 1,
  limit: 20,
});

// 获取死信统计
const stats = await this.dlqProcessor.getErrorStatistics('7d');
console.log('Dead letter stats:', stats);
```

---

## REST API 使用

### 提交抓取任务

```bash
curl -X POST http://localhost:3000/scheduler/tasks/fetch \
  -H "Content-Type: application/json" \
  -d '{
    "sourceId": "source-123",
    "platform": "github",
    "projectId": "project-456",
    "config": {
      "owner": "facebook",
      "repo": "react"
    }
  }'
```

### 查询队列状态

```bash
curl http://localhost:3000/scheduler/queues/status
```

### 暂停队列

```bash
curl -X POST http://localhost:3000/scheduler/queues/fetcher/pause
```

### 获取 Prometheus 指标

```bash
curl http://localhost:3000/scheduler/metrics/prometheus
```

### 重试失败任务

```bash
curl -X POST http://localhost:3000/scheduler/queues/fetcher/jobs/123/retry
```

---

## 高级用法

### 使用装饰器

```typescript
import { TaskTracker, Idempotent, CircuitBreaker, RateLimit } from './scheduler/decorators/task-tracker.decorator';

@Service()
export class MyProcessor {
  
  @TaskTracker({ taskType: 'data-processing' })
  @Idempotent(60000)  // 60秒内幂等
  async processData(data: any) {
    // 处理逻辑
  }

  @CircuitBreaker({
    failureThreshold: 5,
    resetTimeout: 60000,
  })
  async callExternalAPI() {
    // 可能失败的调用
  }

  @RateLimit({ maxCalls: 10, windowMs: 60000 })
  async limitedOperation() {
    // 限速操作
  }
}
```

### 自定义重试策略

```typescript
import { RetryStrategyService } from './scheduler/services/retry-strategy.service';

@Service()
export class CustomService {
  constructor(private retryStrategy: RetryStrategyService) {}

  async customOperation() {
    let attempt = 0;
    const maxAttempts = 5;

    while (attempt < maxAttempts) {
      try {
        return await this.doOperation();
      } catch (error) {
        const decision = await this.retryStrategy.shouldRetry(
          error,
          attempt,
          maxAttempts,
          'custom-task'
        );

        if (!decision.shouldRetry) {
          throw error;
        }

        await this.sleep(decision.delay);
        attempt++;
      }
    }
  }
}
```

### 任务进度追踪

```typescript
@Processor('fetcher')
export class CustomProcessor {
  
  @Process('long-task')
  async handleLongTask(job: Job) {
    const total = 100;
    
    for (let i = 0; i < total; i++) {
      // 处理步骤
      await this.processStep(i);
      
      // 更新进度
      await job.progress(Math.round((i / total) * 100));
    }
    
    return { processed: total };
  }
}
```

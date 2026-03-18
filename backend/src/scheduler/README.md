# Task Scheduler Module

NestJS + Bull + Redis 异步任务调度系统

## 功能特性

- ✅ **多队列支持** - 按优先级分离队列
- ✅ **分布式锁** - 防止任务重复执行
- ✅ **智能重试** - 指数退避、限流感知
- ✅ **死信队列** - 失败任务处理和分析
- ✅ **监控告警** - Prometheus 指标、自定义告警
- ✅ **任务追踪** - 完整的任务生命周期追踪
- ✅ **熔断器** - 防止级联故障
- ✅ **幂等性保证** - 自动任务去重

## 快速开始

### 1. 安装依赖

```bash
npm install @nestjs/bull bull ioredis uuid
npm install -D @types/uuid
```

### 2. 配置模块

```typescript
import { SchedulerModule } from './scheduler/scheduler.module';

@Module({
  imports: [
    BullModule.forRoot({
      redis: {
        host: 'localhost',
        port: 6379,
      },
    }),
    SchedulerModule,
  ],
})
export class AppModule {}
```

### 3. 提交任务

```typescript
import { TaskSchedulerService } from './scheduler/services/task-scheduler.service';

@Injectable()
export class MyService {
  constructor(private taskScheduler: TaskSchedulerService) {}

  async doSomething() {
    // 提交抓取任务
    const job = await this.taskScheduler.scheduleFetch({
      sourceId: 'source-123',
      platform: PlatformType.GITHUB,
      projectId: 'project-456',
      config: { owner: 'facebook', repo: 'react' },
    });

    console.log(`Job submitted: ${job.id}`);
  }
}
```

## API 文档

### 任务提交

```http
POST /scheduler/tasks/fetch
Content-Type: application/json

{
  "taskType": "scheduled-fetch",
  "sourceId": "source-123",
  "platform": "github",
  "projectId": "project-456",
  "config": {
    "owner": "facebook",
    "repo": "react"
  }
}
```

### 查询队列状态

```http
GET /scheduler/queues/status
```

### 获取监控指标

```http
GET /scheduler/metrics/prometheus
```

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                     Task Scheduler                           │
├─────────────────────────────────────────────────────────────┤
│  Services                                                    │
│  ├── TaskSchedulerService    # 任务调度核心                   │
│  ├── DistributedLockService  # 分布式锁                      │
│  ├── RetryStrategyService    # 智能重试策略                   │
│  └── MetricsService          # 监控指标                      │
├─────────────────────────────────────────────────────────────┤
│  Processors                                                  │
│  ├── FetchProcessor          # 抓取任务处理器                 │
│  ├── AnalysisProcessor       # 分析任务处理器                 │
│  ├── NotificationProcessor   # 通知任务处理器                 │
│  └── DlqProcessor           # 死信队列处理器                  │
├─────────────────────────────────────────────────────────────┤
│  Queues                                                      │
│  ├── high-priority          # 高优先级队列                    │
│  ├── fetcher                # 默认抓取队列                    │
│  ├── low-priority           # 低优先级队列                    │
│  ├── notification           # 通知队列                        │
│  ├── analysis               # 分析队列                        │
│  └── dead-letter            # 死信队列                        │
└─────────────────────────────────────────────────────────────┘
```

## 配置选项

```yaml
scheduler:
  retry:
    baseDelay: 1000        # 基础重试延迟 (ms)
    maxDelay: 60000        # 最大重试延迟 (ms)
    maxRetries: 3          # 默认最大重试次数
  
  lock:
    ttl: 30000             # 锁超时时间 (ms)
    autoRenew: true        # 自动续期
  
  metrics:
    retentionDays: 7       # 指标保留天数
    alertCheckInterval: 60000  # 告警检查间隔 (ms)
  
  deadLetter:
    maxRetries: 3          # 死信处理最大重试
    autoRetry: true        # 启用自动恢复
```

## 任务优先级

| 优先级 | 任务类型 | 说明 |
|-------|---------|-----|
| 15 | 紧急任务 | 关键业务 |
| 10 | 实时抓取 | 即时数据更新 |
| 8 | 通知任务 | 时效性要求 |
| 6 | 定时抓取 | 常规任务 |
| 3 | 数据清洗 | 后台任务 |
| 2 | 分析任务 | 低优先级 |
| 1 | 历史数据 | 最低优先级 |

## 监控指标

- `queue_depth` - 队列深度
- `task_duration` - 任务执行时间
- `task_success_rate` - 任务成功率
- `task_error_rate` - 任务错误率
- `dead_letter_received` - 死信接收数

## 最佳实践

1. **任务幂等性** - 确保任务可以安全地重复执行
2. **错误分类** - 区分可重试错误和不可重试错误
3. **超时设置** - 为任务设置合理的超时时间
4. **监控告警** - 关注队列深度和错误率
5. **死信处理** - 定期审查和处理死信队列

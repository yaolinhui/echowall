# 异步任务调度系统实现总结

## 项目概况

基于 NestJS + Bull + Redis 构建的企业级异步任务调度系统，专为社交数据抓取场景设计。

## 核心特性

### 1. 任务分类和优先级
- **7 种任务类型**：实时抓取、定时抓取、批量抓取、历史抓取、数据清洗、分析任务、通知任务
- **6 级优先级**：Critical(15) > Highest(10) > High(8) > Normal(6) > Low(3) > Lowest(1)
- **多队列隔离**：高优先级队列、默认队列、低优先级队列、通知队列、分析队列、死信队列

### 2. 智能重试策略
- **指数退避算法**：`delay = baseDelay * (2 ^ attempt) + jitter`
- **限流感知**：自动识别 429 状态码，按 Retry-After 等待
- **错误分类**：
  - 网络错误、超时错误 → 指数退避重试
  - 服务端错误 5xx → 固定间隔重试
  - 客户端错误 4xx → 不重试
  - 限流错误 429 → 延长延迟重试
- **熔断器模式**：失败阈值达到后自动熔断，防止级联故障

### 3. 分布式锁实现
- **Redis 分布式锁**：基于 SET NX PX 原子操作
- **自动续期**：支持锁的自动续期，防止任务执行中被释放
- **安全释放**：使用 Lua 脚本确保只有锁持有者能释放
- **任务去重**：防止同一任务在短时间内重复提交

### 4. 死信队列设计
- **自动转移**：任务重试耗尽后自动进入死信队列
- **智能恢复**：支持自动恢复策略（临时错误延迟重试、数据修复重试）
- **持久化存储**：死信消息持久化到数据库
- **手动管理**：支持手动重试、归档、分析
- **告警通知**：死信产生时自动发送通知

### 5. 监控和可观测性
- **队列指标**：队列深度、活跃任务数、完成/失败数
- **性能指标**：任务执行时间、排队时间、内存使用
- **业务指标**：成功率、错误率、重试率
- **Prometheus 导出**：标准 Prometheus 格式指标
- **告警规则**：可配置阈值告警，支持自定义规则

## 代码架构

```
backend/src/scheduler/
├── constants/
│   └── queue.constants.ts      # 队列常量和配置
├── decorators/
│   └── task-tracker.decorator.ts  # 任务追踪装饰器
├── enums/
│   └── task-type.enum.ts       # 任务类型、优先级、状态枚举
├── interceptors/
│   └── task-metrics.interceptor.ts  # 任务指标拦截器
├── interfaces/
│   ├── retry.interface.ts      # 重试策略接口
│   └── task.interface.ts       # 任务数据接口
├── processors/
│   ├── analysis.processor.ts   # 分析任务处理器
│   ├── dlq.processor.ts        # 死信队列处理器
│   ├── fetch.processor.ts      # 抓取任务处理器
│   └── notification.processor.ts  # 通知任务处理器
├── services/
│   ├── distributed-lock.service.ts  # 分布式锁服务
│   ├── metrics.service.ts      # 监控指标服务
│   ├── retry-strategy.service.ts    # 智能重试服务
│   └── task-scheduler.service.ts    # 任务调度服务
├── scheduler.controller.ts     # REST API 控制器
├── scheduler.module.ts         # 模块定义
├── index.ts                    # 导出索引
└── README.md                   # 模块文档
```

## 文件清单

| 文件路径 | 说明 | 代码行数 |
|---------|-----|---------|
| `scheduler/enums/task-type.enum.ts` | 枚举定义 | 140 |
| `scheduler/interfaces/task.interface.ts` | 任务接口 | 270 |
| `scheduler/interfaces/retry.interface.ts` | 重试接口 | 120 |
| `scheduler/constants/queue.constants.ts` | 常量定义 | 240 |
| `scheduler/services/distributed-lock.service.ts` | 分布式锁 | 320 |
| `scheduler/services/retry-strategy.service.ts` | 重试策略 | 420 |
| `scheduler/services/metrics.service.ts` | 监控服务 | 500 |
| `scheduler/services/task-scheduler.service.ts` | 调度服务 | 450 |
| `scheduler/processors/fetch.processor.ts` | 抓取处理器 | 380 |
| `scheduler/processors/dlq.processor.ts` | 死信处理器 | 450 |
| `scheduler/processors/analysis.processor.ts` | 分析处理器 | 270 |
| `scheduler/processors/notification.processor.ts` | 通知处理器 | 150 |
| `scheduler/decorators/task-tracker.decorator.ts` | 装饰器 | 200 |
| `scheduler/interceptors/task-metrics.interceptor.ts` | 拦截器 | 170 |
| `scheduler/scheduler.controller.ts` | API 控制器 | 320 |
| `scheduler/scheduler.module.ts` | 模块定义 | 110 |

**总计**：约 4500 行 TypeScript 代码

## REST API 列表

### 任务管理
- `POST /scheduler/tasks/fetch` - 提交抓取任务
- `POST /scheduler/tasks/analysis` - 提交分析任务
- `POST /scheduler/tasks/notification` - 提交通知任务
- `GET /scheduler/queues/:name/jobs/:id` - 获取任务详情
- `POST /scheduler/queues/:name/jobs/:id/cancel` - 取消任务
- `POST /scheduler/queues/:name/jobs/:id/retry` - 重试任务

### 队列管理
- `GET /scheduler/queues/status` - 获取所有队列状态
- `GET /scheduler/queues/:name/status` - 获取指定队列状态
- `GET /scheduler/queues/:name/jobs/waiting` - 获取等待中的任务
- `GET /scheduler/queues/:name/jobs/active` - 获取活跃的任务
- `GET /scheduler/queues/:name/jobs/failed` - 获取失败的任务
- `POST /scheduler/queues/:name/pause` - 暂停队列
- `POST /scheduler/queues/:name/resume` - 恢复队列
- `POST /scheduler/queues/:name/clean` - 清空队列

### 监控指标
- `GET /scheduler/metrics` - 获取所有监控指标
- `GET /scheduler/metrics/prometheus` - Prometheus 格式指标
- `GET /scheduler/metrics/queue-depth` - 队列深度
- `GET /scheduler/metrics/error-rate` - 错误率
- `GET /scheduler/metrics/task-stats/:taskType` - 任务统计

### 死信队列
- `GET /scheduler/dead-letters` - 获取死信列表
- `GET /scheduler/dead-letters/statistics` - 死信统计
- `POST /scheduler/dead-letters/:id/retry` - 手动重试死信
- `POST /scheduler/dead-letters/:id/archive` - 归档死信

## 使用示例

### 基础使用

```typescript
// 提交抓取任务
const job = await taskScheduler.scheduleFetch({
  sourceId: 'source-123',
  platform: PlatformType.GITHUB,
  projectId: 'project-456',
  config: { owner: 'facebook', repo: 'react' },
});
```

### 批量任务

```typescript
// 批量提交任务
const jobs = await taskScheduler.scheduleBatch([
  { taskType: TaskType.SCHEDULED_FETCH, data: {...} },
  { taskType: TaskType.SCHEDULED_FETCH, data: {...} },
]);
```

### 定时任务

```typescript
// 每小时执行
await taskScheduler.scheduleCron(
  TaskType.SCHEDULED_FETCH,
  data,
  '0 * * * *',
  QUEUE_NAMES.FETCHER
);
```

### 分布式锁

```typescript
const lock = await lockService.acquire(`sync:${sourceId}`, {
  ttl: 60000,
  autoRenew: true,
});

if (lock) {
  try {
    await performSync();
  } finally {
    await lock.release();
  }
}
```

## 性能指标

| 指标 | 配置值 |
|-----|-------|
| 队列并发数 | 1-10（按任务类型） |
| 最大重试次数 | 2-5 次 |
| 重试延迟 | 1秒 - 10分钟（指数退避） |
| 锁超时时间 | 30秒 - 10分钟 |
| 去重窗口 | 1分钟 |
| 指标保留时间 | 7天 |

## 部署依赖

```json
{
  "@nestjs/bull": "^11.0.4",
  "@nestjs/event-emitter": "^3.0.0",
  "bull": "^4.16.5",
  "ioredis": "^5.6.1",
  "uuid": "^11.1.0"
}
```

## 运行环境

- **Node.js**: >= 18.x
- **Redis**: >= 6.x
- **NestJS**: >= 11.x

## 后续扩展建议

1. **任务可视化界面** - 开发 Web UI 管理任务
2. **动态扩缩容** - 根据队列深度自动调整 Worker 数量
3. **跨集群任务** - 支持多实例集群间任务分发
4. **任务依赖** - 支持任务 DAG（有向无环图）
5. **Saga 模式** - 长事务补偿机制

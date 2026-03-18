# 异步任务调度系统设计文档

## 1. 业界最佳实践

### 1.1 AWS SQS 最佳实践
- **消息去重**: 使用 Message Deduplication ID 防止重复消息
- **可见性超时**: 设置合理的超时时间防止消息被重复处理
- **死信队列 (DLQ)**: 配置 DLQ 捕获处理失败的消息
- **长轮询**: 使用长轮询减少空响应和 API 调用次数
- **批处理**: 批量发送和接收消息提高吞吐量

### 1.2 RabbitMQ 最佳实践
- **交换机类型**: 使用 topic/direct 交换机实现灵活路由
- **队列持久化**: 设置 durable=true 防止消息丢失
- **消息确认**: 使用手动确认确保消息被正确处理
- **QoS 预取**: 设置 prefetch count 防止消费者过载
- **镜像队列**: 高可用场景使用镜像队列

### 1.3 Bull 最佳实践
- **命名队列**: 按业务域分离队列（抓取、分析、通知）
- **限速**: 使用 rate limiting 防止 API 限流
- **并发控制**: 设置合理的并发数
- ** stalled 作业**: 自动处理 stalled 作业
- **事件监听**: 监听队列事件用于监控

## 2. 任务分类和优先级设计

### 2.1 任务类型

```typescript
enum TaskType {
  // 实时抓取 - 最高优先级
  REALTIME_FETCH = 'realtime-fetch',
  
  // 定时抓取 - 高优先级
  SCHEDULED_FETCH = 'scheduled-fetch',
  
  // 批量抓取 - 中等优先级
  BATCH_FETCH = 'batch-fetch',
  
  // 历史数据抓取 - 低优先级
  HISTORICAL_FETCH = 'historical-fetch',
  
  // 数据清洗 - 中等优先级
  DATA_CLEANUP = 'data-cleanup',
  
  // 分析任务 - 低优先级
  ANALYSIS = 'analysis',
  
  // 通知任务 - 高优先级（时效性）
  NOTIFICATION = 'notification',
}
```

### 2.2 优先级矩阵

| 任务类型 | 优先级 | 并发数 | 重试次数 | 超时时间 |
|---------|-------|-------|---------|---------|
| 实时抓取 | 10 | 5 | 5 | 60s |
| 通知任务 | 8 | 10 | 3 | 30s |
| 定时抓取 | 6 | 3 | 3 | 120s |
| 数据清洗 | 4 | 2 | 2 | 300s |
| 批量抓取 | 3 | 2 | 3 | 180s |
| 分析任务 | 2 | 1 | 2 | 600s |
| 历史数据 | 1 | 1 | 2 | 300s |

## 3. 智能重试策略

### 3.1 指数退避算法

```typescript
// 计算延迟: delay = baseDelay * (2 ^ attempt) + jitter
function calculateBackoffDelay(
  attempt: number,
  baseDelay: number = 1000,
  maxDelay: number = 60000,
  jitter: boolean = true
): number {
  // 指数退避
  let delay = baseDelay * Math.pow(2, attempt);
  
  // 上限控制
  delay = Math.min(delay, maxDelay);
  
  // 添加随机抖动 (0-20%)
  if (jitter) {
    const jitterFactor = 0.8 + Math.random() * 0.4;
    delay = Math.floor(delay * jitterFactor);
  }
  
  return delay;
}
```

### 3.2 限流感知重试

```typescript
// 根据 HTTP 状态码决定重试策略
function getRetryStrategy(error: Error): RetryDecision {
  const statusCode = extractStatusCode(error);
  
  switch (statusCode) {
    case 429: // Too Many Requests
      return {
        shouldRetry: true,
        delay: parseRetryAfter(error) || 60000,
        priority: 'low',
      };
    case 503: // Service Unavailable
      return {
        shouldRetry: true,
        delay: 30000,
        priority: 'normal',
      };
    case 500: // Internal Server Error
    case 502: // Bad Gateway
    case 504: // Gateway Timeout
      return {
        shouldRetry: true,
        delay: 5000,
        priority: 'normal',
      };
    case 400: // Bad Request
    case 401: // Unauthorized
    case 403: // Forbidden
    case 404: // Not Found
      return {
        shouldRetry: false,
        delay: 0,
        priority: 'none',
      };
    default:
      return {
        shouldRetry: true,
        delay: calculateBackoffDelay(attempt),
        priority: 'normal',
      };
  }
}
```

### 3.3 错误分类

| 错误类型 | 是否重试 | 重试策略 | 示例 |
|---------|---------|---------|-----|
| 网络错误 | 是 | 指数退避 | ETIMEDOUT, ECONNREFUSED |
| API 限流 | 是 | 按 Retry-After 等待 | 429, rate limit |
| 服务端错误 | 是 | 固定间隔重试 | 5xx errors |
| 客户端错误 | 否 | 直接失败 | 4xx errors (除 429) |
| 业务逻辑错误 | 否 | 直接失败 | validation error |

## 4. 分布式锁实现

### 4.1 Redis RedLock 算法

```typescript
// 使用 Redlock 算法实现分布式锁
class DistributedLock {
  async acquire(
    resource: string,
    ttl: number
  ): Promise<Lock | null> {
    const token = this.generateToken();
    const quorum = Math.floor(this.redisClients.length / 2) + 1;
    
    const locks = await Promise.all(
      this.redisClients.map(client =>
        this.lockInstance(client, resource, token, ttl)
      )
    );
    
    const acquired = locks.filter(Boolean).length;
    
    if (acquired >= quorum) {
      return new Lock(resource, token, ttl);
    }
    
    // 获取失败，释放已获取的锁
    await this.releaseAll(resource, token);
    return null;
  }
}
```

### 4.2 任务去重锁

```typescript
// 防止同一任务重复执行
async function acquireTaskLock(
  taskId: string,
  ttl: number = 60000
): Promise<boolean> {
  const key = `task:lock:${taskId}`;
  const result = await redis.set(key, '1', 'PX', ttl, 'NX');
  return result === 'OK';
}
```

## 5. 死信队列设计

### 5.1 死信触发条件

1. 消息被拒绝 (nack/reject) 且 requeue=false
2. 消息 TTL 过期
3. 队列达到最大长度限制
4. 处理次数超过最大重试次数

### 5.2 死信处理流程

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  正常队列     │ --> │  重试队列     │ --> │  死信队列     │
└──────────────┘     └──────────────┘     └──────────────┘
       │                      │                    │
       │ 处理失败              │ 重试耗尽            │
       v                      v                    v
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  指数退避     │     │  人工介入     │     │  自动归档     │
│  重新入队     │     │  告警通知     │     │  数据分析     │
└──────────────┘     └──────────────┘     └──────────────┘
```

### 5.3 死信消息结构

```typescript
interface DeadLetterMessage {
  // 原始任务
  originalJob: Job;
  
  // 失败原因
  failedReason: string;
  
  // 失败统计
  failureStats: {
    attemptCount: number;
    firstFailedAt: Date;
    lastFailedAt: Date;
    errorTypes: string[];
  };
  
  // 上下文信息
  context: {
    workerId: string;
    timestamp: Date;
    stackTrace?: string;
  };
  
  // 元数据
  metadata: {
    queueName: string;
    jobId: string;
    enqueuedAt: Date;
  };
}
```

## 6. 监控和可观测性方案

### 6.1 关键指标

| 指标类别 | 指标名称 | 说明 | 告警阈值 |
|---------|---------|-----|---------|
| 队列深度 | queue_depth | 等待处理的任务数 | > 1000 |
| 处理延迟 | processing_latency | 任务等待时间 | > 60s |
| 处理速率 | throughput | 每秒处理任务数 | < 10/s |
| 错误率 | error_rate | 失败任务占比 | > 5% |
| 重试率 | retry_rate | 需要重试的任务占比 | > 10% |
| 死信数 | dead_letter_count | 进入死信队列的任务数 | > 10/h |
| 消费者健康 | consumer_health | 活跃消费者数量 | < 最小值 |

### 6.2 分布式追踪

```typescript
// OpenTelemetry 集成
interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  
  // 任务信息
  taskType: string;
  taskId: string;
  priority: number;
  
  // 时间戳
  enqueuedAt: Date;
  startedAt: Date;
  completedAt?: Date;
  
  // 性能指标
  queueTime: number;      // 排队时间
  processingTime: number; // 处理时间
  totalTime: number;      // 总时间
}
```

### 6.3 日志规范

```typescript
// 结构化日志
interface TaskLog {
  // 基础信息
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  
  // 任务上下文
  taskId: string;
  taskType: string;
  queueName: string;
  workerId: string;
  
  // 追踪信息
  traceId: string;
  spanId: string;
  
  // 业务数据
  payload: Record<string, any>;
  
  // 性能数据
  duration?: number;
  memoryUsage?: number;
  
  // 错误信息
  error?: {
    type: string;
    message: string;
    stack?: string;
    code?: string;
  };
}
```

## 7. 架构设计

### 7.1 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        API Gateway                               │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                    Task Scheduler Service                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ 任务调度器   │  │ 优先级队列   │  │ 分布式锁    │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────┬───────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼───────┐    ┌────────▼────────┐   ┌──────▼──────┐
│  高优先级队列  │    │  中优先级队列    │   │ 低优先级队列 │
│  (realtime)   │    │  (scheduled)    │   │ (batch)     │
└───────┬───────┘    └────────┬────────┘   └──────┬──────┘
        │                     │                    │
┌───────▼─────────────────────▼────────────────────▼──────┐
│                    Worker Pool                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Worker 1 │ │ Worker 2 │ │ Worker 3 │ │ Worker N │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
└──────────────────────────┬──────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
┌───────▼──────┐  ┌────────▼────────┐ ┌──────▼──────┐
│   死信队列    │  │   监控服务       │ │   告警服务   │
└──────────────┘  └─────────────────┘ └─────────────┘
```

### 7.2 数据流

```
1. 任务提交
   Client -> Scheduler -> Priority Queue -> Redis Bull
   
2. 任务执行
   Bull -> Worker -> Processor -> External API
   
3. 结果处理
   Processor -> Database -> Event Emitter
   
4. 失败处理
   Processor -> Retry Queue -> DLQ (if exhausted)
   
5. 监控上报
   Worker -> Metrics -> Prometheus -> Grafana
```

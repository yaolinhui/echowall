# 系统集成指南

## 快速集成步骤

### 1. 基础集成

```typescript
import { DeduplicationEngine, Content } from './deduplication-system';

// 初始化
const engine = new DeduplicationEngine();

// 处理新内容
async function processNewContent(content: Content) {
  const result = await engine.checkDuplicate(content);
  
  if (result.isDuplicate) {
    console.log(`重复内容，跳过: ${result.matchedContentId}`);
    return { action: 'skip', reason: 'duplicate' };
  }
  
  await engine.addContent(content);
  return { action: 'save', content };
}
```

### 2. 与抓取系统集成

```typescript
import { Queue } from 'bullmq';

const contentQueue = new Queue('content-processing');

// 抓取后入队
async function onContentCrawled(rawContent: any) {
  await contentQueue.add('process', {
    id: generateId(),
    platform: rawContent.platform,
    content: normalizeContent(rawContent),
    timestamp: new Date(),
  });
}

// 消费者处理
contentQueue.process('process', async (job) => {
  const content = job.data as Content;
  return processNewContent(content);
});
```

### 3. 与PostgreSQL集成

```typescript
import { PgVectorStore } from './deduplication-system';

const vectorStore = new PgVectorStore({
  connectionString: process.env.DATABASE_URL,
  tableName: 'content_embeddings',
  dimension: 384,
});

// 初始化表
await vectorStore.init();

// 创建带pgvector的引擎
const engine = new DeduplicationEngine({
  vectorStore,
});
```

### 4. 与Qdrant集成

```typescript
import { QdrantVectorStore } from './deduplication-system';

const vectorStore = new QdrantVectorStore({
  url: process.env.QDRANT_URL,
  collectionName: 'content_embeddings',
  apiKey: process.env.QDRANT_API_KEY,
});

await vectorStore.init(384);

const engine = new DeduplicationEngine({
  vectorStore,
});
```

## 生产环境配置

### 高可用架构

```
                    ┌─────────────┐
     ┌─────────────│   Load      │─────────────┐
     │             │  Balancer   │             │
     │             └─────────────┘             │
     │                                         │
┌────┴────┐                              ┌───┴────┐
│Instance │                              │Instance│
│   1     │                              │   2    │
└────┬────┘                              └───┬────┘
     │                                         │
     │             ┌─────────────┐             │
     └────────────→│   Redis     │←────────────┘
                   │   Cluster   │
                   └──────┬──────┘
                          │
                   ┌──────┴──────┐
                   │  PostgreSQL │
                   │   +pgvector │
                   └─────────────┘
```

### 性能优化配置

```typescript
const engine = new DeduplicationEngine({
  config: {
    // 减少哈希数量提高速度
    minHash: {
      numHashes: 64, // 默认128
      jaccardThreshold: 0.8, // 降低阈值提高召回
    },
    // 调整SimHash阈值
    simHash: {
      hammingThreshold: 5, // 增加容错
    },
  },
  useBloomFilter: true, // 必须启用
});

// 批量处理
const batchSize = 100;
for (let i = 0; i < contents.length; i += batchSize) {
  const batch = contents.slice(i, i + batchSize);
  await engine.addContents(batch);
}
```

## 监控与告警

### 关键指标

```typescript
// 统计信息
const stats = engine.getStats();

// 监控指标
metrics.gauge('dedup.total_contents', stats.totalContents);
metrics.gauge('dedup.exact_hashes', stats.exactHashes);
metrics.gauge('dedup.simhash_index', stats.simHashIndex);

// 性能监控
const startTime = Date.now();
const result = await engine.checkDuplicate(content);
metrics.timing('dedup.check_latency', Date.now() - startTime);
```

### 健康检查

```typescript
app.get('/health', async (req, res) => {
  const checks = {
    database: await checkDatabase(),
    vectorStore: await checkVectorStore(),
    engine: engine.getStats().totalContents >= 0,
  };
  
  const healthy = Object.values(checks).every(v => v);
  
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'unhealthy',
    checks,
  });
});
```

## 常见问题排查

### 1. 误报率过高

```typescript
// 提高阈值
const engine = new DeduplicationEngine({
  config: {
    simHash: { hammingThreshold: 2 }, // 从3降到2
    minHash: { jaccardThreshold: 0.9 }, // 从0.85提高到0.9
    semantic: { cosineThreshold: 0.95 }, // 从0.92提高到0.95
  },
});
```

### 2. 漏报率过高

```typescript
// 降低阈值
const engine = new DeduplicationEngine({
  config: {
    simHash: { hammingThreshold: 5 }, // 增加容错
    minHash: { jaccardThreshold: 0.75 }, // 降低要求
    semantic: { cosineThreshold: 0.88 },
  },
});
```

### 3. 内存不足

```typescript
// 使用计数Bloom Filter
import { CountingBloomFilter } from './deduplication-system';

// 量化向量
import { VectorUtils } from './deduplication-system';
const quantized = VectorUtils.quantizeInt8(embedding);

// 定期清理
setInterval(() => {
  engine.cleanup();
}, 3600000); // 每小时
```

## API设计参考

### REST API

```typescript
// POST /api/v1/contents/check
app.post('/api/v1/contents/check', async (req, res) => {
  const content = req.body;
  const result = await engine.checkDuplicate(content);
  
  res.json({
    isDuplicate: result.isDuplicate,
    confidence: result.confidence,
    method: result.method,
    matchedContent: result.matchedContentId,
  });
});

// POST /api/v1/contents
app.post('/api/v1/contents', async (req, res) => {
  const content = req.body;
  const result = await engine.checkDuplicate(content);
  
  if (result.isDuplicate) {
    return res.status(409).json({
      error: 'Duplicate content detected',
      matchedContent: result.matchedContentId,
    });
  }
  
  const fingerprint = await engine.addContent(content);
  res.status(201).json({ id: content.id, fingerprint });
});

// GET /api/v1/contents/:id/similar
app.get('/api/v1/contents/:id/similar', async (req, res) => {
  const content = await db.getContent(req.params.id);
  const similar = await engine.findSimilar(content, { topK: 10 });
  
  res.json({ results: similar });
});
```

### GraphQL Schema

```graphql
type DuplicateCheckResult {
  isDuplicate: Boolean!
  confidence: Float!
  method: String!
  matchedContentId: ID
}

type SimilarContent {
  id: ID!
  similarity: Float!
  method: String!
}

type Mutation {
  checkDuplicate(content: ContentInput!): DuplicateCheckResult!
  addContent(content: ContentInput!): Content!
}

type Query {
  findSimilar(contentId: ID!, topK: Int): [SimilarContent!]!
}
```

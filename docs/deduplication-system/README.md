# 跨平台社交内容去重系统

## 概述

这是一个专为跨平台社交内容设计的智能去重系统，采用多层检测策略，支持精确匹配、近似匹配和语义匹配，能够高效识别来自不同平台的重复内容。

## 核心特性

- **多层去重策略**：Bloom Filter → 精确Hash → SimHash → MinHash → BERT语义
- **跨平台作者识别**：基于多维度特征识别同一作者
- **内容版本管理**：追踪内容更新、跨平台镜像和衍生关系
- **多种向量数据库支持**：pgvector、Qdrant、Milvus、Pinecone
- **高性能设计**：支持百万级内容实时去重

## 快速开始

```typescript
import { DeduplicationEngine, Content } from 'cross-platform-deduplication';

// 初始化引擎
const engine = new DeduplicationEngine({
  config: {
    simHash: { hammingThreshold: 3 },
    minHash: { jaccardThreshold: 0.85 },
    semantic: { cosineThreshold: 0.92 },
  },
});

// 定义内容
const content: Content = {
  id: 'content_001',
  platform: 'twitter',
  contentType: 'tweet',
  authorId: 'user_123',
  authorName: 'TechBlogger',
  content: 'React 19 发布了！新特性包括...',
  url: 'https://twitter.com/...',
  publishedAt: new Date(),
  fetchedAt: new Date(),
  metadata: {},
};

// 检查重复
const result = await engine.checkDuplicate(content);

if (result.isDuplicate) {
  console.log(`发现重复内容: ${result.matchedContentId}`);
  console.log(`相似度: ${result.confidence}`);
} else {
  // 添加到索引
  await engine.addContent(content);
}
```

## 系统架构

```
内容输入 → 预处理 → 多层去重检测 → 向量存储 → 结果输出
                ↓
         作者识别 → 版本管理
```

### 去重层级

| 层级 | 算法 | 阈值 | 用途 |
|-----|------|-----|------|
| L0 | Bloom Filter | - | 快速排除 |
| L1 | 精确Hash | 100% | 完全相同 |
| L2 | SimHash | 汉明距离≤3 | 近似重复 |
| L3 | MinHash | Jaccard≥0.85 | 集合相似 |
| L4 | BERT Embedding | Cosine≥0.92 | 语义相似 |

## 算法对比

### SimHash vs MinHash

| 特性 | SimHash | MinHash |
|-----|---------|---------|
| 相似度度量 | 汉明距离 | Jaccard系数 |
| 适用场景 | 大文本、Web去重 | 集合相似度 |
| 速度 | 快 | 中等 |
| 内存占用 | 低 | 中等 |
| 准确性 | 中 | 高 |

### 向量数据库对比

| 数据库 | 规模 | 延迟 | 最佳场景 |
|--------|-----|------|---------|
| pgvector | <1000万 | 中 | 已有PostgreSQL |
| Qdrant | <1亿 | 低 | 自托管、过滤密集 |
| Milvus | 十亿级 | 低 | 企业级、云原生 |
| Pinecone | 十亿级 | 低 | 全托管、零运维 |

## API参考

### DeduplicationEngine

```typescript
class DeduplicationEngine {
  // 检查内容是否重复
  checkDuplicate(content: Content): Promise<DuplicateCheckResult>
  
  // 添加内容到索引
  addContent(content: Content): Promise<ContentFingerprint>
  
  // 批量添加
  addContents(contents: Content[]): Promise<ContentFingerprint[]>
  
  // 查找相似内容
  findSimilar(content: Content, options?: FindOptions): Promise<SimilarResult[]>
  
  // 删除内容
  removeContent(contentId: string): Promise<void>
  
  // 获取统计
  getStats(): EngineStats
}
```

### AuthorResolver

```typescript
class AuthorResolver {
  // 解析作者身份
  resolve(identifier: AuthorIdentifier): Promise<ResolutionResult>
  
  // 获取作者档案
  getProfile(id: string): AuthorProfile | undefined
  
  // 查找跨平台账号
  findCrossPlatformAccounts(profileId: string): Map<string, string[]>
}
```

### VersionManager

```typescript
class VersionManager {
  // 注册新内容
  registerContent(content: Content): ContentVersion
  
  // 注册更新
  registerUpdate(content: Content, previousId: string): ContentVersion
  
  // 注册镜像
  registerMirror(content: Content, originalId: string, platform: string): ContentVersion
  
  // 获取内容谱系
  getLineage(contentId: string): LineageResult
}
```

## 配置选项

```typescript
const config: DeduplicationConfig = {
  simHash: {
    hashBits: 64,           // SimHash位数
    hammingThreshold: 3,    // 汉明距离阈值
    shingleSize: 4,         // Shingle大小
  },
  minHash: {
    numHashes: 128,         // 哈希函数数量
    shingleSize: 3,         // Shingle大小
    jaccardThreshold: 0.85, // Jaccard阈值
  },
  semantic: {
    modelName: 'sentence-transformers/all-MiniLM-L6-v2',
    vectorDimension: 384,
    cosineThreshold: 0.92,
  },
  authorResolution: {
    minConfidence: 0.75,
    featureWeights: {
      username: 0.25,
      content: 0.30,
      network: 0.25,
      temporal: 0.10,
      device: 0.10,
    },
  },
};
```

## 性能优化

### 1. 向量量化

```typescript
// 使用Int8量化减少内存占用
const quantized = VectorUtils.quantizeInt8(vector);
const restored = VectorUtils.dequantizeInt8(quantized);
```

### 2. 索引选择

```typescript
// HNSW索引（默认）- 高精度
// IVF_FLAT索引 - 内存受限时
```

### 3. 批量处理

```typescript
// 批量添加比单条添加更高效
await engine.addContents(contentsBatch);
```

## 安装

```bash
npm install cross-platform-deduplication
```

## 依赖

- Node.js >= 18
- PostgreSQL >= 14 (如使用pgvector)
- Redis (可选，用于缓存)

## 测试

```bash
npm test
```

## 许可证

MIT

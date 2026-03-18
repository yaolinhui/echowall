/**
 * 跨平台社交内容去重系统
 * 
 * 主要导出模块
 */

// 类型定义
export * from './types';

// 工具函数
export { TextProcessor } from './utils/text-processing';
export { MurmurHash3, md5Hash, hammingDistance } from './utils/hash';

// 算法
export { BloomFilter, CountingBloomFilter } from './algorithms/bloom-filter';
export { SimHash, SimHashIndex } from './algorithms/simhash';
export { MinHash, MinHashLSH } from './algorithms/minhash';
export {
  SemanticSimilarityCalculator,
  cosineSimilarity,
  euclideanDistance,
  manhattanDistance,
  VectorUtils,
} from './algorithms/semantic-similarity';

// 存储
export {
  VectorStore,
  VectorDocument,
  SearchResult,
  PgVectorStore,
  QdrantVectorStore,
  InMemoryVectorStore,
} from './storage/vector-store';

// 作者识别
export {
  AuthorResolver,
  AuthorIdentifier,
  AuthorProfile,
  AuthorFeatures,
  ResolutionResult,
} from './author/author-resolver';

// 核心引擎
export { DeduplicationEngine, DeduplicationEngineOptions } from './deduplication-engine';

// 版本管理
export { VersionManager, VersionManagerOptions } from './version-manager';

// 配置
export { DEFAULT_CONFIG } from './types';

// 版本
export const VERSION = '1.0.0';

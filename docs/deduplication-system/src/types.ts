/**
 * 跨平台内容去重系统 - 类型定义
 */

export type Platform = 'github' | 'twitter' | 'weibo' | 'zhihu' | 'hackernews' | 'reddit' | 'medium';

export type ContentType = 'post' | 'comment' | 'article' | 'issue' | 'tweet';

export type DuplicateLevel = 'exact' | 'near' | 'semantic' | 'none';

export type VersionRelation = 'UPDATE' | 'MIRROR' | 'DERIVED' | 'TRANSLATION' | 'REPLY';

export interface Content {
  id: string;
  platform: Platform;
  contentType: ContentType;
  authorId: string;
  authorName: string;
  content: string;
  title?: string;
  url: string;
  publishedAt: Date;
  fetchedAt: Date;
  metadata: Record<string, any>;
  embeddings?: number[];
}

export interface ContentFingerprint {
  contentId: string;
  exactHash: string;
  simHash: bigint;
  minHash: number[];
  semanticHash?: number[];
  shingles: string[];
  features: TextFeatures;
  createdAt: Date;
}

export interface TextFeatures {
  wordCount: number;
  charCount: number;
  avgWordLength: number;
  punctuationRatio: number;
  emojiCount: number;
  urlCount: number;
  hashtagCount: number;
  mentionCount: number;
  language: string;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  level: DuplicateLevel;
  confidence: number;
  matchedContentId?: string;
  matchedPlatform?: Platform;
  similarityScore: number;
  method: string;
}

export interface AuthorProfile {
  id: string;
  canonicalName: string;
  aliases: Map<Platform, string[]>;
  platformIds: Map<Platform, string[]>;
  features: AuthorFeatures;
  confidenceScore: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthorFeatures {
  usernameEmbedding: number[];
  bioEmbedding: number[];
  writingStyleVector: number[];
  vocabFingerprint: number[];
  emojiPattern: number[];
  activityPattern: number[];
}

export interface ContentVersion {
  id: string;
  contentId: string;
  canonicalId: string;
  version: number;
  relation: VersionRelation;
  parentId?: string;
  content: string;
  diff?: ContentDiff;
  createdAt: Date;
}

export interface ContentDiff {
  added: string[];
  removed: string[];
  modified: Array<{ old: string; new: string }>;
}

export interface DeduplicationConfig {
  // SimHash 配置
  simHash: {
    hashBits: number;
    hammingThreshold: number;
    shingleSize: number;
  };
  // MinHash 配置
  minHash: {
    numHashes: number;
    shingleSize: number;
    jaccardThreshold: number;
  };
  // 语义相似度配置
  semantic: {
    modelName: string;
    vectorDimension: number;
    cosineThreshold: number;
  };
  // 作者识别配置
  authorResolution: {
    minConfidence: number;
    featureWeights: Record<string, number>;
  };
}

export const DEFAULT_CONFIG: DeduplicationConfig = {
  simHash: {
    hashBits: 64,
    hammingThreshold: 3,
    shingleSize: 4,
  },
  minHash: {
    numHashes: 128,
    shingleSize: 3,
    jaccardThreshold: 0.85,
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

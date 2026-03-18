/**
 * 多语言情感分析系统 - 核心类型定义
 */

export enum SentimentLabel {
  POSITIVE = 'positive',
  NEGATIVE = 'negative',
  NEUTRAL = 'neutral',
  MIXED = 'mixed',
}

export enum Language {
  ZH = 'zh',
  EN = 'en',
  MIXED = 'mixed',
  UNKNOWN = 'unknown',
}

export interface SentimentScore {
  positive: number;
  negative: number;
  neutral: number;
  mixed?: number;
}

export interface SarcasmDetectionResult {
  isSarcastic: boolean;
  confidence: number;
  cues?: string[];
}

export interface SentimentResult {
  text: string;
  label: SentimentLabel;
  scores: SentimentScore;
  confidence: number;
  language: Language;
  sarcasm?: SarcasmDetectionResult;
  aspects?: AspectSentiment[];
  processingLayer: ProcessingLayer;
  latency: number;
  timestamp: Date;
}

export interface AspectSentiment {
  aspect: string;
  label: SentimentLabel;
  score: number;
  keywords: string[];
}

export enum ProcessingLayer {
  RULE_ENGINE = 'rule_engine',
  LOCAL_MODEL = 'local_model',
  LOCAL_MODEL_FAST = 'local_model_fast',
  CLOUD_LLM = 'cloud_llm',
  CACHE = 'cache',
}

export interface AnalysisRequest {
  text: string;
  context?: AnalysisContext;
  options?: AnalysisOptions;
}

export interface AnalysisContext {
  userId?: string;
  conversationHistory?: string[];
  productCategory?: string;
  platform?: string;
  metadata?: Record<string, any>;
}

export interface AnalysisOptions {
  requireSarcasmCheck?: boolean;
  requireAspectAnalysis?: boolean;
  preferredLayer?: ProcessingLayer;
  timeout?: number;
  useCache?: boolean;
}

export interface LayerConfig {
  enabled: boolean;
  priority: number;
  timeout: number;
  threshold?: number;
  modelName?: string;
}

export interface SystemConfig {
  ruleEngine: LayerConfig;
  localModel: LayerConfig;
  cloudLLM: LayerConfig;
  cache: {
    enabled: boolean;
    ttl: number;
    similarityThreshold: number;
  };
  routing: {
    complexityThreshold: number;
    sarcasmCheckThreshold: number;
    mixedLanguageThreshold: number;
  };
}

export interface ModelPrediction {
  label: SentimentLabel;
  confidence: number;
  scores: SentimentScore;
  modelName: string;
  latency: number;
}

export interface CacheEntry {
  key: string;
  result: SentimentResult;
  timestamp: number;
  accessCount: number;
}

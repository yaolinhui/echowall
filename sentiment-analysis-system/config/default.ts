/**
 * 默认配置文件
 */

import { SystemConfig } from '../src/core/types';

export const defaultConfig: SystemConfig = {
  ruleEngine: {
    enabled: true,
    priority: 1,
    timeout: 100, // 10ms
    threshold: 0.3,
  },
  localModel: {
    enabled: true,
    priority: 2,
    timeout: 500, // 500ms
    threshold: 0.6,
    modelName: 'XLM-RoBERTa-base',
  },
  cloudLLM: {
    enabled: true,
    priority: 3,
    timeout: 3000, // 3s
    modelName: 'gpt-4o-mini',
  },
  cache: {
    enabled: true,
    ttl: 3600000, // 1 hour
    similarityThreshold: 0.85,
  },
  routing: {
    complexityThreshold: 0.5,
    sarcasmCheckThreshold: 0.7,
    mixedLanguageThreshold: 0.3,
  },
};

// 生产环境配置
export const productionConfig: Partial<SystemConfig> = {
  localModel: {
    enabled: true,
    priority: 2,
    timeout: 300,
    threshold: 0.5,
    modelName: 'XLM-RoBERTa-large',
  },
  cloudLLM: {
    enabled: true,
    priority: 3,
    timeout: 2000,
    modelName: 'gpt-4o',
  },
  cache: {
    enabled: true,
    ttl: 7200000, // 2 hours
    similarityThreshold: 0.9,
  },
};

// 成本优化配置
export const costOptimizedConfig: Partial<SystemConfig> = {
  ruleEngine: {
    enabled: true,
    priority: 1,
    timeout: 100,
    threshold: 0.4,
  },
  localModel: {
    enabled: true,
    priority: 2,
    timeout: 500,
    threshold: 0.7,
    modelName: 'distilbert-base-multilingual',
  },
  cloudLLM: {
    enabled: true,
    priority: 3,
    timeout: 3000,
    modelName: 'gpt-4o-mini',
  },
  cache: {
    enabled: true,
    ttl: 86400000, // 24 hours
    similarityThreshold: 0.8,
  },
  routing: {
    complexityThreshold: 0.7,
    sarcasmCheckThreshold: 0.8,
    mixedLanguageThreshold: 0.5,
  },
};

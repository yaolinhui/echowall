/**
 * 分层情感分析器 - 核心协调器
 * 实现规则引擎 + 本地模型 + 云端大模型的分层架构
 */

import {
  SentimentResult,
  AnalysisRequest,
  AnalysisOptions,
  ProcessingLayer,
  SystemConfig,
  ModelPrediction,
  Language,
} from './types';
import { RuleEngine } from '../rules/RuleEngine';
import { LocalModelService } from '../models/LocalModelService';
import { CloudLLMService } from '../models/CloudLLMService';
import { CacheManager } from '../utils/CacheManager';
import { LanguageDetector } from '../utils/LanguageDetector';
import { ComplexityAssessor } from '../utils/ComplexityAssessor';
import { SarcasmDetector } from '../detectors/SarcasmDetector';
import { defaultConfig } from '../../config/default';

export class SentimentAnalyzer {
  private config: SystemConfig;
  private ruleEngine: RuleEngine;
  private localModel: LocalModelService;
  private cloudLLM: CloudLLMService;
  private cache: CacheManager;
  private languageDetector: LanguageDetector;
  private complexityAssessor: ComplexityAssessor;
  private sarcasmDetector: SarcasmDetector;

  constructor(config: Partial<SystemConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.ruleEngine = new RuleEngine();
    this.localModel = new LocalModelService(this.config.localModel);
    this.cloudLLM = new CloudLLMService(this.config.cloudLLM);
    this.cache = new CacheManager(this.config.cache);
    this.languageDetector = new LanguageDetector();
    this.complexityAssessor = new ComplexityAssessor();
    this.sarcasmDetector = new SarcasmDetector();
  }

  /**
   * 分析文本情感
   * 核心入口方法，协调各层处理
   */
  async analyze(request: AnalysisRequest): Promise<SentimentResult> {
    const startTime = Date.now();
    const { text, context, options = {} } = request;

    // 1. 检查缓存
    if (this.shouldUseCache(options)) {
      const cached = await this.cache.get(text);
      if (cached) {
        return {
          ...cached,
          latency: Date.now() - startTime,
        };
      }
    }

    // 2. 预处理
    const cleanedText = this.preprocess(text);
    const language = this.languageDetector.detect(cleanedText);
    const complexity = this.complexityAssessor.assess(cleanedText, language);

    // 3. 路由决策
    const layer = this.routeRequest(cleanedText, complexity, options, context);

    // 4. 分层处理
    let result: SentimentResult;
    try {
      result = await this.processWithLayer(
        layer,
        cleanedText,
        language,
        complexity,
        context,
        options
      );
    } catch (error) {
      // 降级处理
      result = await this.fallbackProcess(
        cleanedText,
        language,
        context,
        options
      );
    }

    // 5. 后处理增强
    result = await this.enhanceResult(result, cleanedText, context, options);

    // 6. 更新缓存
    if (this.shouldUseCache(options)) {
      await this.cache.set(text, result);
    }

    result.latency = Date.now() - startTime;
    return result;
  }

  /**
   * 批量分析 - 优化吞吐量
   */
  async analyzeBatch(
    requests: AnalysisRequest[],
    options?: { parallel?: boolean }
  ): Promise<SentimentResult[]> {
    const { parallel = true } = options || {};

    if (parallel) {
      // 并发处理，适合本地模型
      return Promise.all(requests.map((req) => this.analyze(req)));
    } else {
      // 串行处理，适合需要上下文的场景
      const results: SentimentResult[] = [];
      for (const req of requests) {
        results.push(await this.analyze(req));
      }
      return results;
    }
  }

  /**
   * 智能路由决策
   */
  private routeRequest(
    text: string,
    complexity: number,
    options: AnalysisOptions,
    context?: any
  ): ProcessingLayer {
    // 强制指定层级
    if (options.preferredLayer) {
      return options.preferredLayer;
    }

    // 需要讽刺检测 -> 云端LLM
    if (
      options.requireSarcasmCheck ||
      (complexity > this.config.routing.sarcasmCheckThreshold &&
        this.config.cloudLLM.enabled)
    ) {
      return ProcessingLayer.CLOUD_LLM;
    }

    // 简单情况 -> 规则引擎
    if (
      complexity < 0.3 &&
      this.config.ruleEngine.enabled &&
      this.ruleEngine.canHandle(text)
    ) {
      return ProcessingLayer.RULE_ENGINE;
    }

    // 中等复杂度 -> 本地模型
    if (this.config.localModel.enabled) {
      return complexity > 0.6
        ? ProcessingLayer.LOCAL_MODEL
        : ProcessingLayer.LOCAL_MODEL_FAST;
    }

    // 默认使用云端
    return ProcessingLayer.CLOUD_LLM;
  }

  /**
   * 使用指定层处理
   */
  private async processWithLayer(
    layer: ProcessingLayer,
    text: string,
    language: Language,
    complexity: number,
    context?: any,
    options?: AnalysisOptions
  ): Promise<SentimentResult> {
    const startTime = Date.now();
    let prediction: ModelPrediction;

    switch (layer) {
      case ProcessingLayer.RULE_ENGINE:
        prediction = await this.ruleEngine.predict(text, language);
        break;

      case ProcessingLayer.LOCAL_MODEL_FAST:
        prediction = await this.localModel.predictFast(text, language);
        break;

      case ProcessingLayer.LOCAL_MODEL:
        prediction = await this.localModel.predict(text, language);
        break;

      case ProcessingLayer.CLOUD_LLM:
        prediction = await this.cloudLLM.predict(text, language, {
          requireSarcasmCheck: options?.requireSarcasmCheck,
          context,
        });
        break;

      default:
        throw new Error(`Unknown processing layer: ${layer}`);
    }

    return {
      text,
      label: prediction.label,
      scores: prediction.scores,
      confidence: prediction.confidence,
      language,
      processingLayer: layer,
      latency: Date.now() - startTime,
      timestamp: new Date(),
    };
  }

  /**
   * 结果增强：讽刺检测、方面分析
   */
  private async enhanceResult(
    result: SentimentResult,
    text: string,
    context?: any,
    options?: AnalysisOptions
  ): Promise<SentimentResult> {
    // 讽刺检测
    if (
      options?.requireSarcasmCheck ||
      result.confidence < 0.7 ||
      this.sarcasmDetector.shouldCheck(text)
    ) {
      const sarcasmResult = await this.sarcasmDetector.detect(text, context);
      result.sarcasm = sarcasmResult;

      // 如果检测到讽刺，反转情感
      if (sarcasmResult.isSarcastic && sarcasmResult.confidence > 0.7) {
        result = this.invertSentiment(result);
      }
    }

    // 方面级情感分析
    if (options?.requireAspectAnalysis) {
      result.aspects = await this.extractAspectSentiments(text);
    }

    return result;
  }

  /**
   * 降级处理
   */
  private async fallbackProcess(
    text: string,
    language: Language,
    context?: any,
    options?: AnalysisOptions
  ): Promise<SentimentResult> {
    // 依次尝试规则引擎和本地模型
    if (this.config.ruleEngine.enabled) {
      return this.processWithLayer(
        ProcessingLayer.RULE_ENGINE,
        text,
        language,
        0,
        context,
        options
      );
    }

    if (this.config.localModel.enabled) {
      return this.processWithLayer(
        ProcessingLayer.LOCAL_MODEL_FAST,
        text,
        language,
        0,
        context,
        options
      );
    }

    throw new Error('All processing layers failed');
  }

  /**
   * 反转情感（用于讽刺检测后）
   */
  private invertSentiment(result: SentimentResult): SentimentResult {
    const invertedScores = {
      positive: result.scores.negative,
      negative: result.scores.positive,
      neutral: result.scores.neutral,
    };

    let newLabel = result.label;
    if (result.label === 'positive') newLabel = 'negative';
    else if (result.label === 'negative') newLabel = 'positive';

    return {
      ...result,
      label: newLabel,
      scores: invertedScores,
    };
  }

  /**
   * 预处理文本
   */
  private preprocess(text: string): string {
    return text
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F]/g, ''); // 移除控制字符
  }

  private shouldUseCache(options: AnalysisOptions): boolean {
    return options.useCache !== false && this.config.cache.enabled;
  }

  private async extractAspectSentiments(
    text: string
  ): Promise<any[]> {
    // 方面级情感分析实现
    return [];
  }

  /**
   * 获取系统状态
   */
  getStatus(): { layer: ProcessingLayer; healthy: boolean }[] {
    return [
      { layer: ProcessingLayer.RULE_ENGINE, healthy: true },
      { layer: ProcessingLayer.LOCAL_MODEL, healthy: this.localModel.isHealthy() },
      { layer: ProcessingLayer.CLOUD_LLM, healthy: this.cloudLLM.isHealthy() },
    ];
  }
}

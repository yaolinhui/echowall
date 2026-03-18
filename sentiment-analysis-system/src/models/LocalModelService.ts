/**
 * 本地模型服务
 * 调用 Python 后端或本地运行的 ONNX/TensorFlow 模型
 */

import { ModelPrediction, Language, SentimentLabel, LayerConfig } from '../core/types';

export class LocalModelService {
  private config: LayerConfig;
  private modelLoaded: boolean = false;
  private modelEndpoint?: string;

  constructor(config: LayerConfig) {
    this.config = config;
    this.modelEndpoint = process.env.LOCAL_MODEL_ENDPOINT || 'http://localhost:8000';
  }

  /**
   * 标准预测（使用完整模型）
   */
  async predict(text: string, language: Language): Promise<ModelPrediction> {
    const startTime = Date.now();

    try {
      // 调用 Python 模型服务
      const response = await fetch(`${this.modelEndpoint}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language, model: this.config.modelName }),
      });

      if (!response.ok) {
        throw new Error(`Model API error: ${response.status}`);
      }

      const result = await response.json();

      return {
        label: result.label,
        confidence: result.confidence,
        scores: result.scores,
        modelName: this.config.modelName || 'local_transformer',
        latency: Date.now() - startTime,
      };
    } catch (error) {
      console.error('Local model prediction failed:', error);
      // 返回中性结果
      return this.getFallbackResult(startTime);
    }
  }

  /**
   * 快速预测（使用轻量级模型）
   */
  async predictFast(text: string, language: Language): Promise<ModelPrediction> {
    const startTime = Date.now();

    try {
      const response = await fetch(`${this.modelEndpoint}/predict/fast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language }),
      });

      if (!response.ok) {
        throw new Error(`Fast model API error: ${response.status}`);
      }

      const result = await response.json();

      return {
        label: result.label,
        confidence: result.confidence * 0.95, // 快速模型置信度稍降
        scores: result.scores,
        modelName: 'local_distilbert',
        latency: Date.now() - startTime,
      };
    } catch (error) {
      console.error('Fast model prediction failed:', error);
      return this.getFallbackResult(startTime);
    }
  }

  /**
   * 批量预测
   */
  async predictBatch(
    texts: string[],
    language: Language
  ): Promise<ModelPrediction[]> {
    const startTime = Date.now();

    try {
      const response = await fetch(`${this.modelEndpoint}/predict/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts, language }),
      });

      if (!response.ok) {
        throw new Error(`Batch prediction error: ${response.status}`);
      }

      const results = await response.json();

      return results.map((r: any) => ({
        label: r.label,
        confidence: r.confidence,
        scores: r.scores,
        modelName: this.config.modelName || 'local_transformer',
        latency: (Date.now() - startTime) / texts.length,
      }));
    } catch (error) {
      console.error('Batch prediction failed:', error);
      return texts.map(() => this.getFallbackResult(startTime));
    }
  }

  /**
   * 健康检查
   */
  isHealthy(): boolean {
    // 实际实现中应检查模型服务状态
    return true;
  }

  private getFallbackResult(startTime: number): ModelPrediction {
    return {
      label: SentimentLabel.NEUTRAL,
      confidence: 0.5,
      scores: { positive: 0.33, negative: 0.33, neutral: 0.34 },
      modelName: 'fallback',
      latency: Date.now() - startTime,
    };
  }
}

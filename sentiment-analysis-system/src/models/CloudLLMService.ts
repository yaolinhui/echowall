/**
 * 云端大模型服务
 * OpenAI GPT / Claude / Google Gemini 等
 */

import { ModelPrediction, Language, SentimentLabel, LayerConfig } from '../core/types';

interface LLMOptions {
  requireSarcasmCheck?: boolean;
  context?: any;
  temperature?: number;
}

export class CloudLLMService {
  private config: LayerConfig;
  private apiKey: string;
  private apiEndpoint: string;
  private modelName: string;

  constructor(config: LayerConfig) {
    this.config = config;
    this.apiKey = process.env.OPENAI_API_KEY || '';
    this.apiEndpoint = 'https://api.openai.com/v1/chat/completions';
    this.modelName = config.modelName || 'gpt-4o-mini';
  }

  /**
   * 使用云端LLM预测
   */
  async predict(
    text: string,
    language: Language,
    options: LLMOptions = {}
  ): Promise<ModelPrediction> {
    const startTime = Date.now();

    const prompt = this.buildPrompt(text, language, options);

    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.modelName,
          messages: [
            {
              role: 'system',
              content: this.getSystemPrompt(language),
            },
            { role: 'user', content: prompt },
          ],
          temperature: options.temperature ?? 0.3,
          max_tokens: 200,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`LLM API error: ${response.status} - ${error}`);
      }

      const result = await response.json();
      const content = result.choices[0]?.message?.content;

      if (!content) {
        throw new Error('Empty response from LLM');
      }

      const parsed = JSON.parse(content);

      return {
        label: this.normalizeLabel(parsed.sentiment),
        confidence: parsed.confidence || 0.9,
        scores: parsed.scores || this.labelToScores(parsed.sentiment),
        modelName: this.modelName,
        latency: Date.now() - startTime,
      };
    } catch (error) {
      console.error('Cloud LLM prediction failed:', error);
      return this.getFallbackResult(startTime);
    }
  }

  /**
   * 专门用于讽刺检测
   */
  async detectSarcasm(text: string, context?: any): Promise<{
    isSarcastic: boolean;
    confidence: number;
    explanation?: string;
  }> {
    const prompt = `分析以下文本是否包含讽刺语气：

文本："${text}"
${context ? `上下文：${JSON.stringify(context)}` : ''}

请判断：
1. 是否包含讽刺（是/否）
2. 置信度（0-1）
3. 简要解释原因

以JSON格式返回：{"is_sarcastic": boolean, "confidence": number, "explanation": string}`;

    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.modelName,
          messages: [
            {
              role: 'system',
              content: '你是专业的文本情感分析专家，擅长识别讽刺和隐含意义。',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.2,
          max_tokens: 200,
          response_format: { type: 'json_object' },
        }),
      });

      const result = await response.json();
      const content = result.choices[0]?.message?.content;
      return JSON.parse(content);
    } catch (error) {
      console.error('Sarcasm detection failed:', error);
      return { isSarcastic: false, confidence: 0 };
    }
  }

  isHealthy(): boolean {
    // 实际实现中应调用健康检查端点
    return !!this.apiKey;
  }

  private buildPrompt(
    text: string,
    language: Language,
    options: LLMOptions
  ): string {
    let prompt = '';

    // 基础情感分析提示
    prompt += `请分析以下文本的情感倾向：\n\n"${text}"\n\n`;

    // 讽刺检测要求
    if (options.requireSarcasmCheck) {
      prompt += `特别注意：\n- 检测是否存在讽刺、反语\n- 考虑正面词汇在负面语境中的使用\n- 注意夸张表达和标点符号暗示\n\n`;
    }

    // 输出格式要求
    prompt += `请以JSON格式返回结果，包含以下字段：\n`;
    prompt += `- sentiment: "positive" | "negative" | "neutral" | "mixed"\n`;
    prompt += `- confidence: 0-1之间的置信度\n`;
    prompt += `- scores: {positive, negative, neutral} 的概率分布\n`;

    if (options.requireSarcasmCheck) {
      prompt += `- is_sarcastic: boolean\n`;
      prompt += `- sarcasm_confidence: 0-1\n`;
    }

    // 示例（Few-shot）
    if (language === Language.ZH) {
      prompt += `\n示例：\n`;
      prompt += `输入："这个产品太棒了，一天崩溃三次"\n`;
      prompt += `输出：{"sentiment": "negative", "confidence": 0.9, "scores": {"positive": 0.05, "negative": 0.85, "neutral": 0.1}, "is_sarcastic": true, "sarcasm_confidence": 0.92}\n`;
    }

    return prompt;
  }

  private getSystemPrompt(language: Language): string {
    const basePrompt = `You are an expert sentiment analysis system. Analyze the emotional tone of the given text accurately.`;

    if (language === Language.ZH) {
      return `${basePrompt} You specialize in Chinese text analysis, including detecting sarcasm, understanding context, and handling code-mixed Chinese-English content.`;
    }

    return basePrompt;
  }

  private normalizeLabel(label: string): SentimentLabel {
    const normalized = label.toLowerCase().trim();
    if (normalized.includes('positive')) return SentimentLabel.POSITIVE;
    if (normalized.includes('negative')) return SentimentLabel.NEGATIVE;
    if (normalized.includes('mixed')) return SentimentLabel.MIXED;
    return SentimentLabel.NEUTRAL;
  }

  private labelToScores(label: string): {
    positive: number;
    negative: number;
    neutral: number;
  } {
    switch (this.normalizeLabel(label)) {
      case SentimentLabel.POSITIVE:
        return { positive: 0.85, negative: 0.05, neutral: 0.1 };
      case SentimentLabel.NEGATIVE:
        return { positive: 0.05, negative: 0.85, neutral: 0.1 };
      case SentimentLabel.MIXED:
        return { positive: 0.4, negative: 0.4, neutral: 0.2 };
      default:
        return { positive: 0.2, negative: 0.2, neutral: 0.6 };
    }
  }

  private getFallbackResult(startTime: number): ModelPrediction {
    return {
      label: SentimentLabel.NEUTRAL,
      confidence: 0.5,
      scores: { positive: 0.33, negative: 0.33, neutral: 0.34 },
      modelName: 'llm_fallback',
      latency: Date.now() - startTime,
    };
  }
}

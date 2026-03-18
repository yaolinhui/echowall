/**
 * 规则引擎 - 快速路径处理
 * 基于词典和规则的情感分析
 */

import {
  ModelPrediction,
  SentimentLabel,
  Language,
  SentimentScore,
} from '../core/types';
import { SentimentDictionaries } from './dictionaries';

interface Rule {
  pattern: RegExp;
  label: SentimentLabel;
  weight: number;
  description: string;
}

export class RuleEngine {
  private dictionaries: SentimentDictionaries;
  private rules: Rule[];

  constructor() {
    this.dictionaries = new SentimentDictionaries();
    this.rules = this.initializeRules();
  }

  /**
   * 预测情感
   */
  async predict(text: string, language: Language): Promise<ModelPrediction> {
    const startTime = Date.now();

    // 1. 词典匹配
    const dictScore = this.dictionaries.match(text, language);

    // 2. 规则匹配
    const ruleScore = this.applyRules(text);

    // 3. 加权融合
    const finalScore = this.aggregateScores(dictScore, ruleScore);

    // 4. 确定标签
    const label = this.determineLabel(finalScore);
    const confidence = this.calculateConfidence(finalScore, text);

    return {
      label,
      confidence,
      scores: finalScore,
      modelName: 'rule_engine',
      latency: Date.now() - startTime,
    };
  }

  /**
   * 判断是否能处理该文本
   */
  canHandle(text: string): boolean {
    if (text.length < 3) return false;
    const hasSentimentWords = this.dictionaries.hasMatch(text);
    const hasStrongPattern = this.rules.some(
      (r) => r.weight > 0.8 && r.pattern.test(text)
    );
    return hasSentimentWords || hasStrongPattern;
  }

  private initializeRules(): Rule[] {
    return [
      // 强烈正面模式
      {
        pattern: /^(太[棒好了]|超级|非常|真心|绝对).*?(好|棒|赞|喜欢|爱)/,
        label: SentimentLabel.POSITIVE,
        weight: 0.9,
        description: '强烈正面表达',
      },
      {
        pattern: /(love|amazing|excellent|perfect|awesome|best).*?/i,
        label: SentimentLabel.POSITIVE,
        weight: 0.85,
        description: '英文强烈正面',
      },
      // 强烈负面模式
      {
        pattern: /^(太[差烂糟]|超级|非常|真心|绝对).*?(差|烂|糟|讨厌|恨)/,
        label: SentimentLabel.NEGATIVE,
        weight: 0.9,
        description: '强烈负面表达',
      },
      {
        pattern: /(hate|terrible|awful|worst|horrible|disgusting).*?/i,
        label: SentimentLabel.NEGATIVE,
        weight: 0.85,
        description: '英文强烈负面',
      },
      // 疑问/中性模式
      {
        pattern: /^([怎么|什么|如何|为什么|请问]).*?[?？]$/,
        label: SentimentLabel.NEUTRAL,
        weight: 0.7,
        description: '疑问句',
      },
      // 反问/讽刺模式
      {
        pattern: /^(难道|不是|莫非).*?[?？]$/,
        label: SentimentLabel.NEUTRAL,
        weight: 0.6,
        description: '反问句(可能是讽刺)',
      },
    ];
  }

  private applyRules(text: string): Partial<SentimentScore> {
    let positiveWeight = 0;
    let negativeWeight = 0;
    let neutralWeight = 0;

    for (const rule of this.rules) {
      if (rule.pattern.test(text)) {
        switch (rule.label) {
          case SentimentLabel.POSITIVE:
            positiveWeight += rule.weight;
            break;
          case SentimentLabel.NEGATIVE:
            negativeWeight += rule.weight;
            break;
          case SentimentLabel.NEUTRAL:
            neutralWeight += rule.weight;
            break;
        }
      }
    }

    // 归一化
    const total = positiveWeight + negativeWeight + neutralWeight;
    if (total === 0) return { positive: 0, negative: 0, neutral: 1 };

    return {
      positive: positiveWeight / total,
      negative: negativeWeight / total,
      neutral: neutralWeight / total,
    };
  }

  private aggregateScores(
    dictScore: Partial<SentimentScore>,
    ruleScore: Partial<SentimentScore>
  ): SentimentScore {
    // 词典权重 0.6，规则权重 0.4
    const w1 = 0.6;
    const w2 = 0.4;

    return {
      positive: (dictScore.positive || 0) * w1 + (ruleScore.positive || 0) * w2,
      negative: (dictScore.negative || 0) * w1 + (ruleScore.negative || 0) * w2,
      neutral: (dictScore.neutral || 0) * w1 + (ruleScore.neutral || 0) * w2,
    };
  }

  private determineLabel(scores: SentimentScore): SentimentLabel {
    const { positive, negative, neutral } = scores;
    const max = Math.max(positive, negative, neutral);

    if (max === positive) return SentimentLabel.POSITIVE;
    if (max === negative) return SentimentLabel.NEGATIVE;
    return SentimentLabel.NEUTRAL;
  }

  private calculateConfidence(scores: SentimentScore, text: string): number {
    // 基于分数差距和文本长度计算置信度
    const values = [scores.positive, scores.negative, scores.neutral];
    const max = Math.max(...values);
    const secondMax = values.sort((a, b) => b - a)[1];
    const gap = max - secondMax;

    // 基础置信度
    let confidence = 0.5 + gap * 0.5;

    // 短文本降低置信度
    if (text.length < 10) confidence *= 0.9;

    // 规则引擎最大置信度限制
    return Math.min(confidence, 0.85);
  }
}

/**
 * 文本复杂度评估器
 * 用于智能路由决策
 */

import { Language } from '../core/types';

export interface ComplexityFactors {
  length: number;
  vocabulary: number;
  structure: number;
  sentiment: number;
  context: number;
}

export class ComplexityAssessor {
  /**
   * 评估文本复杂度
   * 返回 0-1 之间的分数，越高越复杂
   */
  assess(text: string, language: Language): number {
    const factors = this.calculateFactors(text, language);
    return this.aggregateScore(factors);
  }

  /**
   * 计算各项复杂度因子
   */
  calculateFactors(text: string, language: Language): ComplexityFactors {
    return {
      length: this.assessLength(text),
      vocabulary: this.assessVocabulary(text, language),
      structure: this.assessStructure(text),
      sentiment: this.assessSentimentComplexity(text),
      context: this.assessContextDependency(text),
    };
  }

  private assessLength(text: string): number {
    const length = text.length;
    if (length < 20) return 0.1;
    if (length < 50) return 0.3;
    if (length < 100) return 0.5;
    if (length < 200) return 0.7;
    return 0.9;
  }

  private assessVocabulary(text: string, language: Language): number {
    let score = 0;

    // 专业术语密度
    const techTerms = this.extractTechTerms(text);
    const techDensity = techTerms.length / (text.length / 10);
    score += Math.min(techDensity * 0.3, 0.3);

    // 生僻词/复杂词
    if (language === Language.EN) {
      const longWords = text.split(/\s+/).filter((w) => w.length > 8);
      score += Math.min(longWords.length * 0.1, 0.3);
    } else if (language === Language.ZH) {
      // 中文生僻字检测（笔画较多）
      const rareChars = text.match(/[瀚巍矗饕饕餮耄耋]/g);
      score += Math.min((rareChars?.length || 0) * 0.1, 0.2);
    }

    // 混合语言复杂度
    if (language === Language.MIXED) {
      score += 0.2;
    }

    return Math.min(score, 1);
  }

  private assessStructure(text: string): number {
    let score = 0;

    // 句子数量
    const sentences = text.split(/[.!?。？！]+/).filter(Boolean);
    if (sentences.length > 3) score += 0.2;
    if (sentences.length > 5) score += 0.2;

    // 从句/连接词
    const conjunctions = [
      '虽然', '但是', '因为', '所以', '如果', '即使', '尽管',
      'although', 'though', 'because', 'since', 'if', 'unless', 'while',
    ];
    const conjCount = conjunctions.reduce(
      (count, word) => count + (text.toLowerCase().includes(word) ? 1 : 0),
      0
    );
    score += Math.min(conjCount * 0.1, 0.3);

    // 引号使用（可能包含引用或讽刺）
    const quotes = text.match(/[""''"']/g);
    if (quotes && quotes.length >= 2) score += 0.2;

    // 括号使用（包含额外信息）
    const brackets = text.match(/[（(].*?[)）]/g);
    if (brackets && brackets.length > 0) score += 0.1;

    return Math.min(score, 1);
  }

  private assessSentimentComplexity(text: string): number {
    let score = 0;

    // 情感转折词
    const contrastWords = [
      '但是', '然而', '不过', '却', '反而', '竟然',
      'but', 'however', 'yet', 'though', 'although', 'nevertheless',
    ];
    const contrastCount = contrastWords.reduce(
      (count, word) => count + (text.toLowerCase().includes(word) ? 1 : 0),
      0
    );
    score += Math.min(contrastCount * 0.2, 0.4);

    // 情感词混合
    const positiveWords = ['好', '棒', '赞', 'good', 'great', 'love', 'like'];
    const negativeWords = ['差', '烂', '糟', 'bad', 'terrible', 'hate'];

    const hasPositive = positiveWords.some((w) => text.toLowerCase().includes(w));
    const hasNegative = negativeWords.some((w) => text.toLowerCase().includes(w));

    if (hasPositive && hasNegative) {
      score += 0.4; // 混合情感通常需要更复杂的分析
    }

    // 否定词
    const negations = ['不', '没', '无', 'not', 'no', 'never', "n't"];
    const negCount = negations.reduce(
      (count, word) => count + (text.toLowerCase().includes(word) ? 1 : 0),
      0
    );
    score += Math.min(negCount * 0.1, 0.2);

    return Math.min(score, 1);
  }

  private assessContextDependency(text: string): number {
    let score = 0;

    // 指代词
    const pronouns = [
      '这', '那', '它', '他', '她', '此', '其',
      'this', 'that', 'it', 'they', 'them', 'these', 'those',
    ];
    const pronounCount = pronouns.reduce(
      (count, word) => count + (text.toLowerCase().includes(word) ? 1 : 0),
      0
    );
    score += Math.min(pronounCount * 0.1, 0.3);

    // 省略句（如"还不错"等简短评价）
    if (text.length < 15) {
      score += 0.2; // 短文本可能依赖上下文
    }

    // 特定领域的隐含意义
    const implicitPatterns = [
      /有点?.*?(?:慢|卡|问题)/,
      /(?:感觉|觉得).*?还?好/,
      /(?:希望|期待).*?(?:改进|优化)/,
    ];
    for (const pattern of implicitPatterns) {
      if (pattern.test(text)) {
        score += 0.2;
        break;
      }
    }

    return Math.min(score, 1);
  }

  private extractTechTerms(text: string): string[] {
    const techTerms = [
      // 通用技术
      'api', 'sdk', 'ui', 'ux', 'app', 'bug', 'crash', 'error',
      'database', 'server', 'client', 'frontend', 'backend',
      // 性能相关
      'latency', 'throughput', 'bandwidth', 'memory', 'cpu', 'gpu',
      '响应时间', '并发', '负载', '优化', '缓存',
      // 开发相关
      'github', 'git', 'code', 'debug', 'deploy', 'ci/cd',
      '版本控制', '敏捷', '迭代', '测试',
    ];

    return techTerms.filter((term) =>
      text.toLowerCase().includes(term.toLowerCase())
    );
  }

  private aggregateScore(factors: ComplexityFactors): number {
    // 加权平均
    const weights = {
      length: 0.15,
      vocabulary: 0.2,
      structure: 0.2,
      sentiment: 0.25,
      context: 0.2,
    };

    let score = 0;
    score += factors.length * weights.length;
    score += factors.vocabulary * weights.vocabulary;
    score += factors.structure * weights.structure;
    score += factors.sentiment * weights.sentiment;
    score += factors.context * weights.context;

    return Math.min(score, 1);
  }

  /**
   * 获取复杂度详细分析
   */
  getDetailedAnalysis(text: string, language: Language) {
    const factors = this.calculateFactors(text, language);
    const total = this.aggregateScore(factors);

    return {
      totalScore: total,
      level: this.getLevel(total),
      factors,
      recommendation: this.getRecommendation(total),
    };
  }

  private getLevel(score: number): 'low' | 'medium' | 'high' | 'very_high' {
    if (score < 0.3) return 'low';
    if (score < 0.5) return 'medium';
    if (score < 0.7) return 'high';
    return 'very_high';
  }

  private getRecommendation(score: number): string {
    if (score < 0.3) return '使用规则引擎处理';
    if (score < 0.5) return '使用快速本地模型';
    if (score < 0.7) return '使用标准本地模型';
    return '建议使用云端大模型';
  }
}

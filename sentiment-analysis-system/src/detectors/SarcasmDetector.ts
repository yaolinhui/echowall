/**
 * 讽刺检测器
 * 多层检测架构：规则层 -> 嵌入层 -> 上下文层 -> LLM层
 */

import { SarcasmDetectionResult, AnalysisContext } from '../core/types';

interface SarcasmCue {
  type: 'lexical' | 'punctuation' | 'emoji' | 'semantic';
  pattern: string;
  weight: number;
}

export class SarcasmDetector {
  private lexicalCues: SarcasmCue[];
  private punctuationPattern: RegExp;
  private emojiPattern: RegExp;
  private contradictionPatterns: RegExp[];

  constructor() {
    this.lexicalCues = this.initializeLexicalCues();
    this.punctuationPattern = /[!?]{2,}|\.{3,}|！{2,}|？{2,}/g;
    this.emojiPattern = this.buildSarcasmEmojiPattern();
    this.contradictionPatterns = this.initializeContradictionPatterns();
  }

  /**
   * 讽刺检测主入口
   */
  async detect(
    text: string,
    context?: AnalysisContext
  ): Promise<SarcasmDetectionResult> {
    const cues: string[] = [];
    let totalWeight = 0;

    // 1. 词汇线索检测
    const lexicalScore = this.detectLexicalCues(text, cues);
    totalWeight += lexicalScore;

    // 2. 标点模式检测
    const punctuationScore = this.detectPunctuationPatterns(text, cues);
    totalWeight += punctuationScore;

    // 3. 表情符号检测
    const emojiScore = this.detectSarcasmEmojis(text, cues);
    totalWeight += emojiScore;

    // 4. 语义矛盾检测
    const semanticScore = this.detectSemanticContradiction(text, cues);
    totalWeight += semanticScore;

    // 5. 上下文分析（如果有历史记录）
    if (context?.conversationHistory && context.conversationHistory.length > 0) {
      const contextScore = this.analyzeContext(text, context, cues);
      totalWeight += contextScore;
    }

    // 6. 计算最终置信度
    const confidence = this.calculateConfidence(totalWeight, text);
    const isSarcastic = confidence > 0.6;

    return {
      isSarcastic,
      confidence: Math.min(confidence, 0.95),
      cues: cues.length > 0 ? cues : undefined,
    };
  }

  /**
   * 快速判断是否需要讽刺检测
   */
  shouldCheck(text: string): boolean {
    // 检查是否有潜在的讽刺信号
    if (this.punctuationPattern.test(text)) return true;
    if (this.emojiPattern.test(text)) return true;
    
    // 检查是否有反讽词汇
    const sarcasmWords = ['呵呵', '真棒', '真好', '太好了', '真是', '厉害', 'great', 'wonderful', 'perfect'];
    const lowerText = text.toLowerCase();
    return sarcasmWords.some((word) => lowerText.includes(word));
  }

  private initializeLexicalCues(): SarcasmCue[] {
    return [
      // 中文讽刺词汇
      { type: 'lexical', pattern: '呵呵', weight: 0.6 },
      { type: 'lexical', pattern: '真棒', weight: 0.5 },
      { type: 'lexical', pattern: '真好', weight: 0.5 },
      { type: 'lexical', pattern: '太好了', weight: 0.6 },
      { type: 'lexical', pattern: '真是', weight: 0.4 },
      { type: 'lexical', pattern: '真厉害', weight: 0.5 },
      { type: 'lexical', pattern: '佩服', weight: 0.4 },
      { type: 'lexical', pattern: '长见识', weight: 0.5 },
      { type: 'lexical', pattern: '受教', weight: 0.4 },
      { type: 'lexical', pattern: '大开眼界', weight: 0.5 },
      // 英文讽刺词汇
      { type: 'lexical', pattern: 'yeah right', weight: 0.7 },
      { type: 'lexical', pattern: 'sure', weight: 0.4 },
      { type: 'lexical', pattern: 'obviously', weight: 0.3 },
      { type: 'lexical', pattern: 'clearly', weight: 0.3 },
      { type: 'lexical', pattern: 'brilliant', weight: 0.4 },
      { type: 'lexical', pattern: 'genius', weight: 0.5 },
      { type: 'lexical', pattern: 'wonderful', weight: 0.4 },
      { type: 'lexical', pattern: 'fantastic', weight: 0.4 },
    ];
  }

  private initializeContradictionPatterns(): RegExp[] {
    return [
      // 正面词汇 + 负面情境
      /(好|棒|赞|优秀|喜欢|love|great|good|perfect).*?(但是|不过|就是|yet|but|however)/i,
      /(但是|不过|就是|yet|but|however).*?(好|棒|赞|优秀|喜欢|love|great|good|perfect)/i,
      // 夸张表达
      /真{2,}/,
      /太{2,}/,
      /非常{2,}/,
      // 引号使用（暗示反话）
      /[""''](.*?)[""'']/,
    ];
  }

  private buildSarcasmEmojiPattern(): RegExp {
    const sarcasmEmojis = ['🙃', '🤡', '💀', '😑', '😐', '😶', '😒', '🙄', '😬', '🤥', '🤦', '🤷', '👏', '💩'];
    return new RegExp(sarcasmEmojis.join('|'), 'g');
  }

  private detectLexicalCues(text: string, cues: string[]): number {
    let score = 0;
    const lowerText = text.toLowerCase();

    for (const cue of this.lexicalCues) {
      if (lowerText.includes(cue.pattern.toLowerCase())) {
        score += cue.weight;
        cues.push(`lexical:${cue.pattern}`);
      }
    }

    return Math.min(score, 1.0);
  }

  private detectPunctuationPatterns(text: string, cues: string[]): number {
    const matches = text.match(this.punctuationPattern);
    if (!matches) return 0;

    let score = 0;
    for (const match of matches) {
      if (match.includes('...') || match.includes('…')) {
        score += 0.3;
        cues.push('punctuation:ellipsis');
      }
      if (match.includes('!?') || match.includes('?!')) {
        score += 0.4;
        cues.push('punctuation:mixed');
      }
      if (/[!！]{2,}/.test(match)) {
        score += 0.2;
        cues.push('punctuation:excessive_exclamation');
      }
    }

    return Math.min(score, 0.8);
  }

  private detectSarcasmEmojis(text: string, cues: string[]): number {
    const matches = text.match(this.emojiPattern);
    if (!matches) return 0;

    cues.push(`emoji:${matches.join('')}`);
    return Math.min(matches.length * 0.3, 0.6);
  }

  private detectSemanticContradiction(text: string, cues: string[]): number {
    let score = 0;

    for (const pattern of this.contradictionPatterns) {
      if (pattern.test(text)) {
        score += 0.3;
        cues.push(`semantic:contradiction`);
        break;
      }
    }

    // 检查正面词 + 负面词的组合
    const positiveWords = ['好', '棒', '赞', '优秀', '喜欢', 'good', 'great', 'love', 'like'];
    const negativeWords = ['差', '烂', '糟', '讨厌', 'bad', 'terrible', 'hate'];

    const hasPositive = positiveWords.some((w) => text.toLowerCase().includes(w));
    const hasNegative = negativeWords.some((w) => text.toLowerCase().includes(w));

    if (hasPositive && hasNegative) {
      score += 0.4;
      cues.push('semantic:mixed_sentiment');
    }

    return Math.min(score, 0.8);
  }

  private analyzeContext(
    text: string,
    context: AnalysisContext,
    cues: string[]
  ): number {
    const history = context.conversationHistory || [];
    if (history.length === 0) return 0;

    // 检查历史情感趋势
    // 如果之前是负面，现在是正面，可能是讽刺
    // 简化的启发式规则
    const recentHistory = history.slice(-3).join(' ');
    
    const negativeIndicators = ['bug', 'error', 'problem', 'issue', 'crash', '卡', '慢', '崩溃', 'bug'];
    const positiveIndicators = ['好', '棒', 'great', 'good', 'love', 'perfect'];

    const hadNegative = negativeIndicators.some((w) => recentHistory.toLowerCase().includes(w));
    const nowPositive = positiveIndicators.some((w) => text.toLowerCase().includes(w));

    if (hadNegative && nowPositive) {
      cues.push('context:negative_to_positive');
      return 0.5;
    }

    return 0;
  }

  private calculateConfidence(totalWeight: number, text: string): number {
    // 基础置信度
    let confidence = totalWeight;

    // 文本长度调整
    if (text.length < 10) {
      // 短文本不确定性更高
      confidence *= 0.8;
    } else if (text.length > 100) {
      // 长文本有更多上下文信息
      confidence *= 1.1;
    }

    // 多线索增强
    const cueCount = Math.floor(totalWeight / 0.3);
    if (cueCount >= 2) {
      confidence *= 1.2;
    }

    return Math.min(confidence, 0.95);
  }
}

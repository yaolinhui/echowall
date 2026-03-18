/**
 * 情感词典管理
 * 支持中文、英文和混合语言
 */

import { Language, SentimentScore } from '../core/types';

interface Dictionary {
  positive: Set<string>;
  negative: Set<string>;
  neutral: Set<string>;
  intensifiers: Map<string, number>;
  negations: Set<string>;
}

export class SentimentDictionaries {
  private dictionaries: Map<Language, Dictionary>;

  constructor() {
    this.dictionaries = new Map();
    this.initializeDictionaries();
  }

  /**
   * 匹配文本中的情感词
   */
  match(text: string, language: Language): SentimentScore {
    const dict = this.dictionaries.get(language) || this.dictionaries.get(Language.MIXED)!;
    
    let positiveCount = 0;
    let negativeCount = 0;
    let neutralCount = 0;
    
    const words = this.tokenize(text, language);
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const lowerWord = word.toLowerCase();
      
      // 检查是否被否定
      const isNegated = this.isNegated(words, i);
      
      // 检查强度词
      const intensity = this.getIntensity(words, i);
      
      if (dict.positive.has(lowerWord) || dict.positive.has(word)) {
        const score = isNegated ? -1 * intensity : 1 * intensity;
        positiveCount += Math.max(0, score);
        negativeCount += Math.max(0, -score);
      } else if (dict.negative.has(lowerWord) || dict.negative.has(word)) {
        const score = isNegated ? 1 * intensity : -1 * intensity;
        negativeCount += Math.max(0, -score);
        positiveCount += Math.max(0, score);
      } else if (dict.neutral.has(lowerWord) || dict.neutral.has(word)) {
        neutralCount += 0.5 * intensity;
      }
    }

    // 归一化
    const total = positiveCount + negativeCount + neutralCount || 1;
    return {
      positive: positiveCount / total,
      negative: negativeCount / total,
      neutral: neutralCount / total,
    };
  }

  /**
   * 检查是否有匹配的情感词
   */
  hasMatch(text: string): boolean {
    const allDicts = Array.from(this.dictionaries.values());
    const words = this.tokenize(text, Language.MIXED);
    
    for (const word of words) {
      const lowerWord = word.toLowerCase();
      for (const dict of allDicts) {
        if (
          dict.positive.has(word) ||
          dict.positive.has(lowerWord) ||
          dict.negative.has(word) ||
          dict.negative.has(lowerWord)
        ) {
          return true;
        }
      }
    }
    return false;
  }

  private initializeDictionaries(): void {
    // 中文词典
    this.dictionaries.set(Language.ZH, {
      positive: new Set([
        // 基础正面词
        '好', '棒', '赞', '优秀', '喜欢', '爱', '完美', '满意', '不错', '推荐',
        '开心', '高兴', '快乐', '幸福', '舒服', '顺利', '成功', '值得', '给力',
        // 技术产品正面
        '流畅', '丝滑', '快速', '稳定', '简洁', '易用', '强大', '实用', '高效',
        '清晰', '精准', '智能', '创新', '好用', '顺手', '省心', '放心', '靠谱',
        // 网络用语
        'yyds', '绝绝子', '爱了', '种草', '打call', '666', '牛', '强', '顶',
      ]),
      negative: new Set([
        // 基础负面词
        '差', '烂', '糟', '讨厌', '恨', '恶心', '失望', '后悔', '垃圾', '坑',
        '难过', '伤心', '痛苦', '糟糕', '郁闷', '烦', '气', '怒', '不爽',
        // 技术产品负面
        '卡顿', '慢', '崩溃', '闪退', 'bug', '难用', '复杂', '混乱', '粗糙',
        '模糊', '错误', '失效', '故障', '有问题', '不好用', '麻烦', '费劲',
        // 网络用语
        '踩雷', '拔草', '吐槽', '辣鸡', '坑爹', '无语', '服了', '离谱', '烂',
      ]),
      neutral: new Set([
        '一般', '还行', '凑合', '普通', '正常', '平均', '中等', '还好',
      ]),
      intensifiers: new Map([
        ['很', 1.5], ['非常', 2.0], ['超级', 2.5], ['特别', 1.8], ['太', 1.6],
        ['真的', 1.4], ['十分', 1.7], ['极其', 2.2], ['绝对', 2.0], ['相当', 1.5],
        ['有点', 0.6], ['稍微', 0.5], ['略微', 0.5], ['比较', 0.8],
        ['too', 1.5], ['very', 1.5], ['extremely', 2.2], ['super', 2.0],
        ['really', 1.6], ['quite', 1.3], ['somewhat', 0.6], ['slightly', 0.5],
      ]),
      negations: new Set([
        '不', '没', '无', '非', '莫', '勿', '没有', '不是', '不能', '不会',
        '别', '不要', '不可能', '未必', '从不', ' hardly', 'not', 'no', 'never',
        'none', 'nobody', 'nothing', 'neither', 'nowhere', "don't", "doesn't",
        "didn't", "won't", "wouldn't", "can't", "cannot", "isn't", "aren't",
      ]),
    });

    // 英文词典
    this.dictionaries.set(Language.EN, {
      positive: new Set([
        'good', 'great', 'excellent', 'amazing', 'awesome', 'perfect', 'love',
        'like', 'best', 'wonderful', 'fantastic', 'brilliant', 'outstanding',
        'superb', 'magnificent', 'beautiful', 'nice', 'happy', 'pleased',
        'satisfied', 'recommend', 'smooth', 'fast', 'stable', 'simple', 'easy',
        'powerful', 'useful', 'efficient', 'clear', 'accurate', 'smart',
        'innovative', 'intuitive', 'reliable', 'solid', 'impressive',
      ]),
      negative: new Set([
        'bad', 'terrible', 'awful', 'horrible', 'worst', 'hate', 'dislike',
        'poor', 'disappointing', 'useless', 'waste', 'fail', 'broken',
        'slow', 'laggy', 'crash', 'buggy', 'unstable', 'complicated',
        'difficult', 'confusing', 'messy', 'rough', 'vague', 'wrong',
        'error', 'fault', 'problem', 'issue', 'annoying', 'frustrating',
      ]),
      neutral: new Set([
        'average', 'normal', 'standard', 'regular', 'common', 'okay', 'ok',
        'fine', 'decent', 'fair', 'moderate', 'mediocre',
      ]),
      intensifiers: new Map([
        ['very', 1.5], ['really', 1.6], ['extremely', 2.2], ['super', 2.0],
        ['quite', 1.3], ['pretty', 1.2], ['somewhat', 0.6], ['slightly', 0.5],
        ['too', 1.5], ['so', 1.4], ['incredibly', 2.0], ['absolutely', 2.0],
      ]),
      negations: new Set([
        'not', 'no', 'never', 'none', 'nobody', 'nothing', 'neither', 'nowhere',
        "don't", "doesn't", "didn't", "won't", "wouldn't", "can't", "cannot",
        "isn't", "aren't", "wasn't", "weren't", "hasn't", "haven't", "hadn't",
      ]),
    });

    // 混合语言词典 (主要用于代码混合场景)
    this.dictionaries.set(Language.MIXED, {
      positive: new Set([
        ...Array.from(this.dictionaries.get(Language.ZH)?.positive || []),
        ...Array.from(this.dictionaries.get(Language.EN)?.positive || []),
        'good棒', 'nice好', 'perfect完美', 'love爱', 'like喜欢',
      ]),
      negative: new Set([
        ...Array.from(this.dictionaries.get(Language.ZH)?.negative || []),
        ...Array.from(this.dictionaries.get(Language.EN)?.negative || []),
        'bad差', 'terrible糟糕', 'hate讨厌',
      ]),
      neutral: new Set([
        ...Array.from(this.dictionaries.get(Language.ZH)?.neutral || []),
        ...Array.from(this.dictionaries.get(Language.EN)?.neutral || []),
      ]),
      intensifiers: new Map([
        ...(this.dictionaries.get(Language.ZH)?.intensifiers || new Map()),
        ...(this.dictionaries.get(Language.EN)?.intensifiers || new Map()),
      ]),
      negations: new Set([
        ...(this.dictionaries.get(Language.ZH)?.negations || []),
        ...(this.dictionaries.get(Language.EN)?.negations || []),
      ]),
    });
  }

  private tokenize(text: string, language: Language): string[] {
    // 简单分词 - 实际项目中可使用专业分词器
    if (language === Language.ZH) {
      // 中文按字符分词，同时保留常见词语
      return text.split('').filter((c) => !/\s/.test(c));
    }
    // 英文按空格和标点分词
    return text.toLowerCase().split(/[\s\p{P}]+/u).filter(Boolean);
  }

  private isNegated(words: string[], index: number): boolean {
    const windowSize = 3; // 检查前3个词
    const start = Math.max(0, index - windowSize);
    
    for (let i = start; i < index; i++) {
      const word = words[i].toLowerCase();
      for (const [lang, dict] of this.dictionaries) {
        if (dict.negations.has(word)) return true;
      }
    }
    return false;
  }

  private getIntensity(words: string[], index: number): number {
    const windowSize = 2;
    const start = Math.max(0, index - windowSize);
    
    let intensity = 1.0;
    for (let i = start; i < index; i++) {
      const word = words[i].toLowerCase();
      for (const [lang, dict] of this.dictionaries) {
        if (dict.intensifiers.has(word)) {
          intensity *= dict.intensifiers.get(word)!;
        }
      }
    }
    return intensity;
  }
}

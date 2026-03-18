/**
 * 语言检测器
 * 支持中文、英文和混合语言检测
 */

import { Language } from '../core/types';

export class LanguageDetector {
  // 中文字符范围
  private chinesePattern = /[\u4e00-\u9fa5]/;
  // 英文字母
  private englishPattern = /[a-zA-Z]/;
  // 日文假名（用于排除）
  private japanesePattern = /[\u3040-\u309f\u30a0-\u30ff]/;
  // 韩文（用于排除）
  private koreanPattern = /[\uac00-\ud7af]/;

  /**
   * 检测文本语言
   */
  detect(text: string): Language {
    if (!text || text.trim().length === 0) {
      return Language.UNKNOWN;
    }

    let chineseCount = 0;
    let englishCount = 0;
    let otherCount = 0;
    let totalChars = 0;

    for (const char of text) {
      // 跳过空格、数字、标点
      if (/\s|\d|\p{P}/u.test(char)) continue;

      totalChars++;

      if (this.chinesePattern.test(char)) {
        chineseCount++;
      } else if (this.englishPattern.test(char)) {
        englishCount++;
      } else if (
        this.japanesePattern.test(char) ||
        this.koreanPattern.test(char)
      ) {
        otherCount++;
      }
    }

    if (totalChars === 0) return Language.UNKNOWN;

    // 计算比例
    const chineseRatio = chineseCount / totalChars;
    const englishRatio = englishCount / totalChars;

    // 判断逻辑
    if (chineseRatio > 0.7) return Language.ZH;
    if (englishRatio > 0.7) return Language.EN;
    if (chineseRatio > 0.2 && englishRatio > 0.2) return Language.MIXED;
    if (otherCount > totalChars * 0.5) return Language.UNKNOWN;

    // 默认根据主要语言返回
    return chineseCount > englishCount ? Language.ZH : Language.EN;
  }

  /**
   * 批量检测
   */
  detectBatch(texts: string[]): Map<Language, string[]> {
    const result = new Map<Language, string[]>();

    for (const text of texts) {
      const lang = this.detect(text);
      const existing = result.get(lang) || [];
      existing.push(text);
      result.set(lang, existing);
    }

    return result;
  }

  /**
   * 检测是否为代码混合文本
   */
  isCodeMixed(text: string): boolean {
    const lang = this.detect(text);
    return lang === Language.MIXED;
  }

  /**
   * 获取语言置信度
   */
  getConfidence(text: string): { language: Language; confidence: number } {
    if (!text || text.trim().length === 0) {
      return { language: Language.UNKNOWN, confidence: 0 };
    }

    let chineseCount = 0;
    let englishCount = 0;
    let totalChars = 0;

    for (const char of text) {
      if (/\s|\d|\p{P}/u.test(char)) continue;
      totalChars++;
      if (this.chinesePattern.test(char)) chineseCount++;
      else if (this.englishPattern.test(char)) englishCount++;
    }

    if (totalChars === 0) {
      return { language: Language.UNKNOWN, confidence: 0 };
    }

    const chineseRatio = chineseCount / totalChars;
    const englishRatio = englishCount / totalChars;

    if (chineseRatio > 0.8) {
      return { language: Language.ZH, confidence: chineseRatio };
    }
    if (englishRatio > 0.8) {
      return { language: Language.EN, confidence: englishRatio };
    }
    if (chineseRatio > 0.2 && englishRatio > 0.2) {
      return {
        language: Language.MIXED,
        confidence: Math.min(chineseRatio + englishRatio, 1),
      };
    }

    return {
      language: chineseCount > englishCount ? Language.ZH : Language.EN,
      confidence: Math.max(chineseRatio, englishRatio),
    };
  }
}

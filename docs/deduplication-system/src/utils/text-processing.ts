/**
 * 文本预处理工具
 */

export class TextProcessor {
  private stopWords: Set<string>;

  constructor(stopWords: string[] = []) {
    this.stopWords = new Set(stopWords);
  }

  /**
   * 标准化文本
   */
  normalize(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFKC')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * 清洗文本
   */
  clean(text: string): string {
    return text
      // 移除URL
      .replace(/https?:\/\/\S+/g, '')
      // 移除邮箱
      .replace(/\S+@\S+\.\S+/g, '')
      // 移除特殊字符，保留基本标点
      .replace(/[^\w\s\u4e00-\u9fa5。，！？；：""''（）、]/g, ' ')
      // 规范化空格
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * 提取token
   */
  tokenize(text: string): string[] {
    const normalized = this.normalize(text);
    // 支持中文和英文分词
    const tokens = normalized.match(/[\u4e00-\u9fa5]|\w+/g) || [];
    return tokens.filter(t => !this.stopWords.has(t) && t.length > 1);
  }

  /**
   * 生成shingles (n-gram)
   */
  getShingles(text: string, size: number = 3): string[] {
    const tokens = this.tokenize(text);
    if (tokens.length < size) return [tokens.join('')];
    
    const shingles: string[] = [];
    for (let i = 0; i <= tokens.length - size; i++) {
      shingles.push(tokens.slice(i, i + size).join(''));
    }
    return shingles;
  }

  /**
   * 提取特征
   */
  extractFeatures(text: string) {
    const normalized = this.normalize(text);
    const cleaned = this.clean(text);
    const tokens = this.tokenize(cleaned);
    
    return {
      wordCount: tokens.length,
      charCount: normalized.length,
      avgWordLength: tokens.length > 0 
        ? tokens.reduce((sum, t) => sum + t.length, 0) / tokens.length 
        : 0,
      punctuationRatio: (normalized.match(/[。，！？；：""''（）、.,!?;:"']/g) || []).length / normalized.length,
      emojiCount: (normalized.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length,
      urlCount: (text.match(/https?:\/\/\S+/g) || []).length,
      hashtagCount: (text.match(/#[\w\u4e00-\u9fa5]+/g) || []).length,
      mentionCount: (text.match(/@[\w\u4e00-\u9fa5]+/g) || []).length,
      language: this.detectLanguage(normalized),
    };
  }

  /**
   * 简单语言检测
   */
  private detectLanguage(text: string): string {
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const totalChars = text.replace(/\s/g, '').length;
    
    if (totalChars === 0) return 'unknown';
    
    const chineseRatio = chineseChars / totalChars;
    if (chineseRatio > 0.3) return 'zh';
    if (chineseRatio > 0.1) return 'zh-mixed';
    return 'en';
  }

  /**
   * 计算Levenshtein距离
   */
  levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[b.length][a.length];
  }

  /**
   * 计算相似度 (基于Levenshtein)
   */
  similarity(a: string, b: string): number {
    const distance = this.levenshteinDistance(a, b);
    const maxLength = Math.max(a.length, b.length);
    return maxLength === 0 ? 1 : 1 - distance / maxLength;
  }
}

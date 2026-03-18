/**
 * 跨平台作者识别
 * 
 * 使用多维度特征识别同一作者在不同平台的账号
 */

import { TextProcessor } from '../utils/text-processing';
import { cosineSimilarity } from '../algorithms/semantic-similarity';

export interface AuthorIdentifier {
  platform: string;
  userId: string;
  username: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  metadata?: Record<string, any>;
}

export interface AuthorProfile {
  id: string;
  canonicalName: string;
  identifiers: AuthorIdentifier[];
  features: AuthorFeatures;
  confidence: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthorFeatures {
  // Profile特征
  usernameVector: number[];
  bioVector: number[];
  
  // 内容特征
  writingStyle: number[];
  vocabFingerprint: number[];
  emojiPattern: number[];
  
  // 行为特征
  activityPattern: number[];
}

export interface ResolutionResult {
  profileId: string | null;
  confidence: number;
  matchedIdentifiers: AuthorIdentifier[];
  isNewAuthor: boolean;
}

export class AuthorResolver {
  private textProcessor: TextProcessor;
  private profiles: Map<string, AuthorProfile> = new Map();
  private threshold: number;

  constructor(threshold: number = 0.75) {
    this.textProcessor = new TextProcessor();
    this.threshold = threshold;
  }

  /**
   * 解析作者身份
   */
  async resolve(identifier: AuthorIdentifier): Promise<ResolutionResult> {
    const features = await this.extractFeatures(identifier);
    
    let bestMatch: { profileId: string; confidence: number } | null = null;
    
    // 与现有档案比对
    for (const [profileId, profile] of this.profiles) {
      const similarity = this.calculateSimilarity(features, profile.features);
      
      if (similarity >= this.threshold && (!bestMatch || similarity > bestMatch.confidence)) {
        bestMatch = { profileId, confidence: similarity };
      }
    }
    
    if (bestMatch) {
      // 更新现有档案
      const profile = this.profiles.get(bestMatch.profileId)!;
      profile.identifiers.push(identifier);
      profile.features = this.mergeFeatures(profile.features, features);
      profile.confidence = Math.max(profile.confidence, bestMatch.confidence);
      profile.updatedAt = new Date();
      
      return {
        profileId: bestMatch.profileId,
        confidence: bestMatch.confidence,
        matchedIdentifiers: profile.identifiers,
        isNewAuthor: false,
      };
    }
    
    // 创建新档案
    const newProfile: AuthorProfile = {
      id: this.generateId(),
      canonicalName: identifier.displayName || identifier.username,
      identifiers: [identifier],
      features,
      confidence: 1.0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    this.profiles.set(newProfile.id, newProfile);
    
    return {
      profileId: newProfile.id,
      confidence: 1.0,
      matchedIdentifiers: [identifier],
      isNewAuthor: true,
    };
  }

  /**
   * 提取作者特征
   */
  private async extractFeatures(identifier: AuthorIdentifier): Promise<AuthorFeatures> {
    const usernameTokens = this.textProcessor.tokenize(identifier.username);
    const bioTokens = identifier.bio ? this.textProcessor.tokenize(identifier.bio) : [];
    
    return {
      usernameVector: await this.textToVector(usernameTokens.join(' ')),
      bioVector: await this.textToVector(bioTokens.join(' ')),
      writingStyle: await this.extractWritingStyle(identifier),
      vocabFingerprint: this.extractVocabFingerprint(identifier),
      emojiPattern: this.extractEmojiPattern(identifier),
      activityPattern: this.extractActivityPattern(identifier),
    };
  }

  /**
   * 文本转向量（简化实现）
   */
  private async textToVector(text: string, dimension: number = 64): Promise<number[]> {
    const vector: number[] = new Array(dimension).fill(0);
    
    if (!text) return vector;
    
    // 使用字符n-gram生成向量
    for (let i = 0; i < text.length - 1; i++) {
      const bigram = text.slice(i, i + 2);
      let hash = 0;
      for (let j = 0; j < bigram.length; j++) {
        hash = ((hash << 5) - hash) + bigram.charCodeAt(j);
        hash = hash & hash;
      }
      const index = Math.abs(hash) % dimension;
      vector[index] += 1;
    }
    
    // 归一化
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    return norm > 0 ? vector.map(v => v / norm) : vector;
  }

  /**
   * 提取写作风格特征
   */
  private async extractWritingStyle(identifier: AuthorIdentifier): Promise<number[]> {
    // 从元数据中提取写作统计
    const metadata = identifier.metadata || {};
    const stats = metadata.writingStats || {};
    
    return [
      stats.avgSentenceLength || 0,
      stats.punctuationRatio || 0,
      stats.capitalizationRatio || 0,
      stats.questionRatio || 0,
      stats.exclamationRatio || 0,
      stats.emojiRatio || 0,
      stats.urlRatio || 0,
      stats.mentionRatio || 0,
    ];
  }

  /**
   * 提取词汇指纹
   */
  private extractVocabFingerprint(identifier: AuthorIdentifier): number[] {
    const bio = identifier.bio || '';
    const tokens = this.textProcessor.tokenize(bio);
    
    // 创建词汇频率指纹
    const fingerprint: number[] = new Array(32).fill(0);
    
    for (const token of tokens) {
      let hash = 0;
      for (let i = 0; i < token.length; i++) {
        hash = ((hash << 5) - hash) + token.charCodeAt(i);
        hash = hash & hash;
      }
      const index = Math.abs(hash) % 32;
      fingerprint[index] += 1;
    }
    
    // 归一化
    const norm = Math.sqrt(fingerprint.reduce((sum, v) => sum + v * v, 0));
    return norm > 0 ? fingerprint.map(v => v / norm) : fingerprint;
  }

  /**
   * 提取Emoji使用模式
   */
  private extractEmojiPattern(identifier: AuthorIdentifier): number[] {
    const bio = identifier.bio || '';
    const emojis = bio.match(/[\u{1F300}-\u{1F9FF}]/gu) || [];
    
    // 统计各类emoji
    const categories = {
      face: /[\u{1F600}-\u{1F64F}]/u,
      gesture: /[\u{1F900}-\u{1F9FF}]/u,
      heart: /[\u{2764}\u{1F494}\u{1F495}-\u{1F49F}\u{1F48C}]/u,
      nature: /[\u{1F300}-\u{1F5FF}]/u,
      food: /[\u{1F32D}-\u{1F37F}]/u,
      activity: /[\u{1F380}-\u{1F3FF}\u{26BD}\u{26BE}]/u,
      travel: /[\u{1F680}-\u{1F6FF}]/u,
      object: /[\u{1F4BB}-\u{1F4FF}]/u,
    };
    
    const pattern: number[] = [];
    for (const regex of Object.values(categories)) {
      const count = emojis.filter(e => regex.test(e)).length;
      pattern.push(count);
    }
    
    // 归一化
    const total = emojis.length || 1;
    return pattern.map(p => p / total);
  }

  /**
   * 提取活跃时间模式
   */
  private extractActivityPattern(identifier: AuthorIdentifier): number[] {
    const metadata = identifier.metadata || {};
    const activity = metadata.activityHours || [];
    
    // 24小时活跃模式
    const pattern = new Array(24).fill(0);
    for (const hour of activity) {
      if (hour >= 0 && hour < 24) {
        pattern[hour] += 1;
      }
    }
    
    // 归一化
    const max = Math.max(...pattern) || 1;
    return pattern.map(p => p / max);
  }

  /**
   * 计算特征相似度
   */
  private calculateSimilarity(f1: AuthorFeatures, f2: AuthorFeatures): number {
    const weights = {
      username: 0.25,
      bio: 0.20,
      writing: 0.25,
      vocab: 0.15,
      emoji: 0.10,
      activity: 0.05,
    };
    
    const similarities = {
      username: cosineSimilarity(f1.usernameVector, f2.usernameVector),
      bio: cosineSimilarity(f1.bioVector, f2.bioVector),
      writing: cosineSimilarity(f1.writingStyle, f2.writingStyle),
      vocab: cosineSimilarity(f1.vocabFingerprint, f2.vocabFingerprint),
      emoji: cosineSimilarity(f1.emojiPattern, f2.emojiPattern),
      activity: cosineSimilarity(f1.activityPattern, f2.activityPattern),
    };
    
    let totalWeight = 0;
    let weightedSum = 0;
    
    for (const [key, weight] of Object.entries(weights)) {
      totalWeight += weight;
      weightedSum += similarities[key as keyof typeof similarities] * weight;
    }
    
    return weightedSum / totalWeight;
  }

  /**
   * 合并特征
   */
  private mergeFeatures(f1: AuthorFeatures, f2: AuthorFeatures): AuthorFeatures {
    return {
      usernameVector: this.averageVectors(f1.usernameVector, f2.usernameVector),
      bioVector: this.averageVectors(f1.bioVector, f2.bioVector),
      writingStyle: this.averageVectors(f1.writingStyle, f2.writingStyle),
      vocabFingerprint: this.averageVectors(f1.vocabFingerprint, f2.vocabFingerprint),
      emojiPattern: this.averageVectors(f1.emojiPattern, f2.emojiPattern),
      activityPattern: this.averageVectors(f1.activityPattern, f2.activityPattern),
    };
  }

  /**
   * 向量平均
   */
  private averageVectors(a: number[], b: number[]): number[] {
    return a.map((v, i) => (v + b[i]) / 2);
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `author_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取档案
   */
  getProfile(id: string): AuthorProfile | undefined {
    return this.profiles.get(id);
  }

  /**
   * 获取所有档案
   */
  getAllProfiles(): AuthorProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * 查找平台关联
   */
  findCrossPlatformAccounts(profileId: string): Map<string, string[]> {
    const profile = this.profiles.get(profileId);
    if (!profile) return new Map();
    
    const platforms = new Map<string, string[]>();
    for (const id of profile.identifiers) {
      const existing = platforms.get(id.platform) || [];
      existing.push(id.userId);
      platforms.set(id.platform, existing);
    }
    
    return platforms;
  }
}

/**
 * 知乎适配器
 * 
 * 功能：
 * - 获取问题回答
 * - 获取文章评论
 * - 获取想法
 * - 支持关键词搜索
 */

import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AbstractAdapter } from '../core/abstract-adapter';
import {
  AdapterConfig,
  FetchOptions,
  FetchResult,
  UnifiedMention,
  ErrorCategory,
} from '../types';

/**
 * 知乎特定配置
 */
export interface ZhihuConfig extends AdapterConfig {
  options: {
    // 内容来源类型
    contentTypes?: ('answer' | 'article' | 'pin')[];
    
    // 搜索配置
    keywords?: string[];
    
    // 特定问题/文章/用户
    questionIds?: number[];
    articleIds?: number[];
    userId?: string;
    
    // 过滤选项
    minVoteups?: number;
    includeAnonymous?: boolean;
    
    // 分页
    limit?: number;
    offset?: number;
  };
}

/**
 * 知乎回答数据结构
 */
interface ZhihuAnswer {
  id: number;
  type: 'answer';
  url: string;
  author: ZhihuUser;
  content: string;
  excerpt: string;
  created_time: number;
  updated_time: number;
  voteup_count: number;
  comment_count: number;
  thanks_count: number;
  question: {
    id: number;
    title: string;
    url: string;
  };
}

/**
 * 知乎文章数据结构
 */
interface ZhihuArticle {
  id: number;
  type: 'article';
  url: string;
  author: ZhihuUser;
  title: string;
  content: string;
  excerpt: string;
  created: number;
  updated: number;
  voteup_count: number;
  comment_count: number;
}

/**
 * 知乎想法数据结构
 */
interface ZhihuPin {
  id: string;
  type: 'pin';
  url: string;
  author: ZhihuUser;
  content: string;
  created_time: number;
  like_count: number;
  comment_count: number;
  repin_count: number;
}

/**
 * 知乎用户数据结构
 */
interface ZhihuUser {
  id: string;
  url: string;
  name: string;
  headline?: string;
  avatar_url?: string;
  gender?: number;
  follower_count?: number;
}

@Injectable()
export class ZhihuAdapter extends AbstractAdapter {
  private readonly baseUrl = 'https://www.zhihu.com/api/v4';
  private readonly webUrl = 'https://www.zhihu.com';

  constructor() {
    super('zhihu');
  }

  // ============================================================================
  // 抽象方法实现
  // ============================================================================

  protected async initializePlatform(config: AdapterConfig): Promise<void> {
    this.logger.log('Zhihu adapter initialized');
  }

  protected async disposePlatform(): Promise<void> {
    this.logger.log('Zhihu adapter disposed');
  }

  protected async validatePlatformConfig(config: AdapterConfig): Promise<boolean> {
    const options = config.options || {};
    
    // 知乎可以不认证，但有限流
    // 需要至少有一个搜索条件
    const hasSearchCriteria = 
      (options.keywords && options.keywords.length > 0) ||
      (options.questionIds && options.questionIds.length > 0) ||
      (options.articleIds && options.articleIds.length > 0) ||
      options.userId;

    if (!hasSearchCriteria) {
      this.logger.warn('Zhihu config should have at least one search criteria');
      // 只是警告，不阻止，因为可能有默认搜索
    }

    return true;
  }

  protected async doFetch(options?: FetchOptions): Promise<FetchResult> {
    const config = this.config.options as ZhihuConfig['options'];
    const contentTypes = config.contentTypes || ['answer'];
    
    const mentions: UnifiedMention[] = [];
    let totalCount = 0;

    // 获取回答
    if (contentTypes.includes('answer')) {
      if (config.keywords && config.keywords.length > 0) {
        // 搜索回答
        for (const keyword of config.keywords) {
          const result = await this.searchAnswers(keyword, config);
          mentions.push(...result.data);
          totalCount += result.total;
        }
      }
      
      if (config.questionIds && config.questionIds.length > 0) {
        // 获取特定问题的回答
        for (const questionId of config.questionIds) {
          const result = await this.fetchAnswersByQuestion(questionId, config);
          mentions.push(...result.data);
          totalCount += result.total;
        }
      }
    }

    // 获取文章
    if (contentTypes.includes('article')) {
      if (config.keywords && config.keywords.length > 0) {
        for (const keyword of config.keywords) {
          const result = await this.searchArticles(keyword, config);
          mentions.push(...result.data);
          totalCount += result.total;
        }
      }
      
      if (config.articleIds && config.articleIds.length > 0) {
        for (const articleId of config.articleIds) {
          const article = await this.fetchArticle(articleId);
          if (article) {
            mentions.push(article);
            totalCount++;
          }
        }
      }
    }

    // 获取想法
    if (contentTypes.includes('pin') && config.userId) {
      const result = await this.fetchPins(config.userId, config);
      mentions.push(...result.data);
      totalCount += result.total;
    }

    // 去重并排序
    const uniqueMentions = this.deduplicate(mentions);
    uniqueMentions.sort((a, b) => b.postedAt.getTime() - a.postedAt.getTime());

    // 过滤
    const filteredMentions = this.filterByConfig(uniqueMentions, config);

    return this.createFetchResult(filteredMentions, {
      totalCount: filteredMentions.length,
      hasMore: false,
    });
  }

  protected async doFetchById(externalId: string): Promise<UnifiedMention | null> {
    // 解析 externalId: zhihu:{type}:{id}
    const match = externalId.match(/^zhihu:(answer|article|pin):(\d+)$/);
    if (!match) {
      this.logger.warn(`Invalid Zhihu externalId format: ${externalId}`);
      return null;
    }

    const [, type, id] = match;

    try {
      switch (type) {
        case 'answer':
          const answer = await this.fetchSingleAnswer(parseInt(id));
          return answer ? this.transformAnswer(answer) : null;
        case 'article':
          const article = await this.fetchArticle(parseInt(id));
          return article;
        case 'pin':
          const pin = await this.fetchSinglePin(id);
          return pin ? this.transformPin(pin) : null;
        default:
          return null;
      }
    } catch (error) {
      this.logger.error(`Failed to fetch by ID: ${error.message}`);
      return null;
    }
  }

  transform(raw: any): UnifiedMention | null {
    if (!raw.type) {
      this.logger.warn('Invalid Zhihu data format: missing type');
      return null;
    }

    switch (raw.type) {
      case 'answer':
        return this.transformAnswer(raw as ZhihuAnswer);
      case 'article':
        return this.transformArticle(raw as ZhihuArticle);
      case 'pin':
        return this.transformPin(raw as ZhihuPin);
      default:
        this.logger.warn(`Unknown Zhihu content type: ${raw.type}`);
        return null;
    }
  }

  protected categorizeError(error: any): ErrorCategory {
    const statusCode = error?.response?.status;
    const message = error?.message?.toLowerCase() || '';

    // 知乎特定的错误处理
    if (statusCode === 401) return ErrorCategory.AUTHENTICATION_ERROR;
    if (statusCode === 403) {
      if (message.includes('rate limit') || message.includes('频繁')) {
        return ErrorCategory.RATE_LIMITED;
      }
      return ErrorCategory.AUTHORIZATION_ERROR;
    }
    if (statusCode === 404) return ErrorCategory.NOT_FOUND;
    if (statusCode === 410) return ErrorCategory.NOT_FOUND; // 内容已删除
    if (statusCode === 429) return ErrorCategory.RATE_LIMITED;
    if (statusCode >= 500) return ErrorCategory.SERVER_ERROR;

    if (message.includes('timeout') || message.includes('超时')) {
      return ErrorCategory.TIMEOUT_ERROR;
    }
    if (message.includes('network') || message.includes('网络')) {
      return ErrorCategory.NETWORK_ERROR;
    }

    return ErrorCategory.UNKNOWN_ERROR;
  }

  // ============================================================================
  // 知乎特定方法
  // ============================================================================

  private async searchAnswers(
    keyword: string,
    config: ZhihuConfig['options']
  ): Promise<{ data: UnifiedMention[]; total: number }> {
    try {
      // 知乎搜索 API 需要特殊的 header
      const response = await firstValueFrom(
        this.httpService.get<{
          data: Array<{ object: ZhihuAnswer }>;
          paging: { is_end: boolean; totals: number };
        }>(`${this.baseUrl}/search_v3`, {
          headers: this.getHeaders(),
          params: {
            q: keyword,
            type: 'content',
            search_hash_id: this.generateSearchHashId(),
            t: 'general',
            offset: config.offset || 0,
            limit: Math.min(config.limit || 20, 20),
          },
        })
      );

      const answers = response.data.data
        ?.filter(item => item.object?.type === 'answer')
        .map(item => this.transformAnswer(item.object))
        .filter((m): m is UnifiedMention => m !== null) || [];

      return {
        data: answers,
        total: response.data.paging?.totals || answers.length,
      };
    } catch (error) {
      this.logger.error(`Failed to search answers: ${error.message}`);
      return { data: [], total: 0 };
    }
  }

  private async fetchAnswersByQuestion(
    questionId: number,
    config: ZhihuConfig['options']
  ): Promise<{ data: UnifiedMention[]; total: number }> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<{
          data: ZhihuAnswer[];
          paging: { is_end: boolean; totals: number };
        }>(`${this.baseUrl}/questions/${questionId}/answers`, {
          headers: this.getHeaders(),
          params: {
            include: 'data[*].is_normal,content',
            offset: config.offset || 0,
            limit: Math.min(config.limit || 20, 20),
            sort_by: 'default',
          },
        })
      );

      const answers = response.data.data
        ?.map(answer => this.transformAnswer(answer))
        .filter((m): m is UnifiedMention => m !== null) || [];

      return {
        data: answers,
        total: response.data.paging?.totals || answers.length,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch answers for question ${questionId}: ${error.message}`);
      return { data: [], total: 0 };
    }
  }

  private async fetchSingleAnswer(answerId: number): Promise<ZhihuAnswer | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<ZhihuAnswer>(`${this.baseUrl}/answers/${answerId}`, {
          headers: this.getHeaders(),
          params: {
            include: 'content',
          },
        })
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to fetch answer ${answerId}: ${error.message}`);
      return null;
    }
  }

  private async searchArticles(
    keyword: string,
    config: ZhihuConfig['options']
  ): Promise<{ data: UnifiedMention[]; total: number }> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<{
          data: Array<{ object: ZhihuArticle }>;
          paging: { is_end: boolean; totals: number };
        }>(`${this.baseUrl}/search_v3`, {
          headers: this.getHeaders(),
          params: {
            q: keyword,
            type: 'content',
            search_hash_id: this.generateSearchHashId(),
            t: 'article',
            offset: config.offset || 0,
            limit: Math.min(config.limit || 20, 20),
          },
        })
      );

      const articles = response.data.data
        ?.filter(item => item.object?.type === 'article')
        .map(item => this.transformArticle(item.object))
        .filter((m): m is UnifiedMention => m !== null) || [];

      return {
        data: articles,
        total: response.data.paging?.totals || articles.length,
      };
    } catch (error) {
      this.logger.error(`Failed to search articles: ${error.message}`);
      return { data: [], total: 0 };
    }
  }

  private async fetchArticle(articleId: number): Promise<UnifiedMention | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<ZhihuArticle>(`${this.baseUrl}/articles/${articleId}`, {
          headers: this.getHeaders(),
        })
      );
      return this.transformArticle(response.data);
    } catch (error) {
      this.logger.error(`Failed to fetch article ${articleId}: ${error.message}`);
      return null;
    }
  }

  private async fetchPins(
    userId: string,
    config: ZhihuConfig['options']
  ): Promise<{ data: UnifiedMention[]; total: number }> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<{
          data: ZhihuPin[];
          paging: { is_end: boolean };
        }>(`${this.baseUrl}/members/${userId}/pins`, {
          headers: this.getHeaders(),
          params: {
            offset: config.offset || 0,
            limit: Math.min(config.limit || 20, 20),
          },
        })
      );

      const pins = response.data.data
        ?.map(pin => this.transformPin(pin))
        .filter((m): m is UnifiedMention => m !== null) || [];

      return {
        data: pins,
        total: pins.length,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch pins: ${error.message}`);
      return { data: [], total: 0 };
    }
  }

  private async fetchSinglePin(pinId: string): Promise<ZhihuPin | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<ZhihuPin>(`${this.baseUrl}/pins/${pinId}`, {
          headers: this.getHeaders(),
        })
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to fetch pin ${pinId}: ${error.message}`);
      return null;
    }
  }

  // ============================================================================
  // 数据转换方法
  // ============================================================================

  private transformAnswer(answer: ZhihuAnswer): UnifiedMention | null {
    if (!answer || !answer.author) return null;

    return {
      id: `zhihu:answer:${answer.id}`,
      platform: this.platform,
      externalId: answer.id.toString(),
      content: this.stripHtml(answer.excerpt || answer.content),
      rawContent: answer.content,
      contentType: 'html',
      author: {
        id: answer.author.id,
        name: answer.author.name,
        username: answer.author.name,
        avatar: answer.author.avatar_url,
        url: answer.author.url,
        followers: answer.author.follower_count,
      },
      source: {
        type: 'answer',
        url: answer.url,
        title: answer.question?.title,
        parentId: answer.question?.id.toString(),
        parentUrl: answer.question?.url,
      },
      postedAt: new Date(answer.created_time * 1000),
      fetchedAt: new Date(),
      updatedAt: new Date(answer.updated_time * 1000),
      engagement: {
        likes: answer.voteup_count,
        replies: answer.comment_count,
      },
      metadata: {
        type: 'answer',
        thanksCount: answer.thanks_count,
        questionId: answer.question?.id,
        questionTitle: answer.question?.title,
      },
    };
  }

  private transformArticle(article: ZhihuArticle): UnifiedMention | null {
    if (!article || !article.author) return null;

    return {
      id: `zhihu:article:${article.id}`,
      platform: this.platform,
      externalId: article.id.toString(),
      content: this.stripHtml(article.excerpt || article.content),
      rawContent: article.content,
      contentType: 'html',
      author: {
        id: article.author.id,
        name: article.author.name,
        username: article.author.name,
        avatar: article.author.avatar_url,
        url: article.author.url,
        followers: article.author.follower_count,
      },
      source: {
        type: 'post',
        url: article.url,
        title: article.title,
      },
      postedAt: new Date(article.created * 1000),
      fetchedAt: new Date(),
      updatedAt: new Date(article.updated * 1000),
      engagement: {
        likes: article.voteup_count,
        replies: article.comment_count,
      },
      metadata: {
        type: 'article',
        title: article.title,
      },
    };
  }

  private transformPin(pin: ZhihuPin): UnifiedMention | null {
    if (!pin || !pin.author) return null;

    return {
      id: `zhihu:pin:${pin.id}`,
      platform: this.platform,
      externalId: pin.id,
      content: this.stripHtml(pin.content),
      rawContent: pin.content,
      contentType: 'html',
      author: {
        id: pin.author.id,
        name: pin.author.name,
        username: pin.author.name,
        avatar: pin.author.avatar_url,
        url: pin.author.url,
        followers: pin.author.follower_count,
      },
      source: {
        type: 'post',
        url: pin.url,
      },
      postedAt: new Date(pin.created_time * 1000),
      fetchedAt: new Date(),
      engagement: {
        likes: pin.like_count,
        replies: pin.comment_count,
        shares: pin.repin_count,
      },
      metadata: {
        type: 'pin',
      },
    };
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      Referer: 'https://www.zhihu.com/',
      'x-requested-with': 'fetch',
    };

    // 知乎的某些 API 需要 cookie
    // 可以在 auth 中存储 cookie
    if (this.config.auth?.customHeaders) {
      Object.assign(headers, this.config.auth.customHeaders);
    }

    return headers;
  }

  private generateSearchHashId(): string {
    // 生成搜索 hash id
    return Math.random().toString(36).substring(2, 15);
  }

  private stripHtml(html: string): string {
    if (!html) return '';
    // 简单的 HTML 标签移除
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private deduplicate(mentions: UnifiedMention[]): UnifiedMention[] {
    const seen = new Set<string>();
    return mentions.filter(m => {
      if (seen.has(m.id)) {
        return false;
      }
      seen.add(m.id);
      return true;
    });
  }

  private filterByConfig(
    mentions: UnifiedMention[],
    config: ZhihuConfig['options']
  ): UnifiedMention[] {
    return mentions.filter(m => {
      // 过滤匿名用户
      if (config.includeAnonymous === false) {
        const authorName = m.author.name;
        if (authorName === '匿名用户' || authorName === '[已重置]') {
          return false;
        }
      }

      // 过滤赞数
      if (config.minVoteups && config.minVoteups > 0) {
        if ((m.engagement.likes || 0) < config.minVoteups) {
          return false;
        }
      }

      return true;
    });
  }

  // ============================================================================
  // 公共方法
  // ============================================================================

  /**
   * 获取用户信息
   */
  async getUserInfo(username: string): Promise<ZhihuUser | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<ZhihuUser>(`${this.baseUrl}/members/${username}`, {
          headers: this.getHeaders(),
        })
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get user info: ${error.message}`);
      return null;
    }
  }

  /**
   * 搜索问题
   */
  async searchQuestions(keyword: string): Promise<Array<{ id: number; title: string }>> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<{
          data: Array<{ object: { id: number; title: string } }>;
        }>(`${this.baseUrl}/search_v3`, {
          headers: this.getHeaders(),
          params: {
            q: keyword,
            type: 'content',
            t: 'question',
          },
        })
      );

      return response.data.data
        ?.filter(item => item.object?.title)
        .map(item => ({
          id: item.object.id,
          title: item.object.title,
        })) || [];
    } catch (error) {
      this.logger.error(`Failed to search questions: ${error.message}`);
      return [];
    }
  }
}

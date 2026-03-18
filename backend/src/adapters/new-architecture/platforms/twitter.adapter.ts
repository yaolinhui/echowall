/**
 * Twitter/X 适配器
 * 
 * 功能：
 * - 获取 Tweets（搜索、时间线、提及）
 * - 支持 OAuth 2.0 认证
 * - 使用 Twitter API v2
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
  IRefreshableAdapter,
} from '../types';

/**
 * Twitter 特定配置
 */
export interface TwitterConfig extends AdapterConfig {
  options: {
    searchQuery?: string;
    userId?: string;
    tweetFields?: string[];
    userFields?: string[];
    expansions?: string[];
    maxResults?: number;
    includeReplies?: boolean;
    includeRetweets?: boolean;
  };
}

/**
 * Twitter API v2 Tweet 结构
 */
interface TwitterTweet {
  id: string;
  text: string;
  created_at: string;
  author_id: string;
  public_metrics?: {
    retweet_count: number;
    reply_count: number;
    like_count: number;
    quote_count: number;
    impression_count?: number;
  };
  entities?: {
    mentions?: Array<{
      start: number;
      end: number;
      username: string;
      id: string;
    }>;
    hashtags?: Array<{
      start: number;
      end: number;
      tag: string;
    }>;
    urls?: Array<{
      start: number;
      end: number;
      url: string;
      expanded_url: string;
      display_url: string;
    }>;
  };
  referenced_tweets?: Array<{
    type: 'retweeted' | 'quoted' | 'replied_to';
    id: string;
  }>;
  lang?: string;
  source?: string;
  possibly_sensitive?: boolean;
}

/**
 * Twitter API v2 User 结构
 */
interface TwitterUser {
  id: string;
  name: string;
  username: string;
  profile_image_url?: string;
  verified?: boolean;
  verified_type?: 'blue' | 'business' | 'government';
  public_metrics?: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
    listed_count: number;
  };
  description?: string;
  location?: string;
  url?: string;
  created_at?: string;
}

@Injectable()
export class TwitterAdapter extends AbstractAdapter implements IRefreshableAdapter {
  private readonly baseUrl = 'https://api.twitter.com/2';
  private tokenExpiryTime?: Date;

  constructor() {
    super('twitter');
  }

  // ============================================================================
  // 抽象方法实现
  // ============================================================================

  protected async initializePlatform(config: AdapterConfig): Promise<void> {
    // 设置 token 过期时间（如果存在）
    if (config.auth?.tokenExpiry) {
      this.tokenExpiryTime = new Date(config.auth.tokenExpiry);
    }
    this.logger.log('Twitter adapter initialized');
  }

  protected async disposePlatform(): Promise<void> {
    this.logger.log('Twitter adapter disposed');
  }

  protected async validatePlatformConfig(config: AdapterConfig): Promise<boolean> {
    const options = config.options || {};
    
    // 需要认证
    if (!config.auth?.accessToken && !config.auth?.apiKey) {
      this.logger.error('Twitter adapter requires authentication');
      return false;
    }

    // 需要搜索查询或用户ID
    if (!options.searchQuery && !options.userId) {
      this.logger.error('Twitter config requires searchQuery or userId');
      return false;
    }

    return true;
  }

  protected async doFetch(options?: FetchOptions): Promise<FetchResult> {
    const config = this.config.options as TwitterConfig['options'];
    const { searchQuery, userId, maxResults = 100 } = config;

    // 检查是否需要刷新 token
    if (this.needsRefresh()) {
      await this.refreshAuth();
    }

    let tweets: TwitterTweet[] = [];
    let users: Map<string, TwitterUser> = new Map();
    let nextToken: string | undefined;

    try {
      if (searchQuery) {
        // 搜索推文
        const result = await this.searchTweets(searchQuery, maxResults, options?.cursor);
        tweets = result.tweets;
        users = result.users;
        nextToken = result.nextToken;
      } else if (userId) {
        // 获取用户时间线
        const result = await this.getUserTimeline(userId, maxResults, options?.cursor);
        tweets = result.tweets;
        users = result.users;
        nextToken = result.nextToken;
      }
    } catch (error) {
      this.logger.error(`Failed to fetch tweets: ${error.message}`);
      throw error;
    }

    // 转换数据
    const mentions = tweets
      .map(tweet => this.transformTweet(tweet, users.get(tweet.author_id)))
      .filter((m): m is UnifiedMention => m !== null);

    return this.createFetchResult(mentions, {
      totalCount: mentions.length,
      hasMore: !!nextToken,
      nextCursor: nextToken,
    });
  }

  protected async doFetchById(externalId: string): Promise<UnifiedMention | null> {
    // 解析 externalId: twitter:{id}
    const match = externalId.match(/^twitter:(\d+)$/);
    if (!match) {
      this.logger.warn(`Invalid Twitter externalId format: ${externalId}`);
      return null;
    }

    const tweetId = match[1];

    try {
      const response = await firstValueFrom(
        this.httpService.get<{ data: TwitterTweet; includes?: { users?: TwitterUser[] } }>(
          `${this.baseUrl}/tweets/${tweetId}`,
          {
            headers: this.getHeaders(),
            params: {
              'tweet.fields': 'created_at,public_metrics,entities,lang,source,possibly_sensitive',
              'user.fields': 'profile_image_url,verified,public_metrics,description,location',
              expansions: 'author_id',
            },
          }
        )
      );

      const tweet = response.data.data;
      const users = new Map(
        (response.data.includes?.users || []).map(u => [u.id, u])
      );

      return this.transformTweet(tweet, users.get(tweet.author_id));
    } catch (error) {
      this.logger.error(`Failed to fetch tweet by ID: ${error.message}`);
      return null;
    }
  }

  transform(raw: any): UnifiedMention | null {
    if (!raw.id || !raw.text) {
      this.logger.warn('Invalid Twitter data format');
      return null;
    }

    return this.transformTweet(raw as TwitterTweet, raw.author as TwitterUser);
  }

  protected categorizeError(error: any): ErrorCategory {
    const statusCode = error?.response?.status;
    const code = error?.response?.data?.errors?.[0]?.code;
    const message = error?.message?.toLowerCase() || '';

    // Twitter 特定错误码
    if (code === 88 || code === 429) return ErrorCategory.RATE_LIMITED;
    if (code === 32 || code === 215) return ErrorCategory.AUTHENTICATION_ERROR;
    if (code === 34 || code === 144) return ErrorCategory.NOT_FOUND;
    if (code === 186) return ErrorCategory.VALIDATION_ERROR; // Tweet too long
    if (code === 187) return ErrorCategory.VALIDATION_ERROR; // Duplicate tweet

    if (statusCode === 401) return ErrorCategory.AUTHENTICATION_ERROR;
    if (statusCode === 403) return ErrorCategory.AUTHORIZATION_ERROR;
    if (statusCode === 404) return ErrorCategory.NOT_FOUND;
    if (statusCode === 429) return ErrorCategory.RATE_LIMITED;
    if (statusCode >= 500) return ErrorCategory.SERVER_ERROR;

    if (message.includes('timeout')) return ErrorCategory.TIMEOUT_ERROR;
    if (message.includes('rate limit')) return ErrorCategory.RATE_LIMITED;

    return ErrorCategory.UNKNOWN_ERROR;
  }

  // ============================================================================
  // IRefreshableAdapter 实现
  // ============================================================================

  needsRefresh(): boolean {
    if (!this.tokenExpiryTime) return false;
    
    // 如果 token 在 5 分钟内过期，则需要刷新
    const refreshThreshold = 5 * 60 * 1000; // 5 minutes
    return new Date().getTime() + refreshThreshold >= this.tokenExpiryTime.getTime();
  }

  async refreshAuth(): Promise<void> {
    if (!this.config.auth?.refreshToken) {
      throw new Error('No refresh token available');
    }

    this.logger.log('Refreshing Twitter access token...');

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          'https://api.twitter.com/2/oauth2/token',
          {
            refresh_token: this.config.auth.refreshToken,
            grant_type: 'refresh_token',
          },
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Authorization: `Basic ${Buffer.from(
                `${this.config.auth.clientId}:${this.config.auth.clientSecret}`
              ).toString('base64')}`,
            },
          }
        )
      );

      const { access_token, refresh_token, expires_in } = response.data;

      // 更新配置
      this.config.auth.accessToken = access_token;
      if (refresh_token) {
        this.config.auth.refreshToken = refresh_token;
      }
      this.tokenExpiryTime = new Date(Date.now() + expires_in * 1000);
      this.config.auth.tokenExpiry = this.tokenExpiryTime;

      this.logger.log('Twitter token refreshed successfully');
    } catch (error) {
      this.logger.error(`Failed to refresh token: ${error.message}`);
      throw error;
    }
  }

  getAuthStatus(): {
    authenticated: boolean;
    expiresAt?: Date;
    scopes?: string[];
  } {
    return {
      authenticated: !!this.config.auth?.accessToken,
      expiresAt: this.tokenExpiryTime,
      scopes: this.config.auth?.type === 'oauth2' ? ['tweet.read', 'users.read'] : undefined,
    };
  }

  // ============================================================================
  // Twitter 特定方法
  // ============================================================================

  private async searchTweets(
    query: string,
    maxResults: number,
    nextToken?: string
  ): Promise<{ tweets: TwitterTweet[]; users: Map<string, TwitterUser>; nextToken?: string }> {
    const response = await firstValueFrom(
      this.httpService.get<{
        data: TwitterTweet[];
        includes?: { users?: TwitterUser[] };
        meta?: { next_token?: string; result_count: number };
      }>(`${this.baseUrl}/tweets/search/recent`, {
        headers: this.getHeaders(),
        params: {
          query,
          max_results: Math.min(maxResults, 100),
          'tweet.fields': 'created_at,public_metrics,entities,lang,source,possibly_sensitive,referenced_tweets',
          'user.fields': 'profile_image_url,verified,public_metrics,description,location,created_at',
          expansions: 'author_id',
          next_token: nextToken,
        },
      })
    );

    const tweets = response.data.data || [];
    const users = new Map(
      (response.data.includes?.users || []).map(u => [u.id, u])
    );

    return {
      tweets,
      users,
      nextToken: response.data.meta?.next_token,
    };
  }

  private async getUserTimeline(
    userId: string,
    maxResults: number,
    nextToken?: string
  ): Promise<{ tweets: TwitterTweet[]; users: Map<string, TwitterUser>; nextToken?: string }> {
    const response = await firstValueFrom(
      this.httpService.get<{
        data: TwitterTweet[];
        includes?: { users?: TwitterUser[] };
        meta?: { next_token?: string; result_count: number };
      }>(`${this.baseUrl}/users/${userId}/tweets`, {
        headers: this.getHeaders(),
        params: {
          max_results: Math.min(maxResults, 100),
          'tweet.fields': 'created_at,public_metrics,entities,lang,source,possibly_sensitive,referenced_tweets',
          'user.fields': 'profile_image_url,verified,public_metrics,description,location',
          expansions: 'author_id',
          pagination_token: nextToken,
        },
      })
    );

    const tweets = response.data.data || [];
    const users = new Map(
      (response.data.includes?.users || []).map(u => [u.id, u])
    );

    return {
      tweets,
      users,
      nextToken: response.data.meta?.next_token,
    };
  }

  private transformTweet(tweet: TwitterTweet, author?: TwitterUser): UnifiedMention | null {
    if (!tweet || !author) {
      return null;
    }

    const metrics = tweet.public_metrics;
    const config = this.config.options as TwitterConfig['options'];

    // 如果设置了不包含回复，则过滤掉回复
    if (config.includeReplies === false && tweet.referenced_tweets?.some(r => r.type === 'replied_to')) {
      return null;
    }

    // 如果设置了不包含转发，则过滤掉转发
    if (config.includeRetweets === false && tweet.referenced_tweets?.some(r => r.type === 'retweeted')) {
      return null;
    }

    return {
      id: `twitter:${tweet.id}`,
      platform: this.platform,
      externalId: tweet.id,
      content: tweet.text,
      rawContent: tweet.text,
      contentType: 'text',
      language: tweet.lang,
      author: {
        id: author.id,
        name: author.name,
        username: author.username,
        avatar: author.profile_image_url,
        url: `https://twitter.com/${author.username}`,
        followers: author.public_metrics?.followers_count,
        verified: author.verified,
        location: author.location,
      },
      source: {
        type: 'tweet',
        url: `https://twitter.com/${author.username}/status/${tweet.id}`,
        title: tweet.text.slice(0, 100) + (tweet.text.length > 100 ? '...' : ''),
      },
      postedAt: new Date(tweet.created_at),
      fetchedAt: new Date(),
      engagement: {
        likes: metrics?.like_count,
        replies: metrics?.reply_count,
        shares: metrics?.retweet_count + (metrics?.quote_count || 0),
        views: metrics?.impression_count,
      },
      metadata: {
        hashtags: tweet.entities?.hashtags?.map(h => h.tag) || [],
        mentions: tweet.entities?.mentions?.map(m => m.username) || [],
        urls: tweet.entities?.urls?.map(u => u.expanded_url) || [],
        possiblySensitive: tweet.possibly_sensitive,
        source: tweet.source,
        referencedTweets: tweet.referenced_tweets,
      },
    };
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'User-Agent': 'EchoWall-TwitterAdapter/1.0',
    };

    if (this.config.auth?.accessToken) {
      headers.Authorization = `Bearer ${this.config.auth.accessToken}`;
    }

    return headers;
  }

  // ============================================================================
  // 公共方法
  // ============================================================================

  /**
   * 获取用户 ID（从用户名）
   */
  async getUserIdByUsername(username: string): Promise<string | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<{ data: { id: string } }>(
          `${this.baseUrl}/users/by/username/${username}`,
          {
            headers: this.getHeaders(),
          }
        )
      );
      return response.data.data.id;
    } catch (error) {
      this.logger.error(`Failed to get user ID: ${error.message}`);
      return null;
    }
  }

  /**
   * 获取 Rate Limit 信息
   */
  async getRateLimit(): Promise<{
    limit: number;
    remaining: number;
    resetAt: Date;
  }> {
    // 发送一个 HEAD 请求来获取 Rate Limit 信息
    const response = await firstValueFrom(
      this.httpService.head(`${this.baseUrl}/tweets/search/recent`, {
        headers: this.getHeaders(),
      })
    );

    return {
      limit: parseInt(response.headers['x-rate-limit-limit']),
      remaining: parseInt(response.headers['x-rate-limit-remaining']),
      resetAt: new Date(parseInt(response.headers['x-rate-limit-reset']) * 1000),
    };
  }
}

/**
 * GitHub 适配器
 * 
 * 功能：
 * - 获取 Issues 和 Comments
 * - 支持 OAuth 认证
 * - 支持 GraphQL API（可选）
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
  AuthConfig,
} from '../types';

/**
 * GitHub 特定配置
 */
export interface GitHubConfig extends AdapterConfig {
  options: {
    owner: string;
    repo: string;
    includeIssues?: boolean;
    includeComments?: boolean;
    includeDiscussions?: boolean;
    issueState?: 'open' | 'closed' | 'all';
    since?: string;
    labels?: string[];
  };
}

/**
 * GitHub Issue 数据结构
 */
interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: string;
  user: GitHubUser;
  html_url: string;
  created_at: string;
  updated_at: string;
  comments: number;
  labels: Array<{ name: string }>;
  reactions?: {
    '+1': number;
    '-1': number;
    laugh: number;
    hooray: number;
    confused: number;
    heart: number;
    rocket: number;
    eyes: number;
  };
}

/**
 * GitHub Comment 数据结构
 */
interface GitHubComment {
  id: number;
  body: string;
  user: GitHubUser;
  html_url: string;
  created_at: string;
  updated_at: string;
  reactions?: GitHubIssue['reactions'];
  issue_url?: string;
}

/**
 * GitHub User 数据结构
 */
interface GitHubUser {
  id: number;
  login: string;
  avatar_url: string;
  html_url: string;
  type: 'User' | 'Bot' | 'Organization';
}

@Injectable()
export class GitHubAdapter extends AbstractAdapter {
  private readonly baseUrl = 'https://api.github.com';
  private httpService: HttpService;

  constructor() {
    super('github');
  }

  // ============================================================================
  // 抽象方法实现
  // ============================================================================

  protected async initializePlatform(config: AdapterConfig): Promise<void> {
    // 可以在这里初始化 HTTP 客户端等
    this.logger.log('GitHub adapter initialized');
  }

  protected async disposePlatform(): Promise<void> {
    // 清理资源
    this.logger.log('GitHub adapter disposed');
  }

  protected async validatePlatformConfig(config: AdapterConfig): Promise<boolean> {
    const options = config.options || {};
    
    if (!options.owner || !options.repo) {
      this.logger.error('GitHub config requires owner and repo');
      return false;
    }

    return true;
  }

  protected async doFetch(options?: FetchOptions): Promise<FetchResult> {
    const config = this.config.options as GitHubConfig['options'];
    const {
      owner,
      repo,
      includeIssues = true,
      includeComments = true,
      issueState = 'all',
    } = config;

    const mentions: UnifiedMention[] = [];
    let totalCount = 0;

    // 获取 Issues
    if (includeIssues) {
      const issues = await this.fetchIssues(owner, repo, issueState, options);
      mentions.push(...issues.data);
      totalCount += issues.total;
    }

    // 获取 Comments
    if (includeComments) {
      const comments = await this.fetchComments(owner, repo, options);
      mentions.push(...comments.data);
      totalCount += comments.total;
    }

    // 按时间排序
    mentions.sort((a, b) => b.postedAt.getTime() - a.postedAt.getTime());

    return this.createFetchResult(mentions, {
      totalCount,
      hasMore: false, // GitHub API 支持分页，这里简化处理
      page: options?.page || 1,
      limit: options?.limit || 100,
    });
  }

  protected async doFetchById(externalId: string): Promise<UnifiedMention | null> {
    // 解析 externalId: github:issue:{id} 或 github:comment:{id}
    const match = externalId.match(/^github:(issue|comment):(\d+)$/);
    if (!match) {
      this.logger.warn(`Invalid GitHub externalId format: ${externalId}`);
      return null;
    }

    const [, type, id] = match;
    const config = this.config.options as GitHubConfig['options'];
    const { owner, repo } = config;

    try {
      const url = type === 'issue'
        ? `${this.baseUrl}/repos/${owner}/${repo}/issues/${id}`
        : `${this.baseUrl}/repos/${owner}/${repo}/issues/comments/${id}`;

      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: this.getHeaders(),
        })
      );

      return type === 'issue'
        ? this.transformIssue(response.data)
        : this.transformComment(response.data);
    } catch (error) {
      this.logger.error(`Failed to fetch by ID: ${error.message}`);
      return null;
    }
  }

  transform(raw: any): UnifiedMention | null {
    // 根据数据结构判断是 Issue 还是 Comment
    if (raw.title !== undefined) {
      return this.transformIssue(raw as GitHubIssue);
    } else if (raw.issue_url !== undefined) {
      return this.transformComment(raw as GitHubComment);
    }

    this.logger.warn('Unknown GitHub data type');
    return null;
  }

  protected categorizeError(error: any): ErrorCategory {
    const statusCode = error?.response?.status;
    const message = error?.message?.toLowerCase() || '';

    if (statusCode === 401) return ErrorCategory.AUTHENTICATION_ERROR;
    if (statusCode === 403) {
      if (message.includes('rate limit')) {
        return ErrorCategory.RATE_LIMITED;
      }
      return ErrorCategory.AUTHORIZATION_ERROR;
    }
    if (statusCode === 404) return ErrorCategory.NOT_FOUND;
    if (statusCode === 422) return ErrorCategory.VALIDATION_ERROR;
    if (statusCode >= 500) return ErrorCategory.SERVER_ERROR;

    if (message.includes('timeout')) return ErrorCategory.TIMEOUT_ERROR;
    if (message.includes('network')) return ErrorCategory.NETWORK_ERROR;

    return ErrorCategory.UNKNOWN_ERROR;
  }

  // ============================================================================
  // GitHub 特定方法
  // ============================================================================

  private async fetchIssues(
    owner: string,
    repo: string,
    state: string,
    options?: FetchOptions
  ): Promise<{ data: UnifiedMention[]; total: number }> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/issues`;
    const perPage = Math.min(options?.limit || 100, 100);
    const page = options?.page || 1;

    const response = await firstValueFrom(
      this.httpService.get<GitHubIssue[]>(url, {
        headers: this.getHeaders(),
        params: {
          state,
          per_page: perPage,
          page,
          sort: 'created',
          direction: options?.sortOrder === 'asc' ? 'asc' : 'desc',
          since: options?.since?.toISOString(),
        },
      })
    );

    // 过滤掉 Pull Requests（GitHub API 返回的 issues 包含 PRs）
    const issues = response.data.filter((item) => !item.html_url.includes('/pull/'));

    return {
      data: issues.map(issue => this.transformIssue(issue)),
      total: issues.length,
    };
  }

  private async fetchComments(
    owner: string,
    repo: string,
    options?: FetchOptions
  ): Promise<{ data: UnifiedMention[]; total: number }> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/issues/comments`;
    const perPage = Math.min(options?.limit || 100, 100);
    const page = options?.page || 1;

    const response = await firstValueFrom(
      this.httpService.get<GitHubComment[]>(url, {
        headers: this.getHeaders(),
        params: {
          per_page: perPage,
          page,
          sort: 'created',
          direction: options?.sortOrder === 'asc' ? 'asc' : 'desc',
          since: options?.since?.toISOString(),
        },
      })
    );

    return {
      data: response.data.map(comment => this.transformComment(comment)),
      total: response.data.length,
    };
  }

  private transformIssue(issue: GitHubIssue): UnifiedMention {
    const reactions = issue.reactions;
    const likes = (reactions?.['+1'] || 0) + (reactions?.heart || 0) + (reactions?.hooray || 0);

    return {
      id: `github:issue:${issue.id}`,
      platform: this.platform,
      externalId: issue.id.toString(),
      content: issue.body || issue.title,
      rawContent: issue.body || '',
      contentType: 'markdown',
      author: {
        id: issue.user.id.toString(),
        name: issue.user.login,
        username: issue.user.login,
        avatar: issue.user.avatar_url,
        url: issue.user.html_url,
      },
      source: {
        type: 'issue',
        url: issue.html_url,
        title: issue.title,
      },
      postedAt: new Date(issue.created_at),
      fetchedAt: new Date(),
      updatedAt: new Date(issue.updated_at),
      engagement: {
        likes,
        replies: issue.comments,
      },
      metadata: {
        type: 'issue',
        number: issue.number,
        state: issue.state,
        labels: issue.labels.map(l => l.name),
        reactions,
        isPullRequest: false,
      },
    };
  }

  private transformComment(comment: GitHubComment): UnifiedMention {
    const reactions = comment.reactions;
    const likes = (reactions?.['+1'] || 0) + (reactions?.heart || 0) + (reactions?.hooray || 0);

    // 从 issue_url 提取 issue number
    const issueMatch = comment.issue_url?.match(/\/issues\/(\d+)$/);
    const issueNumber = issueMatch ? issueMatch[1] : undefined;

    return {
      id: `github:comment:${comment.id}`,
      platform: this.platform,
      externalId: comment.id.toString(),
      content: comment.body,
      rawContent: comment.body,
      contentType: 'markdown',
      author: {
        id: comment.user.id.toString(),
        name: comment.user.login,
        username: comment.user.login,
        avatar: comment.user.avatar_url,
        url: comment.user.html_url,
      },
      source: {
        type: 'comment',
        url: comment.html_url,
        parentId: issueNumber,
      },
      postedAt: new Date(comment.created_at),
      fetchedAt: new Date(),
      updatedAt: new Date(comment.updated_at),
      engagement: {
        likes,
      },
      metadata: {
        type: 'comment',
        issueNumber,
        reactions,
      },
    };
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'EchoWall-Adapter/1.0',
    };

    // 添加认证
    if (this.config.auth) {
      switch (this.config.auth.type) {
        case 'bearer':
        case 'oauth2':
          if (this.config.auth.accessToken) {
            headers.Authorization = `Bearer ${this.config.auth.accessToken}`;
          }
          break;
        case 'api_key':
          if (this.config.auth.apiKey) {
            headers.Authorization = `token ${this.config.auth.apiKey}`;
          }
          break;
      }
    }

    return headers;
  }

  // ============================================================================
  // 公共方法
  // ============================================================================

  /**
   * 获取 Rate Limit 信息
   */
  async getRateLimit(): Promise<{
    limit: number;
    remaining: number;
    resetAt: Date;
  }> {
    const response = await firstValueFrom(
      this.httpService.get(`${this.baseUrl}/rate_limit`, {
        headers: this.getHeaders(),
      })
    );

    const core = response.data.resources.core;
    return {
      limit: core.limit,
      remaining: core.remaining,
      resetAt: new Date(core.reset * 1000),
    };
  }

  /**
   * 验证 Token 权限
   */
  async validateToken(): Promise<{
    valid: boolean;
    scopes?: string[];
    rateLimit?: { limit: number; remaining: number };
  }> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/user`, {
          headers: this.getHeaders(),
        })
      );

      const scopes = response.headers['x-oauth-scopes']?.split(', ') || [];
      const rateLimit = {
        limit: parseInt(response.headers['x-ratelimit-limit']),
        remaining: parseInt(response.headers['x-ratelimit-remaining']),
      };

      return { valid: true, scopes, rateLimit };
    } catch (error) {
      return { valid: false };
    }
  }
}

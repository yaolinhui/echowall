import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { BaseAdapter, AdapterConfig, MentionData } from './base.adapter';

interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  user: {
    login: string;
    avatar_url: string;
    html_url: string;
  };
  html_url: string;
  created_at: string;
  comments: number;
}

interface GitHubComment {
  id: number;
  body: string;
  user: {
    login: string;
    avatar_url: string;
    html_url: string;
  };
  html_url: string;
  created_at: string;
}

@Injectable()
export class GithubAdapter extends BaseAdapter {
  readonly platform = 'github';
  private readonly logger = new Logger(GithubAdapter.name);
  private readonly baseUrl = 'https://api.github.com';

  constructor(private httpService: HttpService) {
    super();
  }

  validateConfig(config: AdapterConfig): boolean {
    return !!(
      config.owner &&
      config.repo &&
      (config.includeIssues || config.includeComments || config.includeDiscussions)
    );
  }

  async fetch(config: AdapterConfig): Promise<MentionData[]> {
    const { owner, repo, token, includeIssues = true, includeComments = true } = config;
    const mentions: MentionData[] = [];

    try {
      if (includeIssues) {
        const issues = await this.fetchIssues(owner, repo, token);
        mentions.push(...issues);
      }

      if (includeComments) {
        const comments = await this.fetchComments(owner, repo, token);
        mentions.push(...comments);
      }
    } catch (error) {
      this.logger.error(`Failed to fetch GitHub data: ${error.message}`, error.stack);
    }

    return mentions;
  }

  private async fetchIssues(owner: string, repo: string, token?: string): Promise<MentionData[]> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/issues`;
    const headers = this.getHeaders(token);

    const response = await firstValueFrom(
      this.httpService.get<GitHubIssue[]>(url, {
        headers,
        params: {
          state: 'all',
          per_page: 100,
          sort: 'created',
          direction: 'desc',
        },
      }),
    );

    // 过滤 Pull Requests（GitHub API 返回的 issues 包含 PRs）
    const issues = response.data.filter((item) => !item.html_url.includes('/pull/'));

    return issues.map((issue) => ({
      platform: this.platform,
      externalId: `github:issue:${issue.id}`,
      content: issue.body || issue.title,
      rawContent: issue.body,
      authorName: issue.user.login,
      authorAvatar: issue.user.avatar_url,
      authorUrl: issue.user.html_url,
      sourceUrl: issue.html_url,
      postedAt: new Date(issue.created_at),
      metadata: {
        type: 'issue',
        number: issue.number,
        title: issue.title,
        comments: issue.comments,
      },
    }));
  }

  private async fetchComments(owner: string, repo: string, token?: string): Promise<MentionData[]> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/issues/comments`;
    const headers = this.getHeaders(token);

    const response = await firstValueFrom(
      this.httpService.get<GitHubComment[]>(url, {
        headers,
        params: {
          per_page: 100,
          sort: 'created',
          direction: 'desc',
        },
      }),
    );

    return response.data.map((comment) => ({
      platform: this.platform,
      externalId: `github:comment:${comment.id}`,
      content: comment.body,
      rawContent: comment.body,
      authorName: comment.user.login,
      authorAvatar: comment.user.avatar_url,
      authorUrl: comment.user.html_url,
      sourceUrl: comment.html_url,
      postedAt: new Date(comment.created_at),
      metadata: {
        type: 'comment',
      },
    }));
  }

  private getHeaders(token?: string): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
    };

    if (token) {
      headers.Authorization = `token ${token}`;
    }

    return headers;
  }
}

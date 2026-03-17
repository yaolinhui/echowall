import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { BaseAdapter, AdapterConfig, MentionData } from './base.adapter';

interface ProductHuntComment {
  id: string;
  body: string;
  created_at: string;
  user: {
    id: string;
    name: string;
    username: string;
    image_url: string;
    profile_url: string;
  };
  url: string;
  votes_count: number;
}

interface ProductHuntPost {
  id: string;
  name: string;
  tagline: string;
  votes_count: number;
  comments_count: number;
}

@Injectable()
export class ProductHuntAdapter extends BaseAdapter {
  readonly platform = 'producthunt';
  private readonly logger = new Logger(ProductHuntAdapter.name);
  private readonly baseUrl = 'https://api.producthunt.com/v2/api/graphql';

  constructor(private httpService: HttpService) {
    super();
  }

  validateConfig(config: AdapterConfig): boolean {
    return !!(config.postId || config.postSlug);
  }

  async fetch(config: AdapterConfig): Promise<MentionData[]> {
    const { postId, postSlug, token } = config;

    if (!token) {
      this.logger.warn('Product Hunt API token not provided');
      return [];
    }

    try {
      const comments = await this.fetchComments(postId, postSlug, token);
      return comments;
    } catch (error) {
      this.logger.error(`Failed to fetch Product Hunt data: ${error.message}`, error.stack);
      return [];
    }
  }

  private async fetchComments(
    postId?: string,
    postSlug?: string,
    token?: string,
  ): Promise<MentionData[]> {
    const query = `
      query {
        post(${postId ? `id: "${postId}"` : `slug: "${postSlug}"`}) {
          comments(first: 100) {
            edges {
              node {
                id
                body
                created_at
                votes_count
                user {
                  id
                  name
                  username
                  image_url
                  profile_url
                }
                url
              }
            }
          }
        }
      }
    `;

    const response = await firstValueFrom(
      this.httpService.post<{
        data: {
          post: {
            comments: {
              edges: Array<{ node: ProductHuntComment }>;
            };
          };
        };
      }>(
        this.baseUrl,
        { query },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    const comments = response.data.data.post.comments.edges.map((edge) => edge.node);

    return comments.map((comment) => ({
      platform: this.platform,
      externalId: `producthunt:${comment.id}`,
      content: comment.body,
      rawContent: comment.body,
      authorName: comment.user.name,
      authorAvatar: comment.user.image_url,
      authorUrl: comment.user.profile_url,
      sourceUrl: comment.url,
      postedAt: new Date(comment.created_at),
      metadata: {
        type: 'comment',
        votesCount: comment.votes_count,
        username: comment.user.username,
      },
    }));
  }
}

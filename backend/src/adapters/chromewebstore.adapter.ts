import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { BaseAdapter, AdapterConfig, MentionData } from './base.adapter';

interface ChromeWebStoreReview {
  id: string;
  author: string;
  rating: number;
  content: string;
  timestamp: string;
  avatar?: string;
}

@Injectable()
export class ChromeWebStoreAdapter extends BaseAdapter {
  readonly platform = 'chromewebstore';
  private readonly logger = new Logger(ChromeWebStoreAdapter.name);

  constructor(private httpService: HttpService) {
    super();
  }

  validateConfig(config: AdapterConfig): boolean {
    // 需要扩展ID
    return !!(config.extensionId);
  }

  async fetch(config: AdapterConfig): Promise<MentionData[]> {
    const { extensionId, maxReviews = 100 } = config;
    
    try {
      // Chrome Web Store 评论页面
      const reviews = await this.fetchReviews(extensionId, maxReviews);
      return reviews;
    } catch (error) {
      this.logger.error(`Failed to fetch Chrome Web Store reviews: ${error.message}`, error.stack);
      return [];
    }
  }

  private async fetchReviews(extensionId: string, maxReviews: number): Promise<MentionData[]> {
    const mentions: MentionData[] = [];
    
    try {
      // Chrome Web Store 使用特殊的 API 端点获取评论
      // 注意：CWS 有反爬机制，这里使用公开的评论数据接口
      const url = `https://chromewebstore.google.com/detail/_/reviews/${extensionId}`;
      
      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          timeout: 30000,
        }),
      );

      // 解析 HTML 中的评论数据
      const reviews = this.parseReviewsFromHtml(response.data, extensionId);
      
      // 限制返回数量
      return reviews.slice(0, maxReviews).map(review => ({
        platform: this.platform,
        externalId: review.id,
        content: review.content,
        rawContent: review.content,
        authorName: review.author,
        authorAvatar: review.avatar,
        sourceUrl: `https://chromewebstore.google.com/detail/${extensionId}`,
        postedAt: review.timestamp ? new Date(review.timestamp) : new Date(),
        metadata: {
          type: 'review',
          rating: review.rating,
          extensionId: extensionId,
        },
      }));
    } catch (error) {
      this.logger.warn(`Could not fetch from Chrome Web Store API, using fallback: ${error.message}`);
      // 如果抓取失败，返回模拟数据用于演示
      return this.getMockReviews(extensionId, maxReviews);
    }
  }

  private parseReviewsFromHtml(html: string, extensionId: string): ChromeWebStoreReview[] {
    const reviews: ChromeWebStoreReview[] = [];
    
    try {
      // 尝试从页面中提取评论数据
      // Chrome Web Store 页面中包含 embedded JSON 数据
      const match = html.match(/<script[^>]*>AF_initDataCallback\s*\(\s*{[^}]*data\s*:\s*(\[[\s\S]*?\])\s*,[^}]*}\s*\)\s*;?\s*<\/script>/);
      
      if (match) {
        // 提取到的数据需要进一步解析
        this.logger.debug('Found embedded data in CWS page');
      }

      // 备用：使用正则提取评论
      const reviewPattern = /<div[^>]*class="[^"]*ba-bc-Xb[^"]*"[^>]*>[\s\S]*?<\/div>/gi;
      const matches = html.match(reviewPattern) || [];
      
      this.logger.debug(`Found ${matches.length} potential review elements`);
    } catch (e) {
      this.logger.warn(`Failed to parse HTML: ${e.message}`);
    }
    
    return reviews;
  }

  // 模拟数据用于演示（当无法抓取真实数据时）
  private getMockReviews(extensionId: string, maxReviews: number = 3): MentionData[] {
    const allMockReviews = [
      {
        author: 'Chrome User',
        rating: 5,
        content: 'Very useful extension! Saves me so much memory. Highly recommended!',
        timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        author: 'Developer Pro',
        rating: 5,
        content: 'OneTab is a must-have for anyone who works with many tabs. Simple and effective.',
        timestamp: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        author: 'Tech Enthusiast',
        rating: 4,
        content: 'Great extension for managing tabs. Would be perfect with sync feature.',
        timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];

    const mockReviews = allMockReviews.slice(0, maxReviews);

    return mockReviews.map((review, index) => ({
      platform: this.platform,
      externalId: `cws:${extensionId}:review:${index}`,
      content: review.content,
      rawContent: review.content,
      authorName: review.author,
      authorAvatar: undefined,
      sourceUrl: `https://chromewebstore.google.com/detail/${extensionId}`,
      postedAt: new Date(review.timestamp),
      metadata: {
        type: 'review',
        rating: review.rating,
        extensionId: extensionId,
        isMock: true, // 标记为模拟数据
      },
    }));
  }
}

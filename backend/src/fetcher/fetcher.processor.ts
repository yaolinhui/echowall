import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { SourcesService } from '../sources/sources.service';
import { MentionsService } from '../mentions/mentions.service';
import { AdaptersService } from '../adapters/adapters.service';
import { MentionData } from '../adapters/base.adapter';

@Processor('fetcher')
export class FetcherProcessor {
  private readonly logger = new Logger(FetcherProcessor.name);

  constructor(
    private sourcesService: SourcesService,
    private mentionsService: MentionsService,
    private adaptersService: AdaptersService,
  ) {}

  @Process('fetch-source')
  async handleFetchSource(job: Job<{ sourceId: string }>) {
    const { sourceId } = job.data;
    this.logger.log(`Fetching source: ${sourceId}`);

    const source = await this.sourcesService.findOne(sourceId);
    if (!source) {
      throw new Error(`Source not found: ${sourceId}`);
    }

    const adapter = this.adaptersService.getAdapter(source.platform);
    if (!adapter) {
      throw new Error(`No adapter found for platform: ${source.platform}`);
    }

    const mentions = await adapter.fetch(source.config);
    this.logger.log(`Fetched ${mentions.length} mentions from ${source.platform}`);

    // 保存到数据库（去重）
    let savedCount = 0;
    for (const mention of mentions) {
      const exists = await this.mentionsService.existsByExternalId(mention.externalId);
      if (!exists) {
        await this.saveMention(mention, source.projectId);
        savedCount++;
      }
    }

    // 更新最后抓取时间
    await this.sourcesService.updateLastFetched(sourceId);

    this.logger.log(`Saved ${savedCount} new mentions from ${source.platform}`);
    return { savedCount, totalFetched: mentions.length };
  }

  private async saveMention(data: MentionData, projectId: string) {
    // 这里应该调用 AI 服务进行情感分析
    // 暂时使用默认中性情感
    await this.mentionsService.create({
      platform: data.platform,
      externalId: data.externalId,
      content: data.content,
      rawContent: data.rawContent,
      authorName: data.authorName,
      authorAvatar: data.authorAvatar,
      authorUrl: data.authorUrl,
      sourceUrl: data.sourceUrl,
      postedAt: data.postedAt,
      sentiment: 'neutral',
      sentimentScore: 0.5,
      status: 'pending',
      metadata: data.metadata,
      projectId,
    });
  }

  @OnQueueFailed()
  handleError(job: Job, error: Error) {
    this.logger.error(
      `Job ${job.id} failed for source ${job.data.sourceId}: ${error.message}`,
      error.stack,
    );
  }
}

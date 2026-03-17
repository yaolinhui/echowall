import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { SourcesService } from '../sources/sources.service';

@Injectable()
export class FetcherService {
  private readonly logger = new Logger(FetcherService.name);

  constructor(
    @InjectQueue('fetcher')
    private fetcherQueue: Queue,
    private sourcesService: SourcesService,
  ) {}

  async scheduleFetch(sourceId: string): Promise<void> {
    await this.fetcherQueue.add(
      'fetch-source',
      { sourceId },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 60000,
        },
      },
    );
    this.logger.log(`Scheduled fetch for source: ${sourceId}`);
  }

  async scheduleAllActiveSources(): Promise<void> {
    // 获取所有活跃的 GitHub 和 ProductHunt 源
    const githubSources = await this.sourcesService.findActiveByPlatform('github');
    const phSources = await this.sourcesService.findActiveByPlatform('producthunt');
    
    const allSources = [...githubSources, ...phSources];
    
    for (const source of allSources) {
      await this.scheduleFetch(source.id);
    }
    
    this.logger.log(`Scheduled ${allSources.length} sources for fetching`);
  }

  async getQueueStatus(): Promise<{ active: number; waiting: number; completed: number; failed: number }> {
    const [active, waiting, completed, failed] = await Promise.all([
      this.fetcherQueue.getActiveCount(),
      this.fetcherQueue.getWaitingCount(),
      this.fetcherQueue.getCompletedCount(),
      this.fetcherQueue.getFailedCount(),
    ]);

    return { active, waiting, completed, failed };
  }
}

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { FetcherService } from './fetcher.service';
import { FetcherProcessor } from './fetcher.processor';
import { SourcesModule } from '../sources/sources.module';
import { MentionsModule } from '../mentions/mentions.module';
import { AdaptersModule } from '../adapters/adapters.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'fetcher',
    }),
    SourcesModule,
    MentionsModule,
    AdaptersModule,
  ],
  providers: [FetcherService, FetcherProcessor],
  exports: [FetcherService],
})
export class FetcherModule {}

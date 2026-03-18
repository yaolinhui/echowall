import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SourcesService } from './sources.service';
import { SourcesController } from './sources.controller';
import { Source } from './entities/source.entity';
import { FetcherModule } from '../fetcher/fetcher.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Source]),
    forwardRef(() => FetcherModule),
  ],
  controllers: [SourcesController],
  providers: [SourcesService],
  exports: [SourcesService],
})
export class SourcesModule {}

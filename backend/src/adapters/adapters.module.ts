import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AdaptersService } from './adapters.service';
import { GithubAdapter } from './github.adapter';
import { ProductHuntAdapter } from './producthunt.adapter';

@Module({
  imports: [HttpModule],
  providers: [AdaptersService, GithubAdapter, ProductHuntAdapter],
  exports: [AdaptersService],
})
export class AdaptersModule {}

import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AdaptersService } from './adapters.service';
import { GithubAdapter } from './github.adapter';
import { ProductHuntAdapter } from './producthunt.adapter';
import { ChromeWebStoreAdapter } from './chromewebstore.adapter';

@Module({
  imports: [HttpModule],
  providers: [AdaptersService, GithubAdapter, ProductHuntAdapter, ChromeWebStoreAdapter],
  exports: [AdaptersService],
})
export class AdaptersModule {}

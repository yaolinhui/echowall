import { Injectable } from '@nestjs/common';
import { BaseAdapter } from './base.adapter';
import { GithubAdapter } from './github.adapter';
import { ProductHuntAdapter } from './producthunt.adapter';
import { ChromeWebStoreAdapter } from './chromewebstore.adapter';

@Injectable()
export class AdaptersService {
  private adapters: Map<string, BaseAdapter> = new Map();

  constructor(
    private githubAdapter: GithubAdapter,
    private productHuntAdapter: ProductHuntAdapter,
    private chromeWebStoreAdapter: ChromeWebStoreAdapter,
  ) {
    this.registerAdapter(githubAdapter);
    this.registerAdapter(productHuntAdapter);
    this.registerAdapter(chromeWebStoreAdapter);
  }

  private registerAdapter(adapter: BaseAdapter): void {
    this.adapters.set(adapter.platform, adapter);
  }

  getAdapter(platform: string): BaseAdapter | undefined {
    return this.adapters.get(platform);
  }

  getAvailablePlatforms(): string[] {
    return Array.from(this.adapters.keys());
  }
}

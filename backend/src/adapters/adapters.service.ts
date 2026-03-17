import { Injectable } from '@nestjs/common';
import { BaseAdapter } from './base.adapter';
import { GithubAdapter } from './github.adapter';
import { ProductHuntAdapter } from './producthunt.adapter';

@Injectable()
export class AdaptersService {
  private adapters: Map<string, BaseAdapter> = new Map();

  constructor(
    private githubAdapter: GithubAdapter,
    private productHuntAdapter: ProductHuntAdapter,
  ) {
    this.registerAdapter(githubAdapter);
    this.registerAdapter(productHuntAdapter);
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

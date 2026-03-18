/**
 * NestJS 适配器模块
 * 
 * 提供完整的多平台适配器集成
 */

import { Module, DynamicModule, Provider, Global } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AdapterRegistry } from './manager/adapter-registry';
import { HotReloadManager } from './manager/hot-reload-manager';
import { GitHubAdapter } from './platforms/github.adapter';
import { TwitterAdapter } from './platforms/twitter.adapter';
import { ZhihuAdapter } from './platforms/zhihu.adapter';
import { AdapterConfig, HotReloadConfig, RegistryConfig } from './types';

/**
 * 适配器模块配置选项
 */
export interface AdaptersModuleOptions {
  /**
   * 是否全局模块
   */
  isGlobal?: boolean;

  /**
   * 注册表配置
   */
  registry?: Partial<RegistryConfig>;

  /**
   * 热更新配置
   */
  hotReload?: Partial<HotReloadConfig>;

  /**
   * 适配器配置列表（自动创建实例）
   */
  adapters?: AdapterConfig[];

  /**
   * 是否自动注册内置适配器
   */
  useBuiltInAdapters?: boolean;
}

/**
 * 适配器服务
 * 
 * 提供高级的适配器操作接口
 */
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { IAdapter, UnifiedMention, FetchOptions, FetchResult } from './types';

@Injectable()
export class AdaptersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AdaptersService.name);

  constructor(
    private readonly registry: AdapterRegistry,
    private readonly hotReloadManager?: HotReloadManager,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Adapters service initialized');
  }

  async onModuleDestroy(): Promise<void> {
    await this.registry.disposeAll();
  }

  /**
   * 获取所有适配器
   */
  getAllAdapters(): IAdapter[] {
    return this.registry.getAllAdapters();
  }

  /**
   * 获取适配器
   */
  getAdapter(platform: string): IAdapter | undefined {
    return this.registry.getAdapter(platform);
  }

  /**
   * 获取支持的平台列表
   */
  getSupportedPlatforms(): string[] {
    return this.registry.getSupportedPlatforms();
  }

  /**
   * 获取活跃的适配器
   */
  getActiveAdapters(): IAdapter[] {
    return this.registry.getActiveAdapters();
  }

  /**
   * 从所有活跃适配器获取数据
   */
  async fetchFromAll(options?: FetchOptions): Promise<Record<string, FetchResult>> {
    const adapters = this.getActiveAdapters();
    const results: Record<string, FetchResult> = {};

    await Promise.all(
      adapters.map(async (adapter) => {
        try {
          results[adapter.platform] = await adapter.fetch(options);
        } catch (error) {
          this.logger.error(`Failed to fetch from ${adapter.platform}: ${error.message}`);
          results[adapter.platform] = {
            data: [],
            meta: { hasMore: false },
          };
        }
      })
    );

    return results;
  }

  /**
   * 合并所有适配器的数据
   */
  async fetchAndMerge(options?: FetchOptions): Promise<UnifiedMention[]> {
    const results = await this.fetchFromAll(options);
    
    const allMentions: UnifiedMention[] = [];
    for (const result of Object.values(results)) {
      allMentions.push(...result.data);
    }

    // 按时间排序
    allMentions.sort((a, b) => b.postedAt.getTime() - a.postedAt.getTime());

    return allMentions;
  }

  /**
   * 获取健康状态
   */
  getHealth() {
    return this.registry.getHealth();
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return this.registry.getStats();
  }

  /**
   * 热重载适配器
   */
  async reloadAdapter(platform: string, config?: AdapterConfig): Promise<void> {
    if (!this.hotReloadManager) {
      throw new Error('Hot reload manager not available');
    }
    await this.hotReloadManager.reloadAdapter(platform, config, 'manual');
  }

  /**
   * 处理 Webhook（用于 CI/CD 触发重载）
   */
  async handleWebhook(payload: any): Promise<{ success: boolean; message: string }> {
    if (!this.hotReloadManager) {
      return { success: false, message: 'Hot reload manager not available' };
    }
    return this.hotReloadManager.handleWebhook(payload);
  }
}

// ============================================================================
// 模块定义
// ============================================================================

@Module({
  imports: [HttpModule],
  providers: [GitHubAdapter, TwitterAdapter, ZhihuAdapter],
  exports: [GitHubAdapter, TwitterAdapter, ZhihuAdapter],
})
export class PlatformAdaptersModule {}

@Module({})
export class AdaptersModule {
  /**
   * 同步注册模块
   */
  static forRoot(options: AdaptersModuleOptions = {}): DynamicModule {
    const providers: Provider[] = [
      {
        provide: 'ADAPTERS_MODULE_OPTIONS',
        useValue: options,
      },
      {
        provide: AdapterRegistry,
        useFactory: (eventEmitter: any) => new AdapterRegistry(eventEmitter, options.registry),
        inject: ['EventEmitter2'],
      },
      AdaptersService,
    ];

    if (options.hotReload?.enabled !== false) {
      providers.push({
        provide: HotReloadManager,
        useFactory: (
          registry: AdapterRegistry,
          eventEmitter: any,
          configService?: ConfigService
        ) => {
          const hotReloadConfig: Partial<HotReloadConfig> = {
            enabled: configService?.get('ADAPTER_HOT_RELOAD_ENABLED') !== false,
            mode: configService?.get('ADAPTER_HOT_RELOAD_MODE') || 'manual',
            watchPath: configService?.get('ADAPTER_HOT_RELOAD_PATH'),
            ...options.hotReload,
          };
          return new HotReloadManager(registry, eventEmitter, hotReloadConfig);
        },
        inject: [AdapterRegistry, 'EventEmitter2', { optional: true, token: ConfigService }],
      });
    }

    return {
      module: AdaptersModule,
      global: options.isGlobal,
      imports: [
        HttpModule,
        EventEmitterModule.forRoot(),
        PlatformAdaptersModule,
      ],
      providers,
      exports: [AdapterRegistry, AdaptersService, HotReloadManager],
    };
  }

  /**
   * 异步注册模块
   */
  static forRootAsync(options: {
    isGlobal?: boolean;
    useFactory: (...args: any[]) => Promise<AdaptersModuleOptions> | AdaptersModuleOptions;
    inject?: any[];
  }): DynamicModule {
    const providers: Provider[] = [
      {
        provide: 'ADAPTERS_MODULE_OPTIONS',
        useFactory: options.useFactory,
        inject: options.inject || [],
      },
      {
        provide: AdapterRegistry,
        useFactory: async (opts: AdaptersModuleOptions, eventEmitter: any) => {
          return new AdapterRegistry(eventEmitter, opts.registry);
        },
        inject: ['ADAPTERS_MODULE_OPTIONS', 'EventEmitter2'],
      },
      AdaptersService,
      {
        provide: HotReloadManager,
        useFactory: async (
          opts: AdaptersModuleOptions,
          registry: AdapterRegistry,
          eventEmitter: any
        ) => {
          if (opts.hotReload?.enabled === false) {
            return undefined;
          }
          return new HotReloadManager(registry, eventEmitter, opts.hotReload);
        },
        inject: ['ADAPTERS_MODULE_OPTIONS', AdapterRegistry, 'EventEmitter2'],
      },
    ];

    return {
      module: AdaptersModule,
      global: options.isGlobal,
      imports: [
        HttpModule,
        EventEmitterModule.forRoot(),
        PlatformAdaptersModule,
      ],
      providers,
      exports: [AdapterRegistry, AdaptersService, HotReloadManager],
    };
  }
}

// ============================================================================
// 导出
// ============================================================================

export { AdaptersModuleOptions };

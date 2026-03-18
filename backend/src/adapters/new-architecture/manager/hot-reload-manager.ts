/**
 * 热更新管理器
 * 
 * 支持以下热更新模式：
 * 1. 文件系统监听（开发环境）
 * 2. 数据库配置变更（生产环境）
 * 3. Webhook 触发（CI/CD 集成）
 * 4. 手动触发
 */

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdapterRegistry } from './adapter-registry';
import {
  HotReloadConfig,
  AdapterConfig,
  AdapterManifest,
  AdapterEventType,
} from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 热更新事件
 */
export interface HotReloadEvent {
  type: 'filesystem' | 'database' | 'webhook' | 'manual';
  platform: string;
  timestamp: Date;
  oldConfig?: AdapterConfig;
  newConfig: AdapterConfig;
  changedBy?: string;
}

@Injectable()
export class HotReloadManager implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HotReloadManager.name);
  private config: HotReloadConfig;
  private fileWatcher?: fs.FSWatcher;
  private dbCheckInterval?: NodeJS.Timeout;
  private lastDbChecksum: string = '';

  constructor(
    private registry: AdapterRegistry,
    private eventEmitter: EventEmitter2,
    config?: Partial<HotReloadConfig>
  ) {
    this.config = {
      enabled: false,
      mode: 'manual',
      checkIntervalMs: 30000,
      ...config,
    };
  }

  async onModuleInit(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.log('Hot reload is disabled');
      return;
    }

    this.logger.log(`Hot reload enabled with mode: ${this.config.mode}`);

    switch (this.config.mode) {
      case 'filesystem':
        await this.startFilesystemWatcher();
        break;
      case 'database':
        await this.startDatabaseWatcher();
        break;
      case 'webhook':
        this.logger.log('Webhook mode: waiting for webhook calls');
        break;
      case 'manual':
        this.logger.log('Manual mode: hot reload only triggered manually');
        break;
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.stopFilesystemWatcher();
    this.stopDatabaseWatcher();
  }

  // ============================================================================
  // 文件系统监听模式
  // ============================================================================

  private async startFilesystemWatcher(): Promise<void> {
    if (!this.config.watchPath) {
      this.logger.error('Watch path not configured for filesystem mode');
      return;
    }

    if (!fs.existsSync(this.config.watchPath)) {
      this.logger.warn(`Watch path does not exist: ${this.config.watchPath}`);
      // 尝试创建目录
      fs.mkdirSync(this.config.watchPath, { recursive: true });
    }

    this.logger.log(`Starting filesystem watcher on: ${this.config.watchPath}`);

    this.fileWatcher = fs.watch(
      this.config.watchPath,
      { recursive: true },
      (eventType, filename) => {
        this.handleFileChange(eventType, filename);
      }
    );
  }

  private stopFilesystemWatcher(): void {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = undefined;
      this.logger.log('Filesystem watcher stopped');
    }
  }

  private async handleFileChange(eventType: string, filename: string | null): Promise<void> {
    if (!filename) return;

    // 只处理 .json 和 .js/.ts 文件
    if (!filename.endsWith('.json') && !filename.endsWith('.js') && !filename.endsWith('.ts')) {
      return;
    }

    this.logger.log(`File changed: ${filename} (${eventType})`);

    try {
      // 从文件名解析平台
      const platform = path.basename(filename, path.extname(filename));
      
      if (eventType === 'rename' && !fs.existsSync(path.join(this.config.watchPath!, filename))) {
        // 文件被删除
        await this.handleAdapterRemoved(platform);
      } else {
        // 文件新增或修改
        await this.handleFileUpdated(platform, path.join(this.config.watchPath!, filename));
      }
    } catch (error) {
      this.logger.error(`Error handling file change: ${error.message}`);
    }
  }

  private async handleFileUpdated(platform: string, filePath: string): Promise<void> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      let config: AdapterConfig;

      if (filePath.endsWith('.json')) {
        config = JSON.parse(content);
      } else {
        // 动态加载 JS/TS 模块
        delete require.cache[require.resolve(filePath)];
        const module = require(filePath);
        config = module.default || module.config || module;
      }

      await this.reloadAdapter(platform, config, 'filesystem');
    } catch (error) {
      this.logger.error(`Failed to load config from ${filePath}: ${error.message}`);
    }
  }

  private async handleAdapterRemoved(platform: string): Promise<void> {
    if (this.registry.hasAdapter(platform)) {
      this.logger.log(`Adapter ${platform} removed, disposing...`);
      await this.registry.disposeAdapter(platform);
    }
  }

  // ============================================================================
  // 数据库监听模式
  // ============================================================================

  private async startDatabaseWatcher(): Promise<void> {
    this.logger.log(`Starting database watcher (interval: ${this.config.checkIntervalMs}ms)`);
    
    // 初始检查
    await this.checkDatabaseChanges();

    // 定时检查
    this.dbCheckInterval = setInterval(
      () => this.checkDatabaseChanges(),
      this.config.checkIntervalMs
    );
  }

  private stopDatabaseWatcher(): void {
    if (this.dbCheckInterval) {
      clearInterval(this.dbCheckInterval);
      this.dbCheckInterval = undefined;
      this.logger.log('Database watcher stopped');
    }
  }

  private async checkDatabaseChanges(): Promise<void> {
    try {
      // 这里应该查询数据库获取配置
      // 实际实现中应该有一个 AdapterConfigEntity
      // 这里提供一个示例实现
      
      // const configs = await this.configRepository.find();
      // const currentChecksum = this.computeChecksum(configs);
      
      // if (currentChecksum !== this.lastDbChecksum) {
      //   this.logger.log('Database configuration changed, reloading adapters...');
      //   await this.reloadFromDatabase(configs);
      //   this.lastDbChecksum = currentChecksum;
      // }
    } catch (error) {
      this.logger.error(`Error checking database changes: ${error.message}`);
    }
  }

  async reloadFromDatabase(configs: AdapterConfig[]): Promise<void> {
    for (const config of configs) {
      const existing = this.registry.getAdapter(config.platform);
      
      if (!existing) {
        // 新增适配器
        await this.registry.createAdapter(config);
      } else {
        // 检查配置是否变更
        const hasChanged = this.hasConfigChanged(existing.config, config);
        if (hasChanged) {
          await this.reloadAdapter(config.platform, config, 'database');
        }
      }
    }

    // 检查是否有被删除的适配器
    const registeredPlatforms = this.registry.getRegisteredPlatforms();
    const configPlatforms = configs.map(c => c.platform);
    
    for (const platform of registeredPlatforms) {
      if (!configPlatforms.includes(platform)) {
        await this.registry.disposeAdapter(platform);
      }
    }
  }

  // ============================================================================
  // Webhook 处理
  // ============================================================================

  /**
   * 处理 Webhook 请求
   */
  async handleWebhook(payload: {
    platform: string;
    action: 'reload' | 'update' | 'remove';
    config?: AdapterConfig;
    secret?: string;
  }): Promise<{ success: boolean; message: string }> {
    // 验证密钥
    if (this.config.webhookSecret && payload.secret !== this.config.webhookSecret) {
      return { success: false, message: 'Invalid webhook secret' };
    }

    const { platform, action, config } = payload;

    try {
      switch (action) {
        case 'reload':
          if (!config) {
            // 重新加载现有配置
            const existing = this.registry.getAdapter(platform);
            if (!existing) {
              return { success: false, message: `Adapter ${platform} not found` };
            }
            await this.registry.reloadAdapter(platform);
          } else {
            await this.reloadAdapter(platform, config, 'webhook');
          }
          return { success: true, message: `Adapter ${platform} reloaded` };

        case 'update':
          if (!config) {
            return { success: false, message: 'Config required for update action' };
          }
          if (this.registry.hasAdapter(platform)) {
            await this.reloadAdapter(platform, config, 'webhook');
          } else {
            await this.registry.createAdapter(config);
          }
          return { success: true, message: `Adapter ${platform} updated` };

        case 'remove':
          if (this.registry.hasAdapter(platform)) {
            await this.registry.disposeAdapter(platform);
            return { success: true, message: `Adapter ${platform} removed` };
          }
          return { success: false, message: `Adapter ${platform} not found` };

        default:
          return { success: false, message: `Unknown action: ${action}` };
      }
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  // ============================================================================
  // 公共方法
  // ============================================================================

  /**
   * 手动重载适配器
   */
  async reloadAdapter(
    platform: string,
    newConfig?: AdapterConfig,
    source: 'filesystem' | 'database' | 'webhook' | 'manual' = 'manual'
  ): Promise<void> {
    this.logger.log(`Reloading adapter ${platform} (source: ${source})`);

    const existing = this.registry.getAdapter(platform);
    const oldConfig = existing?.config;

    if (!existing) {
      if (!newConfig) {
        throw new Error(`No existing adapter found for ${platform} and no config provided`);
      }
      await this.registry.createAdapter(newConfig);
    } else {
      await this.registry.reloadAdapter(platform, newConfig);
    }

    // 触发事件
    const event: HotReloadEvent = {
      type: source,
      platform,
      timestamp: new Date(),
      oldConfig,
      newConfig: newConfig || oldConfig!,
    };

    this.eventEmitter.emit('adapter:hot-reload', event);
    this.logger.log(`Adapter ${platform} reloaded successfully`);
  }

  /**
   * 批量重载所有适配器
   */
  async reloadAll(source: 'manual' | 'database' = 'manual'): Promise<void> {
    this.logger.log(`Reloading all adapters (source: ${source})`);
    
    const platforms = this.registry.getRegisteredPlatforms();
    
    for (const platform of platforms) {
      try {
        await this.registry.reloadAdapter(platform);
      } catch (error) {
        this.logger.error(`Failed to reload adapter ${platform}: ${error.message}`);
      }
    }
  }

  /**
   * 从清单文件加载适配器
   */
  async loadFromManifest(manifestPath: string): Promise<void> {
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Manifest file not found: ${manifestPath}`);
    }

    const content = fs.readFileSync(manifestPath, 'utf-8');
    const manifests: AdapterManifest[] = JSON.parse(content);

    for (const manifest of manifests) {
      try {
        const configPath = path.join(path.dirname(manifestPath), manifest.entryPoint);
        await this.handleFileUpdated(manifest.platform, configPath);
      } catch (error) {
        this.logger.error(`Failed to load adapter from manifest: ${manifest.platform}: ${error.message}`);
      }
    }
  }

  // ============================================================================
  // 工具方法
  // ============================================================================

  private hasConfigChanged(oldConfig: AdapterConfig, newConfig: AdapterConfig): boolean {
    // 简单深度比较
    return JSON.stringify(oldConfig) !== JSON.stringify(newConfig);
  }

  private computeChecksum(data: any): string {
    // 简单的 checksum 计算
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  /**
   * 更新热更新配置
   */
  updateConfig(config: Partial<HotReloadConfig>): void {
    const oldMode = this.config.mode;
    this.config = { ...this.config, ...config };

    // 如果模式改变，需要重新初始化
    if (config.mode && config.mode !== oldMode) {
      this.onModuleDestroy().then(() => this.onModuleInit());
    }
  }
}

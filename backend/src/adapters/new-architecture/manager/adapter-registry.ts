/**
 * 适配器注册表
 * 
 * 管理适配器的生命周期，支持热更新和动态加载
 */

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IAdapter, AdapterConstructor } from '../core/adapter.interface';
import { AbstractAdapter } from '../core/abstract-adapter';
import {
  AdapterConfig,
  AdapterStatus,
  AdapterEvent,
  AdapterEventType,
  PlatformType,
} from '../types';

/**
 * 注册表配置
 */
export interface RegistryConfig {
  autoInitialize: boolean;
  strictMode: boolean;  // 严格模式：配置无效时抛出错误
}

/**
 * 适配器注册信息
 */
interface AdapterRegistration {
  platform: string;
  constructor: AdapterConstructor;
  instance?: IAdapter;
  config: AdapterConfig;
  status: AdapterStatus;
  registeredAt: Date;
  lastUpdatedAt: Date;
}

@Injectable()
export class AdapterRegistry implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AdapterRegistry.name);
  private adapters = new Map<string, AdapterRegistration>();
  private constructors = new Map<string, AdapterConstructor>();
  private config: RegistryConfig;

  constructor(
    private eventEmitter: EventEmitter2,
    config?: Partial<RegistryConfig>
  ) {
    this.config = {
      autoInitialize: true,
      strictMode: false,
      ...config,
    };
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('Adapter Registry initialized');
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down Adapter Registry...');
    await this.disposeAll();
  }

  // ============================================================================
  // 注册/注销方法
  // ============================================================================

  /**
   * 注册适配器类型
   * @param platform 平台标识
   * @param constructor 适配器构造函数
   */
  registerType(platform: string, constructor: AdapterConstructor): void {
    if (this.constructors.has(platform)) {
      this.logger.warn(`Adapter type for ${platform} already registered, overwriting`);
    }
    this.constructors.set(platform, constructor);
    this.logger.log(`Registered adapter type: ${platform}`);
  }

  /**
   * 批量注册适配器类型
   */
  registerTypes(types: Record<string, AdapterConstructor>): void {
    for (const [platform, constructor] of Object.entries(types)) {
      this.registerType(platform, constructor);
    }
  }

  /**
   * 注销适配器类型
   */
  unregisterType(platform: string): boolean {
    const result = this.constructors.delete(platform);
    if (result) {
      this.logger.log(`Unregistered adapter type: ${platform}`);
    }
    return result;
  }

  /**
   * 创建并注册适配器实例
   */
  async createAdapter(config: AdapterConfig): Promise<IAdapter> {
    const { platform } = config;

    // 检查是否已注册类型
    const Constructor = this.constructors.get(platform);
    if (!Constructor) {
      throw new Error(`No adapter type registered for platform: ${platform}`);
    }

    // 如果已存在实例，先释放
    if (this.adapters.has(platform)) {
      this.logger.warn(`Adapter for ${platform} already exists, disposing old instance`);
      await this.disposeAdapter(platform);
    }

    // 创建实例
    const instance = new Constructor();
    
    // 注册
    const registration: AdapterRegistration = {
      platform,
      constructor: Constructor,
      instance,
      config,
      status: AdapterStatus.LOADED,
      registeredAt: new Date(),
      lastUpdatedAt: new Date(),
    };

    this.adapters.set(platform, registration);

    // 初始化
    if (this.config.autoInitialize) {
      try {
        await instance.initialize(config);
        registration.status = instance.status;
        this.emitEvent(AdapterEventType.LOADED, platform, { config });
        this.emitEvent(AdapterEventType.ACTIVATED, platform);
      } catch (error) {
        registration.status = AdapterStatus.ERROR;
        this.emitEvent(AdapterEventType.ERROR, platform, null, error as Error);
        
        if (this.config.strictMode) {
          throw error;
        }
        
        this.logger.error(`Failed to initialize adapter ${platform}: ${error.message}`);
      }
    }

    return instance;
  }

  /**
   * 注册已创建的适配器实例
   */
  registerInstance(instance: IAdapter, config?: Partial<AdapterConfig>): void {
    const platform = instance.platform;

    if (this.adapters.has(platform)) {
      this.logger.warn(`Adapter for ${platform} already exists`);
    }

    const registration: AdapterRegistration = {
      platform,
      constructor: instance.constructor as AdapterConstructor,
      instance,
      config: { ...instance.config, ...config } as AdapterConfig,
      status: instance.status,
      registeredAt: new Date(),
      lastUpdatedAt: new Date(),
    };

    this.adapters.set(platform, registration);
    this.logger.log(`Registered adapter instance: ${platform}`);
  }

  // ============================================================================
  // 查询方法
  // ============================================================================

  /**
   * 获取适配器实例
   */
  getAdapter(platform: string): IAdapter | undefined {
    const registration = this.adapters.get(platform);
    return registration?.instance;
  }

  /**
   * 获取所有适配器
   */
  getAllAdapters(): IAdapter[] {
    return Array.from(this.adapters.values())
      .map(r => r.instance)
      .filter((a): a is IAdapter => a !== undefined);
  }

  /**
   * 获取特定状态的适配器
   */
  getAdaptersByStatus(status: AdapterStatus): IAdapter[] {
    return Array.from(this.adapters.values())
      .filter(r => r.status === status)
      .map(r => r.instance)
      .filter((a): a is IAdapter => a !== undefined);
  }

  /**
   * 检查适配器是否存在
   */
  hasAdapter(platform: string): boolean {
    return this.adapters.has(platform);
  }

  /**
   * 检查适配器类型是否已注册
   */
  hasType(platform: string): boolean {
    return this.constructors.has(platform);
  }

  /**
   * 获取所有支持的平台
   */
  getSupportedPlatforms(): string[] {
    return Array.from(this.constructors.keys());
  }

  /**
   * 获取已注册的平台
   */
  getRegisteredPlatforms(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * 获取活跃的适配器
   */
  getActiveAdapters(): IAdapter[] {
    return this.getAdaptersByStatus(AdapterStatus.ACTIVE);
  }

  // ============================================================================
  // 生命周期管理
  // ============================================================================

  /**
   * 暂停适配器
   */
  async pauseAdapter(platform: string): Promise<void> {
    const adapter = this.getAdapter(platform);
    if (!adapter) {
      throw new Error(`Adapter not found: ${platform}`);
    }

    await adapter.pause();
    this.updateStatus(platform, AdapterStatus.PAUSED);
    this.emitEvent(AdapterEventType.DEACTIVATED, platform);
    this.logger.log(`Paused adapter: ${platform}`);
  }

  /**
   * 恢复适配器
   */
  async resumeAdapter(platform: string): Promise<void> {
    const adapter = this.getAdapter(platform);
    if (!adapter) {
      throw new Error(`Adapter not found: ${platform}`);
    }

    await adapter.resume();
    this.updateStatus(platform, AdapterStatus.ACTIVE);
    this.emitEvent(AdapterEventType.ACTIVATED, platform);
    this.logger.log(`Resumed adapter: ${platform}`);
  }

  /**
   * 禁用适配器
   */
  async disableAdapter(platform: string): Promise<void> {
    const adapter = this.getAdapter(platform);
    if (!adapter) {
      throw new Error(`Adapter not found: ${platform}`);
    }

    await adapter.disable();
    this.updateStatus(platform, AdapterStatus.DISABLED);
    this.emitEvent(AdapterEventType.DEACTIVATED, platform);
    this.logger.log(`Disabled adapter: ${platform}`);
  }

  /**
   * 启用适配器
   */
  async enableAdapter(platform: string): Promise<void> {
    const adapter = this.getAdapter(platform);
    if (!adapter) {
      throw new Error(`Adapter not found: ${platform}`);
    }

    await adapter.enable();
    this.updateStatus(platform, AdapterStatus.ACTIVE);
    this.emitEvent(AdapterEventType.ACTIVATED, platform);
    this.logger.log(`Enabled adapter: ${platform}`);
  }

  /**
   * 更新适配器配置
   */
  async updateAdapterConfig(platform: string, config: Partial<AdapterConfig>): Promise<void> {
    const adapter = this.getAdapter(platform);
    if (!adapter) {
      throw new Error(`Adapter not found: ${platform}`);
    }

    await adapter.updateConfig(config);
    
    const registration = this.adapters.get(platform);
    if (registration) {
      registration.config = { ...registration.config, ...config };
      registration.lastUpdatedAt = new Date();
    }

    this.emitEvent(AdapterEventType.CONFIG_UPDATED, platform, { config });
    this.logger.log(`Updated config for adapter: ${platform}`);
  }

  /**
   * 释放适配器
   */
  async disposeAdapter(platform: string): Promise<void> {
    const registration = this.adapters.get(platform);
    if (!registration) {
      return;
    }

    if (registration.instance) {
      try {
        await registration.instance.dispose();
        this.emitEvent(AdapterEventType.UNLOADED, platform);
      } catch (error) {
        this.logger.error(`Error disposing adapter ${platform}: ${error.message}`);
      }
    }

    this.adapters.delete(platform);
    this.logger.log(`Disposed adapter: ${platform}`);
  }

  /**
   * 释放所有适配器
   */
  async disposeAll(): Promise<void> {
    const platforms = Array.from(this.adapters.keys());
    for (const platform of platforms) {
      await this.disposeAdapter(platform);
    }
  }

  /**
   * 热重载适配器
   */
  async reloadAdapter(platform: string, newConfig?: AdapterConfig): Promise<IAdapter> {
    const registration = this.adapters.get(platform);
    if (!registration) {
      throw new Error(`Adapter not found: ${platform}`);
    }

    this.logger.log(`Hot reloading adapter: ${platform}`);

    // 保存旧配置
    const oldConfig = { ...registration.config };

    // 释放旧实例
    if (registration.instance) {
      await registration.instance.dispose();
    }

    // 创建新实例
    const Constructor = registration.constructor;
    const config = newConfig || oldConfig;
    
    const instance = new Constructor();
    registration.instance = instance;
    registration.config = config;
    registration.lastUpdatedAt = new Date();

    // 初始化
    await instance.initialize(config);
    registration.status = instance.status;

    this.emitEvent(AdapterEventType.LOADED, platform, { config, reloaded: true });
    this.logger.log(`Hot reload completed for adapter: ${platform}`);

    return instance;
  }

  // ============================================================================
  // 内部方法
  // ============================================================================

  private updateStatus(platform: string, status: AdapterStatus): void {
    const registration = this.adapters.get(platform);
    if (registration) {
      registration.status = status;
    }
  }

  private emitEvent(
    type: AdapterEventType,
    platform: string,
    data?: any,
    error?: Error
  ): void {
    const event: AdapterEvent = {
      type,
      platform,
      timestamp: new Date(),
      data,
      error,
    };

    this.eventEmitter.emit(type, event);
    this.eventEmitter.emit('adapter:*', event);
  }

  // ============================================================================
  // 统计方法
  // ============================================================================

  /**
   * 获取注册表统计信息
   */
  getStats(): {
    total: number;
    byStatus: Record<AdapterStatus, number>;
    registeredTypes: number;
  } {
    const byStatus: Record<AdapterStatus, number> = {
      [AdapterStatus.LOADED]: 0,
      [AdapterStatus.VALID]: 0,
      [AdapterStatus.ACTIVE]: 0,
      [AdapterStatus.PAUSED]: 0,
      [AdapterStatus.DISABLED]: 0,
      [AdapterStatus.ERROR]: 0,
      [AdapterStatus.UNLOADED]: 0,
    };

    for (const registration of this.adapters.values()) {
      byStatus[registration.status]++;
    }

    return {
      total: this.adapters.size,
      byStatus,
      registeredTypes: this.constructors.size,
    };
  }

  /**
   * 获取适配器健康状态
   */
  getHealth(): {
    healthy: boolean;
    adapters: Record<string, {
      status: AdapterStatus;
      healthy: boolean;
      lastError?: string;
    }>;
  } {
    const result: Record<string, any> = {};
    let allHealthy = true;

    for (const [platform, registration] of this.adapters) {
      const healthy = registration.status === AdapterStatus.ACTIVE;
      if (!healthy) allHealthy = false;

      result[platform] = {
        status: registration.status,
        healthy,
      };
    }

    return {
      healthy: allHealthy,
      adapters: result,
    };
  }
}

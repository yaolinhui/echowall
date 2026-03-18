import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import databaseConfig from './config/database.config';
import redisConfig from './config/redis.config';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { SourcesModule } from './sources/sources.module';
import { MentionsModule } from './mentions/mentions.module';
import { WidgetModule } from './widget/widget.module';
import { FetcherModule } from './fetcher/fetcher.module';
// import { SchedulerModule } from './scheduler/scheduler.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, redisConfig],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const dbType = configService.get('DB_TYPE') || 'postgres';
        
        // SQLite 配置（无需 Docker，适合本地开发）
        if (dbType === 'sqlite') {
          return {
            type: 'sqlite',
            database: configService.get('DB_DATABASE') || ':memory:',
            entities: [__dirname + '/**/*.entity{.ts,.js}'],
            synchronize: true,
            logging: configService.get('NODE_ENV') === 'development',
          };
        }
        
        // PostgreSQL 配置（生产环境）
        return {
          type: 'postgres',
          host: configService.get('database.host'),
          port: configService.get('database.port'),
          username: configService.get('database.username'),
          password: configService.get('database.password'),
          database: configService.get('database.database'),
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: configService.get('NODE_ENV') !== 'production',
          logging: configService.get('NODE_ENV') === 'development',
        };
      },
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisEnabled = configService.get('REDIS_ENABLED') !== 'false';
        
        if (!redisEnabled) {
          // 使用内存队列（无需 Redis，适合本地开发）
          return {
            redis: {
              host: 'localhost',
              port: 6379,
            },
          };
        }
        
        return {
          redis: {
            host: configService.get('redis.host'),
            port: configService.get('redis.port'),
          },
        };
      },
    }),
    UsersModule,
    ProjectsModule,
    SourcesModule,
    MentionsModule,
    WidgetModule,
    FetcherModule,
    // SchedulerModule,  // 临时禁用，等有精力再修复
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

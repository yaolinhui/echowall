import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TaskSchedulerService } from './services/task-scheduler.service';
import { MetricsService } from './services/metrics.service';
import { DlqProcessor } from './processors/dlq.processor';
import { FetchTaskData, AnalysisTaskData, NotificationTaskData } from './interfaces/task.interface';
import { QueueName } from './enums/task-type.enum';

/**
 * 任务调度控制器
 * 
 * 提供 REST API 用于：
 * - 任务管理（提交、取消、查询）
 * - 队列管理（暂停、恢复、清空）
 * - 监控指标查询
 * - 死信队列管理
 */
@ApiTags('Task Scheduler')
@Controller('scheduler')
export class SchedulerController {
  constructor(
    private taskScheduler: TaskSchedulerService,
    private metricsService: MetricsService,
    private dlqProcessor: DlqProcessor,
  ) {}

  // ==================== 任务提交 API ====================

  @Post('tasks/fetch')
  @ApiOperation({ summary: '提交抓取任务' })
  @ApiResponse({ status: 201, description: '任务已提交' })
  async scheduleFetch(@Body() data: FetchTaskData) {
    const job = await this.taskScheduler.scheduleFetch(data);
    return {
      success: true,
      jobId: job.id,
      queueName: 'fetcher',
    };
  }

  @Post('tasks/analysis')
  @ApiOperation({ summary: '提交分析任务' })
  async scheduleAnalysis(@Body() data: AnalysisTaskData) {
    const job = await this.taskScheduler.scheduleAnalysis(data);
    return {
      success: true,
      jobId: job.id,
      queueName: 'analysis',
    };
  }

  @Post('tasks/notification')
  @ApiOperation({ summary: '提交通知任务' })
  async scheduleNotification(@Body() data: NotificationTaskData) {
    const job = await this.taskScheduler.scheduleNotification(data);
    return {
      success: true,
      jobId: job.id,
      queueName: 'notification',
    };
  }

  // ==================== 任务查询 API ====================

  @Get('queues/status')
  @ApiOperation({ summary: '获取所有队列状态' })
  async getAllQueueStatus() {
    return this.taskScheduler.getQueueStatus();
  }

  @Get('queues/:name/status')
  @ApiOperation({ summary: '获取指定队列状态' })
  async getQueueStatus(@Param('name') name: string) {
    return this.taskScheduler.getQueueStatus(name);
  }

  @Get('queues/:name/jobs/waiting')
  @ApiOperation({ summary: '获取等待中的任务' })
  async getWaitingJobs(
    @Param('name') name: string,
    @Query('start') start = 0,
    @Query('end') end = 100,
  ) {
    const jobs = await this.taskScheduler.getWaitingJobs(name, +start, +end);
    return {
      total: jobs.length,
      jobs: jobs.map(job => ({
        id: job.id,
        name: job.name,
        data: job.data,
        opts: job.opts,
        timestamp: job.timestamp,
      })),
    };
  }

  @Get('queues/:name/jobs/active')
  @ApiOperation({ summary: '获取活跃的任务' })
  async getActiveJobs(
    @Param('name') name: string,
    @Query('start') start = 0,
    @Query('end') end = 100,
  ) {
    const jobs = await this.taskScheduler.getActiveJobs(name, +start, +end);
    return {
      total: jobs.length,
      jobs: jobs.map(job => ({
        id: job.id,
        name: job.name,
        data: job.data,
        processedOn: job.processedOn,
        progress: job.progress,
      })),
    };
  }

  @Get('queues/:name/jobs/failed')
  @ApiOperation({ summary: '获取失败的任务' })
  async getFailedJobs(
    @Param('name') name: string,
    @Query('start') start = 0,
    @Query('end') end = 100,
  ) {
    const jobs = await this.taskScheduler.getFailedJobs(name, +start, +end);
    return {
      total: jobs.length,
      jobs: jobs.map(job => ({
        id: job.id,
        name: job.name,
        data: job.data,
        failedReason: job.failedReason,
        attemptsMade: job.attemptsMade,
      })),
    };
  }

  @Get('queues/:name/jobs/:id')
  @ApiOperation({ summary: '获取任务详情' })
  async getJob(
    @Param('name') name: string,
    @Param('id') id: string,
  ) {
    const job = await this.taskScheduler.getJob(name, id);
    if (!job) {
      return { exists: false };
    }
    
    return {
      exists: true,
      id: job.id,
      name: job.name,
      data: job.data,
      opts: job.opts,
      progress: job.progress,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      timestamp: job.timestamp,
    };
  }

  // ==================== 队列管理 API ====================

  @Post('queues/:name/pause')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '暂停队列' })
  async pauseQueue(@Param('name') name: string) {
    await this.taskScheduler.pauseQueue(name);
    return { success: true, message: `Queue ${name} paused` };
  }

  @Post('queues/:name/resume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '恢复队列' })
  async resumeQueue(@Param('name') name: string) {
    await this.taskScheduler.resumeQueue(name);
    return { success: true, message: `Queue ${name} resumed` };
  }

  @Post('queues/:name/clean')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '清空队列' })
  async cleanQueue(
    @Param('name') name: string,
    @Query('status') status: 'completed' | 'failed' | 'wait' = 'completed',
  ) {
    await this.taskScheduler.cleanQueue(name, status);
    return { success: true, message: `Queue ${name} cleaned (${status})` };
  }

  @Post('queues/:name/jobs/:id/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '重试失败的任务' })
  async retryJob(
    @Param('name') name: string,
    @Param('id') id: string,
  ) {
    await this.taskScheduler.retryJob(name, id);
    return { success: true, message: `Job ${id} scheduled for retry` };
  }

  @Post('queues/:name/jobs/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '取消任务' })
  async cancelJob(
    @Param('name') name: string,
    @Param('id') id: string,
  ) {
    const cancelled = await this.taskScheduler.cancelTask(name, id);
    return {
      success: cancelled,
      message: cancelled ? `Job ${id} cancelled` : `Job ${id} not found or already processed`,
    };
  }

  // ==================== 监控指标 API ====================

  @Get('metrics')
  @ApiOperation({ summary: '获取所有监控指标' })
  async getAllMetrics() {
    return {
      metrics: this.metricsService.getAllMetrics(),
    };
  }

  @Get('metrics/prometheus')
  @ApiOperation({ summary: '获取 Prometheus 格式的指标' })
  async getPrometheusMetrics() {
    return this.metricsService.getPrometheusMetrics();
  }

  @Get('metrics/queue-depth')
  @ApiOperation({ summary: '获取队列深度' })
  async getQueueDepth() {
    const statuses = await this.metricsService.getQueueStatus() as any[];
    const totalDepth = statuses.reduce((sum, s) => sum + s.waiting, 0);
    
    return {
      total: totalDepth,
      byQueue: statuses.map(s => ({
        name: s.name,
        waiting: s.waiting,
        active: s.active,
      })),
    };
  }

  @Get('metrics/error-rate')
  @ApiOperation({ summary: '获取错误率' })
  async getErrorRate(@Query('range') range: '1h' | '24h' = '1h') {
    const rate = await this.metricsService.getErrorRate(range);
    return {
      range,
      errorRate: rate,
    };
  }

  @Get('metrics/task-stats/:taskType')
  @ApiOperation({ summary: '获取任务执行统计' })
  async getTaskStats(
    @Param('taskType') taskType: string,
    @Query('range') range: '1h' | '24h' | '7d' | '30d' = '24h',
  ) {
    return this.metricsService.getTaskStats(taskType, range);
  }

  // ==================== 死信队列 API ====================

  @Get('dead-letters')
  @ApiOperation({ summary: '获取死信列表' })
  async getDeadLetters(
    @Query('status') status?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.dlqProcessor.getDeadLetters({
      status,
      page: +page,
      limit: +limit,
    });
  }

  @Post('dead-letters/:id/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '手动重试死信' })
  async retryDeadLetter(@Param('id') id: string) {
    const success = await this.dlqProcessor.retryDeadLetter(id);
    return {
      success,
      message: success ? 'Dead letter scheduled for retry' : 'Failed to retry dead letter',
    };
  }

  @Post('dead-letters/:id/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '归档死信' })
  async archiveDeadLetter(
    @Param('id') id: string,
    @Body('reason') reason: string,
  ) {
    const success = await this.dlqProcessor.archiveDeadLetter(id, reason);
    return {
      success,
      message: success ? 'Dead letter archived' : 'Failed to archive dead letter',
    };
  }

  @Get('dead-letters/statistics')
  @ApiOperation({ summary: '获取死信统计' })
  async getDeadLetterStats(@Query('range') range: '1h' | '24h' | '7d' = '24h') {
    return this.dlqProcessor.getErrorStatistics(range);
  }
}

import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AnalysisTaskData, TaskResult, TaskExecutionStats } from '../interfaces/task.interface';
import { PROCESSOR_NAMES, TASK_EVENTS } from '../constants/queue.constants';
import { TaskType } from '../enums/task-type.enum';
import { MetricsService } from '../services/metrics.service';

/**
 * 分析任务处理器
 * 
 * 处理：
 * - 情感分析
 * - 趋势分析
 * - 报告生成
 */
@Processor('analysis')
export class AnalysisProcessor {
  private readonly logger = new Logger(AnalysisProcessor.name);

  constructor(
    private eventEmitter: EventEmitter2,
    private metricsService: MetricsService,
  ) {}

  /**
   * 处理情感分析任务
   */
  @Process(PROCESSOR_NAMES.ANALYZE_SENTIMENT)
  async handleSentimentAnalysis(job: Job<AnalysisTaskData>): Promise<TaskResult> {
    const startTime = Date.now();
    const { data } = job;

    this.logger.log(`[${job.id}] Starting sentiment analysis for project ${data.projectId}`);

    try {
      // 模拟情感分析
      await job.progress(10);
      
      // 获取待分析的提及
      const mentions = data.mentionIds || await this.getMentionsToAnalyze(data);
      
      await job.progress(30);
      
      // 分批处理
      const batchSize = 50;
      const results = [];
      
      for (let i = 0; i < mentions.length; i += batchSize) {
        const batch = mentions.slice(i, i + batchSize);
        const batchResults = await this.analyzeSentimentBatch(batch);
        results.push(...batchResults);
        
        const progress = 30 + Math.floor((i / mentions.length) * 60);
        await job.progress(progress);
      }

      await job.progress(100);

      const stats = this.calculateStats(job, startTime);
      await this.metricsService.recordTaskMetrics(TaskType.SENTIMENT_ANALYSIS, stats, true);

      this.logger.log(`[${job.id}] Sentiment analysis completed: ${results.length} mentions processed`);

      return {
        success: true,
        data: {
          processed: results.length,
          results: this.aggregateSentiment(results),
        },
        stats,
      };
    } catch (error) {
      const stats = this.calculateStats(job, startTime);
      await this.metricsService.recordTaskMetrics(TaskType.SENTIMENT_ANALYSIS, stats, false);
      throw error;
    }
  }

  /**
   * 处理趋势分析任务
   */
  @Process('analyze-trend')
  async handleTrendAnalysis(job: Job<AnalysisTaskData>): Promise<TaskResult> {
    const startTime = Date.now();
    const { data } = job;

    this.logger.log(`[${job.id}] Starting trend analysis for project ${data.projectId}`);

    try {
      await job.progress(20);

      // 模拟趋势分析
      const trends = await this.analyzeTrends(data);

      await job.progress(100);

      const stats = this.calculateStats(job, startTime);
      await this.metricsService.recordTaskMetrics(TaskType.TREND_ANALYSIS, stats, true);

      return {
        success: true,
        data: trends,
        stats,
      };
    } catch (error) {
      const stats = this.calculateStats(job, startTime);
      await this.metricsService.recordTaskMetrics(TaskType.TREND_ANALYSIS, stats, false);
      throw error;
    }
  }

  /**
   * 处理报告生成任务
   */
  @Process(PROCESSOR_NAMES.GENERATE_REPORT)
  async handleGenerateReport(job: Job<AnalysisTaskData>): Promise<TaskResult> {
    const startTime = Date.now();
    const { data } = job;

    this.logger.log(`[${job.id}] Starting report generation for project ${data.projectId}`);

    try {
      await job.progress(10);

      // 收集数据
      const reportData = await this.collectReportData(data);
      await job.progress(40);

      // 生成报告
      const report = await this.generateReport(reportData);
      await job.progress(80);

      // 保存报告
      await this.saveReport(report);
      await job.progress(100);

      const stats = this.calculateStats(job, startTime);
      await this.metricsService.recordTaskMetrics(TaskType.GENERATE_REPORT, stats, true);

      // 发送通知
      this.eventEmitter.emit(TASK_EVENTS.TASK_COMPLETED, {
        jobId: job.id,
        taskType: TaskType.GENERATE_REPORT,
        result: { reportId: report.id },
      });

      return {
        success: true,
        data: { reportId: report.id },
        stats,
      };
    } catch (error) {
      const stats = this.calculateStats(job, startTime);
      await this.metricsService.recordTaskMetrics(TaskType.GENERATE_REPORT, stats, false);
      throw error;
    }
  }

  @OnQueueFailed()
  handleFailed(job: Job, error: Error): void {
    this.logger.error(`[${job.id}] Analysis job failed:`, error.message);
  }

  // ==================== 私有方法 ====================

  private async getMentionsToAnalyze(data: AnalysisTaskData): Promise<string[]> {
    // 从数据库获取待分析的提及 ID
    return [];
  }

  private async analyzeSentimentBatch(mentionIds: string[]): Promise<Array<{
    mentionId: string;
    sentiment: string;
    score: number;
  }>> {
    // 模拟情感分析
    await this.sleep(500);
    
    return mentionIds.map(id => ({
      mentionId: id,
      sentiment: ['positive', 'neutral', 'negative'][Math.floor(Math.random() * 3)],
      score: Math.random(),
    }));
  }

  private aggregateSentiment(results: Array<{ sentiment: string; score: number }>): {
    positive: number;
    neutral: number;
    negative: number;
    averageScore: number;
  } {
    const counts = { positive: 0, neutral: 0, negative: 0 };
    let totalScore = 0;

    for (const result of results) {
      counts[result.sentiment as keyof typeof counts]++;
      totalScore += result.score;
    }

    return {
      ...counts,
      averageScore: results.length > 0 ? totalScore / results.length : 0.5,
    };
  }

  private async analyzeTrends(data: AnalysisTaskData): Promise<any> {
    await this.sleep(1000);
    
    return {
      trend: 'upward',
      changeRate: Math.random() * 0.2,
      volumeChange: Math.floor(Math.random() * 100),
    };
  }

  private async collectReportData(data: AnalysisTaskData): Promise<any> {
    await this.sleep(500);
    return { projectId: data.projectId, dateRange: data.dateRange };
  }

  private async generateReport(data: any): Promise<{ id: string; content: string }> {
    await this.sleep(1000);
    return {
      id: `report-${Date.now()}`,
      content: 'Generated report content',
    };
  }

  private async saveReport(report: { id: string; content: string }): Promise<void> {
    // 保存到数据库
    await this.sleep(200);
  }

  private calculateStats(job: Job, startTime: number): TaskExecutionStats {
    const now = Date.now();
    return {
      queueTime: startTime - (job.processedOn || startTime),
      processingTime: now - startTime,
      totalTime: now - (job.processedOn || startTime),
      retryCount: job.attemptsMade,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Job } from 'bull';
import { MetricsService } from '../services/metrics.service';

/**
 * 任务指标拦截器
 * 
 * 自动收集任务执行指标：
 * - 执行时间
 * - 内存使用
 * - 成功率
 * - 错误率
 */
@Injectable()
export class TaskMetricsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TaskMetricsInterceptor.name);

  constructor(private metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = Date.now();
    const handlerName = context.getHandler().name;
    const className = context.getClass().name;
    
    // 获取 Job 信息
    const job = context.switchToRpc().getData() as Job;
    const taskType = job?.data?.taskType || handlerName;

    // 记录内存使用
    const memBefore = process.memoryUsage();

    return next.handle().pipe(
      tap(async (result) => {
        const duration = Date.now() - startTime;
        const memAfter = process.memoryUsage();
        const memDiff = memAfter.heapUsed - memBefore.heapUsed;

        // 记录指标
        await this.metricsService.recordBusinessMetrics(
          'task_execution_duration',
          duration,
          { taskType, handler: handlerName, class: className }
        );

        await this.metricsService.recordBusinessMetrics(
          'task_memory_usage',
          memDiff,
          { taskType }
        );

        await this.metricsService.recordBusinessMetrics(
          'task_success_count',
          1,
          { taskType }
        );

        this.logger.debug(
          `${className}.${handlerName} completed in ${duration}ms (mem: ${Math.round(memDiff / 1024)}KB)`
        );
      }),
      catchError(async (error) => {
        const duration = Date.now() - startTime;

        // 记录失败指标
        await this.metricsService.recordBusinessMetrics(
          'task_execution_duration',
          duration,
          { taskType, handler: handlerName, class: className }
        );

        await this.metricsService.recordBusinessMetrics(
          'task_failure_count',
          1,
          { 
            taskType, 
            errorType: error.constructor.name,
            errorMessage: error.message,
          }
        );

        this.logger.error(
          `${className}.${handlerName} failed after ${duration}ms: ${error.message}`
        );

        return throwError(() => error);
      }),
    );
  }
}

/**
 * 错误处理拦截器
 * 
 * 统一处理任务错误
 */
@Injectable()
export class TaskErrorInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TaskErrorInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((error) => {
        const job = context.switchToRpc().getData() as Job;
        
        // 增强错误信息
        const enhancedError = this.enhanceError(error, job);
        
        this.logger.error(
          `Job ${job?.id} failed: ${enhancedError.message}`,
          enhancedError.stack
        );

        return throwError(() => enhancedError);
      }),
    );
  }

  private enhanceError(error: Error, job?: Job): Error {
    if (!job) return error;

    // 添加上下文信息
    (error as any).jobId = job.id;
    (error as any).taskType = job.data?.taskType;
    (error as any).attemptsMade = job.attemptsMade;
    
    return error;
  }
}

/**
 * 日志拦截器
 * 
 * 自动记录任务执行日志
 */
@Injectable()
export class TaskLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TaskLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = Date.now();
    const handlerName = context.getHandler().name;
    const job = context.switchToRpc().getData() as Job;
    
    this.logger.log(`[${job?.id}] Starting ${handlerName}`);

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        this.logger.log(`[${job?.id}] ${handlerName} completed in ${duration}ms`);
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        this.logger.error(
          `[${job?.id}] ${handlerName} failed after ${duration}ms: ${error.message}`
        );
        return throwError(() => error);
      }),
    );
  }
}

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Performance interceptor that logs slow API requests.
 * Helps identify endpoints that need optimization.
 * **Validates: Requirements 7.1**
 */
@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Performance');
  private readonly slowThresholdMs: number;

  constructor(slowThresholdMs = 500) {
    this.slowThresholdMs = slowThresholdMs;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const responseTime = Date.now() - startTime;
        
        // Log all requests with timing
        if (responseTime > this.slowThresholdMs) {
          this.logger.warn(
            `SLOW REQUEST: ${method} ${url} - ${responseTime}ms (threshold: ${this.slowThresholdMs}ms)`,
          );
        } else {
          this.logger.debug(`${method} ${url} - ${responseTime}ms`);
        }
      }),
    );
  }
}

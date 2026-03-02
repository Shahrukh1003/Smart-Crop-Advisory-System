import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

// In-memory store for rate limiting (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Rate limit configuration
export const DEFAULT_LIMIT = 100; // requests per window
export const DEFAULT_WINDOW = 60 * 1000; // 1 minute in milliseconds

// Rate limit response headers
export const RATE_LIMIT_HEADERS = {
  LIMIT: 'X-RateLimit-Limit',
  REMAINING: 'X-RateLimit-Remaining',
  RESET: 'X-RateLimit-Reset',
  RETRY_AFTER: 'Retry-After',
};

// Decorator to set custom rate limits
export const RateLimit = (limit: number, windowMs: number = DEFAULT_WINDOW) => {
  return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    Reflect.defineMetadata('rateLimit', { limit, windowMs }, descriptor?.value || target);
  };
};

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

/**
 * Get rate limit info for a given key
 */
export function getRateLimitInfo(key: string, limit: number = DEFAULT_LIMIT, windowMs: number = DEFAULT_WINDOW): RateLimitInfo {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    return {
      limit,
      remaining: limit,
      resetTime: now + windowMs,
    };
  }

  const remaining = Math.max(0, limit - record.count);
  const retryAfter = remaining === 0 ? Math.ceil((record.resetTime - now) / 1000) : undefined;

  return {
    limit,
    remaining,
    resetTime: record.resetTime,
    retryAfter,
  };
}

/**
 * Set rate limit headers on response
 */
export function setRateLimitHeaders(response: any, info: RateLimitInfo): void {
  response.set(RATE_LIMIT_HEADERS.LIMIT, info.limit.toString());
  response.set(RATE_LIMIT_HEADERS.REMAINING, info.remaining.toString());
  response.set(RATE_LIMIT_HEADERS.RESET, Math.ceil(info.resetTime / 1000).toString());
  
  if (info.retryAfter !== undefined) {
    response.set(RATE_LIMIT_HEADERS.RETRY_AFTER, info.retryAfter.toString());
  }
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const handler = context.getHandler();

    // Get rate limit config from decorator or use defaults
    const rateLimitConfig = this.reflector.get<{ limit: number; windowMs: number }>(
      'rateLimit',
      handler
    ) || { limit: DEFAULT_LIMIT, windowMs: DEFAULT_WINDOW };

    // Create unique key based on user ID or IP
    const userId = request.user?.userId;
    const ip = request.ip || request.connection?.remoteAddress;
    const key = userId ? `user:${userId}` : `ip:${ip}`;

    const now = Date.now();
    const record = rateLimitStore.get(key);

    if (!record || now > record.resetTime) {
      // First request or window expired - reset counter
      const newRecord = {
        count: 1,
        resetTime: now + rateLimitConfig.windowMs,
      };
      rateLimitStore.set(key, newRecord);
      
      // Set rate limit headers
      const info: RateLimitInfo = {
        limit: rateLimitConfig.limit,
        remaining: rateLimitConfig.limit - 1,
        resetTime: newRecord.resetTime,
      };
      setRateLimitHeaders(response, info);
      
      return true;
    }

    if (record.count >= rateLimitConfig.limit) {
      // Rate limit exceeded
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      
      // Set rate limit headers including Retry-After
      const info: RateLimitInfo = {
        limit: rateLimitConfig.limit,
        remaining: 0,
        resetTime: record.resetTime,
        retryAfter,
      };
      setRateLimitHeaders(response, info);
      
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests. Please try again later.',
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    // Increment counter
    record.count++;
    rateLimitStore.set(key, record);
    
    // Set rate limit headers
    const info: RateLimitInfo = {
      limit: rateLimitConfig.limit,
      remaining: rateLimitConfig.limit - record.count,
      resetTime: record.resetTime,
    };
    setRateLimitHeaders(response, info);

    return true;
  }
}

// Cleanup old entries periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Rate limit middleware for Express (alternative approach)
export const rateLimitMiddleware = (
  limit: number = DEFAULT_LIMIT,
  windowMs: number = DEFAULT_WINDOW
) => {
  return (req: any, res: any, next: any) => {
    const userId = req.user?.userId;
    const ip = req.ip || req.connection?.remoteAddress;
    const key = userId ? `user:${userId}` : `ip:${ip}`;

    const now = Date.now();
    const record = rateLimitStore.get(key);

    if (!record || now > record.resetTime) {
      const newRecord = {
        count: 1,
        resetTime: now + windowMs,
      };
      rateLimitStore.set(key, newRecord);
      
      // Set rate limit headers
      res.set(RATE_LIMIT_HEADERS.LIMIT, limit.toString());
      res.set(RATE_LIMIT_HEADERS.REMAINING, (limit - 1).toString());
      res.set(RATE_LIMIT_HEADERS.RESET, Math.ceil(newRecord.resetTime / 1000).toString());
      
      return next();
    }

    if (record.count >= limit) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      
      // Set all rate limit headers including Retry-After
      res.set(RATE_LIMIT_HEADERS.LIMIT, limit.toString());
      res.set(RATE_LIMIT_HEADERS.REMAINING, '0');
      res.set(RATE_LIMIT_HEADERS.RESET, Math.ceil(record.resetTime / 1000).toString());
      res.set(RATE_LIMIT_HEADERS.RETRY_AFTER, retryAfter.toString());
      
      return res.status(429).json({
        statusCode: 429,
        message: 'Too many requests. Please try again later.',
        retryAfter,
      });
    }

    record.count++;
    rateLimitStore.set(key, record);
    
    // Set rate limit headers
    res.set(RATE_LIMIT_HEADERS.LIMIT, limit.toString());
    res.set(RATE_LIMIT_HEADERS.REMAINING, (limit - record.count).toString());
    res.set(RATE_LIMIT_HEADERS.RESET, Math.ceil(record.resetTime / 1000).toString());
    
    next();
  };
};

/**
 * Clear rate limit store (useful for testing)
 */
export function clearRateLimitStore(): void {
  rateLimitStore.clear();
}

/**
 * Get current rate limit store size (useful for testing)
 */
export function getRateLimitStoreSize(): number {
  return rateLimitStore.size;
}

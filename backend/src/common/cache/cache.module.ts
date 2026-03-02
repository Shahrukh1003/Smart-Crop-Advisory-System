import { Module, Global, DynamicModule, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const CACHE_REDIS_CLIENT = 'CACHE_REDIS_CLIENT';

export interface RedisClientInterface {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { EX?: number }): Promise<void>;
  del(key: string): Promise<void>;
  keys?(pattern: string): Promise<string[]>;
  ttl?(key: string): Promise<number>;
  exists?(key: string): Promise<number>;
}

@Global()
@Module({})
export class CacheModule {
  private static readonly logger = new Logger('CacheModule');

  static forRoot(): DynamicModule {
    return {
      module: CacheModule,
      imports: [ConfigModule],
      providers: [
        {
          provide: CACHE_REDIS_CLIENT,
          useFactory: async (configService: ConfigService) => {
            const host = configService.get<string>('REDIS_HOST', 'localhost');
            const port = configService.get<number>('REDIS_PORT', 6379);
            const password = configService.get<string>('REDIS_PASSWORD', '');

            // If no Redis host is configured, return null (will use in-memory fallback)
            if (!host || host === '') {
              this.logger.warn('Redis not configured, using in-memory cache fallback');
              return null;
            }

            try {
              const redis = new Redis({
                host,
                port,
                password: password || undefined,
                retryStrategy: (times) => {
                  if (times > 3) {
                    this.logger.warn('Redis connection failed after 3 retries, using in-memory fallback');
                    return null; // Stop retrying
                  }
                  return Math.min(times * 100, 3000);
                },
                maxRetriesPerRequest: 3,
                enableReadyCheck: true,
                lazyConnect: true,
              });

              // Test connection
              await redis.connect();
              await redis.ping();
              
              this.logger.log(`Redis connected successfully at ${host}:${port}`);
              
              return {
                get: async (key: string) => redis.get(key),
                set: async (key: string, value: string, options?: { EX?: number }) => {
                  if (options?.EX) {
                    await redis.setex(key, options.EX, value);
                  } else {
                    await redis.set(key, value);
                  }
                },
                del: async (key: string) => {
                  await redis.del(key);
                },
                keys: async (pattern: string) => redis.keys(pattern),
                ttl: async (key: string) => redis.ttl(key),
                exists: async (key: string) => redis.exists(key),
              };
            } catch (error) {
              this.logger.warn(`Redis connection failed: ${error.message}, using in-memory fallback`);
              return null;
            }
          },
          inject: [ConfigService],
        },
        {
          provide: 'CacheService',
          useFactory: (configService: ConfigService, redisClient: RedisClientInterface | null) => {
            // Import dynamically to avoid circular dependency
            const { CacheService } = require('./cache.service');
            return new CacheService(configService, redisClient);
          },
          inject: [ConfigService, CACHE_REDIS_CLIENT],
        },
      ],
      exports: [CACHE_REDIS_CLIENT, 'CacheService'],
    };
  }
}

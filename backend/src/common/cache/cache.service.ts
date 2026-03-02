import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_REDIS_CLIENT, RedisClientInterface } from './cache.module';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  version?: string;
}

export interface CacheConfig {
  defaultTTL: number; // Default TTL in seconds
  prefix: string;
}

export type CachePrefix = 'weather' | 'market' | 'recommendations' | 'session' | 'user' | 'general';

/**
 * Generic caching service that supports both Redis and in-memory storage.
 * Provides a unified interface for caching frequently accessed data.
 * **Validates: Requirements 7.3**
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly useRedis: boolean;
  private readonly defaultTTL: number;
  
  // In-memory cache (fallback when Redis is not available)
  private memoryCache = new Map<string, CacheEntry<any>>();
  
  // Cache prefixes for different data types
  private readonly prefixes: Record<CachePrefix, string> = {
    weather: 'weather:',
    market: 'market:',
    recommendations: 'rec:',
    session: 'session:',
    user: 'user:',
    general: 'cache:',
  };

  constructor(
    private readonly configService: ConfigService,
    @Optional() @Inject(CACHE_REDIS_CLIENT) private readonly redisClient?: RedisClientInterface | null,
  ) {
    this.useRedis = !!redisClient;
    this.defaultTTL = this.configService.get<number>('CACHE_DEFAULT_TTL', 3600);
    this.logger.log(`Cache service initialized with ${this.useRedis ? 'Redis' : 'in-memory'} storage`);
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string, prefix: CachePrefix = 'general'): Promise<T | null> {
    const fullKey = `${this.prefixes[prefix]}${key}`;
    
    if (this.useRedis && this.redisClient) {
      try {
        const cached = await this.redisClient.get(fullKey);
        if (cached) {
          const entry = JSON.parse(cached) as CacheEntry<T>;
          this.logger.debug(`Redis cache hit for ${fullKey}`);
          return entry.data;
        }
        return null;
      } catch (error) {
        this.logger.warn(`Redis get error for ${fullKey}: ${error.message}`);
      }
    }
    
    // In-memory fallback
    const entry = this.memoryCache.get(fullKey);
    if (!entry) {
      return null;
    }
    
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl * 1000) {
      this.logger.debug(`In-memory cache expired for ${fullKey}`);
      this.memoryCache.delete(fullKey);
      return null;
    }
    
    this.logger.debug(`In-memory cache hit for ${fullKey}`);
    return entry.data;
  }

  /**
   * Set a value in cache with optional TTL
   */
  async set<T>(
    key: string,
    data: T,
    options?: { ttl?: number; prefix?: CachePrefix; version?: string },
  ): Promise<void> {
    const prefix: CachePrefix = options?.prefix || 'general';
    const ttl = options?.ttl || this.defaultTTL;
    const fullKey = `${this.prefixes[prefix]}${key}`;
    
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      version: options?.version,
    };
    
    if (this.useRedis && this.redisClient) {
      try {
        await this.redisClient.set(fullKey, JSON.stringify(entry), { EX: ttl });
        this.logger.debug(`Cached in Redis: ${fullKey}, TTL: ${ttl}s`);
        return;
      } catch (error) {
        this.logger.warn(`Redis set error for ${fullKey}: ${error.message}`);
      }
    }
    
    // In-memory fallback
    this.memoryCache.set(fullKey, entry);
    this.logger.debug(`Cached in-memory: ${fullKey}, TTL: ${ttl}s`);
  }

  /**
   * Delete a value from cache
   */
  async delete(key: string, prefix: CachePrefix = 'general'): Promise<void> {
    const fullKey = `${this.prefixes[prefix]}${key}`;
    
    if (this.useRedis && this.redisClient) {
      try {
        await this.redisClient.del(fullKey);
        this.logger.debug(`Deleted from Redis: ${fullKey}`);
        return;
      } catch (error) {
        this.logger.warn(`Redis delete error for ${fullKey}: ${error.message}`);
      }
    }
    
    // In-memory fallback
    this.memoryCache.delete(fullKey);
    this.logger.debug(`Deleted from in-memory: ${fullKey}`);
  }

  /**
   * Get or set a value with a factory function
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: { ttl?: number; prefix?: CachePrefix; version?: string },
  ): Promise<T> {
    const prefix: CachePrefix = options?.prefix || 'general';
    const cached = await this.get<T>(key, prefix);
    
    if (cached !== null) {
      return cached;
    }
    
    const data = await factory();
    await this.set(key, data, options);
    return data;
  }

  /**
   * Invalidate all cache entries with a specific prefix pattern
   */
  async invalidatePattern(pattern: string, prefix: CachePrefix = 'general'): Promise<number> {
    const fullPattern = `${this.prefixes[prefix]}${pattern}`;
    let count = 0;
    
    if (this.useRedis && this.redisClient) {
      try {
        const client = this.redisClient as any;
        if (client.keys) {
          const keys = await client.keys(`${fullPattern}*`);
          for (const key of keys) {
            await this.redisClient.del(key);
            count++;
          }
          this.logger.debug(`Invalidated ${count} Redis keys matching ${fullPattern}*`);
          return count;
        }
      } catch (error) {
        this.logger.warn(`Redis pattern invalidation error: ${error.message}`);
      }
    }
    
    // In-memory fallback
    for (const key of this.memoryCache.keys()) {
      if (key.startsWith(fullPattern)) {
        this.memoryCache.delete(key);
        count++;
      }
    }
    this.logger.debug(`Invalidated ${count} in-memory keys matching ${fullPattern}*`);
    return count;
  }

  /**
   * Check if Redis is available
   */
  isRedisAvailable(): boolean {
    return this.useRedis;
  }

  /**
   * Get cache statistics
   */
  getStats(): { type: string; size: number } {
    return {
      type: this.useRedis ? 'redis' : 'in-memory',
      size: this.memoryCache.size,
    };
  }

  /**
   * Clear all in-memory cache (useful for testing)
   */
  clearMemoryCache(): void {
    this.memoryCache.clear();
    this.logger.debug('In-memory cache cleared');
  }
}

import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_REDIS_CLIENT, RedisClientInterface } from '../common/cache/cache.module';

export const REDIS_CLIENT = 'REDIS_CLIENT'; // Keep for backward compatibility

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  location: { latitude: number; longitude: number };
}

export interface WeatherCacheConfig {
  currentWeatherTTL: number; // 1 hour in ms
  forecastTTL: number; // 6 hours in ms
  locationThreshold: number; // km - distance to trigger refresh
}

export { RedisClientInterface };

@Injectable()
export class WeatherCacheService {
  private readonly logger = new Logger(WeatherCacheService.name);
  private readonly config: WeatherCacheConfig;
  private readonly useRedis: boolean;
  
  // In-memory cache (fallback when Redis is not available)
  private currentWeatherCache = new Map<string, CacheEntry<any>>();
  private forecastCache = new Map<string, CacheEntry<any>>();

  constructor(
    private readonly configService: ConfigService,
    @Optional() @Inject(CACHE_REDIS_CLIENT) private readonly redisClient?: RedisClientInterface | null,
  ) {
    this.config = {
      currentWeatherTTL: this.configService.get<number>('REDIS_TTL_CURRENT_WEATHER', 3600) * 1000,
      forecastTTL: this.configService.get<number>('REDIS_TTL_FORECAST', 21600) * 1000,
      locationThreshold: 10, // 10km
    };
    this.useRedis = !!redisClient;
    this.logger.log(`Weather cache initialized with ${this.useRedis ? 'Redis' : 'in-memory'} storage`);
    this.logger.log(`TTL config: current=${this.config.currentWeatherTTL}ms, forecast=${this.config.forecastTTL}ms`);
  }

  private getCacheKey(latitude: number, longitude: number): string {
    // Round to 2 decimal places for cache key (roughly 1km precision)
    const lat = Math.round(latitude * 100) / 100;
    const lng = Math.round(longitude * 100) / 100;
    return `${lat}:${lng}`;
  }

  private calculateDistance(
    lat1: number, lon1: number,
    lat2: number, lon2: number,
  ): number {
    // Haversine formula for distance in km
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  shouldRefreshForLocation(
    cachedLocation: { latitude: number; longitude: number },
    newLocation: { latitude: number; longitude: number },
  ): boolean {
    const distance = this.calculateDistance(
      cachedLocation.latitude,
      cachedLocation.longitude,
      newLocation.latitude,
      newLocation.longitude,
    );
    return distance > this.config.locationThreshold;
  }

  async getCurrentWeather(latitude: number, longitude: number): Promise<CacheEntry<any> | null> {
    const key = `weather:current:${this.getCacheKey(latitude, longitude)}`;
    
    if (this.useRedis && this.redisClient) {
      try {
        const cached = await this.redisClient.get(key);
        if (cached) {
          const entry = JSON.parse(cached) as CacheEntry<any>;
          if (this.shouldRefreshForLocation(entry.location, { latitude, longitude })) {
            this.logger.debug(`Location changed significantly, invalidating Redis cache for ${key}`);
            await this.redisClient.del(key);
            return null;
          }
          this.logger.debug(`Redis cache hit for current weather at ${key}`);
          return entry;
        }
        return null;
      } catch (error) {
        this.logger.warn(`Redis error, falling back to in-memory: ${error.message}`);
      }
    }
    
    // In-memory fallback
    const entry = this.currentWeatherCache.get(key);
    
    if (!entry) {
      return null;
    }
    
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.logger.debug(`Current weather cache expired for ${key}`);
      this.currentWeatherCache.delete(key);
      return null;
    }
    
    if (this.shouldRefreshForLocation(entry.location, { latitude, longitude })) {
      this.logger.debug(`Location changed significantly, invalidating cache for ${key}`);
      return null;
    }
    
    this.logger.debug(`In-memory cache hit for current weather at ${key}`);
    return entry;
  }

  async setCurrentWeather(latitude: number, longitude: number, data: any): Promise<void> {
    const key = `weather:current:${this.getCacheKey(latitude, longitude)}`;
    const entry: CacheEntry<any> = {
      data,
      timestamp: Date.now(),
      ttl: this.config.currentWeatherTTL,
      location: { latitude, longitude },
    };
    
    if (this.useRedis && this.redisClient) {
      try {
        const ttlSeconds = Math.floor(this.config.currentWeatherTTL / 1000);
        await this.redisClient.set(key, JSON.stringify(entry), { EX: ttlSeconds });
        this.logger.debug(`Cached current weather in Redis for ${key}, TTL: ${ttlSeconds}s`);
        return;
      } catch (error) {
        this.logger.warn(`Redis error, falling back to in-memory: ${error.message}`);
      }
    }
    
    // In-memory fallback
    this.currentWeatherCache.set(key, entry);
    this.logger.debug(`Cached current weather in-memory for ${key}, TTL: ${this.config.currentWeatherTTL}ms`);
  }

  async getForecast(latitude: number, longitude: number): Promise<CacheEntry<any> | null> {
    const key = `weather:forecast:${this.getCacheKey(latitude, longitude)}`;
    
    if (this.useRedis && this.redisClient) {
      try {
        const cached = await this.redisClient.get(key);
        if (cached) {
          const entry = JSON.parse(cached) as CacheEntry<any>;
          if (this.shouldRefreshForLocation(entry.location, { latitude, longitude })) {
            this.logger.debug(`Location changed significantly, invalidating Redis forecast cache for ${key}`);
            await this.redisClient.del(key);
            return null;
          }
          this.logger.debug(`Redis cache hit for forecast at ${key}`);
          return entry;
        }
        return null;
      } catch (error) {
        this.logger.warn(`Redis error, falling back to in-memory: ${error.message}`);
      }
    }
    
    // In-memory fallback
    const entry = this.forecastCache.get(key);
    
    if (!entry) {
      return null;
    }
    
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.logger.debug(`Forecast cache expired for ${key}`);
      this.forecastCache.delete(key);
      return null;
    }
    
    if (this.shouldRefreshForLocation(entry.location, { latitude, longitude })) {
      this.logger.debug(`Location changed significantly, invalidating forecast cache for ${key}`);
      return null;
    }
    
    this.logger.debug(`In-memory cache hit for forecast at ${key}`);
    return entry;
  }

  async setForecast(latitude: number, longitude: number, data: any): Promise<void> {
    const key = `weather:forecast:${this.getCacheKey(latitude, longitude)}`;
    const entry: CacheEntry<any> = {
      data,
      timestamp: Date.now(),
      ttl: this.config.forecastTTL,
      location: { latitude, longitude },
    };
    
    if (this.useRedis && this.redisClient) {
      try {
        const ttlSeconds = Math.floor(this.config.forecastTTL / 1000);
        await this.redisClient.set(key, JSON.stringify(entry), { EX: ttlSeconds });
        this.logger.debug(`Cached forecast in Redis for ${key}, TTL: ${ttlSeconds}s`);
        return;
      } catch (error) {
        this.logger.warn(`Redis error, falling back to in-memory: ${error.message}`);
      }
    }
    
    // In-memory fallback
    this.forecastCache.set(key, entry);
    this.logger.debug(`Cached forecast in-memory for ${key}, TTL: ${this.config.forecastTTL}ms`);
  }

  async invalidateLocation(latitude: number, longitude: number): Promise<void> {
    const baseKey = this.getCacheKey(latitude, longitude);
    const currentKey = `weather:current:${baseKey}`;
    const forecastKey = `weather:forecast:${baseKey}`;
    
    if (this.useRedis && this.redisClient) {
      try {
        await Promise.all([
          this.redisClient.del(currentKey),
          this.redisClient.del(forecastKey),
        ]);
        this.logger.debug(`Invalidated Redis cache for ${baseKey}`);
        return;
      } catch (error) {
        this.logger.warn(`Redis error during invalidation: ${error.message}`);
      }
    }
    
    // In-memory fallback
    this.currentWeatherCache.delete(currentKey);
    this.forecastCache.delete(forecastKey);
    this.logger.debug(`Invalidated in-memory cache for ${baseKey}`);
  }

  getCacheMetadata(latitude: number, longitude: number): {
    currentWeather: { cached: boolean; timestamp?: number; ttl?: number; stale?: boolean } | null;
    forecast: { cached: boolean; timestamp?: number; ttl?: number; stale?: boolean } | null;
  } {
    const key = this.getCacheKey(latitude, longitude);
    const now = Date.now();
    
    const currentEntry = this.currentWeatherCache.get(key);
    const forecastEntry = this.forecastCache.get(key);
    
    return {
      currentWeather: currentEntry ? {
        cached: true,
        timestamp: currentEntry.timestamp,
        ttl: currentEntry.ttl,
        stale: now - currentEntry.timestamp > currentEntry.ttl,
      } : null,
      forecast: forecastEntry ? {
        cached: true,
        timestamp: forecastEntry.timestamp,
        ttl: forecastEntry.ttl,
        stale: now - forecastEntry.timestamp > forecastEntry.ttl,
      } : null,
    };
  }

  // Get TTL configuration for testing
  getTTLConfig(): { currentWeatherTTL: number; forecastTTL: number } {
    return {
      currentWeatherTTL: this.config.currentWeatherTTL,
      forecastTTL: this.config.forecastTTL,
    };
  }
}

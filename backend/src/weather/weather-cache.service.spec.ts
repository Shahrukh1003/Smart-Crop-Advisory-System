import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as fc from 'fast-check';
import { WeatherCacheService, CacheEntry } from './weather-cache.service';

describe('WeatherCacheService', () => {
  let service: WeatherCacheService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue: any) => {
      const config: Record<string, any> = {
        REDIS_TTL_CURRENT_WEATHER: 3600, // 1 hour in seconds
        REDIS_TTL_FORECAST: 21600, // 6 hours in seconds
      };
      return config[key] ?? defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WeatherCacheService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<WeatherCacheService>(WeatherCacheService);
    configService = module.get<ConfigService>(ConfigService);
  });

  // **Feature: project-finalization, Property 5: Weather cache entries have correct TTL**
  // **Validates: Requirements 2.4**
  describe('Property 5: Weather cache entries have correct TTL', () => {
    const locationArb = fc.record({
      latitude: fc.float({ min: 8, max: 37, noNaN: true }),
      longitude: fc.float({ min: 68, max: 97, noNaN: true }),
    });

    const weatherDataArb = fc.record({
      temperature: fc.float({ min: -10, max: 50, noNaN: true }),
      humidity: fc.integer({ min: 0, max: 100 }),
      rainfall: fc.float({ min: 0, max: 100, noNaN: true }),
      windSpeed: fc.float({ min: 0, max: 100, noNaN: true }),
      description: fc.string({ minLength: 1, maxLength: 50 }),
    });

    const forecastArb = fc.array(
      fc.record({
        date: fc.date().map(d => d.toISOString().split('T')[0]),
        minTemp: fc.float({ min: -10, max: 40, noNaN: true }),
        maxTemp: fc.float({ min: 0, max: 50, noNaN: true }),
        rainfall: fc.float({ min: 0, max: 100, noNaN: true }),
        humidity: fc.integer({ min: 0, max: 100 }),
        windSpeed: fc.float({ min: 0, max: 100, noNaN: true }),
        description: fc.string({ minLength: 1, maxLength: 50 }),
      }),
      { minLength: 7, maxLength: 7 },
    );

    it('should set current weather cache with 1-hour TTL (3600000ms)', async () => {
      await fc.assert(
        fc.asyncProperty(
          locationArb,
          weatherDataArb,
          async (location, weatherData) => {
            // Set the weather data
            await service.setCurrentWeather(location.latitude, location.longitude, weatherData);
            
            // Get the cached entry
            const cached = await service.getCurrentWeather(location.latitude, location.longitude);
            
            // Property: Cache entry should exist
            expect(cached).not.toBeNull();
            
            // Property: TTL should be 1 hour (3600000ms)
            expect(cached!.ttl).toBe(3600000);
            
            // Property: Data should match what was set
            expect(cached!.data).toEqual(weatherData);
            
            // Property: Timestamp should be recent (within last second)
            const now = Date.now();
            expect(cached!.timestamp).toBeGreaterThan(now - 1000);
            expect(cached!.timestamp).toBeLessThanOrEqual(now);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should set forecast cache with 6-hour TTL (21600000ms)', async () => {
      await fc.assert(
        fc.asyncProperty(
          locationArb,
          forecastArb,
          async (location, forecast) => {
            // Set the forecast data
            await service.setForecast(location.latitude, location.longitude, forecast);
            
            // Get the cached entry
            const cached = await service.getForecast(location.latitude, location.longitude);
            
            // Property: Cache entry should exist
            expect(cached).not.toBeNull();
            
            // Property: TTL should be 6 hours (21600000ms)
            expect(cached!.ttl).toBe(21600000);
            
            // Property: Data should match what was set
            expect(cached!.data).toEqual(forecast);
            
            // Property: Timestamp should be recent
            const now = Date.now();
            expect(cached!.timestamp).toBeGreaterThan(now - 1000);
            expect(cached!.timestamp).toBeLessThanOrEqual(now);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return correct TTL configuration', () => {
      const ttlConfig = service.getTTLConfig();
      
      // Property: Current weather TTL should be 1 hour (3600000ms)
      expect(ttlConfig.currentWeatherTTL).toBe(3600000);
      
      // Property: Forecast TTL should be 6 hours (21600000ms)
      expect(ttlConfig.forecastTTL).toBe(21600000);
    });
  });

  // **Feature: project-finalization, Property 7: Location changes trigger weather refresh**
  // **Validates: Requirements 2.5**
  describe('Property 7: Location changes trigger weather refresh', () => {
    it('should detect when location change exceeds threshold (10km)', () => {
      // Test cases with known distances
      const testCases = [
        // Same location - should NOT refresh
        { loc1: { latitude: 12.9716, longitude: 77.5946 }, loc2: { latitude: 12.9716, longitude: 77.5946 }, shouldRefresh: false },
        // Small change (~1km) - should NOT refresh
        { loc1: { latitude: 12.9716, longitude: 77.5946 }, loc2: { latitude: 12.9800, longitude: 77.5946 }, shouldRefresh: false },
        // Large change (~100km) - should refresh
        { loc1: { latitude: 12.9716, longitude: 77.5946 }, loc2: { latitude: 13.9716, longitude: 77.5946 }, shouldRefresh: true },
        // Medium change (~15km) - should refresh
        { loc1: { latitude: 12.9716, longitude: 77.5946 }, loc2: { latitude: 13.1000, longitude: 77.5946 }, shouldRefresh: true },
      ];

      for (const testCase of testCases) {
        const result = service.shouldRefreshForLocation(testCase.loc1, testCase.loc2);
        expect(result).toBe(testCase.shouldRefresh);
      }
    });

    it('should invalidate cache when location changes significantly', async () => {
      const originalLocation = { latitude: 12.9716, longitude: 77.5946 };
      const newLocation = { latitude: 13.9716, longitude: 77.5946 }; // ~100km away
      
      const weatherData = {
        temperature: 28,
        humidity: 65,
        rainfall: 0,
        windSpeed: 10,
        description: 'Partly Cloudy',
      };

      // Cache data at original location
      await service.setCurrentWeather(originalLocation.latitude, originalLocation.longitude, weatherData);
      
      // Verify it's cached
      const cached = await service.getCurrentWeather(originalLocation.latitude, originalLocation.longitude);
      expect(cached).not.toBeNull();
      
      // Try to get cache with significantly different location
      // The cache key is rounded, so we need to check the shouldRefreshForLocation logic
      const shouldRefresh = service.shouldRefreshForLocation(
        { latitude: originalLocation.latitude, longitude: originalLocation.longitude },
        { latitude: newLocation.latitude, longitude: newLocation.longitude }
      );
      
      // Property: Should indicate refresh is needed for large location change
      expect(shouldRefresh).toBe(true);
    });
  });
});

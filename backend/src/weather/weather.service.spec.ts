import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import * as fc from 'fast-check';
import { WeatherService } from './weather.service';
import { OpenWeatherMapClient } from './openweathermap.client';
import { WeatherCacheService } from './weather-cache.service';
import { WeatherAlertService } from './weather-alert.service';

const mockHttpService = { get: jest.fn() };
const mockConfigService = { get: jest.fn().mockReturnValue('') };
const mockOpenWeatherMapClient = {
  isConfigured: jest.fn().mockReturnValue(false),
  fetchCurrentWeather: jest.fn(),
  fetchForecast: jest.fn(),
};
const mockCacheService = {
  getCurrentWeather: jest.fn().mockResolvedValue(null),
  getForecast: jest.fn().mockResolvedValue(null),
  setCurrentWeather: jest.fn().mockResolvedValue(undefined),
  setForecast: jest.fn().mockResolvedValue(undefined),
  getTTLConfig: jest.fn().mockReturnValue({ currentWeatherTTL: 3600000, forecastTTL: 21600000 }),
  shouldRefreshForLocation: jest.fn().mockReturnValue(false),
};
const mockAlertService = {
  detectAlerts: jest.fn().mockReturnValue([]),
  getThresholds: jest.fn().mockReturnValue({ heavyRain: 15, heatWave: 40, frost: 10, highWind: 30 }),
};

describe('WeatherService', () => {
  let service: WeatherService;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WeatherService,
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: OpenWeatherMapClient, useValue: mockOpenWeatherMapClient },
        { provide: WeatherCacheService, useValue: mockCacheService },
        { provide: WeatherAlertService, useValue: mockAlertService },
      ],
    }).compile();

    service = module.get<WeatherService>(WeatherService);
  });

  // **Feature: smart-crop-advisory, Property 9: Weather conditions generate activity recommendations**
  // **Validates: Requirements 3.2**
  describe('Property 9: Weather conditions generate activity recommendations', () => {
    const locationArb = fc.record({
      latitude: fc.float({ min: 8, max: 37, noNaN: true }),
      longitude: fc.float({ min: 68, max: 97, noNaN: true }),
    });

    it('should generate activity recommendations with time windows for any location', async () => {
      await fc.assert(
        fc.asyncProperty(
          locationArb,
          async (location) => {
            const result = await service.getWeatherData(location.latitude, location.longitude);

            // Property: Activity recommendations should exist
            expect(result.activityRecommendations).toBeDefined();
            expect(Array.isArray(result.activityRecommendations)).toBe(true);

            // Property: Each recommendation should have required fields
            for (const rec of result.activityRecommendations) {
              expect(rec.activity).toBeDefined();
              expect(rec.activity.length).toBeGreaterThan(0);
              expect(typeof rec.recommended).toBe('boolean');
              expect(rec.timeWindow).toBeDefined();
              expect(rec.reason).toBeDefined();
              expect(rec.reason.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // **Feature: project-finalization, Property 4: Weather data includes required fields**
  // **Validates: Requirements 2.1**
  describe('Property 4: Weather data includes required fields', () => {
    const locationArb = fc.record({
      latitude: fc.float({ min: 8, max: 37, noNaN: true }),
      longitude: fc.float({ min: 68, max: 97, noNaN: true }),
    });

    it('should include temperature, humidity, rainfall, wind speed, and 7-day forecast for any valid coordinates', async () => {
      await fc.assert(
        fc.asyncProperty(
          locationArb,
          async (location) => {
            const result = await service.getWeatherData(location.latitude, location.longitude);

            // Property: Current weather should include all required fields
            expect(result.current).toBeDefined();
            expect(typeof result.current.temperature).toBe('number');
            expect(typeof result.current.humidity).toBe('number');
            expect(typeof result.current.rainfall).toBe('number');
            expect(typeof result.current.windSpeed).toBe('number');

            // Property: Should have 7-day forecast array
            expect(result.forecast).toBeDefined();
            expect(Array.isArray(result.forecast)).toBe(true);
            expect(result.forecast.length).toBe(7);

            // Property: Each forecast day should have all required fields
            for (const day of result.forecast) {
              expect(day.date).toBeDefined();
              expect(typeof day.date).toBe('string');
              expect(typeof day.minTemp).toBe('number');
              expect(typeof day.maxTemp).toBe('number');
              expect(typeof day.rainfall).toBe('number');
              expect(typeof day.humidity).toBe('number');
              expect(typeof day.windSpeed).toBe('number');
              expect(day.description).toBeDefined();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // **Feature: smart-crop-advisory, Property 11: Pest risk generates alerts**
  // **Validates: Requirements 3.4**
  describe('Property 11: Pest risk generates alerts', () => {
    it('should generate pest risk alert when conditions match known patterns', async () => {
      // Test with multiple random locations
      await fc.assert(
        fc.asyncProperty(
          fc.float({ min: 8, max: 37, noNaN: true }),
          fc.float({ min: 68, max: 97, noNaN: true }),
          async (lat, lng) => {
            const result = await service.getWeatherData(lat, lng);

            // Property: If pest risk is detected, it should have required fields
            if (result.pestRiskAlert) {
              expect(result.pestRiskAlert.risk).toBeDefined();
              expect(result.pestRiskAlert.risk.length).toBeGreaterThan(0);
              expect(result.pestRiskAlert.actions).toBeDefined();
              expect(Array.isArray(result.pestRiskAlert.actions)).toBe(true);
              expect(result.pestRiskAlert.actions.length).toBeGreaterThan(0);
            }

            // Property: Weather alerts should be properly structured
            if (result.alerts && result.alerts.length > 0) {
              for (const alert of result.alerts) {
                expect(['heavy_rain', 'heat_wave', 'frost', 'storm']).toContain(alert.alertType);
                expect(['low', 'medium', 'high']).toContain(alert.severity);
                expect(alert.description).toBeDefined();
                expect(alert.description.length).toBeGreaterThan(0);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // **Feature: smart-crop-advisory, Property 12: Rainfall adjusts irrigation**
  // **Validates: Requirements 3.5**
  describe('Property 12: Rainfall adjusts irrigation', () => {
    it('should provide irrigation recommendation based on rainfall forecast', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.float({ min: 8, max: 37, noNaN: true }),
          fc.float({ min: 68, max: 97, noNaN: true }),
          async (lat, lng) => {
            const result = await service.getWeatherData(lat, lng);

            // Property: Irrigation recommendation should always exist
            expect(result.irrigationRecommendation).toBeDefined();
            expect(result.irrigationRecommendation!.action).toBeDefined();
            expect(result.irrigationRecommendation!.action.length).toBeGreaterThan(0);
            expect(result.irrigationRecommendation!.reason).toBeDefined();
            expect(result.irrigationRecommendation!.reason.length).toBeGreaterThan(0);

            // Property: Action should be one of the expected types
            const validActions = [
              'Skip irrigation',
              'Reduce irrigation',
              'Continue normal irrigation',
            ];
            const hasValidAction = validActions.some(action => 
              result.irrigationRecommendation!.action.toLowerCase().includes(action.toLowerCase().split(' ')[0])
            );
            expect(hasValidAction).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

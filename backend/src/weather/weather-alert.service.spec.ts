import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as fc from 'fast-check';
import { WeatherAlertService, AlertThresholds } from './weather-alert.service';
import { WeatherForecastDto } from './dto/weather.dto';

describe('WeatherAlertService', () => {
  let service: WeatherAlertService;
  let thresholds: AlertThresholds;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue: any) => {
      const config: Record<string, any> = {
        ALERT_THRESHOLD_RAIN: 15,
        ALERT_THRESHOLD_HEAT: 40,
        ALERT_THRESHOLD_FROST: 10,
        ALERT_THRESHOLD_WIND: 30,
      };
      return config[key] ?? defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WeatherAlertService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<WeatherAlertService>(WeatherAlertService);
    thresholds = service.getThresholds();
  });

  // **Feature: project-finalization, Property 6: Severe weather generates alerts**
  // **Validates: Requirements 2.3**
  describe('Property 6: Severe weather generates alerts', () => {
    // Generator for forecast with heavy rain (above threshold)
    const heavyRainForecastArb = fc.record({
      date: fc.date({ min: new Date(), max: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) })
        .map(d => d.toISOString().split('T')[0]),
      minTemp: fc.integer({ min: 15, max: 25 }),
      maxTemp: fc.integer({ min: 25, max: 35 }),
      rainfall: fc.integer({ min: 16, max: 100 }), // Above threshold (15mm)
      humidity: fc.integer({ min: 60, max: 100 }),
      windSpeed: fc.integer({ min: 0, max: 29 }), // Below wind threshold
      description: fc.constant('Heavy Rain'),
    });

    // Generator for forecast with heat wave (above threshold)
    const heatWaveForecastArb = fc.record({
      date: fc.date({ min: new Date(), max: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) })
        .map(d => d.toISOString().split('T')[0]),
      minTemp: fc.integer({ min: 25, max: 35 }),
      maxTemp: fc.integer({ min: 41, max: 50 }), // Above threshold (40°C)
      rainfall: fc.integer({ min: 0, max: 5 }),
      humidity: fc.integer({ min: 20, max: 50 }),
      windSpeed: fc.integer({ min: 0, max: 20 }),
      description: fc.constant('Very Hot'),
    });

    // Generator for forecast with frost (below threshold)
    const frostForecastArb = fc.record({
      date: fc.date({ min: new Date(), max: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) })
        .map(d => d.toISOString().split('T')[0]),
      minTemp: fc.integer({ min: -10, max: 9 }), // Below threshold (10°C)
      maxTemp: fc.integer({ min: 10, max: 20 }),
      rainfall: fc.integer({ min: 0, max: 5 }),
      humidity: fc.integer({ min: 40, max: 70 }),
      windSpeed: fc.integer({ min: 0, max: 20 }),
      description: fc.constant('Cold'),
    });

    // Generator for forecast with high wind (above threshold)
    const highWindForecastArb = fc.record({
      date: fc.date({ min: new Date(), max: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) })
        .map(d => d.toISOString().split('T')[0]),
      minTemp: fc.integer({ min: 15, max: 25 }),
      maxTemp: fc.integer({ min: 25, max: 35 }),
      rainfall: fc.integer({ min: 0, max: 5 }),
      humidity: fc.integer({ min: 40, max: 70 }),
      windSpeed: fc.integer({ min: 31, max: 80 }), // Above threshold (30 km/h)
      description: fc.constant('Windy'),
    });

    // Generator for normal forecast (no alerts)
    const normalForecastArb = fc.record({
      date: fc.date({ min: new Date(), max: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) })
        .map(d => d.toISOString().split('T')[0]),
      minTemp: fc.integer({ min: 11, max: 25 }), // Above frost threshold (10°C)
      maxTemp: fc.integer({ min: 25, max: 39 }), // Below heat threshold (40°C)
      rainfall: fc.integer({ min: 0, max: 14 }), // Below rain threshold (15mm)
      humidity: fc.integer({ min: 40, max: 70 }),
      windSpeed: fc.integer({ min: 0, max: 29 }), // Below wind threshold (30 km/h)
      description: fc.constant('Partly Cloudy'),
    });

    it('should generate heavy_rain alert when rainfall exceeds 15mm', async () => {
      await fc.assert(
        fc.property(
          fc.array(heavyRainForecastArb, { minLength: 1, maxLength: 7 }),
          (forecast) => {
            const alerts = service.detectAlerts(forecast as WeatherForecastDto[]);
            
            // Property: Should generate at least one heavy_rain alert
            const rainAlerts = alerts.filter(a => a.alertType === 'heavy_rain');
            expect(rainAlerts.length).toBeGreaterThanOrEqual(1);
            
            // Property: Each rain alert should have valid structure
            for (const alert of rainAlerts) {
              expect(alert.severity).toMatch(/^(medium|high)$/);
              expect(alert.description).toContain('rainfall');
              expect(alert.startTime).toBeDefined();
              expect(alert.endTime).toBeDefined();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate heat_wave alert when temperature exceeds 40°C', async () => {
      await fc.assert(
        fc.property(
          fc.array(heatWaveForecastArb, { minLength: 1, maxLength: 7 }),
          (forecast) => {
            const alerts = service.detectAlerts(forecast as WeatherForecastDto[]);
            
            // Property: Should generate at least one heat_wave alert
            const heatAlerts = alerts.filter(a => a.alertType === 'heat_wave');
            expect(heatAlerts.length).toBeGreaterThanOrEqual(1);
            
            // Property: Each heat alert should have valid structure
            for (const alert of heatAlerts) {
              expect(alert.severity).toMatch(/^(medium|high)$/);
              expect(alert.description).toContain('Heat wave');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate frost alert when temperature falls below 10°C', async () => {
      await fc.assert(
        fc.property(
          fc.array(frostForecastArb, { minLength: 1, maxLength: 7 }),
          (forecast) => {
            const alerts = service.detectAlerts(forecast as WeatherForecastDto[]);
            
            // Property: Should generate at least one frost alert
            const frostAlerts = alerts.filter(a => a.alertType === 'frost');
            expect(frostAlerts.length).toBeGreaterThanOrEqual(1);
            
            // Property: Each frost alert should have valid structure
            for (const alert of frostAlerts) {
              expect(alert.severity).toMatch(/^(medium|high)$/);
              expect(alert.description).toContain('Frost');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate storm alert when wind speed exceeds 30 km/h', async () => {
      await fc.assert(
        fc.property(
          fc.array(highWindForecastArb, { minLength: 1, maxLength: 7 }),
          (forecast) => {
            const alerts = service.detectAlerts(forecast as WeatherForecastDto[]);
            
            // Property: Should generate at least one storm alert
            const stormAlerts = alerts.filter(a => a.alertType === 'storm');
            expect(stormAlerts.length).toBeGreaterThanOrEqual(1);
            
            // Property: Each storm alert should have valid structure
            for (const alert of stormAlerts) {
              expect(alert.severity).toMatch(/^(medium|high)$/);
              expect(alert.description).toContain('winds');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should NOT generate alerts for normal weather conditions', async () => {
      await fc.assert(
        fc.property(
          fc.array(normalForecastArb, { minLength: 1, maxLength: 7 }),
          (forecast) => {
            const alerts = service.detectAlerts(forecast as WeatherForecastDto[]);
            
            // Property: Should NOT generate any alerts for normal conditions
            expect(alerts.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly identify alert conditions using hasAlertConditions', async () => {
      // Test with severe conditions
      await fc.assert(
        fc.property(
          fc.oneof(heavyRainForecastArb, heatWaveForecastArb, frostForecastArb, highWindForecastArb),
          (forecast) => {
            const hasAlert = service.hasAlertConditions(forecast as WeatherForecastDto);
            expect(hasAlert).toBe(true);
          }
        ),
        { numRuns: 100 }
      );

      // Test with normal conditions
      await fc.assert(
        fc.property(
          normalForecastArb,
          (forecast) => {
            const hasAlert = service.hasAlertConditions(forecast as WeatherForecastDto);
            expect(hasAlert).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('getAffectedRegions', () => {
    it('should return farmers within the alert radius', () => {
      const alertLocation = {
        latitude: 12.9716,
        longitude: 77.5946,
        radiusKm: 50,
      };

      const farmers = [
        { latitude: 12.9716, longitude: 77.5946, userId: 'farmer1' }, // Same location
        { latitude: 12.9800, longitude: 77.6000, userId: 'farmer2' }, // ~1km away
        { latitude: 13.5000, longitude: 77.5946, userId: 'farmer3' }, // ~60km away
        { latitude: 14.0000, longitude: 77.5946, userId: 'farmer4' }, // ~115km away
      ];

      const affected = service.getAffectedRegions(alertLocation, farmers);

      expect(affected).toContain('farmer1');
      expect(affected).toContain('farmer2');
      expect(affected).not.toContain('farmer3');
      expect(affected).not.toContain('farmer4');
    });
  });
});

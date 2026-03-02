import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import * as fc from 'fast-check';
import { MarketService } from './market.service';
import { AgmarknetClient } from './agmarknet.client';
import { PrismaService } from '../prisma/prisma.service';

const mockPrismaService = {
  marketPrice: {
    findMany: jest.fn().mockResolvedValue([]),
  },
};

const mockHttpService = {
  get: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string, defaultValue: string) => defaultValue),
};

const mockAgmarknetClient = {
  isConfigured: jest.fn().mockReturnValue(false),
  fetchPrices: jest.fn().mockResolvedValue([]),
};

describe('MarketService', () => {
  let service: MarketService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: AgmarknetClient, useValue: mockAgmarknetClient },
      ],
    }).compile();

    service = module.get<MarketService>(MarketService);
  });

  // **Feature: project-finalization, Property 8: Market prices are filtered by distance**
  // **Validates: Requirements 3.1**
  describe('Property 8: Market prices are filtered by distance', () => {
    const commodityArb = fc.constantFrom(
      'Rice', 'Wheat', 'Maize', 'Cotton', 'Tomato', 'Onion', 'Potato'
    );

    // Generator for locations within India
    const locationArb = fc.record({
      latitude: fc.float({ min: 8, max: 37, noNaN: true }),
      longitude: fc.float({ min: 68, max: 97, noNaN: true }),
    });

    // Generator for radius values
    const radiusArb = fc.integer({ min: 10, max: 500 });

    it('should return only markets within specified radius', async () => {
      await fc.assert(
        fc.asyncProperty(
          commodityArb,
          locationArb,
          radiusArb,
          async (commodity, location, radiusKm) => {
            const results = await service.getPrices(
              commodity,
              location.latitude,
              location.longitude,
              radiusKm
            );

            // Property: All returned markets should be within the specified radius
            for (const result of results) {
              expect(result.market.distance).toBeLessThanOrEqual(radiusKm);
            }
          }
        ),
        { numRuns: 100 }
      );
    });


    it('should include distance in each market result', async () => {
      await fc.assert(
        fc.asyncProperty(
          commodityArb,
          locationArb,
          async (commodity, location) => {
            const results = await service.getPrices(
              commodity,
              location.latitude,
              location.longitude,
              100
            );

            // Property: Each result should have a valid distance field
            for (const result of results) {
              expect(result.market.distance).toBeDefined();
              expect(typeof result.market.distance).toBe('number');
              expect(result.market.distance).toBeGreaterThanOrEqual(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return empty array for location far from all markets', async () => {
      // Location in remote area far from any markets (middle of ocean)
      const results = await service.getPrices('Rice', 0, 0, 50);
      expect(results.length).toBe(0);
    });

    it('should filter markets correctly with small radius', async () => {
      // Bangalore location with small radius
      const results = await service.getPrices('Rice', 12.9716, 77.5946, 10);
      
      // All results should be within 10km
      for (const result of results) {
        expect(result.market.distance).toBeLessThanOrEqual(10);
      }
    });
  });

  // **Feature: project-finalization, Property 9: Transportation costs are proportional to distance**
  // **Validates: Requirements 3.4**
  describe('Property 9: Transportation costs are proportional to distance', () => {
    const commodityArb = fc.constantFrom('Rice', 'Wheat', 'Maize');
    const locationArb = fc.record({
      latitude: fc.float({ min: 12, max: 16, noNaN: true }),
      longitude: fc.float({ min: 74, max: 78, noNaN: true }),
    });

    it('should calculate transportation cost proportional to distance', async () => {
      await fc.assert(
        fc.asyncProperty(
          commodityArb,
          locationArb,
          async (commodity, location) => {
            const results = await service.getPrices(
              commodity,
              location.latitude,
              location.longitude,
              200
            );

            // Property: Transportation cost should be proportional to distance
            // Cost per km is 12 INR
            const costPerKm = 12;
            for (const result of results) {
              expect(result.transportationCost).toBeDefined();
              expect(typeof result.transportationCost).toBe('number');
              expect(result.transportationCost).toBeGreaterThanOrEqual(0);

              // Cost should be approximately distance * costPerKm
              // The stored distance is already rounded, so use it directly
              // Allow for rounding tolerance of ±costPerKm (one km worth)
              const expectedCost = result.market.distance * costPerKm;
              expect(result.transportationCost).toBeGreaterThanOrEqual(expectedCost - costPerKm);
              expect(result.transportationCost).toBeLessThanOrEqual(expectedCost + costPerKm);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have zero transportation cost for zero distance', () => {
      const cost = service.calculateTransportationCost(0);
      expect(cost).toBe(0);
    });

    it('should increase transportation cost linearly with distance', () => {
      const cost10km = service.calculateTransportationCost(10);
      const cost20km = service.calculateTransportationCost(20);
      const cost50km = service.calculateTransportationCost(50);

      // Cost should double when distance doubles
      expect(cost20km).toBe(cost10km * 2);
      // Cost should be 5x when distance is 5x
      expect(cost50km).toBe(cost10km * 5);
    });
  });


  // **Feature: project-finalization, Property 10: Selling recommendations include MSP comparison**
  // **Validates: Requirements 3.5**
  describe('Property 10: Selling recommendations include MSP comparison', () => {
    const commoditiesWithMsp = fc.constantFrom(
      'Rice', 'Wheat', 'Maize', 'Cotton', 'Groundnut', 'Soybean', 'Ragi', 'Jowar', 'Bajra'
    );
    const commoditiesWithoutMsp = fc.constantFrom(
      'Tomato', 'Onion', 'Potato', 'Chilli', 'Turmeric', 'Coconut', 'Banana'
    );
    const locationArb = fc.record({
      latitude: fc.float({ min: 12, max: 16, noNaN: true }),
      longitude: fc.float({ min: 74, max: 78, noNaN: true }),
    });

    it('should include MSP comparison for crops with defined MSP', async () => {
      await fc.assert(
        fc.asyncProperty(
          commoditiesWithMsp,
          locationArb,
          async (commodity, location) => {
            const result = await service.getSellingRecommendation(
              commodity,
              location.latitude,
              location.longitude
            );

            // Property: Crops with MSP should have mspComparison
            if (result.bestMarket) {
              expect(result.msp).toBeDefined();
              expect(result.msp).toBeGreaterThan(0);
              expect(result.mspComparison).toBeDefined();
              expect(result.mspComparison?.msp).toBe(result.msp);
              expect(result.mspComparison?.currentPrice).toBeDefined();
              expect(typeof result.mspComparison?.isBelowMsp).toBe('boolean');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have null or zero MSP for crops without defined MSP', async () => {
      await fc.assert(
        fc.asyncProperty(
          commoditiesWithoutMsp,
          locationArb,
          async (commodity, location) => {
            const result = await service.getSellingRecommendation(
              commodity,
              location.latitude,
              location.longitude
            );

            // Property: Crops without MSP should have null or 0 msp
            expect(result.msp === null || result.msp === 0).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly identify when price is below MSP', async () => {
      // Test with a specific scenario
      const result = await service.getSellingRecommendation('Rice', 12.9716, 77.5946);

      if (result.mspComparison) {
        const { currentPrice, msp, isBelowMsp } = result.mspComparison;
        expect(isBelowMsp).toBe(currentPrice < msp);
      }
    });

    it('should include MSP warning in reasoning when price is below MSP', async () => {
      const result = await service.getSellingRecommendation('Rice', 12.9716, 77.5946);

      if (result.mspComparison?.isBelowMsp) {
        // Should have a warning in reasoning
        const hasMspWarning = result.reasoning.some(r => r.includes('below MSP'));
        expect(hasMspWarning).toBe(true);
      }
    });
  });

  // **Feature: project-finalization, Property 11: Price change alerts are triggered correctly**
  // **Validates: Requirements 3.3**
  describe('Property 11: Price change alerts are triggered correctly', () => {
    it('should detect price changes in trends', async () => {
      const trends = await service.getPriceTrends('Rice', 30);

      // Property: Trends should have at least 30 days of data
      expect(trends.length).toBeGreaterThanOrEqual(30);

      // Property: Each trend entry should have date and price
      for (const entry of trends) {
        expect(entry.date).toBeDefined();
        expect(entry.price).toBeDefined();
        expect(typeof entry.price).toBe('number');
        expect(entry.price).toBeGreaterThan(0);
      }

      // Property: Dates should be in chronological order
      for (let i = 0; i < trends.length - 1; i++) {
        expect(new Date(trends[i].date).getTime()).toBeLessThanOrEqual(
          new Date(trends[i + 1].date).getTime()
        );
      }
    });

    it('should calculate price change percentage correctly', async () => {
      const prices = await service.getPrices('Rice', 12.9716, 77.5946, 100);

      for (const price of prices) {
        // Property: Price change should be a valid number
        expect(typeof price.priceChange).toBe('number');
        expect(price.priceChange).not.toBeNaN();
      }
    });
  });


  // Unit tests for selling recommendations
  describe('Selling recommendations', () => {
    const commodityArb = fc.constantFrom('Rice', 'Wheat', 'Maize', 'Cotton');
    const locationArb = fc.record({
      latitude: fc.float({ min: 12, max: 16, noNaN: true }),
      longitude: fc.float({ min: 74, max: 78, noNaN: true }),
    });

    it('should generate selling recommendation with reasoning', async () => {
      await fc.assert(
        fc.asyncProperty(
          commodityArb,
          locationArb,
          async (commodity, location) => {
            const result = await service.getSellingRecommendation(
              commodity,
              location.latitude,
              location.longitude
            );

            // Property: Should always have a recommendation
            expect(result.recommendation).toBeDefined();
            expect(typeof result.recommendation).toBe('string');
            expect(result.recommendation.length).toBeGreaterThan(0);

            // Property: Should always have reasoning array
            expect(result.reasoning).toBeDefined();
            expect(Array.isArray(result.reasoning)).toBe(true);

            // Property: Should have confidence level
            expect(['high', 'medium', 'low']).toContain(result.confidence);

            // Property: If markets are found, should have price data
            if (result.bestMarket) {
              expect(result.currentPrice).toBeDefined();
              expect(result.avgPrice30Days).toBeDefined();
              expect(result.priceAboveAvg).toBeDefined();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should recommend valid action types', async () => {
      const result = await service.getSellingRecommendation('Rice', 12.9716, 77.5946);

      const validRecommendations = [
        'SELL NOW',
        'HOLD',
        'CONSIDER SELLING',
        'No nearby markets found',
      ];
      const hasValidRecommendation = validRecommendations.some(r =>
        result.recommendation.includes(r)
      );
      expect(hasValidRecommendation).toBe(true);
    });
  });

  // Unit tests for distance calculation
  describe('Distance calculation (Haversine)', () => {
    it('should calculate zero distance for same location', () => {
      const distance = service.calculateDistance(12.9716, 77.5946, 12.9716, 77.5946);
      expect(distance).toBeCloseTo(0, 5);
    });

    it('should calculate correct distance between known points', () => {
      // Bangalore to Chennai is approximately 290 km
      const distance = service.calculateDistance(12.9716, 77.5946, 13.0827, 80.2707);
      expect(distance).toBeGreaterThan(250);
      expect(distance).toBeLessThan(350);
    });

    it('should be symmetric', () => {
      const d1 = service.calculateDistance(12.9716, 77.5946, 13.0827, 80.2707);
      const d2 = service.calculateDistance(13.0827, 80.2707, 12.9716, 77.5946);
      expect(d1).toBeCloseTo(d2, 5);
    });
  });

  // Unit tests for MSP data
  describe('MSP data', () => {
    it('should return MSP data for crops with defined MSP', () => {
      const mspData = service.getMspData('Rice');
      expect(mspData).not.toBeNull();
      expect(mspData?.msp).toBe(2300);
      expect(mspData?.unit).toBe('quintal');
    });

    it('should return null for crops without MSP', () => {
      const mspData = service.getMspData('Tomato');
      expect(mspData).toBeNull();
    });

    it('should return null for unknown crops', () => {
      const mspData = service.getMspData('UnknownCrop');
      expect(mspData).toBeNull();
    });
  });

  // Unit tests for commodities list
  describe('Commodities list', () => {
    it('should return all supported commodities', async () => {
      const commodities = await service.getAllCommodities();
      expect(commodities.length).toBeGreaterThan(0);
      expect(commodities).toContain('Rice');
      expect(commodities).toContain('Wheat');
      expect(commodities).toContain('Tomato');
    });
  });

  // Unit tests for markets by state
  describe('Markets by state', () => {
    it('should return markets for Karnataka', async () => {
      const markets = await service.getMarketsByState('Karnataka');
      expect(markets.length).toBeGreaterThan(0);
      markets.forEach(m => expect(m.state).toBe('Karnataka'));
    });

    it('should return empty array for unknown state', async () => {
      const markets = await service.getMarketsByState('UnknownState');
      expect(markets.length).toBe(0);
    });
  });
});

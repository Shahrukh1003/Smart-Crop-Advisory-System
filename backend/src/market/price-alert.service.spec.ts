import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';
import { PriceAlertService } from './price-alert.service';
import { MarketService } from './market.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrismaService = {
  marketPrice: {
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({}),
  },
  cropHistory: {
    findMany: jest.fn().mockResolvedValue([]),
  },
};

const mockMarketService = {
  getPrices: jest.fn().mockResolvedValue([]),
};

describe('PriceAlertService', () => {
  let service: PriceAlertService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PriceAlertService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: MarketService, useValue: mockMarketService },
      ],
    }).compile();

    service = module.get<PriceAlertService>(PriceAlertService);
  });

  // **Feature: project-finalization, Property 11: Price change alerts are triggered correctly**
  // **Validates: Requirements 3.3**
  describe('Property 11: Price change alerts are triggered correctly', () => {
    // Generator for price values
    const priceArb = fc.float({ min: 100, max: 50000, noNaN: true });

    it('should detect price changes exceeding 15% threshold', () => {
      fc.assert(
        fc.property(
          priceArb,
          fc.float({ min: Math.fround(0.16), max: Math.fround(2), noNaN: true }), // multiplier > 15%
          (previousPrice, multiplier) => {
            const currentPrice = previousPrice * multiplier;
            const changePercent = service.calculatePriceChangePercent(previousPrice, currentPrice);
            const isSignificant = service.isPriceChangeSignificant(previousPrice, currentPrice);

            // Property: Changes >= 15% should be significant
            if (Math.abs(changePercent) >= 15) {
              expect(isSignificant).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });


    it('should not trigger alerts for changes below 15% threshold', () => {
      fc.assert(
        fc.property(
          priceArb,
          fc.float({ min: Math.fround(0.86), max: Math.fround(1.14), noNaN: true }), // multiplier within ±14%
          (previousPrice, multiplier) => {
            const currentPrice = previousPrice * multiplier;
            const changePercent = service.calculatePriceChangePercent(previousPrice, currentPrice);
            const isSignificant = service.isPriceChangeSignificant(previousPrice, currentPrice);

            // Property: Changes < 15% should not be significant
            if (Math.abs(changePercent) < 15) {
              expect(isSignificant).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should calculate price change percentage correctly', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 100, max: 50000, noNaN: true }),
          fc.float({ min: 100, max: 50000, noNaN: true }),
          (previousPrice, currentPrice) => {
            const changePercent = service.calculatePriceChangePercent(previousPrice, currentPrice);

            // Property: Change percent should be calculated correctly
            const expectedChange = ((currentPrice - previousPrice) / previousPrice) * 100;
            expect(changePercent).toBeCloseTo(expectedChange, 5);

            // Property: Positive change means price increased
            if (currentPrice > previousPrice) {
              expect(changePercent).toBeGreaterThan(0);
            } else if (currentPrice < previousPrice) {
              expect(changePercent).toBeLessThan(0);
            } else {
              expect(changePercent).toBe(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle zero previous price gracefully', () => {
      const changePercent = service.calculatePriceChangePercent(0, 1000);
      expect(changePercent).toBe(0);
    });

    it('should return correct threshold value', () => {
      const threshold = service.getPriceChangeThreshold();
      expect(threshold).toBe(15);
    });

    it('should correctly identify increase vs decrease', () => {
      fc.assert(
        fc.property(
          priceArb,
          priceArb,
          (previousPrice, currentPrice) => {
            const changePercent = service.calculatePriceChangePercent(previousPrice, currentPrice);

            // Property: Sign of change should match direction
            if (currentPrice > previousPrice) {
              expect(changePercent).toBeGreaterThan(0);
            } else if (currentPrice < previousPrice) {
              expect(changePercent).toBeLessThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Unit tests for edge cases
  describe('Edge cases', () => {
    it('should handle equal prices', () => {
      const changePercent = service.calculatePriceChangePercent(1000, 1000);
      expect(changePercent).toBe(0);
      expect(service.isPriceChangeSignificant(1000, 1000)).toBe(false);
    });

    it('should handle exactly 15% increase', () => {
      const previousPrice = 1000;
      const currentPrice = 1150; // exactly 15% increase
      expect(service.isPriceChangeSignificant(previousPrice, currentPrice)).toBe(true);
    });

    it('should handle exactly 15% decrease', () => {
      const previousPrice = 1000;
      const currentPrice = 850; // exactly 15% decrease
      expect(service.isPriceChangeSignificant(previousPrice, currentPrice)).toBe(true);
    });

    it('should handle just below 15% threshold', () => {
      const previousPrice = 1000;
      const currentPrice = 1149; // 14.9% increase
      expect(service.isPriceChangeSignificant(previousPrice, currentPrice)).toBe(false);
    });
  });
});

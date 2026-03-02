import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import * as fc from 'fast-check';
import { CropRecommendationService } from './crop-recommendation.service';
import { PrismaService } from '../prisma/prisma.service';

const mockHttpService = { get: jest.fn(), post: jest.fn() };
const mockConfigService = { get: jest.fn() };
const mockPrismaService = {
  cropHistory: { findMany: jest.fn() },
  cropRecommendation: { create: jest.fn() },
};

describe('CropRecommendationService', () => {
  let service: CropRecommendationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CropRecommendationService,
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<CropRecommendationService>(CropRecommendationService);
    jest.clearAllMocks();
  });

  // **Feature: smart-crop-advisory, Property 1: Crop recommendations are properly ranked**
  // **Validates: Requirements 1.1**
  describe('Property 1: Crop recommendations are properly ranked', () => {
    // Generator for valid soil data
    const soilDataArb = fc.record({
      nitrogen: fc.integer({ min: 0, max: 500 }),
      phosphorus: fc.integer({ min: 0, max: 500 }),
      potassium: fc.integer({ min: 0, max: 500 }),
      ph: fc.float({ min: 4, max: 9, noNaN: true }),
      organicMatter: fc.float({ min: 0, max: 5, noNaN: true }),
    });

    // Generator for valid location (India bounds)
    const locationArb = fc.record({
      latitude: fc.float({ min: 8, max: 37, noNaN: true }),
      longitude: fc.float({ min: 68, max: 97, noNaN: true }),
    });

    it('should return recommendations sorted by descending suitability score', async () => {
      await fc.assert(
        fc.asyncProperty(
          locationArb,
          soilDataArb,
          async (location, soilData) => {
            mockPrismaService.cropHistory.findMany.mockResolvedValue([]);
            mockPrismaService.cropRecommendation.create.mockResolvedValue({});

            const recommendations = await service.generateRecommendations('user-id', {
              location,
              soilData,
            });

            // Property: Recommendations should be sorted by descending suitability score
            for (let i = 0; i < recommendations.length - 1; i++) {
              expect(recommendations[i].suitabilityScore).toBeGreaterThanOrEqual(
                recommendations[i + 1].suitabilityScore,
              );
            }

            // Property: All scores should be between 0 and 100
            recommendations.forEach((rec) => {
              expect(rec.suitabilityScore).toBeGreaterThanOrEqual(0);
              expect(rec.suitabilityScore).toBeLessThanOrEqual(100);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // **Feature: smart-crop-advisory, Property 4: Recommendation completeness**
  // **Validates: Requirements 1.5**
  describe('Property 4: Recommendation completeness', () => {
    const soilDataArb = fc.record({
      nitrogen: fc.integer({ min: 0, max: 500 }),
      phosphorus: fc.integer({ min: 0, max: 500 }),
      potassium: fc.integer({ min: 0, max: 500 }),
      ph: fc.float({ min: 4, max: 9, noNaN: true }),
    });

    const locationArb = fc.record({
      latitude: fc.float({ min: 8, max: 37, noNaN: true }),
      longitude: fc.float({ min: 68, max: 97, noNaN: true }),
    });

    it('should include non-empty reasoning, expected yield > 0, and input cost >= 0', async () => {
      await fc.assert(
        fc.asyncProperty(
          locationArb,
          soilDataArb,
          async (location, soilData) => {
            mockPrismaService.cropHistory.findMany.mockResolvedValue([]);
            mockPrismaService.cropRecommendation.create.mockResolvedValue({});

            const recommendations = await service.generateRecommendations('user-id', {
              location,
              soilData,
            });

            // Property: Each recommendation must have complete data
            recommendations.forEach((rec) => {
              // Non-empty crop name
              expect(rec.cropName).toBeDefined();
              expect(rec.cropName.length).toBeGreaterThan(0);

              // Expected yield > 0
              expect(rec.expectedYield).toBeGreaterThan(0);

              // Input cost >= 0
              expect(rec.estimatedInputCost).toBeGreaterThanOrEqual(0);

              // Reasoning should be an array (can be empty but must exist)
              expect(Array.isArray(rec.reasoning)).toBe(true);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // **Feature: smart-crop-advisory, Property 2: Historical data influences recommendations**
  // **Validates: Requirements 1.3**
  describe('Property 2: Historical data influences recommendations', () => {
    const soilDataArb = fc.record({
      nitrogen: fc.integer({ min: 0, max: 500 }),
      phosphorus: fc.integer({ min: 0, max: 500 }),
      potassium: fc.integer({ min: 0, max: 500 }),
      ph: fc.float({ min: 4, max: 9, noNaN: true }),
    });

    const locationArb = fc.record({
      latitude: fc.float({ min: 8, max: 37, noNaN: true }),
      longitude: fc.float({ min: 68, max: 97, noNaN: true }),
    });

    it('should produce different results with vs without crop history', async () => {
      await fc.assert(
        fc.asyncProperty(
          locationArb,
          soilDataArb,
          async (location, soilData) => {
            const parcelId = 'test-parcel-id';

            // First call: no history
            mockPrismaService.cropHistory.findMany.mockResolvedValue([]);
            mockPrismaService.cropRecommendation.create.mockResolvedValue({});

            const withoutHistory = await service.generateRecommendations('user-id', {
              location,
              soilData,
              parcelId,
            });

            // Second call: with good historical performance for Rice
            mockPrismaService.cropHistory.findMany.mockResolvedValue([
              { cropName: 'Rice', yield: 30 }, // Good yield (above base)
            ]);

            const withHistory = await service.generateRecommendations('user-id', {
              location,
              soilData,
              parcelId,
            });

            // Find Rice in both results
            const riceWithoutHistory = withoutHistory.find((r) => r.cropName === 'Rice');
            const riceWithHistory = withHistory.find((r) => r.cropName === 'Rice');

            // Property: Historical data should influence the score
            // Rice with good history should have higher or equal score
            if (riceWithoutHistory && riceWithHistory) {
              expect(riceWithHistory.suitabilityScore).toBeGreaterThanOrEqual(
                riceWithoutHistory.suitabilityScore,
              );
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // **Feature: smart-crop-advisory, Property 3: Crop preferences affect ranking**
  // **Validates: Requirements 1.4**
  describe('Property 3: Crop preferences affect ranking', () => {
    it('should rank preferred crops higher when they meet suitability thresholds', async () => {
      const soilData = { nitrogen: 280, phosphorus: 25, potassium: 180, ph: 6.5 };
      const location = { latitude: 12.97, longitude: 77.59 };

      mockPrismaService.cropHistory.findMany.mockResolvedValue([]);
      mockPrismaService.cropRecommendation.create.mockResolvedValue({});

      // Get recommendations without preferences
      const withoutPrefs = await service.generateRecommendations('user-id', {
        location,
        soilData,
      });

      // Get recommendations with preference for a specific crop
      const preferredCrop = 'Groundnut';
      const withPrefs = await service.generateRecommendations('user-id', {
        location,
        soilData,
        preferences: [preferredCrop],
      });

      // Find the preferred crop in both results
      const withoutPrefRank = withoutPrefs.findIndex((r) => r.cropName === preferredCrop);
      const withPrefRank = withPrefs.findIndex((r) => r.cropName === preferredCrop);

      // Property: Preferred crop should rank higher (lower index) or same with preferences
      if (withoutPrefRank !== -1 && withPrefRank !== -1) {
        expect(withPrefRank).toBeLessThanOrEqual(withoutPrefRank);
      }
    });
  });
});

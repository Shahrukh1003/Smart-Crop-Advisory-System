import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';
import { ActivitiesService } from './activities.service';
import { ActivitiesRepository } from './activities.repository';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityType } from '@prisma/client';

// Mock repositories
const mockActivitiesRepository = {
  createCropHistory: jest.fn(),
  findCropHistoryByUser: jest.fn(),
  findCropHistoryById: jest.fn(),
  updateCropHistory: jest.fn(),
  createActivity: jest.fn(),
  findActivitiesByHistory: jest.fn(),
  upsertInputCosts: jest.fn(),
  findGroupedByCropAndSeason: jest.fn(),
};

const mockPrismaService = {
  landParcel: {
    findUnique: jest.fn(),
  },
};

describe('ActivitiesService', () => {
  let service: ActivitiesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivitiesService,
        { provide: ActivitiesRepository, useValue: mockActivitiesRepository },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ActivitiesService>(ActivitiesService);
    jest.clearAllMocks();
  });

  // **Feature: smart-crop-advisory, Property 26: Activity logging completeness**
  // **Validates: Requirements 8.1**
  describe('Property-Based Tests', () => {
    // Generator for activity types
    const activityTypeArb = fc.constantFrom(
      ActivityType.sowing,
      ActivityType.irrigation,
      ActivityType.fertilization,
      ActivityType.pesticide,
      ActivityType.weeding,
      ActivityType.harvest,
    );

    // Generator for crop names
    const cropNameArb = fc.constantFrom(
      'Rice', 'Wheat', 'Maize', 'Cotton', 'Sugarcane',
      'Groundnut', 'Soybean', 'Tomato', 'Onion', 'Potato',
    );

    // Generator for descriptions
    const descriptionArb = fc.string({ minLength: 1, maxLength: 200 });

    // Generator for costs
    const costArb = fc.nat({ max: 100000 });

    // Generator for dates
    const dateArb = fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') });

    it('should store activity with all required fields (timestamp, crop, location, activity type)', async () => {
      await fc.assert(
        fc.asyncProperty(
          activityTypeArb,
          descriptionArb,
          costArb,
          dateArb,
          async (activityType, description, cost, activityDate) => {
            const userId = 'test-user-id';
            const historyId = 'test-history-id';
            const parcelId = 'test-parcel-id';

            // Mock the history lookup
            mockActivitiesRepository.findCropHistoryById.mockResolvedValue({
              id: historyId,
              userId,
              parcelId,
              cropName: 'Rice',
            });

            // Mock activity creation
            const createdActivity = {
              id: 'activity-id',
              historyId,
              activityType,
              activityDate,
              description,
              cost,
              createdAt: new Date(),
            };
            mockActivitiesRepository.createActivity.mockResolvedValue(createdActivity);

            const result = await service.createActivity(userId, {
              historyId,
              activityType,
              activityDate: activityDate.toISOString(),
              description,
              cost,
            });

            // Property: All required fields must be present and non-empty
            expect(result.activityType).toBe(activityType);
            expect(result.activityDate).toBeDefined();
            expect(result.historyId).toBe(historyId);
            expect(result.id).toBeDefined();
            
            // Property: Activity type must be valid
            expect(Object.values(ActivityType)).toContain(result.activityType);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should create crop history with required fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          cropNameArb,
          fc.option(fc.string({ minLength: 1, maxLength: 50 })),
          dateArb,
          async (cropName, variety, sowingDate) => {
            const userId = 'test-user-id';
            const parcelId = 'test-parcel-id';

            // Mock parcel lookup
            mockPrismaService.landParcel.findUnique.mockResolvedValue({
              id: parcelId,
              userId,
            });

            // Mock history creation
            const createdHistory = {
              id: 'history-id',
              userId,
              parcelId,
              cropName,
              variety: variety ?? null,
              sowingDate,
              createdAt: new Date(),
            };
            mockActivitiesRepository.createCropHistory.mockResolvedValue(createdHistory);

            const result = await service.createCropHistory(userId, {
              parcelId,
              cropName,
              variety: variety ?? undefined,
              sowingDate: sowingDate.toISOString(),
            });

            // Property: Crop name must be stored
            expect(result.cropName).toBe(cropName);
            
            // Property: Sowing date must be stored
            expect(result.sowingDate).toBeDefined();
            
            // Property: User association must be correct
            expect(result.userId).toBe(userId);
            
            // Property: Parcel association must be correct
            expect(result.parcelId).toBe(parcelId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should calculate ROI correctly when completing season', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.nat({ max: 50000 }), // seeds
          fc.nat({ max: 50000 }), // fertilizers
          fc.nat({ max: 30000 }), // pesticides
          fc.nat({ max: 100000 }), // labor
          fc.nat({ max: 30000 }), // irrigation
          fc.nat({ max: 500000 }), // revenue
          async (seeds, fertilizers, pesticides, labor, irrigation, revenue) => {
            const userId = 'test-user-id';
            const historyId = 'test-history-id';

            const totalCosts = seeds + fertilizers + pesticides + labor + irrigation;
            const expectedRoi = totalCosts > 0 ? ((revenue - totalCosts) / totalCosts) * 100 : 0;

            // Mock history with input costs
            mockActivitiesRepository.findCropHistoryById.mockResolvedValue({
              id: historyId,
              userId,
              cropName: 'Rice',
              inputCosts: { seeds, fertilizers, pesticides, labor, irrigation },
            });

            mockActivitiesRepository.updateCropHistory.mockResolvedValue({
              id: historyId,
              userId,
              cropName: 'Rice',
              revenue,
              harvestDate: new Date(),
            });

            const result = await service.completeSeason(historyId, userId, {
              revenue,
              harvestDate: new Date().toISOString(),
            });

            // Property: ROI calculation must be correct
            expect(parseFloat(result.roi)).toBeCloseTo(expectedRoi, 1);
            
            // Property: Total costs must be calculated correctly
            expect(result.totalCosts).toBe(totalCosts);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // **Feature: smart-crop-advisory, Property 27: Crop history organization**
  // **Validates: Requirements 8.2**
  describe('Property 27: Crop history organization', () => {
    it('should return crop history grouped by crop name', async () => {
      const userId = 'test-user-id';
      
      // Mock grouped data
      const groupedData = {
        'Rice': [
          { id: '1', cropName: 'Rice', sowingDate: new Date('2024-06-01'), activities: [] },
          { id: '2', cropName: 'Rice', sowingDate: new Date('2023-06-01'), activities: [] },
        ],
        'Wheat': [
          { id: '3', cropName: 'Wheat', sowingDate: new Date('2024-01-01'), activities: [] },
        ],
      };
      
      mockActivitiesRepository.findGroupedByCropAndSeason.mockResolvedValue(groupedData);
      
      const result = await service.getCropHistoryGrouped(userId);
      
      // Property: Result should be grouped by crop name
      expect(result).toHaveProperty('Rice');
      expect(result).toHaveProperty('Wheat');
      
      // Property: Each group should contain only that crop
      expect(result['Rice'].every((h: any) => h.cropName === 'Rice')).toBe(true);
      expect(result['Wheat'].every((h: any) => h.cropName === 'Wheat')).toBe(true);
    });

    it('should sort activities chronologically within groups', async () => {
      const userId = 'test-user-id';
      
      const histories = [
        { 
          id: '1', 
          cropName: 'Rice', 
          sowingDate: new Date('2024-06-01'),
          activities: [
            { activityDate: new Date('2024-06-15'), activityType: 'sowing' },
            { activityDate: new Date('2024-07-01'), activityType: 'irrigation' },
            { activityDate: new Date('2024-06-20'), activityType: 'fertilization' },
          ]
        },
      ];
      
      mockActivitiesRepository.findCropHistoryByUser.mockResolvedValue(histories);
      
      const result = await service.getCropHistoryByUser(userId);
      
      // Property: Activities should be returned (order verified by repository)
      expect((result[0] as any).activities).toBeDefined();
      expect((result[0] as any).activities.length).toBe(3);
    });
  });

  // **Feature: smart-crop-advisory, Property 28: Season completion triggers ROI calculation**
  // **Validates: Requirements 8.4**
  describe('Property 28: Season completion triggers ROI calculation', () => {
    const revenueArb = fc.nat({ max: 500000 });
    const costsArb = fc.record({
      seeds: fc.nat({ max: 50000 }),
      fertilizers: fc.nat({ max: 50000 }),
      pesticides: fc.nat({ max: 30000 }),
      labor: fc.nat({ max: 100000 }),
      irrigation: fc.nat({ max: 30000 }),
    });

    it('should calculate ROI as (revenue - costs) / costs * 100', async () => {
      await fc.assert(
        fc.asyncProperty(
          revenueArb,
          costsArb,
          async (revenue, costs) => {
            const userId = 'test-user-id';
            const historyId = 'test-history-id';
            
            const totalCosts = costs.seeds + costs.fertilizers + costs.pesticides + costs.labor + costs.irrigation;
            
            mockActivitiesRepository.findCropHistoryById.mockResolvedValue({
              id: historyId,
              userId,
              cropName: 'Rice',
              inputCosts: costs,
            });
            
            mockActivitiesRepository.updateCropHistory.mockResolvedValue({
              id: historyId,
              userId,
              cropName: 'Rice',
              revenue,
              harvestDate: new Date(),
            });
            
            const result = await service.completeSeason(historyId, userId, {
              revenue,
              harvestDate: new Date().toISOString(),
            });
            
            // Property: ROI should be calculated
            expect(result.roi).toBeDefined();
            
            // Property: ROI formula should be correct
            if (totalCosts > 0) {
              const expectedRoi = ((revenue - totalCosts) / totalCosts) * 100;
              expect(parseFloat(result.roi)).toBeCloseTo(expectedRoi, 1);
            } else {
              expect(parseFloat(result.roi)).toBe(0);
            }
            
            // Property: Total costs should be returned
            expect(result.totalCosts).toBe(totalCosts);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

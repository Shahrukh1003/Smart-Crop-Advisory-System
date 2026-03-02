import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrismaService = {
  analyticsEvent: { 
    create: jest.fn(), 
    createMany: jest.fn(),
    findMany: jest.fn(), 
    groupBy: jest.fn() 
  },
  feedback: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
  user: { count: jest.fn() },
};

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    jest.clearAllMocks();
  });

  // **Feature: smart-crop-advisory, Property 32: Interaction logging**
  // **Validates: Requirements 10.1**
  describe('Property 32: Interaction logging', () => {
    const featureArb = fc.constantFrom(
      'crop_advisory', 'pest_detection', 'weather', 'market_price', 'soil_analysis'
    );
    const sessionIdArb = fc.uuid();
    const metadataArb = fc.option(fc.record({ action: fc.string(), value: fc.integer() }));
    const durationArb = fc.option(fc.integer({ min: 0, max: 300000 }));

    it('should log events with feature, timestamp, and session ID', async () => {
      await fc.assert(
        fc.asyncProperty(
          featureArb,
          sessionIdArb,
          metadataArb,
          durationArb,
          async (feature, sessionId, metadata, duration) => {
            const eventTimestamp = new Date();
            mockPrismaService.analyticsEvent.create.mockResolvedValue({
              id: 'event-1',
              feature,
              sessionId,
              eventTimestamp,
              metadata: metadata ?? null,
              duration: duration ?? null,
            });

            const result = await service.logEvent('user-123', { 
              feature, 
              sessionId,
              metadata: metadata ?? undefined,
              duration: duration ?? undefined,
            });

            // Property: Event should be created with all required fields
            expect(mockPrismaService.analyticsEvent.create).toHaveBeenCalledWith({
              data: expect.objectContaining({
                feature,
                sessionId,
              }),
            });

            // Property: Response should include feature, sessionId, and timestamp
            expect(result.feature).toBe(feature);
            expect(result.sessionId).toBe(sessionId);
            expect(result.eventTimestamp).toBeDefined();
            expect(result.id).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should support batch event logging for efficiency', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.record({
            feature: featureArb,
            sessionId: sessionIdArb,
          }), { minLength: 1, maxLength: 10 }),
          async (events) => {
            mockPrismaService.analyticsEvent.createMany.mockResolvedValue({
              count: events.length,
            });

            const result = await service.logEventsBatch('user-123', events);

            // Property: Batch should create all events
            expect(result.count).toBe(events.length);
            expect(mockPrismaService.analyticsEvent.createMany).toHaveBeenCalled();
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  // **Feature: smart-crop-advisory, Property 33: Feedback prompt after interaction**
  // **Validates: Requirements 10.2**
  describe('Property 33: Feedback prompt after interaction', () => {
    it('should prompt for feedback if no recent feedback exists', async () => {
      mockPrismaService.feedback.findFirst.mockResolvedValue(null);

      const shouldPrompt = await service.shouldPromptFeedback('user-123', 'crop_advisory');

      expect(shouldPrompt).toBe(true);
    });

    it('should not prompt if recent feedback exists', async () => {
      mockPrismaService.feedback.findFirst.mockResolvedValue({
        id: 'feedback-1',
        createdAt: new Date(),
      });

      const shouldPrompt = await service.shouldPromptFeedback('user-123', 'crop_advisory');

      expect(shouldPrompt).toBe(false);
    });
  });

  // **Feature: smart-crop-advisory, Property 34: Feedback storage completeness**
  // **Validates: Requirements 10.3**
  describe('Property 34: Feedback storage completeness', () => {
    const ratingArb = fc.integer({ min: 1, max: 5 });
    const commentArb = fc.option(fc.string({ minLength: 1, maxLength: 500 }));
    const featureArb = fc.constantFrom('crop_advisory', 'pest_detection', 'weather');

    it('should store feedback with rating, comment, and context', async () => {
      await fc.assert(
        fc.asyncProperty(
          featureArb,
          ratingArb,
          commentArb,
          async (feature, rating, comment) => {
            const feedbackData = {
              id: 'feedback-1',
              feature,
              rating,
              comment: comment ?? null,
              context: { test: 'data' },
              createdAt: new Date(),
            };
            mockPrismaService.feedback.create.mockResolvedValue(feedbackData);

            const result = await service.submitFeedback('user-123', {
              feature,
              rating,
              comment: comment ?? undefined,
              context: { test: 'data' },
            });

            // Property: Feedback should include rating
            expect(result.rating).toBe(rating);

            // Property: Feedback should include feature
            expect(result.feature).toBe(feature);

            // Property: Feedback should have ID and timestamp
            expect(result.id).toBeDefined();
            expect(result.createdAt).toBeDefined();
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  // **Feature: smart-crop-advisory, Property 35: Usage report completeness**
  // **Validates: Requirements 10.4**
  describe('Property 35: Usage report completeness', () => {
    it('should include adoption rate, feature popularity, and user satisfaction', async () => {
      mockPrismaService.user.count.mockResolvedValue(100);
      mockPrismaService.analyticsEvent.findMany.mockResolvedValue([
        { userId: 'user-1' },
        { userId: 'user-2' },
        { userId: 'user-3' },
      ]);
      mockPrismaService.analyticsEvent.groupBy.mockResolvedValue([
        { feature: 'crop_advisory', _count: { feature: 50 } },
        { feature: 'weather', _count: { feature: 30 } },
      ]);
      mockPrismaService.feedback.groupBy.mockResolvedValue([
        { feature: 'crop_advisory', _avg: { rating: 4.5 } },
        { feature: 'weather', _avg: { rating: 4.0 } },
      ]);

      const report = await service.generateUsageReport(
        new Date('2024-01-01'),
        new Date('2024-01-31'),
      );

      // Property: Report should include adoption rate
      expect(report.adoptionRate).toBeDefined();
      expect(typeof report.adoptionRate).toBe('number');

      // Property: Report should include total and active users
      expect(report.totalUsers).toBe(100);
      expect(report.activeUsers).toBe(3);

      // Property: Report should include feature popularity
      expect(report.featurePopularity).toBeDefined();
      expect(report.featurePopularity['crop_advisory']).toBe(50);

      // Property: Report should include user satisfaction
      expect(report.userSatisfaction).toBeDefined();
      expect(report.userSatisfaction['crop_advisory']).toBe(4.5);

      // Property: Report should include period dates
      expect(report.periodStart).toBeDefined();
      expect(report.periodEnd).toBeDefined();
    });

    it('should calculate adoption rate correctly', async () => {
      mockPrismaService.user.count.mockResolvedValue(200);
      mockPrismaService.analyticsEvent.findMany.mockResolvedValue([
        { userId: 'user-1' },
        { userId: 'user-2' },
      ]);
      mockPrismaService.analyticsEvent.groupBy.mockResolvedValue([]);
      mockPrismaService.feedback.groupBy.mockResolvedValue([]);

      const report = await service.generateUsageReport(new Date(), new Date());

      // Property: Adoption rate = (active users / total users) * 100
      expect(report.adoptionRate).toBe(1); // 2/200 * 100 = 1%
    });
  });
});

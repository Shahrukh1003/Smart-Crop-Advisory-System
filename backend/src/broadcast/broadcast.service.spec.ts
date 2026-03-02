import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';
import { BroadcastService } from './broadcast.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersRepository } from '../users/users.repository';

const mockPrismaService = {
  user: { findUnique: jest.fn(), findMany: jest.fn() },
  broadcast: { create: jest.fn(), findMany: jest.fn() },
  broadcastDelivery: {
    createMany: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
};

const mockUsersRepository = {
  findFarmersInRegion: jest.fn(),
};

describe('BroadcastService', () => {
  let service: BroadcastService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BroadcastService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: UsersRepository, useValue: mockUsersRepository },
      ],
    }).compile();

    service = module.get<BroadcastService>(BroadcastService);
    jest.clearAllMocks();
  });

  // **Feature: smart-crop-advisory, Property 29: Broadcast geographic targeting**
  // **Validates: Requirements 9.1**
  describe('Property 29: Broadcast geographic targeting', () => {
    const districtArb = fc.constantFrom(
      'Bangalore Urban', 'Mysore', 'Hubli', 'Belgaum', 'Davangere'
    );
    const stateArb = fc.constantFrom('Karnataka', 'Tamil Nadu', 'Andhra Pradesh');

    it('should find recipients only within specified region', async () => {
      await fc.assert(
        fc.asyncProperty(
          districtArb,
          stateArb,
          async (district, state) => {
            const targetRegion = { district, state };
            
            // Mock users in region
            const usersInRegion = [
              { id: 'user-1' },
              { id: 'user-2' },
            ];
            mockPrismaService.user.findMany.mockResolvedValue(usersInRegion);
            
            const recipients = await service.findRecipientsInRegion(targetRegion);
            
            // Property: Should return users from the region
            expect(recipients.length).toBe(usersInRegion.length);
            
            // Property: Query should filter by district and state
            expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
              expect.objectContaining({
                where: expect.objectContaining({
                  role: 'farmer',
                  district,
                  state,
                }),
              })
            );
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should create delivery records for all recipients in region', async () => {
      const broadcastId = 'broadcast-123';
      const recipientIds = ['user-1', 'user-2', 'user-3'];
      
      mockPrismaService.broadcastDelivery.createMany.mockResolvedValue({ count: 3 });
      
      await service.createDeliveryRecords(broadcastId, recipientIds);
      
      // Property: Should create delivery for each recipient
      expect(mockPrismaService.broadcastDelivery.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ broadcastId, recipientId: 'user-1' }),
          expect.objectContaining({ broadcastId, recipientId: 'user-2' }),
          expect.objectContaining({ broadcastId, recipientId: 'user-3' }),
        ]),
      });
    });
  });

  // **Feature: smart-crop-advisory, Property 30: Broadcast content type support**
  // **Validates: Requirements 9.2**
  describe('Property 30: Broadcast content type support', () => {
    it('should support text, audio, and image content types', () => {
      const supportedTypes = service.getSupportedContentTypes();
      
      // Property: Should support all required content types
      expect(supportedTypes).toContain('text');
      expect(supportedTypes).toContain('audio');
      expect(supportedTypes).toContain('image');
    });

    it('should validate content with text, audio, and image', async () => {
      const contentVariants = [
        { content: 'Text only', audioUrl: undefined, imageUrl: undefined },
        { content: 'With audio', audioUrl: 'https://example.com/audio.mp3', imageUrl: undefined },
        { content: 'With image', audioUrl: undefined, imageUrl: 'https://example.com/image.jpg' },
        { content: 'All types', audioUrl: 'https://example.com/audio.mp3', imageUrl: 'https://example.com/image.jpg' },
      ];

      for (const variant of contentVariants) {
        const dto = {
          title: 'Test',
          content: variant.content,
          audioUrl: variant.audioUrl,
          imageUrl: variant.imageUrl,
          language: 'en' as const,
          targetRegion: { district: 'Test' },
        };

        // Property: All variants with text content should be valid
        const isValid = service.validateContentTypes(dto);
        expect(isValid).toBe(true);
      }
    });

    it('should require at least text content', () => {
      const dto = {
        title: 'Test',
        content: '',
        language: 'en' as const,
        targetRegion: { district: 'Test' },
      };

      // Property: Empty content should be invalid
      const isValid = service.validateContentTypes(dto);
      expect(isValid).toBe(false);
    });
  });

  // **Feature: smart-crop-advisory, Property 31: Broadcast delivery tracking**
  // **Validates: Requirements 9.3**
  describe('Property 31: Broadcast delivery tracking', () => {
    it('should track delivery status transitions', async () => {
      const broadcastId = 'broadcast-123';
      const userId = 'user-123';

      // Mock existing delivery
      mockPrismaService.broadcastDelivery.findFirst.mockResolvedValue({
        id: 'delivery-1',
        broadcastId,
        recipientId: userId,
        deliveryStatus: 'sent',
        deliveredAt: null,
        readAt: null,
      });

      mockPrismaService.broadcastDelivery.update.mockResolvedValue({
        id: 'delivery-1',
        broadcastId,
        recipientId: userId,
        deliveryStatus: 'delivered',
        deliveredAt: new Date(),
        readAt: null,
      });

      const result = await service.updateDeliveryStatus(broadcastId, userId, 'delivered');

      // Property: Status should be updated
      expect(result.deliveryStatus).toBe('delivered');
      
      // Property: Delivered timestamp should be set
      expect(result.deliveredAt).toBeDefined();
    });

    it('should set read timestamp when marking as read', async () => {
      const broadcastId = 'broadcast-123';
      const userId = 'user-123';

      mockPrismaService.broadcastDelivery.findFirst.mockResolvedValue({
        id: 'delivery-1',
        broadcastId,
        recipientId: userId,
        deliveryStatus: 'delivered',
        deliveredAt: new Date(),
        readAt: null,
      });

      mockPrismaService.broadcastDelivery.update.mockResolvedValue({
        id: 'delivery-1',
        broadcastId,
        recipientId: userId,
        deliveryStatus: 'read',
        deliveredAt: new Date(),
        readAt: new Date(),
      });

      const result = await service.updateDeliveryStatus(broadcastId, userId, 'read');

      // Property: Status should be read
      expect(result.deliveryStatus).toBe('read');
      
      // Property: Read timestamp should be set
      expect(result.readAt).toBeDefined();
    });

    it('should calculate delivery statistics correctly', async () => {
      const broadcastId = 'broadcast-123';

      mockPrismaService.broadcastDelivery.findMany.mockResolvedValue([
        { deliveryStatus: 'sent' },
        { deliveryStatus: 'sent' },
        { deliveryStatus: 'delivered' },
        { deliveryStatus: 'delivered' },
        { deliveryStatus: 'delivered' },
        { deliveryStatus: 'read' },
        { deliveryStatus: 'read' },
      ]);

      const stats = await service.getDeliveryStats(broadcastId);

      // Property: Total should equal sum of all statuses
      expect(stats.total).toBe(7);
      expect(stats.sent).toBe(2);
      expect(stats.delivered).toBe(3);
      expect(stats.read).toBe(2);
      expect(stats.sent + stats.delivered + stats.read).toBe(stats.total);
    });
  });
});

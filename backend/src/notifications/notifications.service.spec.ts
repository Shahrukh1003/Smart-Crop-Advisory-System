import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';
import { NotificationsService } from './notifications.service';
import { NotificationsRepository } from './notifications.repository';
import { FCMClient } from './fcm.client';
import { DevicePlatform, NotificationType, NotificationStatus, NotificationPriority } from './dto/notification.dto';

const mockRepository = {
  createOrUpdateDeviceToken: jest.fn(),
  getDeviceTokensByUserId: jest.fn(),
  getDeviceTokensByUserIds: jest.fn(),
  deactivateDeviceToken: jest.fn(),
  createNotificationLog: jest.fn(),
  createManyNotificationLogs: jest.fn(),
  getNotificationLogsByUserId: jest.fn(),
  markNotificationAsDelivered: jest.fn(),
  markNotificationAsRead: jest.fn(),
  getUnreadNotificationCount: jest.fn(),
};

const mockFCMClient = {
  isInitialized: jest.fn(),
  sendToDevice: jest.fn(),
  sendToMultipleDevices: jest.fn(),
};

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: NotificationsRepository, useValue: mockRepository },
        { provide: FCMClient, useValue: mockFCMClient },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    jest.clearAllMocks();
  });

  // **Feature: project-finalization, Property 14: Device registration stores valid tokens**
  // **Validates: Requirements 5.1**
  describe('Property 14: Device registration stores valid tokens', () => {
    // Arbitraries for generating test data
    const userIdArb = fc.uuid();
    const tokenArb = fc.string({ minLength: 100, maxLength: 200 }).filter(s => s.length > 0);
    const platformArb = fc.constantFrom(DevicePlatform.ANDROID, DevicePlatform.IOS);

    it('should store device token with correct user ID and platform', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArb,
          tokenArb,
          platformArb,
          async (userId, token, platform) => {
            // Mock the repository response
            const mockDeviceToken = {
              id: 'device-token-id',
              userId,
              token,
              platform,
              isActive: true,
              createdAt: new Date(),
              lastUsedAt: new Date(),
            };
            mockRepository.createOrUpdateDeviceToken.mockResolvedValue(mockDeviceToken);

            // Register the device
            const result = await service.registerDevice(userId, { token, platform });

            // Property 1: The stored token should have the correct user ID
            expect(result.userId).toBe(userId);

            // Property 2: The stored token should have the correct platform
            expect(result.platform).toBe(platform);

            // Property 3: The stored token should be active
            expect(result.isActive).toBe(true);

            // Property 4: The repository should be called with correct data
            expect(mockRepository.createOrUpdateDeviceToken).toHaveBeenCalledWith({
              userId,
              token,
              platform,
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle token refresh by updating existing token', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArb,
          tokenArb,
          platformArb,
          async (userId, token, platform) => {
            const now = new Date();
            const mockDeviceToken = {
              id: 'device-token-id',
              userId,
              token,
              platform,
              isActive: true,
              createdAt: new Date(now.getTime() - 86400000), // Created yesterday
              lastUsedAt: now,
            };
            mockRepository.createOrUpdateDeviceToken.mockResolvedValue(mockDeviceToken);

            const result = await service.registerDevice(userId, { token, platform });

            // Property: Token should be returned with updated lastUsedAt
            expect(result.token).toBe(token);
            expect(result.lastUsedAt).toEqual(now);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should return all required fields in device token response', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArb,
          tokenArb,
          platformArb,
          async (userId, token, platform) => {
            const mockDeviceToken = {
              id: 'device-token-id',
              userId,
              token,
              platform,
              isActive: true,
              createdAt: new Date(),
              lastUsedAt: new Date(),
            };
            mockRepository.createOrUpdateDeviceToken.mockResolvedValue(mockDeviceToken);

            const result = await service.registerDevice(userId, { token, platform });

            // Property: Response should contain all required fields
            expect(result).toHaveProperty('id');
            expect(result).toHaveProperty('userId');
            expect(result).toHaveProperty('token');
            expect(result).toHaveProperty('platform');
            expect(result).toHaveProperty('isActive');
            expect(result).toHaveProperty('createdAt');
            expect(result).toHaveProperty('lastUsedAt');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should deactivate token on unregister', async () => {
      await fc.assert(
        fc.asyncProperty(
          tokenArb,
          async (token) => {
            mockRepository.deactivateDeviceToken.mockResolvedValue({ count: 1 });

            await service.unregisterDevice(token);

            // Property: Repository should be called to deactivate the token
            expect(mockRepository.deactivateDeviceToken).toHaveBeenCalledWith(token);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});


describe('WeatherNotificationService', () => {
  // Note: WeatherNotificationService tests are in a separate file
});

// **Feature: project-finalization, Property 15: Weather alerts generate notifications**
// **Validates: Requirements 5.2**
describe('Property 15: Weather alerts generate notifications', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: NotificationsRepository, useValue: mockRepository },
        { provide: FCMClient, useValue: mockFCMClient },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    jest.clearAllMocks();
  });

  // Arbitraries for weather alert data
  const alertTypeArb = fc.constantFrom('heavy_rain', 'heat_wave', 'frost', 'storm');
  const severityArb = fc.constantFrom('low', 'medium', 'high');
  const userIdArb = fc.uuid();
  const userIdsArb = fc.array(fc.uuid(), { minLength: 1, maxLength: 10 });

  it('should send notifications to all farmers in affected region', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdsArb,
        alertTypeArb,
        severityArb,
        async (userIds, alertType, severity) => {
          // Mock device tokens for users
          const deviceTokens = userIds.map((userId, index) => ({
            userId,
            token: `token-${index}`,
            platform: 'android',
            isActive: true,
          }));
          mockRepository.getDeviceTokensByUserIds.mockResolvedValue(deviceTokens);
          mockRepository.createManyNotificationLogs.mockResolvedValue({ count: userIds.length });
          mockFCMClient.sendToMultipleDevices.mockResolvedValue({
            successCount: userIds.length,
            failureCount: 0,
            results: deviceTokens.map(() => ({ success: true, messageId: 'msg-id' })),
          });

          const result = await service.sendNotificationToMultipleUsers(
            userIds,
            `Weather Alert: ${alertType}`,
            `Severity: ${severity}`,
            NotificationType.WEATHER_ALERT,
            { alertType, severity },
          );

          // Property 1: All users should receive notifications
          expect(result.totalUsers).toBe(userIds.length);

          // Property 2: Success count should match users with tokens
          expect(result.successCount).toBe(userIds.length);

          // Property 3: FCM should be called with all tokens
          expect(mockFCMClient.sendToMultipleDevices).toHaveBeenCalledWith(
            expect.arrayContaining(deviceTokens.map(dt => dt.token)),
            expect.objectContaining({
              title: expect.stringContaining(alertType),
              body: expect.stringContaining(severity),
            }),
          );
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should create notification logs for weather alerts', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdsArb,
        alertTypeArb,
        async (userIds, alertType) => {
          const deviceTokens = userIds.map((userId, index) => ({
            userId,
            token: `token-${index}`,
            platform: 'android',
            isActive: true,
          }));
          mockRepository.getDeviceTokensByUserIds.mockResolvedValue(deviceTokens);
          mockRepository.createManyNotificationLogs.mockResolvedValue({ count: userIds.length });
          mockFCMClient.sendToMultipleDevices.mockResolvedValue({
            successCount: userIds.length,
            failureCount: 0,
            results: deviceTokens.map(() => ({ success: true })),
          });

          await service.sendNotificationToMultipleUsers(
            userIds,
            `Weather Alert: ${alertType}`,
            'Alert description',
            NotificationType.WEATHER_ALERT,
          );

          // Property: Notification logs should be created for all users
          expect(mockRepository.createManyNotificationLogs).toHaveBeenCalledWith(
            expect.arrayContaining(
              userIds.map(userId =>
                expect.objectContaining({
                  userId,
                  type: NotificationType.WEATHER_ALERT,
                })
              )
            )
          );
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle high severity alerts with high priority', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArb,
        alertTypeArb,
        async (userId, alertType) => {
          const deviceToken = {
            userId,
            token: 'test-token',
            platform: 'android',
            isActive: true,
          };
          mockRepository.getDeviceTokensByUserId.mockResolvedValue([deviceToken]);
          mockRepository.createNotificationLog.mockResolvedValue({
            id: 'log-id',
            userId,
            type: NotificationType.WEATHER_ALERT,
            title: 'Alert',
            body: 'Description',
            status: NotificationStatus.SENT,
            sentAt: new Date(),
          });
          mockFCMClient.sendToMultipleDevices.mockResolvedValue({
            successCount: 1,
            failureCount: 0,
            results: [{ success: true, messageId: 'msg-id' }],
          });

          await service.sendNotificationToUser({
            userId,
            title: `Weather Alert: ${alertType}`,
            body: 'High severity alert',
            type: NotificationType.WEATHER_ALERT,
            priority: NotificationPriority.HIGH,
          });

          // Property: High priority should be passed to FCM
          expect(mockFCMClient.sendToMultipleDevices).toHaveBeenCalledWith(
            [deviceToken.token],
            expect.objectContaining({
              priority: NotificationPriority.HIGH,
            }),
          );
        }
      ),
      { numRuns: 50 }
    );
  });
});


// **Feature: project-finalization, Property 16: Broadcast notifications reach targeted farmers**
// **Validates: Requirements 5.3**
describe('Property 16: Broadcast notifications reach targeted farmers', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: NotificationsRepository, useValue: mockRepository },
        { provide: FCMClient, useValue: mockFCMClient },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    jest.clearAllMocks();
  });

  // Arbitraries for broadcast data
  const userIdsArb = fc.array(fc.uuid(), { minLength: 1, maxLength: 20 });
  const broadcastTitleArb = fc.string({ minLength: 1, maxLength: 100 });
  const broadcastContentArb = fc.string({ minLength: 1, maxLength: 500 });
  const languageArb = fc.constantFrom('en', 'hi', 'kn', 'ta', 'te');

  it('should send broadcast notifications to all targeted farmers', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdsArb,
        broadcastTitleArb,
        broadcastContentArb,
        languageArb,
        async (userIds, title, content, language) => {
          // Mock device tokens for users
          const deviceTokens = userIds.map((userId, index) => ({
            userId,
            token: `token-${index}`,
            platform: 'android',
            isActive: true,
          }));
          mockRepository.getDeviceTokensByUserIds.mockResolvedValue(deviceTokens);
          mockRepository.createManyNotificationLogs.mockResolvedValue({ count: userIds.length });
          mockFCMClient.sendToMultipleDevices.mockResolvedValue({
            successCount: userIds.length,
            failureCount: 0,
            results: deviceTokens.map(() => ({ success: true, messageId: 'msg-id' })),
          });

          const result = await service.sendNotificationToMultipleUsers(
            userIds,
            title,
            content,
            NotificationType.BROADCAST,
            { language, broadcastId: 'broadcast-123' },
          );

          // Property 1: Total users should match input
          expect(result.totalUsers).toBe(userIds.length);

          // Property 2: All users with tokens should be notified
          expect(result.successCount).toBe(userIds.length);

          // Property 3: FCM should be called with correct notification type
          expect(mockFCMClient.sendToMultipleDevices).toHaveBeenCalledWith(
            expect.any(Array),
            expect.objectContaining({
              title,
              body: content,
              data: expect.objectContaining({
                language,
                broadcastId: 'broadcast-123',
              }),
            }),
          );
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle farmers without device tokens gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdsArb,
        broadcastTitleArb,
        async (userIds, title) => {
          // Mock no device tokens (farmers without registered devices)
          mockRepository.getDeviceTokensByUserIds.mockResolvedValue([]);
          mockRepository.createManyNotificationLogs.mockResolvedValue({ count: userIds.length });
          mockFCMClient.sendToMultipleDevices.mockResolvedValue({
            successCount: 0,
            failureCount: 0,
            results: [],
          });

          const result = await service.sendNotificationToMultipleUsers(
            userIds,
            title,
            'Broadcast content',
            NotificationType.BROADCAST,
          );

          // Property: Should still track all users even without tokens
          expect(result.totalUsers).toBe(userIds.length);

          // Property: Failure count should reflect users without tokens
          expect(result.failureCount).toBe(userIds.length);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should create notification logs for all broadcast recipients', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdsArb,
        broadcastTitleArb,
        broadcastContentArb,
        async (userIds, title, content) => {
          const deviceTokens = userIds.map((userId, index) => ({
            userId,
            token: `token-${index}`,
            platform: 'android',
            isActive: true,
          }));
          mockRepository.getDeviceTokensByUserIds.mockResolvedValue(deviceTokens);
          mockRepository.createManyNotificationLogs.mockResolvedValue({ count: userIds.length });
          mockFCMClient.sendToMultipleDevices.mockResolvedValue({
            successCount: userIds.length,
            failureCount: 0,
            results: deviceTokens.map(() => ({ success: true })),
          });

          await service.sendNotificationToMultipleUsers(
            userIds,
            title,
            content,
            NotificationType.BROADCAST,
          );

          // Property: Notification logs should be created for all recipients
          expect(mockRepository.createManyNotificationLogs).toHaveBeenCalledWith(
            expect.arrayContaining(
              userIds.map(userId =>
                expect.objectContaining({
                  userId,
                  type: NotificationType.BROADCAST,
                  title,
                  body: content,
                })
              )
            )
          );
        }
      ),
      { numRuns: 50 }
    );
  });
});


// **Feature: project-finalization, Property 17: Notification delivery status is tracked**
// **Validates: Requirements 5.4**
describe('Property 17: Notification delivery status is tracked', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: NotificationsRepository, useValue: mockRepository },
        { provide: FCMClient, useValue: mockFCMClient },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    jest.clearAllMocks();
  });

  // Arbitraries for notification data
  const notificationIdArb = fc.uuid();
  const userIdArb = fc.uuid();
  const titleArb = fc.string({ minLength: 1, maxLength: 100 });
  const bodyArb = fc.string({ minLength: 1, maxLength: 500 });

  it('should track notification status from sent to delivered', async () => {
    await fc.assert(
      fc.asyncProperty(
        notificationIdArb,
        userIdArb,
        titleArb,
        bodyArb,
        async (notificationId, userId, title, body) => {
          const sentAt = new Date();
          const deliveredAt = new Date(sentAt.getTime() + 1000);

          // Mock the notification log after marking as delivered
          mockRepository.markNotificationAsDelivered.mockResolvedValue({
            id: notificationId,
            userId,
            type: NotificationType.BROADCAST,
            title,
            body,
            status: NotificationStatus.DELIVERED,
            sentAt,
            deliveredAt,
            readAt: null,
          });

          const result = await service.markNotificationAsDelivered(notificationId);

          // Property 1: Status should be DELIVERED
          expect(result.status).toBe(NotificationStatus.DELIVERED);

          // Property 2: deliveredAt should be set
          expect(result.deliveredAt).toBeDefined();

          // Property 3: Repository should be called with correct ID
          expect(mockRepository.markNotificationAsDelivered).toHaveBeenCalledWith(notificationId);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should track notification status from delivered to read', async () => {
    await fc.assert(
      fc.asyncProperty(
        notificationIdArb,
        userIdArb,
        titleArb,
        bodyArb,
        async (notificationId, userId, title, body) => {
          const sentAt = new Date();
          const deliveredAt = new Date(sentAt.getTime() + 1000);
          const readAt = new Date(deliveredAt.getTime() + 5000);

          // Mock the notification log after marking as read
          mockRepository.markNotificationAsRead.mockResolvedValue({
            id: notificationId,
            userId,
            type: NotificationType.WEATHER_ALERT,
            title,
            body,
            status: NotificationStatus.READ,
            sentAt,
            deliveredAt,
            readAt,
          });

          const result = await service.markNotificationAsRead(notificationId);

          // Property 1: Status should be READ
          expect(result.status).toBe(NotificationStatus.READ);

          // Property 2: readAt should be set
          expect(result.readAt).toBeDefined();

          // Property 3: deliveredAt should also be set (can't read without delivery)
          expect(result.deliveredAt).toBeDefined();

          // Property 4: Repository should be called with correct ID
          expect(mockRepository.markNotificationAsRead).toHaveBeenCalledWith(notificationId);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should create notification log with initial status when sending', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArb,
        titleArb,
        bodyArb,
        async (userId, title, body) => {
          const deviceToken = {
            userId,
            token: 'test-token',
            platform: 'android',
            isActive: true,
          };
          mockRepository.getDeviceTokensByUserId.mockResolvedValue([deviceToken]);
          mockRepository.createNotificationLog.mockResolvedValue({
            id: 'log-id',
            userId,
            type: NotificationType.BROADCAST,
            title,
            body,
            status: NotificationStatus.SENT,
            sentAt: new Date(),
            deliveredAt: null,
            readAt: null,
          });
          mockFCMClient.sendToMultipleDevices.mockResolvedValue({
            successCount: 1,
            failureCount: 0,
            results: [{ success: true, messageId: 'msg-id' }],
          });

          const result = await service.sendNotificationToUser({
            userId,
            title,
            body,
            type: NotificationType.BROADCAST,
          });

          // Property 1: Initial status should be SENT
          expect(result.status).toBe(NotificationStatus.SENT);

          // Property 2: sentAt should be set
          expect(result.sentAt).toBeDefined();

          // Property 3: deliveredAt and readAt should not be set initially
          expect(result.deliveredAt).toBeUndefined();
          expect(result.readAt).toBeUndefined();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should track failed notifications when no device tokens exist', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArb,
        titleArb,
        bodyArb,
        async (userId, title, body) => {
          // Mock no device tokens
          mockRepository.getDeviceTokensByUserId.mockResolvedValue([]);
          mockRepository.createNotificationLog.mockResolvedValue({
            id: 'log-id',
            userId,
            type: NotificationType.BROADCAST,
            title,
            body,
            status: NotificationStatus.FAILED,
            sentAt: new Date(),
            deliveredAt: null,
            readAt: null,
          });

          const result = await service.sendNotificationToUser({
            userId,
            title,
            body,
            type: NotificationType.BROADCAST,
          });

          // Property: Status should be FAILED when no tokens exist
          expect(result.status).toBe(NotificationStatus.FAILED);

          // Property: Notification log should still be created
          expect(mockRepository.createNotificationLog).toHaveBeenCalledWith(
            expect.objectContaining({
              userId,
              status: NotificationStatus.FAILED,
              errorMessage: 'No device tokens registered',
            })
          );
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should return unread notification count', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArb,
        fc.integer({ min: 0, max: 100 }),
        async (userId, unreadCount) => {
          mockRepository.getUnreadNotificationCount.mockResolvedValue(unreadCount);

          const result = await service.getUnreadCount(userId);

          // Property: Should return the correct unread count
          expect(result).toBe(unreadCount);

          // Property: Repository should be called with correct user ID
          expect(mockRepository.getUnreadNotificationCount).toHaveBeenCalledWith(userId);
        }
      ),
      { numRuns: 50 }
    );
  });
});

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { FCMClient, FCMNotification } from './fcm.client';
import { NotificationsRepository, CreateNotificationLogData } from './notifications.repository';
import {
  RegisterDeviceDto,
  DeviceTokenResponseDto,
  NotificationLogResponseDto,
  NotificationType,
  NotificationStatus,
  NotificationPriority,
  DevicePlatform,
} from './dto/notification.dto';

export interface SendNotificationOptions {
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  data?: Record<string, string>;
  priority?: NotificationPriority;
}

export interface BulkNotificationResult {
  totalUsers: number;
  successCount: number;
  failureCount: number;
  notificationLogs: string[];
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly fcmClient: FCMClient,
    private readonly repository: NotificationsRepository,
  ) {}

  // Device Token Management
  async registerDevice(userId: string, dto: RegisterDeviceDto): Promise<DeviceTokenResponseDto> {
    this.logger.log(`Registering device for user ${userId}, platform: ${dto.platform}`);

    const deviceToken: any = await this.repository.createOrUpdateDeviceToken({
      userId,
      token: dto.token,
      platform: dto.platform,
    });

    return {
      id: deviceToken.id,
      userId: deviceToken.userId,
      token: deviceToken.token,
      platform: deviceToken.platform as DevicePlatform,
      isActive: deviceToken.isActive,
      createdAt: deviceToken.createdAt,
      lastUsedAt: deviceToken.lastUsedAt,
    };
  }

  async unregisterDevice(token: string): Promise<void> {
    await this.repository.deactivateDeviceToken(token);
    this.logger.log(`Device token deactivated: ${token.substring(0, 20)}...`);
  }

  async getUserDeviceTokens(userId: string): Promise<DeviceTokenResponseDto[]> {
    const tokens: any[] = await this.repository.getDeviceTokensByUserId(userId);
    return tokens.map((t: any) => ({
      id: t.id,
      userId: t.userId,
      token: t.token,
      platform: t.platform as DevicePlatform,
      isActive: t.isActive,
      createdAt: t.createdAt,
      lastUsedAt: t.lastUsedAt,
    }));
  }

  // Send Notifications
  async sendNotificationToUser(options: SendNotificationOptions): Promise<NotificationLogResponseDto> {
    const { userId, title, body, type, data, priority } = options;

    // Get user's device tokens
    const deviceTokens: any[] = await this.repository.getDeviceTokensByUserId(userId);

    if (deviceTokens.length === 0) {
      this.logger.warn(`No device tokens found for user ${userId}`);
      // Still create a log entry
      const log = await this.repository.createNotificationLog({
        userId,
        type,
        title,
        body,
        data,
        status: NotificationStatus.FAILED,
        errorMessage: 'No device tokens registered',
      });
      return this.mapNotificationLog(log);
    }

    const notification: FCMNotification = {
      title,
      body,
      data,
      priority: priority || NotificationPriority.NORMAL,
    };

    // Send to all user's devices
    const tokens = deviceTokens.map((dt: any) => dt.token);
    const result = await this.fcmClient.sendToMultipleDevices(tokens, notification);

    // Create notification log
    const status = result.successCount > 0 ? NotificationStatus.SENT : NotificationStatus.FAILED;
    const log = await this.repository.createNotificationLog({
      userId,
      type,
      title,
      body,
      data,
      status,
      fcmMessageId: result.results.find(r => r.messageId)?.messageId,
      errorMessage: result.failureCount > 0 ? `${result.failureCount} devices failed` : undefined,
    });

    // Deactivate invalid tokens
    for (let i = 0; i < result.results.length; i++) {
      if (!result.results[i].success && result.results[i].error?.includes('not registered')) {
        await this.repository.deactivateDeviceToken(tokens[i]);
      }
    }

    this.logger.log(
      `Notification sent to user ${userId}: ${result.successCount} success, ${result.failureCount} failed`,
    );

    return this.mapNotificationLog(log);
  }

  async sendNotificationToMultipleUsers(
    userIds: string[],
    title: string,
    body: string,
    type: NotificationType,
    data?: Record<string, string>,
    priority?: NotificationPriority,
  ): Promise<BulkNotificationResult> {
    if (userIds.length === 0) {
      return { totalUsers: 0, successCount: 0, failureCount: 0, notificationLogs: [] };
    }

    // Get all device tokens for the users
    const deviceTokens: any[] = await this.repository.getDeviceTokensByUserIds(userIds);

    // Group tokens by user
    const tokensByUser = new Map<string, string[]>();
    for (const dt of deviceTokens) {
      const tokens = tokensByUser.get(dt.userId) || [];
      tokens.push(dt.token);
      tokensByUser.set(dt.userId, tokens);
    }

    const notification: FCMNotification = {
      title,
      body,
      data,
      priority: priority || NotificationPriority.NORMAL,
    };

    // Send to all tokens
    const allTokens = deviceTokens.map((dt: any) => dt.token);
    let fcmResult = { successCount: 0, failureCount: 0, results: [] as any[] };
    
    if (allTokens.length > 0) {
      fcmResult = await this.fcmClient.sendToMultipleDevices(allTokens, notification);
    }

    // Create notification logs for all users
    const logs: CreateNotificationLogData[] = userIds.map(userId => {
      const userTokens = tokensByUser.get(userId) || [];
      const hasTokens = userTokens.length > 0;
      
      return {
        userId,
        type,
        title,
        body,
        data,
        status: hasTokens ? NotificationStatus.SENT : NotificationStatus.FAILED,
        errorMessage: hasTokens ? undefined : 'No device tokens registered',
      };
    });

    await this.repository.createManyNotificationLogs(logs);

    // Count users with successful delivery
    const usersWithTokens = new Set(deviceTokens.map(dt => dt.userId));
    const successCount = usersWithTokens.size;
    const failureCount = userIds.length - successCount;

    this.logger.log(
      `Bulk notification sent to ${userIds.length} users: ${successCount} with tokens, ${failureCount} without`,
    );

    return {
      totalUsers: userIds.length,
      successCount,
      failureCount,
      notificationLogs: [], // We don't return individual log IDs for bulk operations
    };
  }

  // Notification Log Management
  async getUserNotifications(userId: string, limit = 50): Promise<NotificationLogResponseDto[]> {
    const logs: any[] = await this.repository.getNotificationLogsByUserId(userId, limit);
    return logs.map((log: any) => this.mapNotificationLog(log));
  }

  async markNotificationAsDelivered(notificationId: string): Promise<NotificationLogResponseDto> {
    const log = await this.repository.markNotificationAsDelivered(notificationId);
    if (!log) {
      throw new NotFoundException('Notification not found');
    }
    return this.mapNotificationLog(log);
  }

  async markNotificationAsRead(notificationId: string): Promise<NotificationLogResponseDto> {
    const log = await this.repository.markNotificationAsRead(notificationId);
    if (!log) {
      throw new NotFoundException('Notification not found');
    }
    return this.mapNotificationLog(log);
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.repository.getUnreadNotificationCount(userId);
  }

  // Helper method to check if FCM is available
  isFCMAvailable(): boolean {
    return this.fcmClient.isInitialized();
  }

  private mapNotificationLog(log: any): NotificationLogResponseDto {
    return {
      id: log.id,
      userId: log.userId,
      type: log.type as NotificationType,
      title: log.title,
      body: log.body,
      status: log.status as NotificationStatus,
      sentAt: log.sentAt,
      deliveredAt: log.deliveredAt || undefined,
      readAt: log.readAt || undefined,
    };
  }

  // Count users with successful delivery
  async countUsersWithTokens(deviceTokens: any[]): Promise<number> {
    const usersWithTokens = new Set(deviceTokens.map((dt: any) => dt.userId));
    return usersWithTokens.size;
  }
}

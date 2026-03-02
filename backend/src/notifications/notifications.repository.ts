import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DevicePlatform, NotificationType, NotificationStatus } from './dto/notification.dto';

export interface CreateDeviceTokenData {
  userId: string;
  token: string;
  platform: DevicePlatform;
}

export interface CreateNotificationLogData {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
  fcmMessageId?: string;
  status?: NotificationStatus;
  errorMessage?: string;
}

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Device Token Operations
  async createOrUpdateDeviceToken(data: CreateDeviceTokenData) {
    return (this.prisma as any).deviceToken.upsert({
      where: { token: data.token },
      update: {
        userId: data.userId,
        platform: data.platform,
        isActive: true,
        lastUsedAt: new Date(),
      },
      create: {
        userId: data.userId,
        token: data.token,
        platform: data.platform,
        isActive: true,
      },
    });
  }

  async getDeviceTokensByUserId(userId: string) {
    return (this.prisma as any).deviceToken.findMany({
      where: { userId, isActive: true },
    });
  }

  async getDeviceTokensByUserIds(userIds: string[]) {
    return (this.prisma as any).deviceToken.findMany({
      where: { userId: { in: userIds }, isActive: true },
    });
  }

  async getActiveDeviceToken(token: string) {
    return (this.prisma as any).deviceToken.findFirst({
      where: { token, isActive: true },
    });
  }

  async deactivateDeviceToken(token: string) {
    return (this.prisma as any).deviceToken.updateMany({
      where: { token },
      data: { isActive: false },
    });
  }

  async deactivateUserDeviceTokens(userId: string) {
    return (this.prisma as any).deviceToken.updateMany({
      where: { userId },
      data: { isActive: false },
    });
  }

  async updateTokenLastUsed(token: string) {
    return (this.prisma as any).deviceToken.updateMany({
      where: { token },
      data: { lastUsedAt: new Date() },
    });
  }

  // Notification Log Operations
  async createNotificationLog(data: CreateNotificationLogData) {
    return (this.prisma as any).notificationLog.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        body: data.body,
        data: data.data || null,
        status: data.status || NotificationStatus.PENDING,
        fcmMessageId: data.fcmMessageId,
        errorMessage: data.errorMessage,
      },
    });
  }

  async createManyNotificationLogs(logs: CreateNotificationLogData[]) {
    return (this.prisma as any).notificationLog.createMany({
      data: logs.map((log: CreateNotificationLogData) => ({
        userId: log.userId,
        type: log.type,
        title: log.title,
        body: log.body,
        data: log.data || null,
        status: log.status || NotificationStatus.PENDING,
        fcmMessageId: log.fcmMessageId,
        errorMessage: log.errorMessage,
      })),
    });
  }

  async getNotificationLogById(id: string) {
    return (this.prisma as any).notificationLog.findUnique({
      where: { id },
    });
  }

  async getNotificationLogsByUserId(userId: string, limit = 50) {
    return (this.prisma as any).notificationLog.findMany({
      where: { userId },
      orderBy: { sentAt: 'desc' },
      take: limit,
    });
  }

  async updateNotificationStatus(
    id: string,
    status: NotificationStatus,
    additionalData?: { deliveredAt?: Date; readAt?: Date; fcmMessageId?: string; errorMessage?: string },
  ) {
    return (this.prisma as any).notificationLog.update({
      where: { id },
      data: {
        status: status,
        ...additionalData,
      },
    });
  }

  async markNotificationAsDelivered(id: string) {
    return this.updateNotificationStatus(id, NotificationStatus.DELIVERED, {
      deliveredAt: new Date(),
    });
  }

  async markNotificationAsRead(id: string) {
    const notification = await this.getNotificationLogById(id);
    return this.updateNotificationStatus(id, NotificationStatus.READ, {
      readAt: new Date(),
      deliveredAt: notification?.deliveredAt || new Date(),
    });
  }

  async getUnreadNotificationCount(userId: string) {
    return (this.prisma as any).notificationLog.count({
      where: {
        userId,
        status: { not: 'read' },
      },
    });
  }

  async getNotificationStats(userId: string) {
    const prisma = this.prisma as any;
    const [total, unread, delivered] = await Promise.all([
      prisma.notificationLog.count({ where: { userId } }),
      prisma.notificationLog.count({
        where: { userId, status: { not: 'read' } },
      }),
      prisma.notificationLog.count({
        where: { userId, status: 'delivered' },
      }),
    ]);

    return { total, unread, delivered };
  }
}

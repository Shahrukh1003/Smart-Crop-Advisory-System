import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { NotificationType, NotificationPriority } from './dto/notification.dto';

export interface BroadcastData {
  id: string;
  title: string;
  content: string;
  language: string;
  priority?: 'low' | 'medium' | 'high';
}

export interface TargetRegion {
  district?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
}

@Injectable()
export class BroadcastNotificationService {
  private readonly logger = new Logger(BroadcastNotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Send broadcast notifications to geographically targeted farmers
   */
  async sendBroadcastNotifications(
    broadcast: BroadcastData,
    targetRegion: TargetRegion,
  ): Promise<{ notifiedCount: number; failedCount: number; deliveryRecords: string[] }> {
    this.logger.log(`Sending broadcast notifications for broadcast ${broadcast.id}`);

    // Find farmers in the target region
    const targetedFarmers = await this.findFarmersInTargetRegion(targetRegion);

    if (targetedFarmers.length === 0) {
      this.logger.warn('No farmers found in target region');
      return { notifiedCount: 0, failedCount: 0, deliveryRecords: [] };
    }

    const userIds = targetedFarmers.map(f => f.id);

    // Determine notification priority
    const priority = this.mapPriority(broadcast.priority);

    // Send notifications to all targeted farmers
    const result = await this.notificationsService.sendNotificationToMultipleUsers(
      userIds,
      broadcast.title,
      broadcast.content,
      NotificationType.BROADCAST,
      {
        broadcastId: broadcast.id,
        language: broadcast.language,
      },
      priority,
    );

    // Update delivery records in the database
    await this.updateDeliveryRecords(broadcast.id, userIds);

    this.logger.log(
      `Broadcast notifications sent: ${result.successCount} success, ${result.failureCount} failed`,
    );

    return {
      notifiedCount: result.successCount,
      failedCount: result.failureCount,
      deliveryRecords: userIds,
    };
  }

  /**
   * Find farmers in the target region
   */
  async findFarmersInTargetRegion(targetRegion: TargetRegion): Promise<{ id: string }[]> {
    const where: any = { role: 'farmer' };

    // Filter by district if specified
    if (targetRegion.district) {
      where.district = targetRegion.district;
    }

    // Filter by state if specified
    if (targetRegion.state) {
      where.state = targetRegion.state;
    }

    const farmers = await (this.prisma as any).user.findMany({
      where,
      select: { id: true, latitude: true, longitude: true },
    });

    // If coordinate-based targeting is specified, filter by distance
    if (targetRegion.latitude && targetRegion.longitude && targetRegion.radiusKm) {
      return farmers.filter((farmer: any) => {
        if (!farmer.latitude || !farmer.longitude) return false;
        
        const distance = this.calculateDistance(
          targetRegion.latitude!,
          targetRegion.longitude!,
          parseFloat(farmer.latitude),
          parseFloat(farmer.longitude),
        );
        return distance <= targetRegion.radiusKm!;
      }).map((f: any) => ({ id: f.id }));
    }

    return farmers.map((f: any) => ({ id: f.id }));
  }

  /**
   * Update delivery records to mark notifications as sent
   */
  private async updateDeliveryRecords(broadcastId: string, userIds: string[]): Promise<void> {
    try {
      await (this.prisma as any).broadcastDelivery.updateMany({
        where: {
          broadcastId,
          recipientId: { in: userIds },
        },
        data: {
          deliveryStatus: 'sent',
        },
      });
    } catch (error) {
      this.logger.error(`Failed to update delivery records: ${error}`);
    }
  }

  /**
   * Map priority string to NotificationPriority enum
   */
  private mapPriority(priority?: 'low' | 'medium' | 'high'): NotificationPriority {
    if (priority === 'high') {
      return NotificationPriority.HIGH;
    }
    return NotificationPriority.NORMAL;
  }

  /**
   * Calculate distance between two points using Haversine formula
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}

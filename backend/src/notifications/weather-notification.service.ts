import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService, SendNotificationOptions } from './notifications.service';
import { NotificationType, NotificationPriority } from './dto/notification.dto';

export interface WeatherAlert {
  alertType: 'heavy_rain' | 'heat_wave' | 'frost' | 'storm';
  severity: 'low' | 'medium' | 'high';
  startTime: string;
  endTime: string;
  description: string;
}

export interface GeographicRegion {
  latitude: number;
  longitude: number;
  radiusKm: number;
}

@Injectable()
export class WeatherNotificationService {
  private readonly logger = new Logger(WeatherNotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Send weather alert notifications to farmers in affected region
   */
  async sendWeatherAlertNotifications(
    alert: WeatherAlert,
    region: GeographicRegion,
  ): Promise<{ notifiedCount: number; failedCount: number }> {
    this.logger.log(`Sending weather alert notifications for ${alert.alertType} in region`);

    // Find farmers in the affected region
    const affectedFarmers = await this.findFarmersInRegion(region);

    if (affectedFarmers.length === 0) {
      this.logger.warn('No farmers found in affected region');
      return { notifiedCount: 0, failedCount: 0 };
    }

    const userIds = affectedFarmers.map(f => f.id);

    // Create notification content based on alert type
    const { title, body } = this.createAlertNotificationContent(alert);

    // Send notifications to all affected farmers
    const result = await this.notificationsService.sendNotificationToMultipleUsers(
      userIds,
      title,
      body,
      NotificationType.WEATHER_ALERT,
      {
        alertType: alert.alertType,
        severity: alert.severity,
        startTime: alert.startTime,
        endTime: alert.endTime,
      },
      alert.severity === 'high' ? NotificationPriority.HIGH : NotificationPriority.NORMAL,
    );

    this.logger.log(
      `Weather alert notifications sent: ${result.successCount} success, ${result.failureCount} failed`,
    );

    return {
      notifiedCount: result.successCount,
      failedCount: result.failureCount,
    };
  }

  /**
   * Send weather alert to a specific user
   */
  async sendWeatherAlertToUser(
    userId: string,
    alert: WeatherAlert,
  ): Promise<void> {
    const { title, body } = this.createAlertNotificationContent(alert);

    await this.notificationsService.sendNotificationToUser({
      userId,
      title,
      body,
      type: NotificationType.WEATHER_ALERT,
      data: {
        alertType: alert.alertType,
        severity: alert.severity,
        startTime: alert.startTime,
        endTime: alert.endTime,
      },
      priority: alert.severity === 'high' ? NotificationPriority.HIGH : NotificationPriority.NORMAL,
    });
  }

  /**
   * Find farmers within a geographic region using Haversine formula
   */
  async findFarmersInRegion(region: GeographicRegion): Promise<{ id: string; latitude: number; longitude: number }[]> {
    // Get all farmers with location data
    const farmers = await (this.prisma as any).user.findMany({
      where: {
        role: 'farmer',
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        id: true,
        latitude: true,
        longitude: true,
      },
    });

    // Filter farmers within the radius using Haversine formula
    return farmers.filter((farmer: any) => {
      const distance = this.calculateDistance(
        region.latitude,
        region.longitude,
        parseFloat(farmer.latitude),
        parseFloat(farmer.longitude),
      );
      return distance <= region.radiusKm;
    }).map((farmer: any) => ({
      id: farmer.id,
      latitude: parseFloat(farmer.latitude),
      longitude: parseFloat(farmer.longitude),
    }));
  }

  /**
   * Create notification content based on alert type
   */
  private createAlertNotificationContent(alert: WeatherAlert): { title: string; body: string } {
    const alertTitles: Record<string, string> = {
      heavy_rain: '🌧️ Heavy Rain Alert',
      heat_wave: '🌡️ Heat Wave Warning',
      frost: '❄️ Frost Alert',
      storm: '⛈️ Storm Warning',
    };

    const severityPrefix = alert.severity === 'high' ? '⚠️ URGENT: ' : '';

    return {
      title: `${severityPrefix}${alertTitles[alert.alertType] || 'Weather Alert'}`,
      body: alert.description,
    };
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

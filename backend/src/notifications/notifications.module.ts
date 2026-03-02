import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsRepository } from './notifications.repository';
import { FCMClient } from './fcm.client';
import { WeatherNotificationService } from './weather-notification.service';
import { BroadcastNotificationService } from './broadcast-notification.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsRepository,
    FCMClient,
    WeatherNotificationService,
    BroadcastNotificationService,
  ],
  exports: [NotificationsService, FCMClient, WeatherNotificationService, BroadcastNotificationService],
})
export class NotificationsModule {}

import { IsString, IsOptional, IsEnum, IsObject, IsBoolean, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum NotificationType {
  WEATHER_ALERT = 'weather_alert',
  MARKET_ALERT = 'market_alert',
  BROADCAST = 'broadcast',
  REMINDER = 'reminder',
}

export enum NotificationPriority {
  HIGH = 'high',
  NORMAL = 'normal',
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  READ = 'read',
}

export enum DevicePlatform {
  ANDROID = 'android',
  IOS = 'ios',
}

export class RegisterDeviceDto {
  @ApiProperty({ description: 'FCM device token' })
  @IsString()
  token: string;

  @ApiProperty({ enum: DevicePlatform, description: 'Device platform' })
  @IsEnum(DevicePlatform)
  platform: DevicePlatform;
}

export class SendNotificationDto {
  @ApiProperty({ description: 'Notification title' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Notification body' })
  @IsString()
  body: string;

  @ApiPropertyOptional({ description: 'Additional data payload' })
  @IsOptional()
  @IsObject()
  data?: Record<string, string>;

  @ApiPropertyOptional({ enum: NotificationPriority, default: NotificationPriority.NORMAL })
  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @ApiPropertyOptional({ description: 'Custom notification sound' })
  @IsOptional()
  @IsString()
  sound?: string;
}

export class DeviceTokenResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  token: string;

  @ApiProperty({ enum: DevicePlatform })
  platform: DevicePlatform;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  lastUsedAt: Date;
}

export class NotificationLogResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ enum: NotificationType })
  type: NotificationType;

  @ApiProperty()
  title: string;

  @ApiProperty()
  body: string;

  @ApiProperty({ enum: NotificationStatus })
  status: NotificationStatus;

  @ApiProperty()
  sentAt: Date;

  @ApiPropertyOptional()
  deliveredAt?: Date;

  @ApiPropertyOptional()
  readAt?: Date;
}

export class BulkNotificationDto {
  @ApiProperty({ type: [String], description: 'Array of user IDs to notify' })
  @IsArray()
  @IsString({ each: true })
  userIds: string[];

  @ApiProperty({ description: 'Notification title' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Notification body' })
  @IsString()
  body: string;

  @ApiPropertyOptional({ description: 'Additional data payload' })
  @IsOptional()
  @IsObject()
  data?: Record<string, string>;

  @ApiPropertyOptional({ enum: NotificationPriority })
  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @ApiPropertyOptional({ enum: NotificationType })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;
}

export class UpdateNotificationStatusDto {
  @ApiProperty({ enum: ['delivered', 'read'] })
  @IsEnum(['delivered', 'read'])
  status: 'delivered' | 'read';
}

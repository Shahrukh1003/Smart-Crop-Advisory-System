import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import {
  RegisterDeviceDto,
  DeviceTokenResponseDto,
  NotificationLogResponseDto,
  UpdateNotificationStatusDto,
} from './dto/notification.dto';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('devices/register')
  @ApiOperation({ summary: 'Register device for push notifications' })
  @ApiResponse({ status: 201, type: DeviceTokenResponseDto })
  async registerDevice(
    @Request() req: any,
    @Body() dto: RegisterDeviceDto,
  ): Promise<DeviceTokenResponseDto> {
    return this.notificationsService.registerDevice(req.user.id, dto);
  }

  @Delete('devices/:token')
  @ApiOperation({ summary: 'Unregister device from push notifications' })
  @ApiResponse({ status: 200 })
  async unregisterDevice(@Param('token') token: string): Promise<{ success: boolean }> {
    await this.notificationsService.unregisterDevice(token);
    return { success: true };
  }

  @Get('devices')
  @ApiOperation({ summary: 'Get user registered devices' })
  @ApiResponse({ status: 200, type: [DeviceTokenResponseDto] })
  async getUserDevices(@Request() req: any): Promise<DeviceTokenResponseDto[]> {
    return this.notificationsService.getUserDeviceTokens(req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get user notifications' })
  @ApiResponse({ status: 200, type: [NotificationLogResponseDto] })
  async getUserNotifications(
    @Request() req: any,
    @Query('limit') limit?: number,
  ): Promise<NotificationLogResponseDto[]> {
    return this.notificationsService.getUserNotifications(req.user.id, limit || 50);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiResponse({ status: 200 })
  async getUnreadCount(@Request() req: any): Promise<{ count: number }> {
    const count = await this.notificationsService.getUnreadCount(req.user.id);
    return { count };
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update notification status (delivered/read)' })
  @ApiResponse({ status: 200, type: NotificationLogResponseDto })
  async updateNotificationStatus(
    @Param('id') id: string,
    @Body() dto: UpdateNotificationStatusDto,
  ): Promise<NotificationLogResponseDto> {
    if (dto.status === 'delivered') {
      return this.notificationsService.markNotificationAsDelivered(id);
    }
    return this.notificationsService.markNotificationAsRead(id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiResponse({ status: 200, type: NotificationLogResponseDto })
  async markAsRead(@Param('id') id: string): Promise<NotificationLogResponseDto> {
    return this.notificationsService.markNotificationAsRead(id);
  }

  @Get('status')
  @ApiOperation({ summary: 'Check FCM service status' })
  @ApiResponse({ status: 200 })
  async getFCMStatus(): Promise<{ available: boolean }> {
    return { available: this.notificationsService.isFCMAvailable() };
  }
}

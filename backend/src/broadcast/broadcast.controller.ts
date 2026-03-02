import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { BroadcastService } from './broadcast.service';
import {
  CreateBroadcastDto,
  BroadcastResponseDto,
  UpdateDeliveryStatusDto,
} from './dto/broadcast.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('broadcast')
@Controller('broadcast')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BroadcastController {
  constructor(private readonly broadcastService: BroadcastService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new broadcast (extension officers only)' })
  @ApiResponse({ status: 201, type: BroadcastResponseDto })
  async createBroadcast(
    @Body() dto: CreateBroadcastDto,
    @CurrentUser('userId') userId: string,
  ): Promise<BroadcastResponseDto> {
    return this.broadcastService.createBroadcast(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get broadcasts for current user' })
  @ApiResponse({ status: 200, type: [BroadcastResponseDto] })
  async getBroadcasts(@CurrentUser('userId') userId: string): Promise<BroadcastResponseDto[]> {
    return this.broadcastService.getBroadcastsForUser(userId);
  }

  @Put(':id/status')
  @ApiOperation({ summary: 'Update delivery status (delivered/read)' })
  async updateDeliveryStatus(
    @Param('id') broadcastId: string,
    @Body() dto: UpdateDeliveryStatusDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.broadcastService.updateDeliveryStatus(broadcastId, userId, dto.status);
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark broadcast as read' })
  async markAsRead(
    @Param('id') broadcastId: string,
    @CurrentUser('userId') userId: string,
  ) {
    await this.broadcastService.markAsRead(broadcastId, userId);
    return { success: true };
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get delivery statistics for a broadcast' })
  async getDeliveryStats(@Param('id') broadcastId: string) {
    return this.broadcastService.getDeliveryStats(broadcastId);
  }
}

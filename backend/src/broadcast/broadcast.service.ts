import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersRepository } from '../users/users.repository';
import {
  CreateBroadcastDto,
  BroadcastResponseDto,
  BroadcastDeliveryDto,
  TargetRegionDto,
  DeliveryStatus,
} from './dto/broadcast.dto';

@Injectable()
export class BroadcastService {
  private readonly logger = new Logger(BroadcastService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersRepository: UsersRepository,
  ) {}

  async createBroadcast(senderId: string, dto: CreateBroadcastDto): Promise<BroadcastResponseDto> {
    // Verify sender is an extension officer
    const sender = await this.prisma.user.findUnique({ where: { id: senderId } });
    if (!sender || sender.role !== 'extension_officer') {
      throw new ForbiddenException('Only extension officers can create broadcasts');
    }

    // Create broadcast
    const broadcast = await this.prisma.broadcast.create({
      data: {
        title: dto.title,
        content: dto.content,
        audioUrl: dto.audioUrl,
        imageUrl: dto.imageUrl,
        language: dto.language as any,
        targetRegion: dto.targetRegion as any,
        priority: dto.priority as any,
        sender: { connect: { id: senderId } },
      },
    });

    // Find target recipients
    const recipients = await this.findRecipientsInRegion(dto.targetRegion);

    // Create delivery records
    await this.createDeliveryRecords(broadcast.id, recipients.map(r => r.id));

    this.logger.log(`Broadcast ${broadcast.id} created with ${recipients.length} recipients`);

    return {
      id: broadcast.id,
      title: broadcast.title,
      content: broadcast.content,
      audioUrl: broadcast.audioUrl || undefined,
      imageUrl: broadcast.imageUrl || undefined,
      language: broadcast.language as any,
      targetRegion: broadcast.targetRegion as any,
      priority: broadcast.priority as any,
      createdAt: broadcast.createdAt,
      recipientCount: recipients.length,
    };
  }

  async findRecipientsInRegion(targetRegion: TargetRegionDto): Promise<{ id: string }[]> {
    const where: any = { role: 'farmer' };

    if (targetRegion.district) {
      where.district = targetRegion.district;
    }
    if (targetRegion.state) {
      where.state = targetRegion.state;
    }

    // For coordinate-based targeting, we'd need PostGIS or similar
    // For now, use district/state filtering
    const users = await this.prisma.user.findMany({
      where,
      select: { id: true },
    });

    return users;
  }


  async createDeliveryRecords(broadcastId: string, recipientIds: string[]): Promise<void> {
    const deliveries = recipientIds.map(recipientId => ({
      broadcastId,
      recipientId,
      deliveryStatus: 'sent' as const,
    }));

    await this.prisma.broadcastDelivery.createMany({ data: deliveries });
  }

  async getBroadcastsForUser(userId: string): Promise<BroadcastResponseDto[]> {
    const deliveries = await this.prisma.broadcastDelivery.findMany({
      where: { recipientId: userId },
      include: { broadcast: true },
      orderBy: { broadcast: { createdAt: 'desc' } },
    });

    return deliveries.map(d => ({
      id: d.broadcast.id,
      title: d.broadcast.title,
      content: d.broadcast.content,
      audioUrl: d.broadcast.audioUrl || undefined,
      imageUrl: d.broadcast.imageUrl || undefined,
      language: d.broadcast.language as any,
      targetRegion: d.broadcast.targetRegion as any,
      priority: d.broadcast.priority as any,
      createdAt: d.broadcast.createdAt,
      recipientCount: 0, // Not needed for user view
      deliveryStatus: d.deliveryStatus,
      readAt: d.readAt,
    }));
  }

  async updateDeliveryStatus(
    broadcastId: string,
    userId: string,
    status: 'delivered' | 'read',
  ): Promise<BroadcastDeliveryDto> {
    const delivery = await this.prisma.broadcastDelivery.findFirst({
      where: { broadcastId, recipientId: userId },
    });

    if (!delivery) {
      throw new ForbiddenException('Broadcast not found for this user');
    }

    const updateData: any = { deliveryStatus: status };
    if (status === 'delivered') {
      updateData.deliveredAt = new Date();
    } else if (status === 'read') {
      updateData.readAt = new Date();
      if (!delivery.deliveredAt) {
        updateData.deliveredAt = new Date();
      }
    }

    const updated = await this.prisma.broadcastDelivery.update({
      where: { id: delivery.id },
      data: updateData,
    });

    return {
      broadcastId: updated.broadcastId,
      recipientId: updated.recipientId,
      deliveryStatus: updated.deliveryStatus as DeliveryStatus,
      deliveredAt: updated.deliveredAt || undefined,
      readAt: updated.readAt || undefined,
    };
  }

  async getDeliveryStats(broadcastId: string): Promise<{
    total: number;
    sent: number;
    delivered: number;
    read: number;
  }> {
    const deliveries = await this.prisma.broadcastDelivery.findMany({
      where: { broadcastId },
    });

    return {
      total: deliveries.length,
      sent: deliveries.filter(d => d.deliveryStatus === 'sent').length,
      delivered: deliveries.filter(d => d.deliveryStatus === 'delivered').length,
      read: deliveries.filter(d => d.deliveryStatus === 'read').length,
    };
  }

  async markAsRead(broadcastId: string, userId: string): Promise<void> {
    await this.updateDeliveryStatus(broadcastId, userId, 'read');
  }

  // Check if content types are valid
  validateContentTypes(dto: CreateBroadcastDto): boolean {
    const hasText = !!(dto.content && dto.content.length > 0);
    const hasAudio = !!(dto.audioUrl && dto.audioUrl.length > 0);
    const hasImage = !!(dto.imageUrl && dto.imageUrl.length > 0);
    
    // At least text content is required
    return hasText;
  }

  // Get supported content types
  getSupportedContentTypes(): string[] {
    return ['text', 'audio', 'image'];
  }
}

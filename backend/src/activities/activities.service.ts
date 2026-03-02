import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ActivitiesRepository } from './activities.repository';
import { CreateCropHistoryDto, UpdateCropHistoryDto, CreateActivityDto, InputCostsDto } from './dto/activity.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly repository: ActivitiesRepository,
    private readonly prisma: PrismaService,
  ) {}

  // Crop History
  async createCropHistory(userId: string, dto: CreateCropHistoryDto) {
    // Verify parcel belongs to user
    const parcel = await this.prisma.landParcel.findUnique({
      where: { id: dto.parcelId },
    });
    if (!parcel || parcel.userId !== userId) {
      throw new ForbiddenException('Access denied to this land parcel');
    }

    return this.repository.createCropHistory({
      cropName: dto.cropName,
      variety: dto.variety,
      sowingDate: new Date(dto.sowingDate),
      user: { connect: { id: userId } },
      parcel: { connect: { id: dto.parcelId } },
    });
  }

  async getCropHistoryByUser(userId: string) {
    return this.repository.findCropHistoryByUser(userId);
  }

  async getCropHistoryGrouped(userId: string) {
    return this.repository.findGroupedByCropAndSeason(userId);
  }

  async getCropHistoryById(id: string, userId: string) {
    const history = await this.repository.findCropHistoryById(id);
    if (!history) {
      throw new NotFoundException(`Crop history with ID ${id} not found`);
    }
    if (history.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    return history;
  }

  async updateCropHistory(id: string, userId: string, dto: UpdateCropHistoryDto) {
    await this.getCropHistoryById(id, userId);
    return this.repository.updateCropHistory(id, {
      harvestDate: dto.harvestDate ? new Date(dto.harvestDate) : undefined,
      yield: dto.yield,
      revenue: dto.revenue,
    });
  }

  async completeSeason(id: string, userId: string, dto: UpdateCropHistoryDto) {
    const history = await this.getCropHistoryById(id, userId);
    
    // Calculate ROI if we have costs and revenue
    const inputCosts = (history as any).inputCosts;
    const totalCosts = inputCosts 
      ? Number(inputCosts.seeds) + Number(inputCosts.fertilizers) + 
        Number(inputCosts.pesticides) + Number(inputCosts.labor) + Number(inputCosts.irrigation)
      : 0;

    const revenue = dto.revenue || 0;
    const roi = totalCosts > 0 ? ((revenue - totalCosts) / totalCosts) * 100 : 0;

    const updated = await this.repository.updateCropHistory(id, {
      harvestDate: dto.harvestDate ? new Date(dto.harvestDate) : new Date(),
      yield: dto.yield,
      revenue: dto.revenue,
    });

    return { ...updated, roi: roi.toFixed(2), totalCosts };
  }

  // Activities
  async createActivity(userId: string, dto: CreateActivityDto) {
    // Verify history belongs to user
    await this.getCropHistoryById(dto.historyId, userId);

    return this.repository.createActivity({
      activityType: dto.activityType,
      activityDate: new Date(dto.activityDate),
      description: dto.description,
      cost: dto.cost,
      history: { connect: { id: dto.historyId } },
    });
  }

  async getActivitiesByHistory(historyId: string, userId: string) {
    await this.getCropHistoryById(historyId, userId);
    return this.repository.findActivitiesByHistory(historyId);
  }

  // Input Costs
  async updateInputCosts(historyId: string, userId: string, dto: InputCostsDto) {
    await this.getCropHistoryById(historyId, userId);
    return this.repository.upsertInputCosts(historyId, dto);
  }
}

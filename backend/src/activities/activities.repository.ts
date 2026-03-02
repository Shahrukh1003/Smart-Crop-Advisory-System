import { Injectable } from '@nestjs/common';
import { FarmingActivity, CropHistory, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ActivitiesRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Crop History
  async createCropHistory(data: Prisma.CropHistoryCreateInput): Promise<CropHistory> {
    return this.prisma.cropHistory.create({ data });
  }

  async findCropHistoryByUser(userId: string): Promise<CropHistory[]> {
    return this.prisma.cropHistory.findMany({
      where: { userId },
      include: { activities: true, inputCosts: true },
      orderBy: { sowingDate: 'desc' },
    });
  }

  async findCropHistoryByParcel(parcelId: string): Promise<CropHistory[]> {
    return this.prisma.cropHistory.findMany({
      where: { parcelId },
      include: { activities: true, inputCosts: true },
      orderBy: { sowingDate: 'desc' },
    });
  }

  async findCropHistoryById(id: string): Promise<CropHistory | null> {
    return this.prisma.cropHistory.findUnique({
      where: { id },
      include: { activities: true, inputCosts: true },
    });
  }

  async updateCropHistory(id: string, data: Prisma.CropHistoryUpdateInput): Promise<CropHistory> {
    return this.prisma.cropHistory.update({ where: { id }, data });
  }

  // Farming Activities
  async createActivity(data: Prisma.FarmingActivityCreateInput): Promise<FarmingActivity> {
    return this.prisma.farmingActivity.create({ data });
  }

  async findActivitiesByHistory(historyId: string): Promise<FarmingActivity[]> {
    return this.prisma.farmingActivity.findMany({
      where: { historyId },
      orderBy: { activityDate: 'desc' },
    });
  }

  async findActivityById(id: string): Promise<FarmingActivity | null> {
    return this.prisma.farmingActivity.findUnique({ where: { id } });
  }

  async updateActivity(id: string, data: Prisma.FarmingActivityUpdateInput): Promise<FarmingActivity> {
    return this.prisma.farmingActivity.update({ where: { id }, data });
  }

  async deleteActivity(id: string): Promise<FarmingActivity> {
    return this.prisma.farmingActivity.delete({ where: { id } });
  }

  // Input Costs
  async upsertInputCosts(historyId: string, data: any) {
    return this.prisma.inputCost.upsert({
      where: { historyId },
      update: data,
      create: { historyId, ...data },
    });
  }

  // Grouped by crop and season
  async findGroupedByCropAndSeason(userId: string) {
    const histories = await this.prisma.cropHistory.findMany({
      where: { userId },
      include: { activities: true, inputCosts: true },
      orderBy: { sowingDate: 'desc' },
    });

    // Group by crop name and season
    const grouped: Record<string, CropHistory[]> = {};
    for (const history of histories) {
      const key = `${history.cropName}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(history);
    }

    return grouped;
  }
}

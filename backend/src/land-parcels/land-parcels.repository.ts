import { Injectable } from '@nestjs/common';
import { LandParcel, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LandParcelsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string): Promise<LandParcel[]> {
    return this.prisma.landParcel.findMany({ where: { userId } });
  }

  async findById(id: string): Promise<LandParcel | null> {
    return this.prisma.landParcel.findUnique({ where: { id } });
  }

  async create(data: Prisma.LandParcelCreateInput): Promise<LandParcel> {
    return this.prisma.landParcel.create({ data });
  }

  async update(id: string, data: Prisma.LandParcelUpdateInput): Promise<LandParcel> {
    return this.prisma.landParcel.update({ where: { id }, data });
  }

  async delete(id: string): Promise<LandParcel> {
    return this.prisma.landParcel.delete({ where: { id } });
  }

  async findWithSoilTests(id: string) {
    return this.prisma.landParcel.findUnique({
      where: { id },
      include: { soilTestResults: { orderBy: { testDate: 'desc' } } },
    });
  }

  async findWithCropHistory(id: string) {
    return this.prisma.landParcel.findUnique({
      where: { id },
      include: { cropHistories: { orderBy: { sowingDate: 'desc' } } },
    });
  }
}

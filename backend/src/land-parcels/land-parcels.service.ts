import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { LandParcel } from '@prisma/client';
import { LandParcelsRepository } from './land-parcels.repository';
import { CreateLandParcelDto, UpdateLandParcelDto, CreateSoilTestDto } from './dto/land-parcel.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LandParcelsService {
  constructor(
    private readonly repository: LandParcelsRepository,
    private readonly prisma: PrismaService,
  ) {}

  async findAllByUser(userId: string): Promise<LandParcel[]> {
    return this.repository.findAll(userId);
  }

  async findById(id: string, userId: string): Promise<LandParcel> {
    const parcel = await this.repository.findById(id);
    if (!parcel) {
      throw new NotFoundException(`Land parcel with ID ${id} not found`);
    }
    if (parcel.userId !== userId) {
      throw new ForbiddenException('Access denied to this land parcel');
    }
    return parcel;
  }

  async create(userId: string, dto: CreateLandParcelDto): Promise<LandParcel> {
    return this.repository.create({
      ...dto,
      user: { connect: { id: userId } },
    });
  }

  async update(id: string, userId: string, dto: UpdateLandParcelDto): Promise<LandParcel> {
    await this.findById(id, userId);
    return this.repository.update(id, dto);
  }

  async delete(id: string, userId: string): Promise<LandParcel> {
    await this.findById(id, userId);
    return this.repository.delete(id);
  }

  async addSoilTest(parcelId: string, userId: string, dto: CreateSoilTestDto) {
    await this.findById(parcelId, userId);
    return this.prisma.soilTestResult.create({
      data: {
        ...dto,
        testDate: new Date(),
        parcel: { connect: { id: parcelId } },
      },
    });
  }

  async getSoilTests(parcelId: string, userId: string) {
    await this.findById(parcelId, userId);
    return this.prisma.soilTestResult.findMany({
      where: { parcelId },
      orderBy: { testDate: 'desc' },
    });
  }

  async getLatestSoilTest(parcelId: string, userId: string) {
    await this.findById(parcelId, userId);
    return this.prisma.soilTestResult.findFirst({
      where: { parcelId },
      orderBy: { testDate: 'desc' },
    });
  }
}

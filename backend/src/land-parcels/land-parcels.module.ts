import { Module } from '@nestjs/common';
import { LandParcelsRepository } from './land-parcels.repository';
import { LandParcelsService } from './land-parcels.service';
import { LandParcelsController } from './land-parcels.controller';

@Module({
  providers: [LandParcelsRepository, LandParcelsService],
  controllers: [LandParcelsController],
  exports: [LandParcelsRepository, LandParcelsService],
})
export class LandParcelsModule {}

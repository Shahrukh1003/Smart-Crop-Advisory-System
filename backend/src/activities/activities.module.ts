import { Module } from '@nestjs/common';
import { ActivitiesRepository } from './activities.repository';
import { ActivitiesService } from './activities.service';
import { ActivitiesController } from './activities.controller';

@Module({
  providers: [ActivitiesRepository, ActivitiesService],
  controllers: [ActivitiesController],
  exports: [ActivitiesRepository, ActivitiesService],
})
export class ActivitiesModule {}

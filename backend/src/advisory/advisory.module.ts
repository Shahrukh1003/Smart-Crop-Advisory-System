import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AdvisoryService } from './advisory.service';
import { AdvisoryController } from './advisory.controller';
import { CropRecommendationService } from './crop-recommendation.service';
import { SoilAnalysisService } from './soil-analysis.service';

@Module({
  imports: [HttpModule],
  providers: [AdvisoryService, CropRecommendationService, SoilAnalysisService],
  controllers: [AdvisoryController],
  exports: [AdvisoryService, CropRecommendationService, SoilAnalysisService],
})
export class AdvisoryModule {}

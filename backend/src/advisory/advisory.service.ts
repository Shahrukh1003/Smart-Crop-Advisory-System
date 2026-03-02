import { Injectable } from '@nestjs/common';
import { CropRecommendationService } from './crop-recommendation.service';
import { SoilAnalysisService } from './soil-analysis.service';
import { CropRecommendationRequestDto, SoilDataDto } from './dto/advisory.dto';

@Injectable()
export class AdvisoryService {
  constructor(
    private readonly cropRecommendationService: CropRecommendationService,
    private readonly soilAnalysisService: SoilAnalysisService,
  ) {}

  async getCropRecommendations(userId: string, dto: CropRecommendationRequestDto) {
    return this.cropRecommendationService.generateRecommendations(userId, dto);
  }

  analyzeSoil(soilData: SoilDataDto, landArea?: number) {
    return this.soilAnalysisService.analyzeSoil(soilData, landArea);
  }
}

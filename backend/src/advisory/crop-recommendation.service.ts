import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CropRecommendationRequestDto, CropRecommendationDto } from './dto/advisory.dto';

// Crop database with suitability parameters
const CROP_DATABASE = [
  { name: 'Rice', variety: 'Basmati', optimalPh: [5.5, 7.0], waterReq: 'high', season: 'kharif', baseYield: 25, baseCost: 35000, baseRevenue: 75000 },
  { name: 'Rice', variety: 'Sona Masuri', optimalPh: [5.5, 7.0], waterReq: 'high', season: 'kharif', baseYield: 28, baseCost: 32000, baseRevenue: 70000 },
  { name: 'Wheat', variety: 'HD-2967', optimalPh: [6.0, 7.5], waterReq: 'medium', season: 'rabi', baseYield: 20, baseCost: 25000, baseRevenue: 50000 },
  { name: 'Maize', variety: 'Hybrid', optimalPh: [5.8, 7.0], waterReq: 'medium', season: 'kharif', baseYield: 30, baseCost: 28000, baseRevenue: 55000 },
  { name: 'Cotton', variety: 'Bt Cotton', optimalPh: [6.0, 8.0], waterReq: 'medium', season: 'kharif', baseYield: 8, baseCost: 40000, baseRevenue: 80000 },
  { name: 'Sugarcane', variety: 'Co-0238', optimalPh: [6.0, 7.5], waterReq: 'high', season: 'annual', baseYield: 350, baseCost: 60000, baseRevenue: 140000 },
  { name: 'Groundnut', variety: 'TMV-2', optimalPh: [6.0, 7.0], waterReq: 'low', season: 'kharif', baseYield: 12, baseCost: 30000, baseRevenue: 60000 },
  { name: 'Soybean', variety: 'JS-335', optimalPh: [6.0, 7.0], waterReq: 'medium', season: 'kharif', baseYield: 10, baseCost: 22000, baseRevenue: 45000 },
  { name: 'Tomato', variety: 'Hybrid', optimalPh: [6.0, 7.0], waterReq: 'medium', season: 'rabi', baseYield: 150, baseCost: 45000, baseRevenue: 120000 },
  { name: 'Onion', variety: 'Nasik Red', optimalPh: [6.0, 7.0], waterReq: 'medium', season: 'rabi', baseYield: 100, baseCost: 35000, baseRevenue: 80000 },
];

@Injectable()
export class CropRecommendationService {
  private readonly logger = new Logger(CropRecommendationService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async generateRecommendations(
    userId: string,
    dto: CropRecommendationRequestDto,
  ): Promise<CropRecommendationDto[]> {
    const { location, soilData, preferences, parcelId } = dto;

    // Get historical data if parcel is provided
    let cropHistory: any[] = [];
    if (parcelId) {
      cropHistory = await this.prisma.cropHistory.findMany({
        where: { parcelId },
        orderBy: { sowingDate: 'desc' },
        take: 5,
      });
    }

    // Calculate suitability scores for each crop
    const recommendations = CROP_DATABASE.map((crop) => {
      let score = 50; // Base score
      const reasoning: string[] = [];
      const risks: string[] = [];

      // pH suitability (0-30 points)
      const phScore = this.calculatePhScore(soilData.ph, crop.optimalPh as [number, number]);
      score += phScore;
      if (phScore > 20) {
        reasoning.push(`Soil pH (${soilData.ph}) is optimal for ${crop.name}`);
      } else if (phScore < 10) {
        risks.push(`Soil pH (${soilData.ph}) is not ideal for ${crop.name}`);
      }

      // Nutrient availability (0-20 points)
      const nutrientScore = this.calculateNutrientScore(soilData);
      score += nutrientScore;
      if (nutrientScore > 15) {
        reasoning.push('Good nutrient levels in soil');
      } else if (nutrientScore < 8) {
        risks.push('Nutrient deficiency may affect yield');
      }

      // Preference bonus (0-10 points)
      if (preferences?.includes(crop.name)) {
        score += 10;
        reasoning.push('Matches your crop preference');
      }

      // Historical performance adjustment
      const historicalCrop = cropHistory.find((h) => h.cropName === crop.name);
      if (historicalCrop) {
        if (historicalCrop.yield && historicalCrop.yield > crop.baseYield * 0.8) {
          score += 5;
          reasoning.push('Good historical performance on this land');
        } else if (historicalCrop.yield && historicalCrop.yield < crop.baseYield * 0.5) {
          score -= 10;
          risks.push('Poor historical performance on this land');
        }
      }

      // Normalize score to 0-100
      score = Math.max(0, Math.min(100, score));

      // Adjust yield and revenue based on soil conditions
      const yieldMultiplier = 0.7 + (score / 100) * 0.6;
      const expectedYield = crop.baseYield * yieldMultiplier;
      const estimatedRevenue = crop.baseRevenue * yieldMultiplier;

      return {
        cropName: crop.name,
        variety: crop.variety,
        suitabilityScore: Math.round(score),
        expectedYield: Math.round(expectedYield * 10) / 10,
        estimatedInputCost: crop.baseCost,
        estimatedRevenue: Math.round(estimatedRevenue),
        reasoning,
        risks,
      };
    });

    // Sort by suitability score (descending)
    recommendations.sort((a, b) => b.suitabilityScore - a.suitabilityScore);

    // Return top 5 recommendations
    const topRecommendations = recommendations.slice(0, 5);

    // Store recommendation in database
    await this.storeRecommendation(userId, parcelId, topRecommendations);

    this.logger.log(`Generated ${topRecommendations.length} recommendations for user ${userId}`);

    return topRecommendations;
  }

  private calculatePhScore(ph: number, optimalRange: [number, number]): number {
    const [min, max] = optimalRange;
    if (ph >= min && ph <= max) {
      return 30; // Perfect pH
    }
    const distance = ph < min ? min - ph : ph - max;
    return Math.max(0, 30 - distance * 10);
  }

  private calculateNutrientScore(soilData: { nitrogen: number; phosphorus: number; potassium: number }): number {
    let score = 0;
    
    // Nitrogen (optimal: 250-350 kg/ha)
    if (soilData.nitrogen >= 250 && soilData.nitrogen <= 350) score += 7;
    else if (soilData.nitrogen >= 150) score += 4;
    
    // Phosphorus (optimal: 20-40 kg/ha)
    if (soilData.phosphorus >= 20 && soilData.phosphorus <= 40) score += 7;
    else if (soilData.phosphorus >= 10) score += 4;
    
    // Potassium (optimal: 150-250 kg/ha)
    if (soilData.potassium >= 150 && soilData.potassium <= 250) score += 6;
    else if (soilData.potassium >= 100) score += 3;

    return score;
  }

  private async storeRecommendation(userId: string, parcelId: string | undefined, recommendations: CropRecommendationDto[]) {
    if (!parcelId) return;

    try {
      await this.prisma.cropRecommendation.create({
        data: {
          user: { connect: { id: userId } },
          parcel: { connect: { id: parcelId } },
          recommendedCrops: {
            create: recommendations.map((r) => ({
              cropName: r.cropName,
              variety: r.variety,
              suitabilityScore: r.suitabilityScore,
              expectedYield: r.expectedYield,
              estimatedInputCost: r.estimatedInputCost,
              estimatedRevenue: r.estimatedRevenue,
              reasoning: r.reasoning,
              risks: r.risks,
            })),
          },
        },
      });
    } catch (error) {
      this.logger.error('Failed to store recommendation', error);
    }
  }
}

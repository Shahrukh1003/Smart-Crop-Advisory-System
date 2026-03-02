import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SoilDataDto, SoilAnalysisResponseDto, FertilizerRecommendationDto } from './dto/advisory.dto';

// Optimal nutrient ranges
const NUTRIENT_THRESHOLDS = {
  nitrogen: { low: 150, medium: 250, high: 350, optimal: '250-350 kg/ha' },
  phosphorus: { low: 10, medium: 20, high: 40, optimal: '20-40 kg/ha' },
  potassium: { low: 100, medium: 150, high: 250, optimal: '150-250 kg/ha' },
  ph: { low: 5.5, medium: 6.0, high: 7.5, optimal: '6.0-7.5' },
  organicMatter: { low: 1.0, medium: 2.0, high: 3.5, optimal: '2.0-3.5%' },
};

// Fertilizer recommendations based on deficiencies
const FERTILIZER_DATABASE = {
  nitrogen: [
    { name: 'Urea', nutrientContent: 46, costPerKg: 30, method: 'Broadcast and incorporate' },
    { name: 'Ammonium Sulphate', nutrientContent: 21, costPerKg: 25, method: 'Side dressing' },
  ],
  phosphorus: [
    { name: 'DAP', nutrientContent: 46, costPerKg: 45, method: 'Basal application' },
    { name: 'SSP', nutrientContent: 16, costPerKg: 15, method: 'Broadcast before sowing' },
  ],
  potassium: [
    { name: 'MOP', nutrientContent: 60, costPerKg: 35, method: 'Basal application' },
    { name: 'SOP', nutrientContent: 50, costPerKg: 50, method: 'Split application' },
  ],
};

export interface FollowUpAssessment {
  id: string;
  parcelId: string;
  treatmentType: string;
  applicationDate: Date;
  followUpDate: Date;
  status: 'pending' | 'completed';
}

@Injectable()
export class SoilAnalysisService {
  private readonly logger = new Logger(SoilAnalysisService.name);

  constructor(private readonly prisma: PrismaService) {}

  analyzeSoil(soilData: SoilDataDto, landArea: number = 1): SoilAnalysisResponseDto {
    const deficiencies: SoilAnalysisResponseDto['deficiencies'] = [];
    const recommendations: FertilizerRecommendationDto[] = [];
    let urgentIntervention = false;

    // Analyze Nitrogen
    const nLevel = this.getNutrientLevel(soilData.nitrogen, NUTRIENT_THRESHOLDS.nitrogen);
    deficiencies.push({
      nutrient: 'Nitrogen',
      level: nLevel,
      currentValue: soilData.nitrogen,
      optimalRange: NUTRIENT_THRESHOLDS.nitrogen.optimal,
    });
    if (nLevel === 'low') {
      urgentIntervention = true;
      const rec = this.calculateFertilizerNeed('nitrogen', soilData.nitrogen, landArea);
      recommendations.push(...rec);
    }

    // Analyze Phosphorus
    const pLevel = this.getNutrientLevel(soilData.phosphorus, NUTRIENT_THRESHOLDS.phosphorus);
    deficiencies.push({
      nutrient: 'Phosphorus',
      level: pLevel,
      currentValue: soilData.phosphorus,
      optimalRange: NUTRIENT_THRESHOLDS.phosphorus.optimal,
    });
    if (pLevel === 'low') {
      urgentIntervention = true;
      const rec = this.calculateFertilizerNeed('phosphorus', soilData.phosphorus, landArea);
      recommendations.push(...rec);
    }

    // Analyze Potassium
    const kLevel = this.getNutrientLevel(soilData.potassium, NUTRIENT_THRESHOLDS.potassium);
    deficiencies.push({
      nutrient: 'Potassium',
      level: kLevel,
      currentValue: soilData.potassium,
      optimalRange: NUTRIENT_THRESHOLDS.potassium.optimal,
    });
    if (kLevel === 'low') {
      const rec = this.calculateFertilizerNeed('potassium', soilData.potassium, landArea);
      recommendations.push(...rec);
    }

    // Analyze pH
    const phLevel = this.getPhLevel(soilData.ph);
    deficiencies.push({
      nutrient: 'pH',
      level: phLevel,
      currentValue: soilData.ph,
      optimalRange: NUTRIENT_THRESHOLDS.ph.optimal,
    });
    if (phLevel === 'low') {
      recommendations.push({
        name: 'Agricultural Lime',
        quantity: Math.round(500 * landArea), // kg per acre
        applicationTiming: '2-3 weeks before sowing',
        applicationMethod: 'Broadcast and incorporate into soil',
        estimatedCost: Math.round(500 * landArea * 5),
      });
    } else if (soilData.ph > 8.0) {
      recommendations.push({
        name: 'Gypsum',
        quantity: Math.round(400 * landArea),
        applicationTiming: 'Before land preparation',
        applicationMethod: 'Broadcast and incorporate',
        estimatedCost: Math.round(400 * landArea * 8),
      });
    }

    // Analyze Organic Matter
    if (soilData.organicMatter !== undefined) {
      const omLevel = this.getNutrientLevel(soilData.organicMatter, NUTRIENT_THRESHOLDS.organicMatter);
      deficiencies.push({
        nutrient: 'Organic Matter',
        level: omLevel,
        currentValue: soilData.organicMatter,
        optimalRange: NUTRIENT_THRESHOLDS.organicMatter.optimal,
      });
      if (omLevel === 'low') {
        recommendations.push({
          name: 'Farm Yard Manure (FYM)',
          quantity: Math.round(5000 * landArea), // kg per acre
          applicationTiming: '2-3 weeks before sowing',
          applicationMethod: 'Broadcast and incorporate',
          estimatedCost: Math.round(5000 * landArea * 2),
        });
      }
    }

    // Calculate total cost
    const totalEstimatedCost = recommendations.reduce((sum, r) => sum + r.estimatedCost, 0);

    this.logger.log(`Soil analysis complete: ${deficiencies.filter(d => d.level === 'low').length} deficiencies found`);

    return {
      deficiencies,
      recommendations,
      totalEstimatedCost,
      urgentIntervention,
    };
  }

  private getNutrientLevel(value: number, thresholds: { low: number; medium: number; high: number }): 'low' | 'medium' | 'adequate' {
    if (value < thresholds.low) return 'low';
    if (value < thresholds.medium) return 'medium';
    return 'adequate';
  }

  private getPhLevel(ph: number): 'low' | 'medium' | 'adequate' {
    if (ph < 5.5) return 'low';
    if (ph > 8.0) return 'low'; // Too alkaline is also problematic
    if (ph < 6.0 || ph > 7.5) return 'medium';
    return 'adequate';
  }

  private calculateFertilizerNeed(nutrient: 'nitrogen' | 'phosphorus' | 'potassium', currentValue: number, landArea: number): FertilizerRecommendationDto[] {
    const thresholds = NUTRIENT_THRESHOLDS[nutrient];
    const deficit = thresholds.medium - currentValue;
    if (deficit <= 0) return [];

    const fertilizers = FERTILIZER_DATABASE[nutrient];
    const primaryFertilizer = fertilizers[0];

    // Calculate quantity needed (simplified)
    const quantityNeeded = Math.round((deficit / primaryFertilizer.nutrientContent) * 100 * landArea);

    return [{
      name: primaryFertilizer.name,
      quantity: quantityNeeded,
      applicationTiming: nutrient === 'nitrogen' ? 'Split: 50% basal, 50% top dressing' : 'Basal application',
      applicationMethod: primaryFertilizer.method,
      estimatedCost: Math.round(quantityNeeded * primaryFertilizer.costPerKg),
    }];
  }

  /**
   * Schedule a follow-up soil assessment after treatment application
   * @param parcelId - The land parcel ID
   * @param treatmentType - Type of treatment applied (fertilizer, lime, etc.)
   * @param applicationDate - Date when treatment was applied
   * @returns Follow-up assessment record
   */
  async scheduleFollowUp(
    parcelId: string,
    treatmentType: string,
    applicationDate: Date,
  ): Promise<FollowUpAssessment> {
    // Calculate follow-up date based on treatment type
    const followUpDays = this.getFollowUpDays(treatmentType);
    const followUpDate = new Date(applicationDate);
    followUpDate.setDate(followUpDate.getDate() + followUpDays);

    this.logger.log(`Scheduling follow-up for parcel ${parcelId}: ${treatmentType} applied on ${applicationDate.toISOString()}, follow-up on ${followUpDate.toISOString()}`);

    // Return the follow-up assessment record
    return {
      id: `followup-${Date.now()}`,
      parcelId,
      treatmentType,
      applicationDate,
      followUpDate,
      status: 'pending',
    };
  }

  /**
   * Get the number of days until follow-up based on treatment type
   */
  private getFollowUpDays(treatmentType: string): number {
    const treatmentFollowUpMap: Record<string, number> = {
      'Urea': 30,
      'DAP': 45,
      'MOP': 45,
      'SSP': 45,
      'Ammonium Sulphate': 30,
      'SOP': 45,
      'Agricultural Lime': 60,
      'Gypsum': 60,
      'Farm Yard Manure (FYM)': 90,
      'default': 45,
    };

    return treatmentFollowUpMap[treatmentType] || treatmentFollowUpMap['default'];
  }

  /**
   * Record treatment application and create follow-up
   */
  async recordTreatmentApplication(
    parcelId: string,
    treatments: { name: string; quantity: number; applicationDate: Date }[],
  ): Promise<FollowUpAssessment[]> {
    const followUps: FollowUpAssessment[] = [];

    for (const treatment of treatments) {
      const followUp = await this.scheduleFollowUp(
        parcelId,
        treatment.name,
        treatment.applicationDate,
      );
      followUps.push(followUp);
    }

    this.logger.log(`Created ${followUps.length} follow-up assessments for parcel ${parcelId}`);
    return followUps;
  }
}

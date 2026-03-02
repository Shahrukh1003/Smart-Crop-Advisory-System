import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsArray, Min, Max } from 'class-validator';

export class SoilDataDto {
  @ApiProperty({ example: 280, description: 'Nitrogen in kg/ha' })
  @IsNumber()
  @Min(0)
  @Max(500)
  nitrogen: number;

  @ApiProperty({ example: 25, description: 'Phosphorus in kg/ha' })
  @IsNumber()
  @Min(0)
  @Max(500)
  phosphorus: number;

  @ApiProperty({ example: 180, description: 'Potassium in kg/ha' })
  @IsNumber()
  @Min(0)
  @Max(500)
  potassium: number;

  @ApiProperty({ example: 6.5, description: 'pH level (4-9)' })
  @IsNumber()
  @Min(4)
  @Max(9)
  ph: number;

  @ApiPropertyOptional({ example: 2.5, description: 'Organic matter %' })
  @IsOptional()
  @IsNumber()
  organicMatter?: number;
}

export class LocationDto {
  @ApiProperty({ example: 12.9716 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({ example: 77.5946 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;
}

export class CropRecommendationRequestDto {
  @ApiProperty({ type: LocationDto })
  location: LocationDto;

  @ApiProperty({ type: SoilDataDto })
  soilData: SoilDataDto;

  @ApiPropertyOptional({ example: ['Rice', 'Wheat'], description: 'Preferred crops' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferences?: string[];

  @ApiPropertyOptional({ description: 'Land parcel ID for historical data' })
  @IsOptional()
  @IsString()
  parcelId?: string;
}

export class CropRecommendationDto {
  @ApiProperty({ example: 'Rice' })
  cropName: string;

  @ApiProperty({ example: 'Basmati' })
  variety: string;

  @ApiProperty({ example: 85, description: 'Suitability score 0-100' })
  suitabilityScore: number;

  @ApiProperty({ example: 25.5, description: 'Expected yield in quintals/acre' })
  expectedYield: number;

  @ApiProperty({ example: 35000, description: 'Estimated input cost in INR' })
  estimatedInputCost: number;

  @ApiProperty({ example: 75000, description: 'Estimated revenue in INR' })
  estimatedRevenue: number;

  @ApiProperty({ example: ['Good soil pH', 'Adequate rainfall expected'] })
  reasoning: string[];

  @ApiProperty({ example: ['Pest risk in monsoon'] })
  risks: string[];
}

export class FertilizerRecommendationDto {
  @ApiProperty({ example: 'Urea' })
  name: string;

  @ApiProperty({ example: 50, description: 'Quantity in kg/acre' })
  quantity: number;

  @ApiProperty({ example: 'Before sowing' })
  applicationTiming: string;

  @ApiProperty({ example: 'Broadcast and incorporate' })
  applicationMethod: string;

  @ApiProperty({ example: 1500, description: 'Estimated cost in INR' })
  estimatedCost: number;
}

export class SoilAnalysisResponseDto {
  @ApiProperty()
  deficiencies: {
    nutrient: string;
    level: 'low' | 'medium' | 'adequate';
    currentValue: number;
    optimalRange: string;
  }[];

  @ApiProperty({ type: [FertilizerRecommendationDto] })
  recommendations: FertilizerRecommendationDto[];

  @ApiProperty({ example: 5500 })
  totalEstimatedCost: number;

  @ApiProperty({ example: false })
  urgentIntervention: boolean;
}

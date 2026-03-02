import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class PestDetectionRequestDto {
  @ApiProperty({ description: 'Base64 encoded image or image URL' })
  @IsString()
  image: string;

  @ApiPropertyOptional({ description: 'Crop type for context' })
  @IsOptional()
  @IsString()
  cropType?: string;
}

export class TreatmentDto {
  @ApiProperty({ example: 'organic' })
  type: 'organic' | 'chemical';

  @ApiProperty({ example: 'Neem Oil Spray' })
  name: string;

  @ApiProperty({ example: '5ml per liter of water' })
  dosage: string;

  @ApiProperty({ example: 'Foliar spray in early morning' })
  applicationMethod: string;

  @ApiProperty({ example: 250 })
  cost: number;

  @ApiProperty({ example: 75, description: 'Effectiveness score 0-100' })
  effectiveness: number;
}

export class DetectedPestDto {
  @ApiProperty({ example: 'Aphids' })
  pestOrDisease: string;

  @ApiProperty({ example: 0.87, description: 'Confidence score 0-1' })
  confidence: number;

  @ApiProperty({ example: 'medium' })
  severity: 'low' | 'medium' | 'high';

  @ApiProperty({ example: 'Rice' })
  affectedCrop: string;

  @ApiProperty({ type: [TreatmentDto] })
  treatments: TreatmentDto[];

  @ApiPropertyOptional({ description: 'Reference image URLs' })
  referenceImages?: string[];
}

export class PestDetectionResponseDto {
  @ApiProperty()
  detectionId: string;

  @ApiProperty()
  imageUrl: string;

  @ApiProperty()
  detectedAt: Date;

  @ApiProperty({ type: [DetectedPestDto] })
  detections: DetectedPestDto[];

  @ApiProperty({ example: false })
  requiresBetterImage: boolean;

  @ApiPropertyOptional()
  imageQualityMessage?: string;
}

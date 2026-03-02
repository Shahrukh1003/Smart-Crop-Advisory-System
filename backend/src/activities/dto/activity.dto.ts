import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsOptional, IsDateString, Min } from 'class-validator';
import { ActivityType } from '@prisma/client';

export class CreateCropHistoryDto {
  @ApiProperty({ description: 'Land parcel ID' })
  @IsString()
  parcelId: string;

  @ApiProperty({ example: 'Rice', description: 'Name of the crop' })
  @IsString()
  cropName: string;

  @ApiPropertyOptional({ example: 'Basmati', description: 'Variety of the crop' })
  @IsOptional()
  @IsString()
  variety?: string;

  @ApiProperty({ example: '2024-06-15', description: 'Sowing date' })
  @IsDateString()
  sowingDate: string;
}

export class UpdateCropHistoryDto {
  @ApiPropertyOptional({ example: '2024-10-15', description: 'Harvest date' })
  @IsOptional()
  @IsDateString()
  harvestDate?: string;

  @ApiPropertyOptional({ example: 25.5, description: 'Yield in quintals' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  yield?: number;

  @ApiPropertyOptional({ example: 75000, description: 'Revenue in INR' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  revenue?: number;
}

export class CreateActivityDto {
  @ApiProperty({ description: 'Crop history ID' })
  @IsString()
  historyId: string;

  @ApiProperty({ enum: ActivityType, example: 'sowing' })
  @IsEnum(ActivityType)
  activityType: ActivityType;

  @ApiProperty({ example: '2024-06-15', description: 'Activity date' })
  @IsDateString()
  activityDate: string;

  @ApiPropertyOptional({ example: 'Applied 50kg urea per acre' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 2500, description: 'Cost in INR' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;
}

export class InputCostsDto {
  @ApiPropertyOptional({ example: 5000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  seeds?: number;

  @ApiPropertyOptional({ example: 8000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  fertilizers?: number;

  @ApiPropertyOptional({ example: 3000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pesticides?: number;

  @ApiPropertyOptional({ example: 15000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  labor?: number;

  @ApiPropertyOptional({ example: 4000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  irrigation?: number;
}

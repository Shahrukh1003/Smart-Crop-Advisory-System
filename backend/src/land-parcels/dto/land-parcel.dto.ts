import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsOptional, Min } from 'class-validator';
import { IrrigationType } from '@prisma/client';

export class CreateLandParcelDto {
  @ApiProperty({ example: 2.5, description: 'Area in acres' })
  @IsNumber()
  @Min(0.01)
  area: number;

  @ApiPropertyOptional({ example: 'Red Soil', description: 'Type of soil' })
  @IsOptional()
  @IsString()
  soilType?: string;

  @ApiPropertyOptional({ enum: IrrigationType, example: 'drip' })
  @IsOptional()
  @IsEnum(IrrigationType)
  irrigationType?: IrrigationType;
}

export class UpdateLandParcelDto {
  @ApiPropertyOptional({ example: 3.0 })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  area?: number;

  @ApiPropertyOptional({ example: 'Black Soil' })
  @IsOptional()
  @IsString()
  soilType?: string;

  @ApiPropertyOptional({ enum: IrrigationType })
  @IsOptional()
  @IsEnum(IrrigationType)
  irrigationType?: IrrigationType;
}

export class CreateSoilTestDto {
  @ApiPropertyOptional({ example: 280, description: 'Nitrogen in kg/ha' })
  @IsOptional()
  @IsNumber()
  nitrogen?: number;

  @ApiPropertyOptional({ example: 25, description: 'Phosphorus in kg/ha' })
  @IsOptional()
  @IsNumber()
  phosphorus?: number;

  @ApiPropertyOptional({ example: 180, description: 'Potassium in kg/ha' })
  @IsOptional()
  @IsNumber()
  potassium?: number;

  @ApiPropertyOptional({ example: 6.5, description: 'pH level (0-14)' })
  @IsOptional()
  @IsNumber()
  ph?: number;

  @ApiPropertyOptional({ example: 2.5, description: 'Organic matter percentage' })
  @IsOptional()
  @IsNumber()
  organicMatter?: number;
}

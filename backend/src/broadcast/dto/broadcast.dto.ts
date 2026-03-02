import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsObject, IsArray } from 'class-validator';

export type Language = 'kn' | 'hi' | 'ta' | 'te' | 'en';
export type Priority = 'low' | 'medium' | 'high';
export type DeliveryStatus = 'sent' | 'delivered' | 'read';

export class TargetRegionDto {
  @ApiPropertyOptional({ example: 'Bangalore Urban' })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional({ example: 'Karnataka' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ example: [12.9716, 77.5946] })
  @IsOptional()
  @IsArray()
  coordinates?: [number, number];

  @ApiPropertyOptional({ example: 50, description: 'Radius in km' })
  @IsOptional()
  radiusKm?: number;
}

export class CreateBroadcastDto {
  @ApiProperty({ example: 'Weather Alert' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'Heavy rainfall expected in the next 48 hours' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ description: 'URL to audio file' })
  @IsOptional()
  @IsString()
  audioUrl?: string;

  @ApiPropertyOptional({ description: 'URL to image file' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiProperty({ enum: ['kn', 'hi', 'ta', 'te', 'en'] })
  @IsString()
  language: Language;

  @ApiProperty({ type: TargetRegionDto })
  @IsObject()
  targetRegion: TargetRegionDto;

  @ApiPropertyOptional({ enum: ['low', 'medium', 'high'] })
  @IsOptional()
  @IsString()
  priority?: Priority;
}

export class BroadcastResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  content: string;

  @ApiPropertyOptional()
  audioUrl?: string;

  @ApiPropertyOptional()
  imageUrl?: string;

  @ApiProperty()
  language: Language;

  @ApiProperty()
  targetRegion: TargetRegionDto;

  @ApiPropertyOptional()
  priority?: Priority;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  recipientCount: number;
}

export class BroadcastDeliveryDto {
  @ApiProperty()
  broadcastId: string;

  @ApiProperty()
  recipientId: string;

  @ApiProperty({ enum: ['sent', 'delivered', 'read'] })
  deliveryStatus: DeliveryStatus;

  @ApiPropertyOptional()
  deliveredAt?: Date;

  @ApiPropertyOptional()
  readAt?: Date;
}

export class UpdateDeliveryStatusDto {
  @ApiProperty({ enum: ['delivered', 'read'] })
  @IsString()
  status: 'delivered' | 'read';
}

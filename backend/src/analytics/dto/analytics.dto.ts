import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class LogEventDto {
  @ApiProperty({ example: 'crop_advisory' })
  @IsString()
  feature: string;

  @ApiProperty({ example: 'session-123' })
  @IsString()
  sessionId: string;

  @ApiPropertyOptional({ example: { crop: 'Rice' } })
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ example: 1500, description: 'Duration of interaction in milliseconds' })
  @IsOptional()
  @IsNumber()
  duration?: number;
}

export class BatchLogEventsDto {
  @ApiProperty({ type: [LogEventDto] })
  events: LogEventDto[];
}

export class AnalyticsEventResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  feature: string;

  @ApiProperty()
  sessionId: string;

  @ApiProperty()
  eventTimestamp: Date;

  @ApiPropertyOptional()
  metadata?: Record<string, any>;

  @ApiPropertyOptional()
  duration?: number;
}

export class SubmitFeedbackDto {
  @ApiProperty({ example: 'crop_advisory' })
  @IsString()
  feature: string;

  @ApiProperty({ example: 4, minimum: 1, maximum: 5 })
  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({ example: 'Very helpful recommendations!' })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  context?: Record<string, any>;
}

export class UsageReportDto {
  @ApiProperty()
  adoptionRate: number;

  @ApiProperty()
  totalUsers: number;

  @ApiProperty()
  activeUsers: number;

  @ApiProperty()
  featurePopularity: Record<string, number>;

  @ApiProperty()
  userSatisfaction: Record<string, number>;

  @ApiProperty()
  periodStart: Date;

  @ApiProperty()
  periodEnd: Date;
}

export class FeedbackResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  feature: string;

  @ApiProperty()
  rating: number;

  @ApiPropertyOptional()
  comment?: string;

  @ApiProperty()
  createdAt: Date;
}

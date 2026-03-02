import { ApiProperty } from '@nestjs/swagger';

export class WeatherForecastDto {
  @ApiProperty() date: string;
  @ApiProperty() minTemp: number;
  @ApiProperty() maxTemp: number;
  @ApiProperty() rainfall: number;
  @ApiProperty() humidity: number;
  @ApiProperty() windSpeed: number;
  @ApiProperty() description: string;
}

export class WeatherAlertDto {
  @ApiProperty() alertType: 'heavy_rain' | 'heat_wave' | 'frost' | 'storm';
  @ApiProperty() severity: 'low' | 'medium' | 'high';
  @ApiProperty() startTime: string;
  @ApiProperty() endTime: string;
  @ApiProperty() description: string;
}

export class ActivityRecommendationDto {
  @ApiProperty() activity: string;
  @ApiProperty() recommended: boolean;
  @ApiProperty() timeWindow: string;
  @ApiProperty() reason: string;
}

export class WeatherResponseDto {
  @ApiProperty() current: {
    temperature: number;
    humidity: number;
    rainfall: number;
    windSpeed: number;
    description: string;
  };
  @ApiProperty({ type: [WeatherForecastDto] }) forecast: WeatherForecastDto[];
  @ApiProperty({ type: [WeatherAlertDto] }) alerts: WeatherAlertDto[];
  @ApiProperty({ type: [ActivityRecommendationDto] }) activityRecommendations: ActivityRecommendationDto[];
  @ApiProperty() pestRiskAlert?: { risk: string; actions: string[] };
  @ApiProperty() irrigationRecommendation?: { action: string; reason: string };
}

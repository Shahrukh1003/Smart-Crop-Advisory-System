import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { WeatherService } from './weather.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('weather')
@Controller('weather')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WeatherController {
  constructor(private readonly weatherService: WeatherService) {}

  @Get()
  @ApiOperation({ summary: 'Get current weather with forecast, alerts and recommendations' })
  @ApiQuery({ name: 'latitude', type: Number, example: 12.9716 })
  @ApiQuery({ name: 'longitude', type: Number, example: 77.5946 })
  async getWeather(
    @Query('latitude') latitude: number,
    @Query('longitude') longitude: number,
  ) {
    return this.weatherService.getWeatherData(latitude, longitude);
  }

  @Get('forecast')
  @ApiOperation({ summary: 'Get 7-day weather forecast with alerts and recommendations' })
  @ApiQuery({ name: 'latitude', type: Number, example: 12.9716 })
  @ApiQuery({ name: 'longitude', type: Number, example: 77.5946 })
  async getForecast(
    @Query('latitude') latitude: number,
    @Query('longitude') longitude: number,
  ) {
    return this.weatherService.getWeatherData(latitude, longitude);
  }
}

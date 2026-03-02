import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { WeatherService } from './weather.service';
import { WeatherController } from './weather.controller';
import { OpenWeatherMapClient } from './openweathermap.client';
import { WeatherCacheService } from './weather-cache.service';
import { WeatherAlertService } from './weather-alert.service';

@Module({
  imports: [HttpModule],
  providers: [
    WeatherService,
    OpenWeatherMapClient,
    WeatherCacheService,
    WeatherAlertService,
  ],
  controllers: [WeatherController],
  exports: [WeatherService, WeatherCacheService, WeatherAlertService],
})
export class WeatherModule {}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WeatherForecastDto, WeatherAlertDto } from './dto/weather.dto';

export interface AlertThresholds {
  heavyRain: number; // mm
  heatWave: number; // °C
  frost: number; // °C
  highWind: number; // km/h
}

export interface GeographicRegion {
  latitude: number;
  longitude: number;
  radiusKm: number;
}

@Injectable()
export class WeatherAlertService {
  private readonly logger = new Logger(WeatherAlertService.name);
  private readonly thresholds: AlertThresholds;

  constructor(private readonly configService: ConfigService) {
    this.thresholds = {
      heavyRain: this.configService.get<number>('ALERT_THRESHOLD_RAIN', 15),
      heatWave: this.configService.get<number>('ALERT_THRESHOLD_HEAT', 40),
      frost: this.configService.get<number>('ALERT_THRESHOLD_FROST', 10),
      highWind: this.configService.get<number>('ALERT_THRESHOLD_WIND', 30),
    };
  }

  getThresholds(): AlertThresholds {
    return { ...this.thresholds };
  }

  detectAlerts(
    forecast: WeatherForecastDto[],
    location?: GeographicRegion,
  ): WeatherAlertDto[] {
    const alerts: WeatherAlertDto[] = [];

    for (const day of forecast) {
      // Heavy rain alert
      if (day.rainfall > this.thresholds.heavyRain) {
        alerts.push({
          alertType: 'heavy_rain',
          severity: day.rainfall > 25 ? 'high' : 'medium',
          startTime: day.date,
          endTime: day.date,
          description: `Heavy rainfall expected (${day.rainfall.toFixed(1)}mm). Protect crops and avoid field operations.`,
        });
        this.logger.log(`Heavy rain alert generated for ${day.date}: ${day.rainfall}mm`);
      }

      // Heat wave alert
      if (day.maxTemp > this.thresholds.heatWave) {
        alerts.push({
          alertType: 'heat_wave',
          severity: day.maxTemp > 45 ? 'high' : 'medium',
          startTime: day.date,
          endTime: day.date,
          description: `Heat wave warning. Temperature may exceed ${day.maxTemp.toFixed(1)}°C. Ensure adequate irrigation.`,
        });
        this.logger.log(`Heat wave alert generated for ${day.date}: ${day.maxTemp}°C`);
      }

      // Frost alert
      if (day.minTemp < this.thresholds.frost) {
        alerts.push({
          alertType: 'frost',
          severity: day.minTemp < 5 ? 'high' : 'medium',
          startTime: day.date,
          endTime: day.date,
          description: `Frost risk. Minimum temperature ${day.minTemp.toFixed(1)}°C. Protect sensitive crops.`,
        });
        this.logger.log(`Frost alert generated for ${day.date}: ${day.minTemp}°C`);
      }

      // High wind/storm alert
      if (day.windSpeed > this.thresholds.highWind) {
        alerts.push({
          alertType: 'storm',
          severity: day.windSpeed > 50 ? 'high' : 'medium',
          startTime: day.date,
          endTime: day.date,
          description: `Strong winds expected (${day.windSpeed.toFixed(1)} km/h). Secure structures and avoid spraying.`,
        });
        this.logger.log(`Storm alert generated for ${day.date}: ${day.windSpeed} km/h`);
      }
    }

    return alerts;
  }

  /**
   * Check if weather conditions exceed any alert thresholds
   */
  hasAlertConditions(forecast: WeatherForecastDto): boolean {
    return (
      forecast.rainfall > this.thresholds.heavyRain ||
      forecast.maxTemp > this.thresholds.heatWave ||
      forecast.minTemp < this.thresholds.frost ||
      forecast.windSpeed > this.thresholds.highWind
    );
  }

  /**
   * Get affected regions for an alert (for notification targeting)
   */
  getAffectedRegions(
    alertLocation: GeographicRegion,
    allFarmerLocations: Array<{ latitude: number; longitude: number; userId: string }>,
  ): string[] {
    const affectedUserIds: string[] = [];

    for (const farmer of allFarmerLocations) {
      const distance = this.calculateDistance(
        alertLocation.latitude,
        alertLocation.longitude,
        farmer.latitude,
        farmer.longitude,
      );

      if (distance <= alertLocation.radiusKm) {
        affectedUserIds.push(farmer.userId);
      }
    }

    return affectedUserIds;
  }

  private calculateDistance(
    lat1: number, lon1: number,
    lat2: number, lon2: number,
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WeatherResponseDto, WeatherForecastDto, WeatherAlertDto, ActivityRecommendationDto } from './dto/weather.dto';
import { OpenWeatherMapClient } from './openweathermap.client';
import { WeatherCacheService, CacheEntry } from './weather-cache.service';
import { WeatherAlertService } from './weather-alert.service';

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);

  constructor(
    private readonly openWeatherMapClient: OpenWeatherMapClient,
    private readonly cacheService: WeatherCacheService,
    private readonly alertService: WeatherAlertService,
    private readonly configService: ConfigService,
  ) {}

  async getWeatherData(latitude: number, longitude: number): Promise<WeatherResponseDto> {
    try {
      let current: any;
      let forecast: WeatherForecastDto[];
      let fromCache = false;
      let cacheTimestamp: number | undefined;

      // Try to get from cache first
      const [cachedCurrent, cachedForecast] = await Promise.all([
        this.cacheService.getCurrentWeather(latitude, longitude),
        this.cacheService.getForecast(latitude, longitude),
      ]);

      if (cachedCurrent && cachedForecast) {
        current = cachedCurrent.data;
        forecast = cachedForecast.data;
        fromCache = true;
        cacheTimestamp = cachedCurrent.timestamp;
        this.logger.log(`Using cached weather data for ${latitude}, ${longitude}`);
      } else if (this.openWeatherMapClient.isConfigured()) {
        // Fetch from API
        try {
          const [currentData, forecastData] = await Promise.all([
            this.fetchCurrentWeather(latitude, longitude),
            this.fetchForecast(latitude, longitude),
          ]);
          current = currentData;
          forecast = forecastData;
          
          // Cache the results
          await Promise.all([
            this.cacheService.setCurrentWeather(latitude, longitude, current),
            this.cacheService.setForecast(latitude, longitude, forecast),
          ]);
          
          this.logger.log(`Fetched real weather data for ${latitude}, ${longitude}`);
        } catch (apiError) {
          this.logger.warn('Failed to fetch from OpenWeatherMap, checking for stale cache', apiError);
          
          // Try to use stale cache as fallback
          const [staleCurrent, staleForecast] = await Promise.all([
            this.cacheService.getCurrentWeather(latitude, longitude),
            this.cacheService.getForecast(latitude, longitude),
          ]);
          
          if (staleCurrent || staleForecast) {
            current = staleCurrent?.data || this.generateCurrentWeather();
            forecast = staleForecast?.data || this.generateForecast();
            fromCache = true;
            cacheTimestamp = staleCurrent?.timestamp || staleForecast?.timestamp;
            this.logger.log('Using stale cached data as fallback');
          } else {
            current = this.generateCurrentWeather();
            forecast = this.generateForecast();
            this.logger.log('Using generated data as fallback');
          }
        }
      } else {
        this.logger.log('No API key configured, using generated weather data');
        current = this.generateCurrentWeather();
        forecast = this.generateForecast();
      }

      // Generate alerts using the alert service
      const alerts = this.alertService.detectAlerts(forecast);
      const activityRecommendations = this.generateActivityRecommendations(forecast);
      const pestRiskAlert = this.detectPestRisk(current, forecast);
      const irrigationRecommendation = this.generateIrrigationRecommendation(forecast);

      const response: WeatherResponseDto = {
        current,
        forecast,
        alerts,
        activityRecommendations,
        pestRiskAlert,
        irrigationRecommendation,
      };

      // Add cache metadata if from cache
      if (fromCache && cacheTimestamp) {
        (response as any).cacheInfo = {
          fromCache: true,
          timestamp: cacheTimestamp,
          lastUpdated: new Date(cacheTimestamp).toISOString(),
        };
      }

      return response;
    } catch (error) {
      this.logger.error('Failed to fetch weather data', error);
      throw error;
    }
  }

  private async fetchCurrentWeather(latitude: number, longitude: number): Promise<any> {
    const data = await this.openWeatherMapClient.fetchCurrentWeather(latitude, longitude);

    return {
      temperature: Math.round(data.main.temp * 10) / 10,
      humidity: data.main.humidity,
      rainfall: data.rain?.['1h'] || data.rain?.['3h'] || 0,
      windSpeed: Math.round(data.wind.speed * 3.6 * 10) / 10, // Convert m/s to km/h
      description: data.weather[0]?.description || 'Unknown',
      icon: this.mapWeatherIcon(data.weather[0]?.icon),
      feelsLike: Math.round(data.main.feels_like * 10) / 10,
      pressure: data.main.pressure,
      visibility: data.visibility / 1000, // Convert to km
      clouds: data.clouds?.all || 0,
      sunrise: new Date(data.sys.sunrise * 1000).toISOString(),
      sunset: new Date(data.sys.sunset * 1000).toISOString(),
    };
  }

  private async fetchForecast(latitude: number, longitude: number): Promise<WeatherForecastDto[]> {
    const data = await this.openWeatherMapClient.fetchForecast(latitude, longitude);

    // Group forecast by day
    const dailyForecasts = new Map<string, any[]>();
    
    for (const item of data.list) {
      const date = item.dt_txt.split(' ')[0];
      if (!dailyForecasts.has(date)) {
        dailyForecasts.set(date, []);
      }
      dailyForecasts.get(date)!.push(item);
    }

    const forecast: WeatherForecastDto[] = [];
    
    for (const [date, items] of dailyForecasts) {
      if (forecast.length >= 7) break;
      
      const temps = items.map(i => i.main.temp);
      const rainfall = items.reduce((sum, i) => sum + (i.rain?.['3h'] || 0), 0);
      const humidity = items.reduce((sum, i) => sum + i.main.humidity, 0) / items.length;
      const windSpeed = items.reduce((sum, i) => sum + i.wind.speed, 0) / items.length;
      
      // Get the most common weather description
      const descriptions = items.map(i => i.weather[0]?.description);
      const mostCommon = descriptions.sort((a, b) =>
        descriptions.filter(v => v === a).length - descriptions.filter(v => v === b).length
      ).pop();

      forecast.push({
        date,
        minTemp: Math.round(Math.min(...temps) * 10) / 10,
        maxTemp: Math.round(Math.max(...temps) * 10) / 10,
        rainfall: Math.round(rainfall * 10) / 10,
        humidity: Math.round(humidity),
        windSpeed: Math.round(windSpeed * 3.6 * 10) / 10,
        description: mostCommon || 'Unknown',
      });
    }

    return forecast;
  }

  private mapWeatherIcon(iconCode: string): string {
    const iconMap: Record<string, string> = {
      '01d': 'sunny', '01n': 'moon',
      '02d': 'partly-sunny', '02n': 'cloudy-night',
      '03d': 'cloudy', '03n': 'cloudy',
      '04d': 'cloudy', '04n': 'cloudy',
      '09d': 'rainy', '09n': 'rainy',
      '10d': 'rainy', '10n': 'rainy',
      '11d': 'thunderstorm', '11n': 'thunderstorm',
      '13d': 'snow', '13n': 'snow',
      '50d': 'cloudy', '50n': 'cloudy',
    };
    return iconMap[iconCode] || 'partly-sunny';
  }

  private generateCurrentWeather() {
    // Generate realistic weather based on current season in India
    const month = new Date().getMonth();
    let baseTemp = 28;
    let baseHumidity = 60;
    
    // Adjust for Indian seasons
    if (month >= 2 && month <= 4) { // March-May (Summer)
      baseTemp = 35;
      baseHumidity = 40;
    } else if (month >= 5 && month <= 8) { // June-September (Monsoon)
      baseTemp = 28;
      baseHumidity = 80;
    } else if (month >= 9 && month <= 10) { // October-November (Post-monsoon)
      baseTemp = 26;
      baseHumidity = 65;
    } else { // December-February (Winter)
      baseTemp = 20;
      baseHumidity = 55;
    }

    const temp = baseTemp + (Math.random() * 6 - 3);
    const humidity = baseHumidity + (Math.random() * 20 - 10);
    const isMonsoon = month >= 5 && month <= 8;
    const rainfall = isMonsoon && Math.random() > 0.5 ? Math.random() * 15 : 0;

    return {
      temperature: Math.round(temp * 10) / 10,
      humidity: Math.round(humidity),
      rainfall: Math.round(rainfall * 10) / 10,
      windSpeed: Math.round((5 + Math.random() * 15) * 10) / 10,
      description: this.getWeatherDescription(temp, humidity, rainfall),
      icon: this.getWeatherIconFromConditions(temp, humidity, rainfall),
      feelsLike: Math.round((temp + (humidity > 70 ? 2 : -1)) * 10) / 10,
      pressure: 1013 + Math.round(Math.random() * 10 - 5),
      visibility: 10 - (rainfall > 5 ? 3 : 0),
      clouds: rainfall > 0 ? 70 + Math.random() * 30 : Math.random() * 40,
    };
  }

  private getWeatherDescription(temp: number, humidity: number, rainfall: number): string {
    if (rainfall > 10) return 'Heavy Rain';
    if (rainfall > 5) return 'Moderate Rain';
    if (rainfall > 0) return 'Light Rain';
    if (humidity > 80) return 'Humid';
    if (temp > 38) return 'Very Hot';
    if (temp > 32) return 'Hot';
    if (humidity < 40 && temp > 30) return 'Hot and Dry';
    if (temp < 15) return 'Cold';
    return 'Partly Cloudy';
  }

  private getWeatherIconFromConditions(temp: number, humidity: number, rainfall: number): string {
    if (rainfall > 5) return 'rainy';
    if (rainfall > 0) return 'rainy';
    if (humidity > 80) return 'cloudy';
    if (temp > 35) return 'sunny';
    return 'partly-sunny';
  }

  private generateForecast(): WeatherForecastDto[] {
    const forecast: WeatherForecastDto[] = [];
    const today = new Date();
    const month = today.getMonth();
    const isMonsoon = month >= 5 && month <= 8;

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      
      let baseMin = 22, baseMax = 32;
      if (month >= 2 && month <= 4) { baseMin = 26; baseMax = 40; }
      else if (month >= 5 && month <= 8) { baseMin = 24; baseMax = 34; }
      else if (month >= 11 || month <= 1) { baseMin = 14; baseMax = 26; }

      const minTemp = baseMin + Math.random() * 4 - 2;
      const maxTemp = baseMax + Math.random() * 4 - 2;
      const rainfall = isMonsoon && Math.random() > 0.4 ? Math.random() * 25 : (Math.random() > 0.8 ? Math.random() * 10 : 0);
      
      forecast.push({
        date: date.toISOString().split('T')[0],
        minTemp: Math.round(minTemp * 10) / 10,
        maxTemp: Math.round(maxTemp * 10) / 10,
        rainfall: Math.round(rainfall * 10) / 10,
        humidity: Math.round(50 + Math.random() * 40),
        windSpeed: Math.round((5 + Math.random() * 20) * 10) / 10,
        description: rainfall > 10 ? 'Heavy Rain' : rainfall > 0 ? 'Light Rain' : 'Partly Cloudy',
      });
    }
    return forecast;
  }

  private generateActivityRecommendations(forecast: WeatherForecastDto[]): ActivityRecommendationDto[] {
    const recommendations: ActivityRecommendationDto[] = [];
    const next3Days = forecast.slice(0, 3);
    
    const goodSowingDays = next3Days.filter(d => d.rainfall < 5 && d.humidity > 40 && d.humidity < 80);
    if (goodSowingDays.length > 0) {
      recommendations.push({
        activity: 'Sowing',
        recommended: true,
        timeWindow: goodSowingDays[0].date,
        reason: 'Optimal soil moisture and temperature conditions',
      });
    }

    const dryDays = next3Days.filter(d => d.rainfall === 0 && d.humidity < 70);
    if (dryDays.length >= 2) {
      recommendations.push({
        activity: 'Harvesting',
        recommended: true,
        timeWindow: `${dryDays[0].date} to ${dryDays[dryDays.length - 1].date}`,
        reason: 'Dry conditions ideal for harvesting',
      });
    }

    const calmDays = next3Days.filter(d => d.windSpeed < 15 && d.rainfall === 0);
    if (calmDays.length > 0) {
      recommendations.push({
        activity: 'Pesticide Spraying',
        recommended: true,
        timeWindow: `${calmDays[0].date} (early morning)`,
        reason: 'Low wind speed ensures effective application',
      });
    } else {
      recommendations.push({
        activity: 'Pesticide Spraying',
        recommended: false,
        timeWindow: 'Not recommended in next 3 days',
        reason: 'High wind or rain expected - spray will be ineffective',
      });
    }

    const moistDays = next3Days.filter(d => d.rainfall > 2 && d.rainfall < 10);
    if (moistDays.length > 0) {
      recommendations.push({
        activity: 'Fertilizer Application',
        recommended: true,
        timeWindow: `Day before ${moistDays[0].date}`,
        reason: 'Light rain will help fertilizer absorption',
      });
    }

    return recommendations;
  }

  private detectPestRisk(current: any, forecast: WeatherForecastDto[]): { risk: string; actions: string[] } | undefined {
    const avgHumidity = forecast.slice(0, 3).reduce((sum, d) => sum + d.humidity, 0) / 3;
    const avgTemp = forecast.slice(0, 3).reduce((sum, d) => sum + (d.maxTemp + d.minTemp) / 2, 0) / 3;

    if (avgHumidity > 75 && avgTemp > 25 && avgTemp < 35) {
      return {
        risk: 'High risk of fungal diseases (Blast, Blight)',
        actions: [
          'Apply preventive fungicide spray',
          'Ensure proper drainage in fields',
          'Monitor crops daily for early symptoms',
          'Avoid overhead irrigation',
        ],
      };
    }

    if (avgHumidity < 50 && avgTemp > 32) {
      return {
        risk: 'Increased risk of pest infestation (Aphids, Mites)',
        actions: [
          'Scout fields for pest presence',
          'Consider neem-based organic spray',
          'Maintain field hygiene',
          'Use yellow sticky traps for monitoring',
        ],
      };
    }

    return undefined;
  }

  private generateIrrigationRecommendation(forecast: WeatherForecastDto[]): { action: string; reason: string } {
    const next48hRainfall = forecast.slice(0, 2).reduce((sum, d) => sum + d.rainfall, 0);

    if (next48hRainfall > 10) {
      return {
        action: 'Skip irrigation for next 2 days',
        reason: `Significant rainfall expected (${next48hRainfall.toFixed(1)}mm). Natural irrigation will be sufficient.`,
      };
    } else if (next48hRainfall > 5) {
      return {
        action: 'Reduce irrigation by 50%',
        reason: `Light rainfall expected (${next48hRainfall.toFixed(1)}mm). Supplement with reduced irrigation.`,
      };
    } else {
      return {
        action: 'Continue normal irrigation schedule',
        reason: 'No significant rainfall expected. Maintain regular watering.',
      };
    }
  }
}

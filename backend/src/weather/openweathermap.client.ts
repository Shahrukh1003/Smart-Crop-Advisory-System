import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, timeout, retry, catchError } from 'rxjs';
import { AxiosError } from 'axios';

export interface OpenWeatherMapConfig {
  apiKey: string;
  apiUrl: string;
  timeout: number;
  maxRetries: number;
  rateLimitPerMinute: number;
}

export interface CurrentWeatherResponse {
  main: {
    temp: number;
    feels_like: number;
    humidity: number;
    pressure: number;
  };
  weather: Array<{ description: string; icon: string }>;
  wind: { speed: number };
  rain?: { '1h'?: number; '3h'?: number };
  clouds?: { all: number };
  visibility: number;
  sys: { sunrise: number; sunset: number };
}

export interface ForecastResponse {
  list: Array<{
    dt_txt: string;
    main: { temp: number; humidity: number };
    weather: Array<{ description: string }>;
    wind: { speed: number };
    rain?: { '3h'?: number };
  }>;
}

@Injectable()
export class OpenWeatherMapClient {
  private readonly logger = new Logger(OpenWeatherMapClient.name);
  private readonly config: OpenWeatherMapConfig;
  private requestTimestamps: number[] = [];

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.config = {
      apiKey: this.configService.get<string>('OPENWEATHERMAP_API_KEY', ''),
      apiUrl: this.configService.get<string>(
        'OPENWEATHERMAP_API_URL',
        'https://api.openweathermap.org/data/2.5',
      ),
      timeout: this.configService.get<number>('OPENWEATHERMAP_TIMEOUT', 3000),
      maxRetries: this.configService.get<number>('OPENWEATHERMAP_MAX_RETRIES', 3),
      rateLimitPerMinute: this.configService.get<number>('OPENWEATHERMAP_RATE_LIMIT', 60),
    };
  }

  isConfigured(): boolean {
    return !!this.config.apiKey && this.config.apiKey !== 'your-openweathermap-api-key';
  }

  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Remove timestamps older than 1 minute
    this.requestTimestamps = this.requestTimestamps.filter(ts => ts > oneMinuteAgo);
    
    if (this.requestTimestamps.length >= this.config.rateLimitPerMinute) {
      const oldestTimestamp = this.requestTimestamps[0];
      const waitTime = oldestTimestamp + 60000 - now;
      this.logger.warn(`Rate limit reached, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.requestTimestamps.push(now);
  }

  async fetchCurrentWeather(latitude: number, longitude: number): Promise<CurrentWeatherResponse> {
    await this.checkRateLimit();
    
    const url = `${this.config.apiUrl}/weather?lat=${latitude}&lon=${longitude}&appid=${this.config.apiKey}&units=metric`;
    
    this.logger.debug(`Fetching current weather for ${latitude}, ${longitude}`);
    
    try {
      const response = await firstValueFrom(
        this.httpService.get<CurrentWeatherResponse>(url).pipe(
          timeout(this.config.timeout),
          retry({
            count: this.config.maxRetries,
            delay: (error, retryCount) => {
              const delay = Math.pow(2, retryCount) * 500; // Exponential backoff
              this.logger.warn(`Retry ${retryCount}/${this.config.maxRetries} after ${delay}ms`);
              return new Promise(resolve => setTimeout(resolve, delay));
            },
          }),
          catchError((error: AxiosError) => {
            this.logger.error(`Failed to fetch current weather: ${error.message}`);
            throw error;
          }),
        ),
      );
      
      return response.data;
    } catch (error) {
      this.logger.error(`OpenWeatherMap API error: ${error.message}`);
      throw error;
    }
  }

  async fetchForecast(latitude: number, longitude: number): Promise<ForecastResponse> {
    await this.checkRateLimit();
    
    const url = `${this.config.apiUrl}/forecast?lat=${latitude}&lon=${longitude}&appid=${this.config.apiKey}&units=metric`;
    
    this.logger.debug(`Fetching forecast for ${latitude}, ${longitude}`);
    
    try {
      const response = await firstValueFrom(
        this.httpService.get<ForecastResponse>(url).pipe(
          timeout(this.config.timeout),
          retry({
            count: this.config.maxRetries,
            delay: (error, retryCount) => {
              const delay = Math.pow(2, retryCount) * 500;
              this.logger.warn(`Retry ${retryCount}/${this.config.maxRetries} after ${delay}ms`);
              return new Promise(resolve => setTimeout(resolve, delay));
            },
          }),
          catchError((error: AxiosError) => {
            this.logger.error(`Failed to fetch forecast: ${error.message}`);
            throw error;
          }),
        ),
      );
      
      return response.data;
    } catch (error) {
      this.logger.error(`OpenWeatherMap API error: ${error.message}`);
      throw error;
    }
  }
}

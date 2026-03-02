import { Module } from '@nestjs/common';
import { VoiceController } from './voice.controller';
import { VoiceService } from './voice.service';
import { GoogleCloudSpeechClient } from './google-cloud-speech.client';
import { WeatherModule } from '../weather/weather.module';
import { MarketModule } from '../market/market.module';

@Module({
  imports: [WeatherModule, MarketModule],
  controllers: [VoiceController],
  providers: [VoiceService, GoogleCloudSpeechClient],
  exports: [VoiceService, GoogleCloudSpeechClient],
})
export class VoiceModule { }

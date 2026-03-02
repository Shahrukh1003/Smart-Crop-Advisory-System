import { Module } from '@nestjs/common';
import { VoiceController } from './voice.controller';
import { VoiceService } from './voice.service';
import { GoogleCloudSpeechClient } from './google-cloud-speech.client';

@Module({
  controllers: [VoiceController],
  providers: [VoiceService, GoogleCloudSpeechClient],
  exports: [VoiceService, GoogleCloudSpeechClient],
})
export class VoiceModule {}

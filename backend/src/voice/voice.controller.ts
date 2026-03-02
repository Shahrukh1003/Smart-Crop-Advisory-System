import { Controller, Post, Body, Get, UseGuards, Query, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { VoiceService } from './voice.service';
import {
  SpeechToTextRequestDto,
  TextToSpeechRequestDto,
  VoiceCommandRequestDto,
  VoiceCommandResponseDto,
  Language,
} from './dto/voice.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('voice')
@Controller('voice')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class VoiceController {
  constructor(private readonly voiceService: VoiceService) {}

  @Post('speech-to-text')
  @ApiOperation({ summary: 'Convert speech audio to text' })
  @ApiResponse({ status: 200, description: 'Transcribed text' })
  @ApiResponse({ status: 503, description: 'Voice service unavailable' })
  async speechToText(@Body() dto: SpeechToTextRequestDto): Promise<{ text: string; fallback?: boolean }> {
    try {
      const text = await this.voiceService.speechToText(dto);
      return { text };
    } catch (error) {
      // Return fallback prompt instead of throwing
      return {
        text: this.voiceService.getFallbackPrompt(dto.language),
        fallback: true,
      };
    }
  }

  @Post('text-to-speech')
  @ApiOperation({ summary: 'Convert text to speech audio' })
  @ApiResponse({ status: 200, description: 'Base64 encoded audio' })
  @ApiResponse({ status: 503, description: 'Voice service unavailable' })
  async textToSpeech(@Body() dto: TextToSpeechRequestDto): Promise<{ audio: string; fallback?: boolean }> {
    try {
      const audio = await this.voiceService.textToSpeech(dto);
      return { audio };
    } catch (error) {
      // Return empty audio with fallback flag
      return { audio: '', fallback: true };
    }
  }

  @Post('command')
  @ApiOperation({ summary: 'Process voice command end-to-end' })
  @ApiResponse({ status: 200, type: VoiceCommandResponseDto })
  async processCommand(@Body() dto: VoiceCommandRequestDto): Promise<VoiceCommandResponseDto> {
    return this.voiceService.processVoiceCommand(dto);
  }

  @Get('supported-intents')
  @ApiOperation({ summary: 'Get list of supported voice command intents' })
  async getSupportedIntents(): Promise<{ intents: string[] }> {
    return { intents: this.voiceService.getSupportedIntents() };
  }

  @Get('status')
  @ApiOperation({ summary: 'Get voice service status' })
  @ApiResponse({ status: 200, description: 'Voice service status' })
  async getStatus(): Promise<{ available: boolean; fallbackEnabled: boolean; supportedLanguages: string[] }> {
    return this.voiceService.getStatus();
  }

  @Get('fallback-prompt')
  @ApiOperation({ summary: 'Get fallback prompt in specified language' })
  @ApiQuery({ name: 'language', enum: ['kn', 'hi', 'ta', 'te', 'en'], required: false })
  async getFallbackPrompt(@Query('language') language: Language = 'en'): Promise<{ prompt: string }> {
    return { prompt: this.voiceService.getFallbackPrompt(language) };
  }
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum } from 'class-validator';

export type Language = 'kn' | 'hi' | 'ta' | 'te' | 'en';

export class SpeechToTextRequestDto {
  @ApiProperty({ description: 'Base64 encoded audio data' })
  @IsString()
  audioData: string;

  @ApiProperty({ enum: ['kn', 'hi', 'ta', 'te', 'en'], description: 'Language code' })
  @IsString()
  language: Language;

  @ApiPropertyOptional({ description: 'Audio encoding format' })
  @IsOptional()
  @IsString()
  encoding?: string;
}

export class TextToSpeechRequestDto {
  @ApiProperty({ description: 'Text to convert to speech' })
  @IsString()
  text: string;

  @ApiProperty({ enum: ['kn', 'hi', 'ta', 'te', 'en'], description: 'Language code' })
  @IsString()
  language: Language;
}

export class VoiceCommandRequestDto {
  @ApiProperty({ description: 'Base64 encoded audio or transcribed text' })
  @IsString()
  input: string;

  @ApiProperty({ enum: ['kn', 'hi', 'ta', 'te', 'en'] })
  @IsString()
  language: Language;

  @ApiPropertyOptional({ description: 'Whether input is already transcribed text' })
  @IsOptional()
  isText?: boolean;
}

export class IntentResult {
  @ApiProperty({ example: 'crop_advisory' })
  intent: string;

  @ApiProperty({ example: 0.92 })
  confidence: number;

  @ApiProperty({ example: { crop: 'Rice', location: 'Bangalore' } })
  parameters: Record<string, string>;
}

export class VoiceCommandResponseDto {
  @ApiProperty()
  transcribedText: string;

  @ApiProperty()
  intent: IntentResult;

  @ApiProperty()
  responseText: string;

  @ApiPropertyOptional({ description: 'Base64 encoded audio response' })
  audioResponse?: string;

  @ApiProperty()
  success: boolean;
}

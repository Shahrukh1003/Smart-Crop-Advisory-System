import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleCloudSpeechClient } from './google-cloud-speech.client';
import { Language, SpeechToTextRequestDto, TextToSpeechRequestDto, VoiceCommandRequestDto, VoiceCommandResponseDto, IntentResult } from './dto/voice.dto';

const INTENT_PATTERNS: Record<string, { patterns: RegExp[]; keywords: string[] }> = {
  crop_advisory: { patterns: [/what.*crop.*plant/i, /which.*crop.*grow/i, /recommend.*crop/i], keywords: ['crop', 'plant', 'grow', 'sow', 'recommend'] },
  pest_detection: { patterns: [/pest.*detect/i, /disease.*crop/i, /insect.*attack/i, /leaf.*problem/i], keywords: ['pest', 'disease', 'insect', 'bug', 'leaf'] },
  weather: { patterns: [/weather.*today/i, /rain.*forecast/i, /temperature/i], keywords: ['weather', 'rain', 'temperature', 'forecast'] },
  market_price: { patterns: [/price.*crop/i, /market.*rate/i, /mandi.*price/i], keywords: ['price', 'market', 'sell', 'rate', 'mandi'] },
  soil_analysis: { patterns: [/soil.*test/i, /fertilizer.*recommend/i], keywords: ['soil', 'fertilizer', 'nutrient'] },
};

const FALLBACK_PROMPT = 'Voice unavailable. Please type your query.';
const NOT_UNDERSTOOD = 'I did not understand';

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);
  private voiceApiAvailable = true;
  constructor(private readonly configService: ConfigService, private readonly googleCloudClient: GoogleCloudSpeechClient) {}

  async speechToText(dto: SpeechToTextRequestDto): Promise<string> {
    try { const r = await this.googleCloudClient.speechToText(dto.audioData, dto.language); this.voiceApiAvailable = true; return r.transcript; }
    catch (e) { this.voiceApiAvailable = false; throw e; }
  }

  async textToSpeech(dto: TextToSpeechRequestDto): Promise<string> {
    try { const r = await this.googleCloudClient.textToSpeech(dto.text, dto.language); this.voiceApiAvailable = true; return r.audioContent; }
    catch (e) { this.voiceApiAvailable = false; throw e; }
  }

  async processVoiceCommand(dto: VoiceCommandRequestDto): Promise<VoiceCommandResponseDto> {
    let transcribedText: string;
    if (dto.isText) transcribedText = dto.input;
    else { try { transcribedText = await this.speechToText({ audioData: dto.input, language: dto.language }); } catch { return this.createFallbackResponse(dto.language); } }
    const intent = this.recognizeIntent(transcribedText, dto.language);
    const responseText = this.generateResponse(intent, dto.language);
    let audioResponse: string | undefined;
    try { audioResponse = await this.textToSpeech({ text: responseText, language: dto.language }); } catch {}
    return { transcribedText, intent, responseText, audioResponse, success: intent.confidence > 0.5 };
  }

  recognizeIntent(text: string, language: Language = 'en'): IntentResult {
    const normalizedText = text.toLowerCase();
    let bestIntent = 'unknown', bestConfidence = 0;
    const parameters: Record<string, string> = {};
    for (const [intentName, { patterns, keywords }] of Object.entries(INTENT_PATTERNS)) {
      let score = 0;
      for (const p of patterns) { if (p.test(normalizedText)) { score += 0.4; break; } }
      score += (keywords.filter(kw => normalizedText.includes(kw.toLowerCase())).length / keywords.length) * 0.6;
      if (score > bestConfidence) { bestConfidence = score; bestIntent = intentName; }
    }
    if (normalizedText.includes('rice')) parameters.crop = 'Rice';
    if (normalizedText.includes('today')) parameters.timeframe = 'today';
    return { intent: bestIntent, confidence: Math.min(bestConfidence, 0.99), parameters };
  }

  private generateResponse(intent: IntentResult, language: Language): string {
    if (intent.confidence < 0.5) return NOT_UNDERSTOOD;
    const crop = intent.parameters.crop || 'crops';
    switch (intent.intent) {
      case 'crop_advisory': return 'I recommend growing ' + crop;
      case 'pest_detection': return 'Upload a photo for pest detection';
      case 'weather': return 'Weather is partly cloudy, 28C';
      case 'market_price': return crop + ' price is Rs 2500/quintal';
      case 'soil_analysis': return 'Enter soil test results';
      default: return NOT_UNDERSTOOD;
    }
  }

  private createFallbackResponse(language: Language): VoiceCommandResponseDto {
    return { transcribedText: '', intent: { intent: 'fallback', confidence: 0, parameters: {} }, responseText: FALLBACK_PROMPT, audioResponse: undefined, success: false };
  }

  isVoiceApiAvailable(): boolean { return this.voiceApiAvailable && this.googleCloudClient.isAvailable(); }
  getFallbackPrompt(language: Language): string { return FALLBACK_PROMPT; }
  getSupportedIntents(): string[] { return Object.keys(INTENT_PATTERNS); }
  isLanguageSupported(language: string): boolean { return ['kn', 'hi', 'ta', 'te', 'en'].includes(language); }
  getStatus(): { available: boolean; fallbackEnabled: boolean; supportedLanguages: string[] } { return { available: this.isVoiceApiAvailable(), fallbackEnabled: this.googleCloudClient.isFallbackEnabled(), supportedLanguages: this.googleCloudClient.getSupportedLanguages() }; }
}

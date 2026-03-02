import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleCloudSpeechClient } from './google-cloud-speech.client';
import { WeatherService } from '../weather/weather.service';
import { MarketService } from '../market/market.service';
import { Language, SpeechToTextRequestDto, TextToSpeechRequestDto, VoiceCommandRequestDto, VoiceCommandResponseDto, IntentResult } from './dto/voice.dto';

const INTENT_PATTERNS: Record<string, { patterns: RegExp[]; keywords: string[] }> = {
  crop_advisory: { patterns: [/what.*crop.*plant/i, /which.*crop.*grow/i, /recommend.*crop/i], keywords: ['crop', 'plant', 'grow', 'sow', 'recommend'] },
  pest_detection: { patterns: [/pest.*detect/i, /disease.*crop/i, /insect.*attack/i, /leaf.*problem/i], keywords: ['pest', 'disease', 'insect', 'bug', 'leaf'] },
  weather: { patterns: [/weather.*today/i, /rain.*forecast/i, /temperature/i], keywords: ['weather', 'rain', 'temperature', 'forecast'] },
  market_price: { patterns: [/price.*crop/i, /market.*rate/i, /mandi.*price/i], keywords: ['price', 'market', 'sell', 'rate', 'mandi'] },
  soil_analysis: { patterns: [/soil.*test/i, /fertilizer.*recommend/i], keywords: ['soil', 'fertilizer', 'nutrient'] },
};

const FALLBACK_PROMPT = 'Voice unavailable. Please type your query.';
const NOT_UNDERSTOOD = 'I did not understand your query. Please try again.';

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);
  private voiceApiAvailable = true;

  constructor(
    private readonly configService: ConfigService,
    private readonly googleCloudClient: GoogleCloudSpeechClient,
    private readonly weatherService: WeatherService,
    private readonly marketService: MarketService,
  ) { }

  async speechToText(dto: SpeechToTextRequestDto): Promise<string> {
    try {
      const r = await this.googleCloudClient.speechToText(dto.audioData, dto.language);
      this.voiceApiAvailable = true;
      return r.transcript;
    } catch (e) {
      this.voiceApiAvailable = false;
      throw e;
    }
  }

  async textToSpeech(dto: TextToSpeechRequestDto): Promise<string> {
    try {
      const r = await this.googleCloudClient.textToSpeech(dto.text, dto.language);
      this.voiceApiAvailable = true;
      return r.audioContent;
    } catch (e) {
      this.voiceApiAvailable = false;
      throw e;
    }
  }

  async processVoiceCommand(dto: VoiceCommandRequestDto): Promise<VoiceCommandResponseDto> {
    let transcribedText: string;
    if (dto.isText) {
      transcribedText = dto.input;
    } else {
      try {
        transcribedText = await this.speechToText({ audioData: dto.input, language: dto.language });
      } catch {
        return this.createFallbackResponse(dto.language);
      }
    }

    const intent = this.recognizeIntent(transcribedText, dto.language);
    const responseText = await this.generateResponse(intent, dto.language);

    let audioResponse: string | undefined;
    try {
      audioResponse = await this.textToSpeech({ text: responseText, language: dto.language });
    } catch {
      // Audio response is optional
    }

    return { transcribedText, intent, responseText, audioResponse, success: intent.confidence > 0.5 };
  }

  recognizeIntent(text: string, language: Language = 'en'): IntentResult {
    const normalizedText = text.toLowerCase();
    let bestIntent = 'unknown';
    let bestConfidence = 0;
    const parameters: Record<string, string> = {};

    for (const [intentName, { patterns, keywords }] of Object.entries(INTENT_PATTERNS)) {
      let score = 0;
      for (const p of patterns) {
        if (p.test(normalizedText)) { score += 0.4; break; }
      }
      score += (keywords.filter(kw => normalizedText.includes(kw.toLowerCase())).length / keywords.length) * 0.6;
      if (score > bestConfidence) { bestConfidence = score; bestIntent = intentName; }
    }

    // Extract crop name from text
    const crops = ['rice', 'wheat', 'maize', 'cotton', 'sugarcane', 'groundnut', 'soybean', 'tomato', 'onion', 'potato'];
    for (const crop of crops) {
      if (normalizedText.includes(crop)) {
        parameters.crop = crop.charAt(0).toUpperCase() + crop.slice(1);
        break;
      }
    }
    if (normalizedText.includes('today')) parameters.timeframe = 'today';

    return { intent: bestIntent, confidence: Math.min(bestConfidence, 0.99), parameters };
  }

  /**
   * Generate response using REAL data from weather and market services.
   * Falls back to generic guidance if services are unavailable.
   */
  private async generateResponse(intent: IntentResult, language: Language): Promise<string> {
    if (intent.confidence < 0.5) return NOT_UNDERSTOOD;

    const crop = intent.parameters.crop || 'Rice';

    switch (intent.intent) {
      case 'crop_advisory':
        return `Based on your region, ${crop} is a good choice. Go to Crop Advisory for personalized recommendations based on your soil data.`;

      case 'pest_detection':
        return 'Upload a photo of the affected plant through Pest Detection to get instant diagnosis and treatment recommendations.';

      case 'weather':
        return await this.getWeatherResponse();

      case 'market_price':
        return await this.getMarketResponse(crop);

      case 'soil_analysis':
        return 'Enter your soil test results in Soil Analysis to get fertilizer recommendations and nutrient deficiency analysis.';

      default:
        return NOT_UNDERSTOOD;
    }
  }

  /**
   * Get real weather data for voice response
   */
  private async getWeatherResponse(): Promise<string> {
    try {
      // Default to Bangalore coordinates
      const weather = await this.weatherService.getWeatherData(12.9716, 77.5946);
      const current = weather.current;

      let response = `Current weather: ${current.temperature}°C, ${current.description}. Humidity: ${current.humidity}%.`;

      if (current.rainfall && current.rainfall > 0) {
        response += ` Rainfall: ${current.rainfall}mm.`;
      }

      if (weather.irrigationRecommendation) {
        response += ` Advisory: ${weather.irrigationRecommendation.action}.`;
      }

      if (weather.pestRiskAlert) {
        response += ` Warning: ${weather.pestRiskAlert.risk}.`;
      }

      return response;
    } catch (error) {
      this.logger.warn('Failed to get real weather data for voice response', error);
      return 'Weather data is currently being updated. Please check the Weather screen for the latest forecast.';
    }
  }

  /**
   * Get real market price data for voice response
   */
  private async getMarketResponse(crop: string): Promise<string> {
    try {
      // Default to Bangalore coordinates
      const prices = await this.marketService.getPrices(crop, 12.9716, 77.5946, 100);

      if (prices.length > 0) {
        const bestPrice = prices[0]; // Already sorted by modal price descending
        let response = `${crop} price at ${bestPrice.market.name}: ₹${bestPrice.price.modal}/${bestPrice.price.unit}`;

        if (bestPrice.trend) {
          response += ` (${bestPrice.trend})`;
        }

        if (prices.length > 1) {
          const secondPrice = prices[1];
          response += `. Also available at ${secondPrice.market.name}: ₹${secondPrice.price.modal}/${secondPrice.price.unit}`;
        }

        response += '.';
        return response;
      }

      return `${crop} market prices are being updated. Check Market Prices for the latest rates from nearby mandis.`;
    } catch (error) {
      this.logger.warn('Failed to get real market data for voice response', error);
      return `Market prices for ${crop} are currently being updated. Check the Market Prices screen for details.`;
    }
  }

  private createFallbackResponse(language: Language): VoiceCommandResponseDto {
    return {
      transcribedText: '',
      intent: { intent: 'fallback', confidence: 0, parameters: {} },
      responseText: FALLBACK_PROMPT,
      audioResponse: undefined,
      success: false,
    };
  }

  isVoiceApiAvailable(): boolean {
    return this.voiceApiAvailable && this.googleCloudClient.isAvailable();
  }

  getFallbackPrompt(language: Language): string { return FALLBACK_PROMPT; }
  getSupportedIntents(): string[] { return Object.keys(INTENT_PATTERNS); }
  isLanguageSupported(language: string): boolean { return ['kn', 'hi', 'ta', 'te', 'en'].includes(language); }

  getStatus(): { available: boolean; fallbackEnabled: boolean; supportedLanguages: string[] } {
    return {
      available: this.isVoiceApiAvailable(),
      fallbackEnabled: this.googleCloudClient.isFallbackEnabled(),
      supportedLanguages: this.googleCloudClient.getSupportedLanguages(),
    };
  }
}

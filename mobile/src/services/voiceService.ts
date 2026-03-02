import { Audio } from 'expo-av';
import { api } from './api';

export type Language = 'en' | 'hi' | 'kn' | 'ta' | 'te';

export interface VoiceCommandResult {
  transcribedText: string;
  intent: {
    intent: string;
    confidence: number;
    parameters: Record<string, string>;
  };
  responseText: string;
  audioResponse?: string;
  success: boolean;
}

class VoiceService {
  private recording: Audio.Recording | null = null;
  private sound: Audio.Sound | null = null;
  private isRecording = false;

  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting audio permissions:', error);
      return false;
    }
  }

  async startRecording(): Promise<boolean> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.warn('Audio permission not granted');
        return false;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      this.recording = recording;
      this.isRecording = true;
      return true;
    } catch (error) {
      console.error('Error starting recording:', error);
      return false;
    }
  }

  async stopRecording(): Promise<string | null> {
    try {
      if (!this.recording) return null;

      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      this.recording = null;
      this.isRecording = false;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      return uri;
    } catch (error) {
      console.error('Error stopping recording:', error);
      return null;
    }
  }

  async processVoiceCommand(audioUri: string, language: Language = 'en'): Promise<VoiceCommandResult> {
    try {
      // Create form data with audio file
      const formData = new FormData();
      formData.append('audio', {
        uri: audioUri,
        type: 'audio/m4a',
        name: 'recording.m4a',
      } as any);
      formData.append('language', language);

      const response = await api.post('/voice/command', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return response.data;
    } catch (error) {
      console.error('Error processing voice command:', error);
      // Return a fallback response with text input prompt
      return {
        transcribedText: '',
        intent: { intent: 'fallback', confidence: 0, parameters: {} },
        responseText: this.getFallbackPrompt(language),
        success: false,
      };
    }
  }

  private getFallbackPrompt(language: Language): string {
    const prompts: Record<Language, string> = {
      en: 'Voice unavailable. Please type your query.',
      hi: 'आवाज उपलब्ध नहीं है। कृपया टाइप करें।',
      kn: 'ಧ್ವನಿ ಲಭ್ಯವಿಲ್ಲ. ದಯವಿಟ್ಟು ಟೈಪ್ ಮಾಡಿ.',
      ta: 'குரல் கிடைக்கவில்லை. தயவுசெய்து தட்டச்சு செய்யவும்.',
      te: 'వాయిస్ అందుబాటులో లేదు. దయచేసి టైప్ చేయండి.',
    };
    return prompts[language];
  }

  async processTextCommand(text: string, language: Language = 'en'): Promise<VoiceCommandResult> {
    try {
      const response = await api.post('/voice/command', {
        input: text,
        language,
        isText: true,
      });

      return response.data;
    } catch (error) {
      console.error('Error processing text command:', error);
      return {
        transcribedText: text,
        intent: { intent: 'unknown', confidence: 0, parameters: {} },
        responseText: this.getErrorMessage(language),
        success: false,
      };
    }
  }

  async playAudioResponse(base64Audio: string): Promise<void> {
    try {
      if (this.sound) {
        await this.sound.unloadAsync();
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/mp3;base64,${base64Audio}` },
        { shouldPlay: true }
      );

      this.sound = sound;
      await sound.playAsync();
    } catch (error) {
      console.error('Error playing audio response:', error);
    }
  }

  async speakText(text: string, language: Language = 'en'): Promise<void> {
    try {
      const response = await api.post('/voice/text-to-speech', {
        text,
        language,
      });

      if (response.data?.audioData) {
        await this.playAudioResponse(response.data.audioData);
      }
    } catch (error) {
      console.error('Error with text-to-speech:', error);
    }
  }

  getRecordingStatus(): boolean {
    return this.isRecording;
  }

  private getErrorMessage(language: Language): string {
    const messages: Record<Language, string> = {
      en: 'Sorry, I could not understand. Please try again.',
      hi: 'क्षमा करें, मुझे समझ नहीं आया। कृपया पुनः प्रयास करें।',
      kn: 'ಕ್ಷಮಿಸಿ, ನನಗೆ ಅರ್ಥವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
      ta: 'மன்னிக்கவும், புரியவில்லை. மீண்டும் முயற்சிக்கவும்.',
      te: 'క్షమించండి, నాకు అర్థం కాలేదు. దయచేసి మళ్ళీ ప్రయత్నించండి.',
    };
    return messages[language];
  }

  getSupportedLanguages(): { code: Language; name: string; nativeName: string }[] {
    return [
      { code: 'en', name: 'English', nativeName: 'English' },
      { code: 'hi', name: 'Hindi', nativeName: 'हिंदी' },
      { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
      { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
      { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
    ];
  }

  getSampleCommands(language: Language): string[] {
    const commands: Record<Language, string[]> = {
      en: [
        'What crop should I plant?',
        'What is the weather today?',
        'What is the price of rice?',
        'How to treat pest on tomato?',
        'When should I irrigate?',
      ],
      hi: [
        'मुझे कौन सी फसल लगानी चाहिए?',
        'आज का मौसम कैसा है?',
        'चावल का भाव क्या है?',
        'टमाटर पर कीट का इलाज कैसे करें?',
      ],
      kn: [
        'ನಾನು ಯಾವ ಬೆಳೆ ಬೆಳೆಯಬೇಕು?',
        'ಇಂದಿನ ಹವಾಮಾನ ಏನು?',
        'ಅಕ್ಕಿಯ ಬೆಲೆ ಎಷ್ಟು?',
      ],
      ta: [
        'நான் என்ன பயிர் நடவு செய்ய வேண்டும்?',
        'இன்றைய வானிலை என்ன?',
        'அரிசி விலை என்ன?',
      ],
      te: [
        'నేను ఏ పంట వేయాలి?',
        'ఈ రోజు వాతావరణం ఎలా ఉంది?',
        'బియ్యం ధర ఎంత?',
      ],
    };
    return commands[language] || commands.en;
  }

  async cleanup(): Promise<void> {
    if (this.recording) {
      try {
        await this.recording.stopAndUnloadAsync();
      } catch (e) {
        // Ignore cleanup errors
      }
      this.recording = null;
    }
    if (this.sound) {
      try {
        await this.sound.unloadAsync();
      } catch (e) {
        // Ignore cleanup errors
      }
      this.sound = null;
    }
    this.isRecording = false;
  }
}

export const voiceService = new VoiceService();

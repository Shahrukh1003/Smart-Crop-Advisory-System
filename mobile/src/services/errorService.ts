import { Alert } from 'react-native';
import { 
  Language, 
  ErrorMessage, 
  getErrorMessage, 
  getLocalizedError, 
  getErrorCodeFromStatus 
} from '../utils/errorMessages';

/**
 * Error handling service that provides localized error messages
 * based on the user's language preference
 */
class ErrorService {
  private currentLanguage: Language = 'en';

  /**
   * Set the current language for error messages
   */
  setLanguage(language: Language): void {
    this.currentLanguage = language;
  }

  /**
   * Get the current language
   */
  getLanguage(): Language {
    return this.currentLanguage;
  }

  /**
   * Get a localized error message by error code
   */
  getMessage(errorCode: string): ErrorMessage {
    return getErrorMessage(errorCode, this.currentLanguage);
  }

  /**
   * Get a localized error message from an axios error
   */
  getErrorFromResponse(error: any): ErrorMessage {
    return getLocalizedError(error, this.currentLanguage);
  }

  /**
   * Show an alert with localized error message
   */
  showAlert(
    errorCode: string,
    onAction?: () => void,
    onDismiss?: () => void
  ): void {
    const errorMessage = this.getMessage(errorCode);
    
    const buttons: any[] = [];
    
    if (onDismiss) {
      buttons.push({
        text: this.getDismissText(),
        style: 'cancel',
        onPress: onDismiss,
      });
    }
    
    if (errorMessage.action && onAction) {
      buttons.push({
        text: errorMessage.action,
        onPress: onAction,
      });
    }
    
    if (buttons.length === 0) {
      buttons.push({ text: 'OK' });
    }

    Alert.alert(errorMessage.title, errorMessage.message, buttons);
  }

  /**
   * Show an alert from an axios error response
   */
  showAlertFromError(
    error: any,
    onAction?: () => void,
    onDismiss?: () => void
  ): void {
    const errorMessage = this.getErrorFromResponse(error);
    
    const buttons: any[] = [];
    
    if (onDismiss) {
      buttons.push({
        text: this.getDismissText(),
        style: 'cancel',
        onPress: onDismiss,
      });
    }
    
    if (errorMessage.action && onAction) {
      buttons.push({
        text: errorMessage.action,
        onPress: onAction,
      });
    }
    
    if (buttons.length === 0) {
      buttons.push({ text: 'OK' });
    }

    Alert.alert(errorMessage.title, errorMessage.message, buttons);
  }

  /**
   * Get localized dismiss text
   */
  private getDismissText(): string {
    const dismissTexts: Record<Language, string> = {
      en: 'Dismiss',
      kn: 'ವಜಾಗೊಳಿಸಿ',
      hi: 'खारिज करें',
      ta: 'நிராகரி',
      te: 'తీసివేయి',
    };
    return dismissTexts[this.currentLanguage];
  }

  /**
   * Get error code from HTTP status
   */
  getErrorCodeFromStatus(status: number): string {
    return getErrorCodeFromStatus(status);
  }

  /**
   * Check if error is a network error
   */
  isNetworkError(error: any): boolean {
    return !error.response && (
      error.code === 'ECONNABORTED' ||
      error.message?.includes('Network Error') ||
      error.message?.includes('timeout')
    );
  }

  /**
   * Check if error is an authentication error
   */
  isAuthError(error: any): boolean {
    return error.response?.status === 401 || error.response?.status === 403;
  }

  /**
   * Check if error is a rate limit error
   */
  isRateLimitError(error: any): boolean {
    return error.response?.status === 429;
  }
}

// Export singleton instance
export const errorService = new ErrorService();

// Export for testing
export { ErrorService };

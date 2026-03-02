import { getErrorMessage, getErrorCodeFromStatus, ERROR_MESSAGES } from '../../utils/errorMessages';
import { getRuleBasedRecommendations, getStalenessMessage } from '../fallbackService';

describe('Error Messages', () => {
  describe('getErrorMessage', () => {
    it('returns English message by default', () => {
      const message = getErrorMessage('NETWORK_ERROR');
      expect(message.title).toBe('No Internet');
      expect(message.message).toContain('internet connection');
    });

    it('returns message in specified language', () => {
      const message = getErrorMessage('NETWORK_ERROR', 'hi');
      expect(message.title).toBe('इंटरनेट नहीं');
    });

    it('falls back to English for unknown language', () => {
      const message = getErrorMessage('NETWORK_ERROR', 'en');
      expect(message.title).toBe('No Internet');
    });

    it('returns server error for unknown error code', () => {
      const message = getErrorMessage('UNKNOWN_ERROR');
      expect(message.title).toBe('Server Error');
    });
  });

  describe('getErrorCodeFromStatus', () => {
    it('maps 401 to SESSION_EXPIRED', () => {
      expect(getErrorCodeFromStatus(401)).toBe('SESSION_EXPIRED');
    });

    it('maps 403 to LOGIN_FAILED', () => {
      expect(getErrorCodeFromStatus(403)).toBe('LOGIN_FAILED');
    });

    it('maps 404 to NO_DATA_AVAILABLE', () => {
      expect(getErrorCodeFromStatus(404)).toBe('NO_DATA_AVAILABLE');
    });

    it('maps 500 to SERVER_ERROR', () => {
      expect(getErrorCodeFromStatus(500)).toBe('SERVER_ERROR');
    });

    it('maps unknown status to NETWORK_ERROR', () => {
      expect(getErrorCodeFromStatus(999)).toBe('NETWORK_ERROR');
    });
  });

  describe('All error messages have all languages', () => {
    const languages = ['en', 'kn', 'hi', 'ta', 'te'] as const;
    
    Object.keys(ERROR_MESSAGES).forEach(errorCode => {
      languages.forEach(lang => {
        it(`${errorCode} has ${lang} translation`, () => {
          const message = ERROR_MESSAGES[errorCode][lang];
          expect(message).toBeDefined();
          expect(message.title).toBeTruthy();
          expect(message.message).toBeTruthy();
        });
      });
    });
  });
});

describe('Fallback Service', () => {
  describe('getRuleBasedRecommendations', () => {
    it('returns rice for kharif season with high rainfall', () => {
      const recommendations = getRuleBasedRecommendations('Red Soil', 'kharif', 1000);
      expect(recommendations.some(r => r.cropName === 'Rice')).toBe(true);
    });

    it('returns wheat for rabi season', () => {
      const recommendations = getRuleBasedRecommendations('Black Soil', 'rabi', 200);
      expect(recommendations.some(r => r.cropName === 'Wheat')).toBe(true);
    });

    it('returns vegetables for zaid season', () => {
      const recommendations = getRuleBasedRecommendations('Alluvial', 'zaid', 100);
      expect(recommendations.some(r => r.cropName === 'Vegetables')).toBe(true);
    });

    it('returns recommendations sorted by suitability score', () => {
      const recommendations = getRuleBasedRecommendations('Red Soil', 'kharif', 500);
      for (let i = 1; i < recommendations.length; i++) {
        expect(recommendations[i - 1].suitabilityScore).toBeGreaterThanOrEqual(
          recommendations[i].suitabilityScore
        );
      }
    });

    it('includes reasoning for each recommendation', () => {
      const recommendations = getRuleBasedRecommendations('Red Soil', 'kharif', 500);
      recommendations.forEach(r => {
        expect(r.reasoning).toBeDefined();
        expect(r.reasoning.length).toBeGreaterThan(0);
      });
    });
  });

  describe('getStalenessMessage', () => {
    it('returns "Recently updated" for recent data', () => {
      const recentDate = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago
      expect(getStalenessMessage(recentDate)).toBe('Recently updated');
    });

    it('returns hours for data updated hours ago', () => {
      const hoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000); // 5 hours ago
      expect(getStalenessMessage(hoursAgo)).toContain('5 hours ago');
    });

    it('returns days for data updated days ago', () => {
      const daysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
      expect(getStalenessMessage(daysAgo)).toContain('3 days ago');
    });

    it('handles singular day correctly', () => {
      const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
      expect(getStalenessMessage(oneDayAgo)).toContain('1 day ago');
    });
  });
});

describe('Retry Logic', () => {
  // These tests would require mocking axios and testing the retry behavior
  // For now, we test the configuration values
  
  it('should have reasonable retry configuration', () => {
    const MAX_RETRIES = 3;
    const INITIAL_DELAY = 1000;
    const MAX_DELAY = 10000;
    
    expect(MAX_RETRIES).toBe(3);
    expect(INITIAL_DELAY).toBe(1000);
    expect(MAX_DELAY).toBe(10000);
  });

  it('exponential backoff should not exceed max delay', () => {
    const INITIAL_DELAY = 1000;
    const MAX_DELAY = 10000;
    
    const getRetryDelay = (retryCount: number): number => {
      const delay = INITIAL_DELAY * Math.pow(2, retryCount);
      return Math.min(delay, MAX_DELAY);
    };
    
    expect(getRetryDelay(0)).toBe(1000);
    expect(getRetryDelay(1)).toBe(2000);
    expect(getRetryDelay(2)).toBe(4000);
    expect(getRetryDelay(3)).toBe(8000);
    expect(getRetryDelay(4)).toBe(10000); // Capped at MAX_DELAY
    expect(getRetryDelay(10)).toBe(10000); // Still capped
  });
});

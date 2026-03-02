import * as fc from 'fast-check';
import {
  Language,
  ErrorMessage,
  ERROR_MESSAGES,
  ERROR_CODES,
  SUPPORTED_LANGUAGES,
  getErrorMessage,
  getLocalizedError,
  getErrorCodeFromStatus,
} from '../errorMessages';

/**
 * **Feature: project-finalization, Property 28: Error messages are localized**
 * **Validates: Requirements 9.4**
 *
 * For any error displayed to the user, the error message should be in the user's selected language.
 */
describe('Property 28: Error messages are localized', () => {
  // Generator for supported languages
  const languageGenerator = fc.constantFrom<Language>(...SUPPORTED_LANGUAGES);

  // Generator for error codes
  const errorCodeGenerator = fc.constantFrom(...ERROR_CODES);

  // Generator for HTTP status codes
  const httpStatusGenerator = fc.constantFrom(
    400, 401, 403, 404, 408, 409, 429, 500, 502, 503, 504
  );

  describe('All error codes have translations for all languages', () => {
    it('every error code should have a translation for every supported language', () => {
      fc.assert(
        fc.property(errorCodeGenerator, languageGenerator, (errorCode, language) => {
          const message = getErrorMessage(errorCode, language);

          // Message should exist and have required fields
          expect(message).toBeDefined();
          expect(message.title).toBeDefined();
          expect(message.title.length).toBeGreaterThan(0);
          expect(message.message).toBeDefined();
          expect(message.message.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it('error messages should have non-empty title and message', () => {
      fc.assert(
        fc.property(errorCodeGenerator, languageGenerator, (errorCode, language) => {
          const message = getErrorMessage(errorCode, language);

          // Title and message should be non-empty strings
          expect(typeof message.title).toBe('string');
          expect(typeof message.message).toBe('string');
          expect(message.title.trim().length).toBeGreaterThan(0);
          expect(message.message.trim().length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Language-specific translations are distinct', () => {
    it('translations for different languages should be different (for most error codes)', () => {
      // For each error code, check that at least some languages have different translations
      for (const errorCode of ERROR_CODES) {
        const translations = SUPPORTED_LANGUAGES.map((lang) =>
          getErrorMessage(errorCode, lang)
        );

        // Get unique titles (some languages may share similar translations)
        const uniqueTitles = new Set(translations.map((t) => t.title));

        // At least 2 different translations should exist (English vs others)
        expect(uniqueTitles.size).toBeGreaterThanOrEqual(2);
      }
    });

    it('English translation should always be available as fallback', () => {
      fc.assert(
        fc.property(errorCodeGenerator, (errorCode) => {
          const englishMessage = getErrorMessage(errorCode, 'en');

          expect(englishMessage).toBeDefined();
          expect(englishMessage.title).toBeDefined();
          expect(englishMessage.message).toBeDefined();
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('HTTP status codes map to correct error codes', () => {
    it('HTTP status codes should map to valid error codes', () => {
      fc.assert(
        fc.property(httpStatusGenerator, (status) => {
          const errorCode = getErrorCodeFromStatus(status);

          // Error code should be a valid key in ERROR_MESSAGES
          expect(ERROR_CODES).toContain(errorCode);
        }),
        { numRuns: 100 }
      );
    });

    it('specific status codes should map to expected error codes', () => {
      // Test specific mappings
      expect(getErrorCodeFromStatus(401)).toBe('SESSION_EXPIRED');
      expect(getErrorCodeFromStatus(403)).toBe('LOGIN_FAILED');
      expect(getErrorCodeFromStatus(404)).toBe('NO_DATA_AVAILABLE');
      expect(getErrorCodeFromStatus(408)).toBe('TIMEOUT_ERROR');
      expect(getErrorCodeFromStatus(409)).toBe('PHONE_ALREADY_EXISTS');
      expect(getErrorCodeFromStatus(429)).toBe('RATE_LIMIT_ERROR');
      expect(getErrorCodeFromStatus(500)).toBe('SERVER_ERROR');
      expect(getErrorCodeFromStatus(502)).toBe('SERVER_ERROR');
      expect(getErrorCodeFromStatus(503)).toBe('SERVER_ERROR');
    });
  });

  describe('Localized error from axios errors', () => {
    it('network errors without response should return NETWORK_ERROR in user language', () => {
      fc.assert(
        fc.property(languageGenerator, (language) => {
          // Network error without response (no internet)
          const networkError = { message: 'Network Error' };
          const message = getLocalizedError(networkError, language);

          expect(message).toBeDefined();
          expect(message.title).toBe(getErrorMessage('NETWORK_ERROR', language).title);
        }),
        { numRuns: 100 }
      );
    });

    it('timeout errors should return TIMEOUT_ERROR in user language', () => {
      fc.assert(
        fc.property(languageGenerator, (language) => {
          const timeoutError = { code: 'ECONNABORTED', message: 'timeout of 30000ms exceeded' };
          const message = getLocalizedError(timeoutError, language);

          expect(message).toBeDefined();
          expect(message.title).toBe(getErrorMessage('TIMEOUT_ERROR', language).title);
        }),
        { numRuns: 100 }
      );
    });

    it('HTTP errors should return localized messages based on status', () => {
      fc.assert(
        fc.property(httpStatusGenerator, languageGenerator, (status, language) => {
          const httpError = { response: { status } };
          const message = getLocalizedError(httpError, language);

          const expectedErrorCode = getErrorCodeFromStatus(status);
          const expectedMessage = getErrorMessage(expectedErrorCode, language);

          expect(message.title).toBe(expectedMessage.title);
          expect(message.message).toBe(expectedMessage.message);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Error message structure consistency', () => {
    it('all error messages should have consistent structure', () => {
      fc.assert(
        fc.property(errorCodeGenerator, languageGenerator, (errorCode, language) => {
          const message = getErrorMessage(errorCode, language);

          // Required fields
          expect(message).toHaveProperty('title');
          expect(message).toHaveProperty('message');

          // Optional fields should be string or undefined
          if (message.action !== undefined) {
            expect(typeof message.action).toBe('string');
          }
          if (message.guidance !== undefined) {
            expect(typeof message.guidance).toBe('string');
          }
        }),
        { numRuns: 100 }
      );
    });

    it('action buttons should be localized when present', () => {
      fc.assert(
        fc.property(errorCodeGenerator, (errorCode) => {
          // Check if action exists in English
          const englishMessage = getErrorMessage(errorCode, 'en');

          if (englishMessage.action) {
            // If English has action, other languages should too
            for (const lang of SUPPORTED_LANGUAGES) {
              const localizedMessage = getErrorMessage(errorCode, lang);
              expect(localizedMessage.action).toBeDefined();
              expect(localizedMessage.action!.length).toBeGreaterThan(0);
            }
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Unknown error codes fallback to SERVER_ERROR', () => {
    it('unknown error codes should return SERVER_ERROR in user language', () => {
      fc.assert(
        fc.property(
          // Generate alphanumeric strings that are not valid error codes
          fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ_0123456789'.split('')), { minLength: 10, maxLength: 20 })
            .filter((s) => !ERROR_CODES.includes(s)),
          languageGenerator,
          (unknownCode, language) => {
            const message = getErrorMessage(unknownCode, language);
            const serverError = getErrorMessage('SERVER_ERROR', language);

            expect(message.title).toBe(serverError.title);
            expect(message.message).toBe(serverError.message);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Indic language support', () => {
    it('Kannada translations should contain Kannada script', () => {
      fc.assert(
        fc.property(errorCodeGenerator, (errorCode) => {
          const message = getErrorMessage(errorCode, 'kn');
          // Kannada Unicode range: \u0C80-\u0CFF
          const kannadaRegex = /[\u0C80-\u0CFF]/;
          expect(kannadaRegex.test(message.title)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('Hindi translations should contain Devanagari script', () => {
      fc.assert(
        fc.property(errorCodeGenerator, (errorCode) => {
          const message = getErrorMessage(errorCode, 'hi');
          // Devanagari Unicode range: \u0900-\u097F
          const devanagariRegex = /[\u0900-\u097F]/;
          expect(devanagariRegex.test(message.title)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('Tamil translations should contain Tamil script', () => {
      fc.assert(
        fc.property(errorCodeGenerator, (errorCode) => {
          const message = getErrorMessage(errorCode, 'ta');
          // Tamil Unicode range: \u0B80-\u0BFF
          const tamilRegex = /[\u0B80-\u0BFF]/;
          expect(tamilRegex.test(message.title)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('Telugu translations should contain Telugu script', () => {
      fc.assert(
        fc.property(errorCodeGenerator, (errorCode) => {
          const message = getErrorMessage(errorCode, 'te');
          // Telugu Unicode range: \u0C00-\u0C7F
          const teluguRegex = /[\u0C00-\u0C7F]/;
          expect(teluguRegex.test(message.title)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('English translations should contain only ASCII characters in title', () => {
      fc.assert(
        fc.property(errorCodeGenerator, (errorCode) => {
          const message = getErrorMessage(errorCode, 'en');
          // ASCII printable range
          const asciiRegex = /^[\x20-\x7E]+$/;
          expect(asciiRegex.test(message.title)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });
});

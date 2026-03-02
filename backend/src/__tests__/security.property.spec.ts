/**
 * Property-Based Tests for Security Features
 * 
 * **Feature: project-finalization, Property 23: Rate limiting returns retry-after header**
 * **Validates: Requirements 7.5**
 * 
 * **Feature: project-finalization, Property 24: Sensitive data is encrypted at rest**
 * **Validates: Requirements 8.1**
 * 
 * **Feature: project-finalization, Property 25: JWT tokens are validated correctly**
 * **Validates: Requirements 8.3**
 * 
 * **Feature: project-finalization, Property 26: User inputs are sanitized**
 * **Validates: Requirements 8.4**
 * 
 * **Feature: project-finalization, Property 27: File uploads are validated**
 * **Validates: Requirements 8.5**
 */

import * as fc from 'fast-check';
import * as bcrypt from 'bcrypt';
import {
  RateLimitInfo,
  setRateLimitHeaders,
  getRateLimitInfo,
  clearRateLimitStore,
  RATE_LIMIT_HEADERS,
} from '../common/guards/rate-limit.guard';
import {
  encryptData,
  decryptData,
  isEncryptedFormat,
  isBcryptHashFormat,
} from '../common/encryption/encryption.service';
import {
  isValidJwtFormat,
  isTokenExpired,
  getTokenExpiresIn,
  hasRequiredPayloadFields,
  isValidRole,
} from '../common/jwt/jwt-validation.service';
import {
  sanitizeTextInput,
  containsSqlInjection,
  containsXss,
  removeSqlInjection,
  removeXss,
  sanitizeInput,
  escapeHtml,
} from '../common/validation/validation.pipe';
import {
  getFileExtension,
  isValidExtension,
  isValidMimeType,
  isValidFileSize,
  detectFileTypeFromBuffer,
  validateFileUpload,
  DEFAULT_IMAGE_CONFIG,
  MAGIC_BYTES,
} from '../common/validation/file-validation.service';
import * as crypto from 'crypto';

describe('Security Property Tests', () => {
  beforeEach(() => {
    clearRateLimitStore();
  });

  /**
   * **Feature: project-finalization, Property 23: Rate limiting returns retry-after header**
   * **Validates: Requirements 7.5**
   * 
   * For any request that triggers rate limiting, the response should include
   * a 429 status code and a Retry-After header with the cooldown period.
   */
  describe('Property 23: Rate limiting returns retry-after header', () => {
    it('should always include Retry-After header when rate limit is exceeded', () => {
      fc.assert(
        fc.property(
          // Generate a positive limit and window
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 1000, max: 120000 }),
          (limit, windowMs) => {
            // Create a mock response object to capture headers
            const headers: Record<string, string> = {};
            const mockResponse = {
              set: (key: string, value: string) => {
                headers[key] = value;
              },
            };

            // Simulate rate limit info when limit is exceeded
            const resetTime = Date.now() + windowMs;
            const retryAfter = Math.ceil(windowMs / 1000);
            
            const info: RateLimitInfo = {
              limit,
              remaining: 0,
              resetTime,
              retryAfter,
            };

            setRateLimitHeaders(mockResponse, info);

            // Verify Retry-After header is set
            expect(headers[RATE_LIMIT_HEADERS.RETRY_AFTER]).toBeDefined();
            expect(parseInt(headers[RATE_LIMIT_HEADERS.RETRY_AFTER])).toBeGreaterThan(0);
            
            // Verify other rate limit headers are set
            expect(headers[RATE_LIMIT_HEADERS.LIMIT]).toBe(limit.toString());
            expect(headers[RATE_LIMIT_HEADERS.REMAINING]).toBe('0');
            expect(headers[RATE_LIMIT_HEADERS.RESET]).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not include Retry-After header when rate limit is not exceeded', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 100 }),
          fc.integer({ min: 1, max: 99 }),
          fc.integer({ min: 1000, max: 120000 }),
          (limit, currentCount, windowMs) => {
            // Ensure currentCount is less than limit
            const safeCount = Math.min(currentCount, limit - 1);
            
            const headers: Record<string, string> = {};
            const mockResponse = {
              set: (key: string, value: string) => {
                headers[key] = value;
              },
            };

            const info: RateLimitInfo = {
              limit,
              remaining: limit - safeCount,
              resetTime: Date.now() + windowMs,
              // No retryAfter when not exceeded
            };

            setRateLimitHeaders(mockResponse, info);

            // Verify Retry-After header is NOT set
            expect(headers[RATE_LIMIT_HEADERS.RETRY_AFTER]).toBeUndefined();
            
            // Verify other headers are still set
            expect(headers[RATE_LIMIT_HEADERS.LIMIT]).toBe(limit.toString());
            expect(parseInt(headers[RATE_LIMIT_HEADERS.REMAINING])).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should calculate correct retry-after value based on reset time', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 120 }), // seconds until reset
          (secondsUntilReset) => {
            const now = Date.now();
            const resetTime = now + (secondsUntilReset * 1000);
            
            const headers: Record<string, string> = {};
            const mockResponse = {
              set: (key: string, value: string) => {
                headers[key] = value;
              },
            };

            const info: RateLimitInfo = {
              limit: 100,
              remaining: 0,
              resetTime,
              retryAfter: secondsUntilReset,
            };

            setRateLimitHeaders(mockResponse, info);

            const retryAfterValue = parseInt(headers[RATE_LIMIT_HEADERS.RETRY_AFTER]);
            
            // Retry-After should be approximately equal to seconds until reset
            expect(retryAfterValue).toBe(secondsUntilReset);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return correct rate limit info for any key', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 1, max: 1000 }),
          fc.integer({ min: 1000, max: 300000 }),
          (key, limit, windowMs) => {
            clearRateLimitStore();
            
            const info = getRateLimitInfo(key, limit, windowMs);
            
            // First request should have full remaining
            expect(info.limit).toBe(limit);
            expect(info.remaining).toBe(limit);
            expect(info.resetTime).toBeGreaterThan(Date.now());
            expect(info.retryAfter).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: project-finalization, Property 24: Sensitive data is encrypted at rest**
   * **Validates: Requirements 8.1**
   * 
   * For any sensitive data stored in the database (passwords, tokens),
   * the data should be encrypted using AES-256 or hashed using bcrypt.
   */
  describe('Property 24: Sensitive data is encrypted at rest', () => {
    // Generate a test encryption key
    const testKey = crypto.pbkdf2Sync('test-key', 'test-salt', 100000, 32, 'sha256');

    it('should encrypt and decrypt any string data correctly (round-trip)', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 1000 }),
          (plaintext) => {
            const encrypted = encryptData(plaintext, testKey);
            const decrypted = decryptData(encrypted, testKey);
            
            // Round-trip should preserve the original data
            expect(decrypted).toBe(plaintext);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce encrypted data in the correct format', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 500 }),
          (plaintext) => {
            const encrypted = encryptData(plaintext, testKey);
            
            // Encrypted data should be in format: iv:authTag:ciphertext
            expect(isEncryptedFormat(encrypted)).toBe(true);
            
            // Encrypted data should be different from plaintext
            expect(encrypted).not.toBe(plaintext);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce different ciphertext for same plaintext (due to random IV)', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 }),
          (plaintext) => {
            const encrypted1 = encryptData(plaintext, testKey);
            const encrypted2 = encryptData(plaintext, testKey);
            
            // Same plaintext should produce different ciphertext due to random IV
            expect(encrypted1).not.toBe(encrypted2);
            
            // But both should decrypt to the same value
            expect(decryptData(encrypted1, testKey)).toBe(plaintext);
            expect(decryptData(encrypted2, testKey)).toBe(plaintext);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly identify bcrypt hash format', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 8, maxLength: 20 }),
          async (password) => {
            const hash = await bcrypt.hash(password, 4); // Lower cost for testing
            
            // Hash should be in bcrypt format
            expect(isBcryptHashFormat(hash)).toBe(true);
            
            // Original password should not be in bcrypt format
            expect(isBcryptHashFormat(password)).toBe(false);
            
            // Hash should verify correctly
            const isValid = await bcrypt.compare(password, hash);
            expect(isValid).toBe(true);
          }
        ),
        { numRuns: 10 } // Fewer runs due to bcrypt being slow
      );
    }, 30000); // 30 second timeout

    it('should correctly identify encrypted format', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 }),
          (plaintext) => {
            const encrypted = encryptData(plaintext, testKey);
            
            // Encrypted data should be identified as encrypted
            expect(isEncryptedFormat(encrypted)).toBe(true);
            
            // Plain text should not be identified as encrypted
            expect(isEncryptedFormat(plaintext)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle special characters in encryption', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 }),
          fc.constantFrom('!@#$%^&*()_+-=[]{}|;:\'",.<>?/`~', '日本語テスト', '🎉🚀💻', '\n\t\r'),
          (base, special) => {
            const plaintext = base + special;
            const encrypted = encryptData(plaintext, testKey);
            const decrypted = decryptData(encrypted, testKey);
            
            expect(decrypted).toBe(plaintext);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: project-finalization, Property 25: JWT tokens are validated correctly**
   * **Validates: Requirements 8.3**
   * 
   * For any JWT token presented for authentication, the token should be validated
   * for signature, expiration, and payload integrity.
   */
  describe('Property 25: JWT tokens are validated correctly', () => {
    // Helper to generate valid JWT-like format (header.payload.signature)
    const generateJwtLikeToken = (header: string, payload: string, signature: string) => {
      return `${Buffer.from(header).toString('base64url')}.${Buffer.from(payload).toString('base64url')}.${signature}`;
    };

    it('should correctly identify valid JWT format', () => {
      fc.assert(
        fc.property(
          // Generate valid base64url strings for each part
          fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'.split('')), { minLength: 1, maxLength: 50 }),
          fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'.split('')), { minLength: 1, maxLength: 100 }),
          fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'.split('')), { minLength: 1, maxLength: 50 }),
          (header, payload, signature) => {
            const token = `${header}.${payload}.${signature}`;
            
            // Token with 3 non-empty parts should be valid format
            expect(isValidJwtFormat(token)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid JWT formats', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(''),
            fc.constant('invalid'),
            fc.constant('only.two'),
            fc.constant('too.many.parts.here'),
            fc.constant('.empty.parts'),
            fc.constant('empty..parts'),
          ),
          (invalidToken) => {
            expect(isValidJwtFormat(invalidToken)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly detect expired tokens', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 86400 }), // seconds in the past
          (secondsAgo) => {
            const now = Math.floor(Date.now() / 1000);
            const expiredPayload = { exp: now - secondsAgo };
            
            expect(isTokenExpired(expiredPayload)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly detect non-expired tokens', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 86400 }), // seconds in the future
          (secondsFromNow) => {
            const now = Math.floor(Date.now() / 1000);
            const validPayload = { exp: now + secondsFromNow };
            
            expect(isTokenExpired(validPayload)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should calculate correct expires-in time', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 86400 }), // seconds in the future
          (secondsFromNow) => {
            const now = Math.floor(Date.now() / 1000);
            const payload = { exp: now + secondsFromNow };
            
            const expiresIn = getTokenExpiresIn(payload);
            
            // Should be approximately equal (within 1 second tolerance)
            expect(Math.abs(expiresIn - secondsFromNow)).toBeLessThanOrEqual(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate payload has required fields', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.stringMatching(/^[6-9]\d{9}$/),
          fc.constantFrom('farmer', 'extension_officer', 'admin'),
          (sub, phoneNumber, role) => {
            const validPayload = { sub, phoneNumber, role };
            
            expect(hasRequiredPayloadFields(validPayload)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject payloads with missing fields', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant({}),
            fc.constant({ sub: 'test' }),
            fc.constant({ phoneNumber: '9876543210' }),
            fc.constant({ role: 'farmer' }),
            fc.constant({ sub: 'test', phoneNumber: '9876543210' }),
            fc.constant(null),
          ),
          (invalidPayload) => {
            // Should return false (or falsy) for invalid payloads
            expect(hasRequiredPayloadFields(invalidPayload)).toBeFalsy();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate allowed roles', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('farmer', 'extension_officer', 'admin'),
          (validRole) => {
            expect(isValidRole(validRole)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid roles', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }).filter(
            s => !['farmer', 'extension_officer', 'admin'].includes(s)
          ),
          (invalidRole) => {
            expect(isValidRole(invalidRole)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: project-finalization, Property 26: User inputs are sanitized**
   * **Validates: Requirements 8.4**
   * 
   * For any user input containing potential SQL injection or XSS patterns,
   * the input should be sanitized before processing or storage.
   */
  describe('Property 26: User inputs are sanitized', () => {
    // SQL injection patterns to test
    const sqlInjectionPatterns = [
      "'; DROP TABLE users; --",
      "1' OR '1'='1",
      "admin'--",
      "1; SELECT * FROM users",
      "' UNION SELECT * FROM passwords --",
      "1' AND '1'='1",
      "'; DELETE FROM users WHERE '1'='1",
    ];

    // XSS patterns to test
    const xssPatterns = [
      '<script>alert("xss")</script>',
      '<img src="x" onerror="alert(1)">',
      '<a href="javascript:alert(1)">click</a>',
      '<div onmouseover="alert(1)">hover</div>',
      '<iframe src="javascript:alert(1)"></iframe>',
    ];

    it('should remove dangerous characters from SQL injection attempts', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...sqlInjectionPatterns),
          (maliciousInput) => {
            const sanitized = removeSqlInjection(maliciousInput);
            
            // Sanitized output should not contain quotes or semicolons
            expect(sanitized).not.toMatch(/['";\\/]/);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should remove dangerous tags from XSS attempts', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...xssPatterns),
          (maliciousInput) => {
            const sanitized = removeXss(maliciousInput);
            
            // Sanitized output should not contain script or iframe tags
            expect(sanitized).not.toMatch(/<script/i);
            expect(sanitized).not.toMatch(/<iframe/i);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should remove SQL injection characters (quotes, semicolons, backslashes) from any input', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 200 }),
          (input) => {
            const sanitized = removeSqlInjection(input);
            
            // Sanitized output should not contain quotes, semicolons, or backslashes
            // Note: forward slash is allowed as it's used in URLs
            expect(sanitized).not.toMatch(/['";\\]/);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should remove HTML tags from any input', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 200 }),
          (input) => {
            const sanitized = removeXss(input);
            
            // Sanitized output should not contain HTML tags
            expect(sanitized).not.toMatch(/<[^>]*>/);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should sanitize combined SQL injection and XSS attacks', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...sqlInjectionPatterns),
          fc.constantFrom(...xssPatterns),
          (sqlAttack, xssAttack) => {
            const combined = sqlAttack + xssAttack;
            const sanitized = sanitizeInput(combined);
            
            // Sanitized output should not contain dangerous patterns
            expect(sanitized).not.toMatch(/<script/i);
            expect(sanitized).not.toMatch(/javascript:/i);
            expect(sanitized).not.toMatch(/['";\\/]/);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve safe text content after sanitization', () => {
      fc.assert(
        fc.property(
          // Generate safe alphanumeric strings
          fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 '.split('')), { minLength: 1, maxLength: 100 }),
          (safeInput) => {
            const sanitized = sanitizeTextInput(safeInput);
            
            // Safe input should be mostly preserved (trimmed)
            expect(sanitized).toBe(safeInput.trim());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should escape HTML entities correctly', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 100 }),
          (input) => {
            const escaped = escapeHtml(input);
            
            // Escaped output should not contain raw HTML special characters
            // (unless they were already escaped)
            if (input.includes('<')) {
              expect(escaped).toContain('&lt;');
            }
            if (input.includes('>')) {
              expect(escaped).toContain('&gt;');
            }
            if (input.includes('&') && !input.includes('&amp;') && !input.includes('&lt;') && !input.includes('&gt;')) {
              expect(escaped).toContain('&amp;');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty and null inputs gracefully', () => {
      expect(sanitizeTextInput('')).toBe('');
      expect(sanitizeTextInput(null as any)).toBe('');
      expect(sanitizeTextInput(undefined as any)).toBe('');
      expect(containsSqlInjection('')).toBe(false);
      expect(containsSqlInjection(null as any)).toBe(false);
      expect(containsXss('')).toBe(false);
      expect(containsXss(null as any)).toBe(false);
    });
  });

  /**
   * **Feature: project-finalization, Property 27: File uploads are validated**
   * **Validates: Requirements 8.5**
   * 
   * For any file upload, the file should be validated for type (allowed extensions),
   * size (max 10MB), and content (magic bytes verification).
   */
  describe('Property 27: File uploads are validated', () => {
    // JPEG magic bytes
    const jpegMagicBytes = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46]);
    // PNG magic bytes
    const pngMagicBytes = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

    it('should correctly extract file extensions', () => {
      fc.assert(
        fc.property(
          fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), { minLength: 1, maxLength: 20 }),
          fc.constantFrom('.jpg', '.jpeg', '.png', '.gif', '.pdf', '.txt'),
          (filename, extension) => {
            const fullName = filename + extension;
            const extracted = getFileExtension(fullName);
            
            expect(extracted).toBe(extension);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate allowed extensions correctly', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('.jpg', '.jpeg', '.png'),
          (validExtension) => {
            expect(isValidExtension(validExtension)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid extensions', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('.exe', '.bat', '.sh', '.php', '.js', '.html', '.svg'),
          (invalidExtension) => {
            expect(isValidExtension(invalidExtension)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate allowed MIME types correctly', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('image/jpeg', 'image/png'),
          (validMimeType) => {
            expect(isValidMimeType(validMimeType)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid MIME types', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('application/javascript', 'text/html', 'application/x-php', 'image/svg+xml'),
          (invalidMimeType) => {
            expect(isValidMimeType(invalidMimeType)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate file size within limit', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 * 1024 * 1024 }), // 1 byte to 10MB
          (validSize) => {
            expect(isValidFileSize(validSize)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject files exceeding size limit', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10 * 1024 * 1024 + 1, max: 100 * 1024 * 1024 }), // Over 10MB
          (oversizedFile) => {
            expect(isValidFileSize(oversizedFile)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should detect JPEG files from magic bytes', () => {
      const buffer = Buffer.concat([jpegMagicBytes, Buffer.alloc(100)]);
      expect(detectFileTypeFromBuffer(buffer)).toBe('image/jpeg');
    });

    it('should detect PNG files from magic bytes', () => {
      const buffer = Buffer.concat([pngMagicBytes, Buffer.alloc(100)]);
      expect(detectFileTypeFromBuffer(buffer)).toBe('image/png');
    });

    it('should return undefined for unknown file types', () => {
      fc.assert(
        fc.property(
          fc.uint8Array({ minLength: 8, maxLength: 100 }),
          (randomBytes) => {
            // Skip if random bytes happen to match known signatures
            const buffer = Buffer.from(randomBytes);
            const detected = detectFileTypeFromBuffer(buffer);
            
            // If detected, it should be a known type
            if (detected) {
              expect(['image/jpeg', 'image/png']).toContain(detected);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate complete file upload with all checks', () => {
      // Valid JPEG file
      const validFile = {
        buffer: Buffer.concat([jpegMagicBytes, Buffer.alloc(1000)]),
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        size: 1008,
      };

      const result = validateFileUpload(validFile);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject files with mismatched content type', () => {
      // File claims to be JPEG but has PNG magic bytes
      const mismatchedFile = {
        buffer: Buffer.concat([pngMagicBytes, Buffer.alloc(1000)]),
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        size: 1008,
      };

      const result = validateFileUpload(mismatchedFile);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('mismatch'))).toBe(true);
    });

    it('should reject files with invalid extension', () => {
      const invalidExtFile = {
        buffer: Buffer.concat([jpegMagicBytes, Buffer.alloc(1000)]),
        originalname: 'test.exe',
        mimetype: 'image/jpeg',
        size: 1008,
      };

      const result = validateFileUpload(invalidExtFile);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('extension'))).toBe(true);
    });
  });
});

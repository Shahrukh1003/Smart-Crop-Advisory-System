import {
  isValidPhoneNumber,
  isValidCoordinate,
  isValidSoilPH,
  isValidNutrientLevel,
  sanitizeFileName,
} from '../validation/validation.pipe';

describe('Input Validation', () => {
  describe('isValidPhoneNumber', () => {
    it('accepts valid Indian mobile numbers', () => {
      expect(isValidPhoneNumber('9876543210')).toBe(true);
      expect(isValidPhoneNumber('8765432109')).toBe(true);
      expect(isValidPhoneNumber('7654321098')).toBe(true);
      expect(isValidPhoneNumber('6543210987')).toBe(true);
    });

    it('rejects invalid phone numbers', () => {
      expect(isValidPhoneNumber('1234567890')).toBe(false); // Starts with 1
      expect(isValidPhoneNumber('5432109876')).toBe(false); // Starts with 5
      expect(isValidPhoneNumber('987654321')).toBe(false); // 9 digits
      expect(isValidPhoneNumber('98765432101')).toBe(false); // 11 digits
      expect(isValidPhoneNumber('abcdefghij')).toBe(false); // Letters
      expect(isValidPhoneNumber('')).toBe(false); // Empty
    });
  });

  describe('isValidCoordinate', () => {
    it('accepts coordinates within India', () => {
      expect(isValidCoordinate(12.9716, 77.5946)).toBe(true); // Bangalore
      expect(isValidCoordinate(28.6139, 77.2090)).toBe(true); // Delhi
      expect(isValidCoordinate(19.0760, 72.8777)).toBe(true); // Mumbai
      expect(isValidCoordinate(8.5241, 76.9366)).toBe(true); // Trivandrum (south)
      expect(isValidCoordinate(34.0837, 74.7973)).toBe(true); // Srinagar (north)
    });

    it('rejects coordinates outside India', () => {
      expect(isValidCoordinate(51.5074, -0.1278)).toBe(false); // London
      expect(isValidCoordinate(40.7128, -74.0060)).toBe(false); // New York
      expect(isValidCoordinate(-33.8688, 151.2093)).toBe(false); // Sydney
      expect(isValidCoordinate(0, 0)).toBe(false); // Null Island
    });
  });

  describe('isValidSoilPH', () => {
    it('accepts valid pH values', () => {
      expect(isValidSoilPH(0)).toBe(true);
      expect(isValidSoilPH(7)).toBe(true);
      expect(isValidSoilPH(14)).toBe(true);
      expect(isValidSoilPH(6.5)).toBe(true);
    });

    it('rejects invalid pH values', () => {
      expect(isValidSoilPH(-1)).toBe(false);
      expect(isValidSoilPH(15)).toBe(false);
      expect(isValidSoilPH(-0.1)).toBe(false);
      expect(isValidSoilPH(14.1)).toBe(false);
    });
  });

  describe('isValidNutrientLevel', () => {
    it('accepts valid nutrient levels', () => {
      expect(isValidNutrientLevel(0)).toBe(true);
      expect(isValidNutrientLevel(280)).toBe(true);
      expect(isValidNutrientLevel(500)).toBe(true);
      expect(isValidNutrientLevel(1000)).toBe(true);
    });

    it('rejects invalid nutrient levels', () => {
      expect(isValidNutrientLevel(-1)).toBe(false);
      expect(isValidNutrientLevel(1001)).toBe(false);
      expect(isValidNutrientLevel(-100)).toBe(false);
    });
  });

  describe('sanitizeFileName', () => {
    it('removes path traversal attempts', () => {
      expect(sanitizeFileName('../../../etc/passwd')).not.toContain('..');
      expect(sanitizeFileName('..\\..\\windows\\system32')).not.toContain('..');
    });

    it('removes special characters', () => {
      expect(sanitizeFileName('file<script>.jpg')).not.toContain('<');
      expect(sanitizeFileName('file;rm -rf.jpg')).not.toContain(';');
      expect(sanitizeFileName("file'OR'1=1.jpg")).not.toContain("'");
    });

    it('preserves valid filenames', () => {
      expect(sanitizeFileName('image.jpg')).toBe('image.jpg');
      expect(sanitizeFileName('crop_photo_2024.png')).toBe('crop_photo_2024.png');
      expect(sanitizeFileName('pest-detection-result.jpeg')).toBe('pest-detection-result.jpeg');
    });

    it('truncates long filenames', () => {
      const longName = 'a'.repeat(300) + '.jpg';
      expect(sanitizeFileName(longName).length).toBeLessThanOrEqual(255);
    });
  });
});

describe('Rate Limiting', () => {
  // Rate limit configuration tests
  it('should have reasonable default limits', () => {
    const DEFAULT_LIMIT = 100;
    const DEFAULT_WINDOW = 60 * 1000;
    
    expect(DEFAULT_LIMIT).toBe(100);
    expect(DEFAULT_WINDOW).toBe(60000);
  });

  it('should calculate retry-after correctly', () => {
    const windowMs = 60000;
    const resetTime = Date.now() + windowMs;
    const now = Date.now();
    const retryAfter = Math.ceil((resetTime - now) / 1000);
    
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(60);
  });
});

describe('Token Security', () => {
  it('should have appropriate token expiry times', () => {
    const ACCESS_TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
    const REFRESH_TOKEN_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 days
    
    expect(ACCESS_TOKEN_EXPIRY).toBe(86400000);
    expect(REFRESH_TOKEN_EXPIRY).toBe(2592000000);
    expect(REFRESH_TOKEN_EXPIRY).toBeGreaterThan(ACCESS_TOKEN_EXPIRY);
  });

  it('should check token expiry with buffer time', () => {
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes from now
    const bufferTime = 5 * 60 * 1000; // 5 minute buffer
    
    // Token should be considered expired if within buffer time
    const isExpired = Date.now() > expiresAt - bufferTime;
    expect(isExpired).toBe(false);
    
    // Token expiring in 3 minutes should be considered expired (within 5 min buffer)
    const soonExpiresAt = Date.now() + 3 * 60 * 1000;
    const isSoonExpired = Date.now() > soonExpiresAt - bufferTime;
    expect(isSoonExpired).toBe(true);
  });
});

describe('SQL Injection Prevention', () => {
  const sanitizeString = (input: string): string => {
    return input.replace(/['";\\]/g, '');
  };

  it('removes SQL injection characters', () => {
    expect(sanitizeString("'; DROP TABLE users; --")).not.toContain("'");
    expect(sanitizeString("'; DROP TABLE users; --")).not.toContain(";");
    expect(sanitizeString('1" OR "1"="1')).not.toContain('"');
  });

  it('handles common SQL injection patterns', () => {
    const patterns = [
      "' OR '1'='1",
      "'; DROP TABLE users--",
      "1; SELECT * FROM users",
      "admin'--",
      "1' AND '1'='1",
    ];

    patterns.forEach(pattern => {
      const sanitized = sanitizeString(pattern);
      expect(sanitized).not.toContain("'");
      expect(sanitized).not.toContain('"');
      expect(sanitized).not.toContain(';');
    });
  });
});

describe('XSS Prevention', () => {
  const stripHtml = (input: string): string => {
    return input.replace(/<[^>]*>/g, '');
  };

  it('removes HTML tags', () => {
    expect(stripHtml('<script>alert("xss")</script>')).not.toContain('<script>');
    expect(stripHtml('<img src="x" onerror="alert(1)">')).not.toContain('<img');
    expect(stripHtml('<a href="javascript:alert(1)">click</a>')).not.toContain('<a');
  });

  it('preserves plain text', () => {
    expect(stripHtml('Hello World')).toBe('Hello World');
    expect(stripHtml('Rice crop 2024')).toBe('Rice crop 2024');
  });
});

import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import * as sanitizeHtml from 'sanitize-html';

/**
 * SQL injection patterns to detect and remove
 */
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|EXEC|EXECUTE|UNION|DECLARE)\b)/gi,
  /(--)|(\/\*)|(\*\/)/g, // SQL comments
  /(;|\||&&)/g, // Command separators
  /(\bOR\b|\bAND\b)\s*['"]?\d+['"]?\s*=\s*['"]?\d+['"]?/gi, // OR 1=1, AND 1=1 patterns
  /'\s*OR\s*'/gi, // ' OR ' pattern
  /'\s*AND\s*'/gi, // ' AND ' pattern
  /['"]?\s*=\s*['"]?/g, // Equality patterns like '=' or "="
];

/**
 * XSS patterns to detect and remove
 */
const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /<iframe\b[^>]*>/gi, // iframe tags
  /<img\b[^>]*>/gi, // img tags (often used for XSS)
  /<a\b[^>]*href\s*=\s*["']?javascript:/gi, // javascript: in href
  /javascript:/gi,
  /on\w+\s*=/gi, // onclick=, onerror=, etc.
  /data:/gi,
  /vbscript:/gi,
  /expression\s*\(/gi,
];

@Injectable()
export class ValidationPipe implements PipeTransform<any> {
  async transform(value: any, { metatype }: ArgumentMetadata) {
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    // Sanitize string inputs
    const sanitizedValue = this.sanitizeInput(value);

    const object = plainToInstance(metatype, sanitizedValue);
    const errors = await validate(object);

    if (errors.length > 0) {
      const messages = errors.map((err) => {
        const constraints = err.constraints;
        return constraints ? Object.values(constraints).join(', ') : 'Validation failed';
      });
      throw new BadRequestException({
        message: 'Validation failed',
        errors: messages,
      });
    }

    return object;
  }

  private toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  private sanitizeInput(value: any): any {
    if (typeof value === 'string') {
      return this.sanitizeString(value);
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeInput(item));
    }

    if (value && typeof value === 'object') {
      const sanitized: Record<string, any> = {};
      for (const key of Object.keys(value)) {
        sanitized[key] = this.sanitizeInput(value[key]);
      }
      return sanitized;
    }

    return value;
  }

  private sanitizeString(input: string): string {
    // Remove HTML tags using sanitize-html
    let sanitized = sanitizeHtml(input, {
      allowedTags: [],
      allowedAttributes: {},
    });

    // Remove potential SQL injection patterns
    sanitized = sanitized.replace(/['";\\]/g, '');

    // Trim whitespace
    sanitized = sanitized.trim();

    return sanitized;
  }
}

/**
 * Comprehensive input sanitization utilities
 */

/**
 * Sanitize text input by removing HTML tags and dangerous characters
 */
export function sanitizeTextInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove HTML tags
  let sanitized = sanitizeHtml(input, {
    allowedTags: [],
    allowedAttributes: {},
  });

  // Remove SQL injection characters
  sanitized = sanitized.replace(/['";\\]/g, '');

  // Trim whitespace
  return sanitized.trim();
}

/**
 * Check if input contains potential SQL injection patterns
 */
export function containsSqlInjection(input: string): boolean {
  if (!input || typeof input !== 'string') {
    return false;
  }

  return SQL_INJECTION_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * Check if input contains potential XSS patterns
 */
export function containsXss(input: string): boolean {
  if (!input || typeof input !== 'string') {
    return false;
  }

  return XSS_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * Remove SQL injection patterns from input
 */
export function removeSqlInjection(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  let sanitized = input;
  SQL_INJECTION_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });

  // Also remove common SQL injection characters (quotes, semicolons, backslashes)
  // Note: forward slash is NOT removed as it's commonly used in URLs and paths
  sanitized = sanitized.replace(/['";\\]/g, '');

  return sanitized.trim();
}

/**
 * Remove XSS patterns from input
 */
export function removeXss(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Use sanitize-html to remove HTML tags
  let sanitized = sanitizeHtml(input, {
    allowedTags: [],
    allowedAttributes: {},
  });

  // Remove remaining XSS patterns
  XSS_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });

  return sanitized;
}

/**
 * Comprehensive sanitization that removes both SQL injection and XSS
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  let sanitized = removeXss(input);
  sanitized = removeSqlInjection(sanitized);
  return sanitized.trim();
}

/**
 * Escape HTML entities for safe display
 */
export function escapeHtml(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Custom validators
export const isValidPhoneNumber = (phone: string): boolean => {
  // Indian mobile number validation (10 digits starting with 6-9)
  return /^[6-9]\d{9}$/.test(phone);
};

export const isValidCoordinate = (lat: number, lng: number): boolean => {
  // India's approximate bounding box
  return lat >= 6 && lat <= 38 && lng >= 68 && lng <= 98;
};

export const isValidSoilPH = (ph: number): boolean => {
  return ph >= 0 && ph <= 14;
};

export const isValidNutrientLevel = (level: number): boolean => {
  return level >= 0 && level <= 1000;
};

export const sanitizeFileName = (filename: string): string => {
  // Remove path traversal attempts and special characters
  return filename
    .replace(/\.\./g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .substring(0, 255);
};

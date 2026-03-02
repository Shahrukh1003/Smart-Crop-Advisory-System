import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';

export interface JwtPayload {
  sub: string;
  phoneNumber: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface JwtValidationResult {
  isValid: boolean;
  payload?: JwtPayload;
  error?: string;
  expiresIn?: number;
}

/**
 * Enhanced JWT Validation Service
 * Provides comprehensive token validation including:
 * - Signature verification
 * - Expiration checking
 * - Payload integrity validation
 */
@Injectable()
export class JwtValidationService {
  private readonly logger = new Logger(JwtValidationService.name);
  private readonly jwtSecret: string;
  private readonly refreshSecret: string;
  private readonly tokenExpiryBuffer = 5 * 60; // 5 minutes buffer before expiry

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    this.jwtSecret = this.configService.get<string>('JWT_SECRET', 'your-secret-key');
    this.refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET', 'your-refresh-secret');
  }

  /**
   * Validate an access token with comprehensive checks
   */
  validateAccessToken(token: string): JwtValidationResult {
    return this.validateToken(token, this.jwtSecret);
  }

  /**
   * Validate a refresh token with comprehensive checks
   */
  validateRefreshToken(token: string): JwtValidationResult {
    return this.validateToken(token, this.refreshSecret);
  }

  /**
   * Core token validation logic
   */
  private validateToken(token: string, secret: string): JwtValidationResult {
    if (!token) {
      return { isValid: false, error: 'Token is required' };
    }

    // Check token format (should be 3 parts separated by dots)
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { isValid: false, error: 'Invalid token format' };
    }

    try {
      // Verify signature and decode
      const payload = this.jwtService.verify<JwtPayload>(token, { secret });

      // Validate payload integrity
      const integrityResult = this.validatePayloadIntegrity(payload);
      if (!integrityResult.isValid) {
        return integrityResult;
      }

      // Check expiration with buffer
      const expirationResult = this.checkExpiration(payload);
      if (!expirationResult.isValid) {
        return expirationResult;
      }

      return {
        isValid: true,
        payload,
        expiresIn: expirationResult.expiresIn,
      };
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return { isValid: false, error: 'Token has expired' };
      }
      if (error.name === 'JsonWebTokenError') {
        return { isValid: false, error: 'Invalid token signature' };
      }
      this.logger.error('Token validation error', error);
      return { isValid: false, error: 'Token validation failed' };
    }
  }

  /**
   * Validate payload has required fields and correct types
   */
  private validatePayloadIntegrity(payload: JwtPayload): JwtValidationResult {
    // Check required fields
    if (!payload.sub || typeof payload.sub !== 'string') {
      return { isValid: false, error: 'Invalid payload: missing or invalid sub' };
    }

    if (!payload.phoneNumber || typeof payload.phoneNumber !== 'string') {
      return { isValid: false, error: 'Invalid payload: missing or invalid phoneNumber' };
    }

    if (!payload.role || typeof payload.role !== 'string') {
      return { isValid: false, error: 'Invalid payload: missing or invalid role' };
    }

    // Validate role is one of allowed values
    const allowedRoles = ['farmer', 'extension_officer', 'admin'];
    if (!allowedRoles.includes(payload.role)) {
      return { isValid: false, error: 'Invalid payload: invalid role value' };
    }

    // Validate phone number format (Indian mobile)
    if (!/^[6-9]\d{9}$/.test(payload.phoneNumber)) {
      return { isValid: false, error: 'Invalid payload: invalid phone number format' };
    }

    // Validate UUID format for sub
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(payload.sub)) {
      return { isValid: false, error: 'Invalid payload: invalid user ID format' };
    }

    return { isValid: true, payload };
  }

  /**
   * Check token expiration with buffer time
   */
  private checkExpiration(payload: JwtPayload): JwtValidationResult {
    if (!payload.exp) {
      return { isValid: false, error: 'Token has no expiration' };
    }

    const now = Math.floor(Date.now() / 1000);
    const expiresIn = payload.exp - now;

    if (expiresIn <= 0) {
      return { isValid: false, error: 'Token has expired' };
    }

    // Warn if token is about to expire (within buffer)
    if (expiresIn <= this.tokenExpiryBuffer) {
      this.logger.warn(`Token expiring soon: ${expiresIn} seconds remaining`);
    }

    return { isValid: true, payload, expiresIn };
  }

  /**
   * Check if token needs refresh (within buffer time of expiry)
   */
  shouldRefreshToken(token: string): boolean {
    const result = this.validateAccessToken(token);
    if (!result.isValid || !result.expiresIn) {
      return true;
    }
    return result.expiresIn <= this.tokenExpiryBuffer;
  }

  /**
   * Extract payload without verification (for debugging only)
   */
  decodeWithoutVerification(token: string): JwtPayload | null {
    try {
      return this.jwtService.decode(token) as JwtPayload;
    } catch {
      return null;
    }
  }

  /**
   * Generate a token fingerprint for tracking
   */
  generateTokenFingerprint(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex').substring(0, 16);
  }
}

/**
 * Standalone JWT validation functions for use without DI
 */
export function isValidJwtFormat(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  return parts.length === 3 && parts.every(part => part.length > 0);
}

export function isTokenExpired(payload: { exp?: number }): boolean {
  if (!payload.exp) return true;
  const now = Math.floor(Date.now() / 1000);
  return payload.exp <= now;
}

export function getTokenExpiresIn(payload: { exp?: number }): number {
  if (!payload.exp) return 0;
  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, payload.exp - now);
}

export function hasRequiredPayloadFields(payload: any): boolean {
  return (
    payload &&
    typeof payload.sub === 'string' &&
    typeof payload.phoneNumber === 'string' &&
    typeof payload.role === 'string'
  );
}

export function isValidRole(role: string): boolean {
  const allowedRoles = ['farmer', 'extension_officer', 'admin'];
  return allowedRoles.includes(role);
}

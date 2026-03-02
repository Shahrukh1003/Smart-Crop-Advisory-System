import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

/**
 * Encryption Service for sensitive data at rest
 * Uses AES-256-GCM for encryption and bcrypt for password hashing
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits
  private readonly authTagLength = 16; // 128 bits
  private readonly saltRounds = 10;
  private encryptionKey: Buffer;

  constructor(private configService: ConfigService) {
    this.initializeKey();
  }

  /**
   * Initialize encryption key from environment or generate a secure one
   */
  private initializeKey(): void {
    const keyString = this.configService.get<string>('ENCRYPTION_KEY');
    
    if (keyString) {
      // Use provided key (should be 32 bytes hex-encoded = 64 chars)
      if (keyString.length === 64) {
        this.encryptionKey = Buffer.from(keyString, 'hex');
      } else {
        // Derive key from provided string using PBKDF2
        const salt = this.configService.get<string>('ENCRYPTION_SALT', 'smart-crop-advisory-salt');
        this.encryptionKey = crypto.pbkdf2Sync(keyString, salt, 100000, this.keyLength, 'sha256');
      }
    } else {
      // Generate a random key for development (should be set in production)
      this.logger.warn('ENCRYPTION_KEY not set. Using derived key from default. Set ENCRYPTION_KEY in production!');
      const defaultKey = 'smart-crop-advisory-default-key';
      const salt = 'smart-crop-advisory-salt';
      this.encryptionKey = crypto.pbkdf2Sync(defaultKey, salt, 100000, this.keyLength, 'sha256');
    }
  }

  /**
   * Encrypt sensitive data using AES-256-GCM
   * @param plaintext - The data to encrypt
   * @returns Encrypted data as base64 string (iv:authTag:ciphertext)
   */
  encrypt(plaintext: string): string {
    if (!plaintext) {
      return plaintext;
    }

    try {
      // Generate random IV
      const iv = crypto.randomBytes(this.ivLength);
      
      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
      
      // Encrypt
      let encrypted = cipher.update(plaintext, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      
      // Get auth tag
      const authTag = cipher.getAuthTag();
      
      // Combine iv:authTag:ciphertext
      return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
    } catch (error) {
      this.logger.error('Encryption failed', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt data encrypted with AES-256-GCM
   * @param encryptedData - The encrypted data (iv:authTag:ciphertext)
   * @returns Decrypted plaintext
   */
  decrypt(encryptedData: string): string {
    if (!encryptedData) {
      return encryptedData;
    }

    try {
      // Split components
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }

      const iv = Buffer.from(parts[0], 'base64');
      const authTag = Buffer.from(parts[1], 'base64');
      const ciphertext = parts[2];

      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
      decipher.setAuthTag(authTag);

      // Decrypt
      let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.error('Decryption failed', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Check if a string is encrypted (has the expected format)
   */
  isEncrypted(data: string): boolean {
    if (!data) return false;
    const parts = data.split(':');
    return parts.length === 3;
  }

  /**
   * Hash a password using bcrypt
   * @param password - Plain text password
   * @returns Hashed password
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  /**
   * Verify a password against a bcrypt hash
   * @param password - Plain text password
   * @param hash - Bcrypt hash
   * @returns True if password matches
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Check if a string is a valid bcrypt hash
   */
  isBcryptHash(data: string): boolean {
    if (!data) return false;
    // Bcrypt hashes start with $2a$, $2b$, or $2y$ and are 60 characters
    return /^\$2[aby]\$\d{2}\$.{53}$/.test(data);
  }

  /**
   * Generate a secure random token
   * @param length - Length of the token in bytes (default 32)
   * @returns Hex-encoded random token
   */
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hash data using SHA-256 (for non-reversible hashing)
   * @param data - Data to hash
   * @returns SHA-256 hash as hex string
   */
  hashSHA256(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}

/**
 * Standalone encryption functions for use without DI
 */
export function encryptData(plaintext: string, key: Buffer): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

export function decryptData(encryptedData: string, key: Buffer): string {
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }
  const iv = Buffer.from(parts[0], 'base64');
  const authTag = Buffer.from(parts[1], 'base64');
  const ciphertext = parts[2];
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function isEncryptedFormat(data: string): boolean {
  if (!data) return false;
  const parts = data.split(':');
  if (parts.length !== 3) return false;
  
  // All three parts must be non-empty
  if (!parts[0] || !parts[1] || !parts[2]) return false;
  
  // Validate that parts look like base64 encoded data
  // IV should be 16 bytes = ~24 base64 chars (with padding)
  // AuthTag should be 16 bytes = ~24 base64 chars (with padding)
  // Ciphertext should be at least a few characters
  const base64Regex = /^[A-Za-z0-9+/]+=*$/;
  
  // Check IV (should be ~24 chars for 16 bytes)
  if (parts[0].length < 20 || !base64Regex.test(parts[0])) return false;
  
  // Check AuthTag (should be ~24 chars for 16 bytes)
  if (parts[1].length < 20 || !base64Regex.test(parts[1])) return false;
  
  // Check ciphertext (should be valid base64)
  if (!base64Regex.test(parts[2])) return false;
  
  return true;
}

export function isBcryptHashFormat(data: string): boolean {
  if (!data) return false;
  return /^\$2[aby]\$\d{2}\$.{53}$/.test(data);
}

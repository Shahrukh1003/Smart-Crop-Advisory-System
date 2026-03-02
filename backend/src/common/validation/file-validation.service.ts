import { Injectable, BadRequestException, Logger } from '@nestjs/common';

/**
 * File validation configuration
 */
export interface FileValidationConfig {
  maxSizeBytes: number;
  allowedExtensions: string[];
  allowedMimeTypes: string[];
}

/**
 * Default configuration for image uploads
 */
export const DEFAULT_IMAGE_CONFIG: FileValidationConfig = {
  maxSizeBytes: 10 * 1024 * 1024, // 10MB
  allowedExtensions: ['.jpg', '.jpeg', '.png'],
  allowedMimeTypes: ['image/jpeg', 'image/png'],
};

/**
 * Magic bytes (file signatures) for common image formats
 */
export const MAGIC_BYTES: Record<string, number[][]> = {
  'image/jpeg': [
    [0xFF, 0xD8, 0xFF], // JPEG/JFIF
  ],
  'image/png': [
    [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], // PNG
  ],
};

/**
 * File validation result
 */
export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  fileInfo?: {
    extension: string;
    mimeType: string;
    sizeBytes: number;
    detectedType?: string;
  };
}

/**
 * File Upload Validation Service
 * Validates file uploads for type, size, and content
 */
@Injectable()
export class FileValidationService {
  private readonly logger = new Logger(FileValidationService.name);

  /**
   * Validate a file upload
   */
  validateFile(
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    config: FileValidationConfig = DEFAULT_IMAGE_CONFIG,
  ): FileValidationResult {
    const errors: string[] = [];

    // Get file extension
    const extension = this.getFileExtension(file.originalname);

    // Validate extension
    if (!this.isValidExtension(extension, config.allowedExtensions)) {
      errors.push(`Invalid file extension: ${extension}. Allowed: ${config.allowedExtensions.join(', ')}`);
    }

    // Validate MIME type
    if (!this.isValidMimeType(file.mimetype, config.allowedMimeTypes)) {
      errors.push(`Invalid MIME type: ${file.mimetype}. Allowed: ${config.allowedMimeTypes.join(', ')}`);
    }

    // Validate file size
    if (!this.isValidSize(file.size, config.maxSizeBytes)) {
      const maxSizeMB = config.maxSizeBytes / (1024 * 1024);
      errors.push(`File too large: ${(file.size / (1024 * 1024)).toFixed(2)}MB. Maximum: ${maxSizeMB}MB`);
    }

    // Validate magic bytes (content verification)
    const detectedType = this.detectFileType(file.buffer);
    if (detectedType && !config.allowedMimeTypes.includes(detectedType)) {
      errors.push(`File content does not match declared type. Detected: ${detectedType}`);
    }

    // Check for magic bytes mismatch (potential file spoofing)
    if (detectedType && detectedType !== file.mimetype) {
      this.logger.warn(`MIME type mismatch: declared ${file.mimetype}, detected ${detectedType}`);
      errors.push(`File content type mismatch: declared ${file.mimetype}, detected ${detectedType}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      fileInfo: {
        extension,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        detectedType,
      },
    };
  }

  /**
   * Get file extension from filename
   */
  getFileExtension(filename: string): string {
    if (!filename) return '';
    const lastDot = filename.lastIndexOf('.');
    if (lastDot === -1) return '';
    return filename.substring(lastDot).toLowerCase();
  }

  /**
   * Check if extension is valid
   */
  isValidExtension(extension: string, allowedExtensions: string[]): boolean {
    return allowedExtensions.includes(extension.toLowerCase());
  }

  /**
   * Check if MIME type is valid
   */
  isValidMimeType(mimeType: string, allowedMimeTypes: string[]): boolean {
    return allowedMimeTypes.includes(mimeType.toLowerCase());
  }

  /**
   * Check if file size is within limit
   */
  isValidSize(sizeBytes: number, maxSizeBytes: number): boolean {
    return sizeBytes > 0 && sizeBytes <= maxSizeBytes;
  }

  /**
   * Detect file type from magic bytes
   */
  detectFileType(buffer: Buffer): string | undefined {
    if (!buffer || buffer.length < 8) {
      return undefined;
    }

    for (const [mimeType, signatures] of Object.entries(MAGIC_BYTES)) {
      for (const signature of signatures) {
        if (this.matchesMagicBytes(buffer, signature)) {
          return mimeType;
        }
      }
    }

    return undefined;
  }

  /**
   * Check if buffer starts with magic bytes
   */
  matchesMagicBytes(buffer: Buffer, signature: number[]): boolean {
    if (buffer.length < signature.length) {
      return false;
    }

    for (let i = 0; i < signature.length; i++) {
      if (buffer[i] !== signature[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Validate and throw if invalid
   */
  validateOrThrow(
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    config: FileValidationConfig = DEFAULT_IMAGE_CONFIG,
  ): void {
    const result = this.validateFile(file, config);
    if (!result.isValid) {
      throw new BadRequestException({
        message: 'File validation failed',
        errors: result.errors,
      });
    }
  }
}

/**
 * Standalone file validation functions for use without DI
 */

export function getFileExtension(filename: string): string {
  if (!filename) return '';
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filename.substring(lastDot).toLowerCase();
}

export function isValidExtension(extension: string, allowedExtensions: string[] = DEFAULT_IMAGE_CONFIG.allowedExtensions): boolean {
  return allowedExtensions.includes(extension.toLowerCase());
}

export function isValidMimeType(mimeType: string, allowedMimeTypes: string[] = DEFAULT_IMAGE_CONFIG.allowedMimeTypes): boolean {
  return allowedMimeTypes.includes(mimeType.toLowerCase());
}

export function isValidFileSize(sizeBytes: number, maxSizeBytes: number = DEFAULT_IMAGE_CONFIG.maxSizeBytes): boolean {
  return sizeBytes > 0 && sizeBytes <= maxSizeBytes;
}

export function detectFileTypeFromBuffer(buffer: Buffer): string | undefined {
  if (!buffer || buffer.length < 8) {
    return undefined;
  }

  for (const [mimeType, signatures] of Object.entries(MAGIC_BYTES)) {
    for (const signature of signatures) {
      let matches = true;
      for (let i = 0; i < signature.length && i < buffer.length; i++) {
        if (buffer[i] !== signature[i]) {
          matches = false;
          break;
        }
      }
      if (matches) {
        return mimeType;
      }
    }
  }

  return undefined;
}

export function validateFileUpload(
  file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  config: FileValidationConfig = DEFAULT_IMAGE_CONFIG,
): FileValidationResult {
  const errors: string[] = [];
  const extension = getFileExtension(file.originalname);

  if (!isValidExtension(extension, config.allowedExtensions)) {
    errors.push(`Invalid extension: ${extension}`);
  }

  if (!isValidMimeType(file.mimetype, config.allowedMimeTypes)) {
    errors.push(`Invalid MIME type: ${file.mimetype}`);
  }

  if (!isValidFileSize(file.size, config.maxSizeBytes)) {
    errors.push(`File too large: ${file.size} bytes`);
  }

  const detectedType = detectFileTypeFromBuffer(file.buffer);
  if (detectedType && detectedType !== file.mimetype) {
    errors.push(`Content type mismatch: ${file.mimetype} vs ${detectedType}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    fileInfo: {
      extension,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      detectedType,
    },
  };
}

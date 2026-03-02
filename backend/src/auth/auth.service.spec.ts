import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as fc from 'fast-check';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { Language, UserRole } from '@prisma/client';

// Mock PrismaService
const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

// Mock JwtService
const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-token'),
  verify: jest.fn(),
  decode: jest.fn().mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 86400 }),
};

// Mock ConfigService
const mockConfigService = {
  get: jest.fn((key: string, defaultValue: string) => defaultValue),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const dto = {
        phoneNumber: '9876543210',
        name: 'Test User',
        password: 'password123',
        language: Language.en,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        id: 'user-id',
        phoneNumber: dto.phoneNumber,
        name: dto.name,
        language: dto.language,
        role: UserRole.farmer,
        passwordHash: 'hashed-password',
      });

      const result = await service.register(dto);

      expect(result.user.phoneNumber).toBe(dto.phoneNumber);
      expect(result.tokens.accessToken).toBeDefined();
    });

    it('should throw ConflictException if user already exists', async () => {
      const dto = {
        phoneNumber: '9876543210',
        name: 'Test User',
        password: 'password123',
        language: Language.en,
      };

      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'existing-user' });

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should login user with valid credentials', async () => {
      const dto = {
        phoneNumber: '9876543210',
        password: 'password123',
      };

      const hashedPassword = await bcrypt.hash(dto.password, 10);

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        phoneNumber: dto.phoneNumber,
        name: 'Test User',
        language: Language.en,
        role: UserRole.farmer,
        passwordHash: hashedPassword,
      });
      mockPrismaService.user.update.mockResolvedValue({});

      const result = await service.login(dto);

      expect(result.user.phoneNumber).toBe(dto.phoneNumber);
      expect(result.tokens.accessToken).toBeDefined();
    });

    it('should throw UnauthorizedException for invalid phone number', async () => {
      const dto = {
        phoneNumber: '9876543210',
        password: 'password123',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      const dto = {
        phoneNumber: '9876543210',
        password: 'wrongpassword',
      };

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        phoneNumber: dto.phoneNumber,
        passwordHash: await bcrypt.hash('correctpassword', 10),
      });

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });
  });

  // **Feature: smart-crop-advisory, Property: Token validation consistency**
  // **Validates: Requirements 1.1**
  describe('Property-Based Tests', () => {
    // Generator for valid Indian phone numbers
    const phoneNumberArb = fc.stringOf(fc.constantFrom('6', '7', '8', '9'), { minLength: 1, maxLength: 1 })
      .chain(first => fc.stringOf(fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'), { minLength: 9, maxLength: 9 })
        .map(rest => first + rest));

    // Generator for valid names
    const nameArb = fc.string({ minLength: 2, maxLength: 100 }).filter(s => s.trim().length >= 2);

    // Generator for valid passwords
    const passwordArb = fc.string({ minLength: 6, maxLength: 50 });

    // Generator for languages
    const languageArb = fc.constantFrom(Language.kn, Language.hi, Language.ta, Language.te, Language.en);

    it('should generate valid tokens for any valid registration input', async () => {
      await fc.assert(
        fc.asyncProperty(
          phoneNumberArb,
          nameArb,
          passwordArb,
          languageArb,
          async (phoneNumber, name, password, language) => {
            // Reset mocks for each iteration
            mockPrismaService.user.findUnique.mockResolvedValue(null);
            mockPrismaService.user.create.mockResolvedValue({
              id: `user-${phoneNumber}`,
              phoneNumber,
              name,
              language,
              role: UserRole.farmer,
              passwordHash: 'hashed',
            });

            const result = await service.register({
              phoneNumber,
              name,
              password,
              language,
            });

            // Property: tokens should always be generated
            expect(result.tokens.accessToken).toBeDefined();
            expect(result.tokens.refreshToken).toBeDefined();
            expect(result.tokens.expiresIn).toBeGreaterThan(0);

            // Property: user data should match input
            expect(result.user.phoneNumber).toBe(phoneNumber);
            expect(result.user.name).toBe(name);
            expect(result.user.language).toBe(language);
          }
        ),
        { numRuns: 20 }
      );
    }, 30000);

    it('should consistently hash and verify passwords', async () => {
      await fc.assert(
        fc.asyncProperty(
          passwordArb,
          async (password) => {
            // Hash the password
            const hash = await bcrypt.hash(password, 10);

            // Property: hashed password should verify correctly
            const isValid = await bcrypt.compare(password, hash);
            expect(isValid).toBe(true);

            // Property: wrong password should not verify
            const wrongPassword = password + 'wrong';
            const isInvalid = await bcrypt.compare(wrongPassword, hash);
            expect(isInvalid).toBe(false);
          }
        ),
        { numRuns: 10 }
      );
    }, 30000);

    it('should reject duplicate phone numbers consistently', async () => {
      await fc.assert(
        fc.asyncProperty(
          phoneNumberArb,
          async (phoneNumber) => {
            // Simulate existing user
            mockPrismaService.user.findUnique.mockResolvedValue({ id: 'existing' });

            // Property: should always throw ConflictException for existing users
            await expect(
              service.register({
                phoneNumber,
                name: 'Test',
                password: 'password123',
                language: Language.en,
              })
            ).rejects.toThrow(ConflictException);
          }
        ),
        { numRuns: 20 }
      );
    }, 30000);
  });
});

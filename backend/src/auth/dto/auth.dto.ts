import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Matches,
  IsEnum,
  IsOptional,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Language } from '@prisma/client';

export class RegisterDto {
  @ApiProperty({ example: '9876543210', description: 'Indian mobile number (10 digits)' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[6-9]\d{9}$/, { message: 'Phone number must be a valid 10-digit Indian mobile number' })
  phoneNumber: string;

  @ApiProperty({ example: 'Ramesh Kumar', description: 'Full name of the farmer' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'password123', description: 'Password (min 6 characters)' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(50)
  password: string;

  @ApiProperty({ enum: Language, example: 'kn', description: 'Preferred language' })
  @IsEnum(Language)
  language: Language;

  @ApiPropertyOptional({ example: 12.9716, description: 'Latitude coordinate' })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ example: 77.5946, description: 'Longitude coordinate' })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({ example: 'Bangalore Urban', description: 'District name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  district?: string;

  @ApiPropertyOptional({ example: 'Karnataka', description: 'State name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;
}

export class LoginDto {
  @ApiProperty({ example: '9876543210', description: 'Registered phone number' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[6-9]\d{9}$/, { message: 'Phone number must be a valid 10-digit Indian mobile number' })
  phoneNumber: string;

  @ApiProperty({ example: 'password123', description: 'Account password' })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token received during login' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class AuthResponseDto {
  @ApiProperty()
  user: {
    id: string;
    phoneNumber: string;
    name: string;
    language: Language;
    role: string;
  };

  @ApiProperty()
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
}

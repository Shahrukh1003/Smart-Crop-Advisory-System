import { Controller, Post, Body, UseGuards, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { PestDetectionService } from './pest-detection.service';
import { PestDetectionRequestDto, PestDetectionResponseDto, TreatmentDto } from './dto/pest-detection.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('pest-detection')
@Controller('pest-detection')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PestDetectionController {
  constructor(private readonly pestDetectionService: PestDetectionService) {}

  @Post('analyze')
  @ApiOperation({ summary: 'Analyze image for pest/disease detection' })
  @ApiResponse({ status: 200, description: 'Detection results', type: PestDetectionResponseDto })
  async analyzeImage(
    @Body() dto: PestDetectionRequestDto,
    @CurrentUser('userId') userId: string,
  ): Promise<PestDetectionResponseDto> {
    return this.pestDetectionService.detectPests(userId, dto);
  }

  @Get('treatments/:pestName')
  @ApiOperation({ summary: 'Get treatments for a specific pest/disease' })
  @ApiResponse({ status: 200, description: 'Treatment recommendations', type: [TreatmentDto] })
  async getTreatments(@Param('pestName') pestName: string): Promise<TreatmentDto[]> {
    return this.pestDetectionService.getTreatments(pestName);
  }

  @Get('treatments/:pestName/categorized')
  @ApiOperation({ summary: 'Get treatments categorized by organic/chemical' })
  async getCategorizedTreatments(@Param('pestName') pestName: string) {
    return this.pestDetectionService.getTreatmentsByCategory(pestName);
  }
}

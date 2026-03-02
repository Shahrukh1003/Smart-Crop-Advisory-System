import { Controller, Post, Body, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AdvisoryService } from './advisory.service';
import { CropRecommendationRequestDto, SoilDataDto, CropRecommendationDto, SoilAnalysisResponseDto } from './dto/advisory.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('advisory')
@Controller('advisory')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AdvisoryController {
  constructor(private readonly advisoryService: AdvisoryService) {}

  @Post('crop-recommendations')
  @ApiOperation({ summary: 'Get personalized crop recommendations' })
  @ApiResponse({ status: 200, description: 'Crop recommendations generated', type: [CropRecommendationDto] })
  async getCropRecommendations(
    @Body() dto: CropRecommendationRequestDto,
    @CurrentUser('userId') userId: string,
  ): Promise<CropRecommendationDto[]> {
    return this.advisoryService.getCropRecommendations(userId, dto);
  }

  @Post('soil-analysis')
  @ApiOperation({ summary: 'Analyze soil and get fertilizer recommendations' })
  @ApiResponse({ status: 200, description: 'Soil analysis complete', type: SoilAnalysisResponseDto })
  async analyzeSoil(
    @Body() dto: SoilDataDto,
    @Query('landArea') landArea?: number,
  ): Promise<SoilAnalysisResponseDto> {
    return this.advisoryService.analyzeSoil(dto, landArea);
  }
}

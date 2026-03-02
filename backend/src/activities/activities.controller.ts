import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ActivitiesService } from './activities.service';
import { CreateCropHistoryDto, UpdateCropHistoryDto, CreateActivityDto, InputCostsDto } from './dto/activity.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('activities')
@Controller('activities')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ActivitiesController {
  constructor(private readonly service: ActivitiesService) {}

  // Crop History
  @Get('crop-history')
  @ApiOperation({ summary: 'Get all crop history for current user' })
  async getCropHistory(@CurrentUser('userId') userId: string) {
    return this.service.getCropHistoryByUser(userId);
  }

  @Get('crop-history/grouped')
  @ApiOperation({ summary: 'Get crop history grouped by crop and season' })
  async getCropHistoryGrouped(@CurrentUser('userId') userId: string) {
    return this.service.getCropHistoryGrouped(userId);
  }

  @Get('crop-history/:id')
  @ApiOperation({ summary: 'Get crop history by ID' })
  async getCropHistoryById(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.service.getCropHistoryById(id, userId);
  }

  @Post('crop-history')
  @ApiOperation({ summary: 'Create new crop history entry' })
  async createCropHistory(@Body() dto: CreateCropHistoryDto, @CurrentUser('userId') userId: string) {
    return this.service.createCropHistory(userId, dto);
  }

  @Put('crop-history/:id')
  @ApiOperation({ summary: 'Update crop history' })
  async updateCropHistory(
    @Param('id') id: string,
    @Body() dto: UpdateCropHistoryDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.service.updateCropHistory(id, userId, dto);
  }

  @Post('crop-history/:id/complete')
  @ApiOperation({ summary: 'Complete growing season and calculate ROI' })
  async completeSeason(
    @Param('id') id: string,
    @Body() dto: UpdateCropHistoryDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.service.completeSeason(id, userId, dto);
  }

  // Farming Activities
  @Get('crop-history/:id/activities')
  @ApiOperation({ summary: 'Get activities for a crop history' })
  async getActivities(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.service.getActivitiesByHistory(id, userId);
  }

  @Post('farming')
  @ApiOperation({ summary: 'Log a farming activity' })
  async createActivity(@Body() dto: CreateActivityDto, @CurrentUser('userId') userId: string) {
    return this.service.createActivity(userId, dto);
  }

  // Input Costs
  @Put('crop-history/:id/costs')
  @ApiOperation({ summary: 'Update input costs for a crop history' })
  async updateInputCosts(
    @Param('id') id: string,
    @Body() dto: InputCostsDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.service.updateInputCosts(id, userId, dto);
  }
}

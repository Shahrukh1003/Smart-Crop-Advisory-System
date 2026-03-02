import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { LogEventDto, SubmitFeedbackDto, UsageReportDto, FeedbackResponseDto, BatchLogEventsDto, AnalyticsEventResponseDto } from './dto/analytics.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('event')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Log a user interaction event' })
  async logEvent(
    @Body() dto: LogEventDto,
    @CurrentUser('userId') userId: string,
  ): Promise<AnalyticsEventResponseDto> {
    return this.analyticsService.logEvent(userId, dto);
  }

  @Post('events/batch')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Log multiple user interaction events in batch' })
  async logEventsBatch(
    @Body() dto: BatchLogEventsDto,
    @CurrentUser('userId') userId: string,
  ): Promise<{ count: number }> {
    return this.analyticsService.logEventsBatch(userId, dto.events);
  }

  @Get('events')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Query events by time range' })
  async getEvents(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('feature') feature?: string,
    @CurrentUser('userId') userId?: string,
  ): Promise<AnalyticsEventResponseDto[]> {
    return this.analyticsService.getEventsByTimeRange(
      new Date(startDate || Date.now() - 7 * 24 * 60 * 60 * 1000),
      new Date(endDate || Date.now()),
      feature,
      userId,
    );
  }

  @Get('events/counts')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get event counts by feature' })
  async getEventCounts(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<Record<string, number>> {
    return this.analyticsService.getEventCountsByFeature(
      new Date(startDate || Date.now() - 30 * 24 * 60 * 60 * 1000),
      new Date(endDate || Date.now()),
    );
  }

  @Get('sessions/stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get session statistics for a feature' })
  async getSessionStats(
    @Query('feature') feature: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<{ avgDuration: number; totalSessions: number }> {
    return this.analyticsService.getSessionStats(
      feature,
      new Date(startDate || Date.now() - 30 * 24 * 60 * 60 * 1000),
      new Date(endDate || Date.now()),
    );
  }

  @Post('feedback')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit feedback for a feature' })
  async submitFeedback(
    @Body() dto: SubmitFeedbackDto,
    @CurrentUser('userId') userId: string,
  ): Promise<FeedbackResponseDto> {
    return this.analyticsService.submitFeedback(userId, dto);
  }

  @Get('feedback/should-prompt')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check if feedback prompt should be shown' })
  async shouldPromptFeedback(
    @Query('feature') feature: string,
    @CurrentUser('userId') userId: string,
  ): Promise<{ shouldPrompt: boolean }> {
    const shouldPrompt = await this.analyticsService.shouldPromptFeedback(userId, feature);
    return { shouldPrompt };
  }

  @Get('report')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate usage report (admin only)' })
  async getUsageReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<UsageReportDto> {
    return this.analyticsService.generateUsageReport(
      new Date(startDate || Date.now() - 30 * 24 * 60 * 60 * 1000),
      new Date(endDate || Date.now()),
    );
  }

  @Get('feedback')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get feedback for a feature' })
  async getFeedback(@Query('feature') feature: string): Promise<FeedbackResponseDto[]> {
    return this.analyticsService.getFeedbackByFeature(feature);
  }

  @Post('interaction')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Record an advisory interaction and check for feedback prompt' })
  async recordInteraction(
    @Body() dto: { feature: string; sessionId: string; context?: Record<string, any> },
    @CurrentUser('userId') userId: string,
  ): Promise<{ shouldPromptFeedback: boolean; interactionId: string }> {
    return this.analyticsService.recordAdvisoryInteraction(
      userId,
      dto.feature,
      dto.sessionId,
      dto.context,
    );
  }

  @Get('feedback/stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get feedback statistics (admin only)' })
  async getFeedbackStats(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<{
    totalFeedback: number;
    averageRating: number;
    feedbackByFeature: Record<string, { count: number; avgRating: number }>;
  }> {
    return this.analyticsService.getFeedbackStats(
      new Date(startDate || Date.now() - 30 * 24 * 60 * 60 * 1000),
      new Date(endDate || Date.now()),
    );
  }
}

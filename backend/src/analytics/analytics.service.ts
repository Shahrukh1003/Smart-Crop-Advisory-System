import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LogEventDto, SubmitFeedbackDto, UsageReportDto, FeedbackResponseDto, AnalyticsEventResponseDto } from './dto/analytics.dto';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log a single user interaction event with feature access, timestamp, and session ID.
   * Implements efficient time-series storage with indexed fields.
   * **Validates: Requirements 10.1**
   */
  async logEvent(userId: string | null, dto: LogEventDto): Promise<AnalyticsEventResponseDto> {
    const event = await this.prisma.analyticsEvent.create({
      data: {
        feature: dto.feature,
        sessionId: dto.sessionId,
        metadata: dto.metadata as any,
        duration: dto.duration,
        user: userId ? { connect: { id: userId } } : undefined,
      },
    });
    this.logger.debug(`Event logged: ${dto.feature} for session ${dto.sessionId}`);
    
    return {
      id: event.id,
      feature: event.feature,
      sessionId: event.sessionId,
      eventTimestamp: event.eventTimestamp,
      metadata: event.metadata as Record<string, any> | undefined,
      duration: event.duration ?? undefined,
    };
  }

  /**
   * Log multiple events in a single batch for efficiency.
   * Useful for syncing offline events or high-frequency logging.
   */
  async logEventsBatch(userId: string | null, events: LogEventDto[]): Promise<{ count: number }> {
    const result = await this.prisma.analyticsEvent.createMany({
      data: events.map(dto => ({
        feature: dto.feature,
        sessionId: dto.sessionId,
        metadata: dto.metadata as any,
        duration: dto.duration,
        userId: userId,
      })),
    });
    this.logger.debug(`Batch logged ${result.count} events`);
    return { count: result.count };
  }

  /**
   * Query events by time range for time-series analysis.
   * Uses indexed fields for efficient querying.
   */
  async getEventsByTimeRange(
    startDate: Date,
    endDate: Date,
    feature?: string,
    userId?: string,
  ): Promise<AnalyticsEventResponseDto[]> {
    const events = await this.prisma.analyticsEvent.findMany({
      where: {
        eventTimestamp: { gte: startDate, lte: endDate },
        ...(feature && { feature }),
        ...(userId && { userId }),
      },
      orderBy: { eventTimestamp: 'desc' },
      take: 1000, // Limit for performance
    });

    return events.map(e => ({
      id: e.id,
      feature: e.feature,
      sessionId: e.sessionId,
      eventTimestamp: e.eventTimestamp,
      metadata: e.metadata as Record<string, any> | undefined,
      duration: e.duration ?? undefined,
    }));
  }

  /**
   * Get aggregated event counts by feature for a time period.
   * Efficient for dashboard displays.
   */
  async getEventCountsByFeature(
    startDate: Date,
    endDate: Date,
  ): Promise<Record<string, number>> {
    const results = await this.prisma.analyticsEvent.groupBy({
      by: ['feature'],
      where: { eventTimestamp: { gte: startDate, lte: endDate } },
      _count: { feature: true },
    });

    const counts: Record<string, number> = {};
    results.forEach((r: { feature: string; _count: { feature: number } }) => {
      counts[r.feature] = r._count.feature;
    });
    return counts;
  }

  /**
   * Get session duration statistics for a feature.
   */
  async getSessionStats(
    feature: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{ avgDuration: number; totalSessions: number }> {
    const events = await this.prisma.analyticsEvent.findMany({
      where: {
        feature,
        eventTimestamp: { gte: startDate, lte: endDate },
        duration: { not: null },
      },
      select: { duration: true, sessionId: true },
    });

    const uniqueSessions = new Set(events.map(e => e.sessionId)).size;
    const totalDuration = events.reduce((sum, e) => sum + (e.duration || 0), 0);
    const avgDuration = events.length > 0 ? totalDuration / events.length : 0;

    return {
      avgDuration: Math.round(avgDuration),
      totalSessions: uniqueSessions,
    };
  }

  async submitFeedback(userId: string, dto: SubmitFeedbackDto): Promise<FeedbackResponseDto> {
    const feedback = await this.prisma.feedback.create({
      data: {
        feature: dto.feature,
        rating: dto.rating,
        comment: dto.comment,
        context: dto.context as any,
        user: { connect: { id: userId } },
      },
    });

    return {
      id: feedback.id,
      feature: feedback.feature,
      rating: feedback.rating || 0,
      comment: feedback.comment || undefined,
      createdAt: feedback.createdAt,
    };
  }

  async generateUsageReport(startDate: Date, endDate: Date): Promise<UsageReportDto> {
    // Get total users
    const totalUsers = await this.prisma.user.count({ where: { role: 'farmer' } });

    // Get active users in period
    const activeUserIds = await this.prisma.analyticsEvent.findMany({
      where: {
        eventTimestamp: { gte: startDate, lte: endDate },
        userId: { not: null },
      },
      select: { userId: true },
      distinct: ['userId'],
    });
    const activeUsers = activeUserIds.length;

    // Calculate adoption rate
    const adoptionRate = totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0;

    // Get feature popularity
    const featureEvents = await this.prisma.analyticsEvent.groupBy({
      by: ['feature'],
      where: { eventTimestamp: { gte: startDate, lte: endDate } },
      _count: { feature: true },
    });
    const featurePopularity: Record<string, number> = {};
    featureEvents.forEach(e => { featurePopularity[e.feature] = e._count.feature; });

    // Get user satisfaction (average rating per feature)
    const feedbackStats = await this.prisma.feedback.groupBy({
      by: ['feature'],
      where: { createdAt: { gte: startDate, lte: endDate } },
      _avg: { rating: true },
    });
    const userSatisfaction: Record<string, number> = {};
    feedbackStats.forEach(f => { userSatisfaction[f.feature] = f._avg.rating || 0; });

    return {
      adoptionRate: Math.round(adoptionRate * 10) / 10,
      totalUsers,
      activeUsers,
      featurePopularity,
      userSatisfaction,
      periodStart: startDate,
      periodEnd: endDate,
    };
  }

  async shouldPromptFeedback(userId: string, feature: string): Promise<boolean> {
    // Check if user has given feedback for this feature recently
    const recentFeedback = await this.prisma.feedback.findFirst({
      where: {
        userId,
        feature,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
      },
    });
    return !recentFeedback;
  }

  async getFeedbackByFeature(feature: string): Promise<FeedbackResponseDto[]> {
    const feedbacks = await this.prisma.feedback.findMany({
      where: { feature },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return feedbacks.map(f => ({
      id: f.id,
      feature: f.feature,
      rating: f.rating || 0,
      comment: f.comment || undefined,
      createdAt: f.createdAt,
    }));
  }

  /**
   * Record an advisory interaction and determine if feedback should be prompted.
   * This is called after crop recommendation, pest detection, or market price queries.
   */
  async recordAdvisoryInteraction(
    userId: string,
    feature: string,
    sessionId: string,
    context?: Record<string, any>,
  ): Promise<{ shouldPromptFeedback: boolean; interactionId: string }> {
    // Log the interaction event
    const event = await this.prisma.analyticsEvent.create({
      data: {
        feature,
        sessionId,
        user: { connect: { id: userId } },
      },
    });

    // Check if we should prompt for feedback
    const shouldPrompt = await this.shouldPromptFeedback(userId, feature);

    this.logger.debug(
      `Advisory interaction recorded: ${feature}, shouldPrompt: ${shouldPrompt}`,
    );

    return {
      shouldPromptFeedback: shouldPrompt,
      interactionId: event.id,
    };
  }

  /**
   * Get feedback statistics for a specific time period
   */
  async getFeedbackStats(
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalFeedback: number;
    averageRating: number;
    feedbackByFeature: Record<string, { count: number; avgRating: number }>;
  }> {
    const feedbacks = await this.prisma.feedback.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
    });

    const totalFeedback = feedbacks.length;
    const averageRating =
      totalFeedback > 0
        ? feedbacks.reduce((sum, f) => sum + (f.rating || 0), 0) / totalFeedback
        : 0;

    const feedbackByFeature: Record<string, { count: number; avgRating: number }> = {};
    const featureGroups = new Map<string, number[]>();

    feedbacks.forEach(f => {
      if (!featureGroups.has(f.feature)) {
        featureGroups.set(f.feature, []);
      }
      featureGroups.get(f.feature)!.push(f.rating || 0);
    });

    featureGroups.forEach((ratings, feature) => {
      feedbackByFeature[feature] = {
        count: ratings.length,
        avgRating: ratings.reduce((a, b) => a + b, 0) / ratings.length,
      };
    });

    return { totalFeedback, averageRating, feedbackByFeature };
  }
}

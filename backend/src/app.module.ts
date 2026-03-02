import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';
import { LandParcelsModule } from './land-parcels/land-parcels.module';
import { ActivitiesModule } from './activities/activities.module';
import { AdvisoryModule } from './advisory/advisory.module';
import { WeatherModule } from './weather/weather.module';
import { MarketModule } from './market/market.module';
import { PestDetectionModule } from './pest-detection/pest-detection.module';
import { VoiceModule } from './voice/voice.module';
import { BroadcastModule } from './broadcast/broadcast.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { NotificationsModule } from './notifications/notifications.module';
import { EncryptionModule } from './common/encryption';
import { JwtValidationModule } from './common/jwt';
import { CacheModule } from './common/cache';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),

    // Caching - Redis with in-memory fallback
    CacheModule.forRoot(),

    // Security
    EncryptionModule,
    JwtValidationModule,

    // Core modules
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    LandParcelsModule,
    ActivitiesModule,
    AdvisoryModule,
    WeatherModule,
    MarketModule,
    PestDetectionModule,
    VoiceModule,
    BroadcastModule,
    AnalyticsModule,
    NotificationsModule,
  ],
})
export class AppModule {}

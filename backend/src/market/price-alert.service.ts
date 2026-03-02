import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MarketService } from './market.service';

export interface PriceChangeAlert {
  id: string;
  commodity: string;
  market: string;
  previousPrice: number;
  currentPrice: number;
  changePercent: number;
  changeDirection: 'increase' | 'decrease';
  alertedAt: Date;
}

export interface FarmerInterest {
  userId: string;
  commodity: string;
  latitude: number;
  longitude: number;
}

@Injectable()
export class PriceAlertService {
  private readonly logger = new Logger(PriceAlertService.name);
  private readonly PRICE_CHANGE_THRESHOLD = 15; // 15% threshold

  constructor(
    private readonly prisma: PrismaService,
    private readonly marketService: MarketService,
  ) {}

  /**
   * Check for price changes exceeding threshold and generate alerts
   */
  async checkPriceChanges(commodity: string): Promise<PriceChangeAlert[]> {
    const alerts: PriceChangeAlert[] = [];

    try {
      // Get yesterday's prices from database
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const yesterdayPrices = await this.prisma.marketPrice.findMany({
        where: {
          commodity: { equals: commodity, mode: 'insensitive' },
          priceDate: {
            gte: yesterday,
            lt: today,
          },
        },
      });


      const todayPrices = await this.prisma.marketPrice.findMany({
        where: {
          commodity: { equals: commodity, mode: 'insensitive' },
          priceDate: {
            gte: today,
          },
        },
      });

      // Compare prices and generate alerts
      for (const todayPrice of todayPrices) {
        const yesterdayPrice = yesterdayPrices.find(
          (p) => p.marketName === todayPrice.marketName,
        );

        if (yesterdayPrice && todayPrice.modalPrice && yesterdayPrice.modalPrice) {
          const previousPrice = yesterdayPrice.modalPrice.toNumber();
          const currentPrice = todayPrice.modalPrice.toNumber();
          const changePercent = this.calculatePriceChangePercent(previousPrice, currentPrice);

          if (Math.abs(changePercent) >= this.PRICE_CHANGE_THRESHOLD) {
            alerts.push({
              id: `${todayPrice.id}-alert`,
              commodity: todayPrice.commodity,
              market: todayPrice.marketName,
              previousPrice,
              currentPrice,
              changePercent,
              changeDirection: changePercent > 0 ? 'increase' : 'decrease',
              alertedAt: new Date(),
            });
          }
        }
      }

      this.logger.log(`Generated ${alerts.length} price alerts for ${commodity}`);
      return alerts;
    } catch (error) {
      this.logger.error(`Failed to check price changes for ${commodity}`, error);
      return [];
    }
  }

  /**
   * Calculate percentage change between two prices
   */
  calculatePriceChangePercent(previousPrice: number, currentPrice: number): number {
    if (previousPrice === 0) return 0;
    return ((currentPrice - previousPrice) / previousPrice) * 100;
  }

  /**
   * Check if a price change exceeds the threshold
   */
  isPriceChangeSignificant(previousPrice: number, currentPrice: number): boolean {
    const changePercent = this.calculatePriceChangePercent(previousPrice, currentPrice);
    return Math.abs(changePercent) >= this.PRICE_CHANGE_THRESHOLD;
  }

  /**
   * Get farmers interested in a specific commodity
   */
  async getInterestedFarmers(commodity: string): Promise<FarmerInterest[]> {
    try {
      // Get farmers who have grown this crop or have it in their history
      const farmers = await this.prisma.cropHistory.findMany({
        where: {
          cropName: { equals: commodity, mode: 'insensitive' },
        },
        select: {
          userId: true,
          user: {
            select: {
              latitude: true,
              longitude: true,
            },
          },
        },
        distinct: ['userId'],
      });

      return farmers
        .filter((f) => f.user.latitude && f.user.longitude)
        .map((f) => ({
          userId: f.userId,
          commodity,
          latitude: f.user.latitude!.toNumber(),
          longitude: f.user.longitude!.toNumber(),
        }));
    } catch (error) {
      this.logger.error(`Failed to get interested farmers for ${commodity}`, error);
      return [];
    }
  }

  /**
   * Generate notifications for price change alerts
   */
  async generateNotifications(alerts: PriceChangeAlert[]): Promise<void> {
    for (const alert of alerts) {
      const farmers = await this.getInterestedFarmers(alert.commodity);

      for (const farmer of farmers) {
        const direction = alert.changeDirection === 'increase' ? '📈 increased' : '📉 decreased';
        const message = `${alert.commodity} price ${direction} by ${Math.abs(alert.changePercent).toFixed(1)}% at ${alert.market}. Current: ₹${alert.currentPrice}/quintal`;

        this.logger.log(`Notification for ${farmer.userId}: ${message}`);
        // In production, this would send actual push notifications via FCM
      }
    }
  }

  /**
   * Store price data for tracking changes
   */
  async storePriceData(
    commodity: string,
    marketName: string,
    district: string,
    modalPrice: number,
    minPrice?: number,
    maxPrice?: number,
  ): Promise<void> {
    try {
      await this.prisma.marketPrice.create({
        data: {
          commodity,
          marketName,
          district,
          modalPrice,
          minPrice,
          maxPrice,
          priceDate: new Date(),
          unit: 'quintal',
        },
      });
    } catch (error) {
      this.logger.error(`Failed to store price data for ${commodity}`, error);
    }
  }

  /**
   * Get price change threshold
   */
  getPriceChangeThreshold(): number {
    return this.PRICE_CHANGE_THRESHOLD;
  }
}

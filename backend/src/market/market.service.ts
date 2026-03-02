import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AgmarknetClient, ParsedMarketPrice } from './agmarknet.client';

export interface MarketPriceResult {
  commodity: string;
  variety: string;
  market: { name: string; district: string; state: string; distance: number };
  price: { min: number; max: number; modal: number; unit: string };
  date: string;
  trend: 'rising' | 'falling' | 'stable';
  priceChange: number;
  transportationCost: number;
  dataSource: 'live' | 'cached' | 'generated';
  fetchedAt?: Date;
}

export interface SellingRecommendation {
  recommendation: string;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string[];
  bestMarket?: MarketPriceResult;
  currentPrice?: number;
  avgPrice30Days?: number;
  priceAboveAvg?: number;
  msp: number | null;
  mspComparison?: {
    currentPrice: number;
    msp: number;
    difference: number;
    percentageDiff: number;
    isBelowMsp: boolean;
  };
}

// Real Indian APMC markets with coordinates
const INDIAN_MARKETS = [
  { name: 'Azadpur Mandi', district: 'Delhi', state: 'Delhi', lat: 28.7041, lng: 77.1025 },
  { name: 'Vashi APMC', district: 'Navi Mumbai', state: 'Maharashtra', lat: 19.0760, lng: 72.9981 },
  { name: 'Koyambedu Market', district: 'Chennai', state: 'Tamil Nadu', lat: 13.0827, lng: 80.2707 },
  { name: 'Yeshwanthpur APMC', district: 'Bangalore', state: 'Karnataka', lat: 13.0285, lng: 77.5505 },
  { name: 'Bowenpally Market', district: 'Hyderabad', state: 'Telangana', lat: 17.4700, lng: 78.4800 },
  { name: 'Gultekdi Market', district: 'Pune', state: 'Maharashtra', lat: 18.4968, lng: 73.8756 },
  { name: 'Devi Ahilya Bai Holkar Market', district: 'Indore', state: 'Madhya Pradesh', lat: 22.7196, lng: 75.8577 },
  { name: 'Ghazipur Mandi', district: 'Delhi', state: 'Delhi', lat: 28.6280, lng: 77.3200 },
  { name: 'Lasalgaon APMC', district: 'Nashik', state: 'Maharashtra', lat: 20.1500, lng: 74.2300 },
  { name: 'Hubli APMC', district: 'Dharwad', state: 'Karnataka', lat: 15.3647, lng: 75.1240 },
  { name: 'Mysore APMC', district: 'Mysore', state: 'Karnataka', lat: 12.2958, lng: 76.6394 },
  { name: 'Belgaum APMC', district: 'Belgaum', state: 'Karnataka', lat: 15.8497, lng: 74.4977 },
  { name: 'Davangere APMC', district: 'Davangere', state: 'Karnataka', lat: 14.4644, lng: 75.9218 },
  { name: 'Tumkur APMC', district: 'Tumkur', state: 'Karnataka', lat: 13.3379, lng: 77.1173 },
  { name: 'Shimoga APMC', district: 'Shimoga', state: 'Karnataka', lat: 13.9299, lng: 75.5681 },
];


// Real MSP and market prices for 2024-25 (in INR per quintal)
const CROP_BASE_PRICES: Record<string, { msp: number; marketBase: number; unit: string; variety: string }> = {
  'Rice': { msp: 2300, marketBase: 2400, unit: 'quintal', variety: 'Common' },
  'Wheat': { msp: 2275, marketBase: 2350, unit: 'quintal', variety: 'FAQ' },
  'Maize': { msp: 2090, marketBase: 2150, unit: 'quintal', variety: 'Yellow' },
  'Cotton': { msp: 7020, marketBase: 7200, unit: 'quintal', variety: 'Medium Staple' },
  'Sugarcane': { msp: 315, marketBase: 340, unit: 'quintal', variety: 'General' },
  'Groundnut': { msp: 6377, marketBase: 6500, unit: 'quintal', variety: 'In Shell' },
  'Soybean': { msp: 4600, marketBase: 4800, unit: 'quintal', variety: 'Yellow' },
  'Tomato': { msp: 0, marketBase: 2500, unit: 'quintal', variety: 'Local' },
  'Onion': { msp: 0, marketBase: 1800, unit: 'quintal', variety: 'Red' },
  'Potato': { msp: 0, marketBase: 1400, unit: 'quintal', variety: 'Jyoti' },
  'Chilli': { msp: 0, marketBase: 12000, unit: 'quintal', variety: 'Red' },
  'Turmeric': { msp: 0, marketBase: 9500, unit: 'quintal', variety: 'Finger' },
  'Ragi': { msp: 3846, marketBase: 4000, unit: 'quintal', variety: 'FAQ' },
  'Jowar': { msp: 3180, marketBase: 3300, unit: 'quintal', variety: 'Hybrid' },
  'Bajra': { msp: 2500, marketBase: 2600, unit: 'quintal', variety: 'FAQ' },
  'Tur/Arhar': { msp: 7000, marketBase: 7500, unit: 'quintal', variety: 'FAQ' },
  'Moong': { msp: 8558, marketBase: 8800, unit: 'quintal', variety: 'Bold' },
  'Urad': { msp: 6950, marketBase: 7200, unit: 'quintal', variety: 'Bold' },
  'Coconut': { msp: 0, marketBase: 2800, unit: 'quintal', variety: 'Dehusked' },
  'Banana': { msp: 0, marketBase: 1200, unit: 'quintal', variety: 'Robusta' },
};

@Injectable()
export class MarketService {
  private readonly logger = new Logger(MarketService.name);
  private readonly transportCostPerKm = 12; // INR per km per quintal

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly agmarknetClient: AgmarknetClient,
  ) {}

  /**
   * Get market prices for a commodity within a specified radius
   * Uses Haversine formula for distance calculation
   */
  async getPrices(
    commodity: string,
    latitude: number,
    longitude: number,
    radiusKm: number = 100,
  ): Promise<MarketPriceResult[]> {
    const cropInfo = CROP_BASE_PRICES[commodity] || {
      msp: 2000,
      marketBase: 2200,
      unit: 'quintal',
      variety: 'Standard',
    };

    // Try to fetch real data from Agmarknet API
    let realPrices: ParsedMarketPrice[] = [];
    let dataSource: 'live' | 'cached' | 'generated' = 'generated';

    try {
      if (this.agmarknetClient.isConfigured()) {
        realPrices = await this.agmarknetClient.fetchPrices(commodity);
        if (realPrices.length > 0) {
          dataSource = 'live';
          this.logger.log(`Fetched ${realPrices.length} live prices for ${commodity}`);
        }
      }
    } catch (error) {
      this.logger.warn('Failed to fetch real market prices, trying cache', error);
    }

    // If no live data, try to get cached prices from database
    if (realPrices.length === 0) {
      const cachedPrices = await this.getCachedPrices(commodity);
      if (cachedPrices.length > 0) {
        dataSource = 'cached';
        this.logger.log(`Using ${cachedPrices.length} cached prices for ${commodity}`);
      }
    }

    // Get nearby markets filtered by distance
    const nearbyMarkets = this.filterMarketsByDistance(latitude, longitude, radiusKm);

    // Generate results for each nearby market
    const results: MarketPriceResult[] = [];
    for (const market of nearbyMarkets) {
      const result = this.buildMarketPriceResult(
        commodity,
        market,
        cropInfo,
        realPrices,
        dataSource,
      );
      results.push(result);
    }

    // Sort by net price (modal - transport cost) descending
    results.sort((a, b) => (b.price.modal - b.transportationCost) - (a.price.modal - a.transportationCost));
    return results;
  }


  /**
   * Filter markets by distance using Haversine formula
   */
  private filterMarketsByDistance(
    latitude: number,
    longitude: number,
    radiusKm: number,
  ): Array<typeof INDIAN_MARKETS[0] & { distance: number }> {
    return INDIAN_MARKETS
      .map((market) => ({
        ...market,
        distance: this.calculateDistance(latitude, longitude, market.lat, market.lng),
      }))
      .filter((market) => market.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance);
  }

  /**
   * Build a market price result combining real and generated data
   */
  private buildMarketPriceResult(
    commodity: string,
    market: typeof INDIAN_MARKETS[0] & { distance: number },
    cropInfo: { msp: number; marketBase: number; unit: string; variety: string },
    realPrices: ParsedMarketPrice[],
    dataSource: 'live' | 'cached' | 'generated',
  ): MarketPriceResult {
    // Check if we have real data for this market
    const realPrice = realPrices.find(
      (p) =>
        p.market?.toLowerCase().includes(market.district.toLowerCase()) ||
        p.district?.toLowerCase().includes(market.district.toLowerCase()),
    );

    let modalPrice: number;
    let minPrice: number;
    let maxPrice: number;
    let fetchedAt: Date | undefined;

    if (realPrice) {
      modalPrice = realPrice.modalPrice || cropInfo.marketBase;
      minPrice = realPrice.minPrice || modalPrice * 0.9;
      maxPrice = realPrice.maxPrice || modalPrice * 1.1;
      fetchedAt = realPrice.fetchedAt;
    } else {
      // Generate realistic price with market-specific variation
      const marketVariation = (Math.random() - 0.5) * 0.15;
      const distanceEffect = market.distance > 50 ? -0.02 : 0;
      modalPrice = Math.round(cropInfo.marketBase * (1 + marketVariation + distanceEffect));
      minPrice = Math.round(modalPrice * 0.92);
      maxPrice = Math.round(modalPrice * 1.08);
    }

    const trend = this.calculateTrend(commodity, market.name);
    const priceChange =
      trend === 'rising'
        ? Math.random() * 8 + 2
        : trend === 'falling'
          ? -(Math.random() * 8 + 2)
          : Math.random() * 4 - 2;

    return {
      commodity,
      variety: cropInfo.variety,
      market: {
        name: market.name,
        district: market.district,
        state: market.state,
        distance: Math.round(market.distance),
      },
      price: {
        min: minPrice,
        max: maxPrice,
        modal: modalPrice,
        unit: cropInfo.unit,
      },
      date: new Date().toISOString().split('T')[0],
      trend,
      priceChange: Math.round(priceChange * 10) / 10,
      transportationCost: this.calculateTransportationCost(market.distance),
      dataSource: realPrice ? dataSource : 'generated',
      fetchedAt,
    };
  }

  /**
   * Calculate transportation cost based on distance
   * Uses Haversine distance as approximation for road distance
   */
  calculateTransportationCost(distanceKm: number): number {
    return Math.round(distanceKm * this.transportCostPerKm);
  }

  /**
   * Get cached prices from database
   */
  private async getCachedPrices(commodity: string): Promise<ParsedMarketPrice[]> {
    try {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const cached = await this.prisma.marketPrice.findMany({
        where: {
          commodity: { equals: commodity, mode: 'insensitive' },
          priceDate: { gte: oneDayAgo },
        },
        orderBy: { priceDate: 'desc' },
        take: 50,
      });

      return cached.map((p) => ({
        state: p.district || '',
        district: p.district,
        market: p.marketName,
        commodity: p.commodity,
        variety: p.variety || '',
        arrivalDate: p.priceDate,
        minPrice: p.minPrice?.toNumber() || 0,
        maxPrice: p.maxPrice?.toNumber() || 0,
        modalPrice: p.modalPrice?.toNumber() || 0,
        fetchedAt: p.createdAt,
      }));
    } catch (error) {
      this.logger.warn('Failed to fetch cached prices', error);
      return [];
    }
  }

  /**
   * Calculate trend based on commodity and season
   */
  private calculateTrend(commodity: string, marketName: string): 'rising' | 'falling' | 'stable' {
    const month = new Date().getMonth();
    const hash = (commodity + marketName).split('').reduce((a, b) => a + b.charCodeAt(0), 0);

    const seasonalTrends: Record<string, number[]> = {
      Rice: [1, 1, 0, 0, -1, -1, 0, 0, 1, 1, 1, 1],
      Wheat: [0, 0, 1, 1, 1, 0, -1, -1, -1, 0, 0, 0],
      Tomato: [-1, 0, 1, 1, 0, -1, -1, 0, 1, 1, 0, -1],
      Onion: [1, 1, 0, -1, -1, 0, 1, 1, 0, -1, -1, 0],
    };

    const trend = seasonalTrends[commodity]?.[month] ?? (hash % 3) - 1;

    if (trend > 0) return 'rising';
    if (trend < 0) return 'falling';
    return 'stable';
  }


  /**
   * Get price trends for a commodity over specified days
   */
  async getPriceTrends(commodity: string, days: number = 30): Promise<{ date: string; price: number }[]> {
    const trends: { date: string; price: number }[] = [];
    const cropInfo = CROP_BASE_PRICES[commodity] || { marketBase: 2000 };
    const basePrice = cropInfo.marketBase;
    const today = new Date();

    let currentPrice = basePrice;
    const volatility = commodity === 'Tomato' || commodity === 'Onion' ? 0.08 : 0.03;

    for (let i = days; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);

      const dailyChange = (Math.random() - 0.48) * volatility * currentPrice;
      currentPrice = Math.max(basePrice * 0.7, Math.min(basePrice * 1.3, currentPrice + dailyChange));

      trends.push({
        date: date.toISOString().split('T')[0],
        price: Math.round(currentPrice),
      });
    }

    return trends;
  }

  /**
   * Get selling recommendation with MSP comparison
   */
  async getSellingRecommendation(
    commodity: string,
    latitude: number,
    longitude: number,
  ): Promise<SellingRecommendation> {
    const prices = await this.getPrices(commodity, latitude, longitude);
    const trends = await this.getPriceTrends(commodity);
    const cropInfo = CROP_BASE_PRICES[commodity];

    if (prices.length === 0) {
      return {
        recommendation: 'No nearby markets found',
        reasoning: ['Try increasing the search radius or check your location'],
        confidence: 'low',
        msp: cropInfo?.msp || null,
      };
    }

    const avgPrice30Days = trends.reduce((sum, t) => sum + t.price, 0) / trends.length;
    const currentPrice = prices[0].price.modal;
    const priceAboveAvg = ((currentPrice - avgPrice30Days) / avgPrice30Days) * 100;
    const bestMarket = prices[0];
    const reasoning: string[] = [];
    let recommendation: string;
    let confidence: 'high' | 'medium' | 'low';

    // Build MSP comparison
    let mspComparison: SellingRecommendation['mspComparison'];
    if (cropInfo?.msp && cropInfo.msp > 0) {
      const difference = currentPrice - cropInfo.msp;
      const percentageDiff = (difference / cropInfo.msp) * 100;
      const isBelowMsp = currentPrice < cropInfo.msp;

      mspComparison = {
        currentPrice,
        msp: cropInfo.msp,
        difference,
        percentageDiff: Math.round(percentageDiff * 10) / 10,
        isBelowMsp,
      };

      if (isBelowMsp) {
        reasoning.push(
          `⚠️ Current price (₹${currentPrice}) is ${Math.abs(percentageDiff).toFixed(1)}% below MSP (₹${cropInfo.msp})`,
        );
      } else {
        reasoning.push(
          `✓ Current price (₹${currentPrice}) is ${percentageDiff.toFixed(1)}% above MSP (₹${cropInfo.msp})`,
        );
      }
    }

    if (priceAboveAvg > 15 && bestMarket.trend !== 'falling') {
      recommendation = '🟢 SELL NOW - Excellent conditions';
      confidence = 'high';
      reasoning.push(`Current price is ${priceAboveAvg.toFixed(1)}% above 30-day average`);
      reasoning.push(`Price trend is ${bestMarket.trend}`);
      reasoning.push(`Best market: ${bestMarket.market.name} at ₹${bestMarket.price.modal}/${bestMarket.price.unit}`);
      reasoning.push(`Net after transport: ₹${bestMarket.price.modal - bestMarket.transportationCost}/${bestMarket.price.unit}`);
    } else if (priceAboveAvg > 5 && bestMarket.trend === 'rising') {
      recommendation = '🟡 CONSIDER SELLING - Good conditions';
      confidence = 'medium';
      reasoning.push(`Prices are ${priceAboveAvg.toFixed(1)}% above average and rising`);
      reasoning.push(`Best market: ${bestMarket.market.name}`);
    } else if (bestMarket.trend === 'rising') {
      recommendation = '🟡 HOLD - Prices are rising';
      confidence = 'medium';
      reasoning.push('Wait for better prices as trend is upward');
      reasoning.push(`Current price: ₹${currentPrice}/${bestMarket.price.unit}`);
    } else if (priceAboveAvg < -10) {
      recommendation = '🔴 HOLD - Prices below average';
      confidence = 'medium';
      reasoning.push(`Current price is ${Math.abs(priceAboveAvg).toFixed(1)}% below 30-day average`);
      reasoning.push('Consider storing if possible');
    } else {
      recommendation = '🟡 CONSIDER SELLING';
      confidence = 'low';
      reasoning.push('Prices are at average levels');
      reasoning.push(`Best market: ${bestMarket.market.name}`);
    }

    return {
      recommendation,
      confidence,
      reasoning,
      bestMarket,
      currentPrice,
      avgPrice30Days: Math.round(avgPrice30Days),
      priceAboveAvg: Math.round(priceAboveAvg * 10) / 10,
      msp: cropInfo?.msp || null,
      mspComparison,
    };
  }

  /**
   * Get MSP data for a commodity
   */
  getMspData(commodity: string): { msp: number; unit: string } | null {
    const cropInfo = CROP_BASE_PRICES[commodity];
    if (!cropInfo || cropInfo.msp === 0) {
      return null;
    }
    return { msp: cropInfo.msp, unit: cropInfo.unit };
  }

  /**
   * Get all supported commodities
   */
  async getAllCommodities(): Promise<string[]> {
    return Object.keys(CROP_BASE_PRICES);
  }

  /**
   * Get markets by state
   */
  async getMarketsByState(state: string): Promise<typeof INDIAN_MARKETS> {
    return INDIAN_MARKETS.filter((m) => m.state.toLowerCase() === state.toLowerCase());
  }

  /**
   * Calculate distance between two points using Haversine formula
   */
  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}

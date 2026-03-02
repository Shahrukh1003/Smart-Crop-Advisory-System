import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { MarketService } from './market.service';
import { PriceAlertService } from './price-alert.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('market')
@Controller('market')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MarketController {
  constructor(
    private readonly marketService: MarketService,
    private readonly priceAlertService: PriceAlertService,
  ) {}

  @Get('prices')
  @ApiOperation({ summary: 'Get market prices for a commodity within radius' })
  @ApiQuery({ name: 'commodity', example: 'Rice' })
  @ApiQuery({ name: 'latitude', type: Number, example: 12.9716 })
  @ApiQuery({ name: 'longitude', type: Number, example: 77.5946 })
  @ApiQuery({ name: 'radius', type: Number, required: false, example: 50 })
  async getPrices(
    @Query('commodity') commodity: string,
    @Query('latitude') latitude: number,
    @Query('longitude') longitude: number,
    @Query('radius') radius?: number,
  ) {
    return this.marketService.getPrices(commodity, latitude, longitude, radius || 50);
  }

  @Get('trends')
  @ApiOperation({ summary: 'Get 30-day price trends for a commodity' })
  @ApiQuery({ name: 'commodity', example: 'Rice' })
  @ApiQuery({ name: 'days', type: Number, required: false, example: 30 })
  async getTrends(
    @Query('commodity') commodity: string,
    @Query('days') days?: number,
  ) {
    return this.marketService.getPriceTrends(commodity, days || 30);
  }

  @Get('recommendation')
  @ApiOperation({ summary: 'Get selling recommendation for a commodity' })
  @ApiQuery({ name: 'commodity', example: 'Rice' })
  @ApiQuery({ name: 'latitude', type: Number, example: 12.9716 })
  @ApiQuery({ name: 'longitude', type: Number, example: 77.5946 })
  async getRecommendation(
    @Query('commodity') commodity: string,
    @Query('latitude') latitude: number,
    @Query('longitude') longitude: number,
  ) {
    return this.marketService.getSellingRecommendation(commodity, latitude, longitude);
  }

  @Get('commodities')
  @ApiOperation({ summary: 'Get list of all supported commodities' })
  async getCommodities() {
    return this.marketService.getAllCommodities();
  }

  @Get('markets')
  @ApiOperation({ summary: 'Get markets by state' })
  @ApiQuery({ name: 'state', example: 'Karnataka' })
  async getMarkets(@Query('state') state: string) {
    return this.marketService.getMarketsByState(state);
  }

  @Get('alerts')
  @ApiOperation({ summary: 'Get price change alerts for a commodity' })
  @ApiQuery({ name: 'commodity', example: 'Rice' })
  async getPriceAlerts(@Query('commodity') commodity: string) {
    return this.priceAlertService.checkPriceChanges(commodity);
  }

  @Get('msp')
  @ApiOperation({ summary: 'Get MSP data for a commodity' })
  @ApiQuery({ name: 'commodity', example: 'Rice' })
  async getMspData(@Query('commodity') commodity: string) {
    return this.marketService.getMspData(commodity);
  }
}

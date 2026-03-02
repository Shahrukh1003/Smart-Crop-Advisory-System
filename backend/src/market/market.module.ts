import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MarketService } from './market.service';
import { MarketController } from './market.controller';
import { AgmarknetClient } from './agmarknet.client';
import { PriceAlertService } from './price-alert.service';

@Module({
  imports: [HttpModule],
  providers: [MarketService, AgmarknetClient, PriceAlertService],
  controllers: [MarketController],
  exports: [MarketService, AgmarknetClient, PriceAlertService],
})
export class MarketModule {}

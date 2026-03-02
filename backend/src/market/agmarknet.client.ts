import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

export interface AgmarknetPriceRecord {
  state: string;
  district: string;
  market: string;
  commodity: string;
  variety: string;
  arrival_date: string;
  min_price: number;
  max_price: number;
  modal_price: number;
}

export interface AgmarknetApiResponse {
  status: string;
  message: string;
  total: number;
  count: number;
  records: AgmarknetPriceRecord[];
}

export interface ParsedMarketPrice {
  state: string;
  district: string;
  market: string;
  commodity: string;
  variety: string;
  arrivalDate: Date;
  minPrice: number;
  maxPrice: number;
  modalPrice: number;
  fetchedAt: Date;
}

@Injectable()
export class AgmarknetClient {
  private readonly logger = new Logger(AgmarknetClient.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly timeout: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiUrl = this.configService.get<string>(
      'MARKET_PRICE_API_URL',
      'https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070',
    );
    this.apiKey = this.configService.get<string>('MARKET_PRICE_API_KEY', '');
    this.timeout = this.configService.get<number>('MARKET_PRICE_API_TIMEOUT', 5000);
  }


  /**
   * Check if the API client is configured with valid credentials
   */
  isConfigured(): boolean {
    return !!(this.apiUrl && this.apiKey);
  }

  /**
   * Fetch market prices for a specific commodity from Agmarknet API
   */
  async fetchPrices(commodity: string, state?: string, limit: number = 100): Promise<ParsedMarketPrice[]> {
    if (!this.isConfigured()) {
      this.logger.warn('Agmarknet API not configured, skipping real API call');
      return [];
    }

    try {
      const params = new URLSearchParams({
        'api-key': this.apiKey,
        format: 'json',
        limit: limit.toString(),
        'filters[commodity]': commodity,
      });

      if (state) {
        params.append('filters[state]', state);
      }

      const url = `${this.apiUrl}?${params.toString()}`;
      this.logger.debug(`Fetching prices from Agmarknet: ${url}`);

      const response = await firstValueFrom(
        this.httpService.get<AgmarknetApiResponse>(url, {
          timeout: this.timeout,
          headers: {
            Accept: 'application/json',
          },
        }),
      );

      if (response.data?.records && Array.isArray(response.data.records)) {
        return this.parseRecords(response.data.records);
      }

      this.logger.warn('No records found in Agmarknet response');
      return [];
    } catch (error) {
      this.handleApiError(error, commodity);
      return [];
    }
  }

  /**
   * Fetch prices for multiple commodities
   */
  async fetchPricesForCommodities(commodities: string[], state?: string): Promise<Map<string, ParsedMarketPrice[]>> {
    const results = new Map<string, ParsedMarketPrice[]>();

    await Promise.all(
      commodities.map(async (commodity) => {
        const prices = await this.fetchPrices(commodity, state);
        results.set(commodity, prices);
      }),
    );

    return results;
  }

  /**
   * Parse raw API records into structured format
   */
  private parseRecords(records: AgmarknetPriceRecord[]): ParsedMarketPrice[] {
    const fetchedAt = new Date();

    return records
      .filter((record) => this.isValidRecord(record))
      .map((record) => ({
        state: record.state?.trim() || '',
        district: record.district?.trim() || '',
        market: record.market?.trim() || '',
        commodity: record.commodity?.trim() || '',
        variety: record.variety?.trim() || '',
        arrivalDate: this.parseDate(record.arrival_date),
        minPrice: this.parsePrice(record.min_price),
        maxPrice: this.parsePrice(record.max_price),
        modalPrice: this.parsePrice(record.modal_price),
        fetchedAt,
      }));
  }

  /**
   * Validate that a record has required fields
   */
  private isValidRecord(record: AgmarknetPriceRecord): boolean {
    return !!(
      record &&
      record.market &&
      record.commodity &&
      (record.modal_price || record.min_price || record.max_price)
    );
  }

  /**
   * Parse date string from API (format: DD/MM/YYYY or YYYY-MM-DD)
   */
  private parseDate(dateStr: string): Date {
    if (!dateStr) return new Date();

    // Try DD/MM/YYYY format
    const ddmmyyyy = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (ddmmyyyy) {
      return new Date(`${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`);
    }

    // Try ISO format
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  /**
   * Parse price value, handling string or number input
   */
  private parsePrice(price: number | string | undefined): number {
    if (price === undefined || price === null) return 0;
    const parsed = typeof price === 'string' ? parseFloat(price) : price;
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Handle API errors with appropriate logging
   */
  private handleApiError(error: unknown, commodity: string): void {
    if (error instanceof AxiosError) {
      if (error.code === 'ECONNABORTED') {
        this.logger.warn(`Agmarknet API timeout for ${commodity}`);
      } else if (error.response?.status === 429) {
        this.logger.warn(`Agmarknet API rate limit exceeded for ${commodity}`);
      } else if (error.response?.status === 401 || error.response?.status === 403) {
        this.logger.error(`Agmarknet API authentication failed for ${commodity}`);
      } else {
        this.logger.warn(
          `Agmarknet API error for ${commodity}: ${error.message}`,
          error.response?.status,
        );
      }
    } else {
      this.logger.error(`Unexpected error fetching ${commodity} prices:`, error);
    }
  }
}

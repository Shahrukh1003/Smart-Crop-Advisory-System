import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, checkConnectivity } from './apiWithRetry';

// Cache keys
const CACHE_KEYS = {
  WEATHER: 'cache_weather',
  RECOMMENDATIONS: 'cache_recommendations',
  MARKET_PRICES: 'cache_market_prices',
  CROP_HISTORY: 'cache_crop_history',
};

// Cache TTL in milliseconds
const CACHE_TTL = {
  WEATHER: 6 * 60 * 60 * 1000, // 6 hours
  RECOMMENDATIONS: 7 * 24 * 60 * 60 * 1000, // 7 days
  MARKET_PRICES: 24 * 60 * 60 * 1000, // 24 hours
  CROP_HISTORY: 30 * 24 * 60 * 60 * 1000, // 30 days
};

interface CachedData<T> {
  data: T;
  timestamp: number;
  isStale: boolean;
}

// Save data to cache
export const saveToCache = async <T>(key: string, data: T): Promise<void> => {
  try {
    const cacheEntry = {
      data,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(key, JSON.stringify(cacheEntry));
  } catch (error) {
    console.error('Failed to save to cache:', error);
  }
};

// Get data from cache with staleness indicator
export const getFromCache = async <T>(
  key: string,
  ttl: number
): Promise<CachedData<T> | null> => {
  try {
    const cached = await AsyncStorage.getItem(key);
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    const age = Date.now() - timestamp;
    const isStale = age > ttl;

    return { data, timestamp, isStale };
  } catch (error) {
    console.error('Failed to read from cache:', error);
    return null;
  }
};

// Fetch with fallback to cache
export const fetchWithFallback = async <T>(
  endpoint: string,
  cacheKey: string,
  cacheTTL: number,
  params?: Record<string, any>
): Promise<{ data: T; fromCache: boolean; isStale: boolean; lastUpdated?: Date }> => {
  const isOnline = await checkConnectivity();

  // Try to fetch from API if online
  if (isOnline) {
    try {
      const response = await api.get<T>(endpoint, { params });
      await saveToCache(cacheKey, response.data);
      return { data: response.data, fromCache: false, isStale: false };
    } catch (error) {
      console.log('API request failed, falling back to cache');
    }
  }

  // Fall back to cache
  const cached = await getFromCache<T>(cacheKey, cacheTTL);
  if (cached) {
    return {
      data: cached.data,
      fromCache: true,
      isStale: cached.isStale,
      lastUpdated: new Date(cached.timestamp),
    };
  }

  throw new Error('No data available. Please check your internet connection.');
};

// Weather service with fallback
export const getWeatherWithFallback = async (latitude: number, longitude: number) => {
  const cacheKey = `${CACHE_KEYS.WEATHER}_${latitude}_${longitude}`;
  return fetchWithFallback(
    '/weather/forecast',
    cacheKey,
    CACHE_TTL.WEATHER,
    { latitude, longitude }
  );
};

// Recommendations with fallback
export const getRecommendationsWithFallback = async (parcelId: string) => {
  const cacheKey = `${CACHE_KEYS.RECOMMENDATIONS}_${parcelId}`;
  return fetchWithFallback(
    `/advisory/recommendations/${parcelId}`,
    cacheKey,
    CACHE_TTL.RECOMMENDATIONS
  );
};

// Market prices with fallback
export const getMarketPricesWithFallback = async (
  commodity: string,
  latitude: number,
  longitude: number
) => {
  const cacheKey = `${CACHE_KEYS.MARKET_PRICES}_${commodity}_${latitude}_${longitude}`;
  return fetchWithFallback(
    '/market/prices',
    cacheKey,
    CACHE_TTL.MARKET_PRICES,
    { commodity, latitude, longitude }
  );
};

// Rule-based fallback recommendations when ML fails
export const getRuleBasedRecommendations = (
  soilType: string,
  season: string,
  rainfall: number
): { cropName: string; suitabilityScore: number; reasoning: string[] }[] => {
  const recommendations: { cropName: string; suitabilityScore: number; reasoning: string[] }[] = [];

  // Simple rule-based logic
  if (season === 'kharif') {
    if (rainfall > 800) {
      recommendations.push({
        cropName: 'Rice',
        suitabilityScore: 75,
        reasoning: ['Good for high rainfall areas', 'Kharif season crop'],
      });
    }
    recommendations.push({
      cropName: 'Maize',
      suitabilityScore: 70,
      reasoning: ['Suitable for monsoon season', 'Moderate water requirement'],
    });
    recommendations.push({
      cropName: 'Groundnut',
      suitabilityScore: 65,
      reasoning: ['Good for sandy/red soils', 'Nitrogen fixing crop'],
    });
  } else if (season === 'rabi') {
    recommendations.push({
      cropName: 'Wheat',
      suitabilityScore: 75,
      reasoning: ['Winter crop', 'Good for irrigated areas'],
    });
    recommendations.push({
      cropName: 'Chickpea',
      suitabilityScore: 70,
      reasoning: ['Low water requirement', 'Good for black soil'],
    });
  } else {
    recommendations.push({
      cropName: 'Vegetables',
      suitabilityScore: 70,
      reasoning: ['Short duration crops', 'Good market demand'],
    });
  }

  // Adjust based on soil type
  if (soilType.toLowerCase().includes('black')) {
    recommendations.forEach(r => {
      if (r.cropName === 'Cotton' || r.cropName === 'Chickpea') {
        r.suitabilityScore += 10;
      }
    });
  }

  return recommendations.sort((a, b) => b.suitabilityScore - a.suitabilityScore);
};

// Staleness indicator component helper
export const getStalenessMessage = (lastUpdated: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - lastUpdated.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `Last updated ${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  } else if (diffHours > 0) {
    return `Last updated ${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else {
    return 'Recently updated';
  }
};

// Clear all cached data
export const clearAllCache = async (): Promise<void> => {
  const keys = await AsyncStorage.getAllKeys();
  const cacheKeys = keys.filter(k => k.startsWith('cache_'));
  await AsyncStorage.multiRemove(cacheKeys);
};

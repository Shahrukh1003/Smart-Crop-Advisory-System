import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { create } from 'zustand';

// Cache keys
const CACHE_KEYS = {
  RECOMMENDATIONS: 'cache_recommendations',
  WEATHER: 'cache_weather',
  MARKET_PRICES: 'cache_market_prices',
  CROP_HISTORY: 'cache_crop_history',
  SYNC_QUEUE: 'sync_queue',
  ACTIVITIES: 'cache_activities',
};

// Cache metadata interface
export interface CacheMetadata {
  timestamp: number;
  isStale: boolean;
  lastSyncAt: number | null;
  version?: string;
  location?: { latitude: number; longitude: number };
}

// Cached data with metadata
export interface CachedData<T> {
  data: T;
  metadata: CacheMetadata;
}

// Weather cache entry with location
export interface WeatherCacheEntry {
  current: {
    temperature: number;
    humidity: number;
    rainfall: number;
    windSpeed: number;
    description: string;
  };
  forecast: Array<{
    date: string;
    temperature: { min: number; max: number };
    humidity: number;
    rainfall: number;
    description: string;
  }>;
  location: { latitude: number; longitude: number };
}

// Market price cache entry
export interface MarketPriceCacheEntry {
  commodity: string;
  prices: Array<{
    market: string;
    price: number;
    unit: string;
    distance: number;
    transportationCost: number;
    lastUpdated: string;
  }>;
  msp?: number;
  location: { latitude: number; longitude: number };
}

// Recommendation cache entry
export interface RecommendationCacheEntry {
  parcelId: string;
  recommendations: Array<{
    cropName: string;
    variety?: string;
    suitabilityScore: number;
    expectedYield?: number;
    reasoning: string[];
    risks: string[];
  }>;
  soilData?: {
    type: string;
    ph: number;
    nitrogen: number;
    phosphorus: number;
    potassium: number;
  };
}

// Activity entry for offline logging
export interface ActivityEntry {
  id: string;
  type: 'sowing' | 'irrigation' | 'fertilizer' | 'pesticide' | 'harvest' | 'other';
  parcelId: string;
  description: string;
  timestamp: number;
  syncStatus: 'pending' | 'synced' | 'failed';
  data?: Record<string, unknown>;
}

// Sync queue item
export interface SyncQueueItem {
  id: string;
  operation: 'create' | 'update' | 'delete';
  entityType: 'activity' | 'crop_history' | 'pest_detection' | 'feedback';
  entityData: any;
  createdAt: number;
  status: 'pending' | 'syncing' | 'completed' | 'failed';
  retryCount: number;
}

// Offline store state
interface OfflineState {
  isOnline: boolean;
  syncQueue: SyncQueueItem[];
  lastSyncAt: number | null;
  isSyncing: boolean;

  // Actions
  setOnlineStatus: (isOnline: boolean) => void;
  addToSyncQueue: (item: Omit<SyncQueueItem, 'id' | 'createdAt' | 'status' | 'retryCount'>) => Promise<void>;
  removeFromSyncQueue: (id: string) => Promise<void>;
  updateSyncItemStatus: (id: string, status: SyncQueueItem['status']) => Promise<void>;
  loadSyncQueue: () => Promise<void>;
  processSyncQueue: () => Promise<void>;

  // Cache operations
  cacheData: <T>(key: string, data: T, metadata?: Partial<CacheMetadata>) => Promise<void>;
  getCachedData: <T>(key: string, ttl?: number) => Promise<CachedData<T> | null>;
  clearCache: (key?: string) => Promise<void>;

  // Enhanced specific cache operations
  cacheRecommendations: (data: RecommendationCacheEntry, parcelId?: string) => Promise<void>;
  getCachedRecommendations: (parcelId?: string) => Promise<CachedData<RecommendationCacheEntry> | null>;
  cacheWeather: (data: WeatherCacheEntry, location?: { latitude: number; longitude: number }) => Promise<void>;
  getCachedWeather: (location?: { latitude: number; longitude: number }) => Promise<CachedData<WeatherCacheEntry> | null>;
  cacheMarketPrices: (data: MarketPriceCacheEntry, commodity?: string) => Promise<void>;
  getCachedMarketPrices: (commodity?: string) => Promise<CachedData<MarketPriceCacheEntry> | null>;
  
  // Activity logging
  cacheActivity: (activity: Omit<ActivityEntry, 'id' | 'timestamp' | 'syncStatus'>) => Promise<void>;
  getCachedActivities: () => Promise<CachedData<ActivityEntry[]> | null>;
  updateActivitySyncStatus: (id: string, status: ActivityEntry['syncStatus']) => Promise<void>;
  
  // Freshness helpers
  isCacheStale: (timestamp: number, ttl: number) => boolean;
  getCacheFreshnessInfo: (timestamp: number, ttl: number) => { isStale: boolean; ageMs: number; ageText: string };
}

// Cache TTL in milliseconds (as per design document)
export const CACHE_TTL = {
  RECOMMENDATIONS: 7 * 24 * 60 * 60 * 1000, // 7 days
  WEATHER_CURRENT: 60 * 60 * 1000, // 1 hour for current conditions
  WEATHER_FORECAST: 6 * 60 * 60 * 1000, // 6 hours for forecasts
  MARKET_PRICES: 60 * 60 * 1000, // 1 hour
  ACTIVITIES: 30 * 24 * 60 * 60 * 1000, // 30 days
};

// Location change threshold in km (triggers weather refresh)
export const LOCATION_CHANGE_THRESHOLD_KM = 10;

export const useOfflineStore = create<OfflineState>((set, get) => ({
  isOnline: true,
  syncQueue: [],
  lastSyncAt: null,
  isSyncing: false,


  setOnlineStatus: (isOnline: boolean) => {
    set({ isOnline });
    if (isOnline) {
      // Trigger sync when coming back online
      get().processSyncQueue();
    }
  },

  addToSyncQueue: async (item) => {
    const newItem: SyncQueueItem = {
      ...item,
      id: `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      status: 'pending',
      retryCount: 0,
    };

    const queue = [...get().syncQueue, newItem];
    set({ syncQueue: queue });
    await AsyncStorage.setItem(CACHE_KEYS.SYNC_QUEUE, JSON.stringify(queue));
  },

  removeFromSyncQueue: async (id: string) => {
    const queue = get().syncQueue.filter(item => item.id !== id);
    set({ syncQueue: queue });
    await AsyncStorage.setItem(CACHE_KEYS.SYNC_QUEUE, JSON.stringify(queue));
  },

  updateSyncItemStatus: async (id: string, status: SyncQueueItem['status']) => {
    const queue = get().syncQueue.map(item =>
      item.id === id ? { ...item, status, retryCount: item.retryCount + (status === 'failed' ? 1 : 0) } : item
    );
    set({ syncQueue: queue });
    await AsyncStorage.setItem(CACHE_KEYS.SYNC_QUEUE, JSON.stringify(queue));
  },

  loadSyncQueue: async () => {
    try {
      const stored = await AsyncStorage.getItem(CACHE_KEYS.SYNC_QUEUE);
      if (stored) {
        set({ syncQueue: JSON.parse(stored) });
      }
    } catch (error) {
      console.error('Failed to load sync queue:', error);
    }
  },

  processSyncQueue: async () => {
    const { syncQueue, isOnline, isSyncing } = get();
    if (!isOnline || isSyncing || syncQueue.length === 0) return;

    set({ isSyncing: true });

    const pendingItems = syncQueue.filter(item => item.status === 'pending' && item.retryCount < 3);

    for (const item of pendingItems) {
      try {
        await get().updateSyncItemStatus(item.id, 'syncing');
        
        // In production, make API call here based on entityType and operation
        // Simulating API call
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await get().updateSyncItemStatus(item.id, 'completed');
        await get().removeFromSyncQueue(item.id);
      } catch (error) {
        console.error(`Sync failed for item ${item.id}:`, error);
        await get().updateSyncItemStatus(item.id, 'failed');
      }
    }

    set({ isSyncing: false, lastSyncAt: Date.now() });
  },

  cacheData: async <T>(key: string, data: T, metadata?: Partial<CacheMetadata>) => {
    const cachedData: CachedData<T> = {
      data,
      metadata: {
        timestamp: Date.now(),
        isStale: false,
        lastSyncAt: Date.now(),
        ...metadata,
      },
    };
    await AsyncStorage.setItem(key, JSON.stringify(cachedData));
  },

  getCachedData: async <T>(key: string, ttl?: number): Promise<CachedData<T> | null> => {
    try {
      const stored = await AsyncStorage.getItem(key);
      if (!stored) return null;

      const cached: CachedData<T> = JSON.parse(stored);
      
      // Determine TTL based on key type if not provided
      let effectiveTtl = ttl;
      if (!effectiveTtl) {
        if (key.includes('weather')) effectiveTtl = CACHE_TTL.WEATHER_FORECAST;
        else if (key.includes('market')) effectiveTtl = CACHE_TTL.MARKET_PRICES;
        else if (key.includes('activities')) effectiveTtl = CACHE_TTL.ACTIVITIES;
        else effectiveTtl = CACHE_TTL.RECOMMENDATIONS;
      }

      const isStale = Date.now() - cached.metadata.timestamp > effectiveTtl;
      cached.metadata.isStale = isStale;

      return cached;
    } catch (error) {
      console.error(`Failed to get cached data for ${key}:`, error);
      return null;
    }
  },

  clearCache: async (key?: string) => {
    if (key) {
      await AsyncStorage.removeItem(key);
    } else {
      await AsyncStorage.multiRemove(Object.values(CACHE_KEYS));
    }
  },

  cacheRecommendations: async (data: RecommendationCacheEntry, parcelId?: string) => {
    const key = parcelId ? `${CACHE_KEYS.RECOMMENDATIONS}_${parcelId}` : CACHE_KEYS.RECOMMENDATIONS;
    await get().cacheData(key, data, { version: '1.0' });
  },

  getCachedRecommendations: async (parcelId?: string) => {
    const key = parcelId ? `${CACHE_KEYS.RECOMMENDATIONS}_${parcelId}` : CACHE_KEYS.RECOMMENDATIONS;
    return get().getCachedData<RecommendationCacheEntry>(key, CACHE_TTL.RECOMMENDATIONS);
  },

  cacheWeather: async (data: WeatherCacheEntry, location?: { latitude: number; longitude: number }) => {
    const key = location 
      ? `${CACHE_KEYS.WEATHER}_${location.latitude.toFixed(2)}_${location.longitude.toFixed(2)}`
      : CACHE_KEYS.WEATHER;
    await get().cacheData(key, data, { location, version: '1.0' });
  },

  getCachedWeather: async (location?: { latitude: number; longitude: number }) => {
    const key = location 
      ? `${CACHE_KEYS.WEATHER}_${location.latitude.toFixed(2)}_${location.longitude.toFixed(2)}`
      : CACHE_KEYS.WEATHER;
    return get().getCachedData<WeatherCacheEntry>(key, CACHE_TTL.WEATHER_FORECAST);
  },

  cacheMarketPrices: async (data: MarketPriceCacheEntry, commodity?: string) => {
    const key = commodity ? `${CACHE_KEYS.MARKET_PRICES}_${commodity}` : CACHE_KEYS.MARKET_PRICES;
    await get().cacheData(key, data, { 
      location: data.location,
      version: '1.0' 
    });
  },

  getCachedMarketPrices: async (commodity?: string) => {
    const key = commodity ? `${CACHE_KEYS.MARKET_PRICES}_${commodity}` : CACHE_KEYS.MARKET_PRICES;
    return get().getCachedData<MarketPriceCacheEntry>(key, CACHE_TTL.MARKET_PRICES);
  },

  // Activity logging with timestamps
  cacheActivity: async (activity: Omit<ActivityEntry, 'id' | 'timestamp' | 'syncStatus'>) => {
    const newActivity: ActivityEntry = {
      ...activity,
      id: `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      syncStatus: 'pending',
    };

    // Get existing activities
    const cached = await get().getCachedActivities();
    const activities = cached?.data || [];
    activities.push(newActivity);

    await get().cacheData(CACHE_KEYS.ACTIVITIES, activities);

    // Also add to sync queue if offline
    if (!get().isOnline) {
      await get().addToSyncQueue({
        operation: 'create',
        entityType: 'activity',
        entityData: newActivity,
      });
    }
  },

  getCachedActivities: async () => {
    return get().getCachedData<ActivityEntry[]>(CACHE_KEYS.ACTIVITIES, CACHE_TTL.ACTIVITIES);
  },

  updateActivitySyncStatus: async (id: string, status: ActivityEntry['syncStatus']) => {
    const cached = await get().getCachedActivities();
    if (!cached) return;

    const activities = cached.data.map(activity =>
      activity.id === id ? { ...activity, syncStatus: status } : activity
    );

    await get().cacheData(CACHE_KEYS.ACTIVITIES, activities);
  },

  // Freshness helpers
  isCacheStale: (timestamp: number, ttl: number) => {
    return Date.now() - timestamp > ttl;
  },

  getCacheFreshnessInfo: (timestamp: number, ttl: number) => {
    const ageMs = Date.now() - timestamp;
    const isStale = ageMs > ttl;
    
    // Generate human-readable age text
    const ageMinutes = Math.floor(ageMs / (1000 * 60));
    const ageHours = Math.floor(ageMs / (1000 * 60 * 60));
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));

    let ageText: string;
    if (ageDays > 0) {
      ageText = `${ageDays} day${ageDays > 1 ? 's' : ''} ago`;
    } else if (ageHours > 0) {
      ageText = `${ageHours} hour${ageHours > 1 ? 's' : ''} ago`;
    } else if (ageMinutes > 0) {
      ageText = `${ageMinutes} minute${ageMinutes > 1 ? 's' : ''} ago`;
    } else {
      ageText = 'Just now';
    }

    return { isStale, ageMs, ageText };
  },
}));

// Network status listener
export const initNetworkListener = () => {
  return NetInfo.addEventListener((state: NetInfoState) => {
    useOfflineStore.getState().setOnlineStatus(state.isConnected ?? false);
  });
};

// Image queue for offline pest detection
export interface QueuedImage {
  id: string;
  uri: string;
  cropType?: string;
  capturedAt: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
}

const IMAGE_QUEUE_KEY = 'queued_images';

export const queueImageForAnalysis = async (uri: string, cropType?: string): Promise<void> => {
  const stored = await AsyncStorage.getItem(IMAGE_QUEUE_KEY);
  const queue: QueuedImage[] = stored ? JSON.parse(stored) : [];

  queue.push({
    id: `img-${Date.now()}`,
    uri,
    cropType,
    capturedAt: Date.now(),
    status: 'pending',
  });

  await AsyncStorage.setItem(IMAGE_QUEUE_KEY, JSON.stringify(queue));
};

export const getQueuedImages = async (): Promise<QueuedImage[]> => {
  const stored = await AsyncStorage.getItem(IMAGE_QUEUE_KEY);
  return stored ? JSON.parse(stored) : [];
};

export const removeQueuedImage = async (id: string): Promise<void> => {
  const stored = await AsyncStorage.getItem(IMAGE_QUEUE_KEY);
  const queue: QueuedImage[] = stored ? JSON.parse(stored) : [];
  const filtered = queue.filter(img => img.id !== id);
  await AsyncStorage.setItem(IMAGE_QUEUE_KEY, JSON.stringify(filtered));
};

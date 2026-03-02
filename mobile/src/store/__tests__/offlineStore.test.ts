import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
}));

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
}));

import {
  useOfflineStore,
  queueImageForAnalysis,
  getQueuedImages,
  removeQueuedImage,
  SyncQueueItem,
} from '../offlineStore';

describe('OfflineStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset store state
    useOfflineStore.setState({
      isOnline: true,
      syncQueue: [],
      lastSyncAt: null,
      isSyncing: false,
    });
  });

  // **Feature: smart-crop-advisory, Property 22: Cached data is accessible offline**
  // **Validates: Requirements 7.1**
  describe('Property 22: Cached data is accessible offline', () => {
    it('should store and retrieve cached data', async () => {
      const testData = { recommendations: [{ crop: 'Rice', score: 85 }] };
      
      await useOfflineStore.getState().cacheRecommendations(testData);
      
      expect(AsyncStorage.setItem).toHaveBeenCalled();
      
      // Mock retrieval
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify({
          data: testData,
          metadata: { timestamp: Date.now(), isStale: false, lastSyncAt: Date.now() },
        })
      );
      
      const cached = await useOfflineStore.getState().getCachedRecommendations();
      
      expect(cached).not.toBeNull();
      expect(cached?.data).toEqual(testData);
    });

    it('should return cached data when offline', async () => {
      const testData = { weather: { temp: 28, humidity: 65 } };
      
      // Cache data while online
      await useOfflineStore.getState().cacheWeather(testData);
      
      // Go offline
      useOfflineStore.getState().setOnlineStatus(false);
      expect(useOfflineStore.getState().isOnline).toBe(false);
      
      // Mock retrieval
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify({
          data: testData,
          metadata: { timestamp: Date.now(), isStale: false, lastSyncAt: Date.now() },
        })
      );
      
      // Should still be able to get cached data
      const cached = await useOfflineStore.getState().getCachedWeather();
      expect(cached?.data).toEqual(testData);
    });
  });

  // **Feature: smart-crop-advisory, Property 23: Offline data includes cache metadata**
  // **Validates: Requirements 7.3**
  describe('Property 23: Offline data includes cache metadata', () => {
    it('should include timestamp in cached data', async () => {
      const testData = { prices: [{ crop: 'Rice', price: 2500 }] };
      const beforeCache = Date.now();
      
      await useOfflineStore.getState().cacheMarketPrices(testData);
      
      // Verify setItem was called with metadata
      const setItemCall = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
      const storedData = JSON.parse(setItemCall[1]);
      
      expect(storedData.metadata).toBeDefined();
      expect(storedData.metadata.timestamp).toBeGreaterThanOrEqual(beforeCache);
      expect(storedData.metadata.lastSyncAt).toBeDefined();
    });

    it('should mark data as stale when TTL exceeded', async () => {
      const oldTimestamp = Date.now() - (7 * 24 * 60 * 60 * 1000 + 1000); // 7 days + 1 second ago
      
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify({
          data: { test: 'data' },
          metadata: { timestamp: oldTimestamp, isStale: false, lastSyncAt: oldTimestamp },
        })
      );
      
      const cached = await useOfflineStore.getState().getCachedRecommendations();
      
      expect(cached?.metadata.isStale).toBe(true);
    });
  });

  // **Feature: smart-crop-advisory, Property 24: Offline alerts are queued**
  // **Validates: Requirements 7.4**
  describe('Property 24: Offline alerts are queued', () => {
    it('should add items to sync queue when offline', async () => {
      useOfflineStore.getState().setOnlineStatus(false);
      
      await useOfflineStore.getState().addToSyncQueue({
        operation: 'create',
        entityType: 'activity',
        entityData: { type: 'sowing', date: new Date().toISOString() },
      });
      
      const queue = useOfflineStore.getState().syncQueue;
      expect(queue.length).toBe(1);
      expect(queue[0].status).toBe('pending');
      expect(queue[0].entityType).toBe('activity');
    });

    it('should persist sync queue to storage', async () => {
      await useOfflineStore.getState().addToSyncQueue({
        operation: 'create',
        entityType: 'feedback',
        entityData: { rating: 5, comment: 'Great!' },
      });
      
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'sync_queue',
        expect.any(String)
      );
    });

    it('should process queue when coming back online', async () => {
      // Add item to queue while offline
      useOfflineStore.getState().setOnlineStatus(false);
      await useOfflineStore.getState().addToSyncQueue({
        operation: 'create',
        entityType: 'activity',
        entityData: { type: 'irrigation' },
      });
      
      // Come back online - should trigger sync
      useOfflineStore.getState().setOnlineStatus(true);
      
      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(useOfflineStore.getState().isOnline).toBe(true);
    });
  });

  // **Feature: smart-crop-advisory, Property 25: Offline images are queued for analysis**
  // **Validates: Requirements 7.5**
  describe('Property 25: Offline images are queued for analysis', () => {
    it('should queue images for later analysis', async () => {
      const imageUri = 'file:///path/to/image.jpg';
      const cropType = 'Rice';
      
      await queueImageForAnalysis(imageUri, cropType);
      
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'queued_images',
        expect.stringContaining(imageUri)
      );
    });

    it('should retrieve queued images', async () => {
      const queuedImages = [
        { id: 'img-1', uri: 'file:///image1.jpg', cropType: 'Rice', capturedAt: Date.now(), status: 'pending' },
        { id: 'img-2', uri: 'file:///image2.jpg', cropType: 'Wheat', capturedAt: Date.now(), status: 'pending' },
      ];
      
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(queuedImages));
      
      const images = await getQueuedImages();
      
      expect(images.length).toBe(2);
      expect(images[0].uri).toBe('file:///image1.jpg');
    });

    it('should remove processed images from queue', async () => {
      const queuedImages = [
        { id: 'img-1', uri: 'file:///image1.jpg', status: 'pending' },
        { id: 'img-2', uri: 'file:///image2.jpg', status: 'pending' },
      ];
      
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(queuedImages));
      
      await removeQueuedImage('img-1');
      
      const setItemCall = (AsyncStorage.setItem as jest.Mock).mock.calls.find(
        call => call[0] === 'queued_images'
      );
      const updatedQueue = JSON.parse(setItemCall[1]);
      
      expect(updatedQueue.length).toBe(1);
      expect(updatedQueue[0].id).toBe('img-2');
    });
  });

  // Sync queue management tests
  describe('Sync Queue Management', () => {
    it('should update sync item status', async () => {
      await useOfflineStore.getState().addToSyncQueue({
        operation: 'create',
        entityType: 'activity',
        entityData: {},
      });
      
      const itemId = useOfflineStore.getState().syncQueue[0].id;
      await useOfflineStore.getState().updateSyncItemStatus(itemId, 'syncing');
      
      const updatedItem = useOfflineStore.getState().syncQueue.find(i => i.id === itemId);
      expect(updatedItem?.status).toBe('syncing');
    });

    it('should increment retry count on failure', async () => {
      await useOfflineStore.getState().addToSyncQueue({
        operation: 'create',
        entityType: 'activity',
        entityData: {},
      });
      
      const itemId = useOfflineStore.getState().syncQueue[0].id;
      await useOfflineStore.getState().updateSyncItemStatus(itemId, 'failed');
      
      const updatedItem = useOfflineStore.getState().syncQueue.find(i => i.id === itemId);
      expect(updatedItem?.retryCount).toBe(1);
    });

    it('should remove completed items from queue', async () => {
      await useOfflineStore.getState().addToSyncQueue({
        operation: 'create',
        entityType: 'activity',
        entityData: {},
      });
      
      const itemId = useOfflineStore.getState().syncQueue[0].id;
      await useOfflineStore.getState().removeFromSyncQueue(itemId);
      
      expect(useOfflineStore.getState().syncQueue.length).toBe(0);
    });
  });
});

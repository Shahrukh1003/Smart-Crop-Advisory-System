import { api } from './api';
import { useOfflineStore, SyncQueueItem } from '../store/offlineStore';

// Sync configuration
const SYNC_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  batchSize: 10,
  syncIntervalMs: 60000, // 1 minute
};

// API endpoints for different entity types
const ENTITY_ENDPOINTS: Record<SyncQueueItem['entityType'], string> = {
  activity: '/activities',
  crop_history: '/crop-history',
  pest_detection: '/pest-detection/analyze',
  feedback: '/feedback',
};

// Sync result interface
export interface SyncResult {
  success: boolean;
  itemId: string;
  error?: string;
  serverResponse?: unknown;
}

// Calculate exponential backoff delay
export const calculateBackoffDelay = (retryCount: number): number => {
  const delay = SYNC_CONFIG.baseDelayMs * Math.pow(2, retryCount);
  return Math.min(delay, SYNC_CONFIG.maxDelayMs);
};

// Process a single sync item
export const processSyncItem = async (item: SyncQueueItem): Promise<SyncResult> => {
  const endpoint = ENTITY_ENDPOINTS[item.entityType];
  
  try {
    let response;
    
    switch (item.operation) {
      case 'create':
        response = await api.post(endpoint, item.entityData);
        break;
      case 'update':
        response = await api.put(`${endpoint}/${item.entityData.id}`, item.entityData);
        break;
      case 'delete':
        response = await api.delete(`${endpoint}/${item.entityData.id}`);
        break;
    }
    
    return {
      success: true,
      itemId: item.id,
      serverResponse: response?.data,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      itemId: item.id,
      error: errorMessage,
    };
  }
};


// Process sync queue with retry logic
export const processSyncQueue = async (): Promise<SyncResult[]> => {
  const store = useOfflineStore.getState();
  const { syncQueue, isOnline, isSyncing } = store;
  
  if (!isOnline || isSyncing || syncQueue.length === 0) {
    return [];
  }
  
  useOfflineStore.setState({ isSyncing: true });
  const results: SyncResult[] = [];
  
  // Get pending items that haven't exceeded max retries
  const pendingItems = syncQueue
    .filter(item => item.status === 'pending' && item.retryCount < SYNC_CONFIG.maxRetries)
    .slice(0, SYNC_CONFIG.batchSize);
  
  for (const item of pendingItems) {
    // Update status to syncing
    await store.updateSyncItemStatus(item.id, 'syncing');
    
    // Apply backoff delay if this is a retry
    if (item.retryCount > 0) {
      const delay = calculateBackoffDelay(item.retryCount);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    const result = await processSyncItem(item);
    results.push(result);
    
    if (result.success) {
      // Mark as completed and remove from queue
      await store.updateSyncItemStatus(item.id, 'completed');
      await store.removeFromSyncQueue(item.id);
    } else {
      // Mark as failed (retry count is incremented in updateSyncItemStatus)
      await store.updateSyncItemStatus(item.id, 'failed');
      
      // If max retries exceeded, keep in queue but mark as permanently failed
      const updatedItem = useOfflineStore.getState().syncQueue.find(i => i.id === item.id);
      if (updatedItem && updatedItem.retryCount >= SYNC_CONFIG.maxRetries) {
        console.warn(`Sync item ${item.id} exceeded max retries, marking as permanently failed`);
      }
    }
  }
  
  useOfflineStore.setState({ 
    isSyncing: false, 
    lastSyncAt: Date.now() 
  });
  
  return results;
};

// Resolve conflicts using last-write-wins strategy
export const resolveConflict = <T extends { updatedAt?: number | string }>(
  localData: T,
  serverData: T
): T => {
  const localTimestamp = typeof localData.updatedAt === 'string' 
    ? new Date(localData.updatedAt).getTime() 
    : localData.updatedAt || 0;
  const serverTimestamp = typeof serverData.updatedAt === 'string'
    ? new Date(serverData.updatedAt).getTime()
    : serverData.updatedAt || 0;
  
  // Last-write-wins: return the data with the more recent timestamp
  return localTimestamp > serverTimestamp ? localData : serverData;
};

// Background sync interval reference
let syncIntervalId: ReturnType<typeof setInterval> | null = null;

// Start background sync service
export const startBackgroundSync = (): void => {
  if (syncIntervalId) {
    return; // Already running
  }
  
  syncIntervalId = setInterval(async () => {
    const { isOnline, syncQueue } = useOfflineStore.getState();
    
    if (isOnline && syncQueue.length > 0) {
      await processSyncQueue();
    }
  }, SYNC_CONFIG.syncIntervalMs);
  
  console.log('Background sync service started');
};

// Stop background sync service
export const stopBackgroundSync = (): void => {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
    console.log('Background sync service stopped');
  }
};

// Get sync status summary
export const getSyncStatus = (): {
  pendingCount: number;
  failedCount: number;
  lastSyncAt: number | null;
  isSyncing: boolean;
} => {
  const { syncQueue, lastSyncAt, isSyncing } = useOfflineStore.getState();
  
  return {
    pendingCount: syncQueue.filter(i => i.status === 'pending').length,
    failedCount: syncQueue.filter(i => i.status === 'failed' && i.retryCount >= SYNC_CONFIG.maxRetries).length,
    lastSyncAt,
    isSyncing,
  };
};

// Force immediate sync
export const forceSync = async (): Promise<SyncResult[]> => {
  const { isOnline } = useOfflineStore.getState();
  
  if (!isOnline) {
    throw new Error('Cannot sync while offline');
  }
  
  return processSyncQueue();
};

// Clear failed items from queue
export const clearFailedItems = async (): Promise<void> => {
  const { syncQueue } = useOfflineStore.getState();
  const failedItems = syncQueue.filter(
    i => i.status === 'failed' && i.retryCount >= SYNC_CONFIG.maxRetries
  );
  
  for (const item of failedItems) {
    await useOfflineStore.getState().removeFromSyncQueue(item.id);
  }
};

// Retry failed items
export const retryFailedItems = async (): Promise<void> => {
  const { syncQueue } = useOfflineStore.getState();
  const failedItems = syncQueue.filter(
    i => i.status === 'failed' && i.retryCount >= SYNC_CONFIG.maxRetries
  );
  
  // Reset retry count and status for failed items
  for (const item of failedItems) {
    const updatedQueue = useOfflineStore.getState().syncQueue.map(i =>
      i.id === item.id ? { ...i, status: 'pending' as const, retryCount: 0 } : i
    );
    useOfflineStore.setState({ syncQueue: updatedQueue });
  }
  
  // Trigger sync
  await processSyncQueue();
};

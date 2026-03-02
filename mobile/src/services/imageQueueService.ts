import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import { useOfflineStore } from '../store/offlineStore';

// Image queue storage key
const IMAGE_QUEUE_KEY = 'queued_images';

// Image queue directory
const IMAGE_QUEUE_DIR = `${FileSystem.documentDirectory}image_queue/`;

// Queued image interface
export interface QueuedImage {
  id: string;
  localUri: string;
  originalUri: string;
  cropType?: string;
  parcelId?: string;
  capturedAt: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  retryCount: number;
  error?: string;
  metadata?: {
    width?: number;
    height?: number;
    fileSize?: number;
  };
}

// Ensure image queue directory exists
export const ensureImageQueueDir = async (): Promise<void> => {
  const dirInfo = await FileSystem.getInfoAsync(IMAGE_QUEUE_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(IMAGE_QUEUE_DIR, { intermediates: true });
  }
};

// Copy image to queue directory for persistence
export const copyImageToQueue = async (sourceUri: string): Promise<string> => {
  await ensureImageQueueDir();
  
  const filename = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
  const destUri = `${IMAGE_QUEUE_DIR}${filename}`;
  
  await FileSystem.copyAsync({
    from: sourceUri,
    to: destUri,
  });
  
  return destUri;
};


// Queue an image for offline analysis
export const queueImageForAnalysis = async (
  imageUri: string,
  cropType?: string,
  parcelId?: string
): Promise<QueuedImage> => {
  // Copy image to persistent storage
  const localUri = await copyImageToQueue(imageUri);
  
  // Get file info for metadata
  const fileInfo = await FileSystem.getInfoAsync(localUri);
  
  const queuedImage: QueuedImage = {
    id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    localUri,
    originalUri: imageUri,
    cropType,
    parcelId,
    capturedAt: Date.now(),
    status: 'pending',
    retryCount: 0,
    metadata: {
      fileSize: fileInfo.exists ? (fileInfo as { size?: number }).size : undefined,
    },
  };
  
  // Get existing queue
  const stored = await AsyncStorage.getItem(IMAGE_QUEUE_KEY);
  const queue: QueuedImage[] = stored ? JSON.parse(stored) : [];
  
  // Add new image to queue
  queue.push(queuedImage);
  await AsyncStorage.setItem(IMAGE_QUEUE_KEY, JSON.stringify(queue));
  
  return queuedImage;
};

// Get all queued images
export const getQueuedImages = async (): Promise<QueuedImage[]> => {
  const stored = await AsyncStorage.getItem(IMAGE_QUEUE_KEY);
  return stored ? JSON.parse(stored) : [];
};

// Update queued image status
export const updateQueuedImageStatus = async (
  id: string,
  status: QueuedImage['status'],
  error?: string
): Promise<void> => {
  const stored = await AsyncStorage.getItem(IMAGE_QUEUE_KEY);
  const queue: QueuedImage[] = stored ? JSON.parse(stored) : [];
  
  const updatedQueue = queue.map(img => {
    if (img.id === id) {
      return {
        ...img,
        status,
        error,
        retryCount: status === 'failed' ? img.retryCount + 1 : img.retryCount,
      };
    }
    return img;
  });
  
  await AsyncStorage.setItem(IMAGE_QUEUE_KEY, JSON.stringify(updatedQueue));
};

// Remove queued image
export const removeQueuedImage = async (id: string): Promise<void> => {
  const stored = await AsyncStorage.getItem(IMAGE_QUEUE_KEY);
  const queue: QueuedImage[] = stored ? JSON.parse(stored) : [];
  
  // Find the image to remove
  const imageToRemove = queue.find(img => img.id === id);
  
  // Delete the local file
  if (imageToRemove) {
    try {
      await FileSystem.deleteAsync(imageToRemove.localUri, { idempotent: true });
    } catch (error) {
      console.warn(`Failed to delete local image file: ${error}`);
    }
  }
  
  // Remove from queue
  const filteredQueue = queue.filter(img => img.id !== id);
  await AsyncStorage.setItem(IMAGE_QUEUE_KEY, JSON.stringify(filteredQueue));
};

// Process a single queued image
export const processQueuedImage = async (image: QueuedImage): Promise<boolean> => {
  try {
    await updateQueuedImageStatus(image.id, 'uploading');
    
    // Read the image file
    const fileInfo = await FileSystem.getInfoAsync(image.localUri);
    if (!fileInfo.exists) {
      throw new Error('Image file not found');
    }
    
    // Create form data for upload
    const formData = new FormData();
    formData.append('image', {
      uri: image.localUri,
      type: 'image/jpeg',
      name: `pest_image_${image.id}.jpg`,
    } as unknown as Blob);
    
    if (image.cropType) {
      formData.append('crop_type', image.cropType);
    }
    
    // Upload to pest detection API
    const response = await api.post('/pest-detection/analyze', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    // Mark as completed and remove from queue
    await updateQueuedImageStatus(image.id, 'completed');
    await removeQueuedImage(image.id);
    
    return true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await updateQueuedImageStatus(image.id, 'failed', errorMessage);
    return false;
  }
};

// Process all pending images in queue
export const processImageQueue = async (): Promise<{
  processed: number;
  failed: number;
}> => {
  const { isOnline } = useOfflineStore.getState();
  
  if (!isOnline) {
    return { processed: 0, failed: 0 };
  }
  
  const queue = await getQueuedImages();
  const pendingImages = queue.filter(
    img => img.status === 'pending' && img.retryCount < 3
  );
  
  let processed = 0;
  let failed = 0;
  
  for (const image of pendingImages) {
    const success = await processQueuedImage(image);
    if (success) {
      processed++;
    } else {
      failed++;
    }
  }
  
  return { processed, failed };
};

// Get queue statistics
export const getImageQueueStats = async (): Promise<{
  total: number;
  pending: number;
  uploading: number;
  failed: number;
  totalSize: number;
}> => {
  const queue = await getQueuedImages();
  
  return {
    total: queue.length,
    pending: queue.filter(img => img.status === 'pending').length,
    uploading: queue.filter(img => img.status === 'uploading').length,
    failed: queue.filter(img => img.status === 'failed').length,
    totalSize: queue.reduce((sum, img) => sum + (img.metadata?.fileSize || 0), 0),
  };
};

// Clear all failed images from queue
export const clearFailedImages = async (): Promise<void> => {
  const queue = await getQueuedImages();
  const failedImages = queue.filter(img => img.status === 'failed');
  
  for (const image of failedImages) {
    await removeQueuedImage(image.id);
  }
};

// Clear entire image queue
export const clearImageQueue = async (): Promise<void> => {
  const queue = await getQueuedImages();
  
  // Delete all local files
  for (const image of queue) {
    try {
      await FileSystem.deleteAsync(image.localUri, { idempotent: true });
    } catch (error) {
      console.warn(`Failed to delete local image file: ${error}`);
    }
  }
  
  // Clear the queue
  await AsyncStorage.setItem(IMAGE_QUEUE_KEY, JSON.stringify([]));
};

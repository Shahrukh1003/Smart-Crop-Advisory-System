/**
 * Platform-aware secure storage wrapper.
 * Uses expo-secure-store on native (iOS/Android) and localStorage on web.
 */
import { Platform } from 'react-native';

interface SecureStorageAdapter {
    getItemAsync(key: string): Promise<string | null>;
    setItemAsync(key: string, value: string): Promise<void>;
    deleteItemAsync(key: string): Promise<void>;
}

// Web fallback using localStorage
const webStorage: SecureStorageAdapter = {
    async getItemAsync(key: string): Promise<string | null> {
        try {
            return localStorage.getItem(key);
        } catch {
            return null;
        }
    },
    async setItemAsync(key: string, value: string): Promise<void> {
        try {
            localStorage.setItem(key, value);
        } catch {
            console.warn('Failed to save to localStorage:', key);
        }
    },
    async deleteItemAsync(key: string): Promise<void> {
        try {
            localStorage.removeItem(key);
        } catch {
            console.warn('Failed to remove from localStorage:', key);
        }
    },
};

// Lazy-load expo-secure-store only on native platforms
let nativeStorage: SecureStorageAdapter | null = null;

function getNativeStorage(): SecureStorageAdapter {
    if (!nativeStorage) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const SecureStore = require('expo-secure-store');
        nativeStorage = {
            getItemAsync: (key: string) => SecureStore.getItemAsync(key),
            setItemAsync: (key: string, value: string) => SecureStore.setItemAsync(key, value),
            deleteItemAsync: (key: string) => SecureStore.deleteItemAsync(key),
        };
    }
    return nativeStorage;
}

/**
 * Cross-platform secure storage.
 * - Native (iOS/Android): uses expo-secure-store (encrypted keychain/keystore)
 * - Web: uses localStorage (not encrypted, but functional)
 */
const storage: SecureStorageAdapter = Platform.OS === 'web' ? webStorage : getNativeStorage();

export default storage;

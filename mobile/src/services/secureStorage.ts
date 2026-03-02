import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Storage keys
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'auth_access_token',
  REFRESH_TOKEN: 'auth_refresh_token',
  USER_DATA: 'auth_user_data',
  TOKEN_EXPIRY: 'auth_token_expiry',
  BIOMETRIC_ENABLED: 'auth_biometric_enabled',
};

// Token expiry times
const ACCESS_TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
const REFRESH_TOKEN_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 days

interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

// Secure storage options
const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/**
 * Save tokens securely using device keychain/keystore
 */
export const saveTokens = async (
  accessToken: string,
  refreshToken: string
): Promise<void> => {
  const expiresAt = Date.now() + ACCESS_TOKEN_EXPIRY;

  await Promise.all([
    SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, accessToken, secureStoreOptions),
    SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, refreshToken, secureStoreOptions),
    SecureStore.setItemAsync(STORAGE_KEYS.TOKEN_EXPIRY, expiresAt.toString(), secureStoreOptions),
  ]);
};

/**
 * Get stored tokens
 */
export const getTokens = async (): Promise<TokenData | null> => {
  try {
    const [accessToken, refreshToken, expiryStr] = await Promise.all([
      SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN),
      SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN),
      SecureStore.getItemAsync(STORAGE_KEYS.TOKEN_EXPIRY),
    ]);

    if (!accessToken || !refreshToken) {
      return null;
    }

    return {
      accessToken,
      refreshToken,
      expiresAt: expiryStr ? parseInt(expiryStr, 10) : 0,
    };
  } catch (error) {
    console.error('Failed to get tokens:', error);
    return null;
  }
};

/**
 * Check if access token is expired
 */
export const isTokenExpired = async (): Promise<boolean> => {
  const expiryStr = await SecureStore.getItemAsync(STORAGE_KEYS.TOKEN_EXPIRY);
  if (!expiryStr) return true;

  const expiresAt = parseInt(expiryStr, 10);
  // Consider token expired 5 minutes before actual expiry
  return Date.now() > expiresAt - 5 * 60 * 1000;
};

/**
 * Check if refresh token is still valid
 */
export const isRefreshTokenValid = async (): Promise<boolean> => {
  const refreshToken = await SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
  if (!refreshToken) return false;

  // In a real app, you might want to decode the JWT and check its expiry
  // For now, we assume refresh token is valid if it exists
  return true;
};

/**
 * Clear all stored tokens
 */
export const clearTokens = async (): Promise<void> => {
  await Promise.all([
    SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN),
    SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN),
    SecureStore.deleteItemAsync(STORAGE_KEYS.TOKEN_EXPIRY),
    SecureStore.deleteItemAsync(STORAGE_KEYS.USER_DATA),
  ]);
};

/**
 * Save user data securely
 */
export const saveUserData = async (userData: any): Promise<void> => {
  await SecureStore.setItemAsync(
    STORAGE_KEYS.USER_DATA,
    JSON.stringify(userData),
    secureStoreOptions
  );
};

/**
 * Get stored user data
 */
export const getUserData = async (): Promise<any | null> => {
  try {
    const data = await SecureStore.getItemAsync(STORAGE_KEYS.USER_DATA);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Failed to get user data:', error);
    return null;
  }
};

/**
 * Refresh access token using refresh token
 */
export const refreshAccessToken = async (
  refreshEndpoint: string
): Promise<string | null> => {
  const tokens = await getTokens();
  if (!tokens?.refreshToken) {
    return null;
  }

  try {
    const response = await fetch(refreshEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });

    if (!response.ok) {
      // Refresh failed, clear tokens
      await clearTokens();
      return null;
    }

    const data = await response.json();
    await saveTokens(data.tokens.accessToken, data.tokens.refreshToken);
    return data.tokens.accessToken;
  } catch (error) {
    console.error('Token refresh failed:', error);
    await clearTokens();
    return null;
  }
};

/**
 * Check if secure storage is available on this device
 */
export const isSecureStorageAvailable = async (): Promise<boolean> => {
  try {
    await SecureStore.setItemAsync('__test__', 'test', secureStoreOptions);
    await SecureStore.deleteItemAsync('__test__');
    return true;
  } catch {
    return false;
  }
};

/**
 * Get authentication header for API requests
 */
export const getAuthHeader = async (): Promise<{ Authorization: string } | {}> => {
  const tokens = await getTokens();
  if (!tokens?.accessToken) {
    return {};
  }
  return { Authorization: `Bearer ${tokens.accessToken}` };
};

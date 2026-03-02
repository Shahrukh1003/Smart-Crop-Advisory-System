import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import * as SecureStore from 'expo-secure-store';
import NetInfo from '@react-native-community/netinfo';

declare const process: { env?: { EXPO_PUBLIC_API_URL?: string } } | undefined;
const API_URL =
  (typeof process !== 'undefined' && process?.env?.EXPO_PUBLIC_API_URL) ||
  'http://localhost:3000/api/v1';

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_DELAY = 1000; // 1 second
const MAX_DELAY = 10000; // 10 seconds

// Create axios instance
export const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Exponential backoff delay calculation
const getRetryDelay = (retryCount: number): number => {
  const delay = INITIAL_DELAY * Math.pow(2, retryCount);
  return Math.min(delay, MAX_DELAY);
};

// Check if error is retryable
const isRetryableError = (error: AxiosError): boolean => {
  // Network errors
  if (!error.response) return true;
  
  // Server errors (5xx)
  if (error.response.status >= 500) return true;
  
  // Rate limiting (429)
  if (error.response.status === 429) return true;
  
  // Request timeout
  if (error.code === 'ECONNABORTED') return true;
  
  return false;
};

// Sleep utility
const sleep = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

// Request with retry logic
export const requestWithRetry = async <T>(
  config: AxiosRequestConfig,
  retries: number = MAX_RETRIES
): Promise<AxiosResponse<T>> => {
  let lastError: AxiosError | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await api.request<T>(config);
      return response;
    } catch (error) {
      lastError = error as AxiosError;
      
      if (attempt < retries && isRetryableError(lastError)) {
        const delay = getRetryDelay(attempt);
        console.log(`Request failed, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
        await sleep(delay);
      } else {
        break;
      }
    }
  }
  
  throw lastError;
};

// Check network connectivity
export const checkConnectivity = async (): Promise<boolean> => {
  const state = await NetInfo.fetch();
  return state.isConnected ?? false;
};

// Request interceptor - add auth token
api.interceptors.request.use(
  async (config) => {
    const token = await SecureStore.getItemAsync('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await SecureStore.getItemAsync('refresh_token');
        if (refreshToken) {
          const response = await axios.post(`${API_URL}/auth/refresh`, {
            refreshToken,
          });

          const { tokens } = response.data;
          await SecureStore.setItemAsync('auth_token', tokens.accessToken);
          await SecureStore.setItemAsync('refresh_token', tokens.refreshToken);

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
          }
          return api(originalRequest);
        }
      } catch {
        // Refresh failed, clear tokens
        await SecureStore.deleteItemAsync('auth_token');
        await SecureStore.deleteItemAsync('refresh_token');
        await SecureStore.deleteItemAsync('user_data');
      }
    }

    return Promise.reject(error);
  }
);

// Convenience methods with retry
export const apiWithRetry = {
  get: <T>(url: string, config?: AxiosRequestConfig) =>
    requestWithRetry<T>({ ...config, method: 'GET', url }),
  
  post: <T>(url: string, data?: any, config?: AxiosRequestConfig) =>
    requestWithRetry<T>({ ...config, method: 'POST', url, data }),
  
  put: <T>(url: string, data?: any, config?: AxiosRequestConfig) =>
    requestWithRetry<T>({ ...config, method: 'PUT', url, data }),
  
  delete: <T>(url: string, config?: AxiosRequestConfig) =>
    requestWithRetry<T>({ ...config, method: 'DELETE', url }),
};

export default api;

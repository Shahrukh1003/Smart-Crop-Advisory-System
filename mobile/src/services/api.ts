import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import storage from '../utils/storage';
import Constants from 'expo-constants';

// Use environment variable or fallback to localhost
// IMPORTANT: Update EXPO_PUBLIC_API_URL in mobile/.env with your machine's IP
// Find your IP: run 'ipconfig' on Windows, 'ifconfig' on Mac/Linux
const API_URL =
  Constants.expoConfig?.extra?.apiUrl ||
  process.env.EXPO_PUBLIC_API_URL ||
  'http://localhost:3000/api/v1';

console.log('API URL:', API_URL);
console.log('EXPO_PUBLIC_API_URL:', process.env.EXPO_PUBLIC_API_URL);

export const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> => {
    const token = await storage.getItemAsync('auth_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError): Promise<never> => Promise.reject(error)
);

// Response interceptor for token refresh
api.interceptors.response.use(
  (response: AxiosResponse): AxiosResponse => response,
  async (error: AxiosError): Promise<AxiosResponse | never> => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await storage.getItemAsync('refresh_token');
        if (refreshToken) {
          const response = await axios.post(`${API_URL}/auth/refresh`, {
            refreshToken,
          });

          const { tokens } = response.data;
          await storage.setItemAsync('auth_token', tokens.accessToken);
          await storage.setItemAsync('refresh_token', tokens.refreshToken);

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
          }
          return api(originalRequest);
        }
      } catch {
        // Refresh failed, logout user
        await storage.deleteItemAsync('auth_token');
        await storage.deleteItemAsync('refresh_token');
        await storage.deleteItemAsync('user_data');
      }
    }

    return Promise.reject(error);
  }
);

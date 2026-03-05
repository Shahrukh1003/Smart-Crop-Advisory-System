import { create } from 'zustand';
import storage from '../utils/storage';
import { api } from '../services/api';
import { errorService } from '../services/errorService';
import { sessionService, SessionStatus } from '../services/sessionService';

export type Language = 'kn' | 'hi' | 'ta' | 'te' | 'en';

export interface User {
  id: string;
  phoneNumber: string;
  name: string;
  language: Language;
  role: string;
  location?: {
    latitude: number;
    longitude: number;
    district: string;
    state: string;
  };
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  sessionStatus: SessionStatus | null;

  // Actions
  login: (phoneNumber: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  loadStoredAuth: () => Promise<void>;
  clearError: () => void;
  updateSessionActivity: () => Promise<void>;
  checkSessionStatus: () => SessionStatus | null;
}

interface RegisterData {
  phoneNumber: string;
  name: string;
  password: string;
  language: Language;
  latitude?: number;
  longitude?: number;
  district?: string;
  state?: string;
}

const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_KEY = 'user_data';

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  sessionStatus: null,

  login: async (phoneNumber: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      console.log('Attempting login for:', phoneNumber);
      const response = await api.post('/auth/login', { phoneNumber, password });
      console.log('Login response:', response.status);
      const { user, tokens } = response.data;

      // Store tokens securely
      await storage.setItemAsync(TOKEN_KEY, tokens.accessToken);
      await storage.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken);
      await storage.setItemAsync(USER_KEY, JSON.stringify(user));

      // Initialize session
      await sessionService.initSession(user.id);
      const sessionStatus = sessionService.getSessionStatus();

      // Update API headers
      api.defaults.headers.common['Authorization'] = `Bearer ${tokens.accessToken}`;

      // Set error service language
      if (user.language) {
        errorService.setLanguage(user.language);
      }

      set({ user, isAuthenticated: true, isLoading: false, sessionStatus });
    } catch (error: any) {
      console.error('Login error:', error.message);
      console.error('Error details:', error.response?.data || error.code || 'Network error');
      const message = error.response?.data?.message ||
        error.code === 'ECONNABORTED' ? 'Connection timeout - check your network' :
        error.message?.includes('Network') ? 'Network error - ensure your phone is on the same WiFi as the server' :
          'Login failed - ' + (error.message || 'Unknown error');
      set({ error: message, isLoading: false });
      throw new Error(message);
    }
  },

  register: async (data: RegisterData) => {
    set({ isLoading: true, error: null });
    try {
      console.log('Attempting registration for:', data.phoneNumber);
      const response = await api.post('/auth/register', data);
      console.log('Registration response:', response.status);
      const { user, tokens } = response.data;

      // Store tokens securely
      await storage.setItemAsync(TOKEN_KEY, tokens.accessToken);
      await storage.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken);
      await storage.setItemAsync(USER_KEY, JSON.stringify(user));

      // Initialize session
      await sessionService.initSession(user.id);
      const sessionStatus = sessionService.getSessionStatus();

      // Update API headers
      api.defaults.headers.common['Authorization'] = `Bearer ${tokens.accessToken}`;

      // Set error service language
      if (user.language) {
        errorService.setLanguage(user.language);
      }

      set({ user, isAuthenticated: true, isLoading: false, sessionStatus });
    } catch (error: any) {
      console.error('Registration error:', error.message);
      console.error('Error details:', error.response?.data || error.code || 'Network error');
      const message = error.response?.data?.message ||
        error.code === 'ECONNABORTED' ? 'Connection timeout - check your network' :
        error.message?.includes('Network') ? 'Network error - ensure your phone is on the same WiFi as the server' :
          'Registration failed - ' + (error.message || 'Unknown error');
      set({ error: message, isLoading: false });
      throw new Error(message);
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore logout errors
    }

    // Clear session
    await sessionService.clearSession();

    // Clear stored data
    await storage.deleteItemAsync(TOKEN_KEY);
    await storage.deleteItemAsync(REFRESH_TOKEN_KEY);
    await storage.deleteItemAsync(USER_KEY);

    // Clear API headers
    delete api.defaults.headers.common['Authorization'];

    set({ user: null, isAuthenticated: false, sessionStatus: null });
  },

  loadStoredAuth: async () => {
    set({ isLoading: true });
    try {
      const token = await storage.getItemAsync(TOKEN_KEY);
      const userData = await storage.getItemAsync(USER_KEY);

      if (token && userData) {
        const user = JSON.parse(userData);

        // Restore and check session
        const sessionStatus = await sessionService.restoreSession();

        if (sessionStatus.isExpired) {
          // Session expired, clear auth and require re-login
          await storage.deleteItemAsync(TOKEN_KEY);
          await storage.deleteItemAsync(REFRESH_TOKEN_KEY);
          await storage.deleteItemAsync(USER_KEY);
          await sessionService.clearSession();
          set({ isLoading: false, sessionStatus });
          return;
        }

        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        // Set error service language based on user preference
        if (user.language) {
          errorService.setLanguage(user.language);
        }

        set({ user, isAuthenticated: true, isLoading: false, sessionStatus });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      console.log('Error loading stored auth:', error);
      set({ isLoading: false });
    }
  },

  clearError: () => set({ error: null }),

  updateSessionActivity: async () => {
    await sessionService.updateActivity();
    const sessionStatus = sessionService.getSessionStatus();
    set({ sessionStatus });
  },

  checkSessionStatus: () => {
    const sessionStatus = sessionService.getSessionStatus();
    set({ sessionStatus });
    return sessionStatus;
  },
}));

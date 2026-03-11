import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';
import { getAuthHeader, refreshAccessToken, clearTokens } from './secureStorage';

// API Configuration
declare const process: { env?: { EXPO_PUBLIC_API_URL?: string } } | undefined;
const API_URL =
  (typeof process !== 'undefined' && process?.env?.EXPO_PUBLIC_API_URL) ||
  'https://api.smartcropadvisory.in/v1';
const REFRESH_ENDPOINT = `${API_URL}/auth/refresh`;

// Certificate pinning configuration
// In production, these would be the SHA-256 hashes of your server's SSL certificate
const CERTIFICATE_PINS = {
  production: [
    'sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=', // Primary certificate
    'sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=', // Backup certificate
  ],
  staging: [
    'sha256/CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC=',
  ],
};

// TLS configuration
const TLS_CONFIG = {
  minVersion: 'TLSv1.3',
  ciphers: [
    'TLS_AES_256_GCM_SHA384',
    'TLS_CHACHA20_POLY1305_SHA256',
    'TLS_AES_128_GCM_SHA256',
  ],
};

/**
 * Create a secure axios instance with certificate pinning
 * Note: Full certificate pinning requires native module integration
 * This provides the configuration structure for implementation
 */
export const createSecureApi = (): AxiosInstance => {
  const instance = axios.create({
    baseURL: API_URL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Platform': Platform.OS,
      'X-App-Version': '1.0.0',
      'ngrok-skip-browser-warning': 'true',
      'Bypass-Tunnel-Reminder': 'true',
    },
    // Force HTTPS
    ...(API_URL.startsWith('https') ? {} : { baseURL: API_URL.replace('http://', 'https://') }),
  });

  // Request interceptor - add auth token
  instance.interceptors.request.use(
    async (config) => {
      const authHeader = (await getAuthHeader()) as Record<string, string>;
      // Safely assign properties instead of overriding the entire strict Axios object
      if (authHeader && authHeader.Authorization) {
        config.headers.set('Authorization', authHeader.Authorization);
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor - handle token refresh
  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

      // Handle 401 Unauthorized - attempt token refresh
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        const newToken = await refreshAccessToken(REFRESH_ENDPOINT);
        if (newToken) {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }
          return instance(originalRequest);
        }

        // Refresh failed - clear tokens and reject
        await clearTokens();
      }

      return Promise.reject(error);
    }
  );

  return instance;
};

// Singleton instance
let secureApiInstance: AxiosInstance | null = null;

export const getSecureApi = (): AxiosInstance => {
  if (!secureApiInstance) {
    secureApiInstance = createSecureApi();
  }
  return secureApiInstance;
};

/**
 * Certificate pinning implementation notes:
 * 
 * For React Native, certificate pinning requires native module integration:
 * 
 * iOS (Info.plist):
 * Add NSAppTransportSecurity with NSPinnedDomains configuration
 * 
 * Android (network_security_config.xml):
 * <network-security-config>
 *   <domain-config cleartextTrafficPermitted="false">
 *     <domain includeSubdomains="true">api.smartcropadvisory.in</domain>
 *     <pin-set>
 *       <pin digest="SHA-256">base64EncodedPublicKeyHash</pin>
 *       <pin digest="SHA-256">backupPublicKeyHash</pin>
 *     </pin-set>
 *   </domain-config>
 * </network-security-config>
 * 
 * Libraries for implementation:
 * - react-native-ssl-pinning
 * - react-native-cert-pinner
 */

// Network security configuration for Android
export const ANDROID_NETWORK_SECURITY_CONFIG = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="true">api.smartcropadvisory.in</domain>
        <pin-set expiration="2025-12-31">
            <pin digest="SHA-256">YOUR_CERTIFICATE_PIN_HERE</pin>
            <pin digest="SHA-256">YOUR_BACKUP_PIN_HERE</pin>
        </pin-set>
    </domain-config>
</network-security-config>`;

// iOS App Transport Security configuration
export const IOS_ATS_CONFIG = {
  NSAppTransportSecurity: {
    NSAllowsArbitraryLoads: false,
    NSPinnedDomains: {
      'api.smartcropadvisory.in': {
        NSIncludesSubdomains: true,
        NSPinnedLeafIdentities: [
          { 'SPKI-SHA256-BASE64': 'YOUR_CERTIFICATE_PIN_HERE' },
          { 'SPKI-SHA256-BASE64': 'YOUR_BACKUP_PIN_HERE' },
        ],
      },
    },
  },
};

/**
 * Validate that the connection is secure
 */
export const validateSecureConnection = (url: string): boolean => {
  // Ensure HTTPS
  if (!url.startsWith('https://')) {
    console.warn('Insecure connection attempted:', url);
    return false;
  }
  return true;
};

export default getSecureApi();

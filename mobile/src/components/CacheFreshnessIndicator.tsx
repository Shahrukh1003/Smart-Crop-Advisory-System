import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOfflineStore, CACHE_TTL } from '../store/offlineStore';

// Props interface
export interface CacheFreshnessIndicatorProps {
  timestamp: number;
  ttl?: number;
  dataType?: 'weather' | 'market' | 'recommendations' | 'activities';
  showIcon?: boolean;
  compact?: boolean;
}

// Get TTL based on data type
const getTTLForDataType = (dataType?: string): number => {
  switch (dataType) {
    case 'weather':
      return CACHE_TTL.WEATHER_FORECAST;
    case 'market':
      return CACHE_TTL.MARKET_PRICES;
    case 'recommendations':
      return CACHE_TTL.RECOMMENDATIONS;
    case 'activities':
      return CACHE_TTL.ACTIVITIES;
    default:
      return CACHE_TTL.RECOMMENDATIONS;
  }
};

// Get color based on freshness
const getFreshnessColor = (isStale: boolean, ageMs: number, ttl: number): string => {
  if (isStale) {
    return '#e74c3c'; // Red for stale
  }
  
  const freshnessRatio = ageMs / ttl;
  if (freshnessRatio < 0.5) {
    return '#27ae60'; // Green for fresh
  } else if (freshnessRatio < 0.8) {
    return '#f39c12'; // Orange for aging
  } else {
    return '#e67e22'; // Dark orange for almost stale
  }
};

// Get icon based on freshness
const getFreshnessIcon = (isStale: boolean, ageMs: number, ttl: number): string => {
  if (isStale) {
    return 'warning';
  }
  
  const freshnessRatio = ageMs / ttl;
  if (freshnessRatio < 0.5) {
    return 'checkmark-circle';
  } else if (freshnessRatio < 0.8) {
    return 'time';
  } else {
    return 'alert-circle';
  }
};


/**
 * CacheFreshnessIndicator Component
 * 
 * Displays cache timestamp and staleness warning for cached data.
 * Shows visual indicators for offline mode and data freshness.
 */
export const CacheFreshnessIndicator: React.FC<CacheFreshnessIndicatorProps> = ({
  timestamp,
  ttl,
  dataType,
  showIcon = true,
  compact = false,
}) => {
  const { isOnline, getCacheFreshnessInfo } = useOfflineStore();
  
  const effectiveTtl = ttl || getTTLForDataType(dataType);
  const { isStale, ageMs, ageText } = getCacheFreshnessInfo(timestamp, effectiveTtl);
  
  const color = getFreshnessColor(isStale, ageMs, effectiveTtl);
  const iconName = getFreshnessIcon(isStale, ageMs, effectiveTtl);
  
  if (compact) {
    return (
      <View style={styles.compactContainer}>
        {showIcon && (
          <Ionicons name={iconName as any} size={12} color={color} />
        )}
        <Text style={[styles.compactText, { color }]}>
          {ageText}
        </Text>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {showIcon && (
          <Ionicons name={iconName as any} size={16} color={color} style={styles.icon} />
        )}
        <Text style={[styles.text, { color }]}>
          Last updated: {ageText}
        </Text>
      </View>
      
      {isStale && (
        <View style={styles.warningContainer}>
          <Ionicons name="warning" size={14} color="#e74c3c" />
          <Text style={styles.warningText}>
            Data may be outdated. {isOnline ? 'Refreshing...' : 'Connect to update.'}
          </Text>
        </View>
      )}
      
      {!isOnline && (
        <View style={styles.offlineContainer}>
          <Ionicons name="cloud-offline" size={14} color="#7f8c8d" />
          <Text style={styles.offlineText}>
            Offline mode - showing cached data
          </Text>
        </View>
      )}
    </View>
  );
};

/**
 * OfflineModeIndicator Component
 * 
 * Simple indicator showing when the app is in offline mode.
 */
export const OfflineModeIndicator: React.FC = () => {
  const { isOnline } = useOfflineStore();
  
  if (isOnline) {
    return null;
  }
  
  return (
    <View style={styles.offlineBanner}>
      <Ionicons name="cloud-offline" size={16} color="#fff" />
      <Text style={styles.offlineBannerText}>
        You're offline
      </Text>
    </View>
  );
};

/**
 * DataFreshnessLabel Component
 * 
 * Inline label showing data freshness for list items.
 */
export const DataFreshnessLabel: React.FC<{
  timestamp: number;
  ttl?: number;
}> = ({ timestamp, ttl = CACHE_TTL.RECOMMENDATIONS }) => {
  const { getCacheFreshnessInfo } = useOfflineStore();
  const { isStale, ageText } = getCacheFreshnessInfo(timestamp, ttl);
  
  return (
    <Text style={[
      styles.freshnessLabel,
      isStale && styles.freshnessLabelStale
    ]}>
      {isStale ? '⚠️ ' : '✓ '}{ageText}
    </Text>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginVertical: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 6,
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactText: {
    fontSize: 10,
    fontWeight: '500',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  warningText: {
    fontSize: 11,
    color: '#e74c3c',
    marginLeft: 4,
  },
  offlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  offlineText: {
    fontSize: 11,
    color: '#7f8c8d',
    marginLeft: 4,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e74c3c',
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
  },
  offlineBannerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  freshnessLabel: {
    fontSize: 10,
    color: '#27ae60',
  },
  freshnessLabelStale: {
    color: '#e74c3c',
  },
});

export default CacheFreshnessIndicator;

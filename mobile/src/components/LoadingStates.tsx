import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  ActivityIndicator,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Theme colors for consistent styling
export const THEME = {
  primary: '#2E7D32',
  primaryLight: '#4CAF50',
  primaryDark: '#1B5E20',
  background: '#F5F5F5',
  surface: '#FFFFFF',
  text: '#333333',
  textSecondary: '#666666',
  textLight: '#999999',
  border: '#E0E0E0',
  skeleton: '#E0E0E0',
  skeletonHighlight: '#F5F5F5',
  error: '#F44336',
  warning: '#FF9800',
  success: '#4CAF50',
  info: '#2196F3',
};

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

/**
 * Animated skeleton placeholder for loading states
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: THEME.skeleton,
          opacity,
        },
        style,
      ]}
    />
  );
};

/**
 * Card skeleton for dashboard cards
 */
export const CardSkeleton: React.FC<{ style?: any }> = ({ style }) => (
  <View style={[styles.cardSkeleton, style]}>
    <View style={styles.cardSkeletonHeader}>
      <Skeleton width={48} height={48} borderRadius={24} />
      <View style={styles.cardSkeletonHeaderText}>
        <Skeleton width={120} height={16} style={{ marginBottom: 8 }} />
        <Skeleton width={80} height={12} />
      </View>
    </View>
    <Skeleton width="100%" height={12} style={{ marginTop: 16 }} />
    <Skeleton width="70%" height={12} style={{ marginTop: 8 }} />
  </View>
);

/**
 * List item skeleton
 */
export const ListItemSkeleton: React.FC<{ style?: any }> = ({ style }) => (
  <View style={[styles.listItemSkeleton, style]}>
    <Skeleton width={40} height={40} borderRadius={8} />
    <View style={styles.listItemSkeletonContent}>
      <Skeleton width="60%" height={14} style={{ marginBottom: 6 }} />
      <Skeleton width="40%" height={12} />
    </View>
    <Skeleton width={24} height={24} borderRadius={12} />
  </View>
);

/**
 * Weather card skeleton
 */
export const WeatherCardSkeleton: React.FC = () => (
  <View style={styles.weatherCardSkeleton}>
    <View style={styles.weatherCardSkeletonMain}>
      <Skeleton width={64} height={64} borderRadius={32} />
      <View style={styles.weatherCardSkeletonTemp}>
        <Skeleton width={80} height={32} style={{ marginBottom: 8 }} />
        <Skeleton width={100} height={14} />
      </View>
    </View>
    <View style={styles.weatherCardSkeletonDetails}>
      <Skeleton width={80} height={12} />
      <Skeleton width={80} height={12} />
      <Skeleton width={80} height={12} />
    </View>
  </View>
);

/**
 * Feature grid skeleton
 */
export const FeatureGridSkeleton: React.FC = () => (
  <View style={styles.featureGridSkeleton}>
    {[1, 2, 3, 4, 5, 6].map((i) => (
      <View key={i} style={styles.featureItemSkeleton}>
        <Skeleton width={56} height={56} borderRadius={28} />
        <Skeleton width={60} height={12} style={{ marginTop: 8 }} />
      </View>
    ))}
  </View>
);

/**
 * Full screen loading indicator
 */
export const FullScreenLoader: React.FC<{ message?: string }> = ({ message }) => (
  <View style={styles.fullScreenLoader}>
    <ActivityIndicator size="large" color={THEME.primary} />
    {message && <Text style={styles.loaderMessage}>{message}</Text>}
  </View>
);

/**
 * Inline loading indicator
 */
export const InlineLoader: React.FC<{ message?: string; size?: 'small' | 'large' }> = ({
  message,
  size = 'small',
}) => (
  <View style={styles.inlineLoader}>
    <ActivityIndicator size={size} color={THEME.primary} />
    {message && <Text style={styles.inlineLoaderMessage}>{message}</Text>}
  </View>
);

/**
 * Button loading state
 */
export const ButtonLoader: React.FC = () => (
  <ActivityIndicator size="small" color="#FFFFFF" />
);

/**
 * Dashboard skeleton screen
 */
export const DashboardSkeleton: React.FC = () => (
  <View style={styles.dashboardSkeleton}>
    {/* Header skeleton */}
    <View style={styles.headerSkeleton}>
      <Skeleton width={200} height={24} style={{ marginBottom: 8 }} />
      <Skeleton width={150} height={14} />
    </View>

    {/* Weather card skeleton */}
    <WeatherCardSkeleton />

    {/* Section title skeleton */}
    <Skeleton width={120} height={18} style={styles.sectionTitleSkeleton} />

    {/* Feature grid skeleton */}
    <FeatureGridSkeleton />

    {/* Alerts section skeleton */}
    <Skeleton width={100} height={18} style={styles.sectionTitleSkeleton} />
    <ListItemSkeleton />
    <ListItemSkeleton />
  </View>
);

/**
 * Market prices skeleton
 */
export const MarketPricesSkeleton: React.FC = () => (
  <View style={styles.marketPricesSkeleton}>
    {[1, 2, 3, 4, 5].map((i) => (
      <View key={i} style={styles.priceItemSkeleton}>
        <View style={styles.priceItemSkeletonLeft}>
          <Skeleton width={100} height={16} style={{ marginBottom: 6 }} />
          <Skeleton width={60} height={12} />
        </View>
        <View style={styles.priceItemSkeletonRight}>
          <Skeleton width={80} height={20} style={{ marginBottom: 4 }} />
          <Skeleton width={50} height={12} />
        </View>
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  // Card skeleton
  cardSkeleton: {
    backgroundColor: THEME.surface,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardSkeletonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardSkeletonHeaderText: {
    marginLeft: 12,
    flex: 1,
  },

  // List item skeleton
  listItemSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.surface,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
  },
  listItemSkeletonContent: {
    flex: 1,
    marginLeft: 12,
  },

  // Weather card skeleton
  weatherCardSkeleton: {
    backgroundColor: THEME.surface,
    borderRadius: 12,
    padding: 16,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  weatherCardSkeletonMain: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weatherCardSkeletonTemp: {
    marginLeft: 16,
  },
  weatherCardSkeletonDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },

  // Feature grid skeleton
  featureGridSkeleton: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
  },
  featureItemSkeleton: {
    width: '33.33%',
    alignItems: 'center',
    padding: 8,
  },

  // Full screen loader
  fullScreenLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.background,
  },
  loaderMessage: {
    marginTop: 16,
    fontSize: 14,
    color: THEME.textSecondary,
  },

  // Inline loader
  inlineLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  inlineLoaderMessage: {
    marginLeft: 12,
    fontSize: 14,
    color: THEME.textSecondary,
  },

  // Dashboard skeleton
  dashboardSkeleton: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  headerSkeleton: {
    backgroundColor: THEME.primary,
    padding: 20,
  },
  sectionTitleSkeleton: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
  },

  // Market prices skeleton
  marketPricesSkeleton: {
    padding: 16,
  },
  priceItemSkeleton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: THEME.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  priceItemSkeletonLeft: {},
  priceItemSkeletonRight: {
    alignItems: 'flex-end',
  },
});

export default {
  Skeleton,
  CardSkeleton,
  ListItemSkeleton,
  WeatherCardSkeleton,
  FeatureGridSkeleton,
  FullScreenLoader,
  InlineLoader,
  ButtonLoader,
  DashboardSkeleton,
  MarketPricesSkeleton,
  THEME,
};

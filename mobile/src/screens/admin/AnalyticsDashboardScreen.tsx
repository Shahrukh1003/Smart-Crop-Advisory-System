import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { apiClient } from '../../services/api';

interface UsageReport {
  adoptionRate: number;
  totalUsers: number;
  activeUsers: number;
  featurePopularity: Record<string, number>;
  userSatisfaction: Record<string, number>;
  periodStart: string;
  periodEnd: string;
}

interface FeedbackStats {
  totalFeedback: number;
  averageRating: number;
  feedbackByFeature: Record<string, { count: number; avgRating: number }>;
}

export const AnalyticsDashboardScreen: React.FC = () => {
  const [usageReport, setUsageReport] = useState<UsageReport | null>(null);
  const [feedbackStats, setFeedbackStats] = useState<FeedbackStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    try {
      setError(null);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const now = new Date();

      const [reportRes, statsRes] = await Promise.all([
        apiClient.get('/analytics/report', {
          params: {
            startDate: thirtyDaysAgo.toISOString(),
            endDate: now.toISOString(),
          },
        }),
        apiClient.get('/analytics/feedback/stats', {
          params: {
            startDate: thirtyDaysAgo.toISOString(),
            endDate: now.toISOString(),
          },
        }),
      ]);

      setUsageReport(reportRes.data);
      setFeedbackStats(statsRes.data);
    } catch (err) {
      setError('Failed to load analytics data');
      console.error('Analytics fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAnalytics();
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading analytics...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.title}>Analytics Dashboard</Text>
      <Text style={styles.subtitle}>Last 30 Days</Text>

      {/* Adoption Metrics */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>User Adoption</Text>
        <View style={styles.metricsRow}>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{usageReport?.totalUsers || 0}</Text>
            <Text style={styles.metricLabel}>Total Users</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{usageReport?.activeUsers || 0}</Text>
            <Text style={styles.metricLabel}>Active Users</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>
              {usageReport?.adoptionRate?.toFixed(1) || 0}%
            </Text>
            <Text style={styles.metricLabel}>Adoption Rate</Text>
          </View>
        </View>
      </View>

      {/* Feature Popularity */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Feature Popularity</Text>
        {usageReport?.featurePopularity &&
          Object.entries(usageReport.featurePopularity)
            .sort(([, a], [, b]) => b - a)
            .map(([feature, count]) => (
              <View key={feature} style={styles.featureRow}>
                <Text style={styles.featureName}>{formatFeatureName(feature)}</Text>
                <Text style={styles.featureCount}>{count} uses</Text>
              </View>
            ))}
        {(!usageReport?.featurePopularity ||
          Object.keys(usageReport.featurePopularity).length === 0) && (
          <Text style={styles.noData}>No feature usage data</Text>
        )}
      </View>

      {/* User Satisfaction */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>User Satisfaction</Text>
        <View style={styles.overallRating}>
          <Text style={styles.ratingValue}>
            {feedbackStats?.averageRating?.toFixed(1) || 'N/A'}
          </Text>
          <Text style={styles.ratingLabel}>
            Average Rating ({feedbackStats?.totalFeedback || 0} reviews)
          </Text>
        </View>
        {feedbackStats?.feedbackByFeature &&
          Object.entries(feedbackStats.feedbackByFeature)
            .sort(([, a], [, b]) => b.avgRating - a.avgRating)
            .map(([feature, stats]) => (
              <View key={feature} style={styles.featureRow}>
                <Text style={styles.featureName}>{formatFeatureName(feature)}</Text>
                <View style={styles.ratingInfo}>
                  <Text style={styles.starRating}>
                    {'★'.repeat(Math.round(stats.avgRating))}
                    {'☆'.repeat(5 - Math.round(stats.avgRating))}
                  </Text>
                  <Text style={styles.ratingCount}>({stats.count})</Text>
                </View>
              </View>
            ))}
        {(!feedbackStats?.feedbackByFeature ||
          Object.keys(feedbackStats.feedbackByFeature).length === 0) && (
          <Text style={styles.noData}>No feedback data</Text>
        )}
      </View>
    </ScrollView>
  );
};

const formatFeatureName = (feature: string): string => {
  return feature
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  metric: {
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  metricLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  featureName: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  featureCount: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  overallRating: {
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  ratingValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFC107',
  },
  ratingLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  ratingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starRating: {
    fontSize: 14,
    color: '#FFC107',
  },
  ratingCount: {
    fontSize: 12,
    color: '#999',
    marginLeft: 4,
  },
  noData: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },
});

export default AnalyticsDashboardScreen;

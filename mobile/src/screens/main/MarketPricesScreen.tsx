import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { api } from '../../services/api';
import * as Location from 'expo-location';

interface LocationData {
  latitude: number;
  longitude: number;
  district?: string;
  state?: string;
  city?: string;
}

interface MarketPrice {
  commodity: string;
  variety: string;
  market: {
    name: string;
    district: string;
    state: string;
    distance: number;
  };
  price: {
    min: number;
    max: number;
    modal: number;
    unit: string;
  };
  date: string;
  trend: 'rising' | 'falling' | 'stable';
  priceChange: number;
  transportationCost: number;
}

interface PriceHistory {
  date: string;
  price: number;
}

interface SellingRecommendation {
  recommendation: string;
  confidence: string;
  reasoning: string[];
  bestMarket: MarketPrice;
  currentPrice: number;
  avgPrice30Days: number;
  priceAboveAvg: number;
  msp: number | null;
}

const CROPS = [
  'Rice', 'Wheat', 'Maize', 'Groundnut', 'Cotton', 'Sugarcane', 'Soybean',
  'Tomato', 'Onion', 'Potato', 'Chilli', 'Turmeric', 'Ragi', 'Jowar', 'Bajra',
  'Tur/Arhar', 'Moong', 'Urad', 'Coconut', 'Banana'
];

export const MarketPricesScreen: React.FC = () => {
  const [selectedCrop, setSelectedCrop] = useState('Rice');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [prices, setPrices] = useState<MarketPrice[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [recommendation, setRecommendation] = useState<SellingRecommendation | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchPrices = useCallback(async () => {
    setIsLoading(true);
    try {
      // Get current location
      let loc: LocationData | null = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          loc = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          try {
            const [address] = await Location.reverseGeocodeAsync({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
            if (address) {
              loc.district = address.subregion || address.city || undefined;
              loc.state = address.region || undefined;
              loc.city = address.city || undefined;
            }
          } catch (e) {
            console.log('Reverse geocoding failed');
          }
          setLocation(loc);
        }
      } catch (e) {
        console.log('Location error:', e);
      }

      const lat = loc?.latitude || 12.9716;
      const lng = loc?.longitude || 77.5946;

      // Fetch market prices
      const pricesResponse = await api.get('/market/prices', {
        params: {
          commodity: selectedCrop,
          latitude: lat,
          longitude: lng,
          radiusKm: 100,
        },
      });

      if (pricesResponse.data) {
        setPrices(pricesResponse.data);
      }

      // Fetch price trends
      const trendsResponse = await api.get('/market/trends', {
        params: { commodity: selectedCrop, days: 30 },
      });

      if (trendsResponse.data) {
        setPriceHistory(trendsResponse.data);
      }

      // Fetch selling recommendation
      const recResponse = await api.get('/market/recommendation', {
        params: {
          commodity: selectedCrop,
          latitude: lat,
          longitude: lng,
        },
      });

      if (recResponse.data) {
        setRecommendation(recResponse.data);
      }

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching market prices:', error);
      // Set fallback data
      setPrices([
        {
          commodity: selectedCrop,
          variety: 'Standard',
          market: { name: 'Local APMC', district: 'Your District', state: 'Your State', distance: 10 },
          price: { min: 2100, max: 2400, modal: 2250, unit: 'quintal' },
          date: new Date().toISOString().split('T')[0],
          trend: 'stable',
          priceChange: 0,
          transportationCost: 120,
        },
      ]);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [selectedCrop]);

  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPrices();
  }, [fetchPrices]);

  const getTrendIcon = (trend: string): keyof typeof Ionicons.glyphMap => {
    switch (trend) {
      case 'rising': return 'trending-up';
      case 'falling': return 'trending-down';
      default: return 'remove';
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'rising': return '#4CAF50';
      case 'falling': return '#F44336';
      default: return '#FF9800';
    }
  };

  const getRecommendationColor = (rec: string) => {
    if (rec.includes('SELL NOW') || rec.includes('Excellent')) return '#4CAF50';
    if (rec.includes('HOLD') || rec.includes('below')) return '#F44336';
    return '#FF9800';
  };

  const renderPriceChart = () => {
    if (priceHistory.length === 0) return null;

    const maxPrice = Math.max(...priceHistory.map(p => p.price));
    const minPrice = Math.min(...priceHistory.map(p => p.price));
    const range = maxPrice - minPrice || 1;
    const chartHeight = 100;

    // Show only last 10 data points for better visibility
    const displayData = priceHistory.slice(-10);

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>30-Day Price Trend</Text>
        <View style={styles.chartYAxis}>
          <Text style={styles.chartLabel}>₹{maxPrice}</Text>
          <Text style={styles.chartLabel}>₹{Math.round((maxPrice + minPrice) / 2)}</Text>
          <Text style={styles.chartLabel}>₹{minPrice}</Text>
        </View>
        <View style={styles.chart}>
          <View style={styles.chartBars}>
            {displayData.map((item, index) => {
              const height = ((item.price - minPrice) / range) * chartHeight + 20;
              const isLast = index === displayData.length - 1;
              return (
                <View key={index} style={styles.barContainer}>
                  <View style={[styles.bar, { height }, isLast && styles.barHighlight]} />
                  <Text style={styles.barLabel}>{item.date.slice(5)}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2E7D32']} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Market Prices</Text>
        <Text style={styles.subtitle}>
          {location?.district ? `Near ${location.district}, ${location.state}` : 'Compare prices across nearby markets'}
        </Text>
      </View>

      <View style={styles.cropSelector}>
        <Text style={styles.label}>Select Crop</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedCrop}
            onValueChange={setSelectedCrop}
            style={styles.picker}
          >
            {CROPS.map((crop) => (
              <Picker.Item key={crop} label={crop} value={crop} />
            ))}
          </Picker>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
          <Text style={styles.loadingText}>Fetching market prices...</Text>
        </View>
      ) : (
        <>
          {/* Selling Recommendation */}
          {recommendation && (
            <View style={[styles.recommendationCard, { borderLeftColor: getRecommendationColor(recommendation.recommendation) }]}>
              <View style={styles.recommendationHeader}>
                <Ionicons name="bulb" size={24} color={getRecommendationColor(recommendation.recommendation)} />
                <Text style={[styles.recommendationTitle, { color: getRecommendationColor(recommendation.recommendation) }]}>
                  {recommendation.recommendation}
                </Text>
              </View>
              
              <View style={styles.recommendationStats}>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Current Price</Text>
                  <Text style={styles.statValue}>₹{recommendation.currentPrice}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>30-Day Avg</Text>
                  <Text style={styles.statValue}>₹{recommendation.avgPrice30Days}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>vs Average</Text>
                  <Text style={[styles.statValue, { color: recommendation.priceAboveAvg > 0 ? '#4CAF50' : '#F44336' }]}>
                    {recommendation.priceAboveAvg > 0 ? '+' : ''}{recommendation.priceAboveAvg}%
                  </Text>
                </View>
              </View>

              {recommendation.msp && (
                <View style={styles.mspInfo}>
                  <Ionicons name="information-circle" size={16} color="#666" />
                  <Text style={styles.mspText}>MSP: ₹{recommendation.msp}/quintal</Text>
                </View>
              )}

              {recommendation.reasoning.map((reason, index) => (
                <View key={index} style={styles.reasonItem}>
                  <Ionicons name="checkmark" size={14} color="#666" />
                  <Text style={styles.reasonText}>{reason}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Price Chart */}
          {renderPriceChart()}

          {/* Market List */}
          <Text style={styles.sectionTitle}>
            Nearby Markets ({prices.length} found within 100km)
          </Text>

          {prices.length === 0 ? (
            <View style={styles.noData}>
              <Ionicons name="alert-circle" size={48} color="#999" />
              <Text style={styles.noDataText}>No markets found nearby</Text>
              <Text style={styles.noDataSubtext}>Try selecting a different crop or location</Text>
            </View>
          ) : (
            prices.map((market, index) => (
              <View key={index} style={styles.marketCard}>
                <View style={styles.marketHeader}>
                  <View style={styles.marketInfo}>
                    <Text style={styles.marketName}>{market.market.name}</Text>
                    <Text style={styles.marketDistrict}>
                      <Ionicons name="location" size={12} color="#666" /> 
                      {market.market.district}, {market.market.state} • {market.market.distance} km
                    </Text>
                  </View>
                  <View style={[styles.trendBadge, { backgroundColor: getTrendColor(market.trend) + '20' }]}>
                    <Ionicons name={getTrendIcon(market.trend)} size={16} color={getTrendColor(market.trend)} />
                    <Text style={[styles.trendText, { color: getTrendColor(market.trend) }]}>
                      {market.priceChange > 0 ? '+' : ''}{market.priceChange}%
                    </Text>
                  </View>
                </View>

                <View style={styles.priceRow}>
                  <View style={styles.priceItem}>
                    <Text style={styles.priceLabel}>Min</Text>
                    <Text style={styles.priceValue}>₹{market.price.min}</Text>
                  </View>
                  <View style={styles.priceItem}>
                    <Text style={styles.priceLabel}>Modal</Text>
                    <Text style={[styles.priceValue, styles.modalPrice]}>₹{market.price.modal}</Text>
                  </View>
                  <View style={styles.priceItem}>
                    <Text style={styles.priceLabel}>Max</Text>
                    <Text style={styles.priceValue}>₹{market.price.max}</Text>
                  </View>
                </View>

                <View style={styles.transportRow}>
                  <Ionicons name="car" size={16} color="#666" />
                  <Text style={styles.transportText}>
                    Transport: ₹{market.transportationCost}/{market.price.unit}
                  </Text>
                  <View style={styles.netPriceContainer}>
                    <Text style={styles.netPriceLabel}>Net:</Text>
                    <Text style={styles.netPrice}>
                      ₹{market.price.modal - market.transportationCost}/{market.price.unit.charAt(0)}
                    </Text>
                  </View>
                </View>

                <Text style={styles.varietyText}>Variety: {market.variety}</Text>
              </View>
            ))
          )}

          {lastUpdated && (
            <Text style={styles.lastUpdated}>
              Last updated: {lastUpdated.toLocaleString()}
            </Text>
          )}
        </>
      )}

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
};


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { padding: 16, backgroundColor: '#2E7D32' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 14, color: '#E8F5E9', marginTop: 4 },
  cropSelector: { padding: 16, backgroundColor: '#fff', marginBottom: 8 },
  label: { fontSize: 14, fontWeight: '500', color: '#333', marginBottom: 8 },
  pickerContainer: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, backgroundColor: '#fafafa', overflow: 'hidden' },
  picker: { height: 50 },
  loadingContainer: { padding: 40, alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#666', fontSize: 14 },
  recommendationCard: { 
    backgroundColor: '#fff', margin: 16, padding: 16, borderRadius: 12, 
    borderLeftWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  recommendationHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  recommendationTitle: { fontSize: 16, fontWeight: 'bold', marginLeft: 8, flex: 1 },
  recommendationStats: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#f5f5f5', borderRadius: 8, padding: 12, marginBottom: 12 },
  statItem: { alignItems: 'center' },
  statLabel: { fontSize: 11, color: '#666' },
  statValue: { fontSize: 16, fontWeight: 'bold', color: '#333', marginTop: 2 },
  mspInfo: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E3F2FD', padding: 8, borderRadius: 6, marginBottom: 8 },
  mspText: { fontSize: 12, color: '#1565C0', marginLeft: 6 },
  reasonItem: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 6 },
  reasonText: { fontSize: 13, color: '#666', marginLeft: 8, flex: 1 },
  chartContainer: { backgroundColor: '#fff', margin: 16, padding: 16, borderRadius: 12 },
  chartTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 16 },
  chartYAxis: { position: 'absolute', left: 16, top: 40, height: 100, justifyContent: 'space-between' },
  chartLabel: { fontSize: 10, color: '#666' },
  chart: { marginLeft: 50, height: 140 },
  chartBars: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', height: 120 },
  barContainer: { alignItems: 'center', flex: 1 },
  bar: { width: 20, backgroundColor: '#4CAF50', borderRadius: 4, minHeight: 10 },
  barHighlight: { backgroundColor: '#2E7D32' },
  barLabel: { fontSize: 8, color: '#666', marginTop: 4, transform: [{ rotate: '-45deg' }] },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginHorizontal: 16, marginTop: 8, marginBottom: 12 },
  noData: { alignItems: 'center', padding: 40 },
  noDataText: { fontSize: 16, color: '#666', marginTop: 12 },
  noDataSubtext: { fontSize: 13, color: '#999', marginTop: 4 },
  marketCard: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 12, borderRadius: 12, padding: 16 },
  marketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  marketInfo: { flex: 1 },
  marketName: { fontSize: 16, fontWeight: '600', color: '#333' },
  marketDistrict: { fontSize: 12, color: '#666', marginTop: 4 },
  trendBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  trendText: { fontSize: 12, fontWeight: '600', marginLeft: 4 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#eee' },
  priceItem: { alignItems: 'center' },
  priceLabel: { fontSize: 12, color: '#666' },
  priceValue: { fontSize: 16, fontWeight: '600', color: '#333', marginTop: 4 },
  modalPrice: { color: '#2E7D32', fontSize: 18 },
  transportRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  transportText: { fontSize: 12, color: '#666', marginLeft: 8, flex: 1 },
  netPriceContainer: { flexDirection: 'row', alignItems: 'center' },
  netPriceLabel: { fontSize: 12, color: '#666', marginRight: 4 },
  netPrice: { fontSize: 14, fontWeight: '600', color: '#2E7D32' },
  varietyText: { fontSize: 11, color: '#999', marginTop: 8 },
  lastUpdated: { fontSize: 11, color: '#999', textAlign: 'center', marginVertical: 16 },
  bottomPadding: { height: 24 },
});

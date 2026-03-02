import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { api } from '../../services/api';

interface Props {
  navigation: any;
}

interface CropPrice {
  commodity: string;
  price: number;
  unit: string;
  market: string;
  change: number;
}

export const MarketScreen: React.FC<Props> = ({ navigation }) => {
  const [prices, setPrices] = useState<CropPrice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPrices = async () => {
    try {
      const response = await api.get('/market/prices', {
        params: { latitude: 12.9716, longitude: 77.5946 }
      });
      setPrices(response.data.prices || []);
    } catch (error) {
      // Use sample data
      setPrices([
        { commodity: 'Rice', price: 2200, unit: 'quintal', market: 'Bangalore', change: 2.5 },
        { commodity: 'Wheat', price: 2400, unit: 'quintal', market: 'Bangalore', change: -1.2 },
        { commodity: 'Maize', price: 1800, unit: 'quintal', market: 'Mysore', change: 3.1 },
        { commodity: 'Cotton', price: 6500, unit: 'quintal', market: 'Hubli', change: 0.8 },
        { commodity: 'Groundnut', price: 5200, unit: 'quintal', market: 'Davangere', change: -0.5 },
      ]);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPrices();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPrices();
  };

  const getCropEmoji = (commodity: string): string => {
    const emojiMap: Record<string, string> = {
      'Rice': '🌾', 'Wheat': '🌾', 'Maize': '🌽', 'Cotton': '🧶',
      'Groundnut': '🥜', 'Sugarcane': '🎋', 'Tomato': '🍅', 'Onion': '🧅',
      'Potato': '🥔', 'Soybean': '🫘',
    };
    return emojiMap[commodity] || '🌱';
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E7D32" />
        <Text style={styles.loadingText}>Loading market prices...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2E7D32']} />}
    >
      <View style={styles.header}>
        <Text style={styles.headerEmoji}>💰</Text>
        <Text style={styles.title}>Market Prices</Text>
        <Text style={styles.subtitle}>Today's prices from nearby markets</Text>
      </View>

      <View style={styles.pricesContainer}>
        {prices.map((item, index) => (
          <TouchableOpacity key={index} style={styles.priceCard}>
            <Text style={styles.cropEmoji}>{getCropEmoji(item.commodity)}</Text>
            <View style={styles.priceInfo}>
              <Text style={styles.commodityName}>{item.commodity}</Text>
              <Text style={styles.marketName}>📍 {item.market}</Text>
            </View>
            <View style={styles.priceValue}>
              <Text style={styles.price}>₹{item.price}</Text>
              <Text style={styles.unit}>per {item.unit}</Text>
              <Text style={[styles.change, item.change >= 0 ? styles.positive : styles.negative]}>
                {item.change >= 0 ? '↑' : '↓'} {Math.abs(item.change)}%
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity 
        style={styles.viewAllButton}
        onPress={() => navigation.navigate('MarketPrices')}
      >
        <Text style={styles.viewAllText}>View All Markets →</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#666' },
  header: { alignItems: 'center', padding: 24, backgroundColor: '#9C27B0' },
  headerEmoji: { fontSize: 48, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 14, color: '#E1BEE7', marginTop: 4 },
  pricesContainer: { padding: 16 },
  priceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cropEmoji: { fontSize: 32, marginRight: 12 },
  priceInfo: { flex: 1 },
  commodityName: { fontSize: 16, fontWeight: '600', color: '#333' },
  marketName: { fontSize: 13, color: '#666', marginTop: 2 },
  priceValue: { alignItems: 'flex-end' },
  price: { fontSize: 18, fontWeight: 'bold', color: '#2E7D32' },
  unit: { fontSize: 11, color: '#999' },
  change: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  positive: { color: '#4CAF50' },
  negative: { color: '#F44336' },
  viewAllButton: {
    backgroundColor: '#9C27B0',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  viewAllText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

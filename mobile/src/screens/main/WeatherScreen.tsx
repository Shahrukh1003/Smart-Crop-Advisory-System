import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../services/api';
import * as Location from 'expo-location';

interface LocationData {
  latitude: number;
  longitude: number;
  district?: string;
  state?: string;
  city?: string;
}

interface CurrentWeather {
  temperature: number;
  humidity: number;
  rainfall: number;
  windSpeed: number;
  description: string;
  icon: string;
  feelsLike?: number;
  pressure?: number;
  visibility?: number;
  clouds?: number;
}

interface ForecastDay {
  date: string;
  dayName: string;
  minTemp: number;
  maxTemp: number;
  rainfall: number;
  humidity: number;
  windSpeed: number;
  description: string;
}

interface WeatherAlert {
  alertType: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  startTime: string;
  endTime: string;
}

interface ActivityRecommendation {
  activity: string;
  recommended: boolean;
  timeWindow: string;
  reason: string;
}

export const WeatherScreen: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [current, setCurrent] = useState<CurrentWeather | null>(null);
  const [forecast, setForecast] = useState<ForecastDay[]>([]);
  const [alerts, setAlerts] = useState<WeatherAlert[]>([]);
  const [activities, setActivities] = useState<ActivityRecommendation[]>([]);
  const [pestRisk, setPestRisk] = useState<{ risk: string; actions: string[] } | null>(null);
  const [irrigation, setIrrigation] = useState<{ action: string; reason: string } | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchWeatherData = useCallback(async () => {
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
          // Try to get address
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

      const response = await api.get('/weather/forecast', {
        params: { latitude: lat, longitude: lng },
      });

      if (response.data) {
        // Set current weather
        if (response.data.current) {
          setCurrent({
            temperature: Math.round(response.data.current.temperature * 10) / 10,
            humidity: response.data.current.humidity,
            rainfall: response.data.current.rainfall || 0,
            windSpeed: response.data.current.windSpeed || 0,
            description: response.data.current.description,
            icon: response.data.current.icon || 'partly-sunny',
            feelsLike: response.data.current.feelsLike,
            pressure: response.data.current.pressure,
            visibility: response.data.current.visibility,
            clouds: response.data.current.clouds,
          });
        }

        // Set forecast with day names
        if (response.data.forecast) {
          const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          const forecastWithDays = response.data.forecast.map((day: any, index: number) => {
            const date = new Date(day.date);
            return {
              ...day,
              dayName: index === 0 ? 'Today' : days[date.getDay()],
            };
          });
          setForecast(forecastWithDays);
        }

        // Set alerts
        if (response.data.alerts) {
          setAlerts(response.data.alerts);
        }

        // Set activity recommendations
        if (response.data.activityRecommendations) {
          setActivities(response.data.activityRecommendations);
        }

        // Set pest risk
        if (response.data.pestRiskAlert) {
          setPestRisk(response.data.pestRiskAlert);
        }

        // Set irrigation recommendation
        if (response.data.irrigationRecommendation) {
          setIrrigation(response.data.irrigationRecommendation);
        }

        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Error fetching weather:', error);
      // Set fallback data
      setCurrent({
        temperature: 28,
        humidity: 65,
        rainfall: 0,
        windSpeed: 12,
        description: 'Partly Cloudy',
        icon: 'partly-sunny',
      });
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchWeatherData();
  }, [fetchWeatherData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchWeatherData();
  }, [fetchWeatherData]);

  const getWeatherIcon = (icon: string): keyof typeof Ionicons.glyphMap => {
    const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
      'sunny': 'sunny',
      'cloudy': 'cloudy',
      'partly-sunny': 'partly-sunny',
      'rainy': 'rainy',
      'thunderstorm': 'thunderstorm',
      'moon': 'moon',
    };
    return iconMap[icon] || 'partly-sunny';
  };

  const getAlertColor = (severity: string) => {
    switch (severity) {
      case 'high': return '#F44336';
      case 'medium': return '#FF9800';
      default: return '#4CAF50';
    }
  };

  const getAlertTitle = (alertType: string) => {
    switch (alertType) {
      case 'heavy_rain': return '🌧️ Heavy Rainfall Warning';
      case 'heat_wave': return '🌡️ Heat Wave Alert';
      case 'frost': return '❄️ Frost Warning';
      case 'storm': return '💨 Storm Alert';
      default: return '⚠️ Weather Alert';
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E7D32" />
        <Text style={styles.loadingText}>Fetching weather data...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2E7D32']} />}
    >
      {/* Current Weather */}
      <View style={styles.currentWeather}>
        <View style={styles.currentMain}>
          <Ionicons name={getWeatherIcon(current?.icon || 'sunny')} size={80} color="#FFC107" />
          <View style={styles.currentTemp}>
            <Text style={styles.temperature}>{current?.temperature}°C</Text>
            <Text style={styles.description}>{current?.description}</Text>
            <View style={styles.locationRow}>
              <Ionicons name="location" size={14} color="#E8F5E9" />
              <Text style={styles.location}>
                {location?.district || location?.city || 'Your Location'}
                {location?.state ? `, ${location.state}` : ''}
              </Text>
            </View>
          </View>
        </View>
        
        <View style={styles.currentDetails}>
          <View style={styles.detailItem}>
            <Ionicons name="water" size={20} color="#2196F3" />
            <Text style={styles.detailValue}>{current?.humidity}%</Text>
            <Text style={styles.detailLabel}>Humidity</Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="rainy" size={20} color="#4CAF50" />
            <Text style={styles.detailValue}>{current?.rainfall}mm</Text>
            <Text style={styles.detailLabel}>Rainfall</Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="speedometer" size={20} color="#9C27B0" />
            <Text style={styles.detailValue}>{current?.windSpeed}km/h</Text>
            <Text style={styles.detailLabel}>Wind</Text>
          </View>
          {current?.feelsLike && (
            <View style={styles.detailItem}>
              <Ionicons name="thermometer" size={20} color="#FF5722" />
              <Text style={styles.detailValue}>{current.feelsLike}°C</Text>
              <Text style={styles.detailLabel}>Feels Like</Text>
            </View>
          )}
        </View>

        {lastUpdated && (
          <Text style={styles.lastUpdated}>
            Last updated: {lastUpdated.toLocaleTimeString()}
          </Text>
        )}
      </View>


      {/* Weather Alerts */}
      {alerts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚠️ Weather Alerts</Text>
          {alerts.map((alert, index) => (
            <View key={index} style={[styles.alertCard, { borderLeftColor: getAlertColor(alert.severity) }]}>
              <Ionicons name="warning" size={24} color={getAlertColor(alert.severity)} />
              <View style={styles.alertContent}>
                <Text style={styles.alertTitle}>{getAlertTitle(alert.alertType)}</Text>
                <Text style={styles.alertDesc}>{alert.description}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Pest Risk Alert */}
      {pestRisk && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🐛 Pest Risk Alert</Text>
          <View style={styles.pestRiskCard}>
            <Text style={styles.pestRiskTitle}>{pestRisk.risk}</Text>
            <Text style={styles.pestRiskSubtitle}>Recommended Actions:</Text>
            {pestRisk.actions.map((action, index) => (
              <View key={index} style={styles.actionItem}>
                <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                <Text style={styles.actionText}>{action}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Irrigation Recommendation */}
      {irrigation && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💧 Irrigation Advisory</Text>
          <View style={styles.irrigationCard}>
            <Ionicons name="water" size={32} color="#2196F3" />
            <View style={styles.irrigationContent}>
              <Text style={styles.irrigationAction}>{irrigation.action}</Text>
              <Text style={styles.irrigationReason}>{irrigation.reason}</Text>
            </View>
          </View>
        </View>
      )}

      {/* 7-Day Forecast */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📅 7-Day Forecast</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.forecastScroll}>
          {forecast.map((day, index) => (
            <View key={index} style={[styles.forecastCard, index === 0 && styles.forecastCardToday]}>
              <Text style={[styles.forecastDay, index === 0 && styles.forecastDayToday]}>{day.dayName}</Text>
              <Ionicons 
                name={day.rainfall > 5 ? 'rainy' : day.rainfall > 0 ? 'cloudy' : 'sunny'} 
                size={32} 
                color={index === 0 ? '#FFC107' : '#666'} 
              />
              <Text style={styles.forecastTemp}>{Math.round(day.maxTemp)}°</Text>
              <Text style={styles.forecastTempMin}>{Math.round(day.minTemp)}°</Text>
              {day.rainfall > 0 && (
                <View style={styles.rainfallBadge}>
                  <Ionicons name="water" size={10} color="#2196F3" />
                  <Text style={styles.rainfallText}>{day.rainfall}mm</Text>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Activity Recommendations */}
      {activities.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🌾 Activity Recommendations</Text>
          {activities.map((activity, index) => (
            <View key={index} style={styles.activityCard}>
              <View style={[styles.activityIcon, { backgroundColor: activity.recommended ? '#E8F5E9' : '#FFEBEE' }]}>
                <Ionicons 
                  name={activity.recommended ? 'checkmark-circle' : 'close-circle'} 
                  size={24} 
                  color={activity.recommended ? '#4CAF50' : '#F44336'} 
                />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityName}>{activity.activity}</Text>
                <Text style={styles.activityRec}>
                  {activity.recommended ? '✓ Recommended' : '✗ Not Recommended'}
                </Text>
                <Text style={styles.activityReason}>{activity.reason}</Text>
                <Text style={styles.activityTime}>
                  <Ionicons name="time" size={12} color="#999" /> {activity.timeWindow}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#666', fontSize: 14 },
  currentWeather: { backgroundColor: '#2E7D32', padding: 24 },
  currentMain: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  currentTemp: { marginLeft: 20 },
  temperature: { fontSize: 48, fontWeight: 'bold', color: '#fff' },
  description: { fontSize: 18, color: '#E8F5E9' },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  location: { fontSize: 14, color: '#E8F5E9', marginLeft: 4 },
  currentDetails: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 16, flexWrap: 'wrap' },
  detailItem: { alignItems: 'center', minWidth: 70 },
  detailValue: { fontSize: 16, fontWeight: '600', color: '#fff', marginTop: 4 },
  detailLabel: { fontSize: 12, color: '#E8F5E9' },
  lastUpdated: { fontSize: 11, color: '#E8F5E9', textAlign: 'center', marginTop: 12 },
  section: { padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 12 },
  alertCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, borderLeftWidth: 4 },
  alertContent: { marginLeft: 12, flex: 1 },
  alertTitle: { fontSize: 14, fontWeight: '600', color: '#333' },
  alertDesc: { fontSize: 12, color: '#666', marginTop: 4, lineHeight: 18 },
  pestRiskCard: { backgroundColor: '#FFF3E0', borderRadius: 12, padding: 16 },
  pestRiskTitle: { fontSize: 14, fontWeight: '600', color: '#E65100', marginBottom: 8 },
  pestRiskSubtitle: { fontSize: 12, color: '#666', marginBottom: 8 },
  actionItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  actionText: { fontSize: 13, color: '#333', marginLeft: 8, flex: 1 },
  irrigationCard: { backgroundColor: '#E3F2FD', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center' },
  irrigationContent: { marginLeft: 16, flex: 1 },
  irrigationAction: { fontSize: 16, fontWeight: '600', color: '#1565C0' },
  irrigationReason: { fontSize: 13, color: '#666', marginTop: 4 },
  forecastScroll: { marginHorizontal: -16, paddingHorizontal: 16 },
  forecastCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginRight: 12, alignItems: 'center', width: 85 },
  forecastCardToday: { backgroundColor: '#E8F5E9' },
  forecastDay: { fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 8 },
  forecastDayToday: { color: '#2E7D32' },
  forecastTemp: { fontSize: 18, fontWeight: 'bold', color: '#333', marginTop: 8 },
  forecastTempMin: { fontSize: 14, color: '#999' },
  rainfallBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  rainfallText: { fontSize: 10, color: '#2196F3', marginLeft: 2 },
  activityCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, flexDirection: 'row', marginBottom: 8 },
  activityIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  activityContent: { marginLeft: 12, flex: 1 },
  activityName: { fontSize: 16, fontWeight: '600', color: '#333' },
  activityRec: { fontSize: 12, color: '#666', marginTop: 2 },
  activityReason: { fontSize: 13, color: '#666', marginTop: 4 },
  activityTime: { fontSize: 12, color: '#999', marginTop: 4 },
  bottomPadding: { height: 24 },
});

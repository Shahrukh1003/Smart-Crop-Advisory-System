import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert as RNAlert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';

// Location types
interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude: number | null;
  timestamp: number;
  district?: string;
  state?: string;
  city?: string;
}

type Language = 'en' | 'hi' | 'kn' | 'ta' | 'te';

interface VoiceCommandResult {
  transcribedText: string;
  intent: {
    intent: string;
    confidence: number;
    parameters: Record<string, string>;
  };
  responseText: string;
  audioResponse?: string;
  success: boolean;
}

interface WeatherData {
  temperature: number;
  humidity: number;
  description: string;
  icon: string;
  rainfall?: number;
  windSpeed?: number;
}

interface Alert {
  id: string;
  type: 'weather' | 'pest' | 'market' | 'broadcast';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
}

interface Props {
  navigation: any;
}

export const DashboardScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuthStore();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [isVoiceModalVisible, setIsVoiceModalVisible] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceResponse, setVoiceResponse] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('en');

  const features = [
    { icon: 'leaf', emoji: '🌾', title: 'Crop Advisory', color: '#4CAF50', screen: 'CropAdvisory' },
    { icon: 'bug', emoji: '🐛', title: 'Pest Detection', color: '#FF9800', screen: 'PestDetection' },
    { icon: 'cloud', emoji: '🌤️', title: 'Weather', color: '#2196F3', screen: 'Weather' },
    { icon: 'trending-up', emoji: '💰', title: 'Market Prices', color: '#9C27B0', screen: 'MarketPrices' },
    { icon: 'flask', emoji: '🧪', title: 'Soil Analysis', color: '#795548', screen: 'SoilAnalysis' },
    { icon: 'calendar', emoji: '📅', title: 'Crop History', color: '#607D8B', screen: 'CropHistory' },
  ];

  const fetchLocation = useCallback(async (): Promise<LocationData | null> => {
    try {
      // Dynamic import to avoid initialization errors
      const Location = await import('expo-location');

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Location permission not granted');
        return getDefaultLocation();
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const loc: LocationData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        altitude: position.coords.altitude,
        timestamp: position.timestamp,
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
        console.log('Reverse geocoding failed:', e);
      }

      setLocation(loc);
      return loc;
    } catch (error) {
      console.error('Error fetching location:', error);
      return getDefaultLocation();
    }
  }, []);

  const getDefaultLocation = (): LocationData => ({
    latitude: 12.9716,
    longitude: 77.5946,
    accuracy: null,
    altitude: null,
    timestamp: Date.now(),
    district: 'Bangalore Urban',
    state: 'Karnataka',
    city: 'Bangalore',
  });

  const getSampleCommands = (lang: Language): string[] => {
    const commands: Record<Language, string[]> = {
      en: ['What crop should I plant?', 'What is the weather today?', 'What is the price of rice?'],
      hi: ['मुझे कौन सी फसल लगानी चाहिए?', 'आज का मौसम कैसा है?', 'चावल का भाव क्या है?'],
      kn: ['ನಾನು ಯಾವ ಬೆಳೆ ಬೆಳೆಯಬೇಕು?', 'ಇಂದಿನ ಹವಾಮಾನ ಏನು?', 'ಅಕ್ಕಿಯ ಬೆಲೆ ಎಷ್ಟು?'],
      ta: ['நான் என்ன பயிர் நடவு செய்ய வேண்டும்?', 'இன்றைய வானிலை என்ன?', 'அரிசி விலை என்ன?'],
      te: ['నేను ఏ పంట వేయాలి?', 'ఈ రోజు వాతావరణం ఎలా ఉంది?', 'బియ్యం ధర ఎంత?'],
    };
    return commands[lang] || commands.en;
  };

  const fetchDashboardData = useCallback(async (loc?: LocationData | null) => {
    try {
      const currentLocation = loc || location || await fetchLocation();
      const lat = currentLocation?.latitude || 12.9716;
      const lng = currentLocation?.longitude || 77.5946;

      // Fetch weather data
      try {
        const weatherRes = await api.get('/weather/forecast', {
          params: { latitude: lat, longitude: lng },
        });

        if (weatherRes.data?.current) {
          setWeather({
            temperature: Math.round(weatherRes.data.current.temperature),
            humidity: weatherRes.data.current.humidity,
            description: weatherRes.data.current.description,
            icon: weatherRes.data.current.icon || 'partly-sunny',
            rainfall: weatherRes.data.current.rainfall,
            windSpeed: weatherRes.data.current.windSpeed,
          });

          // Generate alerts from weather data
          const weatherAlerts: Alert[] = [];

          if (weatherRes.data.alerts && weatherRes.data.alerts.length > 0) {
            weatherRes.data.alerts.forEach((alert: any, index: number) => {
              weatherAlerts.push({
                id: `weather-${index}`,
                type: 'weather',
                title: alert.alertType === 'heavy_rain' ? '🌧️ Heavy Rain Alert' :
                  alert.alertType === 'heat_wave' ? '🌡️ Heat Wave Warning' :
                    alert.alertType === 'frost' ? '❄️ Frost Alert' :
                      alert.alertType === 'storm' ? '💨 Storm Warning' : 'Weather Alert',
                description: alert.description,
                priority: alert.severity,
                createdAt: new Date().toISOString(),
              });
            });
          }

          // Add pest risk alert if present
          if (weatherRes.data.pestRiskAlert) {
            weatherAlerts.push({
              id: 'pest-risk',
              type: 'pest',
              title: '🐛 Pest Risk Alert',
              description: weatherRes.data.pestRiskAlert.risk,
              priority: 'medium',
              createdAt: new Date().toISOString(),
            });
          }

          // Add irrigation recommendation
          if (weatherRes.data.irrigationRecommendation) {
            weatherAlerts.push({
              id: 'irrigation',
              type: 'broadcast',
              title: '💧 Irrigation Advisory',
              description: weatherRes.data.irrigationRecommendation.action + ' - ' +
                weatherRes.data.irrigationRecommendation.reason,
              priority: 'low',
              createdAt: new Date().toISOString(),
            });
          }

          setAlerts(weatherAlerts.slice(0, 5));
        }
      } catch (weatherError) {
        console.error('Weather fetch error:', weatherError);
        // Use fallback weather data
        setWeather({
          temperature: 28,
          humidity: 65,
          description: 'Partly Cloudy',
          icon: 'partly-sunny',
        });
      }
    } catch (error) {
      console.error('Dashboard data fetch error:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [location, fetchLocation]);

  useEffect(() => {
    const initDashboard = async () => {
      const loc = await fetchLocation();
      await fetchDashboardData(loc);
    };
    initDashboard();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleVoicePress = async () => {
    setIsVoiceModalVisible(true);
    setVoiceResponse(null);
  };

  const recordingRef = React.useRef<any>(null);

  const startVoiceRecording = async () => {
    try {
      const { Audio } = await import('expo-av');
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        RNAlert.alert('Permission Required', 'Microphone permission is needed for voice commands.');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      setIsRecording(false);
      RNAlert.alert('Error', 'Could not start recording. Please use text input instead.');
    }
  };

  const stopVoiceRecording = async () => {
    setIsRecording(false);
    if (!recordingRef.current) return;
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      if (uri) {
        setVoiceResponse('Processing your voice...');
        const ExpoFileSystem = require('expo-file-system');
        const base64Audio = await ExpoFileSystem.readAsStringAsync(uri, {
          encoding: ExpoFileSystem.EncodingType.Base64,
        });
        const response = await api.post('/voice/command', {
          audio: base64Audio,
          language: selectedLanguage,
          isText: false,
        });
        handleVoiceResult(response.data);
      }
    } catch (error) {
      console.error('Error processing voice:', error);
      setVoiceResponse('Sorry, voice processing failed. Please try text input.');
      recordingRef.current = null;
    }
  };

  const handleTextCommand = async () => {
    if (!textInput.trim()) return;

    setVoiceResponse('Processing...');
    try {
      const response = await api.post('/voice/command', {
        input: textInput,
        language: selectedLanguage,
        isText: true,
      });
      handleVoiceResult(response.data);
    } catch (error) {
      console.error('Error processing text command:', error);
      setVoiceResponse('Sorry, I could not process your request. Please try again.');
    }
    setTextInput('');
  };

  const handleVoiceResult = (result: VoiceCommandResult) => {
    setVoiceResponse(result.responseText);

    // Navigate based on intent
    if (result.success && result.intent.confidence > 0.6) {
      setTimeout(() => {
        switch (result.intent.intent) {
          case 'weather':
            setIsVoiceModalVisible(false);
            navigation.navigate('Weather');
            break;
          case 'market_price':
            setIsVoiceModalVisible(false);
            navigation.navigate('MarketPrices');
            break;
          case 'crop_advisory':
            setIsVoiceModalVisible(false);
            navigation.navigate('CropAdvisory');
            break;
          case 'pest_detection':
            setIsVoiceModalVisible(false);
            navigation.navigate('PestDetection');
            break;
        }
      }, 2000);
    }
  };

  const getWeatherIcon = (icon: string): keyof typeof Ionicons.glyphMap => {
    const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
      'sunny': 'sunny',
      'cloudy': 'cloudy',
      'partly-sunny': 'partly-sunny',
      'rainy': 'rainy',
      'thunderstorm': 'thunderstorm',
    };
    return iconMap[icon] || 'partly-sunny';
  };

  const getAlertColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#F44336';
      case 'medium': return '#FF9800';
      default: return '#4CAF50';
    }
  };

  const getAlertIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case 'weather': return 'warning';
      case 'pest': return 'bug';
      case 'market': return 'trending-up';
      case 'broadcast': return 'megaphone';
      default: return 'information-circle';
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E7D32" />
        <Text style={styles.loadingText}>Getting your location...</Text>
      </View>
    );
  }


  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2E7D32']} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>Welcome, {user?.name || 'Farmer'}!</Text>
        <Text style={styles.subGreeting}>What would you like to do today?</Text>
      </View>

      {/* Weather Card */}
      <TouchableOpacity
        style={styles.weatherCard}
        onPress={() => navigation.navigate('Weather')}
      >
        <View style={styles.weatherInfo}>
          <Ionicons
            name={getWeatherIcon(weather?.icon || 'partly-sunny')}
            size={48}
            color="#FFC107"
          />
          <View style={styles.weatherText}>
            <Text style={styles.temperature}>{weather?.temperature || 28}°C</Text>
            <Text style={styles.weatherDesc}>{weather?.description || 'Partly Cloudy'}</Text>
          </View>
        </View>
        <View style={styles.weatherDetails}>
          <View style={styles.weatherDetail}>
            <Ionicons name="water" size={16} color="#2196F3" />
            <Text style={styles.weatherDetailText}>{weather?.humidity || 65}% Humidity</Text>
          </View>
          {weather?.rainfall !== undefined && weather.rainfall > 0 && (
            <View style={styles.weatherDetail}>
              <Ionicons name="rainy" size={16} color="#4CAF50" />
              <Text style={styles.weatherDetailText}>{weather.rainfall}mm Rain</Text>
            </View>
          )}
          {weather?.windSpeed !== undefined && (
            <View style={styles.weatherDetail}>
              <Ionicons name="speedometer" size={16} color="#9C27B0" />
              <Text style={styles.weatherDetailText}>{weather.windSpeed} km/h</Text>
            </View>
          )}
        </View>
        <View style={styles.locationRow}>
          <Ionicons name="location" size={14} color="#999" />
          <Text style={styles.weatherLocation}>
            {location?.district || location?.city || 'Your Location'}
            {location?.state ? `, ${location.state}` : ''}
          </Text>
          <Text style={styles.liveIndicator}>● LIVE</Text>
        </View>
      </TouchableOpacity>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.featuresGrid}>
        {features.map((feature, index) => (
          <TouchableOpacity
            key={index}
            style={styles.featureCard}
            onPress={() => navigation.navigate(feature.screen)}
          >
            <View style={[styles.featureIcon, { backgroundColor: feature.color }]}>
              <Text style={styles.featureEmoji}>{feature.emoji}</Text>
            </View>
            <Text style={styles.featureTitle}>{feature.title}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Recent Alerts */}
      <Text style={styles.sectionTitle}>Recent Alerts</Text>
      {alerts.length > 0 ? (
        alerts.map((alert) => (
          <TouchableOpacity
            key={alert.id}
            style={[styles.alertCard, { borderLeftColor: getAlertColor(alert.priority) }]}
          >
            <Ionicons
              name={getAlertIcon(alert.type)}
              size={24}
              color={getAlertColor(alert.priority)}
            />
            <View style={styles.alertContent}>
              <Text style={styles.alertTitle}>{alert.title}</Text>
              <Text style={styles.alertDesc} numberOfLines={2}>{alert.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        ))
      ) : (
        <View style={styles.noAlerts}>
          <Ionicons name="checkmark-circle" size={48} color="#4CAF50" />
          <Text style={styles.noAlertsText}>No alerts at this time</Text>
        </View>
      )}

      {/* Voice Assistant Button */}
      <TouchableOpacity style={styles.voiceButton} onPress={handleVoicePress}>
        <Ionicons name="mic" size={24} color="#fff" />
        <Text style={styles.voiceButtonText}>Ask Voice Assistant</Text>
      </TouchableOpacity>

      {/* Voice Assistant Modal */}
      <Modal
        visible={isVoiceModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsVoiceModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Voice Assistant</Text>
              <TouchableOpacity onPress={() => setIsVoiceModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {/* Language Selector */}
            <View style={styles.languageSelector}>
              {[
                { code: 'en' as Language, nativeName: 'English' },
                { code: 'hi' as Language, nativeName: 'हिंदी' },
                { code: 'kn' as Language, nativeName: 'ಕನ್ನಡ' },
                { code: 'ta' as Language, nativeName: 'தமிழ்' },
                { code: 'te' as Language, nativeName: 'తెలుగు' },
              ].map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.languageButton,
                    selectedLanguage === lang.code && styles.languageButtonActive,
                  ]}
                  onPress={() => setSelectedLanguage(lang.code)}
                >
                  <Text
                    style={[
                      styles.languageButtonText,
                      selectedLanguage === lang.code && styles.languageButtonTextActive,
                    ]}
                  >
                    {lang.nativeName}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Voice Response */}
            {voiceResponse && (
              <View style={styles.responseBox}>
                <Text style={styles.responseText}>{voiceResponse}</Text>
              </View>
            )}

            {/* Recording Button */}
            <TouchableOpacity
              style={[styles.recordButton, isRecording && styles.recordButtonActive]}
              onPressIn={startVoiceRecording}
              onPressOut={stopVoiceRecording}
            >
              <Ionicons
                name={isRecording ? 'radio-button-on' : 'mic'}
                size={48}
                color="#fff"
              />
              <Text style={styles.recordButtonText}>
                {isRecording ? 'Release to send' : 'Hold to speak'}
              </Text>
            </TouchableOpacity>

            {/* Text Input Alternative */}
            <View style={styles.textInputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder="Or type your question..."
                value={textInput}
                onChangeText={setTextInput}
                onSubmitEditing={handleTextCommand}
              />
              <TouchableOpacity style={styles.sendButton} onPress={handleTextCommand}>
                <Ionicons name="send" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Sample Commands */}
            <Text style={styles.sampleTitle}>Try saying:</Text>
            <View style={styles.sampleCommands}>
              {getSampleCommands(selectedLanguage).slice(0, 3).map((cmd, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.sampleCommand}
                  onPress={() => {
                    setTextInput(cmd);
                  }}
                >
                  <Text style={styles.sampleCommandText}>"{cmd}"</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#666', fontSize: 14 },
  header: { padding: 20, backgroundColor: '#2E7D32' },
  greeting: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  subGreeting: { fontSize: 14, color: '#E8F5E9', marginTop: 4 },
  weatherCard: {
    backgroundColor: '#fff', margin: 16, padding: 16, borderRadius: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  weatherInfo: { flexDirection: 'row', alignItems: 'center' },
  weatherText: { marginLeft: 16 },
  temperature: { fontSize: 32, fontWeight: 'bold', color: '#333' },
  weatherDesc: { fontSize: 14, color: '#666' },
  weatherDetails: { flexDirection: 'row', marginTop: 12, flexWrap: 'wrap' },
  weatherDetail: { flexDirection: 'row', alignItems: 'center', marginRight: 16, marginBottom: 4 },
  weatherDetailText: { fontSize: 12, color: '#666', marginLeft: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  weatherLocation: { fontSize: 12, color: '#999', marginLeft: 4, flex: 1 },
  liveIndicator: { fontSize: 10, color: '#4CAF50', fontWeight: 'bold' },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginHorizontal: 16, marginTop: 16, marginBottom: 12 },
  featuresGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8 },
  featureCard: { width: '33.33%', padding: 8, alignItems: 'center' },
  featureIcon: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  featureEmoji: { fontSize: 28 },
  featureTitle: { fontSize: 12, color: '#333', textAlign: 'center', fontWeight: '500' },
  alertCard: {
    backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 8, padding: 16,
    borderRadius: 12, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 4,
  },
  alertContent: { marginLeft: 12, flex: 1 },
  alertTitle: { fontSize: 14, fontWeight: '600', color: '#333' },
  alertDesc: { fontSize: 12, color: '#666', marginTop: 2 },
  noAlerts: { alignItems: 'center', padding: 32 },
  noAlertsText: { fontSize: 14, color: '#666', marginTop: 8 },
  voiceButton: {
    backgroundColor: '#2E7D32', flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', margin: 16, padding: 16, borderRadius: 12,
  },
  voiceButtonText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  languageSelector: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  languageButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f0f0f0', marginRight: 8, marginBottom: 8 },
  languageButtonActive: { backgroundColor: '#2E7D32' },
  languageButtonText: { fontSize: 12, color: '#666' },
  languageButtonTextActive: { color: '#fff' },
  responseBox: { backgroundColor: '#E8F5E9', padding: 16, borderRadius: 12, marginBottom: 16 },
  responseText: { fontSize: 14, color: '#333', lineHeight: 20 },
  recordButton: {
    backgroundColor: '#2E7D32', width: 120, height: 120, borderRadius: 60,
    justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginVertical: 16,
  },
  recordButtonActive: { backgroundColor: '#F44336' },
  recordButtonText: { color: '#fff', fontSize: 12, marginTop: 8 },
  textInputContainer: { flexDirection: 'row', marginTop: 16 },
  textInput: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14 },
  sendButton: { backgroundColor: '#2E7D32', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  sampleTitle: { fontSize: 14, color: '#666', marginTop: 16, marginBottom: 8 },
  sampleCommands: { flexDirection: 'column' },
  sampleCommand: { backgroundColor: '#f5f5f5', padding: 12, borderRadius: 8, marginBottom: 8 },
  sampleCommandText: { fontSize: 13, color: '#666', fontStyle: 'italic' },
});

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';

interface Props {
  navigation: any;
}

const INDIAN_STATES = [
  'Andhra Pradesh', 'Karnataka', 'Kerala', 'Tamil Nadu', 'Telangana',
  'Maharashtra', 'Gujarat', 'Rajasthan', 'Madhya Pradesh', 'Uttar Pradesh',
  'Bihar', 'West Bengal', 'Odisha', 'Punjab', 'Haryana',
];

export const ProfileSetupScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuthStore();
  const [district, setDistrict] = useState('');
  const [state, setState] = useState('');
  const [landArea, setLandArea] = useState('');
  const [soilType, setSoilType] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);

  const fetchLocation = async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required for personalized recommendations');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setCoordinates({
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      });

      // Reverse geocode to get district and state
      const [address] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (address) {
        setDistrict(address.subregion || address.city || '');
        setState(address.region || '');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to get location. Please enter manually.');
    } finally {
      setLocationLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!district || !state) {
      Alert.alert('Error', 'Please enter your location details');
      return;
    }

    setIsLoading(true);
    try {
      await api.put('/users/profile', {
        district,
        state,
        latitude: coordinates?.lat,
        longitude: coordinates?.lng,
        landArea: landArea ? parseFloat(landArea) : undefined,
        soilType: soilType || undefined,
      });

      navigation.reset({
        index: 0,
        routes: [{ name: 'Main' }],
      });
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to save profile');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Ionicons name="person-circle" size={64} color="#2E7D32" />
        <Text style={styles.title}>Complete Your Profile</Text>
        <Text style={styles.subtitle}>Help us personalize your experience</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          
          <TouchableOpacity
            style={styles.locationButton}
            onPress={fetchLocation}
            disabled={locationLoading}
          >
            {locationLoading ? (
              <ActivityIndicator color="#2E7D32" />
            ) : (
              <>
                <Ionicons name="location" size={20} color="#2E7D32" />
                <Text style={styles.locationButtonText}>Detect My Location</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.label}>District *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your district"
            value={district}
            onChangeText={setDistrict}
          />

          <Text style={styles.label}>State *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your state"
            value={state}
            onChangeText={setState}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Land Details (Optional)</Text>

          <Text style={styles.label}>Total Land Area (acres)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 2.5"
            keyboardType="decimal-pad"
            value={landArea}
            onChangeText={setLandArea}
          />

          <Text style={styles.label}>Primary Soil Type</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Red soil, Black soil, Alluvial"
            value={soilType}
            onChangeText={setSoilType}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleSaveProfile}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.buttonText}>Save & Continue</Text>
              <Ionicons name="checkmark" size={20} color="#fff" />
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Main' }] })}
        >
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#fafafa',
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  locationButtonText: {
    color: '#2E7D32',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  button: {
    backgroundColor: '#2E7D32',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#9E9E9E',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  skipButton: {
    alignItems: 'center',
    padding: 16,
  },
  skipText: {
    color: '#666',
    fontSize: 14,
  },
});

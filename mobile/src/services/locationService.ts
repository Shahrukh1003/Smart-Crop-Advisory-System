import * as Location from 'expo-location';
import { Alert, Platform } from 'react-native';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude: number | null;
  timestamp: number;
  district?: string;
  state?: string;
  city?: string;
}

class LocationService {
  private currentLocation: LocationData | null = null;
  private watchSubscription: Location.LocationSubscription | null = null;

  async requestPermissions(): Promise<boolean> {
    try {
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      
      if (foregroundStatus !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'This app needs location access to provide weather updates and nearby market prices for your area.',
          [{ text: 'OK' }]
        );
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error requesting location permissions:', error);
      return false;
    }
  }

  async getCurrentLocation(): Promise<LocationData | null> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        return this.getDefaultLocation();
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      this.currentLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        altitude: location.coords.altitude,
        timestamp: location.timestamp,
      };

      // Try to get address details
      try {
        const [address] = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        if (address) {
          this.currentLocation.district = address.subregion || address.city || undefined;
          this.currentLocation.state = address.region || undefined;
          this.currentLocation.city = address.city || undefined;
        }
      } catch (geocodeError) {
        console.warn('Reverse geocoding failed:', geocodeError);
      }

      return this.currentLocation;
    } catch (error) {
      console.error('Error getting current location:', error);
      return this.getDefaultLocation();
    }
  }

  async watchLocation(callback: (location: LocationData) => void): Promise<void> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) return;

      this.watchSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 60000, // Update every minute
          distanceInterval: 100, // Or when moved 100 meters
        },
        async (location) => {
          const locationData: LocationData = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy,
            altitude: location.coords.altitude,
            timestamp: location.timestamp,
          };

          // Get address for significant location changes
          try {
            const [address] = await Location.reverseGeocodeAsync({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            });

            if (address) {
              locationData.district = address.subregion || address.city || undefined;
              locationData.state = address.region || undefined;
              locationData.city = address.city || undefined;
            }
          } catch (geocodeError) {
            console.warn('Reverse geocoding failed:', geocodeError);
          }

          this.currentLocation = locationData;
          callback(locationData);
        }
      );
    } catch (error) {
      console.error('Error watching location:', error);
    }
  }

  stopWatching(): void {
    if (this.watchSubscription) {
      this.watchSubscription.remove();
      this.watchSubscription = null;
    }
  }

  getLastKnownLocation(): LocationData | null {
    return this.currentLocation;
  }

  private getDefaultLocation(): LocationData {
    // Default to Bangalore, Karnataka
    return {
      latitude: 12.9716,
      longitude: 77.5946,
      accuracy: null,
      altitude: null,
      timestamp: Date.now(),
      district: 'Bangalore Urban',
      state: 'Karnataka',
      city: 'Bangalore',
    };
  }

  // Calculate distance between two points in km
  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}

export const locationService = new LocationService();

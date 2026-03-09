import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { ActivityIndicator, View, Text, StyleSheet } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';

export const AppNavigator: React.FC = () => {
  const { isAuthenticated, isLoading, loadStoredAuth } = useAuthStore();
  const [error, setError] = React.useState<string | null>(null);

  useEffect(() => {
    loadStoredAuth().catch((err) => {
      console.error('Failed to load auth:', err);
      setError('Failed to initialize app');
    });
  }, []);

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={{ fontSize: 16, color: '#F44336', marginBottom: 12, textAlign: 'center' }}>
          {error}
        </Text>
        <Text
          style={{ fontSize: 14, color: '#2E7D32', fontWeight: '600' }}
          onPress={() => {
            setError(null);
            loadStoredAuth().catch((err) => {
              setError('Failed to initialize app');
            });
          }}
        >
          Tap to Retry
        </Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E7D32" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
});

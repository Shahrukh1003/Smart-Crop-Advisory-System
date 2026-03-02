import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { DashboardScreen } from '../screens/main/DashboardScreen';
import { AdvisoryScreen } from '../screens/main/AdvisoryScreen';
import { MarketScreen } from '../screens/main/MarketScreen';
import { ProfileScreen } from '../screens/main/ProfileScreen';
import { WeatherScreen } from '../screens/main/WeatherScreen';
import { CropAdvisoryScreen } from '../screens/main/CropAdvisoryScreen';
import { PestDetectionScreen } from '../screens/main/PestDetectionScreen';
import { MarketPricesScreen } from '../screens/main/MarketPricesScreen';
import { SoilAnalysisScreen } from '../screens/main/SoilAnalysisScreen';
import { CropHistoryScreen } from '../screens/main/CropHistoryScreen';

export type MainTabParamList = {
  Dashboard: undefined;
  Advisory: undefined;
  Market: undefined;
  Profile: undefined;
};

export type MainStackParamList = {
  MainTabs: undefined;
  Weather: undefined;
  CropAdvisory: undefined;
  PestDetection: undefined;
  MarketPrices: undefined;
  SoilAnalysis: undefined;
  CropHistory: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<MainStackParamList>();

const MainTabs: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          switch (route.name) {
            case 'Dashboard':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Advisory':
              iconName = focused ? 'leaf' : 'leaf-outline';
              break;
            case 'Market':
              iconName = focused ? 'trending-up' : 'trending-up-outline';
              break;
            case 'Profile':
              iconName = focused ? 'person' : 'person-outline';
              break;
            default:
              iconName = 'help-circle-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#2E7D32',
        tabBarInactiveTintColor: 'gray',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        tabBarStyle: {
          height: 60,
          paddingBottom: 8,
          paddingTop: 4,
        },
        headerStyle: {
          backgroundColor: '#2E7D32',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: 'Home', headerShown: false }}
      />
      <Tab.Screen
        name="Advisory"
        component={AdvisoryScreen}
        options={{ title: 'Crop Advisory' }}
      />
      <Tab.Screen
        name="Market"
        component={MarketScreen}
        options={{ title: 'Market Prices' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
    </Tab.Navigator>
  );
};

export const MainNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#2E7D32',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen
        name="MainTabs"
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Weather"
        component={WeatherScreen}
        options={{ title: 'Weather Forecast' }}
      />
      <Stack.Screen
        name="CropAdvisory"
        component={CropAdvisoryScreen}
        options={{ title: 'Crop Advisory' }}
      />
      <Stack.Screen
        name="PestDetection"
        component={PestDetectionScreen}
        options={{ title: 'Pest Detection' }}
      />
      <Stack.Screen
        name="MarketPrices"
        component={MarketPricesScreen}
        options={{ title: 'Market Prices' }}
      />
      <Stack.Screen
        name="SoilAnalysis"
        component={SoilAnalysisScreen}
        options={{ title: 'Soil Analysis' }}
      />
      <Stack.Screen
        name="CropHistory"
        component={CropHistoryScreen}
        options={{ title: 'Crop History' }}
      />
    </Stack.Navigator>
  );
};

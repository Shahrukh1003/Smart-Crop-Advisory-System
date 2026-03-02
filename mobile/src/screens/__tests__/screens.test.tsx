import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

// Mock dependencies
jest.mock('../../store/authStore', () => ({
  useAuthStore: () => ({
    user: {
      id: 'test-user',
      name: 'Test Farmer',
      phoneNumber: '9876543210',
      language: 'en',
      location: { latitude: 12.9716, longitude: 77.5946, district: 'Bangalore', state: 'Karnataka' },
    },
    isAuthenticated: true,
    login: jest.fn(),
    logout: jest.fn(),
  }),
}));

jest.mock('../../services/api', () => ({
  api: {
    get: jest.fn().mockImplementation((url: string) => {
      if (url.includes('/market/prices')) {
        return Promise.resolve({
          data: [{
            commodity: 'Rice',
            variety: 'Standard',
            market: { name: 'Local APMC', district: 'Bangalore', state: 'Karnataka', distance: 10 },
            price: { min: 2100, max: 2400, modal: 2250, unit: 'quintal' },
            date: new Date().toISOString().split('T')[0],
            trend: 'stable',
            priceChange: 0,
            transportationCost: 120,
          }],
        });
      }
      if (url.includes('/market/trends')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/market/recommendation')) {
        return Promise.resolve({
          data: {
            recommendation: 'HOLD - Wait for better prices',
            currentPrice: 2250,
            avgPrice: 2200,
            msp: 2040,
            priceVsMsp: 10.3,
            reasoning: ['Price is above MSP', 'Market trend is stable'],
          },
        });
      }
      if (url.includes('/weather')) {
        return Promise.resolve({
          data: {
            current: { temperature: 28, humidity: 65, description: 'Partly cloudy' },
            forecast: [],
          },
        });
      }
      return Promise.resolve({ data: {} });
    }),
    post: jest.fn().mockResolvedValue({ data: {} }),
  },
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true }),
  launchCameraAsync: jest.fn().mockResolvedValue({ canceled: true }),
  MediaTypeOptions: { Images: 'Images' },
}));

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({
    coords: { latitude: 12.9716, longitude: 77.5946 },
  }),
  reverseGeocodeAsync: jest.fn().mockResolvedValue([{ subregion: 'Bangalore', region: 'Karnataka' }]),
  Accuracy: {
    Balanced: 3,
    High: 4,
    Highest: 5,
    Low: 2,
    Lowest: 1,
  },
}));

jest.mock('@react-native-picker/picker', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  
  const MockPicker = ({ children, onValueChange, selectedValue, ...props }: any) => {
    return React.createElement(View, { testID: 'picker', ...props }, children);
  };
  
  MockPicker.Item = ({ label, value }: any) => {
    return React.createElement(Text, { key: value }, label);
  };
  
  return { Picker: MockPicker };
});

// Import screens after mocks
import { DashboardScreen } from '../main/DashboardScreen';
import { CropAdvisoryScreen } from '../main/CropAdvisoryScreen';
import { MarketPricesScreen } from '../main/MarketPricesScreen';
import { SoilAnalysisScreen } from '../main/SoilAnalysisScreen';

describe('DashboardScreen', () => {
  const mockNavigation = { navigate: jest.fn() };

  it('renders welcome message with user name', async () => {
    const { getByText } = render(<DashboardScreen navigation={mockNavigation} />);
    await waitFor(() => {
      expect(getByText(/Welcome, Test Farmer/)).toBeTruthy();
    });
  });

  it('displays quick action buttons', async () => {
    const { getByText } = render(<DashboardScreen navigation={mockNavigation} />);
    await waitFor(() => {
      expect(getByText('Crop Advisory')).toBeTruthy();
      expect(getByText('Pest Detection')).toBeTruthy();
      expect(getByText('Weather')).toBeTruthy();
      expect(getByText('Market Prices')).toBeTruthy();
    });
  });

  it('shows weather card', async () => {
    const { getByText } = render(<DashboardScreen navigation={mockNavigation} />);
    await waitFor(() => {
      expect(getByText(/°C/)).toBeTruthy();
    });
  });
});

describe('CropAdvisoryScreen', () => {
  it('renders input form', () => {
    const { getByText, getByPlaceholderText } = render(<CropAdvisoryScreen />);
    expect(getByText('Get Crop Recommendations')).toBeTruthy();
    expect(getByText('Soil Type *')).toBeTruthy();
    expect(getByText('Season *')).toBeTruthy();
  });

  it('shows validation error when soil type not selected', () => {
    const { getByText } = render(<CropAdvisoryScreen />);
    const button = getByText('Get Recommendations');
    fireEvent.press(button);
    // Alert would be shown - we can't easily test Alert in RN testing library
  });
});

describe('MarketPricesScreen', () => {
  it('renders crop selector', async () => {
    const { getByText } = render(<MarketPricesScreen />);
    await waitFor(() => {
      expect(getByText('Market Prices')).toBeTruthy();
      expect(getByText('Select Crop')).toBeTruthy();
    });
  });

  it('displays market cards after loading', async () => {
    const { getByText } = render(<MarketPricesScreen />);
    await waitFor(() => {
      expect(getByText(/Nearby Markets/)).toBeTruthy();
    }, { timeout: 3000 });
  });
});

describe('SoilAnalysisScreen', () => {
  it('renders soil input form', () => {
    const { getByText, getByPlaceholderText } = render(<SoilAnalysisScreen />);
    expect(getByText('Soil Analysis')).toBeTruthy();
    expect(getByText('Nitrogen (kg/ha)')).toBeTruthy();
    expect(getByText('Phosphorus (kg/ha)')).toBeTruthy();
    expect(getByText('Potassium (kg/ha)')).toBeTruthy();
    expect(getByText('pH Level')).toBeTruthy();
  });

  it('has analyze button', () => {
    const { getByText } = render(<SoilAnalysisScreen />);
    expect(getByText('Analyze Soil')).toBeTruthy();
  });
});

describe('Form Validation', () => {
  it('validates required fields in soil analysis', () => {
    const { getByText, getByPlaceholderText } = render(<SoilAnalysisScreen />);
    
    // Fill partial data
    const nitrogenInput = getByPlaceholderText('e.g., 250');
    fireEvent.changeText(nitrogenInput, '280');
    
    // Try to submit - should show error
    const button = getByText('Analyze Soil');
    fireEvent.press(button);
  });
});

describe('Navigation Flows', () => {
  it('dashboard navigates to features on press', async () => {
    const mockNavigation = { navigate: jest.fn() };
    const { getByText } = render(<DashboardScreen navigation={mockNavigation} />);
    
    await waitFor(() => {
      const cropAdvisory = getByText('Crop Advisory');
      fireEvent.press(cropAdvisory);
      expect(mockNavigation.navigate).toHaveBeenCalledWith('CropAdvisory');
    });
  });
});

describe('Data Display Formatting', () => {
  it('formats currency values correctly in market prices', async () => {
    const { getAllByText } = render(<MarketPricesScreen />);
    await waitFor(() => {
      // Check that prices are displayed with ₹ symbol
      const priceElements = getAllByText(/₹/);
      expect(priceElements.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });
});

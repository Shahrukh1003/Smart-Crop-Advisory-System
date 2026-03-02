import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Language } from '../../store/authStore';

interface Props {
  navigation: any;
}

const LANGUAGES: { value: Language; label: string; nativeLabel: string }[] = [
  { value: 'kn', label: 'Kannada', nativeLabel: 'ಕನ್ನಡ' },
  { value: 'hi', label: 'Hindi', nativeLabel: 'हिंदी' },
  { value: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்' },
  { value: 'te', label: 'Telugu', nativeLabel: 'తెలుగు' },
  { value: 'en', label: 'English', nativeLabel: 'English' },
];

export const LanguageSelectionScreen: React.FC<Props> = ({ navigation }) => {
  const [selectedLanguage, setSelectedLanguage] = useState<Language | null>(null);

  const handleContinue = () => {
    if (selectedLanguage) {
      navigation.navigate('Register', { language: selectedLanguage });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="leaf" size={64} color="#2E7D32" />
        <Text style={styles.title}>Smart Crop Advisory</Text>
        <Text style={styles.subtitle}>Select your preferred language</Text>
      </View>

      <View style={styles.languageList}>
        {LANGUAGES.map((lang) => (
          <TouchableOpacity
            key={lang.value}
            style={[
              styles.languageItem,
              selectedLanguage === lang.value && styles.languageItemSelected,
            ]}
            onPress={() => setSelectedLanguage(lang.value)}
          >
            <View style={styles.languageText}>
              <Text style={[
                styles.nativeLabel,
                selectedLanguage === lang.value && styles.textSelected,
              ]}>
                {lang.nativeLabel}
              </Text>
              <Text style={[
                styles.englishLabel,
                selectedLanguage === lang.value && styles.textSelectedLight,
              ]}>
                {lang.label}
              </Text>
            </View>
            {selectedLanguage === lang.value && (
              <Ionicons name="checkmark-circle" size={24} color="#2E7D32" />
            )}
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.button, !selectedLanguage && styles.buttonDisabled]}
        onPress={handleContinue}
        disabled={!selectedLanguage}
      >
        <Text style={styles.buttonText}>Continue</Text>
        <Ionicons name="arrow-forward" size={20} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
  languageList: {
    flex: 1,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  languageItemSelected: {
    borderColor: '#2E7D32',
    backgroundColor: '#E8F5E9',
  },
  languageText: {
    flex: 1,
  },
  nativeLabel: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  englishLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  textSelected: {
    color: '#2E7D32',
  },
  textSelectedLight: {
    color: '#4CAF50',
  },
  button: {
    backgroundColor: '#2E7D32',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
  },
  buttonDisabled: {
    backgroundColor: '#9E9E9E',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
});

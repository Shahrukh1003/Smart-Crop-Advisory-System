import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';

interface Props {
  navigation: any;
}

export const AdvisoryScreen: React.FC<Props> = ({ navigation }) => {
  const advisoryOptions = [
    { emoji: '🌾', title: 'Crop Recommendations', desc: 'Get AI-powered crop suggestions', screen: 'CropAdvisory' },
    { emoji: '🐛', title: 'Pest Detection', desc: 'Identify pests and diseases', screen: 'PestDetection' },
    { emoji: '🧪', title: 'Soil Analysis', desc: 'Analyze your soil health', screen: 'SoilAnalysis' },
    { emoji: '📅', title: 'Crop History', desc: 'View your farming records', screen: 'CropHistory' },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerEmoji}>🌱</Text>
        <Text style={styles.title}>Crop Advisory</Text>
        <Text style={styles.subtitle}>Get personalized farming guidance</Text>
      </View>

      <View style={styles.optionsContainer}>
        {advisoryOptions.map((option, index) => (
          <TouchableOpacity
            key={index}
            style={styles.optionCard}
            onPress={() => navigation.navigate(option.screen)}
          >
            <Text style={styles.optionEmoji}>{option.emoji}</Text>
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>{option.title}</Text>
              <Text style={styles.optionDesc}>{option.desc}</Text>
            </View>
            <Text style={styles.arrow}>→</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.tipCard}>
        <Text style={styles.tipEmoji}>💡</Text>
        <Text style={styles.tipTitle}>Tip of the Day</Text>
        <Text style={styles.tipText}>
          Regular soil testing helps optimize fertilizer use and improve crop yields. 
          Test your soil at least once every season.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { alignItems: 'center', padding: 24, backgroundColor: '#2E7D32' },
  headerEmoji: { fontSize: 48, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 14, color: '#E8F5E9', marginTop: 4 },
  optionsContainer: { padding: 16 },
  optionCard: {
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
  optionEmoji: { fontSize: 32, marginRight: 16 },
  optionText: { flex: 1 },
  optionTitle: { fontSize: 16, fontWeight: '600', color: '#333' },
  optionDesc: { fontSize: 13, color: '#666', marginTop: 2 },
  arrow: { fontSize: 20, color: '#2E7D32' },
  tipCard: {
    backgroundColor: '#FFF8E1',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
  },
  tipEmoji: { fontSize: 24, marginBottom: 8 },
  tipTitle: { fontSize: 16, fontWeight: '600', color: '#F57C00', marginBottom: 8 },
  tipText: { fontSize: 14, color: '#666', lineHeight: 20 },
});

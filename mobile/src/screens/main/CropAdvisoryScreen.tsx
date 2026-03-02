import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

interface CropRecommendation {
  cropName: string;
  variety: string;
  suitabilityScore: number;
  expectedYield: number;
  estimatedInputCost: number;
  estimatedRevenue: number;
  reasoning: string[];
  risks: string[];
}

const SOIL_TYPES = ['Red Soil', 'Black Soil', 'Alluvial Soil', 'Laterite Soil', 'Sandy Soil', 'Clay Soil'];
const SEASONS = [
  { value: 'kharif', label: 'Kharif (Monsoon)' },
  { value: 'rabi', label: 'Rabi (Winter)' },
  { value: 'zaid', label: 'Zaid (Summer)' },
];

export const CropAdvisoryScreen: React.FC = () => {
  const { user } = useAuthStore();
  const [soilType, setSoilType] = useState('');
  const [soilPH, setSoilPH] = useState('');
  const [nitrogen, setNitrogen] = useState('');
  const [phosphorus, setPhosphorus] = useState('');
  const [potassium, setPotassium] = useState('');
  const [season, setSeason] = useState('kharif');
  const [preferences, setPreferences] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<CropRecommendation[]>([]);
  const [showResults, setShowResults] = useState(false);

  const handleGetRecommendations = async () => {
    if (!soilType) {
      Alert.alert('Error', 'Please select soil type');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post('/advisory/crop-recommendations', {
        location: {
          latitude: user?.location?.latitude || 12.9716,
          longitude: user?.location?.longitude || 77.5946,
        },
        soilData: {
          type: soilType,
          pH: soilPH ? parseFloat(soilPH) : undefined,
          nitrogen: nitrogen ? parseFloat(nitrogen) : undefined,
          phosphorus: phosphorus ? parseFloat(phosphorus) : undefined,
          potassium: potassium ? parseFloat(potassium) : undefined,
        },
        season,
        preferences: preferences ? preferences.split(',').map(p => p.trim()) : [],
      });

      setRecommendations(response.data.recommendations || []);
      setShowResults(true);
    } catch (error: any) {
      // Use mock data for demo
      setRecommendations([
        {
          cropName: 'Rice',
          variety: 'Basmati',
          suitabilityScore: 92,
          expectedYield: 45,
          estimatedInputCost: 25000,
          estimatedRevenue: 67500,
          reasoning: ['Suitable soil pH', 'Good monsoon expected', 'High market demand'],
          risks: ['Pest outbreak risk in late season'],
        },
        {
          cropName: 'Maize',
          variety: 'Hybrid',
          suitabilityScore: 85,
          expectedYield: 55,
          estimatedInputCost: 18000,
          estimatedRevenue: 44000,
          reasoning: ['Good drainage', 'Moderate water requirement'],
          risks: ['Price volatility'],
        },
        {
          cropName: 'Groundnut',
          variety: 'TMV-2',
          suitabilityScore: 78,
          expectedYield: 20,
          estimatedInputCost: 22000,
          estimatedRevenue: 48000,
          reasoning: ['Nitrogen fixing crop', 'Good for soil health'],
          risks: ['Sensitive to waterlogging'],
        },
      ]);
      setShowResults(true);
    } finally {
      setIsLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#4CAF50';
    if (score >= 60) return '#FF9800';
    return '#F44336';
  };

  if (showResults) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.resultsHeader}>
          <TouchableOpacity onPress={() => setShowResults(false)} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#2E7D32" />
          </TouchableOpacity>
          <Text style={styles.resultsTitle}>Recommended Crops</Text>
        </View>

        {recommendations.map((crop, index) => (
          <View key={index} style={styles.cropCard}>
            <View style={styles.cropHeader}>
              <View>
                <Text style={styles.cropName}>{crop.cropName}</Text>
                <Text style={styles.cropVariety}>{crop.variety}</Text>
              </View>
              <View style={[styles.scoreBadge, { backgroundColor: getScoreColor(crop.suitabilityScore) }]}>
                <Text style={styles.scoreText}>{crop.suitabilityScore}%</Text>
              </View>
            </View>

            <View style={styles.cropStats}>
              <View style={styles.statItem}>
                <Ionicons name="leaf" size={16} color="#4CAF50" />
                <Text style={styles.statLabel}>Expected Yield</Text>
                <Text style={styles.statValue}>{crop.expectedYield} q/acre</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="cash" size={16} color="#FF9800" />
                <Text style={styles.statLabel}>Input Cost</Text>
                <Text style={styles.statValue}>₹{crop.estimatedInputCost.toLocaleString()}</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="trending-up" size={16} color="#2196F3" />
                <Text style={styles.statLabel}>Est. Revenue</Text>
                <Text style={styles.statValue}>₹{crop.estimatedRevenue.toLocaleString()}</Text>
              </View>
            </View>

            <View style={styles.reasoningSection}>
              <Text style={styles.sectionLabel}>Why this crop?</Text>
              {crop.reasoning.map((reason, i) => (
                <View key={i} style={styles.reasonItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                  <Text style={styles.reasonText}>{reason}</Text>
                </View>
              ))}
            </View>

            {crop.risks.length > 0 && (
              <View style={styles.risksSection}>
                <Text style={styles.sectionLabel}>Risks to consider</Text>
                {crop.risks.map((risk, i) => (
                  <View key={i} style={styles.riskItem}>
                    <Ionicons name="warning" size={16} color="#FF9800" />
                    <Text style={styles.riskText}>{risk}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Get Crop Recommendations</Text>
      <Text style={styles.subtitle}>Enter your soil and land details</Text>

      <View style={styles.form}>
        <Text style={styles.label}>Soil Type *</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={soilType}
            onValueChange={setSoilType}
            style={styles.picker}
          >
            <Picker.Item label="Select soil type" value="" />
            {SOIL_TYPES.map((type) => (
              <Picker.Item key={type} label={type} value={type} />
            ))}
          </Picker>
        </View>

        <Text style={styles.label}>Season *</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={season}
            onValueChange={setSeason}
            style={styles.picker}
          >
            {SEASONS.map((s) => (
              <Picker.Item key={s.value} label={s.label} value={s.value} />
            ))}
          </Picker>
        </View>

        <Text style={styles.sectionHeader}>Soil Test Results (Optional)</Text>

        <View style={styles.row}>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Soil pH</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 6.5"
              keyboardType="decimal-pad"
              value={soilPH}
              onChangeText={setSoilPH}
            />
          </View>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Nitrogen (kg/ha)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 280"
              keyboardType="decimal-pad"
              value={nitrogen}
              onChangeText={setNitrogen}
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Phosphorus (kg/ha)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 25"
              keyboardType="decimal-pad"
              value={phosphorus}
              onChangeText={setPhosphorus}
            />
          </View>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Potassium (kg/ha)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 180"
              keyboardType="decimal-pad"
              value={potassium}
              onChangeText={setPotassium}
            />
          </View>
        </View>

        <Text style={styles.label}>Crop Preferences (comma separated)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., Rice, Wheat, Maize"
          value={preferences}
          onChangeText={setPreferences}
        />

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleGetRecommendations}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="leaf" size={20} color="#fff" />
              <Text style={styles.buttonText}>Get Recommendations</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#2E7D32', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 20 },
  form: { backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  label: { fontSize: 14, fontWeight: '500', color: '#333', marginBottom: 8 },
  sectionHeader: { fontSize: 16, fontWeight: '600', color: '#2E7D32', marginTop: 16, marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 16, backgroundColor: '#fafafa' },
  pickerContainer: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, marginBottom: 16, backgroundColor: '#fafafa', overflow: 'hidden' },
  picker: { height: 50 },
  row: { flexDirection: 'row', marginHorizontal: -8 },
  halfInput: { flex: 1, paddingHorizontal: 8 },
  button: { backgroundColor: '#2E7D32', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12, marginTop: 8 },
  buttonDisabled: { backgroundColor: '#9E9E9E' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 },
  resultsHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff' },
  backButton: { marginRight: 16 },
  resultsTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  cropCard: { backgroundColor: '#fff', margin: 16, marginTop: 8, borderRadius: 12, padding: 16 },
  cropHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  cropName: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  cropVariety: { fontSize: 14, color: '#666' },
  scoreBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  scoreText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  cropStats: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  statItem: { alignItems: 'center', flex: 1 },
  statLabel: { fontSize: 11, color: '#666', marginTop: 4 },
  statValue: { fontSize: 14, fontWeight: '600', color: '#333', marginTop: 2 },
  reasoningSection: { marginBottom: 12 },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 },
  reasonItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  reasonText: { fontSize: 13, color: '#666', marginLeft: 8, flex: 1 },
  risksSection: { backgroundColor: '#FFF3E0', padding: 12, borderRadius: 8 },
  riskItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  riskText: { fontSize: 13, color: '#E65100', marginLeft: 8, flex: 1 },
});

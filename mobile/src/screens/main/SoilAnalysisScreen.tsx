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
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

interface NutrientAnalysis {
  nutrient: string;
  value: number;
  unit: string;
  status: 'deficient' | 'optimal' | 'excess';
  optimalRange: string;
}

interface FertilizerRecommendation {
  name: string;
  quantity: number;
  unit: string;
  timing: string;
  method: string;
  cost: number;
}

export const SoilAnalysisScreen: React.FC = () => {
  const { user } = useAuthStore();
  const [nitrogen, setNitrogen] = useState('');
  const [phosphorus, setPhosphorus] = useState('');
  const [potassium, setPotassium] = useState('');
  const [ph, setPh] = useState('');
  const [organicMatter, setOrganicMatter] = useState('');
  const [landArea, setLandArea] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [analysis, setAnalysis] = useState<NutrientAnalysis[]>([]);
  const [recommendations, setRecommendations] = useState<FertilizerRecommendation[]>([]);
  const [totalCost, setTotalCost] = useState(0);

  const handleAnalyze = async () => {
    if (!nitrogen || !phosphorus || !potassium || !ph) {
      Alert.alert('Error', 'Please enter all required soil test values');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post('/advisory/soil-analysis', {
        soilData: {
          nitrogen: parseFloat(nitrogen),
          phosphorus: parseFloat(phosphorus),
          potassium: parseFloat(potassium),
          pH: parseFloat(ph),
          organicMatter: organicMatter ? parseFloat(organicMatter) : undefined,
        },
        landArea: landArea ? parseFloat(landArea) : 1,
      });
      setAnalysis(response.data.analysis || []);
      setRecommendations(response.data.recommendations || []);
      setTotalCost(response.data.totalCost || 0);
      setShowResults(true);
    } catch (error) {
      // Mock data for demo
      setAnalysis([
        { nutrient: 'Nitrogen (N)', value: parseFloat(nitrogen), unit: 'kg/ha', status: parseFloat(nitrogen) < 280 ? 'deficient' : 'optimal', optimalRange: '280-350 kg/ha' },
        { nutrient: 'Phosphorus (P)', value: parseFloat(phosphorus), unit: 'kg/ha', status: parseFloat(phosphorus) < 25 ? 'deficient' : 'optimal', optimalRange: '25-35 kg/ha' },
        { nutrient: 'Potassium (K)', value: parseFloat(potassium), unit: 'kg/ha', status: parseFloat(potassium) < 180 ? 'deficient' : 'optimal', optimalRange: '180-250 kg/ha' },
        { nutrient: 'pH Level', value: parseFloat(ph), unit: '', status: parseFloat(ph) >= 6 && parseFloat(ph) <= 7.5 ? 'optimal' : 'deficient', optimalRange: '6.0-7.5' },
      ]);
      setRecommendations([
        { name: 'Urea (46% N)', quantity: 50, unit: 'kg', timing: 'Apply in 2 splits - at sowing and 30 days after', method: 'Broadcasting followed by irrigation', cost: 450 },
        { name: 'DAP (18-46-0)', quantity: 25, unit: 'kg', timing: 'Apply at sowing time', method: 'Band placement near seed rows', cost: 625 },
        { name: 'MOP (60% K2O)', quantity: 20, unit: 'kg', timing: 'Apply at sowing time', method: 'Broadcasting and incorporation', cost: 340 },
      ]);
      setTotalCost(1415);
      setShowResults(true);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'deficient': return '#F44336';
      case 'excess': return '#FF9800';
      default: return '#4CAF50';
    }
  };

  const getStatusIcon = (status: string): keyof typeof Ionicons.glyphMap => {
    switch (status) {
      case 'deficient': return 'arrow-down-circle';
      case 'excess': return 'arrow-up-circle';
      default: return 'checkmark-circle';
    }
  };

  if (showResults) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.resultsHeader}>
          <TouchableOpacity onPress={() => setShowResults(false)} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#2E7D32" />
          </TouchableOpacity>
          <Text style={styles.resultsTitle}>Soil Analysis Results</Text>
        </View>

        {/* Nutrient Analysis */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nutrient Analysis</Text>
          {analysis.map((item, index) => (
            <View key={index} style={styles.nutrientCard}>
              <View style={styles.nutrientHeader}>
                <Text style={styles.nutrientName}>{item.nutrient}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                  <Ionicons name={getStatusIcon(item.status)} size={16} color={getStatusColor(item.status)} />
                  <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                    {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                  </Text>
                </View>
              </View>
              <View style={styles.nutrientValues}>
                <View style={styles.valueItem}>
                  <Text style={styles.valueLabel}>Your Value</Text>
                  <Text style={styles.valueNumber}>{item.value} {item.unit}</Text>
                </View>
                <View style={styles.valueItem}>
                  <Text style={styles.valueLabel}>Optimal Range</Text>
                  <Text style={styles.valueNumber}>{item.optimalRange}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Fertilizer Recommendations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fertilizer Recommendations</Text>
          <Text style={styles.areaNote}>For {landArea || 1} acre(s)</Text>
          
          {recommendations.map((rec, index) => (
            <View key={index} style={styles.fertilizerCard}>
              <View style={styles.fertilizerHeader}>
                <Text style={styles.fertilizerName}>{rec.name}</Text>
                <Text style={styles.fertilizerCost}>₹{rec.cost}</Text>
              </View>
              <View style={styles.fertilizerQuantity}>
                <Ionicons name="cube" size={16} color="#2E7D32" />
                <Text style={styles.quantityText}>{rec.quantity} {rec.unit}</Text>
              </View>
              <View style={styles.fertilizerDetail}>
                <Ionicons name="time" size={14} color="#666" />
                <Text style={styles.detailText}>{rec.timing}</Text>
              </View>
              <View style={styles.fertilizerDetail}>
                <Ionicons name="hand-left" size={14} color="#666" />
                <Text style={styles.detailText}>{rec.method}</Text>
              </View>
            </View>
          ))}

          <View style={styles.totalCostCard}>
            <Text style={styles.totalCostLabel}>Estimated Total Cost</Text>
            <Text style={styles.totalCostValue}>₹{totalCost.toLocaleString()}</Text>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Soil Analysis</Text>
      <Text style={styles.subtitle}>Enter your soil test results</Text>

      <View style={styles.form}>
        <Text style={styles.sectionHeader}>Soil Test Results *</Text>

        <View style={styles.row}>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Nitrogen (kg/ha)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 250"
              keyboardType="decimal-pad"
              value={nitrogen}
              onChangeText={setNitrogen}
            />
          </View>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Phosphorus (kg/ha)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 20"
              keyboardType="decimal-pad"
              value={phosphorus}
              onChangeText={setPhosphorus}
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Potassium (kg/ha)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 150"
              keyboardType="decimal-pad"
              value={potassium}
              onChangeText={setPotassium}
            />
          </View>
          <View style={styles.halfInput}>
            <Text style={styles.label}>pH Level</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 6.5"
              keyboardType="decimal-pad"
              value={ph}
              onChangeText={setPh}
            />
          </View>
        </View>

        <Text style={styles.label}>Organic Matter (%)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., 2.5 (optional)"
          keyboardType="decimal-pad"
          value={organicMatter}
          onChangeText={setOrganicMatter}
        />

        <Text style={styles.sectionHeader}>Land Details</Text>

        <Text style={styles.label}>Land Area (acres)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., 2.5"
          keyboardType="decimal-pad"
          value={landArea}
          onChangeText={setLandArea}
        />

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleAnalyze}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="flask" size={20} color="#fff" />
              <Text style={styles.buttonText}>Analyze Soil</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.infoCard}>
        <Ionicons name="information-circle" size={24} color="#2196F3" />
        <Text style={styles.infoText}>
          Get your soil tested at the nearest Krishi Vigyan Kendra (KVK) or agricultural university for accurate results.
        </Text>
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
  sectionHeader: { fontSize: 16, fontWeight: '600', color: '#2E7D32', marginBottom: 12, marginTop: 8 },
  label: { fontSize: 14, fontWeight: '500', color: '#333', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 16, backgroundColor: '#fafafa' },
  row: { flexDirection: 'row', marginHorizontal: -8 },
  halfInput: { flex: 1, paddingHorizontal: 8 },
  button: { backgroundColor: '#2E7D32', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12, marginTop: 8 },
  buttonDisabled: { backgroundColor: '#9E9E9E' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 },
  infoCard: { flexDirection: 'row', backgroundColor: '#E3F2FD', padding: 16, borderRadius: 12, marginTop: 16, alignItems: 'center' },
  infoText: { flex: 1, marginLeft: 12, fontSize: 13, color: '#1565C0' },
  resultsHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff' },
  backButton: { marginRight: 16 },
  resultsTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  section: { padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 12 },
  areaNote: { fontSize: 12, color: '#666', marginBottom: 12 },
  nutrientCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 },
  nutrientHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  nutrientName: { fontSize: 16, fontWeight: '600', color: '#333' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: '600', marginLeft: 4 },
  nutrientValues: { flexDirection: 'row' },
  valueItem: { flex: 1 },
  valueLabel: { fontSize: 12, color: '#666' },
  valueNumber: { fontSize: 14, fontWeight: '600', color: '#333', marginTop: 4 },
  fertilizerCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 },
  fertilizerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  fertilizerName: { fontSize: 16, fontWeight: '600', color: '#333' },
  fertilizerCost: { fontSize: 16, fontWeight: 'bold', color: '#2E7D32' },
  fertilizerQuantity: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  quantityText: { fontSize: 14, fontWeight: '600', color: '#2E7D32', marginLeft: 8 },
  fertilizerDetail: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  detailText: { fontSize: 13, color: '#666', marginLeft: 8, flex: 1 },
  totalCostCard: { backgroundColor: '#E8F5E9', borderRadius: 12, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalCostLabel: { fontSize: 16, fontWeight: '600', color: '#2E7D32' },
  totalCostValue: { fontSize: 24, fontWeight: 'bold', color: '#2E7D32' },
});

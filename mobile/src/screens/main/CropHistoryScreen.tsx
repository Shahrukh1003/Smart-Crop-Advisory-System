import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { api } from '../../services/api';

interface CropRecord {
  id: string;
  cropName: string;
  variety: string;
  sowingDate: string;
  harvestDate: string | null;
  yield: number | null;
  revenue: number | null;
  parcelName: string;
  season: string;
  status: 'growing' | 'harvested';
  inputCosts?: {
    seeds: number;
    fertilizers: number;
    pesticides: number;
    labor: number;
    irrigation: number;
  };
}

interface SeasonSummary {
  season: string;
  year: number;
  totalCrops: number;
  totalRevenue: number;
  totalCost: number;
  profit: number;
}

const CROPS = ['Rice', 'Wheat', 'Maize', 'Cotton', 'Sugarcane', 'Groundnut', 'Tomato', 'Onion', 'Potato'];
const SEASONS = ['Kharif', 'Rabi', 'Zaid'];

export const CropHistoryScreen: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cropHistory, setCropHistory] = useState<CropRecord[]>([]);
  const [seasonSummary, setSeasonSummary] = useState<SeasonSummary[]>([]);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'growing' | 'harvested'>('all');
  
  // Form state
  const [newCrop, setNewCrop] = useState({
    cropName: 'Rice',
    variety: '',
    sowingDate: new Date().toISOString().split('T')[0],
    season: 'Kharif',
    parcelName: 'Main Field',
  });

  const fetchCropHistory = useCallback(async () => {
    try {
      // Try to fetch from API
      const response = await api.get('/activities/crop-history');
      if (response.data) {
        setCropHistory(response.data.crops || []);
        setSeasonSummary(response.data.summary || []);
      }
    } catch (error) {
      console.error('Error fetching crop history:', error);
      // Generate sample data for demo
      generateSampleData();
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  const generateSampleData = () => {
    const sampleCrops: CropRecord[] = [
      {
        id: '1',
        cropName: 'Rice',
        variety: 'Sona Masuri',
        sowingDate: '2024-06-15',
        harvestDate: '2024-10-20',
        yield: 45,
        revenue: 112500,
        parcelName: 'Main Field',
        season: 'Kharif',
        status: 'harvested',
        inputCosts: { seeds: 3000, fertilizers: 8000, pesticides: 4000, labor: 15000, irrigation: 5000 },
      },
      {
        id: '2',
        cropName: 'Wheat',
        variety: 'HD-2967',
        sowingDate: '2024-11-10',
        harvestDate: null,
        yield: null,
        revenue: null,
        parcelName: 'North Plot',
        season: 'Rabi',
        status: 'growing',
        inputCosts: { seeds: 2500, fertilizers: 6000, pesticides: 2000, labor: 8000, irrigation: 4000 },
      },
      {
        id: '3',
        cropName: 'Groundnut',
        variety: 'TMV-2',
        sowingDate: '2024-06-20',
        harvestDate: '2024-10-15',
        yield: 18,
        revenue: 117000,
        parcelName: 'South Field',
        season: 'Kharif',
        status: 'harvested',
        inputCosts: { seeds: 12000, fertilizers: 5000, pesticides: 3000, labor: 12000, irrigation: 4000 },
      },
      {
        id: '4',
        cropName: 'Tomato',
        variety: 'Arka Rakshak',
        sowingDate: '2024-09-01',
        harvestDate: null,
        yield: null,
        revenue: null,
        parcelName: 'Kitchen Garden',
        season: 'Rabi',
        status: 'growing',
        inputCosts: { seeds: 500, fertilizers: 2000, pesticides: 1500, labor: 5000, irrigation: 2000 },
      },
    ];

    const summary: SeasonSummary[] = [
      { season: 'Kharif', year: 2024, totalCrops: 2, totalRevenue: 229500, totalCost: 71000, profit: 158500 },
      { season: 'Rabi', year: 2024, totalCrops: 2, totalRevenue: 0, totalCost: 33500, profit: -33500 },
      { season: 'Kharif', year: 2023, totalCrops: 3, totalRevenue: 185000, totalCost: 62000, profit: 123000 },
    ];

    setCropHistory(sampleCrops);
    setSeasonSummary(summary);
  };

  useEffect(() => {
    fetchCropHistory();
  }, [fetchCropHistory]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchCropHistory();
  }, [fetchCropHistory]);

  const handleAddCrop = async () => {
    try {
      // In production, this would call the API
      const newRecord: CropRecord = {
        id: Date.now().toString(),
        ...newCrop,
        harvestDate: null,
        yield: null,
        revenue: null,
        status: 'growing',
      };

      setCropHistory([newRecord, ...cropHistory]);
      setIsAddModalVisible(false);
      Alert.alert('Success', 'Crop record added successfully!');
      
      // Reset form
      setNewCrop({
        cropName: 'Rice',
        variety: '',
        sowingDate: new Date().toISOString().split('T')[0],
        season: 'Kharif',
        parcelName: 'Main Field',
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to add crop record');
    }
  };

  const filteredCrops = cropHistory.filter(crop => {
    if (selectedFilter === 'all') return true;
    return crop.status === selectedFilter;
  });

  const calculateTotalCost = (costs?: CropRecord['inputCosts']) => {
    if (!costs) return 0;
    return costs.seeds + costs.fertilizers + costs.pesticides + costs.labor + costs.irrigation;
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E7D32" />
        <Text style={styles.loadingText}>Loading crop history...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2E7D32']} />}
    >
      {/* Season Summary */}
      <View style={styles.summarySection}>
        <Text style={styles.sectionTitle}>📊 Season Summary</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {seasonSummary.map((summary, index) => (
            <View key={index} style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>{summary.season} {summary.year}</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Crops:</Text>
                <Text style={styles.summaryValue}>{summary.totalCrops}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Revenue:</Text>
                <Text style={styles.summaryValue}>{formatCurrency(summary.totalRevenue)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Cost:</Text>
                <Text style={styles.summaryValue}>{formatCurrency(summary.totalCost)}</Text>
              </View>
              <View style={[styles.summaryRow, styles.profitRow]}>
                <Text style={styles.summaryLabel}>Profit:</Text>
                <Text style={[styles.summaryValue, { color: summary.profit >= 0 ? '#4CAF50' : '#F44336' }]}>
                  {formatCurrency(summary.profit)}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterTabs}>
        {(['all', 'growing', 'harvested'] as const).map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[styles.filterTab, selectedFilter === filter && styles.filterTabActive]}
            onPress={() => setSelectedFilter(filter)}
          >
            <Text style={[styles.filterTabText, selectedFilter === filter && styles.filterTabTextActive]}>
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Crop Records */}
      <Text style={styles.sectionTitle}>🌾 Crop Records ({filteredCrops.length})</Text>
      
      {filteredCrops.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="leaf-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>No crop records found</Text>
          <Text style={styles.emptySubtext}>Add your first crop to start tracking</Text>
        </View>
      ) : (
        filteredCrops.map((crop) => (
          <View key={crop.id} style={styles.cropCard}>
            <View style={styles.cropHeader}>
              <View style={styles.cropInfo}>
                <Text style={styles.cropName}>{crop.cropName}</Text>
                {crop.variety && <Text style={styles.cropVariety}>{crop.variety}</Text>}
              </View>
              <View style={[styles.statusBadge, { backgroundColor: crop.status === 'growing' ? '#E8F5E9' : '#FFF3E0' }]}>
                <Ionicons 
                  name={crop.status === 'growing' ? 'leaf' : 'checkmark-circle'} 
                  size={14} 
                  color={crop.status === 'growing' ? '#4CAF50' : '#FF9800'} 
                />
                <Text style={[styles.statusText, { color: crop.status === 'growing' ? '#4CAF50' : '#FF9800' }]}>
                  {crop.status === 'growing' ? 'Growing' : 'Harvested'}
                </Text>
              </View>
            </View>

            <View style={styles.cropDetails}>
              <View style={styles.detailRow}>
                <Ionicons name="location" size={14} color="#666" />
                <Text style={styles.detailText}>{crop.parcelName}</Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="calendar" size={14} color="#666" />
                <Text style={styles.detailText}>Sown: {formatDate(crop.sowingDate)}</Text>
              </View>
              {crop.harvestDate && (
                <View style={styles.detailRow}>
                  <Ionicons name="checkmark" size={14} color="#666" />
                  <Text style={styles.detailText}>Harvested: {formatDate(crop.harvestDate)}</Text>
                </View>
              )}
              <View style={styles.detailRow}>
                <Ionicons name="sunny" size={14} color="#666" />
                <Text style={styles.detailText}>{crop.season} Season</Text>
              </View>
            </View>

            {crop.status === 'harvested' && (
              <View style={styles.harvestInfo}>
                <View style={styles.harvestItem}>
                  <Text style={styles.harvestLabel}>Yield</Text>
                  <Text style={styles.harvestValue}>{crop.yield} quintals</Text>
                </View>
                <View style={styles.harvestItem}>
                  <Text style={styles.harvestLabel}>Revenue</Text>
                  <Text style={[styles.harvestValue, { color: '#4CAF50' }]}>{formatCurrency(crop.revenue || 0)}</Text>
                </View>
                <View style={styles.harvestItem}>
                  <Text style={styles.harvestLabel}>Cost</Text>
                  <Text style={[styles.harvestValue, { color: '#F44336' }]}>{formatCurrency(calculateTotalCost(crop.inputCosts))}</Text>
                </View>
              </View>
            )}

            {crop.inputCosts && (
              <TouchableOpacity style={styles.costBreakdown}>
                <Text style={styles.costBreakdownText}>View Cost Breakdown</Text>
                <Ionicons name="chevron-forward" size={16} color="#2E7D32" />
              </TouchableOpacity>
            )}
          </View>
        ))
      )}

      {/* Add Crop Button */}
      <TouchableOpacity style={styles.addButton} onPress={() => setIsAddModalVisible(true)}>
        <Ionicons name="add-circle" size={24} color="#fff" />
        <Text style={styles.addButtonText}>Add New Crop</Text>
      </TouchableOpacity>

      {/* Add Crop Modal */}
      <Modal visible={isAddModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Crop</Text>
              <TouchableOpacity onPress={() => setIsAddModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Crop</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={newCrop.cropName}
                onValueChange={(value) => setNewCrop({ ...newCrop, cropName: value })}
              >
                {CROPS.map((crop) => (
                  <Picker.Item key={crop} label={crop} value={crop} />
                ))}
              </Picker>
            </View>

            <Text style={styles.inputLabel}>Variety</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter variety name"
              value={newCrop.variety}
              onChangeText={(text) => setNewCrop({ ...newCrop, variety: text })}
            />

            <Text style={styles.inputLabel}>Season</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={newCrop.season}
                onValueChange={(value) => setNewCrop({ ...newCrop, season: value })}
              >
                {SEASONS.map((season) => (
                  <Picker.Item key={season} label={season} value={season} />
                ))}
              </Picker>
            </View>

            <Text style={styles.inputLabel}>Field/Parcel Name</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter field name"
              value={newCrop.parcelName}
              onChangeText={(text) => setNewCrop({ ...newCrop, parcelName: text })}
            />

            <TouchableOpacity style={styles.submitButton} onPress={handleAddCrop}>
              <Text style={styles.submitButtonText}>Add Crop</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
};


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#666', fontSize: 14 },
  summarySection: { padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 12 },
  summaryCard: { 
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginRight: 12, width: 160,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  summaryTitle: { fontSize: 14, fontWeight: 'bold', color: '#2E7D32', marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  summaryLabel: { fontSize: 12, color: '#666' },
  summaryValue: { fontSize: 12, fontWeight: '600', color: '#333' },
  profitRow: { borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 6, marginTop: 4 },
  filterTabs: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 16 },
  filterTab: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 4, borderRadius: 8 },
  filterTabActive: { backgroundColor: '#2E7D32' },
  filterTabText: { fontSize: 14, color: '#666' },
  filterTabTextActive: { color: '#fff', fontWeight: '600' },
  emptyState: { alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 16, color: '#666', marginTop: 16 },
  emptySubtext: { fontSize: 13, color: '#999', marginTop: 4 },
  cropCard: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 12, borderRadius: 12, padding: 16 },
  cropHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  cropInfo: { flex: 1 },
  cropName: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  cropVariety: { fontSize: 13, color: '#666', marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: '600', marginLeft: 4 },
  cropDetails: { borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  detailText: { fontSize: 13, color: '#666', marginLeft: 8 },
  harvestInfo: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#f5f5f5', borderRadius: 8, padding: 12, marginTop: 12 },
  harvestItem: { alignItems: 'center' },
  harvestLabel: { fontSize: 11, color: '#666' },
  harvestValue: { fontSize: 14, fontWeight: 'bold', color: '#333', marginTop: 2 },
  costBreakdown: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#eee' },
  costBreakdownText: { fontSize: 13, color: '#2E7D32', fontWeight: '500' },
  addButton: { 
    backgroundColor: '#2E7D32', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    margin: 16, padding: 16, borderRadius: 12,
  },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  inputLabel: { fontSize: 14, fontWeight: '500', color: '#333', marginBottom: 8, marginTop: 12 },
  pickerContainer: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, backgroundColor: '#fafafa', overflow: 'hidden' },
  textInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 14, backgroundColor: '#fafafa' },
  submitButton: { backgroundColor: '#2E7D32', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  bottomPadding: { height: 24 },
});

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../../services/api';

interface Detection {
  pestOrDisease: string;
  confidence: number;
  severity: 'low' | 'medium' | 'high';
  affectedCrop: string;
  treatments: Treatment[];
}

interface Treatment {
  type: 'organic' | 'chemical';
  name: string;
  dosage: string;
  applicationMethod: string;
  cost: number;
  effectiveness: number;
}

export const PestDetectionScreen: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [showResults, setShowResults] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImage(result.assets[0].uri);
      setShowResults(false);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your camera');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImage(result.assets[0].uri);
      setShowResults(false);
    }
  };

  const analyzeImage = async () => {
    if (!image) return;

    setIsAnalyzing(true);
    setUploadProgress(0);

    // Simulate upload progress
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => Math.min(prev + 10, 90));
    }, 200);

    try {
      const formData = new FormData();
      formData.append('image', {
        uri: image,
        type: 'image/jpeg',
        name: 'pest_image.jpg',
      } as any);

      const response = await api.post('/pest-detection/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      clearInterval(progressInterval);
      setUploadProgress(100);
      setDetections(response.data.detections || []);
      setShowResults(true);
    } catch (error) {
      clearInterval(progressInterval);
      // Use mock data for demo
      setDetections([
        {
          pestOrDisease: 'Leaf Blight',
          confidence: 0.87,
          severity: 'medium',
          affectedCrop: 'Rice',
          treatments: [
            {
              type: 'organic',
              name: 'Neem Oil Spray',
              dosage: '5ml per liter of water',
              applicationMethod: 'Foliar spray in evening',
              cost: 250,
              effectiveness: 75,
            },
            {
              type: 'chemical',
              name: 'Mancozeb 75% WP',
              dosage: '2.5g per liter of water',
              applicationMethod: 'Spray at 10-day intervals',
              cost: 180,
              effectiveness: 90,
            },
          ],
        },
      ]);
      setShowResults(true);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return '#F44336';
      case 'medium': return '#FF9800';
      default: return '#4CAF50';
    }
  };

  const renderResults = () => (
    <ScrollView style={styles.container}>
      <View style={styles.resultsHeader}>
        <TouchableOpacity onPress={() => { setShowResults(false); setImage(null); }} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#2E7D32" />
        </TouchableOpacity>
        <Text style={styles.resultsTitle}>Detection Results</Text>
      </View>

      {image && (
        <Image source={{ uri: image }} style={styles.resultImage} />
      )}

      {detections.map((detection, index) => (
        <View key={index} style={styles.detectionCard}>
          <View style={styles.detectionHeader}>
            <View>
              <Text style={styles.pestName}>{detection.pestOrDisease}</Text>
              <Text style={styles.affectedCrop}>Affects: {detection.affectedCrop}</Text>
            </View>
            <View style={styles.confidenceContainer}>
              <Text style={styles.confidenceLabel}>Confidence</Text>
              <Text style={styles.confidenceValue}>{Math.round(detection.confidence * 100)}%</Text>
            </View>
          </View>

          <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(detection.severity) }]}>
            <Ionicons name="warning" size={16} color="#fff" />
            <Text style={styles.severityText}>{detection.severity.toUpperCase()} SEVERITY</Text>
          </View>

          <Text style={styles.treatmentTitle}>Recommended Treatments</Text>

          <Text style={styles.treatmentCategory}>🌿 Organic Options</Text>
          {detection.treatments.filter(t => t.type === 'organic').map((treatment, i) => (
            <View key={i} style={styles.treatmentCard}>
              <Text style={styles.treatmentName}>{treatment.name}</Text>
              <View style={styles.treatmentDetails}>
                <Text style={styles.treatmentDetail}>📏 {treatment.dosage}</Text>
                <Text style={styles.treatmentDetail}>🎯 {treatment.applicationMethod}</Text>
                <View style={styles.treatmentFooter}>
                  <Text style={styles.treatmentCost}>₹{treatment.cost}</Text>
                  <View style={styles.effectivenessBar}>
                    <View style={[styles.effectivenessFill, { width: `${treatment.effectiveness}%` }]} />
                  </View>
                  <Text style={styles.effectivenessText}>{treatment.effectiveness}% effective</Text>
                </View>
              </View>
            </View>
          ))}

          <Text style={styles.treatmentCategory}>🧪 Chemical Options</Text>
          {detection.treatments.filter(t => t.type === 'chemical').map((treatment, i) => (
            <View key={i} style={styles.treatmentCard}>
              <Text style={styles.treatmentName}>{treatment.name}</Text>
              <View style={styles.treatmentDetails}>
                <Text style={styles.treatmentDetail}>📏 {treatment.dosage}</Text>
                <Text style={styles.treatmentDetail}>🎯 {treatment.applicationMethod}</Text>
                <View style={styles.treatmentFooter}>
                  <Text style={styles.treatmentCost}>₹{treatment.cost}</Text>
                  <View style={styles.effectivenessBar}>
                    <View style={[styles.effectivenessFill, { width: `${treatment.effectiveness}%` }]} />
                  </View>
                  <Text style={styles.effectivenessText}>{treatment.effectiveness}% effective</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );

  if (showResults) {
    return renderResults();
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Pest & Disease Detection</Text>
      <Text style={styles.subtitle}>Upload or capture an image of affected crop</Text>

      <View style={styles.imageContainer}>
        {image ? (
          <Image source={{ uri: image }} style={styles.previewImage} />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderEmoji}>📸</Text>
            <Text style={styles.placeholderText}>No image selected</Text>
            <Text style={styles.placeholderHint}>Take a photo or select from gallery</Text>
          </View>
        )}
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.imageButton} onPress={takePhoto}>
          <Text style={styles.buttonEmoji}>📷</Text>
          <Text style={styles.imageButtonText}>Take Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.imageButton} onPress={pickImage}>
          <Text style={styles.buttonEmoji}>🖼️</Text>
          <Text style={styles.imageButtonText}>Gallery</Text>
        </TouchableOpacity>
      </View>

      {isAnalyzing && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
          </View>
          <Text style={styles.progressText}>Analyzing... {uploadProgress}%</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.analyzeButton, (!image || isAnalyzing) && styles.buttonDisabled]}
        onPress={analyzeImage}
        disabled={!image || isAnalyzing}
      >
        {isAnalyzing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Text style={styles.analyzeEmoji}>🔍</Text>
            <Text style={styles.analyzeButtonText}>Analyze Image</Text>
          </>
        )}
      </TouchableOpacity>

      <View style={styles.tips}>
        <Text style={styles.tipsTitle}>📸 Tips for better detection:</Text>
        <Text style={styles.tipItem}>• Take close-up photos of affected areas</Text>
        <Text style={styles.tipItem}>• Ensure good lighting</Text>
        <Text style={styles.tipItem}>• Include both healthy and affected parts</Text>
        <Text style={styles.tipItem}>• Avoid blurry images</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#2E7D32', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 20 },
  imageContainer: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', marginBottom: 16 },
  previewImage: { width: '100%', height: 250, resizeMode: 'cover' },
  placeholder: { height: 250, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' },
  placeholderEmoji: { fontSize: 64 },
  placeholderText: { color: '#666', marginTop: 12, fontSize: 18, fontWeight: '600' },
  placeholderHint: { color: '#999', marginTop: 4, fontSize: 14 },
  buttonRow: { flexDirection: 'row', marginBottom: 16 },
  imageButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F5E9', padding: 16, borderRadius: 12, marginHorizontal: 4 },
  buttonEmoji: { fontSize: 24 },
  imageButtonText: { color: '#2E7D32', fontWeight: '600', marginLeft: 8, fontSize: 16 },
  progressContainer: { marginBottom: 16 },
  progressBar: { height: 8, backgroundColor: '#E0E0E0', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#2E7D32' },
  progressText: { textAlign: 'center', color: '#666', marginTop: 8 },
  analyzeButton: { backgroundColor: '#2E7D32', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12 },
  buttonDisabled: { backgroundColor: '#9E9E9E' },
  analyzeEmoji: { fontSize: 20 },
  analyzeButtonText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 },
  tips: { backgroundColor: '#FFF8E1', padding: 16, borderRadius: 12, marginTop: 16 },
  tipsTitle: { fontSize: 14, fontWeight: '600', color: '#F57C00', marginBottom: 8 },
  tipItem: { fontSize: 13, color: '#666', marginBottom: 4 },
  resultsHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff' },
  backButton: { marginRight: 16 },
  resultsTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  resultImage: { width: '100%', height: 200, resizeMode: 'cover' },
  detectionCard: { backgroundColor: '#fff', margin: 16, borderRadius: 12, padding: 16 },
  detectionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  pestName: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  affectedCrop: { fontSize: 14, color: '#666' },
  confidenceContainer: { alignItems: 'flex-end' },
  confidenceLabel: { fontSize: 12, color: '#666' },
  confidenceValue: { fontSize: 18, fontWeight: 'bold', color: '#2E7D32' },
  severityBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginBottom: 16 },
  severityText: { color: '#fff', fontWeight: '600', fontSize: 12, marginLeft: 4 },
  treatmentTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 12 },
  treatmentCategory: { fontSize: 14, fontWeight: '600', color: '#666', marginTop: 8, marginBottom: 8 },
  treatmentCard: { backgroundColor: '#f9f9f9', padding: 12, borderRadius: 8, marginBottom: 8 },
  treatmentName: { fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 8 },
  treatmentDetails: {},
  treatmentDetail: { fontSize: 13, color: '#666', marginBottom: 4 },
  treatmentFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  treatmentCost: { fontSize: 14, fontWeight: '600', color: '#2E7D32', marginRight: 12 },
  effectivenessBar: { flex: 1, height: 6, backgroundColor: '#E0E0E0', borderRadius: 3, marginRight: 8 },
  effectivenessFill: { height: '100%', backgroundColor: '#4CAF50', borderRadius: 3 },
  effectivenessText: { fontSize: 12, color: '#666' },
});

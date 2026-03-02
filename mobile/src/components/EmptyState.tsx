import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from './LoadingStates';
import { Language } from '../utils/errorMessages';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  language?: Language;
}

// Localized empty state messages
const EMPTY_STATE_MESSAGES: Record<string, Record<Language, { title: string; message: string }>> = {
  NO_RECOMMENDATIONS: {
    en: { title: 'No Recommendations', message: 'Add your land parcels to get crop recommendations.' },
    kn: { title: 'ಶಿಫಾರಸುಗಳಿಲ್ಲ', message: 'ಬೆಳೆ ಶಿಫಾರಸುಗಳನ್ನು ಪಡೆಯಲು ನಿಮ್ಮ ಭೂಮಿ ಪಾರ್ಸೆಲ್‌ಗಳನ್ನು ಸೇರಿಸಿ.' },
    hi: { title: 'कोई सिफारिश नहीं', message: 'फसल सिफारिशें प्राप्त करने के लिए अपनी भूमि जोड़ें।' },
    ta: { title: 'பரிந்துரைகள் இல்லை', message: 'பயிர் பரிந்துரைகளைப் பெற உங்கள் நிலத்தைச் சேர்க்கவும்.' },
    te: { title: 'సిఫార్సులు లేవు', message: 'పంట సిఫార్సులు పొందడానికి మీ భూమిని జోడించండి.' },
  },
  NO_ALERTS: {
    en: { title: 'No Alerts', message: 'You\'re all caught up! No alerts at this time.' },
    kn: { title: 'ಎಚ್ಚರಿಕೆಗಳಿಲ್ಲ', message: 'ನೀವು ಎಲ್ಲವನ್ನೂ ನೋಡಿದ್ದೀರಿ! ಈ ಸಮಯದಲ್ಲಿ ಯಾವುದೇ ಎಚ್ಚರಿಕೆಗಳಿಲ್ಲ.' },
    hi: { title: 'कोई अलर्ट नहीं', message: 'आप अप टू डेट हैं! इस समय कोई अलर्ट नहीं।' },
    ta: { title: 'எச்சரிக்கைகள் இல்லை', message: 'நீங்கள் புதுப்பித்த நிலையில் உள்ளீர்கள்! இப்போது எச்சரிக்கைகள் இல்லை.' },
    te: { title: 'హెచ్చరికలు లేవు', message: 'మీరు అప్‌డేట్‌గా ఉన్నారు! ఈ సమయంలో హెచ్చరికలు లేవు.' },
  },
  NO_MARKET_DATA: {
    en: { title: 'No Market Data', message: 'Market prices are not available for your area.' },
    kn: { title: 'ಮಾರುಕಟ್ಟೆ ಡೇಟಾ ಇಲ್ಲ', message: 'ನಿಮ್ಮ ಪ್ರದೇಶಕ್ಕೆ ಮಾರುಕಟ್ಟೆ ಬೆಲೆಗಳು ಲಭ್ಯವಿಲ್ಲ.' },
    hi: { title: 'कोई बाजार डेटा नहीं', message: 'आपके क्षेत्र के लिए बाजार मूल्य उपलब्ध नहीं हैं।' },
    ta: { title: 'சந்தை தரவு இல்லை', message: 'உங்கள் பகுதிக்கு சந்தை விலைகள் கிடைக்கவில்லை.' },
    te: { title: 'మార్కెట్ డేటా లేదు', message: 'మీ ప్రాంతానికి మార్కెట్ ధరలు అందుబాటులో లేవు.' },
  },
  NO_HISTORY: {
    en: { title: 'No History', message: 'Start logging your farming activities to see history.' },
    kn: { title: 'ಇತಿಹಾಸವಿಲ್ಲ', message: 'ಇತಿಹಾಸವನ್ನು ನೋಡಲು ನಿಮ್ಮ ಕೃಷಿ ಚಟುವಟಿಕೆಗಳನ್ನು ಲಾಗ್ ಮಾಡಲು ಪ್ರಾರಂಭಿಸಿ.' },
    hi: { title: 'कोई इतिहास नहीं', message: 'इतिहास देखने के लिए अपनी कृषि गतिविधियों को लॉग करना शुरू करें।' },
    ta: { title: 'வரலாறு இல்லை', message: 'வரலாற்றைப் பார்க்க உங்கள் விவசாய நடவடிக்கைகளை பதிவு செய்யத் தொடங்குங்கள்.' },
    te: { title: 'చరిత్ర లేదు', message: 'చరిత్రను చూడటానికి మీ వ్యవసాయ కార్యకలాపాలను లాగ్ చేయడం ప్రారంభించండి.' },
  },
  NO_SEARCH_RESULTS: {
    en: { title: 'No Results', message: 'Try adjusting your search or filters.' },
    kn: { title: 'ಫಲಿತಾಂಶಗಳಿಲ್ಲ', message: 'ನಿಮ್ಮ ಹುಡುಕಾಟ ಅಥವಾ ಫಿಲ್ಟರ್‌ಗಳನ್ನು ಹೊಂದಿಸಲು ಪ್ರಯತ್ನಿಸಿ.' },
    hi: { title: 'कोई परिणाम नहीं', message: 'अपनी खोज या फ़िल्टर समायोजित करने का प्रयास करें।' },
    ta: { title: 'முடிவுகள் இல்லை', message: 'உங்கள் தேடல் அல்லது வடிப்பான்களை சரிசெய்ய முயற்சிக்கவும்.' },
    te: { title: 'ఫలితాలు లేవు', message: 'మీ శోధన లేదా ఫిల్టర్‌లను సర్దుబాటు చేయడానికి ప్రయత్నించండి.' },
  },
};

/**
 * Get localized empty state message
 */
export const getEmptyStateMessage = (
  type: keyof typeof EMPTY_STATE_MESSAGES,
  language: Language = 'en'
): { title: string; message: string } => {
  const messages = EMPTY_STATE_MESSAGES[type];
  if (!messages) {
    return { title: 'No Data', message: 'No data available.' };
  }
  return messages[language] || messages.en;
};

/**
 * Empty state component for displaying when there's no data
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'folder-open-outline',
  title,
  message,
  actionLabel,
  onAction,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name={icon} size={64} color={THEME.textLight} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction && (
        <TouchableOpacity style={styles.actionButton} onPress={onAction}>
          <Text style={styles.actionButtonText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

/**
 * Compact empty state for inline use
 */
export const EmptyStateCompact: React.FC<{
  icon?: keyof typeof Ionicons.glyphMap;
  message: string;
}> = ({ icon = 'information-circle-outline', message }) => (
  <View style={styles.compactContainer}>
    <Ionicons name={icon} size={24} color={THEME.textLight} />
    <Text style={styles.compactMessage}>{message}</Text>
  </View>
);

/**
 * Offline state indicator
 */
export const OfflineState: React.FC<{ language?: Language }> = ({ language = 'en' }) => {
  const messages: Record<Language, { title: string; message: string }> = {
    en: { title: 'You\'re Offline', message: 'Some features may be limited. Data will sync when you\'re back online.' },
    kn: { title: 'ನೀವು ಆಫ್‌ಲೈನ್‌ನಲ್ಲಿದ್ದೀರಿ', message: 'ಕೆಲವು ವೈಶಿಷ್ಟ್ಯಗಳು ಸೀಮಿತವಾಗಿರಬಹುದು. ನೀವು ಆನ್‌ಲೈನ್‌ಗೆ ಹಿಂತಿರುಗಿದಾಗ ಡೇಟಾ ಸಿಂಕ್ ಆಗುತ್ತದೆ.' },
    hi: { title: 'आप ऑफ़लाइन हैं', message: 'कुछ सुविधाएं सीमित हो सकती हैं। जब आप ऑनलाइन होंगे तब डेटा सिंक होगा।' },
    ta: { title: 'நீங்கள் ஆஃப்லைனில் உள்ளீர்கள்', message: 'சில அம்சங்கள் வரையறுக்கப்படலாம். நீங்கள் ஆன்லைனில் இருக்கும்போது தரவு ஒத்திசைக்கப்படும்.' },
    te: { title: 'మీరు ఆఫ్‌లైన్‌లో ఉన్నారు', message: 'కొన్ని ఫీచర్లు పరిమితం కావచ్చు. మీరు ఆన్‌లైన్‌లో ఉన్నప్పుడు డేటా సింక్ అవుతుంది.' },
  };

  const msg = messages[language] || messages.en;

  return (
    <View style={styles.offlineContainer}>
      <Ionicons name="cloud-offline" size={20} color={THEME.warning} />
      <View style={styles.offlineTextContainer}>
        <Text style={styles.offlineTitle}>{msg.title}</Text>
        <Text style={styles.offlineMessage}>{msg.message}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: THEME.background,
  },
  iconContainer: {
    marginBottom: 16,
    opacity: 0.5,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: THEME.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: THEME.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  actionButton: {
    backgroundColor: THEME.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  // Compact styles
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  compactMessage: {
    marginLeft: 8,
    fontSize: 14,
    color: THEME.textSecondary,
  },
  // Offline styles
  offlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#FFE0B2',
  },
  offlineTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  offlineTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.warning,
  },
  offlineMessage: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 2,
  },
});

export default EmptyState;

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ErrorMessage, Language, getErrorMessage, getLocalizedError } from '../utils/errorMessages';

interface ErrorDisplayProps {
  errorCode?: string;
  error?: any;
  language?: Language;
  onAction?: () => void;
  onDismiss?: () => void;
  showGuidance?: boolean;
  compact?: boolean;
}

/**
 * Reusable component for displaying localized error messages
 * Supports all 5 languages: English, Kannada, Hindi, Tamil, Telugu
 */
export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  errorCode,
  error,
  language = 'en',
  onAction,
  onDismiss,
  showGuidance = true,
  compact = false,
}) => {
  // Get the localized error message
  const errorMessage: ErrorMessage = errorCode
    ? getErrorMessage(errorCode, language)
    : error
    ? getLocalizedError(error, language)
    : getErrorMessage('SERVER_ERROR', language);

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <Ionicons name="alert-circle" size={16} color="#F44336" />
        <Text style={styles.compactMessage}>{errorMessage.message}</Text>
        {onDismiss && (
          <TouchableOpacity onPress={onDismiss} style={styles.compactDismiss}>
            <Ionicons name="close" size={16} color="#666" />
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name="alert-circle" size={48} color="#F44336" />
      </View>
      
      <Text style={styles.title}>{errorMessage.title}</Text>
      <Text style={styles.message}>{errorMessage.message}</Text>
      
      {showGuidance && errorMessage.guidance && (
        <View style={styles.guidanceContainer}>
          <Ionicons name="information-circle" size={16} color="#666" />
          <Text style={styles.guidance}>{errorMessage.guidance}</Text>
        </View>
      )}
      
      <View style={styles.buttonContainer}>
        {errorMessage.action && onAction && (
          <TouchableOpacity style={styles.actionButton} onPress={onAction}>
            <Text style={styles.actionButtonText}>{errorMessage.action}</Text>
          </TouchableOpacity>
        )}
        
        {onDismiss && (
          <TouchableOpacity style={styles.dismissButton} onPress={onDismiss}>
            <Text style={styles.dismissButtonText}>
              {language === 'en' ? 'Dismiss' :
               language === 'kn' ? 'ವಜಾಗೊಳಿಸಿ' :
               language === 'hi' ? 'खारिज करें' :
               language === 'ta' ? 'நிராகரி' :
               'తీసివేయి'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

/**
 * Inline error banner for forms
 */
export const ErrorBanner: React.FC<{
  errorCode?: string;
  error?: any;
  language?: Language;
  onDismiss?: () => void;
}> = ({ errorCode, error, language = 'en', onDismiss }) => {
  const errorMessage: ErrorMessage = errorCode
    ? getErrorMessage(errorCode, language)
    : error
    ? getLocalizedError(error, language)
    : getErrorMessage('SERVER_ERROR', language);

  return (
    <View style={styles.bannerContainer}>
      <View style={styles.bannerContent}>
        <Ionicons name="warning" size={20} color="#fff" />
        <View style={styles.bannerTextContainer}>
          <Text style={styles.bannerTitle}>{errorMessage.title}</Text>
          <Text style={styles.bannerMessage}>{errorMessage.message}</Text>
        </View>
      </View>
      {onDismiss && (
        <TouchableOpacity onPress={onDismiss} style={styles.bannerDismiss}>
          <Ionicons name="close" size={20} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },
  guidanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  guidance: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  dismissButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  dismissButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  // Compact styles
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  compactMessage: {
    flex: 1,
    fontSize: 13,
    color: '#C62828',
    marginLeft: 8,
  },
  compactDismiss: {
    padding: 4,
  },
  // Banner styles
  bannerContainer: {
    backgroundColor: '#F44336',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
  },
  bannerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  bannerTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  bannerMessage: {
    color: '#FFCDD2',
    fontSize: 12,
    marginTop: 2,
  },
  bannerDismiss: {
    padding: 4,
  },
});

export default ErrorDisplay;

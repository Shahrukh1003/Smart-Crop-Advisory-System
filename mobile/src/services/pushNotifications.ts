import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { api } from './api';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Notification types
export type NotificationType = 
  | 'weather_alert'
  | 'pest_alert'
  | 'market_price'
  | 'broadcast'
  | 'recommendation';

interface NotificationData {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
}

/**
 * Register for push notifications and get the token
 */
export const registerForPushNotifications = async (): Promise<string | null> => {
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permissions if not granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission not granted');
    return null;
  }

  // Get the Expo push token
  const token = await Notifications.getExpoPushTokenAsync({
    projectId: 'your-expo-project-id', // Replace with actual project ID
  });

  // Configure Android channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2E7D32',
    });

    // Weather alerts channel
    await Notifications.setNotificationChannelAsync('weather', {
      name: 'Weather Alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 500, 250, 500],
      lightColor: '#FF9800',
    });

    // Market price alerts channel
    await Notifications.setNotificationChannelAsync('market', {
      name: 'Market Price Alerts',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#9C27B0',
    });

    // Broadcast messages channel
    await Notifications.setNotificationChannelAsync('broadcast', {
      name: 'Broadcast Messages',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#2196F3',
    });
  }

  return token.data;
};

/**
 * Save push token to server
 */
export const savePushToken = async (token: string): Promise<void> => {
  try {
    await api.post('/users/push-token', {
      token,
      platform: Platform.OS,
      deviceId: Device.deviceName,
    });
  } catch (error) {
    console.error('Failed to save push token:', error);
  }
};

/**
 * Handle notification received while app is in foreground
 */
export const addNotificationReceivedListener = (
  callback: (notification: Notifications.Notification) => void
): Notifications.Subscription => {
  return Notifications.addNotificationReceivedListener(callback);
};

/**
 * Handle notification tap (when user taps on notification)
 */
export const addNotificationResponseListener = (
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.Subscription => {
  return Notifications.addNotificationResponseReceivedListener(callback);
};

/**
 * Schedule a local notification
 */
export const scheduleLocalNotification = async (
  notification: NotificationData,
  trigger?: Notifications.NotificationTriggerInput
): Promise<string> => {
  const channelId = getChannelForType(notification.type);

  return await Notifications.scheduleNotificationAsync({
    content: {
      title: notification.title,
      body: notification.body,
      data: notification.data,
      sound: true,
      ...(Platform.OS === 'android' && { channelId }),
    },
    trigger: trigger || null, // null = immediate
  });
};

/**
 * Cancel a scheduled notification
 */
export const cancelNotification = async (notificationId: string): Promise<void> => {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
};

/**
 * Cancel all scheduled notifications
 */
export const cancelAllNotifications = async (): Promise<void> => {
  await Notifications.cancelAllScheduledNotificationsAsync();
};

/**
 * Get badge count
 */
export const getBadgeCount = async (): Promise<number> => {
  return await Notifications.getBadgeCountAsync();
};

/**
 * Set badge count
 */
export const setBadgeCount = async (count: number): Promise<void> => {
  await Notifications.setBadgeCountAsync(count);
};

/**
 * Get the appropriate Android channel for notification type
 */
const getChannelForType = (type: NotificationType): string => {
  switch (type) {
    case 'weather_alert':
    case 'pest_alert':
      return 'weather';
    case 'market_price':
      return 'market';
    case 'broadcast':
      return 'broadcast';
    default:
      return 'default';
  }
};

/**
 * Parse notification data and navigate to appropriate screen
 */
export const handleNotificationNavigation = (
  data: Record<string, any>,
  navigation: any
): void => {
  const type = data.type as NotificationType;

  switch (type) {
    case 'weather_alert':
      navigation.navigate('Weather');
      break;
    case 'pest_alert':
      navigation.navigate('PestDetection', { alertId: data.alertId });
      break;
    case 'market_price':
      navigation.navigate('MarketPrices', { commodity: data.commodity });
      break;
    case 'broadcast':
      navigation.navigate('Broadcasts', { broadcastId: data.broadcastId });
      break;
    case 'recommendation':
      navigation.navigate('CropAdvisory');
      break;
    default:
      navigation.navigate('Dashboard');
  }
};

/**
 * Initialize push notifications
 */
export const initializePushNotifications = async (): Promise<void> => {
  const token = await registerForPushNotifications();
  if (token) {
    await savePushToken(token);
  }
};

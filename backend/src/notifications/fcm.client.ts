import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { NotificationPriority } from './dto/notification.dto';

export interface FCMNotification {
  title: string;
  body: string;
  data?: Record<string, string>;
  priority?: NotificationPriority;
  sound?: string;
}

export interface FCMSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

@Injectable()
export class FCMClient implements OnModuleInit {
  private readonly logger = new Logger(FCMClient.name);
  private initialized = false;

  constructor(private readonly configService: ConfigService) { }

  onModuleInit() {
    this.initializeFirebase();
  }

  private initializeFirebase(): void {
    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');

    if (!projectId || !privateKey || !clientEmail) {
      this.logger.warn('Firebase credentials not configured. Push notifications will be disabled.');
      return;
    }

    try {
      // Check if Firebase is already initialized
      if (admin.apps.length === 0) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            privateKey: privateKey.replace(/\\n/g, '\n'),
            clientEmail,
          }),
        });
      }
      this.initialized = true;
      this.logger.log('Firebase Admin SDK initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Firebase Admin SDK', error);
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async sendToDevice(token: string, notification: FCMNotification): Promise<FCMSendResult> {
    if (!this.initialized) {
      this.logger.warn('Firebase not initialized. Skipping notification.');
      return { success: false, error: 'Firebase not initialized' };
    }

    try {
      const message: admin.messaging.Message = {
        token,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: notification.data || {},
        android: {
          priority: notification.priority === NotificationPriority.HIGH ? 'high' : 'normal',
          notification: {
            sound: notification.sound || 'default',
            channelId: 'smart_crop_advisory',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: notification.sound || 'default',
              badge: 1,
            },
          },
        },
      };

      const response = await admin.messaging().send(message);
      this.logger.log(`Notification sent successfully: ${response}`);
      return { success: true, messageId: response };
    } catch (error: any) {
      this.logger.error(`Failed to send notification to device: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async sendToMultipleDevices(
    tokens: string[],
    notification: FCMNotification,
  ): Promise<{ successCount: number; failureCount: number; results: FCMSendResult[] }> {
    if (!this.initialized) {
      this.logger.warn('Firebase not initialized. Skipping bulk notification.');
      return {
        successCount: 0,
        failureCount: tokens.length,
        results: tokens.map(() => ({ success: false, error: 'Firebase not initialized' })),
      };
    }

    if (tokens.length === 0) {
      return { successCount: 0, failureCount: 0, results: [] };
    }

    try {
      const message: admin.messaging.MulticastMessage = {
        tokens,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: notification.data || {},
        android: {
          priority: notification.priority === NotificationPriority.HIGH ? 'high' : 'normal',
          notification: {
            sound: notification.sound || 'default',
            channelId: 'smart_crop_advisory',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: notification.sound || 'default',
              badge: 1,
            },
          },
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);

      const results: FCMSendResult[] = response.responses.map((res: any, index: number) => ({
        success: res.success,
        messageId: res.messageId,
        error: res.error?.message,
      }));

      this.logger.log(
        `Bulk notification sent: ${response.successCount} success, ${response.failureCount} failed`,
      );

      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
        results,
      };
    } catch (error: any) {
      this.logger.error(`Failed to send bulk notification: ${error.message}`);
      return {
        successCount: 0,
        failureCount: tokens.length,
        results: tokens.map(() => ({ success: false, error: error.message })),
      };
    }
  }

  async subscribeToTopic(tokens: string[], topic: string): Promise<boolean> {
    if (!this.initialized) {
      return false;
    }

    try {
      await admin.messaging().subscribeToTopic(tokens, topic);
      this.logger.log(`Subscribed ${tokens.length} devices to topic: ${topic}`);
      return true;
    } catch (error: any) {
      this.logger.error(`Failed to subscribe to topic: ${error.message}`);
      return false;
    }
  }

  async unsubscribeFromTopic(tokens: string[], topic: string): Promise<boolean> {
    if (!this.initialized) {
      return false;
    }

    try {
      await admin.messaging().unsubscribeFromTopic(tokens, topic);
      this.logger.log(`Unsubscribed ${tokens.length} devices from topic: ${topic}`);
      return true;
    } catch (error: any) {
      this.logger.error(`Failed to unsubscribe from topic: ${error.message}`);
      return false;
    }
  }

  async sendToTopic(topic: string, notification: FCMNotification): Promise<FCMSendResult> {
    if (!this.initialized) {
      return { success: false, error: 'Firebase not initialized' };
    }

    try {
      const message: admin.messaging.Message = {
        topic,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: notification.data || {},
      };

      const response = await admin.messaging().send(message);
      this.logger.log(`Topic notification sent: ${response}`);
      return { success: true, messageId: response };
    } catch (error: any) {
      this.logger.error(`Failed to send topic notification: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

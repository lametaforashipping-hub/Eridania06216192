import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface PushNotificationState {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  let token: string | null = null;

  // Check if running on a physical device
  if (Platform.OS === 'web') {
    console.log('Push notifications not supported on web');
    return null;
  }

  if (!Device.isDevice) {
    console.log('Must use physical device for Push Notifications');
    return null;
  }

  // Get existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permissions if not granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Failed to get push token for push notification!');
    return null;
  }

  // Get the Expo push token
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      console.log('No project ID found for push notifications');
      // For development, we can still get a token
      const tokenData = await Notifications.getExpoPushTokenAsync();
      token = tokenData.data;
    } else {
      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      token = tokenData.data;
    }
  } catch (error) {
    console.log('Error getting push token:', error);
    return null;
  }

  // Configure Android channel
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('lottery-winners', {
      name: 'Ganadores de Lotería',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#22c55e',
      sound: 'default',
    });
  }

  return token;
}

export async function saveTokenToServer(token: string, userId: string, authToken: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/api/users/${userId}/notification-token?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });
    return response.ok;
  } catch (error) {
    console.error('Error saving notification token:', error);
    return false;
  }
}

export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
): Notifications.EventSubscription {
  return Notifications.addNotificationReceivedListener(callback);
}

export function addNotificationResponseReceivedListener(
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.EventSubscription {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

export async function schedulePushNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<string> {
  return await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data || {},
      sound: 'default',
    },
    trigger: null, // Show immediately
  });
}

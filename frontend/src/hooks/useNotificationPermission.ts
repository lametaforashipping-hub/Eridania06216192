import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerForPushNotificationsAsync, saveTokenToServer } from '../services/pushNotifications';

const DISMISSED_KEY = 'notification_banner_dismissed';
const LAST_CHECK_KEY = 'notification_last_check';

interface NotificationPermissionState {
  hasPermission: boolean | null;
  isLoading: boolean;
  showBanner: boolean;
  token: string | null;
}

export function useNotificationPermission(userId?: string, authToken?: string) {
  const [state, setState] = useState<NotificationPermissionState>({
    hasPermission: null,
    isLoading: true,
    showBanner: false,
    token: null,
  });

  const checkPermission = useCallback(async () => {
    // Web doesn't support push notifications in the same way
    if (Platform.OS === 'web') {
      setState(prev => ({
        ...prev,
        hasPermission: false,
        isLoading: false,
        showBanner: false,
      }));
      return;
    }

    try {
      const { status } = await Notifications.getPermissionsAsync();
      const hasPermission = status === 'granted';
      
      // Check if user dismissed the banner
      const dismissed = await AsyncStorage.getItem(DISMISSED_KEY);
      const lastCheck = await AsyncStorage.getItem(LAST_CHECK_KEY);
      const now = Date.now();
      
      // Show banner if:
      // 1. Permission not granted AND
      // 2. Not dismissed in the last 24 hours
      let showBanner = false;
      if (!hasPermission) {
        if (!dismissed) {
          showBanner = true;
        } else {
          const dismissedTime = parseInt(dismissed, 10);
          // Show again after 24 hours
          if (now - dismissedTime > 24 * 60 * 60 * 1000) {
            showBanner = true;
          }
        }
      }
      
      setState(prev => ({
        ...prev,
        hasPermission,
        isLoading: false,
        showBanner,
      }));
      
      // Save last check time
      await AsyncStorage.setItem(LAST_CHECK_KEY, now.toString());
    } catch (error) {
      console.error('Error checking notification permission:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
      }));
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (Platform.OS === 'web') {
      return false;
    }

    try {
      setState(prev => ({ ...prev, isLoading: true }));
      
      const token = await registerForPushNotificationsAsync();
      
      if (token) {
        // Save token to server if we have user credentials
        if (userId && authToken) {
          await saveTokenToServer(token, userId, authToken);
        }
        
        setState(prev => ({
          ...prev,
          hasPermission: true,
          isLoading: false,
          showBanner: false,
          token,
        }));
        
        return true;
      } else {
        setState(prev => ({
          ...prev,
          hasPermission: false,
          isLoading: false,
        }));
        return false;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
      }));
      return false;
    }
  }, [userId, authToken]);

  const dismissBanner = useCallback(async () => {
    await AsyncStorage.setItem(DISMISSED_KEY, Date.now().toString());
    setState(prev => ({
      ...prev,
      showBanner: false,
    }));
  }, []);

  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  return {
    ...state,
    requestPermission,
    dismissBanner,
    checkPermission,
  };
}

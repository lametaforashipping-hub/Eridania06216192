import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';

interface NotificationPermissionState {
  hasPermission: boolean;
  isLoading: boolean;
  showBanner: boolean;
  requestPermission: () => Promise<void>;
  dismissBanner: () => void;
}

/**
 * Hook to manage notification permissions
 */
export const useNotificationPermission = (): NotificationPermissionState => {
  const [hasPermission, setHasPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    checkPermission();
  }, []);

  const checkPermission = async () => {
    setIsLoading(true);
    try {
      if (Platform.OS === 'web') {
        // For web, check browser notification permission
        if ('Notification' in window) {
          const permission = Notification.permission;
          setHasPermission(permission === 'granted');
          setShowBanner(permission === 'default');
        } else {
          setHasPermission(false);
          setShowBanner(false);
        }
      } else {
        // For native apps, we would check push notification permissions
        // This is a placeholder - actual implementation would use expo-notifications
        setHasPermission(true);
        setShowBanner(false);
      }
    } catch (error) {
      console.error('Error checking notification permission:', error);
      setHasPermission(false);
    } finally {
      setIsLoading(false);
    }
  };

  const requestPermission = useCallback(async () => {
    try {
      if (Platform.OS === 'web') {
        if ('Notification' in window) {
          const permission = await Notification.requestPermission();
          setHasPermission(permission === 'granted');
          setShowBanner(false);
        }
      } else {
        // For native apps, request push notification permissions
        // This is a placeholder - actual implementation would use expo-notifications
        setHasPermission(true);
        setShowBanner(false);
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    }
  }, []);

  const dismissBanner = useCallback(() => {
    setShowBanner(false);
  }, []);

  return {
    hasPermission,
    isLoading,
    showBanner,
    requestPermission,
    dismissBanner,
  };
};

export default useNotificationPermission;

import { useCallback, useRef } from 'react';
import { Platform, Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';

// Sound configuration
let notificationSound: Audio.Sound | null = null;

export const useNotificationAlert = () => {
  const lastAlertTime = useRef<number>(0);
  const MIN_ALERT_INTERVAL = 5000; // Minimum 5 seconds between alerts

  const playAlertSound = useCallback(async () => {
    try {
      // Configure audio mode for notifications
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      // Unload previous sound if exists
      if (notificationSound) {
        await notificationSound.unloadAsync();
      }

      // Load and play the notification sound
      // Using a system-like notification sound
      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/sounds/notification.mp3'),
        { shouldPlay: true, volume: 0.8 }
      );
      notificationSound = sound;

      // Unload after playing
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch (error) {
      console.log('Could not play notification sound:', error);
      // Fallback: try web audio if available
      if (Platform.OS === 'web') {
        try {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.frequency.value = 800;
          oscillator.type = 'sine';
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
          
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.3);
        } catch (webError) {
          console.log('Web audio fallback failed:', webError);
        }
      }
    }
  }, []);

  const triggerVibration = useCallback(() => {
    try {
      if (Platform.OS === 'web') {
        // Web vibration API
        if ('vibrate' in navigator) {
          navigator.vibrate([100, 50, 100, 50, 200]);
        }
      } else if (Platform.OS === 'ios') {
        // iOS haptic feedback
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        // Android vibration pattern: vibrate, pause, vibrate, pause, longer vibrate
        Vibration.vibrate([0, 100, 50, 100, 50, 200]);
      }
    } catch (error) {
      console.log('Could not trigger vibration:', error);
    }
  }, []);

  const alertNewDeposit = useCallback(async () => {
    const now = Date.now();
    
    // Prevent alert spam
    if (now - lastAlertTime.current < MIN_ALERT_INTERVAL) {
      return;
    }
    
    lastAlertTime.current = now;

    // Trigger both vibration and sound
    triggerVibration();
    await playAlertSound();
  }, [triggerVibration, playAlertSound]);

  const alertDepositApproved = useCallback(async () => {
    try {
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (Platform.OS !== 'web') {
        Vibration.vibrate([0, 200]);
      } else if ('vibrate' in navigator) {
        navigator.vibrate(200);
      }
    } catch (error) {
      console.log('Could not trigger success vibration:', error);
    }
  }, []);

  return {
    alertNewDeposit,
    alertDepositApproved,
    playAlertSound,
    triggerVibration,
  };
};

export default useNotificationAlert;

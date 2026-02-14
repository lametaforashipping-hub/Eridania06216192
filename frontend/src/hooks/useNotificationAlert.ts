import { useCallback, useRef, useEffect, useState } from 'react';
import { Platform, Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';

// Web Audio context for generating notification sounds
let audioContext: AudioContext | null = null;

export const useNotificationAlert = () => {
  const lastAlertTime = useRef<number>(0);
  const previousPendingCount = useRef<number>(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const MIN_ALERT_INTERVAL = 3000; // Minimum 3 seconds between alerts

  // Initialize audio context on user interaction (required for web)
  useEffect(() => {
    const initAudio = () => {
      if (Platform.OS === 'web' && !audioContext) {
        try {
          audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          setIsInitialized(true);
        } catch (e) {
          console.log('Web Audio not available');
        }
      }
    };

    // Initialize on any user interaction
    if (Platform.OS === 'web') {
      document.addEventListener('click', initAudio, { once: true });
      document.addEventListener('touchstart', initAudio, { once: true });
    }

    return () => {
      if (Platform.OS === 'web') {
        document.removeEventListener('click', initAudio);
        document.removeEventListener('touchstart', initAudio);
      }
    };
  }, []);

  const playNotificationBeep = useCallback(() => {
    if (Platform.OS === 'web') {
      try {
        if (!audioContext) {
          audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        }

        // Resume context if suspended
        if (audioContext.state === 'suspended') {
          audioContext.resume();
        }

        const currentTime = audioContext.currentTime;

        // Create a pleasant notification sound (two-tone beep)
        // First beep - higher pitch
        const osc1 = audioContext.createOscillator();
        const gain1 = audioContext.createGain();
        osc1.connect(gain1);
        gain1.connect(audioContext.destination);
        osc1.frequency.value = 880; // A5
        osc1.type = 'sine';
        gain1.gain.setValueAtTime(0.3, currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.01, currentTime + 0.15);
        osc1.start(currentTime);
        osc1.stop(currentTime + 0.15);

        // Second beep - higher pitch for urgency
        const osc2 = audioContext.createOscillator();
        const gain2 = audioContext.createGain();
        osc2.connect(gain2);
        gain2.connect(audioContext.destination);
        osc2.frequency.value = 1100; // C#6
        osc2.type = 'sine';
        gain2.gain.setValueAtTime(0.3, currentTime + 0.18);
        gain2.gain.exponentialRampToValueAtTime(0.01, currentTime + 0.35);
        osc2.start(currentTime + 0.18);
        osc2.stop(currentTime + 0.35);

      } catch (error) {
        console.log('Could not play notification sound:', error);
      }
    }
  }, []);

  const triggerVibration = useCallback(() => {
    try {
      if (Platform.OS === 'web') {
        // Web vibration API
        if ('vibrate' in navigator) {
          navigator.vibrate([100, 50, 100, 50, 150]);
        }
      } else if (Platform.OS === 'ios') {
        // iOS haptic feedback - warning pattern
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        // Android vibration pattern
        Vibration.vibrate([0, 100, 50, 100, 50, 150]);
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
    playNotificationBeep();
  }, [triggerVibration, playNotificationBeep]);

  const alertDepositApproved = useCallback(() => {
    try {
      if (Platform.OS === 'web') {
        // Play success sound
        if (audioContext || (audioContext = new (window.AudioContext || (window as any).webkitAudioContext)())) {
          const currentTime = audioContext.currentTime;
          const osc = audioContext.createOscillator();
          const gain = audioContext.createGain();
          osc.connect(gain);
          gain.connect(audioContext.destination);
          osc.frequency.value = 523.25; // C5
          osc.type = 'sine';
          gain.gain.setValueAtTime(0.2, currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, currentTime + 0.3);
          osc.start(currentTime);
          osc.stop(currentTime + 0.3);
        }
        if ('vibrate' in navigator) {
          navigator.vibrate(150);
        }
      } else if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Vibration.vibrate([0, 150]);
      }
    } catch (error) {
      console.log('Could not trigger success alert:', error);
    }
  }, []);

  // Check if pending deposits increased and trigger alert
  const checkAndAlertNewDeposits = useCallback((currentCount: number) => {
    if (currentCount > previousPendingCount.current && previousPendingCount.current > 0) {
      // New deposit detected!
      alertNewDeposit();
    }
    previousPendingCount.current = currentCount;
  }, [alertNewDeposit]);

  return {
    alertNewDeposit,
    alertDepositApproved,
    checkAndAlertNewDeposits,
    playNotificationBeep,
    triggerVibration,
  };
};

export default useNotificationAlert;

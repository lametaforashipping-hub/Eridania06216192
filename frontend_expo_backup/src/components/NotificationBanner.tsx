import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface NotificationBannerProps {
  onEnable: () => void;
  onDismiss: () => void;
  isLoading?: boolean;
}

export function NotificationBanner({ onEnable, onDismiss, isLoading }: NotificationBannerProps) {
  // Don't show banner on web
  if (Platform.OS === 'web') {
    return null;
  }

  return (
    <LinearGradient
      colors={['#7c3aed', '#8b5cf6']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.container}
    >
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="notifications" size={24} color="#fff" />
        </View>
        
        <View style={styles.textContainer}>
          <Text style={styles.title}>Activa las Notificaciones</Text>
          <Text style={styles.subtitle}>
            Recibe alertas instantáneas cuando salgan los resultados de lotería
          </Text>
        </View>
        
        <TouchableOpacity 
          style={styles.closeButton}
          onPress={onDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.actions}>
        <TouchableOpacity 
          style={styles.enableButton}
          onPress={onEnable}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#7c3aed" />
          ) : (
            <>
              <Ionicons name="notifications-outline" size={18} color="#7c3aed" />
              <Text style={styles.enableButtonText}>Activar Ahora</Text>
            </>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.laterButton}
          onPress={onDismiss}
        >
          <Text style={styles.laterButtonText}>Más tarde</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 18,
  },
  closeButton: {
    padding: 4,
  },
  actions: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  enableButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 8,
  },
  enableButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7c3aed',
  },
  laterButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  laterButtonText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
});

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface NotificationBannerProps {
  visible: boolean;
  onRequestPermission: () => void;
  onDismiss: () => void;
}

/**
 * Banner component to request notification permissions
 */
export const NotificationBanner: React.FC<NotificationBannerProps> = ({
  visible,
  onRequestPermission,
  onDismiss,
}) => {
  if (!visible) return null;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="notifications-outline" size={24} color="#7C3AED" />
        <View style={styles.textContainer}>
          <Text style={styles.title}>Activar Notificaciones</Text>
          <Text style={styles.description}>
            Recibe alertas de resultados y depósitos
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity onPress={onDismiss} style={styles.dismissButton}>
          <Text style={styles.dismissText}>Ahora no</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onRequestPermission} style={styles.enableButton}>
          <Text style={styles.enableText}>Activar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F3E8FF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  textContainer: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  dismissButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  dismissText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
  },
  enableButton: {
    backgroundColor: '#7C3AED',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  enableText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default NotificationBanner;

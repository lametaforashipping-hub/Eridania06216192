import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const { width } = Dimensions.get('window');
const isDesktop = width > 768;

interface Notification {
  id: string;
  type: string;
  lottery_id?: string;
  lottery_name?: string;
  winning_numbers?: number[];
  position?: string;
  total_winners?: number;
  created_at: string;
  is_read: boolean;
  // Winner alert specific fields
  ticket_number?: string;
  prize_amount?: number;
  currency?: string;
  message?: string;
}

export default function Notifications() {
  const { token } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/api/notifications`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await fetch(`${API_URL}/api/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      fetchNotifications();
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'draw_result': return 'trophy';
      case 'winner_alert': return 'gift';
      case 'winner': return 'cash';
      case 'system': return 'information-circle';
      default: return 'notifications';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'draw_result': return '#f59e0b';
      case 'winner_alert': return '#22c55e';
      case 'winner': return '#22c55e';
      case 'system': return '#3b82f6';
      default: return '#94a3b8';
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours} h`;
    if (diffDays < 7) return `Hace ${diffDays} días`;
    return date.toLocaleDateString('es-DO');
  };

  const renderNotification = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[styles.notificationCard, !item.is_read && styles.unreadCard]}
      onPress={() => markAsRead(item.id)}
    >
      <View style={[styles.iconContainer, { backgroundColor: getNotificationColor(item.type) + '20' }]}>
        <Ionicons
          name={getNotificationIcon(item.type) as any}
          size={24}
          color={getNotificationColor(item.type)}
        />
      </View>

      <View style={styles.contentContainer}>
        {item.type === 'draw_result' && (
          <>
            <Text style={styles.title}>
              Resultado: {item.lottery_name}
              {item.position && ` (${item.position})`}
            </Text>
            <View style={styles.numbersRow}>
              {item.winning_numbers?.map((num, idx) => (
                <View key={idx} style={styles.numberBall}>
                  <Text style={styles.numberText}>{num.toString().padStart(2, '0')}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.subtext}>
              {item.total_winners} ganador{item.total_winners !== 1 ? 'es' : ''}
            </Text>
          </>
        )}

        {item.type === 'winner' && (
          <>
            <Text style={styles.title}>¡Felicidades! Tienes un boleto ganador</Text>
            <Text style={styles.subtext}>{item.lottery_name}</Text>
          </>
        )}

        {item.type === 'winner_alert' && (
          <>
            <Text style={styles.winnerTitle}>🎉 ¡BOLETO GANADOR!</Text>
            <Text style={styles.title}>{item.message || `Boleto ${item.ticket_number} ganó`}</Text>
            {item.prize_amount && (
              <View style={styles.prizeContainer}>
                <Text style={styles.prizeLabel}>Premio:</Text>
                <Text style={styles.prizeAmount}>
                  {item.currency || 'RD$'} {item.prize_amount.toLocaleString()}
                </Text>
              </View>
            )}
            <Text style={styles.subtext}>{item.lottery_name}</Text>
          </>
        )}

        {item.type === 'system' && (
          <Text style={styles.title}>Notificación del sistema</Text>
        )}

        <Text style={styles.timeText}>{formatTime(item.created_at)}</Text>
      </View>

      {!item.is_read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notificaciones</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Ionicons name="refresh" size={24} color="#22c55e" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#22c55e" style={styles.loader} />
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, isDesktop && styles.listContentDesktop]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-off-outline" size={64} color="#475569" />
              <Text style={styles.emptyText}>No hay notificaciones</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#1e293b',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
  },
  listContentDesktop: {
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  unreadCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#22c55e',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  contentContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  subtext: {
    fontSize: 13,
    color: '#94a3b8',
  },
  numbersRow: {
    flexDirection: 'row',
    marginVertical: 8,
  },
  numberBall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  numberText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  timeText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22c55e',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 16,
  },
  winnerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#22c55e',
    marginBottom: 4,
  },
  prizeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22c55e20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginVertical: 6,
    alignSelf: 'flex-start',
  },
  prizeLabel: {
    fontSize: 12,
    color: '#22c55e',
    marginRight: 6,
  },
  prizeAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#22c55e',
  },
});

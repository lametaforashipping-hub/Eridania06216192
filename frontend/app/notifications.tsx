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
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const { width } = Dimensions.get('window');
const isDesktop = width > 768;

interface Notification {
  id: string;
  type: string;
  title?: string;
  lottery_id?: string;
  lottery_name?: string;
  winning_numbers?: number[];
  position?: string;
  total_winners?: number;
  created_at: string;
  is_read?: boolean;
  read?: boolean;
  ticket_number?: string;
  prize_amount?: number;
  currency?: string;
  message?: string;
  reference_id?: string;
}

// Format date for API (YYYY-MM-DD)
const formatApiDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Format date for display
const formatDisplayDate = (date: Date): string => {
  const options: Intl.DateTimeFormatOptions = { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  };
  return date.toLocaleDateString('es-DO', options);
};

// Check if date is today
const isToday = (date: Date): boolean => {
  const today = new Date();
  return date.toDateString() === today.toDateString();
};

export default function Notifications() {
  const { token } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const dateParam = formatApiDate(selectedDate);
      const response = await fetch(`${API_URL}/api/notifications?date=${dateParam}`, {
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
  }, [token, selectedDate]);

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

  const goToPreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
  };

  const goToNextDay = () => {
    const newDate = new Date(selectedDate);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    newDate.setDate(newDate.getDate() + 1);
    if (newDate <= tomorrow) {
      setSelectedDate(newDate);
    }
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (date) {
      setSelectedDate(date);
    }
  };

  const isTodaySelected = isToday(selectedDate);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'draw_result': return 'trophy';
      case 'lottery_results': return 'megaphone';
      case 'winner_alert': return 'gift';
      case 'winner': return 'cash';
      case 'deposit_request': return 'cash';
      case 'deposit_processed': return 'checkmark-circle';
      case 'system': return 'information-circle';
      default: return 'notifications';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'draw_result': return '#f59e0b';
      case 'lottery_results': return '#8b5cf6';
      case 'winner_alert': return '#22c55e';
      case 'winner': return '#22c55e';
      case 'deposit_request': return '#f59e0b';
      case 'deposit_processed': return '#22c55e';
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
    return date.toLocaleDateString('es-DO', {timeZone: 'America/Santo_Domingo'});
  };

  const handleNotificationPress = (item: Notification) => {
    markAsRead(item.id);
    if (item.type === 'deposit_request' || item.type === 'deposit_processed') {
      router.push('/bank-accounts');
    }
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    const isRead = item.is_read ?? item.read ?? false;
    return (
    <TouchableOpacity
      style={[styles.notificationCard, !isRead && styles.unreadCard]}
      onPress={() => handleNotificationPress(item)}
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

        {item.type === 'deposit_request' && (
          <>
            <Text style={styles.depositTitle}>{item.title || '💰 Solicitud de Depósito'}</Text>
            <Text style={styles.title}>{item.message}</Text>
            <Text style={styles.depositAction}>Toca para revisar →</Text>
          </>
        )}

        {item.type === 'deposit_processed' && (
          <>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtext}>{item.message}</Text>
          </>
        )}

        {item.type === 'lottery_results' && (
          <>
            <Text style={styles.lotteryResultsTitle}>{item.title || '🎰 Nuevos Resultados'}</Text>
            <Text style={styles.title}>{item.message}</Text>
            {(item as any).results && (item as any).results.length > 0 && (
              <View style={styles.resultsPreview}>
                {(item as any).results.slice(0, 3).map((r: any, idx: number) => (
                  <View key={idx} style={styles.resultItem}>
                    <Text style={styles.resultLotteryName}>{r.lottery_name}</Text>
                    <View style={styles.resultNumbersRow}>
                      <View style={styles.numberBallFirst}>
                        <Text style={styles.numberBallText}>{String(r.first).padStart(2, '0')}</Text>
                      </View>
                      <View style={styles.numberBallSecond}>
                        <Text style={styles.numberBallText}>{String(r.second || 0).padStart(2, '0')}</Text>
                      </View>
                      <View style={styles.numberBallThird}>
                        <Text style={styles.numberBallText}>{String(r.third || 0).padStart(2, '0')}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {item.type === 'system' && (
          <Text style={styles.title}>Notificación del sistema</Text>
        )}

        <Text style={styles.timeText}>{formatTime(item.created_at)}</Text>
      </View>

      {!isRead && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
  };

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

      {/* Date Filter Bar */}
      <View style={styles.dateFilterBar}>
        <TouchableOpacity style={styles.navButton} onPress={goToPreviousDay}>
          <Ionicons name="chevron-back" size={24} color="#a5b4fc" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[
            styles.dateButton, 
            isTodaySelected && styles.dateButtonToday
          ]} 
          onPress={() => setShowDatePicker(true)}
        >
          <Ionicons 
            name="calendar" 
            size={18} 
            color={isTodaySelected ? '#4ade80' : '#a5b4fc'} 
          />
          <Text style={[
            styles.dateText,
            isTodaySelected && styles.dateTextToday
          ]}>
            {isTodaySelected ? 'Hoy - ' : ''}{formatDisplayDate(selectedDate)}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.navButton, isTodaySelected && styles.navButtonDisabled]} 
          onPress={goToNextDay}
          disabled={isTodaySelected}
        >
          <Ionicons 
            name="chevron-forward" 
            size={24} 
            color={isTodaySelected ? '#475569' : '#a5b4fc'} 
          />
        </TouchableOpacity>
      </View>

      {/* Quick Today Button if not today */}
      {!isTodaySelected && (
        <TouchableOpacity style={styles.todayButton} onPress={goToToday}>
          <Ionicons name="today" size={16} color="#0f172a" />
          <Text style={styles.todayButtonText}>Ir a Hoy</Text>
        </TouchableOpacity>
      )}

      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
          maximumDate={new Date()}
          themeVariant="dark"
        />
      )}

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
              <Text style={styles.emptyText}>
                No hay notificaciones para {isTodaySelected ? 'hoy' : 'esta fecha'}
              </Text>
              {!isTodaySelected && (
                <TouchableOpacity style={styles.goTodayBtnLarge} onPress={goToToday}>
                  <Text style={styles.goTodayBtnText}>Ver notificaciones de Hoy</Text>
                </TouchableOpacity>
              )}
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
  dateFilterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.1)',
  },
  navButton: {
    padding: 8,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  navButtonDisabled: {
    backgroundColor: 'rgba(148, 163, 184, 0.05)',
    borderColor: 'rgba(148, 163, 184, 0.1)',
    opacity: 0.5,
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
    gap: 8,
  },
  dateButtonToday: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderColor: 'rgba(34, 197, 94, 0.4)',
  },
  dateText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#a5b4fc',
  },
  dateTextToday: {
    color: '#4ade80',
  },
  todayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#22c55e',
    borderRadius: 8,
    gap: 6,
  },
  todayButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
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
    textAlign: 'center',
  },
  goTodayBtnLarge: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#22c55e',
    borderRadius: 8,
  },
  goTodayBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
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
  depositTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#f59e0b',
    marginBottom: 4,
  },
  depositAction: {
    fontSize: 12,
    color: '#f59e0b',
    marginTop: 6,
    fontStyle: 'italic',
  },
  lotteryResultsTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#8b5cf6',
    marginBottom: 4,
  },
  resultsPreview: {
    marginTop: 8,
    backgroundColor: '#1e293b80',
    borderRadius: 8,
    padding: 10,
  },
  resultItem: {
    flexDirection: 'column',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  resultLotteryName: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
    marginBottom: 8,
  },
  resultNumbersRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  numberBallFirst: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eab308',
    justifyContent: 'center',
    alignItems: 'center',
  },
  numberBallSecond: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#9ca3af',
    justifyContent: 'center',
    alignItems: 'center',
  },
  numberBallThird: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#b45309',
    justifyContent: 'center',
    alignItems: 'center',
  },
  numberBallText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  resultNumbers: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#8b5cf6',
    fontFamily: 'monospace',
  },
});

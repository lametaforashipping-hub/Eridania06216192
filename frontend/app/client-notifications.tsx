import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  ticket_number?: string;
  amount?: number;
  prize?: number;
  lottery_name?: string;
  reason?: string;
  read: boolean;
  created_at: string;
}

const NOTIFICATION_CONFIG: { [key: string]: { icon: string; color: string; bgColor: string } } = {
  payment_confirmed: { icon: 'checkmark-circle', color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.15)' },
  payment_rejected: { icon: 'close-circle', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.15)' },
  winner: { icon: 'trophy', color: '#fbbf24', bgColor: 'rgba(251, 191, 36, 0.15)' },
  default: { icon: 'notifications', color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.15)' },
};

export default function ClientNotificationsScreen() {
  const router = useRouter();
  const { token, user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });

  // Redirect if not authenticated as client
  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'cliente')) {
      router.replace('/client-login');
    }
  }, [user, authLoading, router]);

  const fetchNotifications = useCallback(async (page = 1) => {
    try {
      const response = await fetch(`${API_URL}/api/clients/notifications?page=${page}&limit=20`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        setPagination({
          page: data.pagination.page,
          total: data.pagination.total,
          totalPages: data.pagination.total_pages,
        });
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchNotifications();
  }, [fetchNotifications, token]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await fetch(`${API_URL}/api/clients/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch(`${API_URL}/api/clients/notifications/read-all`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 60) {
      return `Hace ${diffMins} min`;
    } else if (diffHours < 24) {
      return `Hace ${diffHours}h`;
    } else if (diffDays < 7) {
      return `Hace ${diffDays}d`;
    } else {
      return date.toLocaleDateString('es-DO', {
        day: '2-digit',
        month: 'short',
      });
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#22c55e" style={styles.loader} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Notificaciones</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllAsRead} style={styles.markAllButton}>
            <Text style={styles.markAllText}>Leer todo</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />}
        showsVerticalScrollIndicator={false}
      >
        {notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={64} color="#334155" />
            <Text style={styles.emptyStateTitle}>Sin Notificaciones</Text>
            <Text style={styles.emptyStateText}>
              Aquí aparecerán las notificaciones sobre tus pagos y premios.
            </Text>
          </View>
        ) : (
          <>
            {notifications.map(notification => {
              const config = NOTIFICATION_CONFIG[notification.type] || NOTIFICATION_CONFIG.default;
              
              return (
                <TouchableOpacity
                  key={notification.id}
                  style={[
                    styles.notificationCard,
                    !notification.read && styles.notificationCardUnread
                  ]}
                  onPress={() => !notification.read && markAsRead(notification.id)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.iconContainer, { backgroundColor: config.bgColor }]}>
                    <Ionicons name={config.icon as any} size={24} color={config.color} />
                  </View>
                  
                  <View style={styles.notificationContent}>
                    <View style={styles.notificationHeader}>
                      <Text style={styles.notificationTitle}>{notification.title}</Text>
                      <Text style={styles.notificationTime}>{formatDate(notification.created_at)}</Text>
                    </View>
                    
                    <Text style={styles.notificationMessage}>{notification.message}</Text>
                    
                    {notification.ticket_number && (
                      <View style={styles.ticketInfo}>
                        <Ionicons name="ticket" size={14} color="#64748b" />
                        <Text style={styles.ticketNumber}>{notification.ticket_number}</Text>
                      </View>
                    )}
                    
                    {notification.prize && (
                      <View style={styles.prizeContainer}>
                        <Text style={styles.prizeLabel}>Premio:</Text>
                        <Text style={styles.prizeAmount}>
                          RD$ {notification.prize.toLocaleString()}
                        </Text>
                      </View>
                    )}
                    
                    {notification.reason && (
                      <View style={styles.reasonContainer}>
                        <Text style={styles.reasonLabel}>Razón:</Text>
                        <Text style={styles.reasonText}>{notification.reason}</Text>
                      </View>
                    )}
                  </View>
                  
                  {!notification.read && (
                    <View style={styles.unreadDot} />
                  )}
                </TouchableOpacity>
              );
            })}
            
            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <View style={styles.pagination}>
                <TouchableOpacity
                  style={[styles.paginationButton, pagination.page === 1 && styles.paginationButtonDisabled]}
                  onPress={() => fetchNotifications(pagination.page - 1)}
                  disabled={pagination.page === 1}
                >
                  <Ionicons name="chevron-back" size={20} color={pagination.page === 1 ? '#475569' : '#ffffff'} />
                </TouchableOpacity>
                <Text style={styles.paginationText}>
                  {pagination.page} / {pagination.totalPages}
                </Text>
                <TouchableOpacity
                  style={[styles.paginationButton, pagination.page === pagination.totalPages && styles.paginationButtonDisabled]}
                  onPress={() => fetchNotifications(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                >
                  <Ionicons name="chevron-forward" size={20} color={pagination.page === pagination.totalPages ? '#475569' : '#ffffff'} />
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
        
        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backButton: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  unreadBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  unreadBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  markAllButton: {
    padding: 8,
  },
  markAllText: {
    color: '#22c55e',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    position: 'relative',
  },
  notificationCardUnread: {
    backgroundColor: '#1e3a5f',
    borderLeftWidth: 3,
    borderLeftColor: '#22c55e',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    flex: 1,
  },
  notificationTime: {
    fontSize: 12,
    color: '#64748b',
    marginLeft: 8,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 20,
  },
  ticketInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  ticketNumber: {
    fontSize: 13,
    color: '#64748b',
  },
  prizeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  prizeLabel: {
    fontSize: 13,
    color: '#fbbf24',
    marginRight: 4,
  },
  prizeAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fbbf24',
  },
  reasonContainer: {
    marginTop: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 10,
    borderRadius: 8,
  },
  reasonLabel: {
    fontSize: 12,
    color: '#ef4444',
    marginBottom: 2,
  },
  reasonText: {
    fontSize: 13,
    color: '#fca5a5',
  },
  unreadDot: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22c55e',
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 16,
  },
  paginationButton: {
    padding: 8,
    backgroundColor: '#1e293b',
    borderRadius: 8,
  },
  paginationButtonDisabled: {
    opacity: 0.5,
  },
  paginationText: {
    color: '#94a3b8',
    fontSize: 14,
  },
});

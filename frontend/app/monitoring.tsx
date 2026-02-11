import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
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

interface MonitoringUser {
  user_id: string;
  user_name: string;
  role: string;
  today_sales: number;
  today_wins: number;
  today_profit: number;
  pending_tickets: number;
  active: boolean;
  last_activity: string | null;
  commission_rate: number;
  credit_limit: number;
  balance: number;
}

interface MonitoringSummary {
  total_sales: number;
  total_wins: number;
  total_profit: number;
  total_pending_tickets: number;
  active_sellers: number;
}

export default function Monitoring() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<MonitoringUser[]>([]);
  const [summary, setSummary] = useState<MonitoringSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMonitoring = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/api/monitoring/live`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
        setSummary(data.summary);
      }
    } catch (error) {
      console.error('Error fetching monitoring:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchMonitoring();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchMonitoring, 30000);
    return () => clearInterval(interval);
  }, [fetchMonitoring]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMonitoring();
    setRefreshing(false);
  };

  const formatCurrency = (amount: number) => {
    return `RD$ ${amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;
  };

  const getActivityStatus = (lastActivity: string | null) => {
    if (!lastActivity) return { text: 'Sin actividad', color: '#64748b' };
    const diff = Date.now() - new Date(lastActivity).getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 5) return { text: 'Activo ahora', color: '#22c55e' };
    if (minutes < 30) return { text: `Hace ${minutes} min`, color: '#f59e0b' };
    if (minutes < 60) return { text: `Hace ${minutes} min`, color: '#94a3b8' };
    return { text: 'Inactivo', color: '#ef4444' };
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#22c55e" style={styles.loader} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Monitoreo en Vivo</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Ionicons name="refresh" size={24} color="#22c55e" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={isDesktop && styles.contentDesktop}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />
        }
      >
        {/* Summary Cards */}
        {summary && (
          <View style={[styles.summaryContainer, isDesktop && styles.summaryContainerDesktop]}>
            <View style={styles.summaryCard}>
              <Ionicons name="cash-outline" size={28} color="#22c55e" />
              <Text style={styles.summaryValue}>{formatCurrency(summary.total_sales)}</Text>
              <Text style={styles.summaryLabel}>Ventas Hoy</Text>
            </View>
            <View style={styles.summaryCard}>
              <Ionicons name="trophy-outline" size={28} color="#ef4444" />
              <Text style={[styles.summaryValue, styles.redText]}>{formatCurrency(summary.total_wins)}</Text>
              <Text style={styles.summaryLabel}>Premios</Text>
            </View>
            <View style={[styles.summaryCard, styles.profitCard]}>
              <Ionicons name="trending-up" size={28} color={summary.total_profit >= 0 ? '#22c55e' : '#ef4444'} />
              <Text style={[styles.summaryValue, summary.total_profit >= 0 ? styles.greenText : styles.redText]}>
                {formatCurrency(summary.total_profit)}
              </Text>
              <Text style={styles.summaryLabel}>Ganancia</Text>
            </View>
            <View style={styles.summaryCard}>
              <Ionicons name="ticket-outline" size={28} color="#f59e0b" />
              <Text style={styles.summaryValue}>{summary.total_pending_tickets}</Text>
              <Text style={styles.summaryLabel}>Boletos Pendientes</Text>
            </View>
          </View>
        )}

        {/* Live Status Indicator */}
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>EN VIVO - Actualización cada 30 segundos</Text>
        </View>

        {/* Users Table */}
        <View style={styles.tableContainer}>
          <View style={[styles.tableHeader, isDesktop && styles.tableHeaderDesktop]}>
            <Text style={[styles.tableHeaderText, styles.colName]}>Vendedor</Text>
            <Text style={[styles.tableHeaderText, styles.colSales]}>Ventas</Text>
            <Text style={[styles.tableHeaderText, styles.colProfit]}>Ganancia</Text>
            {isDesktop && <Text style={[styles.tableHeaderText, styles.colTickets]}>Boletos</Text>}
            <Text style={[styles.tableHeaderText, styles.colStatus]}>Estado</Text>
          </View>

          {users.map((u) => {
            const activity = getActivityStatus(u.last_activity);
            return (
              <TouchableOpacity
                key={u.user_id}
                style={[styles.tableRow, !u.active && styles.tableRowInactive]}
                onPress={() => router.push(`/user-report?userId=${u.user_id}&userName=${u.user_name}`)}
              >
                <View style={[styles.tableCell, styles.colName]}>
                  <View style={styles.userInfo}>
                    <View style={[styles.userAvatar, { backgroundColor: u.active ? '#22c55e' : '#64748b' }]}>
                      <Text style={styles.userAvatarText}>{u.user_name.charAt(0)}</Text>
                    </View>
                    <View>
                      <Text style={styles.userName}>{u.user_name}</Text>
                      <Text style={styles.userRole}>
                        {u.role === 'admin' ? 'Admin' : 'Vendedor'} • {u.commission_rate}%
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={[styles.tableCell, styles.colSales]}>
                  <Text style={styles.salesValue}>{formatCurrency(u.today_sales)}</Text>
                  <Text style={styles.winsValue}>-{formatCurrency(u.today_wins)}</Text>
                </View>
                <View style={[styles.tableCell, styles.colProfit]}>
                  <Text style={[styles.profitValue, u.today_profit >= 0 ? styles.greenText : styles.redText]}>
                    {formatCurrency(u.today_profit)}
                  </Text>
                </View>
                {isDesktop && (
                  <View style={[styles.tableCell, styles.colTickets]}>
                    <Text style={styles.ticketsValue}>{u.pending_tickets} pendientes</Text>
                  </View>
                )}
                <View style={[styles.tableCell, styles.colStatus]}>
                  <View style={[styles.statusDot, { backgroundColor: activity.color }]} />
                  <Text style={[styles.statusText, { color: activity.color }]}>{activity.text}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {users.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color="#475569" />
            <Text style={styles.emptyText}>No hay vendedores activos</Text>
          </View>
        )}
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
    backgroundColor: '#1e293b',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  contentDesktop: {
    maxWidth: 1400,
    alignSelf: 'center',
    width: '100%',
  },
  summaryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  summaryContainerDesktop: {
    flexWrap: 'nowrap',
    gap: 16,
  },
  summaryCard: {
    width: '48%',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  profitCard: {
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  greenText: {
    color: '#22c55e',
  },
  redText: {
    color: '#ef4444',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    padding: 8,
    backgroundColor: '#1e293b',
    borderRadius: 20,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    marginRight: 8,
  },
  liveText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  tableContainer: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  tableHeaderDesktop: {
    paddingVertical: 16,
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    alignItems: 'center',
  },
  tableRowInactive: {
    opacity: 0.5,
  },
  tableCell: {
    justifyContent: 'center',
  },
  colName: {
    flex: 2,
  },
  colSales: {
    flex: 1.5,
  },
  colProfit: {
    flex: 1,
  },
  colTickets: {
    flex: 1,
  },
  colStatus: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  userAvatarText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  userName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ffffff',
  },
  userRole: {
    fontSize: 11,
    color: '#94a3b8',
  },
  salesValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22c55e',
  },
  winsValue: {
    fontSize: 11,
    color: '#ef4444',
  },
  profitValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  ticketsValue: {
    fontSize: 13,
    color: '#f59e0b',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 12,
  },
});

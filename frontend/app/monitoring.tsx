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
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const { width } = Dimensions.get('window');
const isDesktop = width > 768;

interface UserMonitoring {
  user_id: string;
  user_name: string;
  role: string;
  active: boolean;
  today_sales: number;
  today_wins: number;
  today_profit: number;
  total_tickets: number;
  pending_tickets: number;
  winning_tickets: number;
  paid_tickets: number;
  commission_rate: number;
  commission_earned: number;
  last_activity: string | null;
  credit_limit: number;
  credit_used: number;
}

interface GlobalStats {
  total_sales: number;
  total_wins: number;
  total_profit: number;
  total_tickets: number;
  active_users: number;
  total_commission: number;
}

export default function MonitoringLive() {
  const { token } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserMonitoring[]>([]);
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserMonitoring | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/monitoring/live`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
        setGlobalStats(data.global_stats || null);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('Error fetching monitoring data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const formatCurrency = (amount: number) => {
    return `RD$ ${amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;
  };

  const getActivityStatus = (lastActivity: string | null) => {
    if (!lastActivity) return { text: 'Sin actividad', color: '#6b7280', icon: 'ellipse' };
    const diff = Date.now() - new Date(lastActivity).getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 5) return { text: 'En línea', color: '#22c55e', icon: 'ellipse' };
    if (minutes < 30) return { text: `Hace ${minutes}m`, color: '#f59e0b', icon: 'ellipse' };
    if (minutes < 60) return { text: `Hace ${minutes}m`, color: '#ef4444', icon: 'ellipse' };
    return { text: 'Inactivo', color: '#6b7280', icon: 'ellipse-outline' };
  };

  const getCreditPercentage = (used: number, limit: number) => {
    if (limit === 0) return 0;
    return Math.min((used / limit) * 100, 100);
  };

  const openUserDetails = (user: UserMonitoring) => {
    setSelectedUser(user);
    setShowUserModal(true);
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
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>📡 Monitoreo en Vivo</Text>
          <Text style={styles.headerSubtitle}>
            Actualizado: {lastUpdate.toLocaleTimeString('es-DO')}
          </Text>
        </View>
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
        {/* Live Indicator */}
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>EN VIVO - Actualización cada 30 segundos</Text>
        </View>

        {/* Global Stats */}
        {globalStats && (
          <View style={styles.globalStatsContainer}>
            <Text style={styles.sectionTitle}>📊 Resumen Global del Día</Text>
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, styles.statCardSales]}>
                <Ionicons name="cash-outline" size={28} color="#22c55e" />
                <Text style={styles.statValue}>{formatCurrency(globalStats.total_sales)}</Text>
                <Text style={styles.statLabel}>Ventas Totales</Text>
              </View>
              <View style={[styles.statCard, styles.statCardWins]}>
                <Ionicons name="trophy-outline" size={28} color="#ef4444" />
                <Text style={[styles.statValue, styles.redText]}>{formatCurrency(globalStats.total_wins)}</Text>
                <Text style={styles.statLabel}>Premios Pagados</Text>
              </View>
              <View style={[styles.statCard, styles.statCardProfit]}>
                <Ionicons name="trending-up" size={28} color="#3b82f6" />
                <Text style={[styles.statValue, globalStats.total_profit >= 0 ? styles.greenText : styles.redText]}>
                  {formatCurrency(globalStats.total_profit)}
                </Text>
                <Text style={styles.statLabel}>Ganancia Neta</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="ticket-outline" size={28} color="#f59e0b" />
                <Text style={styles.statValue}>{globalStats.total_tickets}</Text>
                <Text style={styles.statLabel}>Boletos Vendidos</Text>
              </View>
            </View>
          </View>
        )}

        {/* Users/Bancas List */}
        <View style={styles.usersSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🏪 Bancas / Vendedores ({users.length})</Text>
            <View style={styles.activeIndicator}>
              <View style={[styles.activeDot, { backgroundColor: '#22c55e' }]} />
              <Text style={styles.activeText}>{users.filter(u => u.active).length} activos</Text>
            </View>
          </View>

          {users.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color="#475569" />
              <Text style={styles.emptyText}>No hay vendedores registrados</Text>
            </View>
          ) : (
            users.map((user) => {
              const activity = getActivityStatus(user.last_activity);
              const creditPct = getCreditPercentage(user.credit_used, user.credit_limit);
              
              return (
                <TouchableOpacity
                  key={user.user_id}
                  style={[styles.userCard, !user.active && styles.userCardInactive]}
                  onPress={() => openUserDetails(user)}
                >
                  {/* User Header */}
                  <View style={styles.userHeader}>
                    <View style={styles.userIdentity}>
                      <View style={[styles.avatar, { backgroundColor: activity.color }]}>
                        <Text style={styles.avatarText}>
                          {user.user_name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.userInfo}>
                        <Text style={styles.userName}>{user.user_name}</Text>
                        <View style={styles.userMeta}>
                          <Text style={styles.userRole}>
                            {user.role === 'vendedor' ? '🏪 Vendedor' : '👔 Admin'} 
                          </Text>
                          <Text style={styles.commissionBadge}>
                            {user.commission_rate}% comisión
                          </Text>
                        </View>
                      </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: activity.color + '20' }]}>
                      <Ionicons name={activity.icon as any} size={8} color={activity.color} />
                      <Text style={[styles.statusText, { color: activity.color }]}>
                        {activity.text}
                      </Text>
                    </View>
                  </View>

                  {/* Sales Stats */}
                  <View style={styles.salesStats}>
                    <View style={styles.salesItem}>
                      <Text style={styles.salesLabel}>💰 Ventas</Text>
                      <Text style={styles.salesValueGreen}>{formatCurrency(user.today_sales)}</Text>
                    </View>
                    <View style={styles.salesItem}>
                      <Text style={styles.salesLabel}>🏆 Premios</Text>
                      <Text style={styles.salesValueRed}>{formatCurrency(user.today_wins)}</Text>
                    </View>
                    <View style={styles.salesItem}>
                      <Text style={styles.salesLabel}>📈 Ganancia</Text>
                      <Text style={[
                        styles.salesValueBold,
                        user.today_profit >= 0 ? styles.greenText : styles.redText
                      ]}>
                        {formatCurrency(user.today_profit)}
                      </Text>
                    </View>
                  </View>

                  {/* Tickets Progress */}
                  <View style={styles.ticketsRow}>
                    <View style={styles.ticketStat}>
                      <Ionicons name="ticket" size={14} color="#3b82f6" />
                      <Text style={styles.ticketStatText}>{user.total_tickets} vendidos</Text>
                    </View>
                    <View style={styles.ticketStat}>
                      <Ionicons name="time" size={14} color="#f59e0b" />
                      <Text style={styles.ticketStatText}>{user.pending_tickets} pendientes</Text>
                    </View>
                    <View style={styles.ticketStat}>
                      <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
                      <Text style={styles.ticketStatText}>{user.paid_tickets} pagados</Text>
                    </View>
                  </View>

                  {/* Credit Bar */}
                  <View style={styles.creditSection}>
                    <View style={styles.creditHeader}>
                      <Text style={styles.creditLabel}>Crédito utilizado</Text>
                      <Text style={styles.creditValue}>
                        {formatCurrency(user.credit_used)} / {formatCurrency(user.credit_limit)}
                      </Text>
                    </View>
                    <View style={styles.creditBarBg}>
                      <View style={[
                        styles.creditBarFill,
                        { width: `${creditPct}%` },
                        creditPct > 80 ? styles.creditBarDanger : 
                        creditPct > 50 ? styles.creditBarWarning : styles.creditBarSafe
                      ]} />
                    </View>
                  </View>

                  {/* Commission Earned */}
                  <View style={styles.commissionRow}>
                    <Text style={styles.commissionLabel}>💵 Comisión ganada hoy:</Text>
                    <Text style={styles.commissionValue}>{formatCurrency(user.commission_earned)}</Text>
                  </View>

                  {/* View Details Button */}
                  <View style={styles.cardFooter}>
                    <Text style={styles.viewDetails}>Ver detalles completos →</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* User Details Modal */}
      <Modal visible={showUserModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDesktop && styles.modalContentDesktop]}>
            {selectedUser && (
              <>
                <View style={styles.modalHeader}>
                  <View style={styles.modalUserInfo}>
                    <View style={[styles.modalAvatar, { backgroundColor: '#22c55e' }]}>
                      <Text style={styles.modalAvatarText}>
                        {selectedUser.user_name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.modalUserName}>{selectedUser.user_name}</Text>
                      <Text style={styles.modalUserRole}>
                        {selectedUser.role === 'vendedor' ? 'Vendedor' : 'Administrador'}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => setShowUserModal(false)}>
                    <Ionicons name="close" size={24} color="#ffffff" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalBody}>
                  {/* Quick Stats */}
                  <View style={styles.modalStatsGrid}>
                    <View style={styles.modalStatCard}>
                      <Text style={styles.modalStatLabel}>Ventas Hoy</Text>
                      <Text style={[styles.modalStatValue, styles.greenText]}>
                        {formatCurrency(selectedUser.today_sales)}
                      </Text>
                    </View>
                    <View style={styles.modalStatCard}>
                      <Text style={styles.modalStatLabel}>Premios Pagados</Text>
                      <Text style={[styles.modalStatValue, styles.redText]}>
                        {formatCurrency(selectedUser.today_wins)}
                      </Text>
                    </View>
                    <View style={styles.modalStatCard}>
                      <Text style={styles.modalStatLabel}>Ganancia Neta</Text>
                      <Text style={[styles.modalStatValue, selectedUser.today_profit >= 0 ? styles.greenText : styles.redText]}>
                        {formatCurrency(selectedUser.today_profit)}
                      </Text>
                    </View>
                    <View style={styles.modalStatCard}>
                      <Text style={styles.modalStatLabel}>Comisión</Text>
                      <Text style={[styles.modalStatValue, { color: '#f59e0b' }]}>
                        {formatCurrency(selectedUser.commission_earned)}
                      </Text>
                    </View>
                  </View>

                  {/* Ticket Details */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>📋 Boletos del Día</Text>
                    <View style={styles.modalDetailRow}>
                      <Text style={styles.modalDetailLabel}>Total vendidos:</Text>
                      <Text style={styles.modalDetailValue}>{selectedUser.total_tickets}</Text>
                    </View>
                    <View style={styles.modalDetailRow}>
                      <Text style={styles.modalDetailLabel}>Pendientes:</Text>
                      <Text style={[styles.modalDetailValue, { color: '#f59e0b' }]}>
                        {selectedUser.pending_tickets}
                      </Text>
                    </View>
                    <View style={styles.modalDetailRow}>
                      <Text style={styles.modalDetailLabel}>Ganadores:</Text>
                      <Text style={[styles.modalDetailValue, { color: '#22c55e' }]}>
                        {selectedUser.winning_tickets}
                      </Text>
                    </View>
                    <View style={styles.modalDetailRow}>
                      <Text style={styles.modalDetailLabel}>Pagados:</Text>
                      <Text style={styles.modalDetailValue}>{selectedUser.paid_tickets}</Text>
                    </View>
                  </View>

                  {/* Credit Details */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>💳 Límite de Crédito</Text>
                    <View style={styles.modalDetailRow}>
                      <Text style={styles.modalDetailLabel}>Límite:</Text>
                      <Text style={styles.modalDetailValue}>{formatCurrency(selectedUser.credit_limit)}</Text>
                    </View>
                    <View style={styles.modalDetailRow}>
                      <Text style={styles.modalDetailLabel}>Utilizado:</Text>
                      <Text style={styles.modalDetailValue}>{formatCurrency(selectedUser.credit_used)}</Text>
                    </View>
                    <View style={styles.modalDetailRow}>
                      <Text style={styles.modalDetailLabel}>Disponible:</Text>
                      <Text style={[styles.modalDetailValue, styles.greenText]}>
                        {formatCurrency(selectedUser.credit_limit - selectedUser.credit_used)}
                      </Text>
                    </View>
                  </View>

                  {/* Commission Details */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>📊 Comisión</Text>
                    <View style={styles.modalDetailRow}>
                      <Text style={styles.modalDetailLabel}>Tasa:</Text>
                      <Text style={styles.modalDetailValue}>{selectedUser.commission_rate}%</Text>
                    </View>
                    <View style={styles.modalDetailRow}>
                      <Text style={styles.modalDetailLabel}>Ganada hoy:</Text>
                      <Text style={[styles.modalDetailValue, { color: '#f59e0b' }]}>
                        {formatCurrency(selectedUser.commission_earned)}
                      </Text>
                    </View>
                  </View>
                </ScrollView>

                <View style={styles.modalActions}>
                  <TouchableOpacity 
                    style={styles.modalActionButton}
                    onPress={() => {
                      setShowUserModal(false);
                      router.push(`/user-report?userId=${selectedUser.user_id}&userName=${selectedUser.user_name}`);
                    }}
                  >
                    <Ionicons name="bar-chart" size={20} color="#ffffff" />
                    <Text style={styles.modalActionText}>Ver Reporte Completo</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
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
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  contentDesktop: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    backgroundColor: '#1e293b',
    borderRadius: 20,
    marginBottom: 16,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
    marginRight: 8,
  },
  liveText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  globalStatsContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: isDesktop ? '24%' : '48%',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  statCardSales: {
    borderLeftWidth: 3,
    borderLeftColor: '#22c55e',
  },
  statCardWins: {
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
  },
  statCardProfit: {
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
    textAlign: 'center',
  },
  greenText: { color: '#22c55e' },
  redText: { color: '#ef4444' },
  usersSection: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  activeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  activeText: {
    fontSize: 12,
    color: '#22c55e',
  },
  emptyState: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 12,
  },
  userCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  userCardInactive: {
    opacity: 0.6,
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  userIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  userRole: {
    fontSize: 12,
    color: '#94a3b8',
    marginRight: 8,
  },
  commissionBadge: {
    fontSize: 10,
    color: '#f59e0b',
    backgroundColor: '#422006',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
    marginLeft: 4,
  },
  salesStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  salesItem: {
    alignItems: 'center',
    flex: 1,
  },
  salesLabel: {
    fontSize: 10,
    color: '#64748b',
    marginBottom: 4,
  },
  salesValueGreen: {
    fontSize: 13,
    fontWeight: '700',
    color: '#22c55e',
  },
  salesValueRed: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ef4444',
  },
  salesValueBold: {
    fontSize: 13,
    fontWeight: '700',
  },
  ticketsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  ticketStat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ticketStatText: {
    fontSize: 11,
    color: '#94a3b8',
    marginLeft: 4,
  },
  creditSection: {
    marginBottom: 12,
  },
  creditHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  creditLabel: {
    fontSize: 11,
    color: '#64748b',
  },
  creditValue: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },
  creditBarBg: {
    height: 6,
    backgroundColor: '#334155',
    borderRadius: 3,
    overflow: 'hidden',
  },
  creditBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  creditBarSafe: {
    backgroundColor: '#22c55e',
  },
  creditBarWarning: {
    backgroundColor: '#f59e0b',
  },
  creditBarDanger: {
    backgroundColor: '#ef4444',
  },
  commissionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#422006',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  commissionLabel: {
    fontSize: 12,
    color: '#fbbf24',
  },
  commissionValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fbbf24',
  },
  cardFooter: {
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  viewDetails: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  modalContentDesktop: {
    maxWidth: 500,
    alignSelf: 'center',
    width: '100%',
    borderRadius: 20,
    marginBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  modalUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  modalAvatarText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  modalUserName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  modalUserRole: {
    fontSize: 13,
    color: '#94a3b8',
  },
  modalBody: {
    padding: 20,
  },
  modalStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalStatCard: {
    width: '48%',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  modalStatLabel: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 4,
  },
  modalStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  modalSection: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 8,
  },
  modalDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  modalDetailLabel: {
    fontSize: 13,
    color: '#94a3b8',
  },
  modalDetailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  modalActions: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  modalActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    padding: 14,
    borderRadius: 10,
  },
  modalActionText: {
    color: '#ffffff',
    fontWeight: '600',
    marginLeft: 8,
  },
});

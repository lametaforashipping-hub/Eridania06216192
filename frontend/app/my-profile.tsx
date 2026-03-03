import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Alert,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const { width } = Dimensions.get('window');
const isDesktop = width > 768;

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  balance: number;
  credit_limit: number;
  commission_rate: number;
  currency: string;
  phone?: string;
  address?: string;
  cedula?: string;
  terminal_id?: string;
  active: boolean;
  total_sales?: number;
  total_commission?: number;
}

interface TodayStats {
  sales: number;
  wins: number;
  commission: number;
  net: number;
  tickets_count: number;
  pending: number;
  won: number;
  cancelled: number;
}

interface WeekStats {
  sales: number;
  commission: number;
  tickets_count: number;
}

interface Ticket {
  id: string;
  ticket_number: string;
  total_amount?: number;
  amount?: number;
  status: string;
  created_at: string;
  currency: string;
}

interface Transaction {
  id: string;
  transaction_type: string;
  amount: number;
  currency: string;
  description: string;
  created_at: string;
}

export default function MyProfile() {
  const { token, user: authUser, logout } = useAuth();
  const router = useRouter();
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [todayStats, setTodayStats] = useState<TodayStats | null>(null);
  const [weekStats, setWeekStats] = useState<WeekStats | null>(null);
  const [recentTickets, setRecentTickets] = useState<Ticket[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Transaction filter
  const [transactionFilter, setTransactionFilter] = useState<string>('all');
  
  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/api/users/me/profile`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setProfile(data.user);
        setTodayStats(data.today_stats);
        setWeekStats(data.week_stats);
        setRecentTickets(data.recent_tickets || []);
        setRecentTransactions(data.recent_transactions || []);
        
        // Set edit fields
        setEditName(data.user.name || '');
        setEditPhone(data.user.phone || '');
        setEditAddress(data.user.address || '');
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProfile();
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const params = new URLSearchParams();
      if (editName) params.append('name', editName);
      if (editPhone) params.append('phone', editPhone);
      if (editAddress) params.append('address', editAddress);
      
      const response = await fetch(`${API_URL}/api/users/me/profile?${params.toString()}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (response.ok) {
        Alert.alert('Éxito', 'Perfil actualizado correctamente');
        setEditing(false);
        fetchProfile();
      } else {
        Alert.alert('Error', 'No se pudo actualizar el perfil');
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('es-DO', { minimumFractionDigits: 2 });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-DO', {
      timeZone: 'America/Santo_Domingo',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'won': return '#22c55e';
      case 'cancelled': return '#ef4444';
      case 'pending': return '#f59e0b';
      default: return '#64748b';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'won': return 'Ganador';
      case 'cancelled': return 'Cancelado';
      case 'pending': return 'Pendiente';
      case 'lost': return 'No Ganó';
      default: return status;
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'deposit': return 'arrow-down-circle';
      case 'sale': return 'cart';
      case 'commission': return 'trending-up';
      case 'withdrawal': return 'arrow-up-circle';
      case 'prize_payment': return 'trophy';
      default: return 'swap-horizontal';
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'deposit': return '#22c55e';
      case 'commission': return '#22c55e';
      case 'sale': return '#3b82f6';
      case 'withdrawal': return '#ef4444';
      case 'prize_payment': return '#f59e0b';
      default: return '#64748b';
    }
  };

  const getTransactionLabel = (type: string) => {
    switch (type) {
      case 'deposit': return 'Depósito';
      case 'sale': return 'Venta';
      case 'commission': return 'Comisión';
      case 'withdrawal': return 'Retiro';
      case 'prize_payment': return 'Premio';
      default: return type;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#22c55e" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#ef4444" />
          <Text style={styles.errorText}>No se pudo cargar el perfil</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchProfile}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mi Perfil</Text>
        <TouchableOpacity onPress={() => setEditing(!editing)} style={styles.editButton}>
          <Ionicons name={editing ? "close" : "create-outline"} size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />}
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {profile.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
              </Text>
            </View>
            <View style={[styles.statusBadge, profile.active ? styles.activeBadge : styles.inactiveBadge]}>
              <Text style={styles.statusBadgeText}>{profile.active ? 'Activo' : 'Inactivo'}</Text>
            </View>
          </View>
          
          {editing ? (
            <View style={styles.editForm}>
              <Text style={styles.editLabel}>Nombre</Text>
              <TextInput
                style={styles.editInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Tu nombre"
                placeholderTextColor="#64748b"
              />
              
              <Text style={styles.editLabel}>Teléfono</Text>
              <TextInput
                style={styles.editInput}
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder="Tu teléfono"
                placeholderTextColor="#64748b"
                keyboardType="phone-pad"
              />
              
              <Text style={styles.editLabel}>Dirección</Text>
              <TextInput
                style={styles.editInput}
                value={editAddress}
                onChangeText={setEditAddress}
                placeholder="Tu dirección"
                placeholderTextColor="#64748b"
                multiline
              />
              
              <TouchableOpacity 
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSaveProfile}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Guardar Cambios</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.profileName}>{profile.name}</Text>
              <Text style={styles.profileEmail}>{profile.email}</Text>
              <Text style={styles.profileRole}>
                {profile.role === 'vendedor' ? 'Vendedor' : profile.role === 'admin' ? 'Administrador' : 'Super Admin'}
              </Text>
              
              {profile.phone && (
                <View style={styles.infoRow}>
                  <Ionicons name="call-outline" size={16} color="#64748b" />
                  <Text style={styles.infoText}>{profile.phone}</Text>
                </View>
              )}
              
              {profile.terminal_id && (
                <View style={styles.infoRow}>
                  <Ionicons name="hardware-chip-outline" size={16} color="#64748b" />
                  <Text style={styles.infoText}>Terminal: {profile.terminal_id}</Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceRow}>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceLabel}>Balance Disponible</Text>
              <Text style={styles.balanceValue}>
                {profile.currency} {formatCurrency(profile.balance)}
              </Text>
            </View>
            <View style={styles.balanceDivider} />
            <View style={styles.balanceItem}>
              <Text style={styles.balanceLabel}>Límite de Crédito</Text>
              <Text style={styles.balanceValueSmall}>
                {profile.currency} {formatCurrency(profile.credit_limit)}
              </Text>
            </View>
          </View>
          <View style={styles.commissionRow}>
            <Ionicons name="trending-up" size={18} color="#22c55e" />
            <Text style={styles.commissionText}>Comisión: {profile.commission_rate || 10}%</Text>
          </View>
        </View>

        {/* Today Stats */}
        {todayStats && (
          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>Estadísticas de Hoy</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{profile.currency} {formatCurrency(todayStats.sales)}</Text>
                <Text style={styles.statLabel}>Ventas</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{todayStats.tickets_count}</Text>
                <Text style={styles.statLabel}>Boletos</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#22c55e' }]}>
                  {profile.currency} {formatCurrency(todayStats.commission)}
                </Text>
                <Text style={styles.statLabel}>Comisión</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#f59e0b' }]}>{todayStats.pending}</Text>
                <Text style={styles.statLabel}>Pendientes</Text>
              </View>
            </View>
          </View>
        )}

        {/* Week Stats */}
        {weekStats && (
          <View style={styles.weekCard}>
            <Text style={styles.weekTitle}>Esta Semana</Text>
            <View style={styles.weekRow}>
              <View style={styles.weekItem}>
                <Text style={styles.weekValue}>{profile.currency} {formatCurrency(weekStats.sales)}</Text>
                <Text style={styles.weekLabel}>Ventas</Text>
              </View>
              <View style={styles.weekItem}>
                <Text style={styles.weekValue}>{weekStats.tickets_count}</Text>
                <Text style={styles.weekLabel}>Boletos</Text>
              </View>
              <View style={styles.weekItem}>
                <Text style={[styles.weekValue, { color: '#22c55e' }]}>
                  {profile.currency} {formatCurrency(weekStats.commission)}
                </Text>
                <Text style={styles.weekLabel}>Comisión</Text>
              </View>
            </View>
          </View>
        )}

        {/* Monthly Report Button */}
        <TouchableOpacity 
          style={styles.reportButton} 
          onPress={() => router.push('/monthly-report')}
        >
          <View style={styles.reportButtonContent}>
            <View style={styles.reportIconContainer}>
              <Ionicons name="bar-chart" size={24} color="#22c55e" />
            </View>
            <View style={styles.reportTextContainer}>
              <Text style={styles.reportButtonTitle}>Reportes Mensuales</Text>
              <Text style={styles.reportButtonSubtitle}>Ver gráficos y estadísticas detalladas</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#64748b" />
          </View>
        </TouchableOpacity>

        {/* Recent Tickets */}
        <View style={styles.ticketsCard}>
          <Text style={styles.ticketsTitle}>Boletos Recientes</Text>
          {recentTickets.length === 0 ? (
            <Text style={styles.noTickets}>No hay boletos recientes</Text>
          ) : (
            recentTickets.slice(0, 10).map((ticket) => (
              <TouchableOpacity 
                key={ticket.id} 
                style={styles.ticketItem}
                onPress={() => router.push(`/ticket-detail?ticketId=${ticket.id}`)}
              >
                <View style={styles.ticketLeft}>
                  <Text style={styles.ticketNumber}>{ticket.ticket_number}</Text>
                  <Text style={styles.ticketDate}>{formatDate(ticket.created_at)}</Text>
                </View>
                <View style={styles.ticketRight}>
                  <Text style={styles.ticketAmount}>
                    {ticket.currency} {formatCurrency(ticket.total_amount || ticket.amount || 0)}
                  </Text>
                  <View style={[styles.ticketStatus, { backgroundColor: getStatusColor(ticket.status) + '20' }]}>
                    <Text style={[styles.ticketStatusText, { color: getStatusColor(ticket.status) }]}>
                      {getStatusText(ticket.status)}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Recent Transactions */}
        <View style={styles.transactionsCard}>
          <Text style={styles.transactionsTitle}>Historial de Transacciones</Text>
          
          {/* Transaction Filters */}
          <View style={styles.filterContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
              <TouchableOpacity
                style={[styles.filterButton, transactionFilter === 'all' && styles.filterButtonActive]}
                onPress={() => setTransactionFilter('all')}
              >
                <Text style={[styles.filterButtonText, transactionFilter === 'all' && styles.filterButtonTextActive]}>
                  Todos
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterButton, transactionFilter === 'sale' && styles.filterButtonActive]}
                onPress={() => setTransactionFilter('sale')}
              >
                <Ionicons name="cart" size={14} color={transactionFilter === 'sale' ? '#fff' : '#3b82f6'} />
                <Text style={[styles.filterButtonText, transactionFilter === 'sale' && styles.filterButtonTextActive]}>
                  Ventas
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterButton, transactionFilter === 'commission' && styles.filterButtonActive]}
                onPress={() => setTransactionFilter('commission')}
              >
                <Ionicons name="trending-up" size={14} color={transactionFilter === 'commission' ? '#fff' : '#22c55e'} />
                <Text style={[styles.filterButtonText, transactionFilter === 'commission' && styles.filterButtonTextActive]}>
                  Comisiones
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterButton, transactionFilter === 'deposit' && styles.filterButtonActive]}
                onPress={() => setTransactionFilter('deposit')}
              >
                <Ionicons name="arrow-down-circle" size={14} color={transactionFilter === 'deposit' ? '#fff' : '#22c55e'} />
                <Text style={[styles.filterButtonText, transactionFilter === 'deposit' && styles.filterButtonTextActive]}>
                  Depósitos
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
          
          {/* Transaction Summary */}
          {recentTransactions.length > 0 && (
            <View style={styles.transactionSummary}>
              <View style={styles.summaryItem}>
                <View style={[styles.summaryIcon, { backgroundColor: '#3b82f620' }]}>
                  <Ionicons name="cart" size={16} color="#3b82f6" />
                </View>
                <View>
                  <Text style={styles.summaryLabel}>Ventas</Text>
                  <Text style={[styles.summaryValue, { color: '#3b82f6' }]}>
                    {profile?.currency} {formatCurrency(recentTransactions.filter(t => t.transaction_type === 'sale').reduce((sum, t) => sum + t.amount, 0))}
                  </Text>
                </View>
              </View>
              <View style={styles.summaryItem}>
                <View style={[styles.summaryIcon, { backgroundColor: '#22c55e20' }]}>
                  <Ionicons name="trending-up" size={16} color="#22c55e" />
                </View>
                <View>
                  <Text style={styles.summaryLabel}>Comisiones</Text>
                  <Text style={[styles.summaryValue, { color: '#22c55e' }]}>
                    {profile?.currency} {formatCurrency(recentTransactions.filter(t => t.transaction_type === 'commission').reduce((sum, t) => sum + t.amount, 0))}
                  </Text>
                </View>
              </View>
              <View style={styles.summaryItem}>
                <View style={[styles.summaryIcon, { backgroundColor: '#f59e0b20' }]}>
                  <Ionicons name="arrow-down-circle" size={16} color="#f59e0b" />
                </View>
                <View>
                  <Text style={styles.summaryLabel}>Depósitos</Text>
                  <Text style={[styles.summaryValue, { color: '#f59e0b' }]}>
                    {profile?.currency} {formatCurrency(recentTransactions.filter(t => t.transaction_type === 'deposit').reduce((sum, t) => sum + t.amount, 0))}
                  </Text>
                </View>
              </View>
            </View>
          )}
          
          {recentTransactions.filter(t => transactionFilter === 'all' || t.transaction_type === transactionFilter).length === 0 ? (
            <Text style={styles.noTransactions}>
              {transactionFilter === 'all' ? 'No hay transacciones recientes' : `No hay ${getTransactionLabel(transactionFilter).toLowerCase()}s recientes`}
            </Text>
          ) : (
            recentTransactions
              .filter(t => transactionFilter === 'all' || t.transaction_type === transactionFilter)
              .slice(0, 15)
              .map((transaction) => (
              <View key={transaction.id} style={styles.transactionItem}>
                <View style={styles.transactionLeft}>
                  <View style={[styles.transactionIconContainer, { backgroundColor: getTransactionColor(transaction.transaction_type) + '20' }]}>
                    <Ionicons 
                      name={getTransactionIcon(transaction.transaction_type) as any} 
                      size={18} 
                      color={getTransactionColor(transaction.transaction_type)} 
                    />
                  </View>
                  <View style={styles.transactionInfo}>
                    <Text style={styles.transactionType}>{getTransactionLabel(transaction.transaction_type)}</Text>
                    <Text style={styles.transactionDesc} numberOfLines={1}>
                      {transaction.description}
                    </Text>
                    <Text style={styles.transactionDate}>{formatDate(transaction.created_at)}</Text>
                  </View>
                </View>
                <Text style={[styles.transactionAmount, { color: getTransactionColor(transaction.transaction_type) }]}>
                  {transaction.transaction_type === 'withdrawal' ? '-' : '+'}{transaction.currency} {formatCurrency(transaction.amount)}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={styles.logoutText}>Cerrar Sesión</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#111',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  editButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#22c55e',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  profileCard: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  statusBadge: {
    position: 'absolute',
    bottom: 0,
    right: -10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  activeBadge: {
    backgroundColor: '#22c55e',
  },
  inactiveBadge: {
    backgroundColor: '#ef4444',
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  profileName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
  },
  profileRole: {
    fontSize: 12,
    color: '#22c55e',
    backgroundColor: '#22c55e20',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  infoText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  editForm: {
    width: '100%',
    marginTop: 8,
  },
  editLabel: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 4,
    marginTop: 12,
  },
  editInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  saveButton: {
    backgroundColor: '#22c55e',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  balanceCard: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceItem: {
    flex: 1,
    alignItems: 'center',
  },
  balanceDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#333',
  },
  balanceLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#22c55e',
  },
  balanceValueSmall: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  commissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  commissionText: {
    color: '#22c55e',
    fontSize: 14,
    fontWeight: '600',
  },
  statsCard: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statItem: {
    width: '50%',
    paddingVertical: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  weekCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  weekTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 12,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  weekItem: {
    alignItems: 'center',
  },
  weekValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  weekLabel: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
  },
  ticketsCard: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  ticketsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  noTickets: {
    color: '#64748b',
    textAlign: 'center',
    paddingVertical: 20,
  },
  ticketItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  ticketLeft: {},
  ticketNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  ticketDate: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  ticketRight: {
    alignItems: 'flex-end',
  },
  ticketAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  ticketStatus: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  ticketStatusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ef444440',
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
  transactionsCard: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  transactionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  noTransactions: {
    color: '#64748b',
    textAlign: 'center',
    paddingVertical: 20,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  transactionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  transactionDesc: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  transactionDate: {
    fontSize: 10,
    color: '#4b5563',
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  filterContainer: {
    marginBottom: 16,
  },
  filterScroll: {
    flexDirection: 'row',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    marginRight: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#333',
  },
  filterButtonActive: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#94a3b8',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  transactionSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#0a0a0a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryLabel: {
    fontSize: 10,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  reportButton: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#22c55e30',
  },
  reportButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reportIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#22c55e15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  reportButtonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  reportButtonSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
});

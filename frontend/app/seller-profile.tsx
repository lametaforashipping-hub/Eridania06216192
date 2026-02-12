import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Alert,
  TextInput,
  FlatList,
  Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const { width } = Dimensions.get('window');
const isDesktop = width > 768;

interface Seller {
  id: string;
  name: string;
  email: string;
  role: string;
  balance: number;
  credit_limit: number;
  commission_rate: number;
  currency: string;
  country: string;
  phone?: string;
  address?: string;
  cedula?: string;
  terminal_id?: string;
  active: boolean;
  created_at: string;
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

interface Ticket {
  id: string;
  ticket_number: string;
  lottery_name?: string;
  ticket_type?: string;
  plays?: any[];
  numbers?: number[];
  amount?: number;
  total_amount?: number;
  potential_win?: number;
  total_potential_win?: number;
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

export default function SellerProfile() {
  const { token, user } = useAuth();
  const router = useRouter();
  const { sellerId, sellerName } = useLocalSearchParams<{ sellerId: string; sellerName?: string }>();
  
  const [seller, setSeller] = useState<Seller | null>(null);
  const [todayStats, setTodayStats] = useState<TodayStats | null>(null);
  const [recentTickets, setRecentTickets] = useState<Ticket[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  
  // Edit modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editCreditLimit, setEditCreditLimit] = useState('');
  const [editCommissionRate, setEditCommissionRate] = useState('');
  const [editBalance, setEditBalance] = useState('');
  const [saving, setSaving] = useState(false);
  
  // Deposit modal
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');

  const fetchSellerProfile = useCallback(async () => {
    if (!token || !sellerId) return;
    try {
      const response = await fetch(`${API_URL}/api/admin/seller-profile/${sellerId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSeller(data.seller);
        setTodayStats(data.today_stats);
        setRecentTickets(data.recent_tickets || []);
        setRecentTransactions(data.recent_transactions || []);
      }
    } catch (error) {
      console.error('Error fetching seller profile:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, sellerId]);

  useEffect(() => {
    fetchSellerProfile();
  }, [fetchSellerProfile]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSellerProfile();
  };

  const handleCancelTicket = async (ticket: Ticket) => {
    Alert.alert(
      'Cancelar Boleto',
      `¿Cancelar boleto ${ticket.ticket_number}?\n\nMonto: ${ticket.currency} ${(ticket.amount || ticket.total_amount || 0).toLocaleString()}`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, Cancelar',
          style: 'destructive',
          onPress: async () => {
            setCancelling(ticket.id);
            try {
              const response = await fetch(`${API_URL}/api/tickets/${ticket.id}/cancel`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
              });
              if (response.ok) {
                Alert.alert('Éxito', 'Boleto cancelado');
                fetchSellerProfile();
              } else {
                const error = await response.json();
                Alert.alert('Error', error.detail || 'No se pudo cancelar');
              }
            } catch (error) {
              Alert.alert('Error', 'Error de conexión');
            } finally {
              setCancelling(null);
            }
          }
        }
      ]
    );
  };

  const handleUpdateSeller = async () => {
    if (!seller) return;
    setSaving(true);
    try {
      const updates: any = {};
      if (editCreditLimit) updates.credit_limit = parseFloat(editCreditLimit);
      if (editCommissionRate) updates.commission_rate = parseFloat(editCommissionRate);
      
      const response = await fetch(`${API_URL}/api/users/${seller.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      
      if (response.ok) {
        Alert.alert('Éxito', 'Vendedor actualizado');
        setShowEditModal(false);
        fetchSellerProfile();
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'No se pudo actualizar');
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const handleDeposit = async () => {
    if (!seller || !depositAmount) return;
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/users/${seller.id}/deposit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount: parseFloat(depositAmount) }),
      });
      
      if (response.ok) {
        Alert.alert('Éxito', `Depósito de ${seller.currency} ${parseFloat(depositAmount).toLocaleString()} realizado`);
        setShowDepositModal(false);
        setDepositAmount('');
        fetchSellerProfile();
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'No se pudo realizar el depósito');
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!seller) return;
    Alert.alert(
      seller.active ? 'Desactivar Vendedor' : 'Activar Vendedor',
      `¿${seller.active ? 'Desactivar' : 'Activar'} a ${seller.name}?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí',
          onPress: async () => {
            try {
              const response = await fetch(`${API_URL}/api/users/${seller.id}`, {
                method: 'PUT',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ active: !seller.active }),
              });
              if (response.ok) {
                Alert.alert('Éxito', `Vendedor ${seller.active ? 'desactivado' : 'activado'}`);
                fetchSellerProfile();
              }
            } catch (error) {
              Alert.alert('Error', 'Error de conexión');
            }
          }
        }
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#f59e0b';
      case 'won': return '#22c55e';
      case 'paid': return '#3b82f6';
      case 'lost': return '#ef4444';
      case 'cancelled': return '#64748b';
      default: return '#94a3b8';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'PEND';
      case 'won': return 'GAN';
      case 'paid': return 'PAG';
      case 'lost': return 'PERD';
      case 'cancelled': return 'CANC';
      default: return status;
    }
  };

  const openEditModal = () => {
    if (seller) {
      setEditCreditLimit(seller.credit_limit.toString());
      setEditCommissionRate(seller.commission_rate.toString());
      setShowEditModal(true);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#22c55e" style={styles.loader} />
      </SafeAreaView>
    );
  }

  if (!seller) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Vendedor no encontrado</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} data-testid="back-button">
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Perfil del Vendedor</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Ionicons name="refresh" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />}
      >
        {/* Seller Info Card */}
        <View style={styles.sellerCard}>
          <View style={styles.sellerHeader}>
            <View style={styles.sellerAvatar}>
              <Text style={styles.sellerAvatarText}>
                {seller.terminal_id?.slice(0, 2) || seller.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.sellerInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.sellerName}>{seller.name}</Text>
                {seller.terminal_id && (
                  <View style={styles.terminalBadge}>
                    <Text style={styles.terminalText}>{seller.terminal_id}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.sellerEmail}>{seller.email}</Text>
              {seller.phone && <Text style={styles.sellerPhone}>{seller.phone}</Text>}
            </View>
            <TouchableOpacity
              style={[styles.statusToggle, seller.active ? styles.statusActive : styles.statusInactive]}
              onPress={handleToggleStatus}
            >
              <Text style={styles.statusToggleText}>{seller.active ? 'Activo' : 'Inactivo'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.sellerDetails}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Balance</Text>
              <Text style={[styles.detailValue, styles.greenText]}>
                {seller.currency} {seller.balance.toLocaleString()}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Límite de Crédito</Text>
              <Text style={styles.detailValue}>
                {seller.currency} {seller.credit_limit.toLocaleString()}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Comisión</Text>
              <Text style={[styles.detailValue, styles.yellowText]}>{seller.commission_rate || 10}%</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => setShowDepositModal(true)}>
              <Ionicons name="wallet" size={18} color="#22c55e" />
              <Text style={styles.actionBtnText}>Depositar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={openEditModal}>
              <Ionicons name="create" size={18} color="#3b82f6" />
              <Text style={[styles.actionBtnText, { color: '#3b82f6' }]}>Editar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => router.push(`/detailed-seller-report?sellerId=${seller.id}&sellerName=${encodeURIComponent(seller.name)}`)}
            >
              <Ionicons name="bar-chart" size={18} color="#8b5cf6" />
              <Text style={[styles.actionBtnText, { color: '#8b5cf6' }]}>Reporte</Text>
            </TouchableOpacity>
          </View>

          {/* Impersonation Button */}
          {user?.role === 'super_admin' && (
            <TouchableOpacity
              style={styles.impersonateButton}
              onPress={() => router.push(`/impersonate?sellerId=${seller.id}&sellerName=${encodeURIComponent(seller.name)}&sellerCurrency=${seller.currency}`)}
              data-testid="impersonate-button"
            >
              <Ionicons name="person-circle" size={22} color="#ffffff" />
              <Text style={styles.impersonateButtonText}>Actuar como {seller.name}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Today's Stats */}
        {todayStats && (
          <View style={styles.statsCard}>
            <Text style={styles.sectionTitle}>Estadísticas de Hoy</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Ventas</Text>
                <Text style={[styles.statValue, styles.greenText]}>
                  {seller.currency} {todayStats.sales.toLocaleString()}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Premios</Text>
                <Text style={[styles.statValue, styles.redText]}>
                  {seller.currency} {todayStats.wins.toLocaleString()}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Comisión</Text>
                <Text style={[styles.statValue, styles.yellowText]}>
                  {seller.currency} {todayStats.commission.toLocaleString()}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Neto</Text>
                <Text style={[styles.statValue, todayStats.net >= 0 ? styles.greenText : styles.redText]}>
                  {seller.currency} {todayStats.net.toLocaleString()}
                </Text>
              </View>
            </View>
            <View style={styles.ticketStats}>
              <View style={styles.ticketStatItem}>
                <Text style={styles.ticketStatValue}>{todayStats.tickets_count}</Text>
                <Text style={styles.ticketStatLabel}>Total</Text>
              </View>
              <View style={styles.ticketStatItem}>
                <Text style={[styles.ticketStatValue, styles.yellowText]}>{todayStats.pending}</Text>
                <Text style={styles.ticketStatLabel}>Pend</Text>
              </View>
              <View style={styles.ticketStatItem}>
                <Text style={[styles.ticketStatValue, styles.greenText]}>{todayStats.won}</Text>
                <Text style={styles.ticketStatLabel}>Gan</Text>
              </View>
              <View style={styles.ticketStatItem}>
                <Text style={[styles.ticketStatValue, styles.grayText]}>{todayStats.cancelled}</Text>
                <Text style={styles.ticketStatLabel}>Canc</Text>
              </View>
            </View>
          </View>
        )}

        {/* Recent Tickets */}
        <View style={styles.ticketsCard}>
          <Text style={styles.sectionTitle}>Boletos Recientes</Text>
          {recentTickets.length === 0 ? (
            <Text style={styles.emptyText}>No hay boletos recientes</Text>
          ) : (
            recentTickets.map((ticket) => {
              const amount = ticket.amount || ticket.total_amount || 0;
              const isMultiPlay = ticket.ticket_type === 'multi_play';
              const canCancel = ticket.status === 'pending' && user?.role === 'super_admin';
              
              return (
                <View key={ticket.id} style={styles.ticketItem}>
                  <View style={styles.ticketInfo}>
                    <Text style={styles.ticketNumber}>{ticket.ticket_number}</Text>
                    <Text style={styles.ticketLottery}>
                      {isMultiPlay ? `Multi (${ticket.plays?.length || 0})` : ticket.lottery_name}
                    </Text>
                  </View>
                  <View style={styles.ticketRight}>
                    <Text style={styles.ticketAmount}>{ticket.currency} {amount.toLocaleString()}</Text>
                    <View style={[styles.ticketStatus, { backgroundColor: getStatusColor(ticket.status) }]}>
                      <Text style={styles.ticketStatusText}>{getStatusText(ticket.status)}</Text>
                    </View>
                  </View>
                  {canCancel && (
                    <TouchableOpacity
                      style={styles.cancelTicketBtn}
                      onPress={() => handleCancelTicket(ticket)}
                      disabled={cancelling === ticket.id}
                    >
                      {cancelling === ticket.id ? (
                        <ActivityIndicator size="small" color="#ef4444" />
                      ) : (
                        <Ionicons name="close-circle" size={22} color="#ef4444" />
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* Recent Transactions */}
        <View style={styles.transactionsCard}>
          <Text style={styles.sectionTitle}>Transacciones Recientes</Text>
          {recentTransactions.length === 0 ? (
            <Text style={styles.emptyText}>No hay transacciones recientes</Text>
          ) : (
            recentTransactions.slice(0, 10).map((tx) => (
              <View key={tx.id} style={styles.txItem}>
                <View style={styles.txInfo}>
                  <Text style={styles.txType}>{tx.transaction_type}</Text>
                  <Text style={styles.txDesc}>{tx.description}</Text>
                </View>
                <Text style={[styles.txAmount, tx.amount >= 0 ? styles.greenText : styles.redText]}>
                  {tx.amount >= 0 ? '+' : ''}{tx.currency} {tx.amount.toLocaleString()}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={showEditModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar Vendedor</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Límite de Crédito</Text>
              <TextInput
                style={styles.input}
                value={editCreditLimit}
                onChangeText={setEditCreditLimit}
                keyboardType="numeric"
                placeholder="Ej: 50000"
                placeholderTextColor="#64748b"
              />
              
              <Text style={styles.inputLabel}>Tasa de Comisión (%)</Text>
              <TextInput
                style={styles.input}
                value={editCommissionRate}
                onChangeText={setEditCommissionRate}
                keyboardType="numeric"
                placeholder="Ej: 10"
                placeholderTextColor="#64748b"
              />

              <TouchableOpacity
                style={[styles.saveButton, saving && styles.buttonDisabled]}
                onPress={handleUpdateSeller}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.saveButtonText}>Guardar Cambios</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Deposit Modal */}
      <Modal visible={showDepositModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Depositar a {seller.name}</Text>
              <TouchableOpacity onPress={() => setShowDepositModal(false)}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Balance Actual</Text>
              <Text style={styles.currentBalance}>
                {seller.currency} {seller.balance.toLocaleString()}
              </Text>

              <Text style={styles.inputLabel}>Monto a Depositar</Text>
              <TextInput
                style={styles.input}
                value={depositAmount}
                onChangeText={setDepositAmount}
                keyboardType="numeric"
                placeholder="Ej: 5000"
                placeholderTextColor="#64748b"
              />

              <TouchableOpacity
                style={[styles.depositButton, saving && styles.buttonDisabled]}
                onPress={handleDeposit}
                disabled={saving || !depositAmount}
              >
                {saving ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="wallet" size={20} color="#ffffff" />
                    <Text style={styles.depositButtonText}>Depositar</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
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
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
  },
  sellerCard: {
    backgroundColor: '#1e293b',
    margin: 12,
    borderRadius: 12,
    padding: 16,
  },
  sellerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sellerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sellerAvatarText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
  },
  sellerInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  sellerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  terminalBadge: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  terminalText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  sellerEmail: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  sellerPhone: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  statusToggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusActive: {
    backgroundColor: '#14532d',
  },
  statusInactive: {
    backgroundColor: '#7f1d1d',
  },
  statusToggleText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#ffffff',
  },
  sellerDetails: {
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#94a3b8',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  greenText: {
    color: '#22c55e',
  },
  redText: {
    color: '#ef4444',
  },
  yellowText: {
    color: '#f59e0b',
  },
  grayText: {
    color: '#64748b',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: 8,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#22c55e',
    marginLeft: 6,
  },
  statsCard: {
    backgroundColor: '#1e293b',
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
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
  },
  statItem: {
    width: '50%',
    paddingVertical: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#94a3b8',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 2,
  },
  ticketStats: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  ticketStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  ticketStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  ticketStatLabel: {
    fontSize: 11,
    color: '#94a3b8',
  },
  ticketsCard: {
    backgroundColor: '#1e293b',
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    paddingVertical: 20,
  },
  ticketItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  ticketInfo: {
    flex: 1,
  },
  ticketNumber: {
    fontSize: 13,
    fontWeight: '500',
    color: '#22c55e',
  },
  ticketLottery: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  ticketRight: {
    alignItems: 'flex-end',
    marginRight: 12,
  },
  ticketAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  ticketStatus: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
  },
  ticketStatusText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#ffffff',
  },
  cancelTicketBtn: {
    padding: 4,
  },
  transactionsCard: {
    backgroundColor: '#1e293b',
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
  },
  txItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  txInfo: {
    flex: 1,
  },
  txType: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  txDesc: {
    fontSize: 13,
    color: '#ffffff',
    marginTop: 2,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  modalBody: {
    padding: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 16,
  },
  currentBalance: {
    fontSize: 24,
    fontWeight: '700',
    color: '#22c55e',
    marginBottom: 16,
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  depositButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    padding: 14,
    borderRadius: 10,
  },
  depositButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  impersonateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f59e0b',
    padding: 14,
    borderRadius: 10,
    marginTop: 16,
  },
  impersonateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
  },
});

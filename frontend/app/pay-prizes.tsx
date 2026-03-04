import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const { width } = Dimensions.get('window');
const isDesktop = width > 768;

interface WinningTicket {
  id: string;
  ticket_number: string;
  ticket_type: string;
  lottery_name: string;
  seller_name: string;
  customer_name?: string;
  numbers?: number[];
  plays?: any[];
  amount: number;
  potential_win: number;
  currency: string;
  status: string;
  created_at: string;
}

export default function PayPrizes() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [tickets, setTickets] = useState<WinningTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<WinningTicket | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [filter, setFilter] = useState<'won' | 'paid'>('won');

  const fetchWinningTickets = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/tickets?status=${filter}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setTickets(Array.isArray(data) ? data : data.tickets || []);
      }
    } catch (error) {
      console.error('Error fetching winning tickets:', error);
    } finally {
      setLoading(false);
    }
  }, [token, filter]);

  useEffect(() => {
    fetchWinningTickets();
  }, [fetchWinningTickets]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchWinningTickets();
    setRefreshing(false);
  };

  const handlePayPrize = async () => {
    if (!selectedTicket) return;

    setProcessing(true);
    try {
      const response = await fetch(`${API_URL}/api/tickets/${selectedTicket.id}/pay`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert(
          '¡Premio Pagado!',
          `Se pagó ${data.currency} ${data.amount_paid.toLocaleString()} al boleto ${data.ticket_number}`,
          [{ text: 'OK', onPress: () => {
            setShowPayModal(false);
            setSelectedTicket(null);
            fetchWinningTickets();
          }}]
        );
      } else {
        Alert.alert('Error', data.detail || 'No se pudo pagar el premio');
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setProcessing(false);
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      ticket.ticket_number.toLowerCase().includes(query) ||
      ticket.seller_name.toLowerCase().includes(query) ||
      (ticket.customer_name && ticket.customer_name.toLowerCase().includes(query))
    );
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-DO', {
      timeZone: 'America/Santo_Domingo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderTicket = ({ item }: { item: WinningTicket }) => (
    <TouchableOpacity
      style={[styles.ticketCard, item.status === 'paid' && styles.ticketCardPaid]}
      onPress={() => {
        if (item.status === 'won') {
          setSelectedTicket(item);
          setShowPayModal(true);
        }
      }}
      disabled={item.status === 'paid'}
    >
      <View style={styles.ticketHeader}>
        <View style={styles.ticketNumberContainer}>
          <Ionicons 
            name={item.status === 'paid' ? 'checkmark-circle' : 'trophy'} 
            size={24} 
            color={item.status === 'paid' ? '#22c55e' : '#f59e0b'} 
          />
          <Text style={styles.ticketNumber}>{item.ticket_number}</Text>
        </View>
        <View style={[styles.statusBadge, item.status === 'paid' ? styles.paidBadge : styles.wonBadge]}>
          <Text style={styles.statusText}>
            {item.status === 'paid' ? 'PAGADO' : 'GANADOR'}
          </Text>
        </View>
      </View>

      <View style={styles.ticketInfo}>
        <Text style={styles.lotteryName}>{item.lottery_name}</Text>
        <Text style={styles.sellerName}>Vendedor: {item.seller_name}</Text>
        {item.customer_name && (
          <Text style={styles.customerName}>Cliente: {item.customer_name}</Text>
        )}
        <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
      </View>

      <View style={styles.prizeContainer}>
        <Text style={styles.prizeLabel}>Premio:</Text>
        <Text style={styles.prizeAmount}>
          {item.currency} {(item.potential_win || 0).toLocaleString()}
        </Text>
      </View>

      {item.status === 'won' && (
        <View style={styles.payButtonContainer}>
          <TouchableOpacity 
            style={styles.payButton}
            onPress={() => {
              setSelectedTicket(item);
              setShowPayModal(true);
            }}
          >
            <Ionicons name="cash" size={20} color="#ffffff" />
            <Text style={styles.payButtonText}>Pagar Premio</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );

  const totalPending = tickets.filter(t => t.status === 'won').reduce((sum, t) => sum + (t.potential_win || 0), 0);
  const totalPaid = tickets.filter(t => t.status === 'paid').reduce((sum, t) => sum + (t.potential_win || 0), 0);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pago de Premios</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Ionicons name="refresh" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, styles.pendingCard]}>
          <Ionicons name="time" size={24} color="#f59e0b" />
          <Text style={styles.statLabel}>Por Pagar</Text>
          <Text style={[styles.statValue, { color: '#f59e0b' }]}>
            RD$ {totalPending.toLocaleString()}
          </Text>
        </View>
        <View style={[styles.statCard, styles.paidCard]}>
          <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
          <Text style={styles.statLabel}>Pagados</Text>
          <Text style={[styles.statValue, { color: '#22c55e' }]}>
            RD$ {totalPaid.toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search" size={20} color="#64748b" />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Buscar por # ticket, vendedor o cliente"
            placeholderTextColor="#64748b"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#64748b" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'won' && styles.filterButtonActive]}
          onPress={() => setFilter('won')}
        >
          <Text style={[styles.filterText, filter === 'won' && styles.filterTextActive]}>
            Por Pagar
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'paid' && styles.filterButtonActive]}
          onPress={() => setFilter('paid')}
        >
          <Text style={[styles.filterText, filter === 'paid' && styles.filterTextActive]}>
            Pagados
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#22c55e" style={styles.loader} />
      ) : (
        <FlatList
          data={filteredTickets}
          renderItem={renderTicket}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="trophy-outline" size={64} color="#475569" />
              <Text style={styles.emptyText}>
                {filter === 'won' ? 'No hay premios pendientes' : 'No hay premios pagados'}
              </Text>
            </View>
          }
          numColumns={isDesktop ? 2 : 1}
          key={isDesktop ? 'desktop' : 'mobile'}
        />
      )}

      {/* Pay Confirmation Modal */}
      <Modal visible={showPayModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="cash" size={48} color="#22c55e" />
              <Text style={styles.modalTitle}>Confirmar Pago de Premio</Text>
            </View>

            {selectedTicket && (
              <View style={styles.modalBody}>
                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalInfoLabel}>Boleto:</Text>
                  <Text style={styles.modalInfoValue}>{selectedTicket.ticket_number}</Text>
                </View>
                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalInfoLabel}>Lotería:</Text>
                  <Text style={styles.modalInfoValue}>{selectedTicket.lottery_name}</Text>
                </View>
                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalInfoLabel}>Vendedor:</Text>
                  <Text style={styles.modalInfoValue}>{selectedTicket.seller_name}</Text>
                </View>
                {selectedTicket.customer_name && (
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalInfoLabel}>Cliente:</Text>
                    <Text style={styles.modalInfoValue}>{selectedTicket.customer_name}</Text>
                  </View>
                )}
                <View style={styles.modalPrizeRow}>
                  <Text style={styles.modalPrizeLabel}>Monto a Pagar:</Text>
                  <Text style={styles.modalPrizeValue}>
                    {selectedTicket.currency} {(selectedTicket.potential_win || 0).toLocaleString()}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowPayModal(false);
                  setSelectedTicket(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, processing && styles.buttonDisabled]}
                onPress={handlePayPrize}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={20} color="#ffffff" />
                    <Text style={styles.confirmButtonText}>Confirmar Pago</Text>
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
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  pendingCard: {
    backgroundColor: '#78350f20',
    borderWidth: 1,
    borderColor: '#f59e0b30',
  },
  paidCard: {
    backgroundColor: '#14532d20',
    borderWidth: 1,
    borderColor: '#22c55e30',
  },
  statLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 12,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#1e293b',
  },
  filterButtonActive: {
    backgroundColor: '#22c55e',
  },
  filterText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#ffffff',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
  },
  ticketCard: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: isDesktop ? 6 : 0,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  ticketCardPaid: {
    borderLeftColor: '#22c55e',
    opacity: 0.8,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ticketNumberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ticketNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22c55e',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  wonBadge: {
    backgroundColor: '#f59e0b30',
  },
  paidBadge: {
    backgroundColor: '#22c55e30',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  ticketInfo: {
    marginBottom: 12,
  },
  lotteryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  sellerName: {
    fontSize: 13,
    color: '#94a3b8',
  },
  customerName: {
    fontSize: 13,
    color: '#94a3b8',
  },
  dateText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  prizeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  prizeLabel: {
    fontSize: 14,
    color: '#94a3b8',
  },
  prizeAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#22c55e',
  },
  payButtonContainer: {
    alignItems: 'stretch',
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  payButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 12,
  },
  modalBody: {
    marginBottom: 20,
  },
  modalInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  modalInfoLabel: {
    fontSize: 14,
    color: '#94a3b8',
  },
  modalInfoValue: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
  modalPrizeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  modalPrizeLabel: {
    fontSize: 14,
    color: '#94a3b8',
  },
  modalPrizeValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#22c55e',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#334155',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});

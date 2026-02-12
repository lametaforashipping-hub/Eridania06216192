import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
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
  balance: number;
  credit_limit: number;
  commission_rate: number;
  currency: string;
  terminal_id?: string;
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
  status: string;
  created_at: string;
  currency: string;
}

export default function ImpersonateScreen() {
  const { token, user } = useAuth();
  const router = useRouter();
  const { sellerId, sellerName, sellerCurrency } = useLocalSearchParams<{ 
    sellerId: string; 
    sellerName?: string;
    sellerCurrency?: string;
  }>();
  
  const [seller, setSeller] = useState<Seller | null>(null);
  const [recentTickets, setRecentTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSellerData = useCallback(async () => {
    if (!token || !sellerId) return;
    try {
      const response = await fetch(`${API_URL}/api/admin/seller-profile/${sellerId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSeller(data.seller);
        setRecentTickets(data.recent_tickets || []);
      }
    } catch (error) {
      console.error('Error fetching seller data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, sellerId]);

  useEffect(() => {
    fetchSellerData();
  }, [fetchSellerData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSellerData();
  };

  const handleCreateTicket = () => {
    // Navigate to sales with impersonation context
    router.push(`/sales?actAs=${sellerId}&actAsName=${encodeURIComponent(sellerName || '')}`);
  };

  const handleCreateMultiPlay = () => {
    // Navigate to multi-play with impersonation context
    router.push(`/multi-play?actAs=${sellerId}&actAsName=${encodeURIComponent(sellerName || '')}`);
  };

  const handleCancelTicket = async (ticket: Ticket) => {
    Alert.alert(
      'Cancelar Boleto',
      `¿Cancelar boleto ${ticket.ticket_number} del vendedor ${sellerName}?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, Cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_URL}/api/tickets/${ticket.id}/cancel`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
              });
              if (response.ok) {
                Alert.alert('Éxito', 'Boleto cancelado');
                fetchSellerData();
              } else {
                const error = await response.json();
                Alert.alert('Error', error.detail || 'No se pudo cancelar');
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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#f59e0b" style={styles.loader} />
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
      {/* Warning Banner */}
      <View style={styles.warningBanner}>
        <Ionicons name="warning" size={20} color="#ffffff" />
        <Text style={styles.warningText}>Modo Suplantación Activo</Text>
      </View>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} data-testid="back-button">
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Actuando como: {sellerName}</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Ionicons name="refresh" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f59e0b" />}
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
              <Text style={styles.sellerName}>{seller.name}</Text>
              {seller.terminal_id && (
                <View style={styles.terminalBadge}>
                  <Text style={styles.terminalText}>{seller.terminal_id}</Text>
                </View>
              )}
              <Text style={styles.sellerBalance}>
                Balance: {seller.currency} {seller.balance.toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Cards */}
        <View style={styles.actionsGrid}>
          <TouchableOpacity 
            style={[styles.actionCard, styles.actionCardGreen]} 
            onPress={handleCreateTicket}
            data-testid="create-ticket-btn"
          >
            <Ionicons name="cart" size={32} color="#22c55e" />
            <Text style={styles.actionCardTitle}>Vender</Text>
            <Text style={styles.actionCardSubtitle}>Crear boleto simple</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionCard, styles.actionCardBlue]} 
            onPress={handleCreateMultiPlay}
            data-testid="create-multiplay-btn"
          >
            <Ionicons name="layers" size={32} color="#3b82f6" />
            <Text style={styles.actionCardTitle}>Multi-Jugada</Text>
            <Text style={styles.actionCardSubtitle}>Múltiples jugadas</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsCard}>
          <Text style={styles.sectionTitle}>Información Rápida</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Balance Actual</Text>
              <Text style={[styles.statValue, styles.greenText]}>
                {seller.currency} {seller.balance.toLocaleString()}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Límite Crédito</Text>
              <Text style={styles.statValue}>
                {seller.currency} {seller.credit_limit.toLocaleString()}
              </Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Disponible</Text>
              <Text style={[styles.statValue, styles.yellowText]}>
                {seller.currency} {(seller.balance + seller.credit_limit).toLocaleString()}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Comisión</Text>
              <Text style={styles.statValue}>{seller.commission_rate || 10}%</Text>
            </View>
          </View>
        </View>

        {/* Recent Tickets */}
        <View style={styles.ticketsCard}>
          <Text style={styles.sectionTitle}>Boletos Recientes del Vendedor</Text>
          {recentTickets.length === 0 ? (
            <Text style={styles.emptyText}>No hay boletos recientes</Text>
          ) : (
            recentTickets.slice(0, 10).map((ticket) => {
              const amount = ticket.amount || ticket.total_amount || 0;
              const isMultiPlay = ticket.ticket_type === 'multi_play';
              const canCancel = ticket.status === 'pending';
              
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
                    >
                      <Ionicons name="close-circle" size={22} color="#ef4444" />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* Exit Button */}
        <TouchableOpacity
          style={styles.exitButton}
          onPress={() => router.back()}
          data-testid="exit-impersonate-btn"
        >
          <Ionicons name="exit" size={20} color="#ffffff" />
          <Text style={styles.exitButtonText}>Salir del Modo Suplantación</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f59e0b',
    paddingVertical: 8,
    gap: 8,
  },
  warningText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#1e293b',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    flex: 1,
    textAlign: 'center',
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
    borderWidth: 2,
    borderColor: '#f59e0b',
  },
  sellerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sellerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f59e0b',
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
  sellerName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  terminalBadge: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  terminalText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  sellerBalance: {
    fontSize: 14,
    color: '#22c55e',
    marginTop: 4,
    fontWeight: '600',
  },
  actionsGrid: {
    flexDirection: 'row',
    marginHorizontal: 12,
    gap: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
  },
  actionCardGreen: {
    borderColor: '#22c55e',
  },
  actionCardBlue: {
    borderColor: '#3b82f6',
  },
  actionCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 8,
  },
  actionCardSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  statsCard: {
    backgroundColor: '#1e293b',
    margin: 12,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  statItem: {
    flex: 1,
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
  greenText: {
    color: '#22c55e',
  },
  yellowText: {
    color: '#f59e0b',
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
    color: '#f59e0b',
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
  exitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#64748b',
    marginHorizontal: 12,
    padding: 14,
    borderRadius: 10,
    gap: 8,
  },
  exitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  bottomSpacer: {
    height: 40,
  },
});

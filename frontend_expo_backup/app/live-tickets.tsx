import React, { useState, useEffect, useCallback, useRef, MutableRefObject } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Alert,
  Dimensions,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const { width } = Dimensions.get('window');
const isDesktop = width > 768;

interface Ticket {
  id: string;
  ticket_number: string;
  seller_id: string;
  seller_name: string;
  lottery_name: string;
  lottery_id: string;
  numbers: number[];
  amount: number;
  total_amount?: number;
  potential_win: number;
  total_potential_win?: number;
  status: string;
  currency: string;
  created_at: string;
  ticket_type?: string;
  plays?: any[];
}

interface LiveStats {
  total_today: number;
  total_sales: number;
  pending: number;
  won: number;
  cancelled: number;
}

interface HighRiskConfig {
  threshold_rd: number;
  threshold_usd: number;
}

export default function LiveTickets() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [highRiskConfig, setHighRiskConfig] = useState<HighRiskConfig>({ threshold_rd: 10000, threshold_usd: 200 });
  const [highRiskCount, setHighRiskCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const alertAnim = useRef(new Animated.Value(1)).current;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isHighRisk = (ticket: Ticket) => {
    const potentialWin = ticket.potential_win || ticket.total_potential_win || 0;
    const threshold = ticket.currency === 'USD' ? highRiskConfig.threshold_usd : highRiskConfig.threshold_rd;
    return potentialWin >= threshold && ticket.status === 'pending';
  };

  const fetchHighRiskConfig = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/api/admin/high-risk-tickets`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setHighRiskConfig({
          threshold_rd: data.threshold_rd || 10000,
          threshold_usd: data.threshold_usd || 200
        });
        setHighRiskCount(data.count || 0);
      }
    } catch (error) {
      console.error('Error fetching high risk config:', error);
    }
  }, [token]);

  const fetchLiveTickets = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/api/monitoring/live-tickets?limit=100`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setTickets(data.tickets || []);
        setStats(data.stats || null);
        setLastUpdate(new Date());
        
        // Count high risk tickets
        const hrCount = (data.tickets || []).filter((t: Ticket) => isHighRisk(t)).length;
        setHighRiskCount(hrCount);
        
        // Pulse animation when new data arrives
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 150, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
        ]).start();
        
        // Alert animation for high risk
        if (hrCount > 0) {
          Animated.loop(
            Animated.sequence([
              Animated.timing(alertAnim, { toValue: 1.3, duration: 500, useNativeDriver: true }),
              Animated.timing(alertAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
            ])
          ).start();
        }
      }
    } catch (error) {
      console.error('Error fetching live tickets:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, pulseAnim, alertAnim, highRiskConfig]);

  useEffect(() => {
    fetchHighRiskConfig();
    fetchLiveTickets();
    
    // Auto-refresh every 5 seconds
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchLiveTickets, 5000);
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchLiveTickets, autoRefresh]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLiveTickets();
  };

  const handleCancelTicket = async (ticket: Ticket) => {
    Alert.alert(
      'Cancelar Boleto',
      `¿Estás seguro de cancelar el boleto ${ticket.ticket_number}?\n\nVendedor: ${ticket.seller_name}\nMonto: ${ticket.currency} ${(ticket.amount || ticket.total_amount || 0).toLocaleString()}`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, Cancelar',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              const response = await fetch(`${API_URL}/api/tickets/${ticket.id}/cancel`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
              });
              if (response.ok) {
                Alert.alert('Éxito', 'Boleto cancelado correctamente');
                setShowTicketModal(false);
                fetchLiveTickets();
              } else {
                const error = await response.json();
                Alert.alert('Error', error.detail || 'No se pudo cancelar el boleto');
              }
            } catch (error) {
              Alert.alert('Error', 'Error de conexión');
            } finally {
              setCancelling(false);
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
      case 'pending': return 'PENDIENTE';
      case 'won': return 'GANADOR';
      case 'paid': return 'PAGADO';
      case 'lost': return 'PERDIDO';
      case 'cancelled': return 'CANCELADO';
      default: return status.toUpperCase();
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('es-DO', { timeZone: 'America/Santo_Domingo', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const renderTicket = ({ item, index }: { item: Ticket; index: number }) => {
    const isNew = index < 3; // Mark first 3 as "new"
    const amount = item.amount || item.total_amount || 0;
    const potentialWin = item.potential_win || item.total_potential_win || 0;
    const isMultiPlay = item.ticket_type === 'multi_play';
    const ticketIsHighRisk = isHighRisk(item);
    
    return (
      <TouchableOpacity
        style={[
          styles.ticketCard, 
          isNew && styles.ticketCardNew,
          ticketIsHighRisk && styles.ticketCardHighRisk
        ]}
        onPress={() => {
          setSelectedTicket(item);
          setShowTicketModal(true);
        }}
        data-testid={`live-ticket-${item.ticket_number}`}
      >
        <View style={styles.ticketHeader}>
          <View style={styles.ticketLeft}>
            {ticketIsHighRisk && (
              <Animated.View style={[styles.highRiskBadge, { transform: [{ scale: alertAnim }] }]}>
                <Ionicons name="warning" size={12} color="#ffffff" />
                <Text style={styles.highRiskBadgeText}>ALTO RIESGO</Text>
              </Animated.View>
            )}
            {isNew && !ticketIsHighRisk && (
              <Animated.View style={[styles.newBadge, { transform: [{ scale: pulseAnim }] }]}>
                <Text style={styles.newBadgeText}>NUEVO</Text>
              </Animated.View>
            )}
            <Text style={styles.ticketNumber}>{item.ticket_number}</Text>
            <Text style={styles.ticketTime}>{formatTime(item.created_at)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
          </View>
        </View>

        <View style={styles.ticketBody}>
          <View style={styles.sellerInfo}>
            <Ionicons name="person" size={14} color="#64748b" />
            <Text style={styles.sellerName}>{item.seller_name}</Text>
          </View>
          <Text style={styles.lotteryName}>
            {isMultiPlay ? `Multi-jugada (${item.plays?.length || 0})` : item.lottery_name}
          </Text>
        </View>

        <View style={styles.ticketFooter}>
          <View style={styles.amountContainer}>
            <Text style={styles.amountLabel}>Monto</Text>
            <Text style={styles.amountValue}>{item.currency} {amount.toLocaleString()}</Text>
          </View>
          {ticketIsHighRisk && (
            <View style={styles.potentialWinContainer}>
              <Text style={styles.potentialWinLabel}>Premio Pot.</Text>
              <Text style={styles.potentialWinValue}>{item.currency} {potentialWin.toLocaleString()}</Text>
            </View>
          )}
          {item.status === 'pending' && user?.role === 'super_admin' && (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => handleCancelTicket(item)}
            >
              <Ionicons name="close-circle" size={20} color="#ef4444" />
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} data-testid="back-button">
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tickets en Vivo</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.autoRefreshButton, autoRefresh && styles.autoRefreshActive]}
            onPress={() => setAutoRefresh(!autoRefresh)}
          >
            <Ionicons name={autoRefresh ? 'pause' : 'play'} size={18} color="#ffffff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onRefresh}>
            <Ionicons name="refresh" size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats Bar */}
      {stats && (
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.total_today}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, styles.greenText]}>
              {user?.currency || 'RD$'} {stats.total_sales.toLocaleString()}
            </Text>
            <Text style={styles.statLabel}>Ventas</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, styles.yellowText]}>{stats.pending}</Text>
            <Text style={styles.statLabel}>Pendientes</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, styles.greenText]}>{stats.won}</Text>
            <Text style={styles.statLabel}>Ganadores</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, styles.grayText]}>{stats.cancelled}</Text>
            <Text style={styles.statLabel}>Cancelados</Text>
          </View>
        </View>
      )}

      {/* Auto-refresh indicator */}
      <View style={styles.refreshIndicator}>
        {autoRefresh && (
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>EN VIVO</Text>
          </View>
        )}
        <Text style={styles.lastUpdateText}>
          Última actualización: {lastUpdate.toLocaleTimeString('es-DO', {timeZone: 'America/Santo_Domingo'})}
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#22c55e" style={styles.loader} />
      ) : (
        <FlatList
          data={tickets}
          renderItem={renderTicket}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, isDesktop && styles.listContentDesktop]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />
          }
          numColumns={isDesktop ? 2 : 1}
          key={isDesktop ? 'desktop' : 'mobile'}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={64} color="#475569" />
              <Text style={styles.emptyText}>No hay tickets hoy</Text>
            </View>
          }
        />
      )}

      {/* Ticket Detail Modal */}
      <Modal
        visible={showTicketModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTicketModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detalle del Boleto</Text>
              <TouchableOpacity onPress={() => setShowTicketModal(false)}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>

            {selectedTicket && (
              <View style={styles.modalBody}>
                <Text style={styles.modalTicketNumber}>{selectedTicket.ticket_number}</Text>
                
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Vendedor:</Text>
                  <Text style={styles.modalValue}>{selectedTicket.seller_name}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Lotería:</Text>
                  <Text style={styles.modalValue}>
                    {selectedTicket.ticket_type === 'multi_play' 
                      ? `Multi-jugada (${selectedTicket.plays?.length || 0})` 
                      : selectedTicket.lottery_name}
                  </Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Monto:</Text>
                  <Text style={styles.modalValue}>
                    {selectedTicket.currency} {(selectedTicket.amount || selectedTicket.total_amount || 0).toLocaleString()}
                  </Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Premio Potencial:</Text>
                  <Text style={[styles.modalValue, styles.greenText]}>
                    {selectedTicket.currency} {(selectedTicket.potential_win || selectedTicket.total_potential_win || 0).toLocaleString()}
                  </Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Estado:</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedTicket.status) }]}>
                    <Text style={styles.statusText}>{getStatusText(selectedTicket.status)}</Text>
                  </View>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Creado:</Text>
                  <Text style={styles.modalValue}>
                    {new Date(selectedTicket.created_at).toLocaleString('es-DO', {timeZone: 'America/Santo_Domingo'})}
                  </Text>
                </View>

                {selectedTicket.status === 'pending' && user?.role === 'super_admin' && (
                  <TouchableOpacity
                    style={[styles.cancelFullButton, cancelling && styles.buttonDisabled]}
                    onPress={() => handleCancelTicket(selectedTicket)}
                    disabled={cancelling}
                  >
                    {cancelling ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <>
                        <Ionicons name="close-circle" size={22} color="#ffffff" />
                        <Text style={styles.cancelFullButtonText}>Cancelar Boleto</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.viewSellerButton}
                  onPress={() => {
                    setShowTicketModal(false);
                    router.push(`/detailed-seller-report?sellerId=${selectedTicket.seller_id}&sellerName=${encodeURIComponent(selectedTicket.seller_name)}`);
                  }}
                >
                  <Ionicons name="person" size={20} color="#3b82f6" />
                  <Text style={styles.viewSellerButtonText}>Ver Perfil del Vendedor</Text>
                </TouchableOpacity>
              </View>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  autoRefreshButton: {
    backgroundColor: '#475569',
    padding: 6,
    borderRadius: 6,
  },
  autoRefreshActive: {
    backgroundColor: '#22c55e',
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  statLabel: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
  },
  greenText: {
    color: '#22c55e',
  },
  yellowText: {
    color: '#f59e0b',
  },
  grayText: {
    color: '#64748b',
  },
  refreshIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#0f172a',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    marginRight: 6,
  },
  liveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ef4444',
  },
  lastUpdateText: {
    fontSize: 11,
    color: '#64748b',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
  },
  listContent: {
    padding: 12,
  },
  listContentDesktop: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  ticketCard: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    marginHorizontal: 4,
  },
  ticketCardNew: {
    borderLeftWidth: 4,
    borderLeftColor: '#22c55e',
  },
  ticketCardHighRisk: {
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  ticketLeft: {
    flex: 1,
  },
  highRiskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  highRiskBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#ffffff',
    marginLeft: 4,
  },
  newBadge: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  newBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#ffffff',
  },
  ticketNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22c55e',
  },
  ticketTime: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
  },
  ticketBody: {
    marginBottom: 10,
  },
  sellerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  sellerName: {
    fontSize: 13,
    color: '#94a3b8',
    marginLeft: 6,
  },
  lotteryName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ffffff',
  },
  ticketFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 10,
  },
  amountContainer: {},
  amountLabel: {
    fontSize: 10,
    color: '#64748b',
  },
  amountValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  potentialWinContainer: {
    alignItems: 'flex-end',
  },
  potentialWinLabel: {
    fontSize: 10,
    color: '#ef4444',
  },
  potentialWinValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ef4444',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  cancelButtonText: {
    fontSize: 12,
    color: '#ef4444',
    marginLeft: 4,
    fontWeight: '500',
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
    maxHeight: '80%',
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
  modalTicketNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#22c55e',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  modalLabel: {
    fontSize: 14,
    color: '#94a3b8',
  },
  modalValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ffffff',
  },
  cancelFullButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    padding: 14,
    borderRadius: 10,
    marginTop: 20,
  },
  cancelFullButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  viewSellerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
  },
  viewSellerButtonText: {
    fontSize: 14,
    color: '#3b82f6',
    marginLeft: 8,
    fontWeight: '500',
  },
});

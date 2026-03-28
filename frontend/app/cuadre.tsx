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
  Alert,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const { width } = Dimensions.get('window');
const isDesktop = width > 768;

interface SellerBalance {
  seller_id: string;
  seller_name: string;
  balance: number;
  commission_rate: number;
  currency: string;
  is_active: boolean;
}

interface CuadreData {
  seller_id: string;
  seller_name: string;
  commission_rate: number;
  currency: string;
  period_start: string;
  period_end: string;
  total_sales: number;
  total_commission: number;
  total_wins: number;
  net_profit: number;
  tickets_sold: number;
  tickets_won: number;
  running_balance: number;
  total_due: number;
  last_settlement_date: string | null;
  winning_tickets: any[];
}

interface Settlement {
  id: string;
  period_start: string;
  period_end: string;
  total_sales: number;
  total_commission: number;
  total_wins: number;
  net_profit: number;
  previous_balance: number;
  amount_due: number;
  amount_paid: number;
  balance_after: number;
  notes: string;
  closed_by_name: string;
  created_at: string;
  currency: string;
}

type ViewMode = 'sellers' | 'cuadre' | 'history';

export default function Cuadre() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('sellers');
  const [sellers, setSellers] = useState<SellerBalance[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [cuadre, setCuadre] = useState<CuadreData | null>(null);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [selectedSeller, setSelectedSeller] = useState<SellerBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showDateFilter, setShowDateFilter] = useState(false);

  const formatCurrency = (amount: number, currency: string = 'RD$') => {
    const symbol = currency === 'USD' || currency === '$' ? '$' : 'RD$';
    return `${symbol} ${Math.abs(amount).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const fetchSellers = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/settlements/all-balances`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSellers(data.sellers || []);
        setTotalBalance(data.total_balance || 0);
      }
    } catch (e) {
      console.error('Error fetching sellers:', e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchCuadre = useCallback(async (sellerId: string) => {
    if (!token) return;
    setLoading(true);
    try {
      let url = `${API_URL}/api/settlements/cuadre/${sellerId}`;
      const params: string[] = [];
      if (startDate) params.push(`start_date=${startDate}T00:00:00`);
      if (endDate) params.push(`end_date=${endDate}T23:59:59`);
      if (params.length > 0) url += '?' + params.join('&');

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCuadre(data);
      }
    } catch (e) {
      console.error('Error fetching cuadre:', e);
    } finally {
      setLoading(false);
    }
  }, [token, startDate, endDate]);

  const fetchHistory = useCallback(async (sellerId: string) => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/settlements/history/${sellerId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSettlements(data.settlements || []);
      }
    } catch (e) {
      console.error('Error fetching history:', e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchSellers();
  }, [fetchSellers]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (viewMode === 'sellers') {
      await fetchSellers();
    } else if (viewMode === 'cuadre' && selectedSeller) {
      await fetchCuadre(selectedSeller.seller_id);
    } else if (viewMode === 'history' && selectedSeller) {
      await fetchHistory(selectedSeller.seller_id);
    }
    setRefreshing(false);
  };

  const selectSeller = (seller: SellerBalance) => {
    setSelectedSeller(seller);
    setViewMode('cuadre');
    fetchCuadre(seller.seller_id);
  };

  const handleCloseCuadre = async () => {
    if (!selectedSeller || !cuadre || !payAmount) return;
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount < 0) {
      Alert.alert('Error', 'Ingrese un monto válido');
      return;
    }

    setSubmitting(true);
    try {
      const body: any = {
        seller_id: selectedSeller.seller_id,
        amount_paid: amount,
        notes: payNotes || '',
      };
      if (startDate) body.start_date = `${startDate}T00:00:00`;
      if (endDate) body.end_date = `${endDate}T23:59:59`;

      const res = await fetch(`${API_URL}/api/settlements/close`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        Alert.alert('Cuadre Cerrado', `Balance restante: ${formatCurrency(data.settlement.balance_after, cuadre.currency)}`);
        setShowPayModal(false);
        setPayAmount('');
        setPayNotes('');
        fetchCuadre(selectedSeller.seller_id);
        fetchSellers();
      } else {
        const err = await res.json();
        Alert.alert('Error', err.detail || 'No se pudo cerrar el cuadre');
      }
    } catch (e) {
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickPayment = async () => {
    if (!selectedSeller || !payAmount) return;
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Ingrese un monto válido');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/settlements/payment`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seller_id: selectedSeller.seller_id,
          amount: amount,
          notes: payNotes || '',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        Alert.alert('Pago Registrado', `Nuevo balance: ${formatCurrency(data.new_balance, selectedSeller.currency)}`);
        setShowPayModal(false);
        setPayAmount('');
        setPayNotes('');
        fetchCuadre(selectedSeller.seller_id);
        fetchSellers();
      } else {
        const err = await res.json();
        Alert.alert('Error', err.detail || 'No se pudo registrar el pago');
      }
    } catch (e) {
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setSubmitting(false);
    }
  };

  const goBack = () => {
    if (viewMode === 'history') {
      setViewMode('cuadre');
      if (selectedSeller) fetchCuadre(selectedSeller.seller_id);
    } else if (viewMode === 'cuadre') {
      setViewMode('sellers');
      setSelectedSeller(null);
      setCuadre(null);
      setStartDate('');
      setEndDate('');
      fetchSellers();
    } else {
      router.back();
    }
  };

  // ========== RENDER: Sellers List ==========
  const renderSellers = () => (
    <>
      <View style={s.summaryCard} data-testid="total-balance-card">
        <Text style={s.summaryLabel}>Balance Total Pendiente</Text>
        <Text style={[s.summaryValue, totalBalance > 0 ? s.positive : s.negative]}>
          {formatCurrency(totalBalance, user?.currency || 'RD$')}
        </Text>
        <Text style={s.summarySubtext}>{sellers.length} vendedores</Text>
      </View>

      {sellers.map((seller) => (
        <TouchableOpacity
          key={seller.seller_id}
          style={s.sellerCard}
          onPress={() => selectSeller(seller)}
          data-testid={`seller-card-${seller.seller_id}`}
        >
          <View style={s.sellerInfo}>
            <View style={s.sellerAvatar}>
              <Ionicons name="person" size={20} color="#fff" />
            </View>
            <View style={s.sellerText}>
              <Text style={s.sellerName}>{seller.seller_name}</Text>
              <Text style={s.sellerMeta}>Comisión: {seller.commission_rate}%</Text>
            </View>
          </View>
          <View style={s.sellerRight}>
            <Text style={[s.sellerBalance, seller.balance > 0 ? s.positive : seller.balance < 0 ? s.negative : s.neutral]}>
              {seller.balance >= 0 ? '' : '-'}{formatCurrency(seller.balance, seller.currency)}
            </Text>
            <Ionicons name="chevron-forward" size={18} color="#64748b" />
          </View>
        </TouchableOpacity>
      ))}
    </>
  );

  // ========== RENDER: Cuadre Detail ==========
  const renderCuadre = () => {
    if (!cuadre) return <ActivityIndicator size="large" color="#22c55e" />;

    return (
      <>
        {/* Date Filter */}
        <TouchableOpacity
          style={s.dateFilterBtn}
          onPress={() => setShowDateFilter(!showDateFilter)}
          data-testid="date-filter-toggle"
        >
          <Ionicons name="calendar-outline" size={18} color="#94a3b8" />
          <Text style={s.dateFilterText}>
            {startDate && endDate ? `${startDate} — ${endDate}` : 'Filtrar por fecha'}
          </Text>
          <Ionicons name={showDateFilter ? 'chevron-up' : 'chevron-down'} size={16} color="#94a3b8" />
        </TouchableOpacity>

        {showDateFilter && (
          <View style={s.dateInputs}>
            <View style={s.dateInputGroup}>
              <Text style={s.dateLabel}>Desde</Text>
              <TextInput
                style={s.dateInput}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="2026-03-01"
                placeholderTextColor="#475569"
                data-testid="start-date-input"
              />
            </View>
            <View style={s.dateInputGroup}>
              <Text style={s.dateLabel}>Hasta</Text>
              <TextInput
                style={s.dateInput}
                value={endDate}
                onChangeText={setEndDate}
                placeholder="2026-03-28"
                placeholderTextColor="#475569"
                data-testid="end-date-input"
              />
            </View>
            <TouchableOpacity
              style={s.dateApplyBtn}
              onPress={() => {
                if (selectedSeller) fetchCuadre(selectedSeller.seller_id);
                setShowDateFilter(false);
              }}
              data-testid="apply-date-filter"
            >
              <Text style={s.dateApplyText}>Aplicar</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Cuadre Breakdown Card */}
        <View style={s.cuadreCard} data-testid="cuadre-breakdown">
          <Text style={s.cuadreTitle}>Cuadre de {cuadre.seller_name}</Text>
          <Text style={s.cuadrePeriod}>
            {formatDate(cuadre.period_start)} — {formatDate(cuadre.period_end)}
          </Text>

          <View style={s.cuadreRow}>
            <Text style={s.cuadreLabel}>Venta Total</Text>
            <Text style={s.cuadreValue}>{formatCurrency(cuadre.total_sales, cuadre.currency)}</Text>
          </View>
          <View style={s.cuadreDivider} />

          <View style={s.cuadreRow}>
            <Text style={s.cuadreLabelSub}>Comisión ({cuadre.commission_rate}%)</Text>
            <Text style={[s.cuadreValue, s.negative]}>- {formatCurrency(cuadre.total_commission, cuadre.currency)}</Text>
          </View>

          <View style={s.cuadreRow}>
            <Text style={s.cuadreLabelSub}>Premios Pagados</Text>
            <Text style={[s.cuadreValue, s.negative]}>- {formatCurrency(cuadre.total_wins, cuadre.currency)}</Text>
          </View>
          <View style={s.cuadreDivider} />

          <View style={s.cuadreRow}>
            <Text style={s.cuadreLabelBold}>Ganancia Neta</Text>
            <Text style={[s.cuadreValueBold, cuadre.net_profit >= 0 ? s.positive : s.negative]}>
              {cuadre.net_profit < 0 ? '- ' : ''}{formatCurrency(cuadre.net_profit, cuadre.currency)}
            </Text>
          </View>

          {cuadre.running_balance !== 0 && (
            <>
              <View style={s.cuadreDivider} />
              <View style={s.cuadreRow}>
                <Text style={s.cuadreLabelSub}>Balance Anterior</Text>
                <Text style={s.cuadreValue}>{formatCurrency(cuadre.running_balance, cuadre.currency)}</Text>
              </View>
              <View style={s.cuadreRow}>
                <Text style={s.cuadreLabelBold}>Total a Cobrar</Text>
                <Text style={[s.cuadreValueBold, cuadre.total_due >= 0 ? s.positive : s.negative]}>
                  {cuadre.total_due < 0 ? '- ' : ''}{formatCurrency(cuadre.total_due, cuadre.currency)}
                </Text>
              </View>
            </>
          )}

          <View style={s.cuadreStats}>
            <View style={s.cuadreStat}>
              <Text style={s.cuadreStatNum}>{cuadre.tickets_sold}</Text>
              <Text style={s.cuadreStatLabel}>Boletos</Text>
            </View>
            <View style={s.cuadreStat}>
              <Text style={[s.cuadreStatNum, { color: '#f59e0b' }]}>{cuadre.tickets_won}</Text>
              <Text style={s.cuadreStatLabel}>Ganadores</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={s.actionRow}>
          <TouchableOpacity
            style={s.actionBtnPrimary}
            onPress={() => { setPayAmount(''); setPayNotes(''); setShowPayModal(true); }}
            data-testid="close-cuadre-btn"
          >
            <Ionicons name="checkmark-circle" size={20} color="#0f172a" />
            <Text style={s.actionBtnPrimaryText}>Cerrar Cuadre</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.actionBtnSecondary}
            onPress={() => {
              setViewMode('history');
              if (selectedSeller) fetchHistory(selectedSeller.seller_id);
            }}
            data-testid="view-history-btn"
          >
            <Ionicons name="time-outline" size={20} color="#94a3b8" />
            <Text style={s.actionBtnSecondaryText}>Historial</Text>
          </TouchableOpacity>
        </View>

        {/* Winning Tickets */}
        {cuadre.winning_tickets && cuadre.winning_tickets.length > 0 && (
          <View style={s.winSection}>
            <Text style={s.winTitle}>Tickets Ganadores ({cuadre.tickets_won})</Text>
            {cuadre.winning_tickets.map((t: any, i: number) => (
              <View key={i} style={s.winTicket}>
                <View>
                  <Text style={s.winTicketNum}>{t.ticket_number}</Text>
                  <Text style={s.winTicketDate}>{formatDate(t.created_at)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.winTicketPrize}>{formatCurrency(t.prize, cuadre.currency)}</Text>
                  {t.won_position && <Text style={s.winTicketPos}>{t.won_position}</Text>}
                </View>
              </View>
            ))}
          </View>
        )}
      </>
    );
  };

  // ========== RENDER: History ==========
  const renderHistory = () => (
    <>
      {settlements.length === 0 ? (
        <View style={s.emptyState}>
          <Ionicons name="document-text-outline" size={48} color="#475569" />
          <Text style={s.emptyText}>Sin cuadres registrados</Text>
        </View>
      ) : (
        settlements.map((st) => (
          <View key={st.id} style={s.historyCard} data-testid={`settlement-${st.id}`}>
            <View style={s.historyHeader}>
              <Text style={s.historyDate}>{formatDateTime(st.created_at)}</Text>
              <Text style={s.historyBy}>por {st.closed_by_name}</Text>
            </View>
            <View style={s.historyRows}>
              <View style={s.historyRow}>
                <Text style={s.historyLabel}>Ventas</Text>
                <Text style={s.historyValue}>{formatCurrency(st.total_sales, st.currency)}</Text>
              </View>
              <View style={s.historyRow}>
                <Text style={s.historyLabel}>Comisión</Text>
                <Text style={[s.historyValue, s.negative]}>- {formatCurrency(st.total_commission, st.currency)}</Text>
              </View>
              <View style={s.historyRow}>
                <Text style={s.historyLabel}>Premios</Text>
                <Text style={[s.historyValue, s.negative]}>- {formatCurrency(st.total_wins, st.currency)}</Text>
              </View>
              <View style={s.historyDivider} />
              <View style={s.historyRow}>
                <Text style={s.historyLabelBold}>Debido</Text>
                <Text style={s.historyValueBold}>{formatCurrency(st.amount_due, st.currency)}</Text>
              </View>
              <View style={s.historyRow}>
                <Text style={s.historyLabelBold}>Pagado</Text>
                <Text style={[s.historyValueBold, { color: '#22c55e' }]}>{formatCurrency(st.amount_paid, st.currency)}</Text>
              </View>
              <View style={s.historyRow}>
                <Text style={s.historyLabelBold}>Balance</Text>
                <Text style={[s.historyValueBold, st.balance_after > 0 ? s.positive : st.balance_after < 0 ? s.negative : s.neutral]}>
                  {st.balance_after < 0 ? '- ' : ''}{formatCurrency(st.balance_after, st.currency)}
                </Text>
              </View>
            </View>
            {st.notes ? <Text style={s.historyNotes}>{st.notes}</Text> : null}
          </View>
        ))
      )}
    </>
  );

  // ========== MAIN RENDER ==========
  const getTitle = () => {
    if (viewMode === 'history') return `Historial - ${selectedSeller?.seller_name || ''}`;
    if (viewMode === 'cuadre') return `Cuadre - ${selectedSeller?.seller_name || ''}`;
    return 'Cuadre de Vendedores';
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={goBack} style={s.backBtn} data-testid="cuadre-back-btn">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{getTitle()}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={s.content}
        contentContainerStyle={[s.contentInner, isDesktop && { maxWidth: 600, alignSelf: 'center' }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />}
      >
        {loading && !refreshing ? (
          <ActivityIndicator size="large" color="#22c55e" style={{ marginTop: 40 }} />
        ) : (
          <>
            {viewMode === 'sellers' && renderSellers()}
            {viewMode === 'cuadre' && renderCuadre()}
            {viewMode === 'history' && renderHistory()}
          </>
        )}
      </ScrollView>

      {/* Payment Modal */}
      <Modal visible={showPayModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Cerrar Cuadre</Text>
            {cuadre && (
              <Text style={s.modalSubtitle}>
                Total debido: {formatCurrency(cuadre.total_due, cuadre.currency)}
              </Text>
            )}
            <Text style={s.inputLabel}>Monto Pagado</Text>
            <TextInput
              style={s.input}
              value={payAmount}
              onChangeText={setPayAmount}
              placeholder="0.00"
              placeholderTextColor="#475569"
              keyboardType="numeric"
              data-testid="pay-amount-input"
            />
            <Text style={s.inputLabel}>Notas (opcional)</Text>
            <TextInput
              style={[s.input, { height: 60 }]}
              value={payNotes}
              onChangeText={setPayNotes}
              placeholder="Ej: Pago en efectivo"
              placeholderTextColor="#475569"
              multiline
              data-testid="pay-notes-input"
            />
            <View style={s.modalBtns}>
              <TouchableOpacity
                style={s.modalBtnCancel}
                onPress={() => setShowPayModal(false)}
                data-testid="cancel-payment-btn"
              >
                <Text style={s.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtnConfirm, submitting && { opacity: 0.6 }]}
                onPress={handleCloseCuadre}
                disabled={submitting}
                data-testid="confirm-payment-btn"
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#0f172a" />
                ) : (
                  <Text style={s.modalBtnConfirmText}>Confirmar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, backgroundColor: '#1e293b',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#fff', textAlign: 'center' },
  content: { flex: 1 },
  contentInner: { padding: 16, paddingBottom: 40 },

  // Sellers List
  summaryCard: {
    backgroundColor: '#1e293b', borderRadius: 16, padding: 20, marginBottom: 16,
    alignItems: 'center', borderWidth: 1, borderColor: '#334155',
  },
  summaryLabel: { fontSize: 13, color: '#94a3b8', marginBottom: 4 },
  summaryValue: { fontSize: 28, fontWeight: '800' },
  summarySubtext: { fontSize: 12, color: '#64748b', marginTop: 4 },

  sellerCard: {
    backgroundColor: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 8,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: '#334155',
  },
  sellerInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  sellerAvatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#3b82f6',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  sellerText: { flex: 1 },
  sellerName: { fontSize: 15, fontWeight: '600', color: '#e2e8f0' },
  sellerMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
  sellerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sellerBalance: { fontSize: 15, fontWeight: '700' },

  // Cuadre
  dateFilterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#1e293b', borderRadius: 10, padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: '#334155',
  },
  dateFilterText: { flex: 1, color: '#94a3b8', fontSize: 14 },
  dateInputs: {
    backgroundColor: '#1e293b', borderRadius: 10, padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: '#334155',
  },
  dateInputGroup: { marginBottom: 8 },
  dateLabel: { fontSize: 12, color: '#94a3b8', marginBottom: 4 },
  dateInput: {
    backgroundColor: '#0f172a', borderRadius: 8, padding: 10,
    color: '#fff', fontSize: 14, borderWidth: 1, borderColor: '#334155',
  },
  dateApplyBtn: {
    backgroundColor: '#3b82f6', borderRadius: 8, padding: 10, alignItems: 'center', marginTop: 4,
  },
  dateApplyText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  cuadreCard: {
    backgroundColor: '#1e293b', borderRadius: 16, padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: '#334155',
  },
  cuadreTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 2 },
  cuadrePeriod: { fontSize: 12, color: '#64748b', marginBottom: 16 },
  cuadreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  cuadreLabel: { fontSize: 15, color: '#e2e8f0' },
  cuadreLabelSub: { fontSize: 14, color: '#94a3b8', paddingLeft: 8 },
  cuadreLabelBold: { fontSize: 15, fontWeight: '700', color: '#fff' },
  cuadreValue: { fontSize: 15, color: '#e2e8f0', fontWeight: '500' },
  cuadreValueBold: { fontSize: 17, fontWeight: '800' },
  cuadreDivider: { height: 1, backgroundColor: '#334155', marginVertical: 8 },

  cuadreStats: {
    flexDirection: 'row', justifyContent: 'center', gap: 32, marginTop: 16,
    paddingTop: 12, borderTopWidth: 1, borderTopColor: '#334155',
  },
  cuadreStat: { alignItems: 'center' },
  cuadreStatNum: { fontSize: 22, fontWeight: '800', color: '#fff' },
  cuadreStatLabel: { fontSize: 11, color: '#64748b', marginTop: 2 },

  // Actions
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  actionBtnPrimary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#22c55e', borderRadius: 12, padding: 14,
  },
  actionBtnPrimaryText: { color: '#0f172a', fontSize: 15, fontWeight: '700' },
  actionBtnSecondary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#1e293b', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#334155',
  },
  actionBtnSecondaryText: { color: '#94a3b8', fontSize: 15, fontWeight: '600' },

  // Winning Tickets
  winSection: { marginTop: 4 },
  winTitle: { fontSize: 15, fontWeight: '700', color: '#f59e0b', marginBottom: 10 },
  winTicket: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#1e293b', borderRadius: 10, padding: 12, marginBottom: 6,
    borderWidth: 1, borderColor: '#334155',
  },
  winTicketNum: { fontSize: 14, fontWeight: '600', color: '#e2e8f0' },
  winTicketDate: { fontSize: 11, color: '#64748b', marginTop: 2 },
  winTicketPrize: { fontSize: 14, fontWeight: '700', color: '#f59e0b' },
  winTicketPos: { fontSize: 11, color: '#64748b', marginTop: 2, textAlign: 'right' },

  // History
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 14, color: '#64748b', marginTop: 8 },
  historyCard: {
    backgroundColor: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: '#334155',
  },
  historyHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  },
  historyDate: { fontSize: 14, fontWeight: '600', color: '#e2e8f0' },
  historyBy: { fontSize: 12, color: '#64748b' },
  historyRows: {},
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  historyLabel: { fontSize: 13, color: '#94a3b8' },
  historyValue: { fontSize: 13, color: '#e2e8f0' },
  historyLabelBold: { fontSize: 14, fontWeight: '700', color: '#fff' },
  historyValueBold: { fontSize: 14, fontWeight: '700' },
  historyDivider: { height: 1, backgroundColor: '#334155', marginVertical: 6 },
  historyNotes: { fontSize: 12, color: '#64748b', fontStyle: 'italic', marginTop: 8 },

  // Colors
  positive: { color: '#22c55e' },
  negative: { color: '#ef4444' },
  neutral: { color: '#94a3b8' },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1e293b', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 4 },
  modalSubtitle: { fontSize: 14, color: '#94a3b8', marginBottom: 20 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#94a3b8', marginBottom: 6 },
  input: {
    backgroundColor: '#0f172a', borderRadius: 10, padding: 14,
    color: '#fff', fontSize: 16, borderWidth: 1, borderColor: '#334155',
    marginBottom: 14,
  },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  modalBtnCancel: {
    flex: 1, padding: 14, borderRadius: 12, alignItems: 'center',
    borderWidth: 1, borderColor: '#475569',
  },
  modalBtnCancelText: { color: '#94a3b8', fontSize: 15, fontWeight: '600' },
  modalBtnConfirm: {
    flex: 1, padding: 14, borderRadius: 12, alignItems: 'center',
    backgroundColor: '#22c55e',
  },
  modalBtnConfirmText: { color: '#0f172a', fontSize: 15, fontWeight: '700' },
});

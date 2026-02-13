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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface CommissionDetail {
  id: string;
  ticket_number: string;
  lottery_name: string;
  sale_amount: number;
  commission_rate: number;
  commission_earned: number;
  currency: string;
  created_at: string;
  seller_name?: string;
}

interface CommissionSummary {
  total_sales: number;
  total_commission: number;
  commission_rate: number;
  currency: string;
  ticket_count: number;
  average_sale: number;
}

interface SellerCommission {
  seller_id: string;
  seller_name: string;
  total_sales: number;
  total_commission: number;
  commission_rate: number;
  ticket_count: number;
}

export default function CommissionReport() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState<CommissionDetail[]>([]);
  const [summary, setSummary] = useState<CommissionSummary | null>(null);
  const [sellerBreakdown, setSellerBreakdown] = useState<SellerCommission[]>([]);
  const [selectedSeller, setSelectedSeller] = useState<SellerCommission | null>(null);
  const [showSellerModal, setShowSellerModal] = useState(false);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');

  const isSuperAdmin = user?.role === 'super_admin';

  const fetchCommissionReport = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/api/accounting/commissions?period=${period}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.details || []);
        setSummary(data.summary || null);
        setSellerBreakdown(data.seller_breakdown || []);
      }
    } catch (error) {
      console.error('Error fetching commission report:', error);
    } finally {
      setLoading(false);
    }
  }, [token, period]);

  useEffect(() => {
    setLoading(true);
    fetchCommissionReport();
  }, [fetchCommissionReport]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCommissionReport();
    setRefreshing(false);
  };

  const formatCurrency = (amount: number, currency: string = 'RD$') => {
    return `${currency} ${amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('es-DO', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPeriodLabel = () => {
    switch (period) {
      case 'today': return 'Hoy';
      case 'week': return 'Esta Semana';
      case 'month': return 'Este Mes';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#f59e0b" style={styles.loader} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalle de Comisiones</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Ionicons name="refresh" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Period Filter */}
      <View style={styles.periodFilter}>
        <TouchableOpacity
          style={[styles.periodBtn, period === 'today' && styles.periodBtnActive]}
          onPress={() => setPeriod('today')}
        >
          <Text style={[styles.periodBtnText, period === 'today' && styles.periodBtnTextActive]}>Hoy</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.periodBtn, period === 'week' && styles.periodBtnActive]}
          onPress={() => setPeriod('week')}
        >
          <Text style={[styles.periodBtnText, period === 'week' && styles.periodBtnTextActive]}>Semana</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.periodBtn, period === 'month' && styles.periodBtnActive]}
          onPress={() => setPeriod('month')}
        >
          <Text style={[styles.periodBtnText, period === 'month' && styles.periodBtnTextActive]}>Mes</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f59e0b" />
        }
      >
        {/* Summary Card */}
        {summary && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Ionicons name="calculator" size={24} color="#f59e0b" />
              <Text style={styles.summaryTitle}>Resumen {getPeriodLabel()}</Text>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Ventas Totales:</Text>
              <Text style={styles.summaryValue}>{formatCurrency(summary.total_sales, summary.currency)}</Text>
            </View>
            
            <View style={styles.formulaBox}>
              <Text style={styles.formulaTitle}>Cálculo de Comisión:</Text>
              <View style={styles.formulaContent}>
                <Text style={styles.formulaText}>
                  {formatCurrency(summary.total_sales, summary.currency)}
                </Text>
                <Text style={styles.formulaOperator}>×</Text>
                <Text style={styles.formulaRate}>{summary.commission_rate}%</Text>
                <Text style={styles.formulaOperator}>=</Text>
                <Text style={styles.formulaResult}>
                  {formatCurrency(summary.total_commission, summary.currency)}
                </Text>
              </View>
            </View>

            <View style={styles.summaryStats}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{summary.ticket_count}</Text>
                <Text style={styles.statLabel}>Boletos</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{formatCurrency(summary.average_sale, summary.currency)}</Text>
                <Text style={styles.statLabel}>Promedio</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, styles.commissionColor]}>
                  {formatCurrency(summary.total_commission, summary.currency)}
                </Text>
                <Text style={styles.statLabel}>Comisión</Text>
              </View>
            </View>
          </View>
        )}

        {/* Seller Breakdown (Super Admin Only) */}
        {isSuperAdmin && sellerBreakdown.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Desglose por Vendedor</Text>
            {sellerBreakdown.map((seller) => (
              <TouchableOpacity
                key={seller.seller_id}
                style={styles.sellerCard}
                onPress={() => {
                  setSelectedSeller(seller);
                  setShowSellerModal(true);
                }}
              >
                <View style={styles.sellerInfo}>
                  <View style={styles.sellerAvatar}>
                    <Text style={styles.sellerInitial}>{seller.seller_name.charAt(0)}</Text>
                  </View>
                  <View style={styles.sellerDetails}>
                    <Text style={styles.sellerName}>{seller.seller_name}</Text>
                    <Text style={styles.sellerStats}>
                      {seller.ticket_count} boletos · {seller.commission_rate}% comisión
                    </Text>
                  </View>
                </View>
                <View style={styles.sellerAmounts}>
                  <Text style={styles.sellerSales}>{formatCurrency(seller.total_sales, summary?.currency || 'RD$')}</Text>
                  <Text style={styles.sellerCommission}>
                    +{formatCurrency(seller.total_commission, summary?.currency || 'RD$')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#64748b" />
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* Transaction Details */}
        <Text style={styles.sectionTitle}>Detalle por Venta</Text>
        {transactions.length > 0 ? (
          transactions.map((tx) => (
            <View key={tx.id} style={styles.transactionCard}>
              <View style={styles.txHeader}>
                <View style={styles.txTicket}>
                  <Ionicons name="ticket" size={16} color="#22c55e" />
                  <Text style={styles.txTicketNumber}>{tx.ticket_number}</Text>
                </View>
                <Text style={styles.txDate}>{formatDate(tx.created_at)}</Text>
              </View>
              
              <Text style={styles.txLottery}>{tx.lottery_name}</Text>
              {tx.seller_name && (
                <Text style={styles.txSeller}>Vendedor: {tx.seller_name}</Text>
              )}
              
              <View style={styles.txBreakdown}>
                <View style={styles.txRow}>
                  <Text style={styles.txLabel}>Monto Venta:</Text>
                  <Text style={styles.txValue}>{formatCurrency(tx.sale_amount, tx.currency)}</Text>
                </View>
                <View style={styles.txRow}>
                  <Text style={styles.txLabel}>Tasa Comisión:</Text>
                  <Text style={styles.txRate}>{tx.commission_rate}%</Text>
                </View>
                <View style={[styles.txRow, styles.txTotal]}>
                  <Text style={styles.txTotalLabel}>Comisión Ganada:</Text>
                  <Text style={styles.txTotalValue}>+{formatCurrency(tx.commission_earned, tx.currency)}</Text>
                </View>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={48} color="#475569" />
            <Text style={styles.emptyText}>No hay ventas en este período</Text>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Seller Detail Modal */}
      <Modal visible={showSellerModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detalle Vendedor</Text>
              <TouchableOpacity onPress={() => setShowSellerModal(false)}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
            {selectedSeller && (
              <View style={styles.modalBody}>
                <View style={styles.sellerModalAvatar}>
                  <Text style={styles.sellerModalInitial}>{selectedSeller.seller_name.charAt(0)}</Text>
                </View>
                <Text style={styles.sellerModalName}>{selectedSeller.seller_name}</Text>
                
                <View style={styles.modalStatGrid}>
                  <View style={styles.modalStat}>
                    <Text style={styles.modalStatLabel}>Boletos Vendidos</Text>
                    <Text style={styles.modalStatValue}>{selectedSeller.ticket_count}</Text>
                  </View>
                  <View style={styles.modalStat}>
                    <Text style={styles.modalStatLabel}>Tasa Comisión</Text>
                    <Text style={styles.modalStatValue}>{selectedSeller.commission_rate}%</Text>
                  </View>
                </View>

                <View style={styles.modalCalculation}>
                  <Text style={styles.modalCalcTitle}>Cálculo de Comisión</Text>
                  <View style={styles.modalCalcRow}>
                    <Text style={styles.modalCalcLabel}>Ventas Totales</Text>
                    <Text style={styles.modalCalcValue}>{formatCurrency(selectedSeller.total_sales, summary?.currency || 'RD$')}</Text>
                  </View>
                  <View style={styles.modalCalcRow}>
                    <Text style={styles.modalCalcLabel}>× Tasa ({selectedSeller.commission_rate}%)</Text>
                    <Text style={styles.modalCalcValue}>×</Text>
                  </View>
                  <View style={[styles.modalCalcRow, styles.modalCalcTotal]}>
                    <Text style={styles.modalCalcTotalLabel}>Comisión Ganada</Text>
                    <Text style={styles.modalCalcTotalValue}>{formatCurrency(selectedSeller.total_commission, summary?.currency || 'RD$')}</Text>
                  </View>
                </View>
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
  periodFilter: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    alignItems: 'center',
  },
  periodBtnActive: {
    backgroundColor: '#f59e0b',
  },
  periodBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#94a3b8',
  },
  periodBtnTextActive: {
    color: '#000000',
  },
  content: {
    flex: 1,
    padding: 12,
  },
  summaryCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#94a3b8',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  formulaBox: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
  },
  formulaTitle: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 10,
    textAlign: 'center',
  },
  formulaContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  formulaText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
  formulaOperator: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '600',
  },
  formulaRate: {
    fontSize: 16,
    color: '#f59e0b',
    fontWeight: '700',
    backgroundColor: '#f59e0b20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  formulaResult: {
    fontSize: 16,
    color: '#22c55e',
    fontWeight: '700',
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
  },
  commissionColor: {
    color: '#f59e0b',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 8,
    marginBottom: 12,
  },
  sellerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  sellerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sellerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerInitial: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  sellerDetails: {
    marginLeft: 12,
  },
  sellerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  sellerStats: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  sellerAmounts: {
    alignItems: 'flex-end',
    marginRight: 8,
  },
  sellerSales: {
    fontSize: 13,
    color: '#94a3b8',
  },
  sellerCommission: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f59e0b',
  },
  transactionCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  txHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  txTicket: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  txTicketNumber: {
    fontSize: 13,
    fontWeight: '600',
    color: '#22c55e',
    marginLeft: 6,
  },
  txDate: {
    fontSize: 11,
    color: '#64748b',
  },
  txLottery: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
    marginBottom: 4,
  },
  txSeller: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 8,
  },
  txBreakdown: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  txLabel: {
    fontSize: 13,
    color: '#94a3b8',
  },
  txValue: {
    fontSize: 13,
    color: '#ffffff',
  },
  txRate: {
    fontSize: 13,
    color: '#f59e0b',
    fontWeight: '600',
  },
  txTotal: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    marginBottom: 0,
  },
  txTotalLabel: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '500',
  },
  txTotalValue: {
    fontSize: 15,
    color: '#22c55e',
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 12,
  },
  bottomSpacer: {
    height: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  modalBody: {
    padding: 24,
    alignItems: 'center',
  },
  sellerModalAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  sellerModalInitial: {
    fontSize: 36,
    fontWeight: '600',
    color: '#ffffff',
  },
  sellerModalName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 24,
  },
  modalStatGrid: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 24,
  },
  modalStat: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    marginHorizontal: 6,
  },
  modalStatLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  modalStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  modalCalculation: {
    width: '100%',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
  },
  modalCalcTitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalCalcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  modalCalcLabel: {
    fontSize: 14,
    color: '#94a3b8',
  },
  modalCalcValue: {
    fontSize: 14,
    color: '#ffffff',
  },
  modalCalcTotal: {
    borderTopWidth: 1,
    borderTopColor: '#334155',
    marginTop: 8,
    paddingTop: 12,
  },
  modalCalcTotalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  modalCalcTotalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f59e0b',
  },
});

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

interface Transaction {
  id: string;
  user_name: string;
  transaction_type: string;
  amount: number;
  currency: string;
  description: string;
  created_at: string;
}

interface ReportData {
  period: string;
  total_sales: number;
  total_wins: number;
  total_commission: number;
  net_profit: number;
  currency: string;
  tickets_sold: number;
  tickets_won: number;
  transactions: Transaction[];
}

export default function Accounting() {
  const { token } = useAuth();
  const router = useRouter();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchReport = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/api/accounting/report`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setReport(data);
      }
    } catch (error) {
      console.error('Error fetching report:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchReport();
    setRefreshing(false);
  };

  const formatCurrency = (amount: number, currency: string) => {
    return `${currency} ${amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'sale': return 'cart';
      case 'win': return 'trophy';
      case 'deposit': return 'arrow-down';
      case 'withdrawal': return 'arrow-up';
      default: return 'cash';
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'sale': return '#22c55e';
      case 'win': return '#ef4444';
      case 'deposit': return '#3b82f6';
      case 'withdrawal': return '#f59e0b';
      default: return '#94a3b8';
    }
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
        <Text style={styles.headerTitle}>Contabilidad</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Ionicons name="refresh" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />
        }
      >
        {report && (
          <>
            {/* Period */}
            <Text style={styles.period}>Período: {report.period}</Text>

            {/* Summary Cards */}
            <View style={styles.summaryGrid}>
              <View style={[styles.summaryCard, styles.salesCard]}>
                <Ionicons name="cart" size={24} color="#22c55e" />
                <Text style={styles.summaryLabel}>Ventas Totales</Text>
                <Text style={styles.summaryValue}>
                  {formatCurrency(report.total_sales, report.currency)}
                </Text>
                <Text style={styles.summarySubtext}>{report.tickets_sold} boletos</Text>
              </View>

              <View style={[styles.summaryCard, styles.winsCard]}>
                <Ionicons name="trophy" size={24} color="#ef4444" />
                <Text style={styles.summaryLabel}>Premios Pagados</Text>
                <Text style={[styles.summaryValue, styles.redText]}>
                  {formatCurrency(report.total_wins, report.currency)}
                </Text>
                <Text style={styles.summarySubtext}>{report.tickets_won} ganadores</Text>
              </View>
            </View>

            {/* Profit Card */}
            <View style={[styles.profitCard, report.net_profit >= 0 ? styles.profitPositive : styles.profitNegative]}>
              <View style={styles.profitHeader}>
                <Ionicons
                  name={report.net_profit >= 0 ? 'trending-up' : 'trending-down'}
                  size={32}
                  color={report.net_profit >= 0 ? '#22c55e' : '#ef4444'}
                />
                <Text style={styles.profitLabel}>Ganancia Neta</Text>
              </View>
              <Text style={[styles.profitValue, report.net_profit >= 0 ? styles.greenText : styles.redText]}>
                {formatCurrency(report.net_profit, report.currency)}
              </Text>
              <View style={styles.commissionRow}>
                <Text style={styles.commissionLabel}>Comisión (10%):</Text>
                <Text style={styles.commissionValue}>
                  {formatCurrency(report.total_commission, report.currency)}
                </Text>
              </View>
            </View>

            {/* ROI */}
            <View style={styles.roiCard}>
              <Text style={styles.roiLabel}>Retorno de Inversión (ROI)</Text>
              <Text style={[styles.roiValue, report.total_sales > 0 ? styles.greenText : styles.neutralText]}>
                {report.total_sales > 0
                  ? `${((report.net_profit / report.total_sales) * 100).toFixed(1)}%`
                  : 'N/A'}
              </Text>
            </View>

            {/* Transactions */}
            <Text style={styles.sectionTitle}>Últimas Transacciones</Text>
            {report.transactions.length > 0 ? (
              report.transactions.slice(0, 20).map((tx) => (
                <View key={tx.id} style={styles.transactionItem}>
                  <View style={[styles.txIcon, { backgroundColor: getTransactionColor(tx.transaction_type) + '20' }]}>
                    <Ionicons
                      name={getTransactionIcon(tx.transaction_type) as any}
                      size={20}
                      color={getTransactionColor(tx.transaction_type)}
                    />
                  </View>
                  <View style={styles.txDetails}>
                    <Text style={styles.txDescription} numberOfLines={1}>
                      {tx.description}
                    </Text>
                    <Text style={styles.txDate}>
                      {new Date(tx.created_at).toLocaleString('es-DO')}
                    </Text>
                  </View>
                  <Text style={[styles.txAmount, { color: getTransactionColor(tx.transaction_type) }]}>
                    {tx.transaction_type === 'win' ? '-' : '+'}
                    {formatCurrency(tx.amount, tx.currency)}
                  </Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="receipt-outline" size={48} color="#475569" />
                <Text style={styles.emptyText}>No hay transacciones</Text>
              </View>
            )}
          </>
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
  period: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 16,
    textAlign: 'center',
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  summaryCard: {
    width: '48%',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  salesCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#22c55e',
  },
  winsCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 8,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 4,
  },
  summarySubtext: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
  },
  redText: {
    color: '#ef4444',
  },
  greenText: {
    color: '#22c55e',
  },
  neutralText: {
    color: '#94a3b8',
  },
  profitCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  profitPositive: {
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  profitNegative: {
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  profitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  profitLabel: {
    fontSize: 14,
    color: '#94a3b8',
    marginLeft: 8,
  },
  profitValue: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  commissionRow: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  commissionLabel: {
    fontSize: 13,
    color: '#94a3b8',
  },
  commissionValue: {
    fontSize: 13,
    color: '#f59e0b',
    fontWeight: '600',
    marginLeft: 8,
  },
  roiCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roiLabel: {
    fontSize: 14,
    color: '#94a3b8',
  },
  roiValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txDetails: {
    flex: 1,
    marginLeft: 12,
  },
  txDescription: {
    fontSize: 13,
    color: '#ffffff',
  },
  txDate: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '600',
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
});

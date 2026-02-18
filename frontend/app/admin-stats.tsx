import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart, LineChart, PieChart } from 'react-native-gifted-charts';
import ViewShot from 'react-native-view-shot';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const { width } = Dimensions.get('window');
const isDesktop = width > 768;

// Conditionally import html2canvas for web
let html2canvas: any = null;
if (Platform.OS === 'web') {
  html2canvas = require('html2canvas');
}

interface DashboardStats {
  period: string;
  start_date: string;
  summary: {
    total_sales: number;
    total_won: number;
    net_profit: number;
    total_tickets: number;
    total_commissions: number;
    avg_ticket_value: number;
  };
  growth: {
    sales_percent: number;
    tickets_percent: number;
    prev_sales: number;
    prev_tickets: number;
  };
  status_breakdown: { [key: string]: number };
  sales_by_lottery: { name: string; value: number }[];
  daily_sales: { date: string; value: number }[];
  top_sellers: { name: string; sales: number; tickets: number }[];
}

interface ExtendedStats {
  period: string;
  client_analytics: {
    total_clients: number;
    new_clients: number;
    new_clients_growth: number;
    active_clients: number;
    conversion_rate: number;
    top_clients: { name: string; phone: string; plays: number; total_spent: number; won: number }[];
  };
  lottery_analytics: {
    top_lotteries: { name: string; tickets: number; revenue: number; percentage: number; winners: number; prizes_paid: number; profit_margin: number }[];
    total_lotteries_played: number;
  };
  time_analytics: {
    hourly_distribution: { hour: number; count: number }[];
    weekly_distribution: { day: string; count: number }[];
  };
}

const PERIODS = [
  { key: 'day', label: 'Hoy' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mes' },
  { key: 'year', label: 'Año' },
];

export default function AdminStatsScreen() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState('month');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [extendedStats, setExtendedStats] = useState<ExtendedStats | null>(null);
  const reportRef = useRef<any>(null);
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'clients' | 'lotteries'>('overview');

  const fetchStats = useCallback(async () => {
    try {
      const [dashRes, extRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/stats/dashboard?period=${period}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(`${API_URL}/api/admin/stats/extended?period=${period}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        })
      ]);
      
      if (dashRes.ok) {
        const data = await dashRes.json();
        setStats(data);
      }
      if (extRes.ok) {
        const extData = await extRes.json();
        setExtendedStats(extData);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  }, [token, period]);

  useEffect(() => {
    setLoading(true);
    fetchStats();
  }, [fetchStats]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  };

  const formatCurrency = (amount: number) => {
    return `RD$ ${amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;
  };

  const getGrowthColor = (value: number) => {
    if (value > 0) return '#22c55e';
    if (value < 0) return '#ef4444';
    return '#64748b';
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      pending: '#f59e0b',
      won: '#22c55e',
      paid: '#3b82f6',
      lost: '#ef4444',
      cancelled: '#64748b',
    };
    return colors[status] || '#64748b';
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      if (Platform.OS === 'web' && html2canvas && reportRef.current) {
        const canvas = await html2canvas(reportRef.current, {
          backgroundColor: '#0f172a',
          scale: 2,
        });
        canvas.toBlob((blob: Blob | null) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `estadisticas-${period}-${new Date().toISOString().split('T')[0]}.png`;
            link.click();
            URL.revokeObjectURL(url);
          }
        });
      }
    } catch (error) {
      console.error('Export error:', error);
    }
    setExporting(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#22c55e" style={styles.loader} />
      </SafeAreaView>
    );
  }

  // Prepare chart data
  const barData = stats?.daily_sales.slice(-14).map((d, i) => ({
    value: d.value,
    label: d.date.split('-').slice(1).join('/'),
    frontColor: '#22c55e',
  })) || [];

  const lineData = stats?.daily_sales.map(d => ({
    value: d.value,
    dataPointText: '',
  })) || [];

  const pieData = Object.entries(stats?.status_breakdown || {}).map(([status, count]) => ({
    value: count,
    color: getStatusColor(status),
    text: status === 'pending' ? 'Pend.' : status === 'won' ? 'Gan.' : status === 'lost' ? 'Perd.' : status === 'paid' ? 'Pag.' : 'Canc.',
  }));

  const lotteryColors = ['#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#14b8a6', '#ef4444', '#6366f1', '#84cc16', '#f97316'];
  const lotteryBarData = stats?.sales_by_lottery.slice(0, 8).map((l, i) => ({
    value: l.value,
    label: l.name.substring(0, 8),
    frontColor: lotteryColors[i % lotteryColors.length],
  })) || [];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Estadísticas Avanzadas</Text>
        <TouchableOpacity onPress={handleExport} disabled={exporting}>
          {exporting ? (
            <ActivityIndicator size="small" color="#22c55e" />
          ) : (
            <Ionicons name="download-outline" size={24} color="#22c55e" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />}
        showsVerticalScrollIndicator={false}
      >
        <View ref={reportRef as any} style={styles.content}>
          {/* Period Selector */}
          <View style={styles.periodSelector}>
            {PERIODS.map(p => (
              <TouchableOpacity
                key={p.key}
                style={[styles.periodButton, period === p.key && styles.periodButtonActive]}
                onPress={() => setPeriod(p.key)}
              >
                <Text style={[styles.periodButtonText, period === p.key && styles.periodButtonTextActive]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Summary Cards */}
          <View style={styles.summaryGrid}>
            <View style={[styles.summaryCard, styles.summaryCardLarge]}>
              <View style={styles.cardIcon}>
                <Ionicons name="cash" size={24} color="#22c55e" />
              </View>
              <Text style={styles.cardLabel}>Ventas Totales</Text>
              <Text style={styles.cardValue}>{formatCurrency(stats?.summary.total_sales || 0)}</Text>
              <View style={styles.growthBadge}>
                <Ionicons
                  name={stats?.growth.sales_percent >= 0 ? 'trending-up' : 'trending-down'}
                  size={14}
                  color={getGrowthColor(stats?.growth.sales_percent || 0)}
                />
                <Text style={[styles.growthText, { color: getGrowthColor(stats?.growth.sales_percent || 0) }]}>
                  {stats?.growth.sales_percent > 0 ? '+' : ''}{stats?.growth.sales_percent?.toFixed(1)}%
                </Text>
              </View>
            </View>

            <View style={styles.summaryCard}>
              <View style={[styles.cardIcon, { backgroundColor: 'rgba(59, 130, 246, 0.2)' }]}>
                <Ionicons name="wallet" size={20} color="#3b82f6" />
              </View>
              <Text style={styles.cardLabel}>Ganancia Neta</Text>
              <Text style={[styles.cardValue, styles.cardValueSmall]}>{formatCurrency(stats?.summary.net_profit || 0)}</Text>
            </View>

            <View style={styles.summaryCard}>
              <View style={[styles.cardIcon, { backgroundColor: 'rgba(249, 115, 22, 0.2)' }]}>
                <Ionicons name="ticket" size={20} color="#f97316" />
              </View>
              <Text style={styles.cardLabel}>Boletos</Text>
              <Text style={[styles.cardValue, styles.cardValueSmall]}>{stats?.summary.total_tickets || 0}</Text>
              <View style={styles.growthBadge}>
                <Text style={[styles.growthTextSmall, { color: getGrowthColor(stats?.growth.tickets_percent || 0) }]}>
                  {stats?.growth.tickets_percent > 0 ? '+' : ''}{stats?.growth.tickets_percent?.toFixed(1)}%
                </Text>
              </View>
            </View>

            <View style={styles.summaryCard}>
              <View style={[styles.cardIcon, { backgroundColor: 'rgba(139, 92, 246, 0.2)' }]}>
                <Ionicons name="people" size={20} color="#8b5cf6" />
              </View>
              <Text style={styles.cardLabel}>Comisiones</Text>
              <Text style={[styles.cardValue, styles.cardValueSmall]}>{formatCurrency(stats?.summary.total_commissions || 0)}</Text>
            </View>

            <View style={styles.summaryCard}>
              <View style={[styles.cardIcon, { backgroundColor: 'rgba(236, 72, 153, 0.2)' }]}>
                <Ionicons name="trophy" size={20} color="#ec4899" />
              </View>
              <Text style={styles.cardLabel}>Premios Pagados</Text>
              <Text style={[styles.cardValue, styles.cardValueSmall]}>{formatCurrency(stats?.summary.total_won || 0)}</Text>
            </View>

            <View style={styles.summaryCard}>
              <View style={[styles.cardIcon, { backgroundColor: 'rgba(20, 184, 166, 0.2)' }]}>
                <Ionicons name="analytics" size={20} color="#14b8a6" />
              </View>
              <Text style={styles.cardLabel}>Promedio/Boleto</Text>
              <Text style={[styles.cardValue, styles.cardValueSmall]}>{formatCurrency(stats?.summary.avg_ticket_value || 0)}</Text>
            </View>
          </View>

          {/* Daily Sales Chart */}
          {barData.length > 0 && (
            <View style={styles.chartSection}>
              <Text style={styles.sectionTitle}>Ventas por Día</Text>
              <View style={styles.chartContainer}>
                <BarChart
                  data={barData}
                  width={isDesktop ? 500 : width - 80}
                  height={180}
                  barWidth={isDesktop ? 30 : 18}
                  spacing={isDesktop ? 15 : 8}
                  noOfSections={4}
                  yAxisColor="#334155"
                  xAxisColor="#334155"
                  yAxisTextStyle={{ color: '#94a3b8', fontSize: 10 }}
                  xAxisLabelTextStyle={{ color: '#94a3b8', fontSize: 8 }}
                  hideRules
                  barBorderRadius={4}
                  isAnimated
                />
              </View>
            </View>
          )}

          {/* Sales by Lottery */}
          {lotteryBarData.length > 0 && (
            <View style={styles.chartSection}>
              <Text style={styles.sectionTitle}>Ventas por Lotería</Text>
              <View style={styles.chartContainer}>
                <BarChart
                  data={lotteryBarData}
                  width={isDesktop ? 500 : width - 80}
                  height={180}
                  barWidth={isDesktop ? 35 : 25}
                  spacing={isDesktop ? 12 : 8}
                  noOfSections={4}
                  yAxisColor="#334155"
                  xAxisColor="#334155"
                  yAxisTextStyle={{ color: '#94a3b8', fontSize: 10 }}
                  xAxisLabelTextStyle={{ color: '#94a3b8', fontSize: 7 }}
                  hideRules
                  barBorderRadius={4}
                  isAnimated
                />
              </View>
            </View>
          )}

          {/* Status Breakdown */}
          {pieData.length > 0 && (
            <View style={styles.chartSection}>
              <Text style={styles.sectionTitle}>Estado de Boletos</Text>
              <View style={styles.pieContainer}>
                <PieChart
                  data={pieData}
                  donut
                  radius={80}
                  innerRadius={50}
                  centerLabelComponent={() => (
                    <View>
                      <Text style={styles.pieCenter}>{stats?.summary.total_tickets}</Text>
                      <Text style={styles.pieCenterLabel}>Total</Text>
                    </View>
                  )}
                />
                <View style={styles.legend}>
                  {Object.entries(stats?.status_breakdown || {}).map(([status, count]) => (
                    <View key={status} style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: getStatusColor(status) }]} />
                      <Text style={styles.legendText}>
                        {status === 'pending' ? 'Pendientes' : status === 'won' ? 'Ganadores' : status === 'lost' ? 'Perdidos' : status === 'paid' ? 'Pagados' : 'Cancelados'}: {count}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* Top Sellers */}
          {stats?.top_sellers && stats.top_sellers.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Top Vendedores</Text>
              {stats.top_sellers.slice(0, 5).map((seller, index) => (
                <View key={index} style={styles.sellerRow}>
                  <View style={styles.sellerRank}>
                    <Text style={styles.rankText}>#{index + 1}</Text>
                  </View>
                  <View style={styles.sellerInfo}>
                    <Text style={styles.sellerName}>{seller.name}</Text>
                    <Text style={styles.sellerMeta}>{seller.tickets} boletos</Text>
                  </View>
                  <Text style={styles.sellerSales}>{formatCurrency(seller.sales)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
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
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  content: {
    padding: 16,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  periodButtonActive: {
    backgroundColor: '#22c55e',
  },
  periodButtonText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  periodButtonTextActive: {
    color: '#ffffff',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  summaryCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    width: isDesktop ? 'calc(33.33% - 8px)' : '47%',
    flexGrow: 1,
  },
  summaryCardLarge: {
    width: '100%',
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardLabel: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 4,
  },
  cardValue: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
  },
  cardValueSmall: {
    fontSize: 16,
  },
  growthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  growthText: {
    fontSize: 14,
    fontWeight: '600',
  },
  growthTextSmall: {
    fontSize: 12,
    fontWeight: '600',
  },
  chartSection: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  chartContainer: {
    alignItems: 'center',
    overflow: 'hidden',
  },
  pieContainer: {
    flexDirection: isDesktop ? 'row' : 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  pieCenter: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  pieCenterLabel: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
  },
  legend: {
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  section: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  sellerRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  sellerInfo: {
    flex: 1,
  },
  sellerName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  sellerMeta: {
    color: '#64748b',
    fontSize: 12,
  },
  sellerSales: {
    color: '#22c55e',
    fontSize: 14,
    fontWeight: '700',
  },
});

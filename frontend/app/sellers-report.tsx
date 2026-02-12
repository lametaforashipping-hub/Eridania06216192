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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart } from 'react-native-gifted-charts';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const { width } = Dimensions.get('window');
const isDesktop = width > 768;
const chartWidth = isDesktop ? 600 : width - 64;

interface SellerReport {
  seller_id: string;
  seller_name: string;
  total_sales: number;
  total_wins: number;
  total_commission: number;
  net_profit: number;
  tickets_sold: number;
  tickets_won: number;
  commission_rate: number;
  currency: string;
}

export default function SellersReport() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [sellers, setSellers] = useState<SellerReport[]>([]);
  const [totals, setTotals] = useState<any>(null);
  const [period, setPeriod] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    if (!token) return;
    try {
      let url = `${API_URL}/api/accounting/sellers-report`;
      if (selectedCountry) {
        url += `?country=${selectedCountry}`;
      }
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSellers(data.sellers);
        setTotals(data.totals);
        setPeriod(data.period);
      }
    } catch (error) {
      console.error('Error fetching report:', error);
    } finally {
      setLoading(false);
    }
  }, [token, selectedCountry]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchReport();
    setRefreshing(false);
  };

  const formatCurrency = (amount: number, currency: string = 'RD$') => {
    const flag = currency === 'USD' || currency === '$' ? '🇺🇸' : '🇩🇴';
    const symbol = currency === 'USD' || currency === '$' ? '$' : 'RD$';
    return `${flag} ${symbol} ${amount.toLocaleString('es-DO', { minimumFractionDigits: 0 })}`;
  };

  const prepareChartData = () => {
    return sellers.slice(0, 10).map((s, index) => ({
      value: s.total_sales,
      label: s.seller_name.split(' ')[0],
      frontColor: index % 2 === 0 ? '#22c55e' : '#3b82f6',
    }));
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
        <Text style={styles.headerTitle}>Reporte por Vendedores</Text>
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
        {/* Country Filter for Super Admin */}
        {user?.role === 'super_admin' && (
          <View style={styles.countryFilter}>
            <Text style={styles.filterLabel}>Filtrar por país:</Text>
            <View style={styles.countryButtons}>
              <TouchableOpacity
                style={[styles.countryButton, !selectedCountry && styles.countryButtonActive]}
                onPress={() => setSelectedCountry(null)}
              >
                <Text style={[styles.countryButtonText, !selectedCountry && styles.countryButtonTextActive]}>
                  Todos
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.countryButton, selectedCountry === 'RD' && styles.countryButtonActive]}
                onPress={() => setSelectedCountry('RD')}
              >
                <Text style={[styles.countryButtonText, selectedCountry === 'RD' && styles.countryButtonTextActive]}>
                  RD
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.countryButton, selectedCountry === 'US' && styles.countryButtonActive]}
                onPress={() => setSelectedCountry('US')}
              >
                <Text style={[styles.countryButtonText, selectedCountry === 'US' && styles.countryButtonTextActive]}>
                  USA
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <Text style={styles.periodText}>Período: {period}</Text>

        {/* Totals */}
        {totals && (
          <View style={[styles.totalsContainer, isDesktop && styles.totalsContainerDesktop]}>
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>Total Ventas</Text>
              <Text style={styles.totalValue}>{formatCurrency(totals.total_sales)}</Text>
            </View>
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>Total Premios</Text>
              <Text style={[styles.totalValue, styles.redText]}>{formatCurrency(totals.total_wins)}</Text>
            </View>
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>Total Comisiones</Text>
              <Text style={[styles.totalValue, styles.yellowText]}>{formatCurrency(totals.total_commission)}</Text>
            </View>
            <View style={[styles.totalCard, styles.profitCard]}>
              <Text style={styles.totalLabel}>Ganancia Neta</Text>
              <Text style={[styles.totalValue, totals.net_profit >= 0 ? styles.greenText : styles.redText]}>
                {formatCurrency(totals.net_profit)}
              </Text>
            </View>
          </View>
        )}

        {/* Chart */}
        {sellers.length > 0 && (
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Top Vendedores por Ventas</Text>
            <BarChart
              data={prepareChartData()}
              width={chartWidth}
              height={220}
              barWidth={isDesktop ? 50 : 30}
              spacing={isDesktop ? 20 : 10}
              roundedTop
              xAxisThickness={1}
              yAxisThickness={1}
              xAxisColor="#334155"
              yAxisColor="#334155"
              yAxisTextStyle={{ color: '#94a3b8', fontSize: 10 }}
              xAxisLabelTextStyle={{ color: '#94a3b8', fontSize: 9 }}
              noOfSections={4}
              maxValue={Math.max(...sellers.map(s => s.total_sales)) * 1.2 || 100}
            />
          </View>
        )}

        {/* Sellers Table */}
        <View style={styles.tableContainer}>
          <Text style={styles.sectionTitle}>Detalle por Vendedor</Text>
          
          {sellers.map((seller, index) => (
            <TouchableOpacity
              key={seller.seller_id}
              style={styles.sellerCard}
              onPress={() => router.push(`/user-report?userId=${seller.seller_id}&userName=${seller.seller_name}`)}
            >
              <View style={styles.sellerHeader}>
                <View style={styles.rankBadge}>
                  <Text style={styles.rankText}>#{index + 1}</Text>
                </View>
                <View style={styles.sellerInfo}>
                  <Text style={styles.sellerName}>{seller.seller_name}</Text>
                  <Text style={styles.sellerCommission}>Comisión: {seller.commission_rate}%</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#64748b" />
              </View>

              <View style={styles.sellerStats}>
                <View style={styles.sellerStat}>
                  <Text style={styles.statLabel}>Ventas</Text>
                  <Text style={styles.statValue}>{formatCurrency(seller.total_sales, seller.currency)}</Text>
                </View>
                <View style={styles.sellerStat}>
                  <Text style={styles.statLabel}>Premios</Text>
                  <Text style={[styles.statValue, styles.redText]}>{formatCurrency(seller.total_wins, seller.currency)}</Text>
                </View>
                <View style={styles.sellerStat}>
                  <Text style={styles.statLabel}>Comisión</Text>
                  <Text style={[styles.statValue, styles.yellowText]}>{formatCurrency(seller.total_commission, seller.currency)}</Text>
                </View>
                <View style={styles.sellerStat}>
                  <Text style={styles.statLabel}>Ganancia</Text>
                  <Text style={[styles.statValue, seller.net_profit >= 0 ? styles.greenText : styles.redText]}>
                    {formatCurrency(seller.net_profit, seller.currency)}
                  </Text>
                </View>
              </View>

              <View style={styles.ticketsRow}>
                <Text style={styles.ticketsText}>
                  {seller.tickets_sold} boletos vendidos • {seller.tickets_won} ganadores
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {sellers.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color="#475569" />
            <Text style={styles.emptyText}>No hay vendedores con ventas</Text>
          </View>
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
  contentDesktop: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  periodText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 16,
  },
  totalsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  totalsContainerDesktop: {
    flexWrap: 'nowrap',
    gap: 12,
  },
  totalCard: {
    width: '48%',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  profitCard: {
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  totalLabel: {
    fontSize: 11,
    color: '#94a3b8',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 4,
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
  chartCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  tableContainer: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  sellerCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  sellerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  sellerInfo: {
    flex: 1,
  },
  sellerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  sellerCommission: {
    fontSize: 12,
    color: '#f59e0b',
  },
  sellerStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  sellerStat: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    color: '#94a3b8',
  },
  statValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 2,
  },
  ticketsRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  ticketsText: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 12,
  },
  countryFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '500',
  },
  countryButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  countryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#334155',
  },
  countryButtonActive: {
    backgroundColor: '#22c55e',
  },
  countryButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
  },
  countryButtonTextActive: {
    color: '#ffffff',
  },
});

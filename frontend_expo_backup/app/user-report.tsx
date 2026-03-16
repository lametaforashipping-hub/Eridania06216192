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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart, LineChart, PieChart } from 'react-native-gifted-charts';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const { width } = Dimensions.get('window');
const isDesktop = width > 768;
const chartWidth = isDesktop ? 500 : width - 64;

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

interface ChartDataPoint {
  date: string;
  label: string;
  sales: number;
  wins: number;
  profit: number;
}

export default function UserReport() {
  const { token } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const userId = params.userId as string;
  const userName = params.userName as string;

  const [report, setReport] = useState<any>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchReport = useCallback(async () => {
    if (!token) return;
    try {
      // Fetch report
      const reportUrl = userId 
        ? `${API_URL}/api/accounting/report?user_id=${userId}`
        : `${API_URL}/api/accounting/report`;
      
      const reportResponse = await fetch(reportUrl, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (reportResponse.ok) {
        const data = await reportResponse.json();
        setReport(data);
      }

      // Fetch chart data
      const chartResponse = await fetch(`${API_URL}/api/accounting/daily-chart?days=7`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (chartResponse.ok) {
        const data = await chartResponse.json();
        setChartData(data);
      }
    } catch (error) {
      console.error('Error fetching report:', error);
    } finally {
      setLoading(false);
    }
  }, [token, userId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchReport();
    setRefreshing(false);
  };

  const formatCurrency = (amount: number, currency: string = 'RD$') => {
    return `${currency} ${amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;
  };

  const prepareBarChartData = () => {
    return chartData.map(d => ({
      value: d.sales,
      label: d.label,
      frontColor: '#22c55e',
    }));
  };

  const prepareLineChartData = () => {
    return chartData.map(d => ({
      value: d.profit,
      label: d.label,
    }));
  };

  const preparePieChartData = () => {
    if (!report) return [];
    return [
      { value: report.total_sales, color: '#22c55e', text: 'Ventas' },
      { value: report.total_wins, color: '#ef4444', text: 'Premios' },
    ].filter(d => d.value > 0);
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
        <Text style={styles.headerTitle}>
          {userName ? `Reporte: ${userName}` : 'Mi Reporte'}
        </Text>
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
        {report && (
          <>
            {/* Period Info */}
            <Text style={styles.periodText}>Período: {report.period}</Text>

            {/* Summary Cards */}
            <View style={[styles.summaryGrid, isDesktop && styles.summaryGridDesktop]}>
              <View style={[styles.summaryCard, styles.salesCard]}>
                <Ionicons name="cart" size={28} color="#22c55e" />
                <Text style={styles.summaryLabel}>Ventas</Text>
                <Text style={styles.summaryValue}>
                  {formatCurrency(report.total_sales, report.currency)}
                </Text>
                <Text style={styles.summarySubtext}>{report.tickets_sold} boletos</Text>
              </View>

              <View style={[styles.summaryCard, styles.winsCard]}>
                <Ionicons name="trophy" size={28} color="#ef4444" />
                <Text style={styles.summaryLabel}>Premios</Text>
                <Text style={[styles.summaryValue, styles.redText]}>
                  {formatCurrency(report.total_wins, report.currency)}
                </Text>
                <Text style={styles.summarySubtext}>{report.tickets_won} ganadores</Text>
              </View>

              <View style={[styles.summaryCard, styles.profitCard]}>
                <Ionicons 
                  name={report.net_profit >= 0 ? 'trending-up' : 'trending-down'} 
                  size={28} 
                  color={report.net_profit >= 0 ? '#22c55e' : '#ef4444'} 
                />
                <Text style={styles.summaryLabel}>Ganancia Neta</Text>
                <Text style={[styles.summaryValue, report.net_profit >= 0 ? styles.greenText : styles.redText]}>
                  {formatCurrency(report.net_profit, report.currency)}
                </Text>
                <Text style={styles.summarySubtext}>
                  ROI: {report.total_sales > 0 ? ((report.net_profit / report.total_sales) * 100).toFixed(1) : 0}%
                </Text>
              </View>

              <View style={styles.summaryCard}>
                <Ionicons name="wallet" size={28} color="#f59e0b" />
                <Text style={styles.summaryLabel}>Comisión</Text>
                <Text style={[styles.summaryValue, styles.yellowText]}>
                  {formatCurrency(report.total_commission, report.currency)}
                </Text>
              </View>
            </View>

            {/* Charts Section */}
            <View style={[styles.chartsContainer, isDesktop && styles.chartsContainerDesktop]}>
              {/* Sales Bar Chart */}
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Ventas Diarias (7 días)</Text>
                {chartData.length > 0 ? (
                  <BarChart
                    data={prepareBarChartData()}
                    width={chartWidth}
                    height={200}
                    barWidth={isDesktop ? 40 : 25}
                    spacing={isDesktop ? 30 : 15}
                    roundedTop
                    xAxisThickness={1}
                    yAxisThickness={1}
                    xAxisColor="#334155"
                    yAxisColor="#334155"
                    yAxisTextStyle={{ color: '#94a3b8', fontSize: 10 }}
                    xAxisLabelTextStyle={{ color: '#94a3b8', fontSize: 10 }}
                    noOfSections={4}
                    maxValue={Math.max(...chartData.map(d => d.sales)) * 1.2 || 100}
                  />
                ) : (
                  <Text style={styles.noDataText}>Sin datos disponibles</Text>
                )}
              </View>

              {/* Profit Line Chart */}
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Ganancia Diaria (7 días)</Text>
                {chartData.length > 0 ? (
                  <LineChart
                    data={prepareLineChartData()}
                    width={chartWidth}
                    height={200}
                    spacing={isDesktop ? 60 : 35}
                    color="#22c55e"
                    thickness={3}
                    dataPointsColor="#22c55e"
                    dataPointsRadius={5}
                    xAxisThickness={1}
                    yAxisThickness={1}
                    xAxisColor="#334155"
                    yAxisColor="#334155"
                    yAxisTextStyle={{ color: '#94a3b8', fontSize: 10 }}
                    xAxisLabelTextStyle={{ color: '#94a3b8', fontSize: 10 }}
                    noOfSections={4}
                    curved
                  />
                ) : (
                  <Text style={styles.noDataText}>Sin datos disponibles</Text>
                )}
              </View>

              {/* Pie Chart */}
              {report.total_sales > 0 && (
                <View style={styles.chartCard}>
                  <Text style={styles.chartTitle}>Distribución</Text>
                  <View style={styles.pieContainer}>
                    <PieChart
                      data={preparePieChartData()}
                      radius={80}
                      innerRadius={50}
                      centerLabelComponent={() => (
                        <View style={styles.pieCenter}>
                          <Text style={styles.pieCenterText}>
                            {((report.net_profit / report.total_sales) * 100).toFixed(0)}%
                          </Text>
                          <Text style={styles.pieCenterLabel}>Margen</Text>
                        </View>
                      )}
                    />
                    <View style={styles.pieLegend}>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: '#22c55e' }]} />
                        <Text style={styles.legendText}>Ventas</Text>
                      </View>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
                        <Text style={styles.legendText}>Premios</Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}
            </View>

            {/* Tickets Stats */}
            <View style={styles.ticketsStats}>
              <Text style={styles.sectionTitle}>Estadísticas de Boletos</Text>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{report.tickets_sold}</Text>
                  <Text style={styles.statLabel}>Vendidos</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, styles.greenText]}>{report.tickets_won}</Text>
                  <Text style={styles.statLabel}>Ganadores</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, styles.yellowText]}>{report.tickets_cancelled || 0}</Text>
                  <Text style={styles.statLabel}>Cancelados</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {report.tickets_sold > 0 ? ((report.tickets_won / report.tickets_sold) * 100).toFixed(1) : 0}%
                  </Text>
                  <Text style={styles.statLabel}>Tasa Ganancia</Text>
                </View>
              </View>
            </View>
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
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  summaryGridDesktop: {
    flexWrap: 'nowrap',
    gap: 16,
  },
  summaryCard: {
    width: '48%',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  salesCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#22c55e',
  },
  winsCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  profitCard: {
    borderWidth: 1,
    borderColor: '#22c55e',
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
  greenText: {
    color: '#22c55e',
  },
  redText: {
    color: '#ef4444',
  },
  yellowText: {
    color: '#f59e0b',
  },
  chartsContainer: {
    marginBottom: 24,
  },
  chartsContainerDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  chartCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  noDataText: {
    color: '#64748b',
    fontStyle: 'italic',
    paddingVertical: 40,
  },
  pieContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pieCenter: {
    alignItems: 'center',
  },
  pieCenterText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#22c55e',
  },
  pieCenterLabel: {
    fontSize: 10,
    color: '#94a3b8',
  },
  pieLegend: {
    marginLeft: 24,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
  },
  ticketsStats: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  statLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
  },
});

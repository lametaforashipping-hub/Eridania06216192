import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import { BarChart, LineChart } from 'react-native-gifted-charts';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface DailyData {
  date: string;
  day: number;
  sales: number;
  commission: number;
  tickets: number;
}

interface ReportSummary {
  total_sales: number;
  total_tickets: number;
  total_commission: number;
  total_deposits: number;
  avg_ticket_value: number;
  growth_percentage: number;
  status_counts: Record<string, number>;
}

interface MonthlyReport {
  month: number;
  year: number;
  month_name: string;
  summary: ReportSummary;
  daily_data: DailyData[];
  currency: string;
}

export default function MonthlyReport() {
  const { token } = useAuth();
  const router = useRouter();
  
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  
  const fetchReport = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(
        `${API_URL}/api/users/me/monthly-report?month=${selectedMonth}&year=${selectedYear}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (response.ok) {
        const data = await response.json();
        setReport(data);
      }
    } catch (error) {
      console.error('Error fetching report:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, selectedMonth, selectedYear]);
  
  useEffect(() => {
    fetchReport();
  }, [fetchReport]);
  
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchReport();
  }, [fetchReport]);
  
  const changeMonth = (direction: number) => {
    let newMonth = selectedMonth + direction;
    let newYear = selectedYear;
    
    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    } else if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }
    
    setSelectedMonth(newMonth);
    setSelectedYear(newYear);
    setLoading(true);
  };
  
  const formatCurrency = (value: number) => {
    return value.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  
  // Prepare chart data
  const salesChartData = report?.daily_data
    .filter(d => d.sales > 0 || d.commission > 0)
    .map(d => ({
      value: d.sales,
      label: d.day.toString(),
      frontColor: '#3b82f6',
    })) || [];
  
  const commissionChartData = report?.daily_data
    .filter(d => d.commission > 0)
    .map(d => ({
      value: d.commission,
      dataPointText: '',
    })) || [];
  
  const lineChartData = report?.daily_data
    .map(d => ({
      value: d.sales,
      label: d.day % 5 === 0 || d.day === 1 ? d.day.toString() : '',
    })) || [];
  
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#22c55e" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reporte Mensual</Text>
        <View style={{ width: 32 }} />
      </View>
      
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Month Selector */}
        <View style={styles.monthSelector}>
          <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.monthArrow}>
            <Ionicons name="chevron-back" size={24} color="#22c55e" />
          </TouchableOpacity>
          <View style={styles.monthDisplay}>
            <Text style={styles.monthText}>{months[selectedMonth - 1]}</Text>
            <Text style={styles.yearText}>{selectedYear}</Text>
          </View>
          <TouchableOpacity onPress={() => changeMonth(1)} style={styles.monthArrow}>
            <Ionicons name="chevron-forward" size={24} color="#22c55e" />
          </TouchableOpacity>
        </View>
        
        {/* Summary Cards */}
        <View style={styles.summaryGrid}>
          <View style={[styles.summaryCard, styles.salesCard]}>
            <Ionicons name="cart" size={24} color="#3b82f6" />
            <Text style={styles.summaryLabel}>Ventas Totales</Text>
            <Text style={[styles.summaryValue, { color: '#3b82f6' }]}>
              {report?.currency} {formatCurrency(report?.summary.total_sales || 0)}
            </Text>
            <Text style={styles.summarySubtext}>{report?.summary.total_tickets || 0} boletos</Text>
          </View>
          
          <View style={[styles.summaryCard, styles.commissionCard]}>
            <Ionicons name="trending-up" size={24} color="#22c55e" />
            <Text style={styles.summaryLabel}>Comisiones</Text>
            <Text style={[styles.summaryValue, { color: '#22c55e' }]}>
              {report?.currency} {formatCurrency(report?.summary.total_commission || 0)}
            </Text>
            <View style={styles.growthBadge}>
              <Ionicons 
                name={report?.summary.growth_percentage >= 0 ? "arrow-up" : "arrow-down"} 
                size={12} 
                color={report?.summary.growth_percentage >= 0 ? "#22c55e" : "#ef4444"} 
              />
              <Text style={[styles.growthText, { color: report?.summary.growth_percentage >= 0 ? "#22c55e" : "#ef4444" }]}>
                {Math.abs(report?.summary.growth_percentage || 0)}%
              </Text>
            </View>
          </View>
          
          <View style={[styles.summaryCard, styles.depositCard]}>
            <Ionicons name="arrow-down-circle" size={24} color="#f59e0b" />
            <Text style={styles.summaryLabel}>Depósitos</Text>
            <Text style={[styles.summaryValue, { color: '#f59e0b' }]}>
              {report?.currency} {formatCurrency(report?.summary.total_deposits || 0)}
            </Text>
          </View>
          
          <View style={[styles.summaryCard, styles.avgCard]}>
            <Ionicons name="calculator" size={24} color="#8b5cf6" />
            <Text style={styles.summaryLabel}>Promedio/Boleto</Text>
            <Text style={[styles.summaryValue, { color: '#8b5cf6' }]}>
              {report?.currency} {formatCurrency(report?.summary.avg_ticket_value || 0)}
            </Text>
          </View>
        </View>
        
        {/* Sales Chart */}
        {salesChartData.length > 0 && (
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Ventas por Día</Text>
            <Text style={styles.chartSubtitle}>Solo días con ventas</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <BarChart
                data={salesChartData}
                barWidth={28}
                spacing={12}
                roundedTop
                roundedBottom
                hideRules
                xAxisThickness={0}
                yAxisThickness={0}
                yAxisTextStyle={{ color: '#64748b', fontSize: 10 }}
                xAxisLabelTextStyle={{ color: '#64748b', fontSize: 10 }}
                noOfSections={4}
                maxValue={Math.max(...salesChartData.map(d => d.value)) * 1.2}
                barBorderRadius={4}
                frontColor="#3b82f6"
                isAnimated
                animationDuration={500}
              />
            </ScrollView>
          </View>
        )}
        
        {/* Line Chart - Sales Trend */}
        {lineChartData.length > 0 && (
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Tendencia de Ventas</Text>
            <Text style={styles.chartSubtitle}>Todos los días del mes</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <LineChart
                data={lineChartData}
                width={Math.max(300, lineChartData.length * 15)}
                height={150}
                spacing={15}
                color="#22c55e"
                thickness={2}
                startFillColor="#22c55e40"
                endFillColor="#22c55e10"
                startOpacity={0.4}
                endOpacity={0.1}
                initialSpacing={10}
                noOfSections={4}
                yAxisColor="transparent"
                xAxisColor="#333"
                yAxisTextStyle={{ color: '#64748b', fontSize: 10 }}
                xAxisLabelTextStyle={{ color: '#64748b', fontSize: 9 }}
                hideRules
                curved
                areaChart
                isAnimated
              />
            </ScrollView>
          </View>
        )}
        
        {/* Status Distribution */}
        {report?.summary.status_counts && Object.keys(report.summary.status_counts).length > 0 && (
          <View style={styles.statusCard}>
            <Text style={styles.chartTitle}>Estado de Boletos</Text>
            <View style={styles.statusGrid}>
              {Object.entries(report.summary.status_counts).map(([status, count]) => (
                <View key={status} style={styles.statusItem}>
                  <View style={[styles.statusDot, { backgroundColor: getStatusColor(status) }]} />
                  <Text style={styles.statusLabel}>{getStatusLabel(status)}</Text>
                  <Text style={styles.statusCount}>{count}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
        
        {/* No Data Message */}
        {salesChartData.length === 0 && (
          <View style={styles.noDataCard}>
            <Ionicons name="analytics-outline" size={48} color="#64748b" />
            <Text style={styles.noDataText}>Sin datos de ventas para este mes</Text>
            <Text style={styles.noDataSubtext}>Los datos aparecerán cuando realices ventas</Text>
          </View>
        )}
        
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'won': return '#22c55e';
    case 'lost': return '#64748b';
    case 'pending': return '#f59e0b';
    case 'cancelled': return '#ef4444';
    default: return '#64748b';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'won': return 'Ganadores';
    case 'lost': return 'No Ganaron';
    case 'pending': return 'Pendientes';
    case 'cancelled': return 'Cancelados';
    default: return status;
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  monthArrow: {
    padding: 8,
  },
  monthDisplay: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  monthText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  yearText: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  summaryCard: {
    width: '48%',
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 16,
    minHeight: 120,
  },
  salesCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  commissionCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#22c55e',
  },
  depositCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  avgCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#8b5cf6',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 4,
  },
  summarySubtext: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
  },
  growthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 4,
  },
  growthText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chartCard: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  chartSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 16,
  },
  statusCard: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: 13,
    color: '#94a3b8',
  },
  statusCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  noDataCard: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    marginTop: 20,
  },
  noDataText: {
    fontSize: 16,
    color: '#94a3b8',
    marginTop: 16,
    textAlign: 'center',
  },
  noDataSubtext: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
  },
});

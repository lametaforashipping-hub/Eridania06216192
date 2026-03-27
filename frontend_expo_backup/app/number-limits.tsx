import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://receipt-redesign-6.preview.emergentagent.com';

interface NumberStat {
  number: number;
  sold_count: number;
  limit: number | null;
  remaining: number | null;
  is_blocked: boolean;
}

interface LotteryStats {
  lottery_id: string;
  lottery_name: string;
  ticket_limit_per_number: number | null;
  number_stats: NumberStat[];
  blocked_numbers: number[];
  total_numbers_with_sales: number;
}

interface Lottery {
  id: string;
  name: string;
  ticket_limit_per_number: number | null;
  active: boolean;
}

export default function NumberLimitsScreen() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [lotteries, setLotteries] = useState<Lottery[]>([]);
  const [selectedLottery, setSelectedLottery] = useState<Lottery | null>(null);
  const [stats, setStats] = useState<LotteryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    loadToken();
  }, []);

  const loadToken = async () => {
    const storedToken = await AsyncStorage.getItem('token');
    setToken(storedToken);
    if (storedToken) {
      fetchLotteries(storedToken);
    }
  };

  const fetchLotteries = async (authToken: string) => {
    try {
      const response = await fetch(`${API_URL}/api/lotteries?active_only=false`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        // Filter lotteries with limits
        const lotteriesWithLimits = data.filter((l: Lottery) => l.ticket_limit_per_number && l.ticket_limit_per_number > 0);
        setLotteries(lotteriesWithLimits);
        if (lotteriesWithLimits.length > 0) {
          setSelectedLottery(lotteriesWithLimits[0]);
          fetchStats(lotteriesWithLimits[0].id, authToken);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudieron cargar las loterías');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async (lotteryId: string, authToken: string) => {
    setLoadingStats(true);
    try {
      const response = await fetch(`${API_URL}/api/lotteries/${lotteryId}/number-stats`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudieron cargar las estadísticas');
    } finally {
      setLoadingStats(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (token && selectedLottery) {
      await fetchStats(selectedLottery.id, token);
    }
    setRefreshing(false);
  }, [token, selectedLottery]);

  const handleSelectLottery = (lottery: Lottery) => {
    setSelectedLottery(lottery);
    if (token) {
      fetchStats(lottery.id, token);
    }
  };

  const getProgressColor = (stat: NumberStat) => {
    if (stat.is_blocked) return '#ef4444';
    if (stat.limit && stat.sold_count >= stat.limit * 0.8) return '#f59e0b';
    return '#22c55e';
  };

  const getProgressPercentage = (stat: NumberStat) => {
    if (!stat.limit) return 0;
    return Math.min((stat.sold_count / stat.limit) * 100, 100);
  };

  const renderNumberStat = ({ item }: { item: NumberStat }) => {
    const progressColor = getProgressColor(item);
    const progressPercentage = getProgressPercentage(item);

    return (
      <View style={styles.statCard}>
        <View style={styles.statHeader}>
          <View style={[styles.numberBadge, { backgroundColor: item.is_blocked ? '#fef2f2' : '#f0fdf4' }]}>
            <Text style={[styles.numberText, { color: item.is_blocked ? '#dc2626' : '#166534' }]}>
              {item.number.toString().padStart(2, '0')}
            </Text>
          </View>
          <View style={styles.statInfo}>
            <Text style={styles.soldText}>
              {item.sold_count} / {item.limit} vendidos
            </Text>
            {item.is_blocked ? (
              <View style={styles.blockedBadge}>
                <Ionicons name="lock-closed" size={12} color="#dc2626" />
                <Text style={styles.blockedText}>BLOQUEADO</Text>
              </View>
            ) : item.remaining !== null && item.remaining <= 2 ? (
              <View style={styles.warningBadge}>
                <Ionicons name="warning" size={12} color="#d97706" />
                <Text style={styles.warningText}>Quedan {item.remaining}</Text>
              </View>
            ) : (
              <Text style={styles.availableText}>Disponible: {item.remaining}</Text>
            )}
          </View>
        </View>
        <View style={styles.progressBarContainer}>
          <View 
            style={[
              styles.progressBar, 
              { width: `${progressPercentage}%`, backgroundColor: progressColor }
            ]} 
          />
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#22c55e" />
      </SafeAreaView>
    );
  }

  if (lotteries.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Panel de Límites</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="analytics-outline" size={80} color="#475569" />
          <Text style={styles.emptyTitle}>Sin Límites Configurados</Text>
          <Text style={styles.emptyText}>
            No hay loterías con límites de boletos por número configurados.
          </Text>
          <TouchableOpacity 
            style={styles.configButton}
            onPress={() => router.push('/lotteries')}
          >
            <Text style={styles.configButtonText}>Configurar Loterías</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Panel de Límites</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Ionicons name="refresh" size={24} color="#22c55e" />
        </TouchableOpacity>
      </View>

      {/* Lottery Selector */}
      <View style={styles.lotterySelector}>
        <FlatList
          horizontal
          data={lotteries}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.lotteryPill,
                selectedLottery?.id === item.id && styles.lotteryPillActive,
              ]}
              onPress={() => handleSelectLottery(item)}
            >
              <Text
                style={[
                  styles.lotteryPillText,
                  selectedLottery?.id === item.id && styles.lotteryPillTextActive,
                ]}
              >
                {item.name}
              </Text>
              <Text style={[
                styles.limitBadge,
                selectedLottery?.id === item.id && styles.limitBadgeActive,
              ]}>
                Límite: {item.ticket_limit_per_number}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Summary Cards */}
      {stats && (
        <View style={styles.summaryContainer}>
          <View style={[styles.summaryCard, styles.summaryCardBlocked]}>
            <Ionicons name="lock-closed" size={24} color="#dc2626" />
            <Text style={styles.summaryNumber}>{stats.blocked_numbers.length}</Text>
            <Text style={styles.summaryLabel}>Bloqueados</Text>
          </View>
          <View style={[styles.summaryCard, styles.summaryCardWarning]}>
            <Ionicons name="warning" size={24} color="#d97706" />
            <Text style={styles.summaryNumber}>
              {stats.number_stats.filter(s => !s.is_blocked && s.remaining !== null && s.remaining <= 2).length}
            </Text>
            <Text style={styles.summaryLabel}>Casi Llenos</Text>
          </View>
          <View style={[styles.summaryCard, styles.summaryCardActive]}>
            <Ionicons name="analytics" size={24} color="#22c55e" />
            <Text style={styles.summaryNumber}>{stats.total_numbers_with_sales}</Text>
            <Text style={styles.summaryLabel}>Con Ventas</Text>
          </View>
        </View>
      )}

      {/* Blocked Numbers List */}
      {stats && stats.blocked_numbers.length > 0 && (
        <View style={styles.blockedSection}>
          <Text style={styles.sectionTitle}>Números Bloqueados</Text>
          <View style={styles.blockedNumbersRow}>
            {stats.blocked_numbers.map(num => (
              <View key={num} style={styles.blockedNumberBadge}>
                <Text style={styles.blockedNumberText}>{num.toString().padStart(2, '0')}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* All Numbers Stats */}
      <View style={styles.statsContainer}>
        <Text style={styles.sectionTitle}>Detalle por Número</Text>
        {loadingStats ? (
          <ActivityIndicator size="large" color="#22c55e" style={{ marginTop: 20 }} />
        ) : stats && stats.number_stats.length > 0 ? (
          <FlatList
            data={stats.number_stats}
            keyExtractor={(item) => item.number.toString()}
            renderItem={renderNumberStat}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />
            }
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        ) : (
          <View style={styles.noDataContainer}>
            <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
            <Text style={styles.noDataText}>No hay ventas registradas aún</Text>
          </View>
        )}
      </View>
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  lotterySelector: {
    backgroundColor: '#1e293b',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  lotteryPill: {
    backgroundColor: '#334155',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  lotteryPillActive: {
    backgroundColor: '#22c55e',
  },
  lotteryPillText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  lotteryPillTextActive: {
    color: '#ffffff',
  },
  limitBadge: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  limitBadgeActive: {
    color: '#dcfce7',
  },
  summaryContainer: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  summaryCardBlocked: {
    borderLeftWidth: 3,
    borderLeftColor: '#dc2626',
  },
  summaryCardWarning: {
    borderLeftWidth: 3,
    borderLeftColor: '#d97706',
  },
  summaryCardActive: {
    borderLeftWidth: 3,
    borderLeftColor: '#22c55e',
  },
  summaryNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 4,
  },
  summaryLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  blockedSection: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  blockedNumbersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  blockedNumberBadge: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#dc2626',
  },
  blockedNumberText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#dc2626',
  },
  statsContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  statCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  numberBadge: {
    width: 50,
    height: 50,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  numberText: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  statInfo: {
    flex: 1,
  },
  soldText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  blockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  blockedText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#dc2626',
    marginLeft: 4,
  },
  warningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  warningText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#d97706',
    marginLeft: 4,
  },
  availableText: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#334155',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 8,
  },
  configButton: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  configButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  noDataContainer: {
    alignItems: 'center',
    padding: 40,
  },
  noDataText: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 12,
  },
});

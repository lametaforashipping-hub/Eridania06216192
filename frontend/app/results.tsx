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
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const { width } = Dimensions.get('window');
const isDesktop = width > 768;

interface DrawResult {
  id: string;
  lottery_id: string;
  lottery_name: string;
  first_prize: number;
  second_prize: number | null;
  third_prize: number | null;
  draw_time: string;
  draw_date: string | null;
  currency: string;
  is_manual: boolean;
  is_automated: boolean;
  source?: string;
  validated?: boolean;
}

export default function ResultsScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [draws, setDraws] = useState<DrawResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('today');

  const fetchDraws = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/draws?limit=100`);
      if (res.ok) {
        const data = await res.json();
        setDraws(data);
      }
    } catch (err) {
      console.error('Error fetching draws:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDraws();
  }, [fetchDraws]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDraws();
  }, [fetchDraws]);

  // Group draws by date
  const getDateKey = (draw: DrawResult): string => {
    if (draw.draw_date) return draw.draw_date;
    const dt = new Date(draw.draw_time);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  };

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  const formatDateLabel = (dateStr: string): string => {
    if (dateStr === todayStr) return 'Hoy';
    if (dateStr === yesterdayStr) return 'Ayer';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Get unique dates from draws
  const uniqueDates = [...new Set(draws.map(getDateKey))].sort((a, b) => b.localeCompare(a));

  // Filter draws based on selected date
  const filteredDraws = draws.filter(d => {
    const dk = getDateKey(d);
    if (selectedDate === 'today') return dk === todayStr;
    if (selectedDate === 'yesterday') return dk === yesterdayStr;
    if (selectedDate === 'all') return true;
    return dk === selectedDate;
  });

  // Group filtered draws by lottery to avoid duplicates (keep latest per lottery)
  const drawsByLottery: Record<string, DrawResult> = {};
  filteredDraws.forEach(d => {
    const key = d.lottery_id;
    if (!drawsByLottery[key] || new Date(d.draw_time) > new Date(drawsByLottery[key].draw_time)) {
      drawsByLottery[key] = d;
    }
  });
  const displayDraws = Object.values(drawsByLottery).sort((a, b) => a.lottery_name.localeCompare(b.lottery_name));

  const formatTime = (timeStr: string): string => {
    const dt = new Date(timeStr);
    let h = dt.getHours();
    const m = dt.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  const PrizeBall = ({ number, label, color }: { number: number | null; label: string; color: string }) => {
    if (number === null || number === undefined) return null;
    return (
      <View style={styles.prizeColumn}>
        <View style={[styles.prizeBall, { backgroundColor: color }]}>
          <Text style={styles.prizeBallText}>{String(number).padStart(2, '0')}</Text>
        </View>
        <Text style={styles.prizeLabel}>{label}</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#f59e0b" />
          <Text style={styles.loadingText}>Cargando resultados...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} data-testid="results-screen">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} data-testid="results-back-btn">
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Resultados</Text>
        <TouchableOpacity onPress={onRefresh} data-testid="results-refresh-btn">
          <Ionicons name="refresh" size={24} color="#f59e0b" />
        </TouchableOpacity>
      </View>

      {/* Date Filter */}
      <View style={styles.dateFilterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateFilterScroll}>
          {[
            { key: 'today', label: 'Hoy' },
            { key: 'yesterday', label: 'Ayer' },
            { key: 'all', label: 'Todos' },
          ].map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.dateTab, selectedDate === tab.key && styles.dateTabActive]}
              onPress={() => setSelectedDate(tab.key)}
              data-testid={`results-tab-${tab.key}`}
            >
              <Text style={[styles.dateTabText, selectedDate === tab.key && styles.dateTabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f59e0b" />}
      >
        {displayDraws.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="trophy-outline" size={64} color="#475569" />
            <Text style={styles.emptyTitle}>Sin resultados</Text>
            <Text style={styles.emptySubtitle}>
              {selectedDate === 'today' ? 'No hay resultados para hoy todavia' : 'No se encontraron resultados'}
            </Text>
          </View>
        ) : (
          <View style={[styles.grid, isDesktop && styles.gridDesktop]}>
            {displayDraws.map(draw => (
              <View key={draw.id} style={[styles.resultCard, isDesktop && styles.resultCardDesktop]} data-testid={`result-card-${draw.lottery_id}`}>
                <View style={styles.cardHeader}>
                  <Text style={styles.lotteryName} numberOfLines={1}>{draw.lottery_name}</Text>
                  <View style={styles.badges}>
                    {draw.validated && (
                      <View style={styles.verifiedBadge}>
                        <Ionicons name="checkmark-circle" size={12} color="#22c55e" />
                      </View>
                    )}
                    {draw.is_automated && (
                      <View style={styles.autoBadge}>
                        <Text style={styles.autoBadgeText}>Auto</Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.prizesRow}>
                  <PrizeBall number={draw.first_prize} label="1ra" color="#f59e0b" />
                  <PrizeBall number={draw.second_prize} label="2da" color="#6366f1" />
                  <PrizeBall number={draw.third_prize} label="3ra" color="#ef4444" />
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.drawTime}>{formatTime(draw.draw_time)}</Text>
                  {draw.source && (
                    <Text style={styles.sourceText} numberOfLines={1}>{draw.source}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 14,
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
    fontWeight: '700',
    color: '#ffffff',
  },
  dateFilterContainer: {
    backgroundColor: '#1e293b',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  dateFilterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  dateTab: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#334155',
    marginRight: 8,
  },
  dateTabActive: {
    backgroundColor: '#f59e0b',
  },
  dateTabText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  dateTabTextActive: {
    color: '#000000',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  grid: {
    gap: 12,
  },
  gridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  resultCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  resultCardDesktop: {
    width: '48%' as any,
    marginRight: '2%' as any,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  lotteryName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    flex: 1,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  verifiedBadge: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  autoBadge: {
    backgroundColor: '#065f4620',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  autoBadgeText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '600',
  },
  prizesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
    marginBottom: 16,
  },
  prizeColumn: {
    alignItems: 'center',
  },
  prizeBall: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: { boxShadow: '0 4px 12px rgba(0,0,0,0.3)' },
      default: {
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
      },
    }),
  },
  prizeBallText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
  },
  prizeLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 10,
  },
  drawTime: {
    color: '#94a3b8',
    fontSize: 12,
  },
  sourceText: {
    color: '#64748b',
    fontSize: 10,
    maxWidth: 120,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
  },
  emptySubtitle: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 4,
  },
});

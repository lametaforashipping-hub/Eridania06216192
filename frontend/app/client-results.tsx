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

interface LotteryResult {
  id: string;
  lottery_id: string;
  lottery_name: string;
  draw_date: string;
  first_prize?: number;
  second_prize?: number;
  third_prize?: number;
  winning_numbers?: number[];
  status: string;
}

export default function ClientResultsScreen() {
  const router = useRouter();
  const { token, user, loading: authLoading } = useAuth();
  
  // Redirect if not authenticated as client
  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'cliente')) {
      router.replace('/client-login');
    }
  }, [user, authLoading, router]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [results, setResults] = useState<LotteryResult[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const fetchResults = useCallback(async () => {
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const response = await fetch(`${API_URL}/api/clients/results?date=${dateStr}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        setResults(data || []);
      }
    } catch (error) {
      console.error('Error fetching results:', error);
    } finally {
      setLoading(false);
    }
  }, [token, selectedDate]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchResults();
    setRefreshing(false);
  };

  const changeDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    // Don't allow future dates
    if (newDate > new Date()) return;
    setSelectedDate(newDate);
    setLoading(true);
  };

  const isToday = selectedDate.toDateString() === new Date().toDateString();

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-DO', {
      timeZone: 'America/Santo_Domingo',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('es-DO', {
      timeZone: 'America/Santo_Domingo',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPrizeColor = (position: number) => {
    if (position === 1) return '#fbbf24'; // Gold
    if (position === 2) return '#9ca3af'; // Silver
    return '#b45309'; // Bronze
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Resultados</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Date Selector */}
      <View style={styles.dateSelector}>
        <TouchableOpacity
          style={styles.dateArrow}
          onPress={() => changeDate(-1)}
        >
          <Ionicons name="chevron-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        
        <View style={styles.dateDisplay}>
          <Text style={styles.dateText}>{formatDate(selectedDate)}</Text>
          {isToday && <Text style={styles.todayBadge}>HOY</Text>}
        </View>
        
        <TouchableOpacity
          style={[styles.dateArrow, isToday && styles.dateArrowDisabled]}
          onPress={() => changeDate(1)}
          disabled={isToday}
        >
          <Ionicons name="chevron-forward" size={24} color={isToday ? '#475569' : '#ffffff'} />
        </TouchableOpacity>
      </View>

      {/* Results List */}
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />}
        showsVerticalScrollIndicator={false}
      >
        {results.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="trophy-outline" size={64} color="#334155" />
            <Text style={styles.emptyStateTitle}>Sin Resultados</Text>
            <Text style={styles.emptyStateText}>
              No hay resultados disponibles para esta fecha.
            </Text>
            {isToday && (
              <Text style={styles.emptyStateHint}>
                Los resultados se publicarán después de cada sorteo.
              </Text>
            )}
          </View>
        ) : (
          <>
            {results.map((result, index) => (
              <View key={result.id || index} style={styles.resultCard}>
                <View style={styles.resultHeader}>
                  <View style={styles.lotteryInfo}>
                    <Ionicons name="trophy" size={20} color="#22c55e" />
                    <Text style={styles.lotteryName}>{result.lottery_name || 'Lotería'}</Text>
                  </View>
                  {result.draw_date && (
                    <Text style={styles.resultTime}>{formatTime(result.draw_date)}</Text>
                  )}
                </View>
                
                <View style={styles.prizesContainer}>
                  {/* First Prize */}
                  {result.first_prize !== undefined && (
                    <View style={styles.prizeRow}>
                      <View style={[styles.prizeCircle, { backgroundColor: getPrizeColor(1) }]}>
                        <Text style={styles.prizeNumber}>
                          {String(result.first_prize).padStart(2, '0')}
                        </Text>
                      </View>
                      <Text style={styles.prizeLabel}>1er Premio</Text>
                    </View>
                  )}
                  
                  {/* Second Prize */}
                  {result.second_prize !== undefined && (
                    <View style={styles.prizeRow}>
                      <View style={[styles.prizeCircle, { backgroundColor: getPrizeColor(2) }]}>
                        <Text style={styles.prizeNumber}>
                          {String(result.second_prize).padStart(2, '0')}
                        </Text>
                      </View>
                      <Text style={styles.prizeLabel}>2do Premio</Text>
                    </View>
                  )}
                  
                  {/* Third Prize */}
                  {result.third_prize !== undefined && (
                    <View style={styles.prizeRow}>
                      <View style={[styles.prizeCircle, { backgroundColor: getPrizeColor(3) }]}>
                        <Text style={styles.prizeNumber}>
                          {String(result.third_prize).padStart(2, '0')}
                        </Text>
                      </View>
                      <Text style={styles.prizeLabel}>3er Premio</Text>
                    </View>
                  )}
                  
                  {/* Winning Numbers (for lotteries with multiple numbers) */}
                  {result.winning_numbers && result.winning_numbers.length > 0 && (
                    <View style={styles.winningNumbersRow}>
                      <Text style={styles.winningNumbersLabel}>Números Ganadores:</Text>
                      <View style={styles.winningNumbers}>
                        {result.winning_numbers.map((num, i) => (
                          <View key={i} style={styles.winningNumberBall}>
                            <Text style={styles.winningNumberText}>
                              {String(num).padStart(2, '0')}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              </View>
            ))}
            
            {/* Info Banner */}
            <View style={styles.infoBanner}>
              <Ionicons name="information-circle" size={20} color="#3b82f6" />
              <Text style={styles.infoBannerText}>
                Los resultados se actualizan automáticamente después de cada sorteo.
              </Text>
            </View>
          </>
        )}
        
        <View style={{ height: 30 }} />
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
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backButton: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  dateArrow: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
  },
  dateArrowDisabled: {
    opacity: 0.5,
  },
  dateDisplay: {
    alignItems: 'center',
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    textTransform: 'capitalize',
  },
  todayBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#22c55e',
    marginTop: 4,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyStateHint: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  resultCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  lotteryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  lotteryName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
  },
  resultTime: {
    fontSize: 13,
    color: '#64748b',
  },
  prizesContainer: {
    gap: 16,
  },
  prizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  prizeCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  prizeNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: '#000000',
  },
  prizeLabel: {
    fontSize: 14,
    color: '#94a3b8',
  },
  winningNumbersRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  winningNumbersLabel: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 10,
  },
  winningNumbers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  winningNumberBall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  winningNumberText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    padding: 14,
    borderRadius: 12,
    gap: 10,
    marginTop: 8,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 18,
  },
});

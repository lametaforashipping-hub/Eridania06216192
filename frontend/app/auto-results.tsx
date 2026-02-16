import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface LotteryResult {
  lottery_name: string;
  first_prize: number;
  second_prize: number | null;
  third_prize: number | null;
  draw_date: string;
  source: string;
  validated: boolean;
  validation_sources: string[];
}

interface SourceStatus {
  name: string;
  url: string;
  status: string;
  status_code?: number;
  error?: string;
}

interface SchedulerStatus {
  is_running: boolean;
  last_fetch_time: string | null;
  last_results_count: number;
}

interface PreviewResult {
  scraped_name: string;
  matched_lottery: string | null;
  lottery_id: string | null;
  results: {
    first: number;
    second: number | null;
    third: number | null;
  };
  validated: boolean;
  sources: string[];
  pending_winners: {
    primera: number;
    segunda: number;
    tercera: number;
  };
  total_potential_winners: number;
}

export default function AutoResults() {
  const { user, token } = useAuth();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatus | null>(null);
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [latestResults, setLatestResults] = useState<LotteryResult[]>([]);
  const [previewResults, setPreviewResults] = useState<PreviewResult[]>([]);
  const [intervalMinutes, setIntervalMinutes] = useState(5);
  const [activeTab, setActiveTab] = useState<'results' | 'preview' | 'sources'>('results');

  const fetchStatus = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/api/lottery-results/status`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSchedulerStatus(data.scheduler);
      }
    } catch (error) {
      console.error('Error fetching status:', error);
    }
  }, [token]);

  const fetchSources = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/api/lottery-results/sources-check`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSources(data.sources);
      }
    } catch (error) {
      console.error('Error fetching sources:', error);
    }
  }, [token]);

  const fetchLatestResults = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/api/lottery-results/latest`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setLatestResults(data.results);
      }
    } catch (error) {
      console.error('Error fetching results:', error);
    }
  }, [token]);

  const fetchPreview = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/api/lottery-results/preview`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setPreviewResults(data.preview);
      }
    } catch (error) {
      console.error('Error fetching preview:', error);
    }
  }, [token]);

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchStatus(),
      fetchSources(),
      fetchLatestResults(),
      fetchPreview(),
    ]);
    setLoading(false);
  };

  useEffect(() => {
    loadAllData();
    
    // Auto-refresh every 60 seconds
    const interval = setInterval(() => {
      fetchStatus();
      fetchLatestResults();
    }, 60000);
    
    return () => clearInterval(interval);
  }, [fetchStatus, fetchLatestResults]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  };

  const handleFetchNow = async () => {
    setFetching(true);
    try {
      const response = await fetch(`${API_URL}/api/lottery-results/fetch-now`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });
      if (response.ok) {
        if (Platform.OS === 'web') {
          alert('Búsqueda iniciada. Los resultados se actualizarán en unos segundos.');
        } else {
          Alert.alert('Éxito', 'Búsqueda iniciada. Los resultados se actualizarán en unos segundos.');
        }
        // Wait a bit then refresh
        setTimeout(async () => {
          await loadAllData();
        }, 5000);
      }
    } catch (error) {
      console.error('Error fetching:', error);
    } finally {
      setFetching(false);
    }
  };

  const handleStartScheduler = async () => {
    try {
      const response = await fetch(`${API_URL}/api/lottery-results/scheduler/start`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ interval_minutes: intervalMinutes, enabled: true }),
      });
      if (response.ok) {
        if (Platform.OS === 'web') {
          alert(`Scheduler iniciado. Verificará cada ${intervalMinutes} minutos.`);
        } else {
          Alert.alert('Éxito', `Scheduler iniciado. Verificará cada ${intervalMinutes} minutos.`);
        }
        await fetchStatus();
      }
    } catch (error) {
      console.error('Error starting scheduler:', error);
    }
  };

  const handleStopScheduler = async () => {
    try {
      const response = await fetch(`${API_URL}/api/lottery-results/scheduler/stop`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });
      if (response.ok) {
        if (Platform.OS === 'web') {
          alert('Scheduler detenido.');
        } else {
          Alert.alert('Éxito', 'Scheduler detenido.');
        }
        await fetchStatus();
      }
    } catch (error) {
      console.error('Error stopping scheduler:', error);
    }
  };

  const formatNumber = (num: number | null) => {
    if (num === null) return '--';
    return num.toString().padStart(2, '0');
  };

  if (!user || !['super_admin', 'admin'].includes(user.role)) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Acceso Denegado</Text>
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>No tienes permisos para acceder a esta página.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Resultados Automáticos</Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10b981" />
        }
      >
        {loading ? (
          <ActivityIndicator size="large" color="#10b981" style={styles.loader} />
        ) : (
          <>
            {/* Status Card */}
            <View style={styles.statusCard}>
              <View style={styles.statusHeader}>
                <Text style={styles.statusTitle}>Estado del Sistema</Text>
                <View style={[
                  styles.statusBadge,
                  schedulerStatus?.is_running ? styles.statusOnline : styles.statusOffline
                ]}>
                  <View style={[
                    styles.statusDot,
                    schedulerStatus?.is_running ? styles.dotOnline : styles.dotOffline
                  ]} />
                  <Text style={styles.statusBadgeText}>
                    {schedulerStatus?.is_running ? 'ACTIVO' : 'INACTIVO'}
                  </Text>
                </View>
              </View>
              
              {schedulerStatus?.last_fetch_time && (
                <Text style={styles.lastFetch}>
                  Última verificación: {new Date(schedulerStatus.last_fetch_time).toLocaleString('es-DO')}
                </Text>
              )}
              
              <Text style={styles.sourcesCount}>
                Fuentes en línea: {sources.filter(s => s.status === 'online').length}/{sources.length}
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={[styles.actionButton, styles.fetchButton]} 
                onPress={handleFetchNow}
                disabled={fetching}
              >
                {fetching ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="refresh" size={20} color="#fff" />
                    <Text style={styles.actionButtonText}>Buscar Ahora</Text>
                  </>
                )}
              </TouchableOpacity>

              {user?.role === 'super_admin' && (
                <>
                  {schedulerStatus?.is_running ? (
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.stopButton]} 
                      onPress={handleStopScheduler}
                    >
                      <Ionicons name="pause" size={20} color="#fff" />
                      <Text style={styles.actionButtonText}>Detener Auto</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.startButton]} 
                      onPress={handleStartScheduler}
                    >
                      <Ionicons name="play" size={20} color="#fff" />
                      <Text style={styles.actionButtonText}>Iniciar Auto</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>

            {/* Interval Selector - Only for Super Admin */}
            {user?.role === 'super_admin' && !schedulerStatus?.is_running && (
              <View style={styles.intervalSelector}>
                <Text style={styles.intervalLabel}>Intervalo de verificación:</Text>
                <View style={styles.intervalButtons}>
                  {[5, 7, 10].map((mins) => (
                    <TouchableOpacity
                      key={mins}
                      style={[
                        styles.intervalButton,
                        intervalMinutes === mins && styles.intervalButtonActive
                      ]}
                      onPress={() => setIntervalMinutes(mins)}
                    >
                      <Text style={[
                        styles.intervalButtonText,
                        intervalMinutes === mins && styles.intervalButtonTextActive
                      ]}>
                        {mins} min
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Tabs */}
            <View style={styles.tabs}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'results' && styles.tabActive]}
                onPress={() => setActiveTab('results')}
              >
                <Text style={[styles.tabText, activeTab === 'results' && styles.tabTextActive]}>
                  Resultados
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'preview' && styles.tabActive]}
                onPress={() => { setActiveTab('preview'); fetchPreview(); }}
              >
                <Text style={[styles.tabText, activeTab === 'preview' && styles.tabTextActive]}>
                  Vista Previa
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'sources' && styles.tabActive]}
                onPress={() => setActiveTab('sources')}
              >
                <Text style={[styles.tabText, activeTab === 'sources' && styles.tabTextActive]}>
                  Fuentes
                </Text>
              </TouchableOpacity>
            </View>

            {/* Results Tab */}
            {activeTab === 'results' && (
              <View style={styles.resultsContainer}>
                <Text style={styles.sectionTitle}>Últimos Resultados Obtenidos</Text>
                {latestResults.length === 0 ? (
                  <Text style={styles.emptyText}>No hay resultados disponibles</Text>
                ) : (
                  latestResults.map((result, index) => (
                    <View key={index} style={styles.resultCard}>
                      <View style={styles.resultHeader}>
                        <Text style={styles.lotteryName}>{result.lottery_name.toUpperCase()}</Text>
                        <View style={[
                          styles.validatedBadge,
                          result.validated ? styles.validatedTrue : styles.validatedFalse
                        ]}>
                          <Ionicons 
                            name={result.validated ? 'checkmark-circle' : 'warning'} 
                            size={14} 
                            color={result.validated ? '#10b981' : '#f59e0b'} 
                          />
                          <Text style={[
                            styles.validatedText,
                            result.validated ? styles.validatedTextTrue : styles.validatedTextFalse
                          ]}>
                            {result.validated ? 'Validado' : 'Sin validar'}
                          </Text>
                        </View>
                      </View>
                      
                      <View style={styles.numbersRow}>
                        <View style={[styles.numberBall, styles.firstPrize]}>
                          <Text style={styles.numberText}>{formatNumber(result.first_prize)}</Text>
                          <Text style={styles.prizeLabel}>1ro</Text>
                        </View>
                        <View style={[styles.numberBall, styles.secondPrize]}>
                          <Text style={styles.numberText}>{formatNumber(result.second_prize)}</Text>
                          <Text style={styles.prizeLabel}>2do</Text>
                        </View>
                        <View style={[styles.numberBall, styles.thirdPrize]}>
                          <Text style={styles.numberText}>{formatNumber(result.third_prize)}</Text>
                          <Text style={styles.prizeLabel}>3ro</Text>
                        </View>
                      </View>
                      
                      <Text style={styles.sourceText}>
                        Fuentes: {result.validation_sources.slice(0, 3).join(', ')}
                        {result.validation_sources.length > 3 && ` +${result.validation_sources.length - 3}`}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* Preview Tab */}
            {activeTab === 'preview' && (
              <View style={styles.resultsContainer}>
                <Text style={styles.sectionTitle}>Vista Previa - Boletos Ganadores</Text>
                <Text style={styles.previewNote}>
                  Muestra cuántos boletos ganarían si se procesan estos resultados
                </Text>
                {previewResults.length === 0 ? (
                  <Text style={styles.emptyText}>No hay datos de vista previa</Text>
                ) : (
                  previewResults.map((result, index) => (
                    <View key={index} style={[
                      styles.previewCard,
                      result.matched_lottery ? styles.previewMatched : styles.previewUnmatched
                    ]}>
                      <View style={styles.previewHeader}>
                        <Text style={styles.lotteryName}>{result.scraped_name.toUpperCase()}</Text>
                        {result.matched_lottery && (
                          <Text style={styles.matchedText}>→ {result.matched_lottery}</Text>
                        )}
                      </View>
                      
                      <View style={styles.numbersRow}>
                        <View style={[styles.numberBall, styles.firstPrize]}>
                          <Text style={styles.numberText}>{formatNumber(result.results.first)}</Text>
                        </View>
                        <View style={[styles.numberBall, styles.secondPrize]}>
                          <Text style={styles.numberText}>{formatNumber(result.results.second)}</Text>
                        </View>
                        <View style={[styles.numberBall, styles.thirdPrize]}>
                          <Text style={styles.numberText}>{formatNumber(result.results.third)}</Text>
                        </View>
                      </View>
                      
                      {result.matched_lottery && (
                        <View style={styles.winnersInfo}>
                          <Text style={styles.winnersTitle}>Boletos Ganadores:</Text>
                          <View style={styles.winnersRow}>
                            <Text style={styles.winnerItem}>1ro: {result.pending_winners.primera}</Text>
                            <Text style={styles.winnerItem}>2do: {result.pending_winners.segunda}</Text>
                            <Text style={styles.winnerItem}>3ro: {result.pending_winners.tercera}</Text>
                          </View>
                          <Text style={styles.totalWinners}>
                            Total: {result.total_potential_winners} ganadores potenciales
                          </Text>
                        </View>
                      )}
                      
                      {!result.matched_lottery && (
                        <Text style={styles.noMatchText}>
                          No hay lotería configurada con este nombre
                        </Text>
                      )}
                    </View>
                  ))
                )}
              </View>
            )}

            {/* Sources Tab */}
            {activeTab === 'sources' && (
              <View style={styles.resultsContainer}>
                <Text style={styles.sectionTitle}>Estado de Fuentes de Datos</Text>
                {sources.map((source, index) => (
                  <View key={index} style={styles.sourceCard}>
                    <View style={styles.sourceHeader}>
                      <Ionicons 
                        name={source.status === 'online' ? 'cloud-done' : 'cloud-offline'} 
                        size={24} 
                        color={source.status === 'online' ? '#10b981' : '#ef4444'} 
                      />
                      <View style={styles.sourceInfo}>
                        <Text style={styles.sourceName}>{source.name}</Text>
                        <Text style={styles.sourceUrl}>{source.url}</Text>
                      </View>
                      <View style={[
                        styles.sourceStatus,
                        source.status === 'online' ? styles.sourceOnline : styles.sourceOffline
                      ]}>
                        <Text style={[
                          styles.sourceStatusText,
                          source.status === 'online' ? styles.sourceStatusOnline : styles.sourceStatusOffline
                        ]}>
                          {source.status === 'online' ? 'EN LÍNEA' : 'FUERA DE LÍNEA'}
                        </Text>
                      </View>
                    </View>
                    {source.error && (
                      <Text style={styles.sourceError}>{source.error}</Text>
                    )}
                  </View>
                ))}
                
                <View style={styles.validationNote}>
                  <Ionicons name="information-circle" size={20} color="#3b82f6" />
                  <Text style={styles.validationNoteText}>
                    Se requieren al menos 2 fuentes en línea para validar los resultados automáticamente.
                  </Text>
                </View>
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
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#111',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loader: {
    marginTop: 100,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
  },
  statusCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusOnline: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  statusOffline: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  dotOnline: {
    backgroundColor: '#10b981',
  },
  dotOffline: {
    backgroundColor: '#ef4444',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  lastFetch: {
    color: '#888',
    fontSize: 14,
    marginBottom: 4,
  },
  sourcesCount: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  fetchButton: {
    backgroundColor: '#3b82f6',
  },
  startButton: {
    backgroundColor: '#10b981',
  },
  stopButton: {
    backgroundColor: '#ef4444',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  intervalSelector: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  intervalLabel: {
    color: '#888',
    fontSize: 14,
    marginBottom: 12,
  },
  intervalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  intervalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#222',
    alignItems: 'center',
  },
  intervalButtonActive: {
    backgroundColor: '#10b981',
  },
  intervalButtonText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  intervalButtonTextActive: {
    color: '#fff',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#10b981',
  },
  tabText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#fff',
  },
  resultsContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    paddingVertical: 40,
  },
  resultCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  lotteryName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  validatedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  validatedTrue: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  validatedFalse: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  validatedText: {
    fontSize: 12,
    fontWeight: '600',
  },
  validatedTextTrue: {
    color: '#10b981',
  },
  validatedTextFalse: {
    color: '#f59e0b',
  },
  numbersRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 12,
  },
  numberBall: {
    width: 60,
    height: 70,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  firstPrize: {
    backgroundColor: '#eab308',
  },
  secondPrize: {
    backgroundColor: '#9ca3af',
  },
  thirdPrize: {
    backgroundColor: '#b45309',
  },
  numberText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  prizeLabel: {
    fontSize: 11,
    color: '#000',
    opacity: 0.7,
  },
  sourceText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  previewNote: {
    color: '#888',
    fontSize: 13,
    marginBottom: 12,
  },
  previewCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  previewMatched: {
    borderColor: '#10b981',
  },
  previewUnmatched: {
    borderColor: '#666',
    opacity: 0.6,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  matchedText: {
    color: '#10b981',
    fontSize: 14,
  },
  winnersInfo: {
    backgroundColor: '#222',
    borderRadius: 8,
    padding: 12,
  },
  winnersTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  winnersRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  winnerItem: {
    color: '#888',
    fontSize: 13,
  },
  totalWinners: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  noMatchText: {
    color: '#666',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  sourceCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  sourceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sourceInfo: {
    flex: 1,
    marginLeft: 12,
  },
  sourceName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  sourceUrl: {
    color: '#666',
    fontSize: 12,
  },
  sourceStatus: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  sourceOnline: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  sourceOffline: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  sourceStatusText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  sourceStatusOnline: {
    color: '#10b981',
  },
  sourceStatusOffline: {
    color: '#ef4444',
  },
  sourceError: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 8,
  },
  validationNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 10,
    padding: 12,
    gap: 10,
    marginTop: 8,
  },
  validationNoteText: {
    flex: 1,
    color: '#3b82f6',
    fontSize: 13,
  },
});

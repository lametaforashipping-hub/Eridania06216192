import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Lottery {
  id: string;
  name: string;
  country: string;
}

interface NumberStat {
  number: number;
  frequency: number;
  last_drawn?: string;
}

interface StatsData {
  hot_numbers: number[];
  cold_numbers: number[];
  all_stats: NumberStat[];
}

export default function Stats() {
  const { token } = useAuth();
  const router = useRouter();
  const [lotteries, setLotteries] = useState<Lottery[]>([]);
  const [selectedLottery, setSelectedLottery] = useState<Lottery | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLotteryModal, setShowLotteryModal] = useState(false);

  useEffect(() => {
    fetchLotteries();
  }, []);

  useEffect(() => {
    if (selectedLottery) {
      fetchStats(selectedLottery.id);
    }
  }, [selectedLottery]);

  const fetchLotteries = async () => {
    try {
      const response = await fetch(`${API_URL}/api/lotteries`);
      if (response.ok) {
        const data = await response.json();
        setLotteries(data);
        if (data.length > 0) {
          setSelectedLottery(data[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching lotteries:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async (lotteryId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/stats/numbers/${lotteryId}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
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
        <Text style={styles.headerTitle}>Estadísticas</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Lottery Selector */}
        <TouchableOpacity
          style={styles.lotterySelector}
          onPress={() => setShowLotteryModal(true)}
        >
          <View>
            <Text style={styles.lotterySelectorLabel}>Lotería</Text>
            <Text style={styles.lotterySelectorValue}>
              {selectedLottery?.name} ({selectedLottery?.country})
            </Text>
          </View>
          <Ionicons name="chevron-down" size={24} color="#94a3b8" />
        </TouchableOpacity>

        {/* Hot Numbers */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="flame" size={24} color="#ef4444" />
            <Text style={styles.sectionTitle}>Números Calientes</Text>
          </View>
          <Text style={styles.sectionSubtitle}>Salen con más frecuencia</Text>
          <View style={styles.numbersRow}>
            {stats?.hot_numbers && stats.hot_numbers.length > 0 ? (
              stats.hot_numbers.map((num, index) => (
                <View key={index} style={[styles.numberBall, styles.hotBall]}>
                  <Text style={styles.numberBallText}>{num.toString().padStart(2, '0')}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.noData}>Aún no hay datos suficientes</Text>
            )}
          </View>
        </View>

        {/* Cold Numbers */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="snow" size={24} color="#3b82f6" />
            <Text style={styles.sectionTitle}>Números Fríos</Text>
          </View>
          <Text style={styles.sectionSubtitle}>Salen con menos frecuencia</Text>
          <View style={styles.numbersRow}>
            {stats?.cold_numbers && stats.cold_numbers.length > 0 ? (
              stats.cold_numbers.map((num, index) => (
                <View key={index} style={[styles.numberBall, styles.coldBall]}>
                  <Text style={styles.numberBallText}>{num.toString().padStart(2, '0')}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.noData}>Aún no hay datos suficientes</Text>
            )}
          </View>
        </View>

        {/* All Stats Table */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="bar-chart" size={24} color="#22c55e" />
            <Text style={styles.sectionTitle}>Frecuencia de Números</Text>
          </View>
          {stats?.all_stats && stats.all_stats.length > 0 ? (
            <View style={styles.statsTable}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableCell, styles.tableHeaderText]}>Número</Text>
                <Text style={[styles.tableCell, styles.tableHeaderText]}>Frecuencia</Text>
                <Text style={[styles.tableCell, styles.tableHeaderText]}>Último</Text>
              </View>
              {stats.all_stats
                .sort((a, b) => b.frequency - a.frequency)
                .slice(0, 20)
                .map((stat, index) => (
                  <View key={index} style={styles.tableRow}>
                    <Text style={styles.tableCell}>
                      {stat.number.toString().padStart(2, '0')}
                    </Text>
                    <Text style={[styles.tableCell, styles.frequencyCell]}>
                      {stat.frequency}x
                    </Text>
                    <Text style={[styles.tableCell, styles.dateCell]}>
                      {stat.last_drawn
                        ? new Date(stat.last_drawn).toLocaleDateString('es-DO', {timeZone: 'America/Santo_Domingo'})
                        : '-'}
                    </Text>
                  </View>
                ))}
            </View>
          ) : (
            <View style={styles.noDataContainer}>
              <Ionicons name="analytics-outline" size={48} color="#475569" />
              <Text style={styles.noData}>Ejecuta sorteos para generar estadísticas</Text>
            </View>
          )}
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color="#3b82f6" />
          <Text style={styles.infoText}>
            Las estadísticas se actualizan después de cada sorteo. Los números calientes
            son los que salen con más frecuencia que el promedio, mientras que los
            fríos son los que salen menos.
          </Text>
        </View>
      </ScrollView>

      {/* Lottery Modal */}
      <Modal visible={showLotteryModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar Lotería</Text>
              <TouchableOpacity onPress={() => setShowLotteryModal(false)}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {lotteries.map((lottery) => (
                <TouchableOpacity
                  key={lottery.id}
                  style={[
                    styles.lotteryOption,
                    selectedLottery?.id === lottery.id && styles.lotteryOptionSelected,
                  ]}
                  onPress={() => {
                    setSelectedLottery(lottery);
                    setShowLotteryModal(false);
                  }}
                >
                  <View>
                    <Text style={styles.lotteryOptionName}>{lottery.name}</Text>
                    <Text style={styles.lotteryOptionCountry}>{lottery.country}</Text>
                  </View>
                  {selectedLottery?.id === lottery.id && (
                    <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
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
  content: {
    flex: 1,
    padding: 16,
  },
  lotterySelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  lotterySelectorLabel: {
    fontSize: 12,
    color: '#94a3b8',
  },
  lotterySelectorValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 4,
  },
  section: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 16,
    marginLeft: 32,
  },
  numbersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  numberBall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 4,
  },
  hotBall: {
    backgroundColor: '#ef4444',
  },
  coldBall: {
    backgroundColor: '#3b82f6',
  },
  numberBallText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  noData: {
    color: '#64748b',
    fontStyle: 'italic',
  },
  noDataContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  statsTable: {
    marginTop: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 8,
    marginBottom: 8,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  tableCell: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
  },
  tableHeaderText: {
    color: '#94a3b8',
    fontWeight: '600',
  },
  frequencyCell: {
    color: '#22c55e',
    fontWeight: '600',
  },
  dateCell: {
    color: '#94a3b8',
    fontSize: 12,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#1e3a5f',
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
  },
  infoText: {
    flex: 1,
    color: '#94a3b8',
    fontSize: 13,
    marginLeft: 12,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  lotteryOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  lotteryOptionSelected: {
    backgroundColor: '#0f172a',
  },
  lotteryOptionName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
  },
  lotteryOptionCountry: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
});

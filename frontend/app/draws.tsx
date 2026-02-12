import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Draw {
  id: string;
  lottery_id: string;
  lottery_name: string;
  winning_numbers: number[];
  draw_time: string;
  total_tickets: number;
  total_winners: number;
  total_paid: number;
  currency: string;
}

interface Lottery {
  id: string;
  name: string;
  country: string;
  lottery_type: string;
  min_number: number;
  max_number: number;
  numbers_to_pick: number;
}

export default function Draws() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [draws, setDraws] = useState<Draw[]>([]);
  const [lotteries, setLotteries] = useState<Lottery[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showLotteryModal, setShowLotteryModal] = useState(false);
  const [showManualDrawModal, setShowManualDrawModal] = useState(false);
  const [selectedLottery, setSelectedLottery] = useState<Lottery | null>(null);
  const [manualNumbers, setManualNumbers] = useState<string[]>([]);

  const fetchDraws = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/draws?limit=50`);
      if (response.ok) {
        const data = await response.json();
        setDraws(data);
      }
    } catch (error) {
      console.error('Error fetching draws:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLotteries = async () => {
    try {
      const response = await fetch(`${API_URL}/api/lotteries`);
      if (response.ok) {
        const data = await response.json();
        setLotteries(data);
      }
    } catch (error) {
      console.error('Error fetching lotteries:', error);
    }
  };

  useEffect(() => {
    fetchDraws();
    fetchLotteries();
  }, [fetchDraws]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDraws();
    setRefreshing(false);
  };

  const openManualDrawModal = (lottery: Lottery) => {
    setSelectedLottery(lottery);
    // Initialize empty inputs based on numbers_to_pick
    setManualNumbers(Array(lottery.numbers_to_pick).fill(''));
    setShowLotteryModal(false);
    setShowManualDrawModal(true);
  };

  const executeManualDraw = async () => {
    if (!selectedLottery) return;

    // Validate numbers
    const numbers = manualNumbers.map(n => parseInt(n.trim()));
    if (numbers.some(isNaN)) {
      Alert.alert('Error', 'Todos los números deben ser válidos');
      return;
    }
    if (numbers.some(n => n < selectedLottery.min_number || n > selectedLottery.max_number)) {
      Alert.alert('Error', `Números deben estar entre ${selectedLottery.min_number} y ${selectedLottery.max_number}`);
      return;
    }

    Alert.alert(
      'Confirmar Sorteo',
      `¿Ejecutar sorteo de ${selectedLottery.name} con números: ${numbers.join(', ')}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Ejecutar',
          onPress: async () => {
            setCreating(true);
            setShowManualDrawModal(false);
            try {
              const response = await fetch(`${API_URL}/api/draws`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ 
                  lottery_id: selectedLottery.id,
                  winning_numbers: numbers
                }),
              });

              if (response.ok) {
                const draw = await response.json();
                Alert.alert(
                  '¡Sorteo Ejecutado!',
                  `Números ganadores: ${draw.winning_numbers.join(', ')}\nBoletos: ${draw.total_tickets}\nGanadores: ${draw.total_winners}\nPremios: ${draw.currency} ${draw.total_paid.toLocaleString()}`
                );
                fetchDraws();
                setSelectedLottery(null);
                setManualNumbers([]);
              } else {
                const error = await response.json();
                Alert.alert('Error', error.detail || 'No se pudo ejecutar el sorteo');
              }
            } catch (error) {
              Alert.alert('Error', 'Error de conexión');
            } finally {
              setCreating(false);
            }
          },
        },
      ]
    );
  };

  const executeDraw = async (lotteryId: string, lotteryName: string) => {
    Alert.alert(
      'Confirmar Sorteo',
      `¿Ejecutar sorteo de ${lotteryName}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Ejecutar',
          onPress: async () => {
            setCreating(true);
            setShowLotteryModal(false);
            try {
              const response = await fetch(`${API_URL}/api/draws`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ lottery_id: lotteryId }),
              });

              if (response.ok) {
                const draw = await response.json();
                Alert.alert(
                  '¡Sorteo Ejecutado!',
                  `Números ganadores: ${draw.winning_numbers.join(', ')}\nBoletos: ${draw.total_tickets}\nGanadores: ${draw.total_winners}\nPremios: ${draw.currency} ${draw.total_paid.toLocaleString()}`
                );
                fetchDraws();
              } else {
                const error = await response.json();
                Alert.alert('Error', error.detail || 'No se pudo ejecutar el sorteo');
              }
            } catch (error) {
              Alert.alert('Error', 'Error de conexión');
            } finally {
              setCreating(false);
            }
          },
        },
      ]
    );
  };

  const renderDraw = ({ item }: { item: Draw }) => (
    <View style={styles.drawCard}>
      <View style={styles.drawHeader}>
        <View>
          <Text style={styles.lotteryName}>{item.lottery_name}</Text>
          <Text style={styles.drawTime}>
            {new Date(item.draw_time).toLocaleString('es-DO')}
          </Text>
        </View>
        <View style={styles.statsContainer}>
          <View style={styles.statBadge}>
            <Text style={styles.statValue}>{item.total_winners}</Text>
            <Text style={styles.statLabel}>Ganadores</Text>
          </View>
        </View>
      </View>

      <View style={styles.numbersContainer}>
        <Text style={styles.numbersLabel}>Números Ganadores</Text>
        <View style={styles.numberBalls}>
          {item.winning_numbers.map((num, index) => (
            <View key={index} style={styles.numberBall}>
              <Text style={styles.numberBallText}>{num.toString().padStart(2, '0')}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.drawFooter}>
        <View style={styles.footerItem}>
          <Ionicons name="ticket-outline" size={16} color="#94a3b8" />
          <Text style={styles.footerText}>{item.total_tickets} boletos</Text>
        </View>
        <View style={styles.footerItem}>
          <Ionicons name="cash-outline" size={16} color="#22c55e" />
          <Text style={[styles.footerText, styles.paidAmount]}>
            {item.currency} {item.total_paid.toLocaleString()}
          </Text>
        </View>
      </View>
    </View>
  );

  const canExecuteDraw = user?.role === 'super_admin' || user?.role === 'admin';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sorteos</Text>
        {canExecuteDraw ? (
          <TouchableOpacity onPress={() => setShowLotteryModal(true)} disabled={creating}>
            {creating ? (
              <ActivityIndicator size="small" color="#22c55e" />
            ) : (
              <Ionicons name="add-circle" size={28} color="#22c55e" />
            )}
          </TouchableOpacity>
        ) : (
          <View style={{ width: 28 }} />
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#22c55e" style={styles.loader} />
      ) : (
        <FlatList
          data={draws}
          renderItem={renderDraw}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="trophy-outline" size={64} color="#475569" />
              <Text style={styles.emptyText}>No hay sorteos</Text>
            </View>
          }
        />
      )}

      {/* Lottery Selection Modal */}
      <Modal visible={showLotteryModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ejecutar Sorteo</Text>
              <TouchableOpacity onPress={() => setShowLotteryModal(false)}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>Seleccione una lotería para ingresar los números ganadores</Text>
            <ScrollView>
              {lotteries.map((lottery) => (
                <TouchableOpacity
                  key={lottery.id}
                  style={styles.lotteryOption}
                  onPress={() => openManualDrawModal(lottery)}
                >
                  <View style={styles.lotteryOptionInfo}>
                    <Text style={styles.lotteryOptionName}>{lottery.name}</Text>
                    <Text style={styles.lotteryOptionCountry}>{lottery.country} • {lottery.lottery_type}</Text>
                    <Text style={styles.lotteryOptionNumbers}>
                      Rango: {lottery.min_number}-{lottery.max_number} • {lottery.numbers_to_pick} número(s)
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={24} color="#22c55e" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Manual Draw Modal */}
      <Modal visible={showManualDrawModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ingresar Números Ganadores</Text>
              <TouchableOpacity onPress={() => { setShowManualDrawModal(false); setSelectedLottery(null); }}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
            {selectedLottery && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.selectedLotteryInfo}>
                  <Text style={styles.selectedLotteryName}>{selectedLottery.name}</Text>
                  <Text style={styles.selectedLotteryDetails}>
                    Rango: {selectedLottery.min_number} - {selectedLottery.max_number}
                  </Text>
                </View>

                <Text style={styles.inputLabel}>Números Ganadores ({selectedLottery.numbers_to_pick})</Text>
                
                <View style={styles.numbersInputContainer}>
                  {manualNumbers.map((num, index) => (
                    <View key={index} style={styles.numberInputWrapper}>
                      <Text style={styles.numberInputLabel}>#{index + 1}</Text>
                      <TextInput
                        style={styles.numberInput}
                        value={num}
                        onChangeText={(text) => {
                          const newNumbers = [...manualNumbers];
                          newNumbers[index] = text;
                          setManualNumbers(newNumbers);
                        }}
                        keyboardType="numeric"
                        placeholder="00"
                        placeholderTextColor="#64748b"
                        maxLength={3}
                      />
                    </View>
                  ))}
                </View>

                <Text style={styles.infoText}>
                  Ingrese los números ganadores del sorteo oficial
                </Text>

                <TouchableOpacity
                  style={[styles.executeButton, creating && styles.executeButtonDisabled]}
                  onPress={executeManualDraw}
                  disabled={creating}
                >
                  {creating ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <>
                      <Ionicons name="trophy" size={24} color="#ffffff" />
                      <Text style={styles.executeButtonText}>Ejecutar Sorteo</Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            )}
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
  loader: {
    flex: 1,
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
  },
  drawCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  drawHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  lotteryName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  drawTime: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
  },
  statsContainer: {
    alignItems: 'flex-end',
  },
  statBadge: {
    backgroundColor: '#14532d',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#22c55e',
  },
  statLabel: {
    fontSize: 10,
    color: '#86efac',
  },
  numbersContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#334155',
  },
  numbersLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 12,
  },
  numberBalls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  numberBall: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 4,
  },
  numberBallText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  drawFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: '#94a3b8',
    marginLeft: 6,
  },
  paidAmount: {
    color: '#22c55e',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 12,
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

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
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
  lottery_type: string;
  min_number: number;
  max_number: number;
  numbers_to_pick: number;
  price: number;
  currency: string;
  prize_multiplier: number;
  schedule: string[];
}

export default function Sales() {
  const { token } = useAuth();
  const router = useRouter();
  const [lotteries, setLotteries] = useState<Lottery[]>([]);
  const [selectedLottery, setSelectedLottery] = useState<Lottery | null>(null);
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [amount, setAmount] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showLotteryModal, setShowLotteryModal] = useState(false);

  useEffect(() => {
    fetchLotteries();
  }, []);

  const fetchLotteries = async () => {
    try {
      const response = await fetch(`${API_URL}/api/lotteries`);
      if (response.ok) {
        const data = await response.json();
        setLotteries(data);
        if (data.length > 0) {
          setSelectedLottery(data[0]);
          setAmount(data[0].price.toString());
        }
      }
    } catch (error) {
      console.error('Error fetching lotteries:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNumberSelect = (num: number) => {
    if (!selectedLottery) return;

    if (selectedNumbers.includes(num)) {
      setSelectedNumbers(selectedNumbers.filter(n => n !== num));
    } else if (selectedNumbers.length < selectedLottery.numbers_to_pick) {
      setSelectedNumbers([...selectedNumbers, num].sort((a, b) => a - b));
    }
  };

  const handleQuickPick = () => {
    if (!selectedLottery) return;
    
    const numbers: number[] = [];
    while (numbers.length < selectedLottery.numbers_to_pick) {
      const num = Math.floor(Math.random() * (selectedLottery.max_number - selectedLottery.min_number + 1)) + selectedLottery.min_number;
      if (!numbers.includes(num)) {
        numbers.push(num);
      }
    }
    setSelectedNumbers(numbers.sort((a, b) => a - b));
  };

  const handleSubmit = async () => {
    if (!selectedLottery || selectedNumbers.length !== selectedLottery.numbers_to_pick) {
      Alert.alert('Error', `Selecciona ${selectedLottery?.numbers_to_pick} números`);
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Ingresa un monto válido');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/api/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          lottery_id: selectedLottery.id,
          numbers: selectedNumbers,
          amount: parseFloat(amount),
          currency: selectedLottery.currency,
          customer_name: customerName || null,
        }),
      });

      if (response.ok) {
        const ticket = await response.json();
        Alert.alert(
          '¡Venta Exitosa!',
          `Boleto: ${selectedNumbers.join(', ')}\nMonto: ${selectedLottery.currency} ${amount}\nPremio potencial: ${selectedLottery.currency} ${ticket.potential_win.toLocaleString()}`,
          [{ text: 'OK', onPress: () => {
            setSelectedNumbers([]);
            setCustomerName('');
          }}]
        );
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'No se pudo crear el boleto');
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setSubmitting(false);
    }
  };

  const renderNumberGrid = () => {
    if (!selectedLottery) return null;

    const numbers = [];
    for (let i = selectedLottery.min_number; i <= selectedLottery.max_number; i++) {
      numbers.push(i);
    }

    return (
      <View style={styles.numberGrid}>
        {numbers.map(num => (
          <TouchableOpacity
            key={num}
            style={[
              styles.numberButton,
              selectedNumbers.includes(num) && styles.numberButtonSelected,
            ]}
            onPress={() => handleNumberSelect(num)}
          >
            <Text
              style={[
                styles.numberText,
                selectedNumbers.includes(num) && styles.numberTextSelected,
              ]}
            >
              {num.toString().padStart(2, '0')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
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
        <Text style={styles.headerTitle}>Vender Números</Text>
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

        {/* Lottery Info */}
        {selectedLottery && (
          <View style={styles.lotteryInfo}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Rango:</Text>
              <Text style={styles.infoValue}>
                {selectedLottery.min_number} - {selectedLottery.max_number}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Seleccionar:</Text>
              <Text style={styles.infoValue}>{selectedLottery.numbers_to_pick} números</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Multiplicador:</Text>
              <Text style={styles.infoValue}>x{selectedLottery.prize_multiplier}</Text>
            </View>
          </View>
        )}

        {/* Selected Numbers */}
        <View style={styles.selectedContainer}>
          <Text style={styles.selectedLabel}>
            Números seleccionados ({selectedNumbers.length}/{selectedLottery?.numbers_to_pick || 0})
          </Text>
          <View style={styles.selectedNumbers}>
            {selectedNumbers.length > 0 ? (
              selectedNumbers.map(num => (
                <View key={num} style={styles.selectedNumber}>
                  <Text style={styles.selectedNumberText}>
                    {num.toString().padStart(2, '0')}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.noSelection}>Selecciona números abajo</Text>
            )}
          </View>
          <TouchableOpacity style={styles.quickPickButton} onPress={handleQuickPick}>
            <Ionicons name="shuffle" size={18} color="#22c55e" />
            <Text style={styles.quickPickText}>Selección Rápida</Text>
          </TouchableOpacity>
        </View>

        {/* Number Grid */}
        {renderNumberGrid()}

        {/* Amount Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Monto a jugar</Text>
          <View style={styles.amountContainer}>
            <Text style={styles.currencyLabel}>{selectedLottery?.currency}</Text>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor="#64748b"
            />
          </View>
        </View>

        {/* Customer Name */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Nombre del cliente (opcional)</Text>
          <TextInput
            style={styles.textInput}
            value={customerName}
            onChangeText={setCustomerName}
            placeholder="Nombre"
            placeholderTextColor="#64748b"
          />
        </View>

        {/* Potential Win */}
        {selectedLottery && amount && (
          <View style={styles.potentialWin}>
            <Text style={styles.potentialLabel}>Premio potencial</Text>
            <Text style={styles.potentialValue}>
              {selectedLottery.currency} {(parseFloat(amount || '0') * selectedLottery.prize_multiplier).toLocaleString()}
            </Text>
          </View>
        )}

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={24} color="#ffffff" />
              <Text style={styles.submitButtonText}>Confirmar Venta</Text>
            </>
          )}
        </TouchableOpacity>
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
              {lotteries.map(lottery => (
                <TouchableOpacity
                  key={lottery.id}
                  style={[
                    styles.lotteryOption,
                    selectedLottery?.id === lottery.id && styles.lotteryOptionSelected,
                  ]}
                  onPress={() => {
                    setSelectedLottery(lottery);
                    setSelectedNumbers([]);
                    setAmount(lottery.price.toString());
                    setShowLotteryModal(false);
                  }}
                >
                  <View>
                    <Text style={styles.lotteryOptionName}>{lottery.name}</Text>
                    <Text style={styles.lotteryOptionInfo}>
                      {lottery.country} • {lottery.currency} {lottery.price} • x{lottery.prize_multiplier}
                    </Text>
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
    marginBottom: 16,
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
  lotteryInfo: {
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 13,
    color: '#94a3b8',
  },
  infoValue: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '500',
  },
  selectedContainer: {
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  selectedLabel: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 12,
  },
  selectedNumbers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    minHeight: 50,
  },
  selectedNumber: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  selectedNumberText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  noSelection: {
    color: '#64748b',
    fontStyle: 'italic',
  },
  quickPickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#22c55e',
    borderRadius: 8,
  },
  quickPickText: {
    color: '#22c55e',
    marginLeft: 8,
    fontWeight: '500',
  },
  numberGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 16,
  },
  numberButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 4,
  },
  numberButtonSelected: {
    backgroundColor: '#22c55e',
  },
  numberText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '500',
  },
  numberTextSelected: {
    color: '#ffffff',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 8,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  currencyLabel: {
    fontSize: 16,
    color: '#22c55e',
    fontWeight: '600',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    height: 52,
    fontSize: 18,
    color: '#ffffff',
  },
  textInput: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
    fontSize: 16,
    color: '#ffffff',
  },
  potentialWin: {
    backgroundColor: '#14532d',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  potentialLabel: {
    fontSize: 12,
    color: '#86efac',
  },
  potentialValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#22c55e',
    marginTop: 4,
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: '#22c55e',
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
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
  lotteryOptionInfo: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
  },
});

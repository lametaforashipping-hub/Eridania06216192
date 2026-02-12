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
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Switch,
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
  active: boolean;
  opening_time?: string;
  closing_time?: string;
  is_open?: boolean;
  next_draw_time?: string;
  closed_message?: string;
}

const LOTTERY_TYPES = [
  { value: 'quiniela', label: 'Quiniela' },
  { value: 'pale', label: 'Pale' },
  { value: 'tripleta', label: 'Tripleta' },
  { value: 'loto', label: 'Loto' },
  { value: 'super_kino', label: 'Super Kino' },
  { value: 'pega3', label: 'Pega 3' },
  { value: 'powerball', label: 'Powerball' },
  { value: 'mega_millions', label: 'Mega Millions' },
];

export default function Lotteries() {
  const { token } = useAuth();
  const router = useRouter();
  const [lotteries, setLotteries] = useState<Lottery[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form states
  const [formName, setFormName] = useState('');
  const [formCountry, setFormCountry] = useState('RD');
  const [formType, setFormType] = useState('quiniela');
  const [formMinNumber, setFormMinNumber] = useState('0');
  const [formMaxNumber, setFormMaxNumber] = useState('99');
  const [formNumbersToPick, setFormNumbersToPick] = useState('1');
  const [formPrice, setFormPrice] = useState('20');
  const [formCurrency, setFormCurrency] = useState('RD$');
  const [formMultiplier, setFormMultiplier] = useState('70');
  const [formOpeningTime, setFormOpeningTime] = useState('08:00');
  const [formClosingTime, setFormClosingTime] = useState('21:00');

  const fetchLotteries = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/lotteries?active_only=false`);
      if (response.ok) {
        const data = await response.json();
        setLotteries(data);
      }
    } catch (error) {
      console.error('Error fetching lotteries:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLotteries();
  }, [fetchLotteries]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLotteries();
    setRefreshing(false);
  };

  const handleCreateLottery = async () => {
    if (!formName) {
      Alert.alert('Error', 'Ingresa el nombre de la lotería');
      return;
    }

    setCreating(true);
    try {
      const response = await fetch(`${API_URL}/api/lotteries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formName,
          country: formCountry,
          lottery_type: formType,
          min_number: parseInt(formMinNumber),
          max_number: parseInt(formMaxNumber),
          numbers_to_pick: parseInt(formNumbersToPick),
          price: parseFloat(formPrice),
          currency: formCurrency,
          prize_multiplier: parseFloat(formMultiplier),
          schedule: ['12:00', '15:00', '21:00'],
          active: true,
          opening_time: formOpeningTime,
          closing_time: formClosingTime,
        }),
      });

      if (response.ok) {
        Alert.alert('Éxito', 'Lotería creada correctamente');
        setShowCreateModal(false);
        resetForm();
        fetchLotteries();
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'No se pudo crear la lotería');
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setCreating(false);
    }
  };

  const toggleLotteryStatus = async (lottery: Lottery) => {
    try {
      const response = await fetch(`${API_URL}/api/lotteries/${lottery.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ active: !lottery.active }),
      });

      if (response.ok) {
        fetchLotteries();
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión');
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormCountry('RD');
    setFormType('quiniela');
    setFormMinNumber('0');
    setFormMaxNumber('99');
    setFormNumbersToPick('1');
    setFormPrice('20');
    setFormCurrency('RD$');
    setFormMultiplier('70');
    setFormOpeningTime('08:00');
    setFormClosingTime('21:00');
  };

  const getTypeLabel = (type: string) => {
    return LOTTERY_TYPES.find(t => t.value === type)?.label || type;
  };

  const getCountryFlag = (country: string) => {
    return country === 'RD' ? '🇩🇴' : country === 'USA' ? '🇺🇸' : '🏳️';
  };

  const renderLottery = ({ item }: { item: Lottery }) => (
    <View style={[styles.lotteryCard, !item.active && styles.lotteryCardInactive]}>
      <View style={styles.lotteryHeader}>
        <View style={styles.lotteryTitleRow}>
          <Text style={styles.countryFlag}>{getCountryFlag(item.country)}</Text>
          <View>
            <Text style={styles.lotteryName}>{item.name}</Text>
            <Text style={styles.lotteryType}>{getTypeLabel(item.lottery_type)}</Text>
          </View>
        </View>
        <Switch
          value={item.active}
          onValueChange={() => toggleLotteryStatus(item)}
          trackColor={{ false: '#334155', true: '#14532d' }}
          thumbColor={item.active ? '#22c55e' : '#94a3b8'}
        />
      </View>

      {/* Status indicator */}
      {item.is_open !== undefined && (
        <View style={[styles.statusIndicator, item.is_open ? styles.statusOpen : styles.statusClosed]}>
          <Text style={styles.statusText}>
            {item.is_open ? '🟢 ABIERTA' : `🔴 ${item.closed_message || 'CERRADA'}`}
          </Text>
        </View>
      )}

      <View style={styles.lotteryDetails}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Rango</Text>
          <Text style={styles.detailValue}>{item.min_number} - {item.max_number}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Seleccionar</Text>
          <Text style={styles.detailValue}>{item.numbers_to_pick} números</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Precio</Text>
          <Text style={styles.detailValue}>{item.currency} {item.price}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Multiplicador</Text>
          <Text style={[styles.detailValue, styles.multiplierValue]}>x{item.prize_multiplier}</Text>
        </View>
      </View>

      {/* Operating Hours */}
      <View style={styles.operatingHours}>
        <Ionicons name="time-outline" size={16} color="#22c55e" />
        <Text style={styles.operatingHoursText}>
          Horario: {item.opening_time || '08:00'} - {item.closing_time || '21:00'}
        </Text>
      </View>

      <View style={styles.scheduleContainer}>
        <Ionicons name="calendar-outline" size={16} color="#94a3b8" />
        <Text style={styles.scheduleText}>
          Sorteos: {item.schedule.join(', ')}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Loterías</Text>
        <TouchableOpacity onPress={() => setShowCreateModal(true)}>
          <Ionicons name="add-circle" size={28} color="#22c55e" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#22c55e" style={styles.loader} />
      ) : (
        <FlatList
          data={lotteries}
          renderItem={renderLottery}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />
          }
        />
      )}

      {/* Create Lottery Modal */}
      <Modal visible={showCreateModal} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nueva Lotería</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Nombre</Text>
              <TextInput
                style={styles.input}
                value={formName}
                onChangeText={setFormName}
                placeholder="Nombre de la lotería"
                placeholderTextColor="#64748b"
              />

              <Text style={styles.inputLabel}>País</Text>
              <View style={styles.segmentedControl}>
                {['RD', 'USA'].map((country) => (
                  <TouchableOpacity
                    key={country}
                    style={[styles.segment, formCountry === country && styles.segmentActive]}
                    onPress={() => {
                      setFormCountry(country);
                      setFormCurrency(country === 'RD' ? 'RD$' : 'USD');
                    }}
                  >
                    <Text style={[styles.segmentText, formCountry === country && styles.segmentTextActive]}>
                      {getCountryFlag(country)} {country}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Tipo de Lotería</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeSelector}>
                {LOTTERY_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    style={[styles.typeOption, formType === type.value && styles.typeOptionActive]}
                    onPress={() => setFormType(type.value)}
                  >
                    <Text style={[styles.typeOptionText, formType === type.value && styles.typeOptionTextActive]}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.rowInputs}>
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>Número Mínimo</Text>
                  <TextInput
                    style={styles.input}
                    value={formMinNumber}
                    onChangeText={setFormMinNumber}
                    keyboardType="numeric"
                    placeholderTextColor="#64748b"
                  />
                </View>
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>Número Máximo</Text>
                  <TextInput
                    style={styles.input}
                    value={formMaxNumber}
                    onChangeText={setFormMaxNumber}
                    keyboardType="numeric"
                    placeholderTextColor="#64748b"
                  />
                </View>
              </View>

              <View style={styles.rowInputs}>
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>Números a Elegir</Text>
                  <TextInput
                    style={styles.input}
                    value={formNumbersToPick}
                    onChangeText={setFormNumbersToPick}
                    keyboardType="numeric"
                    placeholderTextColor="#64748b"
                  />
                </View>
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>Precio ({formCurrency})</Text>
                  <TextInput
                    style={styles.input}
                    value={formPrice}
                    onChangeText={setFormPrice}
                    keyboardType="numeric"
                    placeholderTextColor="#64748b"
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Multiplicador de Premio</Text>
              <TextInput
                style={styles.input}
                value={formMultiplier}
                onChangeText={setFormMultiplier}
                keyboardType="numeric"
                placeholderTextColor="#64748b"
              />

              <Text style={styles.sectionHeader}>⏰ Horario de Operación</Text>
              
              <View style={styles.rowInputs}>
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>Hora de Apertura</Text>
                  <TextInput
                    style={styles.input}
                    value={formOpeningTime}
                    onChangeText={setFormOpeningTime}
                    placeholder="08:00"
                    placeholderTextColor="#64748b"
                  />
                </View>
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>Hora de Cierre</Text>
                  <TextInput
                    style={styles.input}
                    value={formClosingTime}
                    onChangeText={setFormClosingTime}
                    placeholder="21:00"
                    placeholderTextColor="#64748b"
                  />
                </View>
              </View>

              <Text style={styles.infoText}>
                💡 Los vendedores no podrán vender antes de la hora de apertura ni después de la hora de cierre
              </Text>

              <TouchableOpacity
                style={[styles.submitButton, creating && styles.submitButtonDisabled]}
                onPress={handleCreateLottery}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitButtonText}>Crear Lotería</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
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
  lotteryCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  lotteryCardInactive: {
    opacity: 0.6,
  },
  lotteryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  lotteryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countryFlag: {
    fontSize: 32,
    marginRight: 12,
  },
  lotteryName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  lotteryType: {
    fontSize: 13,
    color: '#22c55e',
    marginTop: 2,
  },
  lotteryDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  detailItem: {
    width: '50%',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 11,
    color: '#94a3b8',
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 2,
  },
  multiplierValue: {
    color: '#22c55e',
  },
  scheduleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  scheduleText: {
    fontSize: 13,
    color: '#94a3b8',
    marginLeft: 6,
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
    maxHeight: '85%',
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
  modalBody: {
    padding: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    paddingHorizontal: 16,
    height: 48,
    color: '#ffffff',
    fontSize: 16,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentActive: {
    backgroundColor: '#22c55e',
  },
  segmentText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  segmentTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  typeSelector: {
    flexDirection: 'row',
  },
  typeOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#0f172a',
    borderRadius: 20,
    marginRight: 8,
  },
  typeOptionActive: {
    backgroundColor: '#22c55e',
  },
  typeOptionText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  typeOptionTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  rowInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfInput: {
    width: '48%',
  },
  submitButton: {
    backgroundColor: '#22c55e',
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

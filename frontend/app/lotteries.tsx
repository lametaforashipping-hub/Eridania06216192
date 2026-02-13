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

interface WeeklyHours {
  [key: string]: {
    open: string;
    close: string;
  };
}

interface TodayHours {
  open: string | null;
  close: string | null;
  day: string;
  holiday?: string | null;
  closed?: boolean;
}

interface Holiday {
  date: string;
  name: string;
  closed?: boolean;
  open?: string;
  close?: string;
}

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
  weekly_hours?: WeeklyHours;
  holidays?: Holiday[];
  is_open?: boolean;
  next_draw_time?: string;
  closed_message?: string;
  today_hours?: TodayHours;
  is_holiday?: boolean;
  holiday_name?: string;
  ticket_limit_per_number?: number | null;
}

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Lun', fullLabel: 'Lunes' },
  { key: 'tuesday', label: 'Mar', fullLabel: 'Martes' },
  { key: 'wednesday', label: 'Mié', fullLabel: 'Miércoles' },
  { key: 'thursday', label: 'Jue', fullLabel: 'Jueves' },
  { key: 'friday', label: 'Vie', fullLabel: 'Viernes' },
  { key: 'saturday', label: 'Sáb', fullLabel: 'Sábado' },
  { key: 'sunday', label: 'Dom', fullLabel: 'Domingo' },
];

const DEFAULT_WEEKLY_HOURS: WeeklyHours = {
  monday: { open: '08:00', close: '21:00' },
  tuesday: { open: '08:00', close: '21:00' },
  wednesday: { open: '08:00', close: '21:00' },
  thursday: { open: '08:00', close: '21:00' },
  friday: { open: '08:00', close: '21:00' },
  saturday: { open: '08:00', close: '22:00' },
  sunday: { open: '10:00', close: '20:00' },
};

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
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingLottery, setEditingLottery] = useState<Lottery | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

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
  const [formWeeklyHours, setFormWeeklyHours] = useState<WeeklyHours>(DEFAULT_WEEKLY_HOURS);
  const [useWeeklySchedule, setUseWeeklySchedule] = useState(false);
  const [formTicketLimit, setFormTicketLimit] = useState('');
  const [formSchedule, setFormSchedule] = useState('12:00,15:00,21:00');

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
          weekly_hours: useWeeklySchedule ? formWeeklyHours : null,
          ticket_limit_per_number: formTicketLimit ? parseInt(formTicketLimit) : null,
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
    setFormWeeklyHours(DEFAULT_WEEKLY_HOURS);
    setUseWeeklySchedule(false);
    setFormTicketLimit('');
    setFormSchedule('12:00,15:00,21:00');
  };

  const openEditModal = (lottery: Lottery) => {
    setEditingLottery(lottery);
    setFormName(lottery.name);
    setFormCountry(lottery.country);
    setFormType(lottery.lottery_type);
    setFormMinNumber(lottery.min_number.toString());
    setFormMaxNumber(lottery.max_number.toString());
    setFormNumbersToPick(lottery.numbers_to_pick.toString());
    setFormPrice(lottery.price.toString());
    setFormCurrency(lottery.currency);
    setFormMultiplier(lottery.prize_multiplier.toString());
    setFormOpeningTime(lottery.opening_time || '08:00');
    setFormClosingTime(lottery.closing_time || '21:00');
    setFormWeeklyHours(lottery.weekly_hours || DEFAULT_WEEKLY_HOURS);
    setUseWeeklySchedule(!!lottery.weekly_hours);
    setFormTicketLimit(lottery.ticket_limit_per_number?.toString() || '');
    setFormSchedule(lottery.schedule?.join(',') || '12:00,15:00,21:00');
    setShowEditModal(true);
  };

  const handleUpdateLottery = async () => {
    if (!editingLottery) return;
    
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/lotteries/${editingLottery.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formName,
          price: parseFloat(formPrice),
          prize_multiplier: parseFloat(formMultiplier),
          schedule: formSchedule.split(',').map(s => s.trim()),
          opening_time: formOpeningTime,
          closing_time: formClosingTime,
          weekly_hours: useWeeklySchedule ? formWeeklyHours : null,
          ticket_limit_per_number: formTicketLimit ? parseInt(formTicketLimit) : null,
        }),
      });

      if (response.ok) {
        Alert.alert('Éxito', 'Lotería actualizada correctamente');
        setShowEditModal(false);
        setEditingLottery(null);
        resetForm();
        fetchLotteries();
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'No se pudo actualizar la lotería');
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setSaving(false);
    }
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
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.editButton} 
            onPress={() => openEditModal(item)}
            data-testid={`edit-lottery-${item.id}`}
          >
            <Ionicons name="create-outline" size={18} color="#ffffff" />
          </TouchableOpacity>
          <Switch
            value={item.active}
            onValueChange={() => toggleLotteryStatus(item)}
            trackColor={{ false: '#334155', true: '#14532d' }}
            thumbColor={item.active ? '#22c55e' : '#94a3b8'}
          />
        </View>
      </View>

      {/* Status indicator */}
      {item.is_open !== undefined && (
        <View style={[styles.statusIndicator, item.is_open ? styles.statusOpen : styles.statusClosed]}>
          <Text style={styles.statusText}>
            {item.is_holiday ? '🎉 ' : ''}{item.is_open ? '🟢 ABIERTA' : `🔴 ${item.closed_message || 'CERRADA'}`}
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
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Límite por número</Text>
          <Text style={[styles.detailValue, item.ticket_limit_per_number ? styles.limitValue : null]}>
            {item.ticket_limit_per_number ? `${item.ticket_limit_per_number} boletos` : 'Sin límite'}
          </Text>
        </View>
      </View>

      {/* Operating Hours - MEJORADO */}
      <View style={styles.operatingHoursSection}>
        <View style={styles.operatingHoursHeader}>
          <Ionicons name="time-outline" size={18} color="#22c55e" />
          <Text style={styles.operatingHoursTitle}>Horario de Operación</Text>
        </View>
        
        {/* Horario de Hoy */}
        <View style={styles.todayHoursContainer}>
          <Text style={styles.todayLabel}>
            📅 Hoy ({item.today_hours?.day || 'N/A'}):
          </Text>
          <View style={[styles.todayHoursBadge, item.is_open ? styles.openBadge : styles.closedBadge]}>
            <Text style={styles.todayHoursText}>
              {item.today_hours?.closed ? 'CERRADO' : `${item.today_hours?.open || item.opening_time || '08:00'} - ${item.today_hours?.close || item.closing_time || '21:00'}`}
            </Text>
          </View>
        </View>

        {/* Horarios Semanales Detallados */}
        {item.weekly_hours ? (
          <View style={styles.weeklyHoursContainer}>
            <Text style={styles.weeklyHoursTitle}>📋 Horarios por Día:</Text>
            <View style={styles.weeklyHoursGrid}>
              {DAYS_OF_WEEK.map((day) => {
                const hours = item.weekly_hours?.[day.key];
                const isToday = item.today_hours?.day?.toLowerCase().startsWith(day.key.substring(0, 3));
                return (
                  <View key={day.key} style={[styles.dayHoursRow, isToday && styles.todayRow]}>
                    <Text style={[styles.dayName, isToday && styles.todayDayName]}>{day.label}</Text>
                    <Text style={[styles.dayHours, isToday && styles.todayDayHours]}>
                      {hours ? `${hours.open} - ${hours.close}` : 'N/A'}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.simpleHoursContainer}>
            <Text style={styles.simpleHoursText}>
              🕐 Horario fijo: {item.opening_time || '08:00'} - {item.closing_time || '21:00'} (todos los días)
            </Text>
          </View>
        )}
      </View>

      <View style={styles.scheduleContainer}>
        <Ionicons name="calendar-outline" size={16} color="#94a3b8" />
        <Text style={styles.scheduleText}>
          Sorteos: {item.schedule.join(', ')}
        </Text>
      </View>

      {/* Edit Button */}
      <TouchableOpacity 
        style={styles.editLotteryButton}
        onPress={() => openEditModal(item)}
      >
        <Ionicons name="create-outline" size={18} color="#ffffff" />
        <Text style={styles.editLotteryButtonText}>Editar Lotería</Text>
      </TouchableOpacity>
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

              <Text style={styles.sectionHeader}>🎫 Límite de Ventas</Text>
              
              <Text style={styles.inputLabel}>Límite de boletos por número</Text>
              <TextInput
                style={styles.input}
                value={formTicketLimit}
                onChangeText={setFormTicketLimit}
                keyboardType="numeric"
                placeholder="Dejar vacío = Sin límite"
                placeholderTextColor="#64748b"
              />
              <Text style={styles.infoText}>
                📊 Máximo de boletos que se pueden vender para cada número (global)
              </Text>

              <Text style={styles.sectionHeader}>⏰ Horario de Operación</Text>
              
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Usar horarios diferentes por día</Text>
                <Switch
                  value={useWeeklySchedule}
                  onValueChange={setUseWeeklySchedule}
                  trackColor={{ false: '#334155', true: '#14532d' }}
                  thumbColor={useWeeklySchedule ? '#22c55e' : '#94a3b8'}
                />
              </View>

              {!useWeeklySchedule ? (
                <>
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
                    💡 Este horario aplica todos los días
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.weeklyInfoText}>
                    📅 Configura horarios diferentes para cada día
                  </Text>
                  {DAYS_OF_WEEK.map((day) => (
                    <View key={day.key} style={styles.dayRow}>
                      <Text style={styles.dayLabel}>{day.fullLabel}</Text>
                      <View style={styles.dayInputs}>
                        <TextInput
                          style={styles.timeInput}
                          value={formWeeklyHours[day.key]?.open || '08:00'}
                          onChangeText={(text) => setFormWeeklyHours(prev => ({
                            ...prev,
                            [day.key]: { ...prev[day.key], open: text }
                          }))}
                          placeholder="08:00"
                          placeholderTextColor="#64748b"
                        />
                        <Text style={styles.toText}>a</Text>
                        <TextInput
                          style={styles.timeInput}
                          value={formWeeklyHours[day.key]?.close || '21:00'}
                          onChangeText={(text) => setFormWeeklyHours(prev => ({
                            ...prev,
                            [day.key]: { ...prev[day.key], close: text }
                          }))}
                          placeholder="21:00"
                          placeholderTextColor="#64748b"
                        />
                      </View>
                    </View>
                  ))}
                </>
              )}

              <Text style={styles.infoText}>
                💡 Los vendedores no podrán vender fuera del horario establecido
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

      {/* Edit Lottery Modal */}
      <Modal visible={showEditModal} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar Lotería</Text>
              <TouchableOpacity onPress={() => { setShowEditModal(false); setEditingLottery(null); resetForm(); }}>
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

              <Text style={styles.sectionHeader}>💰 Configuración de Precios</Text>
              
              <View style={styles.rowInputs}>
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
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>Multiplicador</Text>
                  <TextInput
                    style={styles.input}
                    value={formMultiplier}
                    onChangeText={setFormMultiplier}
                    keyboardType="numeric"
                    placeholderTextColor="#64748b"
                  />
                </View>
              </View>

              <Text style={styles.sectionHeader}>🎫 Límite de Ventas</Text>
              
              <Text style={styles.inputLabel}>Límite de boletos por número</Text>
              <TextInput
                style={styles.input}
                value={formTicketLimit}
                onChangeText={setFormTicketLimit}
                keyboardType="numeric"
                placeholder="Dejar vacío = Sin límite"
                placeholderTextColor="#64748b"
              />

              <Text style={styles.sectionHeader}>🎰 Horarios de Sorteo</Text>
              
              <Text style={styles.inputLabel}>Horarios (separados por coma)</Text>
              <TextInput
                style={styles.input}
                value={formSchedule}
                onChangeText={setFormSchedule}
                placeholder="12:00,15:00,21:00"
                placeholderTextColor="#64748b"
              />
              <Text style={styles.infoText}>
                💡 Ejemplo: 12:00,15:00,21:00
              </Text>

              <Text style={styles.sectionHeader}>⏰ Horario de Operación</Text>
              
              <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={18} color="#3b82f6" />
                <Text style={styles.infoBoxText}>
                  Define cuándo la lotería acepta jugadas. Las ventas se bloquean automáticamente fuera de horario.
                </Text>
              </View>
              
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Usar horarios diferentes por día</Text>
                <Switch
                  value={useWeeklySchedule}
                  onValueChange={setUseWeeklySchedule}
                  trackColor={{ false: '#334155', true: '#14532d' }}
                  thumbColor={useWeeklySchedule ? '#22c55e' : '#94a3b8'}
                />
              </View>

              {!useWeeklySchedule ? (
                <>
                  <Text style={styles.simpleScheduleInfo}>🕐 Horario fijo para todos los días</Text>
                  <View style={styles.rowInputs}>
                    <View style={styles.halfInput}>
                      <Text style={styles.inputLabel}>🟢 Apertura</Text>
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
                </>
              ) : (
                <>
                  <Text style={styles.weeklyInfoText}>
                    📅 Configura horarios diferentes para cada día
                  </Text>
                  {DAYS_OF_WEEK.map((day) => (
                    <View key={day.key} style={styles.dayRow}>
                      <Text style={styles.dayLabel}>{day.fullLabel}</Text>
                      <View style={styles.dayInputs}>
                        <TextInput
                          style={styles.timeInput}
                          value={formWeeklyHours[day.key]?.open || '08:00'}
                          onChangeText={(text) => setFormWeeklyHours(prev => ({
                            ...prev,
                            [day.key]: { ...prev[day.key], open: text }
                          }))}
                          placeholder="08:00"
                          placeholderTextColor="#64748b"
                        />
                        <Text style={styles.toText}>a</Text>
                        <TextInput
                          style={styles.timeInput}
                          value={formWeeklyHours[day.key]?.close || '21:00'}
                          onChangeText={(text) => setFormWeeklyHours(prev => ({
                            ...prev,
                            [day.key]: { ...prev[day.key], close: text }
                          }))}
                          placeholder="21:00"
                          placeholderTextColor="#64748b"
                        />
                      </View>
                    </View>
                  ))}
                </>
              )}

              <TouchableOpacity
                style={[styles.submitButton, saving && styles.submitButtonDisabled]}
                onPress={handleUpdateLottery}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitButtonText}>Guardar Cambios</Text>
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
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editButton: {
    padding: 8,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    marginRight: 12,
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
  limitValue: {
    color: '#f59e0b',
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
  editLotteryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
  },
  editLotteryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 14,
  },
  statusIndicator: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: 12,
    alignItems: 'center',
  },
  statusOpen: {
    backgroundColor: '#14532d',
  },
  statusClosed: {
    backgroundColor: '#7f1d1d',
  },
  statusText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  operatingHours: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 8,
    borderRadius: 6,
    marginBottom: 12,
  },
  operatingHoursText: {
    fontSize: 13,
    color: '#22c55e',
    marginLeft: 6,
    fontWeight: '500',
  },
  // Nuevos estilos para horarios mejorados
  operatingHoursSection: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  operatingHoursHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  operatingHoursTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22c55e',
    marginLeft: 8,
  },
  todayHoursContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  todayLabel: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '500',
  },
  todayHoursBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  openBadge: {
    backgroundColor: '#14532d',
  },
  closedBadge: {
    backgroundColor: '#7f1d1d',
  },
  todayHoursText: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '700',
  },
  weeklyHoursContainer: {
    marginTop: 8,
  },
  weeklyHoursTitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 8,
  },
  weeklyHoursGrid: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    overflow: 'hidden',
  },
  dayHoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  todayRow: {
    backgroundColor: '#14532d30',
  },
  dayName: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
    width: 40,
  },
  todayDayName: {
    color: '#22c55e',
    fontWeight: '700',
  },
  dayHours: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '500',
  },
  todayDayHours: {
    color: '#22c55e',
    fontWeight: '700',
  },
  simpleHoursContainer: {
    marginTop: 4,
  },
  simpleHoursText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1e3a5f',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  infoBoxText: {
    flex: 1,
    fontSize: 12,
    color: '#93c5fd',
    marginLeft: 8,
    lineHeight: 18,
  },
  simpleScheduleInfo: {
    fontSize: 12,
    color: '#22c55e',
    marginVertical: 8,
    textAlign: 'center',
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 20,
    marginBottom: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 16,
  },
  infoText: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
    marginTop: 8,
    marginBottom: 12,
    textAlign: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  switchLabel: {
    color: '#ffffff',
    fontSize: 14,
  },
  weeklyInfoText: {
    fontSize: 13,
    color: '#22c55e',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f172a',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  dayLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
    width: 90,
  },
  dayInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
  },
  timeInput: {
    backgroundColor: '#1e293b',
    borderRadius: 6,
    paddingHorizontal: 12,
    height: 36,
    color: '#ffffff',
    fontSize: 14,
    width: 70,
    textAlign: 'center',
  },
  toText: {
    color: '#94a3b8',
    marginHorizontal: 8,
    fontSize: 14,
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

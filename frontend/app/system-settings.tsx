import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface SystemConfig {
  high_risk_threshold_rd: number;
  high_risk_threshold_usd: number;
  auto_refresh_interval: number;
}

interface Lottery {
  id: string;
  name: string;
  lottery_type: string;
  prize_multiplier: number;
  prize_tiers?: {
    first?: number;
    second?: number;
    third?: number;
  };
  currency: string;
  country: string;
  active: boolean;
}

export default function SystemSettings() {
  const { token, user } = useAuth();
  const router = useRouter();
  
  const [config, setConfig] = useState<SystemConfig>({
    high_risk_threshold_rd: 10000,
    high_risk_threshold_usd: 200,
    auto_refresh_interval: 5,
  });
  const [lotteries, setLotteries] = useState<Lottery[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Edit states
  const [editThresholdRd, setEditThresholdRd] = useState('');
  const [editThresholdUsd, setEditThresholdUsd] = useState('');
  const [editRefreshInterval, setEditRefreshInterval] = useState('');
  
  // Lottery prize modal
  const [showPrizeModal, setShowPrizeModal] = useState(false);
  const [selectedLottery, setSelectedLottery] = useState<Lottery | null>(null);
  const [editFirst, setEditFirst] = useState('');
  const [editSecond, setEditSecond] = useState('');
  const [editThird, setEditThird] = useState('');

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      // Fetch system config
      const configRes = await fetch(`${API_URL}/api/admin/config`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (configRes.ok) {
        const configData = await configRes.json();
        setConfig(configData);
        setEditThresholdRd(configData.high_risk_threshold_rd?.toString() || '10000');
        setEditThresholdUsd(configData.high_risk_threshold_usd?.toString() || '200');
        setEditRefreshInterval(configData.auto_refresh_interval?.toString() || '5');
      }
      
      // Fetch lotteries
      const lotteriesRes = await fetch(`${API_URL}/api/lotteries`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (lotteriesRes.ok) {
        const lotteriesData = await lotteriesRes.json();
        setLotteries(lotteriesData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/config`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          high_risk_threshold_rd: parseFloat(editThresholdRd) || 10000,
          high_risk_threshold_usd: parseFloat(editThresholdUsd) || 200,
          auto_refresh_interval: parseInt(editRefreshInterval) || 5,
        }),
      });
      
      if (response.ok) {
        Alert.alert('Éxito', 'Configuración guardada correctamente');
        fetchData();
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'No se pudo guardar la configuración');
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const openPrizeModal = (lottery: Lottery) => {
    setSelectedLottery(lottery);
    setEditFirst(lottery.prize_tiers?.first?.toString() || lottery.prize_multiplier?.toString() || '70');
    setEditSecond(lottery.prize_tiers?.second?.toString() || '15');
    setEditThird(lottery.prize_tiers?.third?.toString() || '5');
    setShowPrizeModal(true);
  };

  const handleResetDatabase = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/reset-database`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const data = await response.json();
        Alert.alert('Exito', `Base de datos reseteada.\nUsuarios eliminados: ${data.deleted.usuarios}\nBoletos eliminados: ${data.deleted.tickets}\nTransacciones: ${data.deleted.transacciones}`);
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'No se pudo resetear');
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexion');
    }
  };


  const handleSavePrizeTiers = async () => {
    if (!selectedLottery) return;
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/lotteries/${selectedLottery.id}/prize-tiers`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          first: parseFloat(editFirst) || 70,
          second: parseFloat(editSecond) || 15,
          third: parseFloat(editThird) || 5,
        }),
      });
      
      if (response.ok) {
        Alert.alert('Éxito', `Premios actualizados para ${selectedLottery.name}`);
        setShowPrizeModal(false);
        fetchData();
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'No se pudo actualizar');
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const getCountryFlag = (country: string) => {
    return country === 'US' ? '🇺🇸' : '🇩🇴';
  };

  if (user?.role !== 'super_admin') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="lock-closed" size={64} color="#ef4444" />
          <Text style={styles.errorText}>Acceso Denegado</Text>
          <Text style={styles.errorSubtext}>Solo el Super Admin puede acceder a esta sección</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} data-testid="back-button">
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Configuración del Sistema</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Ionicons name="refresh" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#22c55e" style={styles.loader} />
      ) : (
        <ScrollView
          style={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />}
        >
          {/* Alert Thresholds Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="warning" size={24} color="#ef4444" />
              <Text style={styles.sectionTitle}>Alertas de Alto Riesgo</Text>
            </View>
            <Text style={styles.sectionDescription}>
              Tickets con premio potencial superior a estos valores se marcarán como "Alto Riesgo"
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Umbral RD$ (Pesos Dominicanos)</Text>
              <View style={styles.inputRow}>
                <Text style={styles.currencyPrefix}>RD$</Text>
                <TextInput
                  style={styles.input}
                  value={editThresholdRd}
                  onChangeText={setEditThresholdRd}
                  keyboardType="numeric"
                  placeholder="10000"
                  placeholderTextColor="#64748b"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Umbral USD (Dólares)</Text>
              <View style={styles.inputRow}>
                <Text style={styles.currencyPrefix}>USD</Text>
                <TextInput
                  style={styles.input}
                  value={editThresholdUsd}
                  onChangeText={setEditThresholdUsd}
                  keyboardType="numeric"
                  placeholder="200"
                  placeholderTextColor="#64748b"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Intervalo de Auto-Refresh (segundos)</Text>
              <TextInput
                style={[styles.input, styles.fullInput]}
                value={editRefreshInterval}
                onChangeText={setEditRefreshInterval}
                keyboardType="numeric"
                placeholder="5"
                placeholderTextColor="#64748b"
              />
            </View>

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.buttonDisabled]}
              onPress={handleSaveConfig}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="save" size={20} color="#ffffff" />
                  <Text style={styles.saveButtonText}>Guardar Configuración</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Lottery Prize Configuration */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="trophy" size={24} color="#f59e0b" />
              <Text style={styles.sectionTitle}>Multiplicadores de Premios</Text>
            </View>
            <Text style={styles.sectionDescription}>
              Configura los multiplicadores para cada lotería (1ro, 2do, 3ro lugar)
            </Text>

            {lotteries.map((lottery) => (
              <TouchableOpacity
                key={lottery.id}
                style={[styles.lotteryCard, !lottery.active && styles.lotteryCardInactive]}
                onPress={() => openPrizeModal(lottery)}
              >
                <View style={styles.lotteryInfo}>
                  <Text style={styles.lotteryFlag}>{getCountryFlag(lottery.country)}</Text>
                  <View style={styles.lotteryDetails}>
                    <Text style={styles.lotteryName}>{lottery.name}</Text>
                    <Text style={styles.lotteryType}>{lottery.lottery_type}</Text>
                  </View>
                </View>
                <View style={styles.lotteryPrizes}>
                  <View style={styles.prizeItem}>
                    <Text style={styles.prizeLabel}>1ro</Text>
                    <Text style={styles.prizeValue}>{lottery.prize_tiers?.first || lottery.prize_multiplier || 70}x</Text>
                  </View>
                  <View style={styles.prizeItem}>
                    <Text style={styles.prizeLabel}>2do</Text>
                    <Text style={styles.prizeValue}>{lottery.prize_tiers?.second || 15}x</Text>
                  </View>
                  <View style={styles.prizeItem}>
                    <Text style={styles.prizeLabel}>3ro</Text>
                    <Text style={styles.prizeValue}>{lottery.prize_tiers?.third || 5}x</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#64748b" />
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Reset Database Section - Super Admin Only */}
          {user?.role === 'super_admin' && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="warning" size={24} color="#ef4444" />
                <Text style={[styles.sectionTitle, { color: '#ef4444' }]}>Zona Peligrosa</Text>
              </View>
              <Text style={styles.sectionDescription}>
                Elimina todos los boletos, vendedores, clientes y datos de prueba. Conserva admin, loterias y configuracion.
              </Text>
              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: '#ef4444' }]}
                onPress={() => {
                  Alert.alert(
                    'Resetear Base de Datos',
                    'Se eliminaran TODOS los boletos, usuarios (excepto admin), transacciones y notificaciones. Esta accion NO se puede deshacer.',
                    [
                      { text: 'Cancelar', style: 'cancel' },
                      { text: 'RESETEAR', style: 'destructive', onPress: handleResetDatabase },
                    ]
                  );
                }}
              >
                <Ionicons name="trash" size={20} color="#ffffff" />
                <Text style={styles.saveButtonText}>Resetear Base de Datos</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      )}

      {/* Prize Tiers Modal */}
      <Modal visible={showPrizeModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Editar Premios: {selectedLottery?.name}
              </Text>
              <TouchableOpacity onPress={() => setShowPrizeModal(false)}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalDescription}>
                Configura el multiplicador para cada posición de premio.
                El premio se calcula: Monto × Multiplicador
              </Text>

              <View style={styles.prizeInputGroup}>
                <View style={styles.prizeInputItem}>
                  <View style={styles.prizeInputHeader}>
                    <Text style={styles.prizePosition}>🥇 1er Lugar</Text>
                  </View>
                  <View style={styles.prizeInputRow}>
                    <TextInput
                      style={styles.prizeInput}
                      value={editFirst}
                      onChangeText={setEditFirst}
                      keyboardType="numeric"
                      placeholder="70"
                      placeholderTextColor="#64748b"
                    />
                    <Text style={styles.multiplierSuffix}>x</Text>
                  </View>
                </View>

                <View style={styles.prizeInputItem}>
                  <View style={styles.prizeInputHeader}>
                    <Text style={styles.prizePosition}>🥈 2do Lugar</Text>
                  </View>
                  <View style={styles.prizeInputRow}>
                    <TextInput
                      style={styles.prizeInput}
                      value={editSecond}
                      onChangeText={setEditSecond}
                      keyboardType="numeric"
                      placeholder="15"
                      placeholderTextColor="#64748b"
                    />
                    <Text style={styles.multiplierSuffix}>x</Text>
                  </View>
                </View>

                <View style={styles.prizeInputItem}>
                  <View style={styles.prizeInputHeader}>
                    <Text style={styles.prizePosition}>🥉 3er Lugar</Text>
                  </View>
                  <View style={styles.prizeInputRow}>
                    <TextInput
                      style={styles.prizeInput}
                      value={editThird}
                      onChangeText={setEditThird}
                      keyboardType="numeric"
                      placeholder="5"
                      placeholderTextColor="#64748b"
                    />
                    <Text style={styles.multiplierSuffix}>x</Text>
                  </View>
                </View>
              </View>

              <View style={styles.exampleBox}>
                <Text style={styles.exampleTitle}>Ejemplo de Premio:</Text>
                <Text style={styles.exampleText}>
                  Apuesta: RD$ 100 × {editFirst || 70}x = RD$ {(100 * (parseFloat(editFirst) || 70)).toLocaleString()}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.saveButton, saving && styles.buttonDisabled]}
                onPress={handleSavePrizeTiers}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="save" size={20} color="#ffffff" />
                    <Text style={styles.saveButtonText}>Guardar Multiplicadores</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
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
  content: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ef4444',
    marginTop: 16,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 8,
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#1e293b',
    margin: 12,
    borderRadius: 12,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 10,
  },
  sectionDescription: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 16,
    lineHeight: 18,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencyPrefix: {
    fontSize: 16,
    fontWeight: '600',
    color: '#22c55e',
    marginRight: 10,
    width: 50,
  },
  input: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#ffffff',
  },
  fullInput: {
    flex: 1,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    padding: 14,
    borderRadius: 10,
    marginTop: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  lotteryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  lotteryCardInactive: {
    opacity: 0.5,
  },
  lotteryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  lotteryFlag: {
    fontSize: 24,
    marginRight: 12,
  },
  lotteryDetails: {},
  lotteryName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  lotteryType: {
    fontSize: 12,
    color: '#64748b',
    textTransform: 'capitalize',
  },
  lotteryPrizes: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  prizeItem: {
    alignItems: 'center',
    marginRight: 12,
  },
  prizeLabel: {
    fontSize: 10,
    color: '#64748b',
  },
  prizeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f59e0b',
  },
  bottomSpacer: {
    height: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
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
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    flex: 1,
  },
  modalBody: {
    padding: 16,
  },
  modalDescription: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 16,
    lineHeight: 18,
  },
  prizeInputGroup: {
    gap: 12,
  },
  prizeInputItem: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
  },
  prizeInputHeader: {
    marginBottom: 8,
  },
  prizePosition: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  prizeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  prizeInput: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 10,
    fontSize: 18,
    fontWeight: '600',
    color: '#f59e0b',
    textAlign: 'center',
  },
  multiplierSuffix: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f59e0b',
    marginLeft: 8,
  },
  exampleBox: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
    marginBottom: 16,
  },
  exampleTitle: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  exampleText: {
    fontSize: 14,
    color: '#22c55e',
    fontWeight: '500',
  },
});

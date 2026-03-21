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
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface PlayTypeConfig {
  name: string;
  numbers_count: number;
  multipliers: {
    first: number;
    second: number;
    third: number;
  };
  enabled: boolean;
}

interface Lottery {
  id: string;
  name: string;
  country: string;
  play_types?: { [key: string]: PlayTypeConfig };
}

interface EditingPlayType {
  lotteryId: string;
  lotteryName: string;
  playTypeKey: string;
  playType: PlayTypeConfig;
}

export default function PlayTypesAdmin() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [lotteries, setLotteries] = useState<Lottery[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingPlayType, setEditingPlayType] = useState<EditingPlayType | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Edit form state
  const [firstPrize, setFirstPrize] = useState('');
  const [secondPrize, setSecondPrize] = useState('');
  const [thirdPrize, setThirdPrize] = useState('');
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    // Wait for auth context to be ready
    if (!token) {
      return;
    }
    
    if (user?.role !== 'super_admin') {
      Alert.alert('Acceso Denegado', 'Solo Super Admin puede acceder a esta pantalla');
      router.back();
      return;
    }
    fetchLotteries();
  }, [token, user]);

  const fetchLotteries = async () => {
    if (!token) return;
    
    try {
      const response = await fetch(`${API_URL}/api/lotteries?active_only=false`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setLotteries(data);
      } else {
        console.error('Failed to fetch lotteries:', response.status);
      }
    } catch (error) {
      console.error('Error fetching lotteries:', error);
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (lottery: Lottery, playTypeKey: string, playType: PlayTypeConfig) => {
    setEditingPlayType({
      lotteryId: lottery.id,
      lotteryName: lottery.name,
      playTypeKey,
      playType,
    });
    setFirstPrize(playType.multipliers.first.toString());
    setSecondPrize(playType.multipliers.second.toString());
    setThirdPrize(playType.multipliers.third.toString());
    setEnabled(playType.enabled);
    setShowEditModal(true);
  };

  const handleSavePlayType = async () => {
    if (!editingPlayType) return;
    
    const first = parseFloat(firstPrize);
    const second = parseFloat(secondPrize);
    const third = parseFloat(thirdPrize);
    
    if (isNaN(first) || isNaN(second) || isNaN(third)) {
      Alert.alert('Error', 'Ingresa valores numéricos válidos para los multiplicadores');
      return;
    }
    
    if (first <= 0 || second <= 0 || third <= 0) {
      Alert.alert('Error', 'Los multiplicadores deben ser mayores a 0');
      return;
    }
    
    setSaving(true);
    try {
      const response = await fetch(
        `${API_URL}/api/lotteries/${editingPlayType.lotteryId}/play-types/${editingPlayType.playTypeKey}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            multipliers: {
              first,
              second,
              third,
            },
            enabled,
          }),
        }
      );
      
      if (response.ok) {
        Alert.alert('Éxito', 'Tipo de jugada actualizado correctamente');
        setShowEditModal(false);
        fetchLotteries();
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

  const getPlayTypeName = (key: string) => {
    const names: { [key: string]: string } = {
      quiniela: 'Quiniela',
      pale: 'Pale',
      tripleta: 'Tripleta',
      super_pale: 'Super Pale',
    };
    return names[key] || key;
  };

  const renderLottery = (lottery: Lottery) => {
    const playTypes = lottery.play_types || {};
    
    return (
      <View key={lottery.id} style={styles.lotteryCard}>
        <View style={styles.lotteryHeader}>
          <Text style={styles.lotteryName}>{lottery.name}</Text>
          <Text style={styles.lotteryCountry}>{lottery.country}</Text>
        </View>
        
        <View style={styles.playTypesContainer}>
          {Object.entries(playTypes).map(([key, playType]) => (
            <TouchableOpacity
              key={key}
              style={[styles.playTypeCard, !playType.enabled && styles.playTypeDisabled]}
              onPress={() => openEditModal(lottery, key, playType)}
            >
              <View style={styles.playTypeHeader}>
                <Text style={styles.playTypeName}>{getPlayTypeName(key)}</Text>
                <View style={[styles.statusBadge, playType.enabled ? styles.statusEnabled : styles.statusDisabled]}>
                  <Text style={styles.statusText}>{playType.enabled ? 'ON' : 'OFF'}</Text>
                </View>
              </View>
              
              <Text style={styles.numbersCount}>{playType.numbers_count} número(s)</Text>
              
              <View style={styles.multipliersGrid}>
                <View style={styles.multiplierItem}>
                  <Text style={styles.multiplierLabel}>1ro</Text>
                  <Text style={styles.multiplierValue}>x{playType.multipliers.first}</Text>
                </View>
                <View style={styles.multiplierItem}>
                  <Text style={styles.multiplierLabel}>2do</Text>
                  <Text style={styles.multiplierValue}>x{playType.multipliers.second}</Text>
                </View>
                <View style={styles.multiplierItem}>
                  <Text style={styles.multiplierLabel}>3ro</Text>
                  <Text style={styles.multiplierValue}>x{playType.multipliers.third}</Text>
                </View>
              </View>
              
              <View style={styles.editHint}>
                <Ionicons name="pencil" size={14} color="#64748b" />
                <Text style={styles.editHintText}>Toca para editar</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#22c55e" />
          <Text style={styles.loadingText}>Cargando loterías...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tipos de Jugada</Text>
        <View style={{ width: 40 }} />
      </View>
      
      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Ionicons name="information-circle" size={20} color="#3b82f6" />
        <Text style={styles.infoText}>
          Edita los multiplicadores de premios para cada tipo de jugada por lotería
        </Text>
      </View>
      
      {/* Lotteries List */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {lotteries.map(renderLottery)}
      </ScrollView>
      
      {/* Edit Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar Tipo de Jugada</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            
            {editingPlayType && (
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={styles.modalInfo}>
                  <Text style={styles.modalLotteryName}>{editingPlayType.lotteryName}</Text>
                  <Text style={styles.modalPlayType}>{getPlayTypeName(editingPlayType.playTypeKey)}</Text>
                  <Text style={styles.modalNumbers}>
                    {editingPlayType.playType.numbers_count} número(s) a seleccionar
                  </Text>
                </View>
                
                <View style={styles.formSection}>
                  <Text style={styles.sectionTitle}>Multiplicadores de Premio</Text>
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>1er Premio (x)</Text>
                    <TextInput
                      style={styles.input}
                      value={firstPrize}
                      onChangeText={setFirstPrize}
                      keyboardType="numeric"
                      placeholder="Ej: 70"
                      placeholderTextColor="#64748b"
                    />
                  </View>
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>2do Premio (x)</Text>
                    <TextInput
                      style={styles.input}
                      value={secondPrize}
                      onChangeText={setSecondPrize}
                      keyboardType="numeric"
                      placeholder="Ej: 20"
                      placeholderTextColor="#64748b"
                    />
                  </View>
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>3er Premio (x)</Text>
                    <TextInput
                      style={styles.input}
                      value={thirdPrize}
                      onChangeText={setThirdPrize}
                      keyboardType="numeric"
                      placeholder="Ej: 10"
                      placeholderTextColor="#64748b"
                    />
                  </View>
                </View>
                
                <View style={styles.formSection}>
                  <Text style={styles.sectionTitle}>Estado</Text>
                  <TouchableOpacity
                    style={styles.toggleContainer}
                    onPress={() => setEnabled(!enabled)}
                  >
                    <View style={[styles.toggle, enabled && styles.toggleEnabled]}>
                      <View style={[styles.toggleKnob, enabled && styles.toggleKnobEnabled]} />
                    </View>
                    <Text style={styles.toggleLabel}>
                      {enabled ? 'Habilitado' : 'Deshabilitado'}
                    </Text>
                  </TouchableOpacity>
                </View>
                
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setShowEditModal(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancelar</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                    onPress={handleSavePlayType}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.saveButtonText}>Guardar</Text>
                    )}
                  </TouchableOpacity>
                </View>
                
                <View style={{ height: 20 }} />
              </ScrollView>
            )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e3a5f',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  infoText: {
    flex: 1,
    color: '#93c5fd',
    fontSize: 13,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  lotteryCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  lotteryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#334155',
  },
  lotteryName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  lotteryCountry: {
    fontSize: 12,
    color: '#94a3b8',
    backgroundColor: '#475569',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  playTypesContainer: {
    padding: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  playTypeCard: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    width: '48%',
    borderWidth: 1,
    borderColor: '#334155',
  },
  playTypeDisabled: {
    opacity: 0.5,
  },
  playTypeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  playTypeName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusEnabled: {
    backgroundColor: '#22c55e',
  },
  statusDisabled: {
    backgroundColor: '#ef4444',
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  numbersCount: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 8,
  },
  multipliersGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  multiplierItem: {
    alignItems: 'center',
  },
  multiplierLabel: {
    fontSize: 10,
    color: '#64748b',
  },
  multiplierValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#22c55e',
  },
  editHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  editHintText: {
    fontSize: 11,
    color: '#64748b',
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
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  modalInfo: {
    backgroundColor: '#0f172a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  modalLotteryName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  modalPlayType: {
    fontSize: 20,
    fontWeight: '800',
    color: '#22c55e',
    marginTop: 4,
  },
  modalNumbers: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  formSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 12,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#fff',
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggle: {
    width: 50,
    height: 28,
    backgroundColor: '#475569',
    borderRadius: 14,
    padding: 2,
  },
  toggleEnabled: {
    backgroundColor: '#22c55e',
  },
  toggleKnob: {
    width: 24,
    height: 24,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  toggleKnobEnabled: {
    marginLeft: 22,
  },
  toggleLabel: {
    fontSize: 14,
    color: '#fff',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#475569',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#22c55e',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

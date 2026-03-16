import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Goal {
  id: string;
  seller_id: string;
  seller_name: string;
  goal_type: string;
  target_amount: number;
  current_amount: number;
  progress_percentage: number;
  is_achieved: boolean;
  is_active: boolean;
}

interface Seller {
  id: string;
  name: string;
  email: string;
}

export default function SalesGoalsScreen() {
  const router = useRouter();
  const { token, user } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [goals, setGoals] = useState<Goal[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  
  // Form state
  const [selectedSeller, setSelectedSeller] = useState('');
  const [selectedType, setSelectedType] = useState('daily');
  const [targetAmount, setTargetAmount] = useState('');
  const [showSellerPicker, setShowSellerPicker] = useState(false);

  const goalTypes = [
    { id: 'daily', label: 'Diaria', icon: 'today' },
    { id: 'weekly', label: 'Semanal', icon: 'calendar' },
    { id: 'monthly', label: 'Mensual', icon: 'calendar-outline' },
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch goals
      const goalsRes = await fetch(`${API_URL}/api/goals`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (goalsRes.ok) {
        const data = await goalsRes.json();
        setGoals(data.goals || []);
      }

      // Fetch sellers
      const sellersRes = await fetch(`${API_URL}/api/users?role=vendedor`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (sellersRes.ok) {
        const data = await sellersRes.json();
        setSellers(data.users || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCreateGoal = async () => {
    if (!selectedSeller || !targetAmount) {
      alert('Selecciona un vendedor y define el monto');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/goals`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          seller_id: selectedSeller,
          goal_type: selectedType,
          target_amount: parseFloat(targetAmount),
        }),
      });

      if (res.ok) {
        setModalVisible(false);
        setSelectedSeller('');
        setTargetAmount('');
        fetchData();
      } else {
        const error = await res.json();
        alert(error.detail || 'Error al crear meta');
      }
    } catch (error) {
      console.error('Error creating goal:', error);
      alert('Error de conexión');
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/goals/${goalId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Error deleting goal:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return `RD$ ${amount.toLocaleString('es-DO', { minimumFractionDigits: 0 })}`;
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return '#22c55e';
    if (percentage >= 75) return '#84cc16';
    if (percentage >= 50) return '#f59e0b';
    if (percentage >= 25) return '#f97316';
    return '#ef4444';
  };

  const getTypeLabel = (type: string) => {
    const found = goalTypes.find(t => t.id === type);
    return found ? found.label : type;
  };

  const renderGoalCard = (goal: Goal) => (
    <View key={goal.id} style={[styles.goalCard, goal.is_achieved && styles.goalCardAchieved]}>
      <View style={styles.goalHeader}>
        <View style={styles.goalInfo}>
          <Text style={styles.sellerName}>{goal.seller_name}</Text>
          <View style={styles.typeBadge}>
            <Text style={styles.typeText}>{getTypeLabel(goal.goal_type)}</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => handleDeleteGoal(goal.id)}
          style={styles.deleteButton}
          data-testid={`delete-goal-${goal.id}`}
        >
          <Ionicons name="trash-outline" size={18} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <View style={styles.progressSection}>
        <View style={styles.amountsRow}>
          <Text style={styles.currentAmount}>{formatCurrency(goal.current_amount)}</Text>
          <Text style={styles.targetAmount}>de {formatCurrency(goal.target_amount)}</Text>
        </View>
        
        <View style={styles.progressBarContainer}>
          <View 
            style={[
              styles.progressBar, 
              { 
                width: `${Math.min(100, goal.progress_percentage)}%`,
                backgroundColor: getProgressColor(goal.progress_percentage)
              }
            ]} 
          />
        </View>
        
        <View style={styles.progressFooter}>
          <Text style={[styles.percentageText, { color: getProgressColor(goal.progress_percentage) }]}>
            {goal.progress_percentage.toFixed(1)}%
          </Text>
          {goal.is_achieved && (
            <View style={styles.achievedBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
              <Text style={styles.achievedText}>¡Meta alcanzada!</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );

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
        <Text style={styles.headerTitle}>Metas de Ventas</Text>
        <TouchableOpacity 
          onPress={() => setModalVisible(true)} 
          style={styles.addButton}
          data-testid="add-goal-button"
        >
          <Ionicons name="add" size={24} color="#22c55e" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.scrollContent, isDesktop && styles.scrollContentDesktop]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor="#22c55e" />
        }
      >
        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{goals.length}</Text>
            <Text style={styles.summaryLabel}>Metas Activas</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: '#22c55e' }]}>
              {goals.filter(g => g.is_achieved).length}
            </Text>
            <Text style={styles.summaryLabel}>Alcanzadas</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: '#f59e0b' }]}>
              {goals.filter(g => !g.is_achieved).length}
            </Text>
            <Text style={styles.summaryLabel}>Pendientes</Text>
          </View>
        </View>

        {/* Goals List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Metas por Vendedor</Text>
          
          {goals.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="flag-outline" size={48} color="#64748b" />
              <Text style={styles.emptyText}>No hay metas configuradas</Text>
              <Text style={styles.emptySubtext}>Toca + para agregar una meta</Text>
            </View>
          ) : (
            <View style={[styles.goalsGrid, isDesktop && styles.goalsGridDesktop]}>
              {goals.map(renderGoalCard)}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Create Goal Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDesktop && styles.modalContentDesktop]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nueva Meta de Ventas</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {/* Seller Selection */}
            <Text style={styles.inputLabel}>Vendedor</Text>
            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => setShowSellerPicker(!showSellerPicker)}
              data-testid="seller-select"
            >
              <Text style={styles.selectButtonText}>
                {selectedSeller 
                  ? sellers.find(s => s.id === selectedSeller)?.name || 'Seleccionar'
                  : 'Seleccionar vendedor'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#94a3b8" />
            </TouchableOpacity>

            {showSellerPicker && (
              <View style={styles.pickerContainer}>
                <ScrollView style={styles.pickerScroll} nestedScrollEnabled>
                  {sellers.map(seller => (
                    <TouchableOpacity
                      key={seller.id}
                      style={[
                        styles.pickerItem,
                        selectedSeller === seller.id && styles.pickerItemSelected
                      ]}
                      onPress={() => {
                        setSelectedSeller(seller.id);
                        setShowSellerPicker(false);
                      }}
                    >
                      <Text style={styles.pickerItemText}>{seller.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Goal Type */}
            <Text style={styles.inputLabel}>Tipo de Meta</Text>
            <View style={styles.typeSelector}>
              {goalTypes.map(type => (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.typeButton,
                    selectedType === type.id && styles.typeButtonActive
                  ]}
                  onPress={() => setSelectedType(type.id)}
                  data-testid={`type-${type.id}`}
                >
                  <Ionicons 
                    name={type.icon as any} 
                    size={18} 
                    color={selectedType === type.id ? '#22c55e' : '#64748b'} 
                  />
                  <Text style={[
                    styles.typeButtonText,
                    selectedType === type.id && styles.typeButtonTextActive
                  ]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Target Amount */}
            <Text style={styles.inputLabel}>Monto Objetivo (RD$)</Text>
            <TextInput
              style={styles.input}
              value={targetAmount}
              onChangeText={setTargetAmount}
              placeholder="Ej: 50000"
              placeholderTextColor="#64748b"
              keyboardType="numeric"
              data-testid="target-amount-input"
            />

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleCreateGoal}
                data-testid="save-goal-button"
              >
                <Text style={styles.saveButtonText}>Crear Meta</Text>
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
  loader: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  addButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  scrollContentDesktop: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  goalsGrid: {
    gap: 12,
  },
  goalsGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  goalCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  goalCardAchieved: {
    borderLeftColor: '#22c55e',
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  goalInfo: {
    flex: 1,
  },
  sellerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  typeBadge: {
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  typeText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },
  deleteButton: {
    padding: 4,
  },
  progressSection: {
    gap: 8,
  },
  amountsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  currentAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  targetAmount: {
    fontSize: 14,
    color: '#64748b',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#334155',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  progressFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  percentageText: {
    fontSize: 14,
    fontWeight: '600',
  },
  achievedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  achievedText: {
    fontSize: 12,
    color: '#22c55e',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#1e293b',
    borderRadius: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#94a3b8',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalContentDesktop: {
    maxWidth: 500,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  inputLabel: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 8,
    marginTop: 12,
  },
  selectButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#334155',
    borderRadius: 8,
    padding: 12,
  },
  selectButtonText: {
    color: '#ffffff',
    fontSize: 15,
  },
  pickerContainer: {
    backgroundColor: '#334155',
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 200,
  },
  pickerScroll: {
    padding: 4,
  },
  pickerItem: {
    padding: 12,
    borderRadius: 6,
  },
  pickerItemSelected: {
    backgroundColor: '#475569',
  },
  pickerItemText: {
    color: '#ffffff',
    fontSize: 14,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#334155',
    padding: 12,
    borderRadius: 8,
  },
  typeButtonActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  typeButtonText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '500',
  },
  typeButtonTextActive: {
    color: '#22c55e',
  },
  input: {
    backgroundColor: '#334155',
    borderRadius: 8,
    padding: 12,
    color: '#ffffff',
    fontSize: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#334155',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#94a3b8',
    fontSize: 15,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#22c55e',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
});

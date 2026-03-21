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
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const { width } = Dimensions.get('window');
const isDesktop = width > 768;

interface FavoritePlay {
  lottery_id?: string;
  lottery_type?: string;
  numbers: number[];
  amount?: number;
}

interface Favorite {
  id: string;
  name: string;
  lottery_id?: string;
  numbers?: number[];
  plays?: FavoritePlay[];
  use_count: number;
  created_at: string;
  currency?: string;
}

interface Lottery {
  id: string;
  name: string;
  numbers_to_pick: number;
}

export default function Favorites() {
  const { token } = useAuth();
  const router = useRouter();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [lotteries, setLotteries] = useState<Lottery[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNumbers, setNewNumbers] = useState('');
  const [selectedLotteryId, setSelectedLotteryId] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchFavorites = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/api/favorites`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setFavorites(data);
      }
    } catch (error) {
      console.error('Error fetching favorites:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchLotteries = async () => {
    try {
      const response = await fetch(`${API_URL}/api/lotteries`);
      if (response.ok) {
        const data = await response.json();
        setLotteries(data);
        if (data.length > 0) {
          setSelectedLotteryId(data[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching lotteries:', error);
    }
  };

  useEffect(() => {
    fetchFavorites();
    fetchLotteries();
  }, [fetchFavorites]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchFavorites();
    setRefreshing(false);
  };

  const handleAddFavorite = async () => {
    if (!newName.trim()) {
      Alert.alert('Error', 'Ingresa un nombre para el favorito');
      return;
    }

    const numbersArray = newNumbers.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
    
    const selectedLottery = lotteries.find(l => l.id === selectedLotteryId);
    if (selectedLottery && numbersArray.length !== selectedLottery.numbers_to_pick) {
      Alert.alert('Error', `Debe ingresar ${selectedLottery.numbers_to_pick} números separados por coma`);
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/favorites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newName,
          lottery_id: selectedLotteryId,
          numbers: numbersArray,
        }),
      });

      if (response.ok) {
        Alert.alert('Éxito', 'Favorito guardado');
        setShowAddModal(false);
        setNewName('');
        setNewNumbers('');
        fetchFavorites();
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'No se pudo guardar');
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFavorite = async (favoriteId: string) => {
    Alert.alert(
      'Eliminar Favorito',
      '¿Estás seguro?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_URL}/api/favorites/${favoriteId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
              });

              if (response.ok) {
                fetchFavorites();
              }
            } catch (error) {
              Alert.alert('Error', 'No se pudo eliminar');
            }
          },
        },
      ]
    );
  };

  const handleUseFavorite = (favorite: Favorite) => {
    // Navigate to sales with pre-filled numbers
    router.push({
      pathname: '/sales',
      params: {
        lottery_id: favorite.lottery_id,
        numbers: (favorite.numbers || []).join(','),
      },
    });

    // Increment use count
    fetch(`${API_URL}/api/favorites/${favorite.id}/use`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
  };

  const getLotteryName = (lotteryId?: string) => {
    if (!lotteryId) return 'Multi-Lotería';
    const lottery = lotteries.find(l => l.id === lotteryId);
    return lottery?.name || 'Desconocida';
  };

  // Helper to get all numbers from either old format (item.numbers) or new format (item.plays)
  const getAllNumbers = (item: Favorite): number[] => {
    // New format with plays array
    if (item.plays && item.plays.length > 0) {
      const allNumbers: number[] = [];
      item.plays.forEach(play => {
        if (play.numbers) {
          allNumbers.push(...play.numbers);
        }
      });
      return allNumbers;
    }
    // Old format with direct numbers array
    return item.numbers || [];
  };

  const getPlaysSummary = (item: Favorite): string => {
    if (item.plays && item.plays.length > 0) {
      return `${item.plays.length} jugada(s)`;
    }
    return getLotteryName(item.lottery_id);
  };

  const renderFavorite = ({ item }: { item: Favorite }) => {
    // Safety check for item
    if (!item) {
      return null;
    }
    
    const numbers = getAllNumbers(item);
    
    return (
      <View style={styles.favoriteCard}>
        <View style={styles.favoriteHeader}>
          <View>
            <Text style={styles.favoriteName}>{item.name || 'Sin nombre'}</Text>
            <Text style={styles.favoriteLottery}>{getPlaysSummary(item)}</Text>
          </View>
          <View style={styles.useCountBadge}>
            <Ionicons name="repeat" size={14} color="#94a3b8" />
            <Text style={styles.useCountText}>{item.use_count || 0}</Text>
          </View>
        </View>

        <View style={styles.numbersContainer}>
          {numbers && numbers.length > 0 ? (
            <>
              {numbers.slice(0, 10).map((num, index) => (
                <View key={index} style={styles.numberBall}>
                  <Text style={styles.numberBallText}>{num?.toString().padStart(2, '0') || '00'}</Text>
                </View>
              ))}
              {numbers.length > 10 && (
                <View style={[styles.numberBall, { backgroundColor: '#475569' }]}>
                  <Text style={styles.numberBallText}>+{numbers.length - 10}</Text>
                </View>
              )}
            </>
          ) : (
            <Text style={{ color: '#94a3b8' }}>Sin números</Text>
          )}
        </View>

        <View style={styles.favoriteActions}>
          <TouchableOpacity
            style={styles.useButton}
            onPress={() => handleUseFavorite(item)}
          >
            <Ionicons name="play" size={18} color="#ffffff" />
            <Text style={styles.useButtonText}>Usar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteFavorite(item.id)}
          >
            <Ionicons name="trash" size={18} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mis Favoritos</Text>
        <TouchableOpacity onPress={() => setShowAddModal(true)}>
          <Ionicons name="add-circle" size={28} color="#22c55e" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#22c55e" style={styles.loader} />
      ) : (
        <FlatList
          data={favorites}
          renderItem={renderFavorite}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, isDesktop && styles.listContentDesktop]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="heart-outline" size={64} color="#475569" />
              <Text style={styles.emptyText}>No tienes favoritos</Text>
              <Text style={styles.emptySubtext}>Guarda tus combinaciones favoritas</Text>
            </View>
          }
          numColumns={isDesktop ? 2 : 1}
          key={isDesktop ? 'desktop' : 'mobile'}
        />
      )}

      {/* Add Favorite Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDesktop && styles.modalContentDesktop]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Agregar Favorito</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Nombre</Text>
              <TextInput
                style={styles.input}
                value={newName}
                onChangeText={setNewName}
                placeholder="Ej: Mi suerte"
                placeholderTextColor="#64748b"
              />

              <Text style={styles.inputLabel}>Lotería</Text>
              <View style={styles.lotterySelector}>
                {lotteries.slice(0, 6).map((lottery) => (
                  <TouchableOpacity
                    key={lottery.id}
                    style={[
                      styles.lotteryOption,
                      selectedLotteryId === lottery.id && styles.lotteryOptionSelected,
                    ]}
                    onPress={() => setSelectedLotteryId(lottery.id)}
                  >
                    <Text
                      style={[
                        styles.lotteryOptionText,
                        selectedLotteryId === lottery.id && styles.lotteryOptionTextSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {lottery.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>
                Números (separados por coma)
              </Text>
              <TextInput
                style={styles.input}
                value={newNumbers}
                onChangeText={setNewNumbers}
                placeholder="Ej: 23, 45, 67"
                placeholderTextColor="#64748b"
                keyboardType="numeric"
              />

              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleAddFavorite}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="heart" size={20} color="#ffffff" />
                    <Text style={styles.saveButtonText}>Guardar Favorito</Text>
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
  listContent: {
    padding: 16,
  },
  listContentDesktop: {
    maxWidth: 1000,
    alignSelf: 'center',
    width: '100%',
  },
  favoriteCard: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 4,
  },
  favoriteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  favoriteName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  favoriteLottery: {
    fontSize: 12,
    color: '#22c55e',
    marginTop: 2,
  },
  useCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  useCountText: {
    fontSize: 12,
    color: '#94a3b8',
    marginLeft: 4,
  },
  numbersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  numberBall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginBottom: 8,
  },
  numberBallText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  favoriteActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 12,
  },
  useButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22c55e',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1,
    marginRight: 12,
    justifyContent: 'center',
  },
  useButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    marginLeft: 6,
  },
  deleteButton: {
    padding: 10,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    color: '#64748b',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#475569',
    marginTop: 4,
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
  },
  modalContentDesktop: {
    maxWidth: 500,
    alignSelf: 'center',
    width: '100%',
    borderRadius: 20,
    marginBottom: 40,
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
  lotterySelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  lotteryOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  lotteryOptionSelected: {
    backgroundColor: '#22c55e',
  },
  lotteryOptionText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  lotteryOptionTextSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    height: 52,
    borderRadius: 12,
    marginTop: 24,
    marginBottom: 16,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

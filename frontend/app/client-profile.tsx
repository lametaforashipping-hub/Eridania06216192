import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface ClientProfile {
  id: string;
  name: string;
  phone: string;
  email?: string;
  country: string;
  balance: number;
  total_plays: number;
  total_won: number;
  created_at: string;
}

export default function ClientProfileScreen() {
  const router = useRouter();
  const { token, user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
  });

  const fetchProfile = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/clients/me`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
        setEditForm({
          name: data.name || '',
          email: data.email || '',
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProfile();
    setRefreshing(false);
  };

  const handleLogout = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro que deseas salir?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Salir', 
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/client-login');
          }
        },
      ]
    );
  };

  const saveProfile = async () => {
    if (!editForm.name.trim()) {
      Alert.alert('Error', 'El nombre es obligatorio');
      return;
    }
    
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/clients/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editForm.name,
          email: editForm.email || null,
        }),
      });
      
      if (response.ok) {
        Alert.alert('Éxito', 'Perfil actualizado correctamente');
        setShowEditModal(false);
        fetchProfile();
      } else {
        const data = await response.json();
        Alert.alert('Error', data.detail || 'Error al actualizar');
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-DO', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return `RD$ ${amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mi Perfil</Text>
        <TouchableOpacity onPress={() => setShowEditModal(true)} style={styles.editButton}>
          <Ionicons name="create-outline" size={24} color="#22c55e" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person" size={48} color="#22c55e" />
          </View>
          <Text style={styles.profileName}>{profile?.name}</Text>
          <Text style={styles.profilePhone}>{profile?.phone}</Text>
          {profile?.email && (
            <Text style={styles.profileEmail}>{profile.email}</Text>
          )}
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Ionicons name="game-controller" size={24} color="#3b82f6" />
            <Text style={styles.statValue}>{profile?.total_plays || 0}</Text>
            <Text style={styles.statLabel}>Jugadas</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="trophy" size={24} color="#22c55e" />
            <Text style={[styles.statValue, { color: '#22c55e' }]}>
              {formatCurrency(profile?.total_won || 0)}
            </Text>
            <Text style={styles.statLabel}>Ganado</Text>
          </View>
        </View>

        {/* Profile Details */}
        <View style={styles.detailsSection}>
          <Text style={styles.sectionTitle}>Información de la Cuenta</Text>
          
          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Ionicons name="call" size={18} color="#64748b" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Teléfono</Text>
              <Text style={styles.detailValue}>{profile?.phone}</Text>
            </View>
          </View>
          
          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Ionicons name="mail" size={18} color="#64748b" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Correo electrónico</Text>
              <Text style={styles.detailValue}>{profile?.email || 'No registrado'}</Text>
            </View>
          </View>
          
          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Ionicons name="location" size={18} color="#64748b" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>País</Text>
              <Text style={styles.detailValue}>
                {profile?.country === 'RD' ? 'República Dominicana' : 'Estados Unidos'}
              </Text>
            </View>
          </View>
          
          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Ionicons name="calendar" size={18} color="#64748b" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Miembro desde</Text>
              <Text style={styles.detailValue}>
                {profile?.created_at ? formatDate(profile.created_at) : 'N/A'}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Acciones Rápidas</Text>
          
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => router.push('/client-tickets')}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="ticket" size={20} color="#3b82f6" />
            </View>
            <Text style={styles.actionText}>Mis Jugadas</Text>
            <Ionicons name="chevron-forward" size={20} color="#64748b" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => router.push('/client-results')}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="trophy" size={20} color="#f97316" />
            </View>
            <Text style={styles.actionText}>Ver Resultados</Text>
            <Ionicons name="chevron-forward" size={20} color="#64748b" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => router.push('/client-play')}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="add-circle" size={20} color="#22c55e" />
            </View>
            <Text style={styles.actionText}>Nueva Jugada</Text>
            <Ionicons name="chevron-forward" size={20} color="#64748b" />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={styles.logoutButtonText}>Cerrar Sesión</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar Perfil</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nombre</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.name}
                  onChangeText={(text) => setEditForm({ ...editForm, name: text })}
                  placeholder="Tu nombre"
                  placeholderTextColor="#64748b"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Correo electrónico (opcional)</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.email}
                  onChangeText={(text) => setEditForm({ ...editForm, email: text })}
                  placeholder="tu@correo.com"
                  placeholderTextColor="#64748b"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Teléfono</Text>
                <View style={styles.disabledInput}>
                  <Text style={styles.disabledInputText}>{profile?.phone}</Text>
                  <Text style={styles.disabledInputHint}>No se puede cambiar</Text>
                </View>
              </View>
            </View>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowEditModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={saveProfile}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>Guardar</Text>
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
  loader: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backButton: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  editButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  profilePhone: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 14,
    color: '#64748b',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  detailsSection: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
  actionsSection: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionText: {
    flex: 1,
    fontSize: 15,
    color: '#ffffff',
    fontWeight: '500',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  logoutButtonText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  modalBody: {
    padding: 20,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#ffffff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  disabledInput: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#334155',
    opacity: 0.6,
  },
  disabledInputText: {
    color: '#64748b',
    fontSize: 16,
  },
  disabledInputHint: {
    color: '#475569',
    fontSize: 11,
    marginTop: 4,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#22c55e',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});

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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  credit_limit: number;
  balance: number;
  currency: string;
  active: boolean;
  created_at: string;
  commission_rate?: number;
  phone?: string;
  address?: string;
  cedula?: string;
}

export default function Users() {
  const { token, user: currentUser } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [creating, setCreating] = useState(false);

  // Form states
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('vendedor');
  const [newCreditLimit, setNewCreditLimit] = useState('10000');
  const [newCommissionRate, setNewCommissionRate] = useState('10');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newCedula, setNewCedula] = useState('');
  const [depositAmount, setDepositAmount] = useState('');

  const fetchUsers = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/api/users`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUsers();
    setRefreshing(false);
  };

  const handleCreateUser = async () => {
    if (!newEmail || !newPassword || !newName) {
      Alert.alert('Error', 'Completa todos los campos obligatorios');
      return;
    }

    setCreating(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: newEmail,
          password: newPassword,
          name: newName,
          role: newRole,
          credit_limit: parseFloat(newCreditLimit),
          commission_rate: parseFloat(newCommissionRate),
          currency: 'RD$',
          phone: newPhone || null,
          address: newAddress || null,
          cedula: newCedula || null,
        }),
      });

      if (response.ok) {
        Alert.alert('Éxito', 'Usuario creado correctamente');
        setShowCreateModal(false);
        resetForm();
        fetchUsers();
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'No se pudo crear el usuario');
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setCreating(false);
    }
  };

  const handleDeposit = async () => {
    if (!selectedUser || !depositAmount) return;

    try {
      const response = await fetch(
        `${API_URL}/api/users/${selectedUser.id}/deposit?amount=${parseFloat(depositAmount)}`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        Alert.alert('Éxito', `Nuevo balance: ${selectedUser.currency} ${data.new_balance.toLocaleString()}`);
        setShowDepositModal(false);
        setDepositAmount('');
        fetchUsers();
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'No se pudo realizar el depósito');
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión');
    }
  };

  const toggleUserStatus = async (user: User) => {
    try {
      const response = await fetch(`${API_URL}/api/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ active: !user.active }),
      });

      if (response.ok) {
        fetchUsers();
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión');
    }
  };

  const resetForm = () => {
    setNewEmail('');
    setNewPassword('');
    setNewName('');
    setNewRole('vendedor');
    setNewCreditLimit('10000');
    setNewCommissionRate('10');
    setNewPhone('');
    setNewAddress('');
    setNewCedula('');
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'super_admin': return 'Super Admin';
      case 'admin': return 'Admin';
      case 'vendedor': return 'Vendedor';
      default: return role;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'super_admin': return '#ef4444';
      case 'admin': return '#f59e0b';
      case 'vendedor': return '#22c55e';
      default: return '#94a3b8';
    }
  };

  const renderUser = ({ item }: { item: User }) => (
    <View style={[styles.userCard, !item.active && styles.userCardInactive]}>
      <View style={styles.userHeader}>
        <View style={styles.userAvatar}>
          <Text style={styles.userAvatarText}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.name}</Text>
          <Text style={styles.userEmail}>{item.email}</Text>
          <View style={[styles.roleBadge, { backgroundColor: getRoleColor(item.role) + '30' }]}>
            <Text style={[styles.roleText, { color: getRoleColor(item.role) }]}>
              {getRoleLabel(item.role)}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.statusToggle, item.active ? styles.statusActive : styles.statusInactive]}
          onPress={() => toggleUserStatus(item)}
        >
          <Text style={styles.statusText}>{item.active ? 'Activo' : 'Inactivo'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.userDetails}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Límite de Crédito</Text>
          <Text style={styles.detailValue}>
            {item.currency} {item.credit_limit.toLocaleString()}
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Balance</Text>
          <Text style={[styles.detailValue, styles.balanceValue]}>
            {item.currency} {item.balance.toLocaleString()}
          </Text>
        </View>
      </View>

      <View style={styles.userActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            setSelectedUser(item);
            setShowDepositModal(true);
          }}
        >
          <Ionicons name="wallet" size={18} color="#22c55e" />
          <Text style={styles.actionText}>Depositar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const availableRoles = currentUser?.role === 'super_admin' 
    ? ['admin', 'vendedor'] 
    : ['vendedor'];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Usuarios</Text>
        <TouchableOpacity onPress={() => setShowCreateModal(true)}>
          <Ionicons name="add-circle" size={28} color="#22c55e" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#22c55e" style={styles.loader} />
      ) : (
        <FlatList
          data={users}
          renderItem={renderUser}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={64} color="#475569" />
              <Text style={styles.emptyText}>No hay usuarios</Text>
            </View>
          }
        />
      )}

      {/* Create User Modal */}
      <Modal visible={showCreateModal} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Crear Usuario</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Nombre</Text>
              <TextInput
                style={styles.input}
                value={newName}
                onChangeText={setNewName}
                placeholder="Nombre completo"
                placeholderTextColor="#64748b"
              />

              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={styles.input}
                value={newEmail}
                onChangeText={setNewEmail}
                placeholder="correo@ejemplo.com"
                placeholderTextColor="#64748b"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>Contraseña</Text>
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Contraseña"
                placeholderTextColor="#64748b"
                secureTextEntry
              />

              <Text style={styles.inputLabel}>Rol</Text>
              <View style={styles.roleSelector}>
                {availableRoles.map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={[styles.roleOption, newRole === role && styles.roleOptionSelected]}
                    onPress={() => setNewRole(role)}
                  >
                    <Text style={[styles.roleOptionText, newRole === role && styles.roleOptionTextSelected]}>
                      {getRoleLabel(role)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Límite de Crédito (RD$)</Text>
              <TextInput
                style={styles.input}
                value={newCreditLimit}
                onChangeText={setNewCreditLimit}
                placeholder="10000"
                placeholderTextColor="#64748b"
                keyboardType="numeric"
              />

              <TouchableOpacity
                style={[styles.submitButton, creating && styles.submitButtonDisabled]}
                onPress={handleCreateUser}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitButtonText}>Crear Usuario</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Deposit Modal */}
      <Modal visible={showDepositModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.depositModal]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Depositar a {selectedUser?.name}</Text>
              <TouchableOpacity onPress={() => setShowDepositModal(false)}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Monto ({selectedUser?.currency})</Text>
              <TextInput
                style={styles.input}
                value={depositAmount}
                onChangeText={setDepositAmount}
                placeholder="0.00"
                placeholderTextColor="#64748b"
                keyboardType="numeric"
              />
              <TouchableOpacity style={styles.submitButton} onPress={handleDeposit}>
                <Text style={styles.submitButtonText}>Confirmar Depósito</Text>
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
  userCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  userCardInactive: {
    opacity: 0.6,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  userEmail: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 4,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusToggle: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusActive: {
    backgroundColor: '#14532d',
  },
  statusInactive: {
    backgroundColor: '#7f1d1d',
  },
  statusText: {
    fontSize: 11,
    color: '#ffffff',
    fontWeight: '500',
  },
  userDetails: {
    flexDirection: 'row',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  detailItem: {
    flex: 1,
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
  balanceValue: {
    color: '#22c55e',
  },
  userActions: {
    flexDirection: 'row',
    marginTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  actionText: {
    fontSize: 13,
    color: '#22c55e',
    marginLeft: 6,
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
    maxHeight: '80%',
  },
  depositModal: {
    maxHeight: '40%',
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
  roleSelector: {
    flexDirection: 'row',
  },
  roleOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    marginRight: 8,
  },
  roleOptionSelected: {
    backgroundColor: '#22c55e',
  },
  roleOptionText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  roleOptionTextSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#22c55e',
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 16,
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

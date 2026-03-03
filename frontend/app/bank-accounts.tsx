import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { useNotificationAlert } from '../src/hooks/useNotificationAlert';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface BankAccount {
  id: string;
  name: string;
  account_type: string;
  currency: string;
  country: string;
  bank_name?: string;
  account_number?: string;
  zelle_email?: string;
  zelle_phone?: string;
  balance: number;
  notes?: string;
  active: boolean;
  created_at: string;
}

interface DepositRequest {
  id: string;
  bank_account_name: string;
  user_name: string;
  amount: number;
  currency: string;
  deposit_method: string;
  reference_number?: string;
  notes?: string;
  status: string;
  created_at: string;
}

export default function BankAccounts() {
  const { token, user } = useAuth();
  const router = useRouter();
  const { alertDepositApproved } = useNotificationAlert();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [pendingDeposits, setPendingDeposits] = useState<DepositRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [selectedDeposit, setSelectedDeposit] = useState<DepositRequest | null>(null);
  const [activeTab, setActiveTab] = useState<'accounts' | 'deposits'>('accounts');
  
  // Form states
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('bank');
  const [formCurrency, setFormCurrency] = useState('RD$');
  const [formCountry, setFormCountry] = useState('RD');
  const [formBankName, setFormBankName] = useState('');
  const [formAccountNumber, setFormAccountNumber] = useState('');
  const [formZelleEmail, setFormZelleEmail] = useState('');
  const [formZellePhone, setFormZellePhone] = useState('');
  const [formInitialBalance, setFormInitialBalance] = useState('0');
  const [formNotes, setFormNotes] = useState('');
  const [creating, setCreating] = useState(false);

  const isSuperAdmin = user?.role === 'super_admin';

  const fetchData = useCallback(async () => {
    try {
      const [accountsRes, depositsRes] = await Promise.all([
        fetch(`${API_URL}/api/bank-accounts`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_URL}/api/bank-accounts/deposit-requests?status=pending`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (accountsRes.ok) {
        const accountsData = await accountsRes.json();
        setAccounts(accountsData);
      }

      if (depositsRes.ok) {
        const depositsData = await depositsRes.json();
        setPendingDeposits(depositsData);
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

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const createAccount = async () => {
    if (!formName.trim()) {
      Alert.alert('Error', 'El nombre de la cuenta es requerido');
      return;
    }

    setCreating(true);
    try {
      const response = await fetch(`${API_URL}/api/bank-accounts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formName,
          account_type: formType,
          currency: formCurrency,
          country: formCountry,
          bank_name: formBankName || null,
          account_number: formAccountNumber || null,
          zelle_email: formZelleEmail || null,
          zelle_phone: formZellePhone || null,
          initial_balance: parseFloat(formInitialBalance) || 0,
          notes: formNotes || null
        })
      });

      if (response.ok) {
        Alert.alert('Éxito', 'Cuenta bancaria creada exitosamente');
        setShowCreateModal(false);
        resetForm();
        fetchData();
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'No se pudo crear la cuenta');
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setCreating(false);
    }
  };

  const processDeposit = async (approved: boolean) => {
    if (!selectedDeposit) return;

    try {
      const response = await fetch(`${API_URL}/api/bank-accounts/deposit-requests/${selectedDeposit.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ approved })
      });

      if (response.ok) {
        // Play success feedback when deposit is approved
        if (approved) {
          alertDepositApproved();
        }
        Alert.alert('Éxito', `Depósito ${approved ? 'aprobado' : 'rechazado'}`);
        setShowDepositModal(false);
        setSelectedDeposit(null);
        fetchData();
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'Error al procesar');
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión');
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormType('bank');
    setFormCurrency('RD$');
    setFormCountry('RD');
    setFormBankName('');
    setFormAccountNumber('');
    setFormZelleEmail('');
    setFormZellePhone('');
    setFormInitialBalance('0');
    setFormNotes('');
  };

  const getAccountTypeIcon = (type: string) => {
    switch (type) {
      case 'bank': return 'business';
      case 'zelle': return 'flash';
      case 'cash': return 'cash';
      default: return 'wallet';
    }
  };

  const getAccountTypeLabel = (type: string) => {
    switch (type) {
      case 'bank': return 'Banco';
      case 'zelle': return 'Zelle';
      case 'cash': return 'Efectivo';
      default: return type;
    }
  };

  const renderAccount = ({ item }: { item: BankAccount }) => (
    <View style={[styles.accountCard, !item.active && styles.accountCardInactive]}>
      <View style={styles.accountHeader}>
        <View style={styles.accountIconContainer}>
          <Ionicons name={getAccountTypeIcon(item.account_type) as any} size={24} color="#22c55e" />
        </View>
        <View style={styles.accountInfo}>
          <Text style={styles.accountName}>{item.name}</Text>
          <View style={styles.accountTags}>
            <View style={[styles.tag, { backgroundColor: item.country === 'USA' ? '#3b82f620' : '#22c55e20' }]}>
              <Text style={[styles.tagText, { color: item.country === 'USA' ? '#3b82f6' : '#22c55e' }]}>
                {item.country}
              </Text>
            </View>
            <View style={[styles.tag, { backgroundColor: '#a855f720' }]}>
              <Text style={[styles.tagText, { color: '#a855f7' }]}>{getAccountTypeLabel(item.account_type)}</Text>
            </View>
          </View>
        </View>
        <View style={styles.balanceContainer}>
          <Text style={styles.balanceLabel}>Balance</Text>
          <Text style={styles.balanceValue}>{item.currency} {item.balance.toLocaleString()}</Text>
        </View>
      </View>
      
      {item.bank_name && (
        <View style={styles.detailRow}>
          <Ionicons name="business-outline" size={14} color="#94a3b8" />
          <Text style={styles.detailText}>{item.bank_name}</Text>
        </View>
      )}
      {item.account_number && (
        <View style={styles.detailRow}>
          <Ionicons name="card-outline" size={14} color="#94a3b8" />
          <Text style={styles.detailText}>****{item.account_number.slice(-4)}</Text>
        </View>
      )}
      {item.zelle_email && (
        <View style={styles.detailRow}>
          <Ionicons name="mail-outline" size={14} color="#94a3b8" />
          <Text style={styles.detailText}>{item.zelle_email}</Text>
        </View>
      )}
      {item.zelle_phone && (
        <View style={styles.detailRow}>
          <Ionicons name="call-outline" size={14} color="#94a3b8" />
          <Text style={styles.detailText}>{item.zelle_phone}</Text>
        </View>
      )}
    </View>
  );

  const renderDeposit = ({ item }: { item: DepositRequest }) => (
    <TouchableOpacity 
      style={styles.depositCard}
      onPress={() => {
        setSelectedDeposit(item);
        setShowDepositModal(true);
      }}
    >
      <View style={styles.depositHeader}>
        <View style={styles.depositInfo}>
          <Text style={styles.depositUser}>{item.user_name}</Text>
          <Text style={styles.depositAccount}>{item.bank_account_name}</Text>
        </View>
        <View style={styles.depositAmount}>
          <Text style={styles.depositAmountValue}>{item.currency} {item.amount.toLocaleString()}</Text>
          <Text style={styles.depositMethod}>{item.deposit_method}</Text>
        </View>
      </View>
      {item.reference_number && (
        <Text style={styles.depositRef}>Ref: {item.reference_number}</Text>
      )}
      <Text style={styles.depositDate}>
        {new Date(item.created_at).toLocaleString('es-DO', {timeZone: 'America/Santo_Domingo'})}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#22c55e" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  const totalRD = accounts.filter(a => a.currency === 'RD$').reduce((sum, a) => sum + a.balance, 0);
  const totalUSD = accounts.filter(a => a.currency === 'USD').reduce((sum, a) => sum + a.balance, 0);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cuentas Bancarias</Text>
        {isSuperAdmin ? (
          <TouchableOpacity onPress={() => setShowCreateModal(true)}>
            <Ionicons name="add-circle" size={28} color="#22c55e" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 28 }} />
        )}
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { borderLeftColor: '#22c55e' }]}>
          <Text style={styles.summaryLabel}>Total RD$</Text>
          <Text style={styles.summaryValue}>RD$ {totalRD.toLocaleString()}</Text>
        </View>
        <View style={[styles.summaryCard, { borderLeftColor: '#3b82f6' }]}>
          <Text style={styles.summaryLabel}>Total USD</Text>
          <Text style={styles.summaryValue}>USD {totalUSD.toLocaleString()}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'accounts' && styles.tabActive]}
          onPress={() => setActiveTab('accounts')}
        >
          <Ionicons name="wallet" size={18} color={activeTab === 'accounts' ? '#22c55e' : '#94a3b8'} />
          <Text style={[styles.tabText, activeTab === 'accounts' && styles.tabTextActive]}>
            Cuentas ({accounts.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'deposits' && styles.tabActive]}
          onPress={() => setActiveTab('deposits')}
        >
          <Ionicons name="time" size={18} color={activeTab === 'deposits' ? '#f59e0b' : '#94a3b8'} />
          <Text style={[styles.tabText, activeTab === 'deposits' && styles.tabTextActive]}>
            Pendientes ({pendingDeposits.length})
          </Text>
          {pendingDeposits.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingDeposits.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === 'accounts' ? (
        <FlatList
          data={accounts}
          renderItem={renderAccount}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="wallet-outline" size={48} color="#475569" />
              <Text style={styles.emptyText}>No hay cuentas bancarias</Text>
              {isSuperAdmin && (
                <TouchableOpacity 
                  style={styles.emptyButton}
                  onPress={() => setShowCreateModal(true)}
                >
                  <Text style={styles.emptyButtonText}>Crear Primera Cuenta</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      ) : (
        <FlatList
          data={pendingDeposits}
          renderItem={renderDeposit}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle-outline" size={48} color="#22c55e" />
              <Text style={styles.emptyText}>No hay depósitos pendientes</Text>
            </View>
          }
        />
      )}

      {/* Create Account Modal */}
      <Modal visible={showCreateModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nueva Cuenta Bancaria</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Nombre de la Cuenta *</Text>
              <TextInput
                style={styles.input}
                value={formName}
                onChangeText={setFormName}
                placeholder="Ej: Cuenta Principal BHD"
                placeholderTextColor="#64748b"
              />

              <Text style={styles.inputLabel}>Tipo de Cuenta</Text>
              <View style={styles.typeSelector}>
                {['bank', 'zelle', 'cash'].map(type => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typeOption, formType === type && styles.typeOptionActive]}
                    onPress={() => setFormType(type)}
                  >
                    <Ionicons 
                      name={getAccountTypeIcon(type) as any} 
                      size={20} 
                      color={formType === type ? '#22c55e' : '#94a3b8'} 
                    />
                    <Text style={[styles.typeText, formType === type && styles.typeTextActive]}>
                      {getAccountTypeLabel(type)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>País</Text>
                  <View style={styles.pickerRow}>
                    <TouchableOpacity
                      style={[styles.pickerOption, formCountry === 'RD' && styles.pickerOptionActive]}
                      onPress={() => { setFormCountry('RD'); setFormCurrency('RD$'); }}
                    >
                      <Text style={[styles.pickerText, formCountry === 'RD' && styles.pickerTextActive]}>🇩🇴 RD</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.pickerOption, formCountry === 'USA' && styles.pickerOptionActive]}
                      onPress={() => { setFormCountry('USA'); setFormCurrency('USD'); }}
                    >
                      <Text style={[styles.pickerText, formCountry === 'USA' && styles.pickerTextActive]}>🇺🇸 USA</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>Moneda</Text>
                  <View style={styles.currencyDisplay}>
                    <Text style={styles.currencyText}>{formCurrency}</Text>
                  </View>
                </View>
              </View>

              {formType === 'bank' && (
                <>
                  <Text style={styles.inputLabel}>Nombre del Banco</Text>
                  <TextInput
                    style={styles.input}
                    value={formBankName}
                    onChangeText={setFormBankName}
                    placeholder="Ej: Banco BHD León"
                    placeholderTextColor="#64748b"
                  />
                  <Text style={styles.inputLabel}>Número de Cuenta</Text>
                  <TextInput
                    style={styles.input}
                    value={formAccountNumber}
                    onChangeText={setFormAccountNumber}
                    placeholder="Ej: 1234567890"
                    placeholderTextColor="#64748b"
                    keyboardType="numeric"
                  />
                </>
              )}

              {formType === 'zelle' && (
                <>
                  <Text style={styles.inputLabel}>Email de Zelle</Text>
                  <TextInput
                    style={styles.input}
                    value={formZelleEmail}
                    onChangeText={setFormZelleEmail}
                    placeholder="correo@ejemplo.com"
                    placeholderTextColor="#64748b"
                    keyboardType="email-address"
                  />
                  <Text style={styles.inputLabel}>Teléfono de Zelle</Text>
                  <TextInput
                    style={styles.input}
                    value={formZellePhone}
                    onChangeText={setFormZellePhone}
                    placeholder="+1 555 123 4567"
                    placeholderTextColor="#64748b"
                    keyboardType="phone-pad"
                  />
                </>
              )}

              <Text style={styles.inputLabel}>Balance Inicial</Text>
              <TextInput
                style={styles.input}
                value={formInitialBalance}
                onChangeText={setFormInitialBalance}
                placeholder="0"
                placeholderTextColor="#64748b"
                keyboardType="numeric"
              />

              <Text style={styles.inputLabel}>Notas</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formNotes}
                onChangeText={setFormNotes}
                placeholder="Notas adicionales..."
                placeholderTextColor="#64748b"
                multiline
                numberOfLines={3}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => { setShowCreateModal(false); resetForm(); }}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.submitButton, creating && styles.buttonDisabled]}
                onPress={createAccount}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.submitButtonText}>Crear Cuenta</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Process Deposit Modal */}
      <Modal visible={showDepositModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Procesar Depósito</Text>
              <TouchableOpacity onPress={() => setShowDepositModal(false)}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {selectedDeposit && (
              <View style={styles.modalBody}>
                <View style={styles.depositDetail}>
                  <Text style={styles.depositDetailLabel}>Vendedor</Text>
                  <Text style={styles.depositDetailValue}>{selectedDeposit.user_name}</Text>
                </View>
                <View style={styles.depositDetail}>
                  <Text style={styles.depositDetailLabel}>Cuenta Destino</Text>
                  <Text style={styles.depositDetailValue}>{selectedDeposit.bank_account_name}</Text>
                </View>
                <View style={styles.depositDetail}>
                  <Text style={styles.depositDetailLabel}>Monto</Text>
                  <Text style={[styles.depositDetailValue, styles.amountHighlight]}>
                    {selectedDeposit.currency} {selectedDeposit.amount.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.depositDetail}>
                  <Text style={styles.depositDetailLabel}>Método</Text>
                  <Text style={styles.depositDetailValue}>{selectedDeposit.deposit_method}</Text>
                </View>
                {selectedDeposit.reference_number && (
                  <View style={styles.depositDetail}>
                    <Text style={styles.depositDetailLabel}>Referencia</Text>
                    <Text style={styles.depositDetailValue}>{selectedDeposit.reference_number}</Text>
                  </View>
                )}
                {selectedDeposit.notes && (
                  <View style={styles.depositDetail}>
                    <Text style={styles.depositDetailLabel}>Notas</Text>
                    <Text style={styles.depositDetailValue}>{selectedDeposit.notes}</Text>
                  </View>
                )}
              </View>
            )}

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={[styles.rejectButton]}
                onPress={() => processDeposit(false)}
              >
                <Ionicons name="close-circle" size={20} color="#ef4444" />
                <Text style={styles.rejectButtonText}>Rechazar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.approveButton]}
                onPress={() => processDeposit(true)}
              >
                <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
                <Text style={styles.approveButtonText}>Aprobar</Text>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  summaryRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#1e293b',
  },
  tabActive: {
    backgroundColor: '#22c55e20',
    borderWidth: 1,
    borderColor: '#22c55e40',
  },
  tabText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  tabTextActive: {
    color: '#22c55e',
    fontWeight: '600',
  },
  badge: {
    backgroundColor: '#f59e0b',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 4,
  },
  badgeText: {
    fontSize: 12,
    color: '#000000',
    fontWeight: '700',
  },
  list: {
    padding: 16,
    gap: 12,
  },
  accountCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  accountCardInactive: {
    opacity: 0.5,
  },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  accountIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#22c55e20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  accountTags: {
    flexDirection: 'row',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  balanceContainer: {
    alignItems: 'flex-end',
  },
  balanceLabel: {
    fontSize: 11,
    color: '#94a3b8',
  },
  balanceValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#22c55e',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  detailText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  depositCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  depositHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  depositInfo: {
    flex: 1,
  },
  depositUser: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  depositAccount: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  depositAmount: {
    alignItems: 'flex-end',
  },
  depositAmountValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f59e0b',
  },
  depositMethod: {
    fontSize: 12,
    color: '#94a3b8',
    textTransform: 'capitalize',
  },
  depositRef: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 8,
  },
  depositDate: {
    fontSize: 11,
    color: '#475569',
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 12,
  },
  emptyButton: {
    marginTop: 16,
    backgroundColor: '#22c55e',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
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
    fontWeight: '600',
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
  inputLabel: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    color: '#ffffff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#334155',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  typeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  typeOptionActive: {
    borderColor: '#22c55e',
    backgroundColor: '#22c55e10',
  },
  typeText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  typeTextActive: {
    color: '#22c55e',
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  pickerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pickerOption: {
    flex: 1,
    padding: 12,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  pickerOptionActive: {
    borderColor: '#22c55e',
    backgroundColor: '#22c55e10',
  },
  pickerText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  pickerTextActive: {
    color: '#22c55e',
    fontWeight: '600',
  },
  currencyDisplay: {
    padding: 12,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  currencyText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
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
  submitButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#22c55e',
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  depositDetail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  depositDetailLabel: {
    fontSize: 14,
    color: '#94a3b8',
  },
  depositDetailValue: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
  amountHighlight: {
    fontSize: 18,
    color: '#f59e0b',
    fontWeight: '700',
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#ef444420',
    borderWidth: 1,
    borderColor: '#ef444440',
  },
  rejectButtonText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '600',
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#22c55e',
  },
  approveButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
});

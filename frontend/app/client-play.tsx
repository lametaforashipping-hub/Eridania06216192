import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Modal,
  Image,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Lottery {
  id: string;
  name: string;
  is_open: boolean;
  currency: string;
  country: string;
  closing_time?: string;
}

interface PaymentAccount {
  id: string;
  name: string;
  account_type: string;
  currency: string;
  bank_name?: string;
  account_number?: string;
  zelle_email?: string;
  zelle_phone?: string;
  notes?: string;
}

interface CartItem {
  id: string;
  lotteryId: string;
  lotteryName: string;
  numbers: number[];
  amount: number;
  playType: string;
  playTypeName: string;
}

// Play type detection based on digit count
const detectPlayType = (input: string): { type: string; numbers: number[]; name: string } | null => {
  const cleanInput = input.replace(/\D/g, '');
  
  if (cleanInput.length === 2) {
    const num = parseInt(cleanInput, 10);
    if (num >= 0 && num <= 99) {
      return { type: 'quiniela', numbers: [num], name: 'Quiniela' };
    }
  } else if (cleanInput.length === 4) {
    const num1 = parseInt(cleanInput.substring(0, 2), 10);
    const num2 = parseInt(cleanInput.substring(2, 4), 10);
    if (num1 >= 0 && num1 <= 99 && num2 >= 0 && num2 <= 99) {
      return { type: 'pale', numbers: [num1, num2], name: 'Pale' };
    }
  } else if (cleanInput.length === 6) {
    const num1 = parseInt(cleanInput.substring(0, 2), 10);
    const num2 = parseInt(cleanInput.substring(2, 4), 10);
    const num3 = parseInt(cleanInput.substring(4, 6), 10);
    if (num1 >= 0 && num1 <= 99 && num2 >= 0 && num2 <= 99 && num3 >= 0 && num3 <= 99) {
      return { type: 'tripleta', numbers: [num1, num2, num3], name: 'Tripleta' };
    }
  }
  
  return null;
};

const formatNumbers = (numbers: number[]): string => {
  return numbers.map(n => n.toString().padStart(2, '0')).join('-');
};

export default function ClientPlayScreen() {
  const { token, user } = useAuth();
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);
  
  // State
  const [lotteries, setLotteries] = useState<Lottery[]>([]);
  const [selectedLotteries, setSelectedLotteries] = useState<string[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'zelle' | 'transfer'>('zelle');
  
  const [input, setInput] = useState('');
  const [amount, setAmount] = useState('20');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Modals
  const [showLotteryModal, setShowLotteryModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdTicket, setCreatedTicket] = useState<any>(null);
  
  // Receipt upload
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  
  // Computed
  const totalAmount = cart.reduce((sum, item) => sum + item.amount, 0);
  const openLotteries = lotteries.filter(l => l.is_open);
  const selectedCount = selectedLotteries.length;
  
  // Get selected account details
  const selectedAccountDetails = paymentAccounts.find(a => a.id === selectedAccount);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [lotteriesRes, accountsRes] = await Promise.all([
          fetch(`${API_URL}/api/lotteries`, { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch(`${API_URL}/api/clients/payment-accounts`, { headers: { 'Authorization': `Bearer ${token}` } }),
        ]);
        
        if (lotteriesRes.ok) {
          const data = await lotteriesRes.json();
          setLotteries(data);
          // Auto-select all open lotteries
          const openIds = data.filter((l: Lottery) => l.is_open).map((l: Lottery) => l.id);
          setSelectedLotteries(openIds);
        }
        
        if (accountsRes.ok) {
          const accountsData = await accountsRes.json();
          setPaymentAccounts(accountsData.all_accounts || []);
          // Auto-select first account
          if (accountsData.all_accounts?.length > 0) {
            setSelectedAccount(accountsData.all_accounts[0].id);
            setPaymentMethod(accountsData.all_accounts[0].account_type === 'zelle' ? 'zelle' : 'transfer');
          }
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };
    
    if (token) fetchData();
  }, [token]);

  const toggleLottery = (lotteryId: string) => {
    const lottery = lotteries.find(l => l.id === lotteryId);
    if (!lottery?.is_open) {
      Alert.alert('Lotería Cerrada', 'Esta lotería ya cerró para hoy.');
      return;
    }
    
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    
    setSelectedLotteries(prev => 
      prev.includes(lotteryId) 
        ? prev.filter(id => id !== lotteryId)
        : [...prev, lotteryId]
    );
  };

  const addToCart = () => {
    if (!input.trim()) return;
    
    const detected = detectPlayType(input);
    if (!detected) {
      Alert.alert('Formato Inválido', 'Usa 2 dígitos (Quiniela), 4 dígitos (Pale) o 6 dígitos (Tripleta)');
      return;
    }
    
    if (selectedLotteries.length === 0) {
      Alert.alert('Selecciona Loterías', 'Debes seleccionar al menos una lotería');
      return;
    }
    
    const playAmount = parseInt(amount) || 20;
    
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Add to cart for each selected lottery
    const newItems: CartItem[] = selectedLotteries.map(lotteryId => {
      const lottery = lotteries.find(l => l.id === lotteryId);
      return {
        id: `${Date.now()}-${lotteryId}-${Math.random().toString(36).substr(2, 9)}`,
        lotteryId,
        lotteryName: lottery?.name || 'Lotería',
        numbers: detected.numbers,
        amount: playAmount,
        playType: detected.type,
        playTypeName: detected.name,
      };
    });
    
    setCart(prev => [...prev, ...newItems]);
    setInput('');
    inputRef.current?.focus();
  };

  const removeFromCart = (itemId: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCart(prev => prev.filter(item => item.id !== itemId));
  };

  const clearCart = () => {
    Alert.alert(
      'Limpiar Carrito',
      '¿Estás seguro de que deseas eliminar todas las jugadas?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Limpiar', 
          style: 'destructive',
          onPress: () => setCart([])
        },
      ]
    );
  };

  const handleSubmit = async () => {
    if (cart.length === 0) {
      Alert.alert('Carrito Vacío', 'Agrega jugadas antes de continuar');
      return;
    }
    
    if (!selectedAccount) {
      Alert.alert('Selecciona Cuenta', 'Debes seleccionar una cuenta para el pago');
      return;
    }
    
    setShowPaymentModal(true);
  };

  const confirmOrder = async () => {
    setSubmitting(true);
    
    try {
      // Create ticket
      const plays = cart.map(item => ({
        lottery_id: item.lotteryId,
        lottery_type: item.playType,
        numbers: item.numbers,
        amount: item.amount,
      }));
      
      const response = await fetch(`${API_URL}/api/clients/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          plays,
          payment_method: paymentMethod,
          bank_account_id: selectedAccount,
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setCreatedTicket(data.ticket);
        setShowPaymentModal(false);
        setShowSuccessModal(true);
        setCart([]);
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert('Error', data.detail || 'Error al crear el ticket');
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setSubmitting(false);
    }
  };

  const pickReceiptImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (!permissionResult.granted) {
      Alert.alert('Permiso Requerido', 'Necesitamos acceso a tus fotos para subir el comprobante');
      return;
    }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    
    if (!result.canceled && result.assets[0]) {
      setReceiptImage(result.assets[0].uri);
    }
  };

  const uploadReceipt = async () => {
    if (!receiptImage || !createdTicket) return;
    
    setUploadingReceipt(true);
    
    try {
      const formData = new FormData();
      const filename = receiptImage.split('/').pop() || 'receipt.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      
      formData.append('file', {
        uri: receiptImage,
        name: filename,
        type,
      } as any);
      
      const response = await fetch(
        `${API_URL}/api/clients/tickets/${createdTicket.id}/upload-receipt`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        }
      );
      
      const data = await response.json();
      
      if (response.ok) {
        Alert.alert(
          'Comprobante Subido',
          'Tu comprobante ha sido enviado. Te notificaremos cuando sea confirmado.',
          [{ text: 'OK', onPress: () => router.replace('/client-dashboard') }]
        );
      } else {
        Alert.alert('Error', data.detail || 'Error al subir el comprobante');
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setUploadingReceipt(false);
    }
  };

  // Current preview
  const currentPreview = input ? detectPlayType(input) : null;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#22c55e" style={styles.loader} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nueva Jugada</Text>
          <TouchableOpacity 
            onPress={() => setShowLotteryModal(true)} 
            style={styles.lotteryButton}
          >
            <Ionicons name="list" size={20} color="#22c55e" />
            <Text style={styles.lotteryButtonText}>{selectedCount}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Selected Lotteries Preview */}
          <View style={styles.selectedLotteriesContainer}>
            <Text style={styles.sectionLabel}>Loterías Seleccionadas</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.lotteryChips}>
                {selectedLotteries.map(id => {
                  const lottery = lotteries.find(l => l.id === id);
                  return (
                    <TouchableOpacity
                      key={id}
                      style={styles.lotteryChip}
                      onPress={() => toggleLottery(id)}
                    >
                      <Text style={styles.lotteryChipText}>{lottery?.name}</Text>
                      <Ionicons name="close-circle" size={16} color="#ffffff" />
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={styles.addLotteryChip}
                  onPress={() => setShowLotteryModal(true)}
                >
                  <Ionicons name="add" size={20} color="#22c55e" />
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>

          {/* Number Input */}
          <View style={styles.inputSection}>
            <Text style={styles.sectionLabel}>Ingresa tus Números</Text>
            <Text style={styles.inputHint}>
              2 dígitos = Quiniela | 4 dígitos = Pale | 6 dígitos = Tripleta
            </Text>
            
            <View style={styles.inputRow}>
              <View style={styles.numberInputContainer}>
                <TextInput
                  ref={inputRef}
                  style={styles.numberInput}
                  value={input}
                  onChangeText={setInput}
                  placeholder="Ej: 25 o 2550 o 255080"
                  placeholderTextColor="#64748b"
                  keyboardType="number-pad"
                  maxLength={6}
                  onSubmitEditing={addToCart}
                />
                {currentPreview && (
                  <View style={styles.previewBadge}>
                    <Text style={styles.previewText}>
                      {currentPreview.name}: {formatNumbers(currentPreview.numbers)}
                    </Text>
                  </View>
                )}
              </View>
              
              <View style={styles.amountInputContainer}>
                <Text style={styles.currencyPrefix}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="20"
                  placeholderTextColor="#64748b"
                  keyboardType="number-pad"
                  maxLength={5}
                />
              </View>
            </View>
            
            <TouchableOpacity
              style={[styles.addButton, (!input || !currentPreview) && styles.addButtonDisabled]}
              onPress={addToCart}
              disabled={!input || !currentPreview}
            >
              <Ionicons name="add-circle" size={20} color="#ffffff" />
              <Text style={styles.addButtonText}>
                Agregar a {selectedCount} Lotería{selectedCount !== 1 ? 's' : ''}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Cart */}
          {cart.length > 0 && (
            <View style={styles.cartSection}>
              <View style={styles.cartHeader}>
                <Text style={styles.sectionLabel}>Tu Carrito ({cart.length})</Text>
                <TouchableOpacity onPress={clearCart}>
                  <Text style={styles.clearCartText}>Limpiar</Text>
                </TouchableOpacity>
              </View>
              
              {cart.map(item => (
                <View key={item.id} style={styles.cartItem}>
                  <View style={styles.cartItemInfo}>
                    <Text style={styles.cartItemLottery}>{item.lotteryName}</Text>
                    <View style={styles.cartItemNumbers}>
                      <Text style={styles.cartItemType}>{item.playTypeName}</Text>
                      <Text style={styles.cartItemNumText}>{formatNumbers(item.numbers)}</Text>
                    </View>
                  </View>
                  <Text style={styles.cartItemAmount}>${item.amount}</Text>
                  <TouchableOpacity onPress={() => removeFromCart(item.id)} style={styles.removeButton}>
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}
              
              <View style={styles.cartTotal}>
                <Text style={styles.cartTotalLabel}>Total a Pagar:</Text>
                <Text style={styles.cartTotalAmount}>RD$ {totalAmount.toLocaleString()}</Text>
              </View>
            </View>
          )}

          {/* Payment Account Selection */}
          <View style={styles.paymentSection}>
            <Text style={styles.sectionLabel}>Método de Pago</Text>
            
            {paymentAccounts.length === 0 ? (
              <View style={styles.noAccountsWarning}>
                <Ionicons name="warning" size={24} color="#f59e0b" />
                <Text style={styles.noAccountsText}>
                  No hay cuentas de pago disponibles en este momento.
                </Text>
              </View>
            ) : (
              <View style={styles.accountsList}>
                {paymentAccounts.map(account => (
                  <TouchableOpacity
                    key={account.id}
                    style={[
                      styles.accountCard,
                      selectedAccount === account.id && styles.accountCardSelected
                    ]}
                    onPress={() => {
                      setSelectedAccount(account.id);
                      setPaymentMethod(account.account_type === 'zelle' ? 'zelle' : 'transfer');
                    }}
                  >
                    <View style={styles.accountIcon}>
                      <Ionicons
                        name={account.account_type === 'zelle' ? 'flash' : 'business'}
                        size={24}
                        color={selectedAccount === account.id ? '#22c55e' : '#64748b'}
                      />
                    </View>
                    <View style={styles.accountInfo}>
                      <Text style={styles.accountName}>{account.name}</Text>
                      <Text style={styles.accountType}>
                        {account.account_type === 'zelle' ? 'Zelle' : account.bank_name || 'Banco'}
                      </Text>
                      {account.account_type === 'zelle' ? (
                        <Text style={styles.accountDetail}>
                          {account.zelle_email || account.zelle_phone}
                        </Text>
                      ) : (
                        <Text style={styles.accountDetail}>
                          ****{account.account_number?.slice(-4)}
                        </Text>
                      )}
                    </View>
                    {selectedAccount === account.id && (
                      <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Bottom Submit Button */}
        {cart.length > 0 && (
          <View style={styles.bottomBar}>
            <View style={styles.bottomTotal}>
              <Text style={styles.bottomTotalLabel}>Total</Text>
              <Text style={styles.bottomTotalAmount}>RD$ {totalAmount.toLocaleString()}</Text>
            </View>
            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="cart" size={20} color="#ffffff" />
                  <Text style={styles.submitButtonText}>Continuar</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Lottery Selection Modal */}
        <Modal
          visible={showLotteryModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowLotteryModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Seleccionar Loterías</Text>
                <TouchableOpacity onPress={() => setShowLotteryModal(false)}>
                  <Ionicons name="close" size={24} color="#ffffff" />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.modalBody}>
                {lotteries.map(lottery => (
                  <TouchableOpacity
                    key={lottery.id}
                    style={[
                      styles.lotteryItem,
                      selectedLotteries.includes(lottery.id) && styles.lotteryItemSelected,
                      !lottery.is_open && styles.lotteryItemClosed
                    ]}
                    onPress={() => toggleLottery(lottery.id)}
                    disabled={!lottery.is_open}
                  >
                    <View style={styles.lotteryItemLeft}>
                      <View style={[
                        styles.lotteryStatusDot,
                        { backgroundColor: lottery.is_open ? '#22c55e' : '#ef4444' }
                      ]} />
                      <Text style={[
                        styles.lotteryItemName,
                        !lottery.is_open && styles.lotteryItemNameClosed
                      ]}>
                        {lottery.name}
                      </Text>
                    </View>
                    <View style={styles.lotteryItemRight}>
                      {lottery.closing_time && (
                        <Text style={styles.lotteryClosingTime}>
                          Cierra: {lottery.closing_time}
                        </Text>
                      )}
                      {selectedLotteries.includes(lottery.id) && (
                        <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              
              <TouchableOpacity
                style={styles.modalDoneButton}
                onPress={() => setShowLotteryModal(false)}
              >
                <Text style={styles.modalDoneButtonText}>
                  Listo ({selectedCount} seleccionadas)
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Payment Confirmation Modal */}
        <Modal
          visible={showPaymentModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowPaymentModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Confirmar Pago</Text>
                <TouchableOpacity onPress={() => setShowPaymentModal(false)}>
                  <Ionicons name="close" size={24} color="#ffffff" />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.modalBody}>
                <View style={styles.paymentSummary}>
                  <Text style={styles.paymentSummaryTitle}>Resumen de Jugada</Text>
                  <View style={styles.paymentSummaryRow}>
                    <Text style={styles.paymentSummaryLabel}>Jugadas:</Text>
                    <Text style={styles.paymentSummaryValue}>{cart.length}</Text>
                  </View>
                  <View style={styles.paymentSummaryRow}>
                    <Text style={styles.paymentSummaryLabel}>Loterías:</Text>
                    <Text style={styles.paymentSummaryValue}>
                      {[...new Set(cart.map(c => c.lotteryName))].length}
                    </Text>
                  </View>
                  <View style={[styles.paymentSummaryRow, styles.paymentSummaryTotal]}>
                    <Text style={styles.paymentSummaryTotalLabel}>Total:</Text>
                    <Text style={styles.paymentSummaryTotalValue}>
                      RD$ {totalAmount.toLocaleString()}
                    </Text>
                  </View>
                </View>
                
                {selectedAccountDetails && (
                  <View style={styles.paymentInstructions}>
                    <Text style={styles.paymentInstructionsTitle}>
                      Envía tu pago a:
                    </Text>
                    
                    <View style={styles.paymentDetailsCard}>
                      {selectedAccountDetails.account_type === 'zelle' ? (
                        <>
                          <View style={styles.paymentDetailRow}>
                            <Ionicons name="flash" size={20} color="#22c55e" />
                            <Text style={styles.paymentDetailLabel}>Zelle</Text>
                          </View>
                          {selectedAccountDetails.zelle_email && (
                            <Text style={styles.paymentDetailValue}>
                              {selectedAccountDetails.zelle_email}
                            </Text>
                          )}
                          {selectedAccountDetails.zelle_phone && (
                            <Text style={styles.paymentDetailValue}>
                              {selectedAccountDetails.zelle_phone}
                            </Text>
                          )}
                          <Text style={styles.paymentDetailName}>
                            {selectedAccountDetails.name}
                          </Text>
                        </>
                      ) : (
                        <>
                          <View style={styles.paymentDetailRow}>
                            <Ionicons name="business" size={20} color="#3b82f6" />
                            <Text style={styles.paymentDetailLabel}>
                              {selectedAccountDetails.bank_name || 'Banco'}
                            </Text>
                          </View>
                          <Text style={styles.paymentDetailValue}>
                            Cuenta: {selectedAccountDetails.account_number}
                          </Text>
                          <Text style={styles.paymentDetailName}>
                            {selectedAccountDetails.name}
                          </Text>
                        </>
                      )}
                      {selectedAccountDetails.notes && (
                        <Text style={styles.paymentDetailNotes}>
                          {selectedAccountDetails.notes}
                        </Text>
                      )}
                    </View>
                    
                    <View style={styles.paymentWarning}>
                      <Ionicons name="information-circle" size={20} color="#f59e0b" />
                      <Text style={styles.paymentWarningText}>
                        Después de realizar el pago, deberás subir una foto del comprobante para validar tu jugada.
                      </Text>
                    </View>
                  </View>
                )}
              </ScrollView>
              
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowPaymentModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmButton, submitting && styles.confirmButtonDisabled]}
                  onPress={confirmOrder}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.confirmButtonText}>Confirmar Pedido</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Success Modal - Upload Receipt */}
        <Modal
          visible={showSuccessModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => {}}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.successHeader}>
                <View style={styles.successIconContainer}>
                  <Ionicons name="checkmark-circle" size={60} color="#22c55e" />
                </View>
                <Text style={styles.successTitle}>¡Pedido Creado!</Text>
                <Text style={styles.successSubtitle}>
                  Ticket: {createdTicket?.ticket_number}
                </Text>
              </View>
              
              <ScrollView style={styles.modalBody}>
                <View style={styles.uploadSection}>
                  <Text style={styles.uploadTitle}>Sube tu Comprobante de Pago</Text>
                  <Text style={styles.uploadDescription}>
                    Para validar tu jugada, sube una foto del comprobante de tu pago por Zelle o transferencia.
                  </Text>
                  
                  <TouchableOpacity
                    style={styles.uploadButton}
                    onPress={pickReceiptImage}
                  >
                    {receiptImage ? (
                      <Image source={{ uri: receiptImage }} style={styles.receiptPreview} />
                    ) : (
                      <>
                        <Ionicons name="cloud-upload" size={40} color="#64748b" />
                        <Text style={styles.uploadButtonText}>Seleccionar Imagen</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  
                  {receiptImage && (
                    <TouchableOpacity
                      style={styles.changeImageButton}
                      onPress={pickReceiptImage}
                    >
                      <Ionicons name="refresh" size={16} color="#22c55e" />
                      <Text style={styles.changeImageText}>Cambiar imagen</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
              
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.laterButton}
                  onPress={() => router.replace('/client-dashboard')}
                >
                  <Text style={styles.laterButtonText}>Subir Después</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.uploadNowButton,
                    (!receiptImage || uploadingReceipt) && styles.uploadNowButtonDisabled
                  ]}
                  onPress={uploadReceipt}
                  disabled={!receiptImage || uploadingReceipt}
                >
                  {uploadingReceipt ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.uploadNowButtonText}>Subir Comprobante</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
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
  keyboardView: {
    flex: 1,
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
  lotteryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  lotteryButtonText: {
    color: '#22c55e',
    fontWeight: '700',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 8,
  },
  selectedLotteriesContainer: {
    marginBottom: 20,
  },
  lotteryChips: {
    flexDirection: 'row',
    gap: 8,
  },
  lotteryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22c55e',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  lotteryChipText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  addLotteryChip: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#22c55e',
    borderStyle: 'dashed',
  },
  inputSection: {
    marginBottom: 20,
  },
  inputHint: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  numberInputContainer: {
    flex: 2,
    position: 'relative',
  },
  numberInput: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: '#334155',
  },
  previewBadge: {
    position: 'absolute',
    top: -8,
    right: 8,
    backgroundColor: '#22c55e',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  previewText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  amountInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  currencyPrefix: {
    color: '#64748b',
    fontSize: 18,
    fontWeight: '600',
    marginRight: 4,
  },
  amountInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    paddingVertical: 14,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  cartSection: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  cartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  clearCartText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '600',
  },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  cartItemInfo: {
    flex: 1,
  },
  cartItemLottery: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 2,
  },
  cartItemNumbers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cartItemType: {
    fontSize: 11,
    color: '#22c55e',
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cartItemNumText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  cartItemAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#22c55e',
    marginRight: 12,
  },
  removeButton: {
    padding: 8,
  },
  cartTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 12,
    marginTop: 4,
  },
  cartTotalLabel: {
    fontSize: 14,
    color: '#94a3b8',
  },
  cartTotalAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#22c55e',
  },
  paymentSection: {
    marginBottom: 20,
  },
  noAccountsWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  noAccountsText: {
    flex: 1,
    color: '#f59e0b',
    fontSize: 14,
  },
  accountsList: {
    gap: 12,
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  accountCardSelected: {
    borderColor: '#22c55e',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  accountIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 2,
  },
  accountType: {
    fontSize: 13,
    color: '#64748b',
  },
  accountDetail: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    gap: 16,
  },
  bottomTotal: {
    flex: 1,
  },
  bottomTotalLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  bottomTotalAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#22c55e',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22c55e',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
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
    fontWeight: '700',
    color: '#ffffff',
  },
  modalBody: {
    padding: 20,
    maxHeight: 400,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  lotteryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f172a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  lotteryItemSelected: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  lotteryItemClosed: {
    opacity: 0.5,
  },
  lotteryItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  lotteryStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  lotteryItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  lotteryItemNameClosed: {
    color: '#64748b',
  },
  lotteryItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  lotteryClosingTime: {
    fontSize: 12,
    color: '#64748b',
  },
  modalDoneButton: {
    backgroundColor: '#22c55e',
    margin: 20,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalDoneButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  // Payment confirmation
  paymentSummary: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  paymentSummaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 12,
  },
  paymentSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  paymentSummaryLabel: {
    color: '#94a3b8',
    fontSize: 14,
  },
  paymentSummaryValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  paymentSummaryTotal: {
    borderTopWidth: 1,
    borderTopColor: '#334155',
    marginTop: 8,
    paddingTop: 12,
  },
  paymentSummaryTotalLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  paymentSummaryTotalValue: {
    color: '#22c55e',
    fontSize: 20,
    fontWeight: '700',
  },
  paymentInstructions: {
    gap: 16,
  },
  paymentInstructionsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  paymentDetailsCard: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  paymentDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  paymentDetailLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  paymentDetailValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#22c55e',
    marginBottom: 4,
  },
  paymentDetailName: {
    fontSize: 14,
    color: '#94a3b8',
  },
  paymentDetailNotes: {
    fontSize: 13,
    color: '#64748b',
    fontStyle: 'italic',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  paymentWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    padding: 12,
    borderRadius: 10,
    gap: 10,
  },
  paymentWarningText: {
    flex: 1,
    color: '#fbbf24',
    fontSize: 13,
    lineHeight: 18,
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
  confirmButton: {
    flex: 2,
    backgroundColor: '#22c55e',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.7,
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  // Success modal
  successHeader: {
    alignItems: 'center',
    padding: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  successIconContainer: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 14,
    color: '#22c55e',
    fontWeight: '600',
  },
  uploadSection: {
    alignItems: 'center',
  },
  uploadTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  uploadDescription: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  uploadButton: {
    width: '100%',
    height: 200,
    backgroundColor: '#0f172a',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#334155',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  uploadButtonText: {
    color: '#64748b',
    fontSize: 14,
    marginTop: 12,
  },
  receiptPreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  changeImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  changeImageText: {
    color: '#22c55e',
    fontSize: 14,
    fontWeight: '600',
  },
  laterButton: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  laterButtonText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  uploadNowButton: {
    flex: 2,
    backgroundColor: '#22c55e',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  uploadNowButtonDisabled: {
    opacity: 0.5,
  },
  uploadNowButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});

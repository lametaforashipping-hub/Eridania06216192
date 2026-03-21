import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Lottery {
  id: string;
  name: string;
  is_open: boolean;
  currency: string;
  country: string;
  min_number: number;
  max_number: number;
  prize_multiplier: number;
  play_types?: {
    [key: string]: {
      enabled: boolean;
      numbers_count: number;
      multipliers: { first: number; second?: number; third?: number };
    };
  };
}

interface CartItem {
  id: string;
  lotteryId: string;
  lotteryName: string;
  numbers: number[];
  amount: number;
  currency: string;
  potentialWin: number;
  playType: string;
  playTypeName: string;
}

interface CompanyProfile {
  company_name: string;
  logo_url?: string;
  slogan?: string;
}

// Play type detection based on digit count
const detectPlayType = (input: string): { type: string; numbers: number[]; name: string } | null => {
  const cleanInput = input.replace(/\D/g, ''); // Remove non-digits
  
  if (cleanInput.length === 2) {
    // Quiniela: 2 digits = 1 number
    const num = parseInt(cleanInput, 10);
    if (num >= 0 && num <= 99) {
      return { type: 'quiniela', numbers: [num], name: 'Quiniela' };
    }
  } else if (cleanInput.length === 4) {
    // Pale: 4 digits = 2 numbers
    const num1 = parseInt(cleanInput.substring(0, 2), 10);
    const num2 = parseInt(cleanInput.substring(2, 4), 10);
    if (num1 >= 0 && num1 <= 99 && num2 >= 0 && num2 <= 99) {
      return { type: 'pale', numbers: [num1, num2], name: 'Pale' };
    }
  } else if (cleanInput.length === 6) {
    // Tripleta: 6 digits = 3 numbers
    const num1 = parseInt(cleanInput.substring(0, 2), 10);
    const num2 = parseInt(cleanInput.substring(2, 4), 10);
    const num3 = parseInt(cleanInput.substring(4, 6), 10);
    if (num1 >= 0 && num1 <= 99 && num2 >= 0 && num2 <= 99 && num3 >= 0 && num3 <= 99) {
      return { type: 'tripleta', numbers: [num1, num2, num3], name: 'Tripleta' };
    }
  }
  
  return null;
};

// Format numbers for display
const formatNumbers = (numbers: number[]): string => {
  return numbers.map(n => n.toString().padStart(2, '0')).join('-');
};

export default function QuickSales() {
  const { token, user } = useAuth();
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);
  
  // State
  const [lotteries, setLotteries] = useState<Lottery[]>([]);
  const [selectedLottery, setSelectedLottery] = useState<Lottery | null>(null);
  const [input, setInput] = useState('');
  const [amount, setAmount] = useState('20');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showAmountModal, setShowAmountModal] = useState(false);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  
  // Computed
  const totalAmount = cart.reduce((sum, item) => sum + item.amount, 0);
  const currency = selectedLottery?.currency || 'RD$';
  
  // Fetch lotteries
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [lotteriesRes, profileRes] = await Promise.all([
          fetch(`${API_URL}/api/lotteries`, {
            headers: { 'Authorization': `Bearer ${token}` },
          }),
          fetch(`${API_URL}/api/company-profile`, {
            headers: { 'Authorization': `Bearer ${token}` },
          })
        ]);
        
        if (lotteriesRes.ok) {
          const data = await lotteriesRes.json();
          // Show ALL lotteries, not just open ones
          setLotteries(data);
          // Select first open lottery by default
          const firstOpen = data.find((l: Lottery) => l.is_open);
          if (firstOpen) {
            setSelectedLottery(firstOpen);
          } else if (data.length > 0) {
            setSelectedLottery(data[0]);
          }
        }
        
        if (profileRes.ok) {
          const profile = await profileRes.json();
          setCompanyProfile(profile);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };
    
    if (token) fetchData();
  }, [token]);
  
  // Handle input change - auto format
  const handleInputChange = (text: string) => {
    // Only allow digits
    const cleaned = text.replace(/\D/g, '');
    // Max 6 digits (for tripleta)
    setInput(cleaned.substring(0, 6));
  };
  
  // Handle submit - check if lottery is open
  const handleSubmitInput = useCallback(() => {
    if (!selectedLottery || !input) return;
    
    // Check if lottery is open
    if (!selectedLottery.is_open) {
      Alert.alert('Cerrada', `${selectedLottery.name} está cerrada`);
      return;
    }
    
    const detected = detectPlayType(input);
    if (!detected) {
      // Show hint based on input length
      const len = input.length;
      if (len < 2) {
        Alert.alert('Formato', 'Ingresa al menos 2 dígitos\n\n02 = Quiniela\n0250 = Pale\n025080 = Tripleta');
      } else if (len === 3 || len === 5) {
        Alert.alert('Formato incorrecto', `${len} dígitos no es válido\n\n2 dígitos = Quiniela\n4 dígitos = Pale\n6 dígitos = Tripleta`);
      }
      return;
    }
    
    // Check if play type is enabled for this lottery (if play_types exists)
    const playTypeConfig = selectedLottery.play_types?.[detected.type];
    
    // If play_types doesn't exist or this type isn't defined, allow it (default behavior)
    // Only block if explicitly disabled (enabled: false)
    if (playTypeConfig && playTypeConfig.enabled === false) {
      Alert.alert('No disponible', `${detected.name} no está disponible para ${selectedLottery.name}`);
      return;
    }
    
    // Calculate potential win
    const amt = parseFloat(amount) || 20;
    if (amt <= 0) {
      Alert.alert('Monto inválido', 'Ingresa un monto válido');
      return;
    }
    
    // Get multiplier from config or use defaults
    let multiplier = 70; // default for quiniela
    if (playTypeConfig?.multipliers?.first) {
      multiplier = playTypeConfig.multipliers.first;
    } else if (detected.type === 'pale') {
      multiplier = 1000;
    } else if (detected.type === 'tripleta') {
      multiplier = 50000;
    } else {
      multiplier = selectedLottery.prize_multiplier || 70;
    }
    
    // Add to cart
    const newItem: CartItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      lotteryId: selectedLottery.id,
      lotteryName: selectedLottery.name,
      numbers: detected.numbers,
      amount: amt,
      currency: selectedLottery.currency,
      potentialWin: amt * multiplier,
      playType: detected.type,
      playTypeName: detected.name,
    };
    
    setCart(prev => [...prev, newItem]);
    setInput('');
    
    // Haptic feedback
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    // Keep focus on input
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [input, selectedLottery, amount]);
  
  // Remove item from cart
  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };
  
  // Clear cart
  const clearCart = () => {
    if (cart.length === 0) return;
    Alert.alert('Vaciar', '¿Vaciar el carrito?', [
      { text: 'No', style: 'cancel' },
      { text: 'Sí', style: 'destructive', onPress: () => setCart([]) }
    ]);
  };
  
  // Submit sale
  const handleSubmitSale = async () => {
    if (cart.length === 0) {
      Alert.alert('Vacío', 'Agrega jugadas al carrito');
      return;
    }
    
    setSubmitting(true);
    try {
      const plays = cart.map(item => ({
        lottery_id: item.lotteryId,
        lottery_type: item.playType,
        numbers: item.numbers,
        amount: item.amount,
      }));
      
      const response = await fetch(`${API_URL}/api/tickets/multi`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ plays }),
      });
      
      if (response.ok) {
        const ticket = await response.json();
        setCart([]);
        
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        
        Alert.alert(
          '✅ Venta Exitosa',
          `Boleto: ${ticket.ticket_number}\nTotal: ${currency} ${totalAmount.toFixed(2)}`,
          [
            { text: 'Ver Boleto', onPress: () => router.push(`/tickets?highlight=${ticket.id}`) },
            { text: 'Nueva Venta', style: 'cancel' }
          ]
        );
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'No se pudo crear el boleto');
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setSubmitting(false);
    }
  };
  
  // Quick amount buttons - REMOVED, now manual only
  
  // Select lottery handler
  const handleSelectLottery = (lottery: Lottery) => {
    setSelectedLottery(lottery);
    // Haptic feedback
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };
  
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#22c55e" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header with Selected Lottery Name - BIG */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.selectedLotteryName}>
              {selectedLottery?.name || 'Selecciona Lotería'}
            </Text>
            <View style={[
              styles.statusBadge,
              selectedLottery?.is_open ? styles.statusOpen : styles.statusClosed
            ]}>
              <View style={[
                styles.statusDot,
                selectedLottery?.is_open ? styles.dotOpen : styles.dotClosed
              ]} />
              <Text style={[
                styles.statusText,
                selectedLottery?.is_open ? styles.statusTextOpen : styles.statusTextClosed
              ]}>
                {selectedLottery?.is_open ? 'ABIERTA' : 'CERRADA'}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => router.push('/sales')} style={styles.headerBtn}>
            <Ionicons name="expand-outline" size={22} color="#94a3b8" />
          </TouchableOpacity>
        </View>
        
        {/* Lottery Selector - Horizontal scroll with status */}
        <View style={styles.lotterySection}>
          <Text style={styles.lotterySectionTitle}>Seleccionar Lotería:</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.lotteryScroll}
          >
            {lotteries.map(lottery => (
              <TouchableOpacity
                key={lottery.id}
                style={[
                  styles.lotteryChip,
                  selectedLottery?.id === lottery.id && styles.lotteryChipSelected,
                  !lottery.is_open && styles.lotteryChipClosed
                ]}
                onPress={() => handleSelectLottery(lottery)}
              >
                <Text style={[
                  styles.lotteryChipText,
                  selectedLottery?.id === lottery.id && styles.lotteryChipTextSelected,
                  !lottery.is_open && styles.lotteryChipTextClosed
                ]}>
                  {lottery.name}
                </Text>
                <View style={[
                  styles.chipStatusDot,
                  lottery.is_open ? styles.chipDotOpen : styles.chipDotClosed
                ]} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        
        {/* Main Input Area */}
        <View style={styles.inputSection}>
          <Text style={styles.inputHint}>
            02 = Quiniela | 0250 = Pale | 025080 = Tripleta
          </Text>
          
          <View style={styles.inputRow}>
            <TextInput
              ref={inputRef}
              style={styles.mainInput}
              value={input}
              onChangeText={handleInputChange}
              onSubmitEditing={handleSubmitInput}
              placeholder="Números..."
              placeholderTextColor="#64748b"
              keyboardType="number-pad"
              returnKeyType="done"
              autoFocus
              maxLength={6}
            />
            <TouchableOpacity 
              style={styles.addBtn}
              onPress={handleSubmitInput}
            >
              <Ionicons name="add-circle" size={40} color="#22c55e" />
            </TouchableOpacity>
          </View>
          
          {/* Input Preview */}
          {input.length > 0 && (
            <View style={styles.preview}>
              {input.length === 2 && (
                <Text style={styles.previewText}>
                  Quiniela: <Text style={styles.previewNumbers}>{input.padStart(2, '0')}</Text>
                </Text>
              )}
              {input.length === 4 && (
                <Text style={styles.previewText}>
                  Pale: <Text style={styles.previewNumbers}>{input.substring(0,2)}-{input.substring(2,4)}</Text>
                </Text>
              )}
              {input.length === 6 && (
                <Text style={styles.previewText}>
                  Tripleta: <Text style={styles.previewNumbers}>{input.substring(0,2)}-{input.substring(2,4)}-{input.substring(4,6)}</Text>
                </Text>
              )}
              {(input.length === 1 || input.length === 3 || input.length === 5) && (
                <Text style={styles.previewHint}>
                  {input.length === 1 && 'Falta 1 dígito → Quiniela'}
                  {input.length === 3 && 'Falta 1 dígito → Pale'}
                  {input.length === 5 && 'Falta 1 dígito → Tripleta'}
                </Text>
              )}
            </View>
          )}
          
          {/* Amount Row - MANUAL INPUT */}
          <View style={styles.amountSection}>
            <Text style={styles.amountLabel}>Monto ({currency}):</Text>
            <TextInput
              style={styles.amountInputLarge}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="20"
              placeholderTextColor="#64748b"
              selectTextOnFocus
            />
          </View>
        </View>
        
        {/* Cart Section */}
        <View style={styles.cartSection}>
          <View style={styles.cartHeader}>
            <Text style={styles.cartTitle}>
              Carrito ({cart.length})
            </Text>
            {cart.length > 0 && (
              <TouchableOpacity onPress={clearCart}>
                <Text style={styles.clearBtn}>Vaciar</Text>
              </TouchableOpacity>
            )}
          </View>
          
          <ScrollView style={styles.cartList} showsVerticalScrollIndicator={false}>
            {cart.length === 0 ? (
              <Text style={styles.emptyCart}>Sin jugadas</Text>
            ) : (
              cart.map((item, index) => (
                <View key={item.id} style={styles.cartItem}>
                  <View style={styles.cartItemInfo}>
                    <Text style={styles.cartItemLottery}>{item.lotteryName}</Text>
                    <View style={styles.cartItemDetails}>
                      <Text style={styles.cartItemType}>{item.playTypeName}</Text>
                      <Text style={styles.cartItemNumbers}>{formatNumbers(item.numbers)}</Text>
                    </View>
                  </View>
                  <View style={styles.cartItemRight}>
                    <Text style={styles.cartItemAmount}>{item.currency} {item.amount}</Text>
                    <TouchableOpacity 
                      onPress={() => removeFromCart(item.id)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="close-circle" size={24} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>
        
        {/* Submit Button */}
        <View style={styles.footer}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total:</Text>
            <Text style={styles.totalAmount}>{currency} {totalAmount.toFixed(2)}</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.submitBtn,
              (cart.length === 0 || submitting) && styles.submitBtnDisabled
            ]}
            onPress={handleSubmitSale}
            disabled={cart.length === 0 || submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={24} color="#fff" />
                <Text style={styles.submitBtnText}>VENDER ({cart.length})</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#111',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  backBtn: {
    padding: 4,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 10,
  },
  selectedLotteryName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  statusOpen: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
  },
  statusClosed: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  dotOpen: {
    backgroundColor: '#22c55e',
  },
  dotClosed: {
    backgroundColor: '#ef4444',
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  statusTextOpen: {
    color: '#22c55e',
  },
  statusTextClosed: {
    color: '#ef4444',
  },
  headerBtn: {
    padding: 4,
  },
  lotterySection: {
    backgroundColor: '#111',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  lotterySectionTitle: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 8,
  },
  lotteryScroll: {
    gap: 8,
  },
  lotteryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    marginRight: 8,
  },
  lotteryChipSelected: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  lotteryChipClosed: {
    opacity: 0.6,
  },
  lotteryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
    marginRight: 6,
  },
  lotteryChipTextSelected: {
    color: '#fff',
  },
  lotteryChipTextClosed: {
    color: '#64748b',
  },
  chipStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  chipDotOpen: {
    backgroundColor: '#22c55e',
  },
  chipDotClosed: {
    backgroundColor: '#ef4444',
  },
  inputSection: {
    padding: 16,
    backgroundColor: '#0a0a0a',
  },
  inputHint: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mainInput: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 18,
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: 6,
    borderWidth: 2,
    borderColor: '#333',
  },
  addBtn: {
    padding: 4,
  },
  preview: {
    marginTop: 12,
    alignItems: 'center',
  },
  previewText: {
    fontSize: 16,
    color: '#94a3b8',
  },
  previewNumbers: {
    color: '#22c55e',
    fontWeight: 'bold',
    fontSize: 20,
  },
  previewHint: {
    fontSize: 13,
    color: '#f59e0b',
    fontStyle: 'italic',
  },
  amountSection: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  amountLabel: {
    fontSize: 16,
    color: '#94a3b8',
    fontWeight: '600',
  },
  amountInputLarge: {
    width: 120,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#3b82f6',
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  cartSection: {
    flex: 1,
    backgroundColor: '#111',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 14,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  cartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  clearBtn: {
    fontSize: 14,
    color: '#ef4444',
  },
  cartList: {
    flex: 1,
  },
  emptyCart: {
    textAlign: 'center',
    color: '#64748b',
    paddingVertical: 20,
    fontStyle: 'italic',
  },
  cartItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
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
  cartItemDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cartItemType: {
    fontSize: 11,
    color: '#22c55e',
    backgroundColor: '#22c55e20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cartItemNumbers: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 2,
  },
  cartItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cartItemAmount: {
    fontSize: 15,
    fontWeight: '600',
    color: '#94a3b8',
  },
  footer: {
    backgroundColor: '#111',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 16,
    color: '#94a3b8',
  },
  totalAmount: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#22c55e',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 10,
  },
  submitBtnDisabled: {
    backgroundColor: '#333',
    opacity: 0.6,
  },
  submitBtnText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
});

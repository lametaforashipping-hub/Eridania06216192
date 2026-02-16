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
  Dimensions,
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { TicketModal } from '../src/components/sales';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isMobile = SCREEN_WIDTH < 768;

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
  phone?: string;
}

interface Favorite {
  id: string;
  name: string;
  plays: { lottery_type: string; lottery_id?: string; numbers: number[]; amount: number }[];
  use_count: number;
}

interface RecentPlay {
  lottery_type: string;
  lottery_id?: string;
  lottery_name?: string;
  numbers: number[];
  amount: number;
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

const getMultiplier = (lottery: Lottery, playType: string): number => {
  const playTypeConfig = lottery.play_types?.[playType];
  if (playTypeConfig?.multipliers?.first) {
    return playTypeConfig.multipliers.first;
  }
  if (playType === 'pale') return 1000;
  if (playType === 'tripleta') return 50000;
  return lottery.prize_multiplier || 70;
};

export default function VentaUnificada() {
  const { token, user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ duplicate?: string }>();
  const inputRef = useRef<TextInput>(null);
  
  // State
  const [lotteries, setLotteries] = useState<Lottery[]>([]);
  const [selectedLotteries, setSelectedLotteries] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [amount, setAmount] = useState('20');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [customerName, setCustomerName] = useState('');
  
  // Modals
  const [showLotteryModal, setShowLotteryModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showFavoritesModal, setShowFavoritesModal] = useState(false);
  const [showRecentsModal, setShowRecentsModal] = useState(false);
  const [lastTicket, setLastTicket] = useState<any>(null);
  
  // Favorites and recent
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [recentPlays, setRecentPlays] = useState<RecentPlay[]>([]);
  
  // Computed
  const totalAmount = cart.reduce((sum, item) => sum + item.amount, 0);
  const currency = cart.length > 0 ? cart[0].currency : 
    (selectedLotteries.length > 0 ? lotteries.find(l => l.id === selectedLotteries[0])?.currency : 'RD$') || 'RD$';
  const openLotteries = lotteries.filter(l => l.is_open);
  const selectedCount = selectedLotteries.length;
  
  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [lotteriesRes, profileRes, favoritesRes, recentsRes] = await Promise.all([
          fetch(`${API_URL}/api/lotteries`, { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch(`${API_URL}/api/company-profile`, { headers: { 'Authorization': `Bearer ${token}` } }).catch(() => null),
          fetch(`${API_URL}/api/favorites`, { headers: { 'Authorization': `Bearer ${token}` } }).catch(() => null),
          fetch(`${API_URL}/api/tickets/recent-plays?limit=10`, { headers: { 'Authorization': `Bearer ${token}` } }).catch(() => null),
        ]);
        
        if (lotteriesRes.ok) {
          const data = await lotteriesRes.json();
          setLotteries(data);
          // Auto-select all open lotteries
          const openIds = data.filter((l: Lottery) => l.is_open).map((l: Lottery) => l.id);
          setSelectedLotteries(openIds);
        }
        
        if (profileRes?.ok) {
          setCompanyProfile(await profileRes.json());
        }
        
        if (favoritesRes?.ok) {
          setFavorites(await favoritesRes.json());
        }
        
        if (recentsRes?.ok) {
          setRecentPlays(await recentsRes.json());
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };
    
    if (token) fetchData();
  }, [token]);
  
  // Handle duplicate from URL
  useEffect(() => {
    if (params.duplicate && lotteries.length > 0) {
      handleDuplicateTicket(params.duplicate);
    }
  }, [params.duplicate, lotteries]);
  
  // Handle input change
  const handleInputChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    setInput(cleaned.substring(0, 6));
  };
  
  // Toggle lottery selection
  const toggleLottery = (id: string) => {
    const lottery = lotteries.find(l => l.id === id);
    if (!lottery?.is_open) return;
    
    setSelectedLotteries(prev => {
      if (prev.includes(id)) {
        return prev.filter(lid => lid !== id);
      }
      return [...prev, id];
    });
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };
  
  // Select all open lotteries
  const selectAllLotteries = () => {
    const allSelected = openLotteries.every(l => selectedLotteries.includes(l.id));
    if (allSelected) {
      setSelectedLotteries([]);
    } else {
      setSelectedLotteries(openLotteries.map(l => l.id));
    }
  };
  
  // Add play to cart
  const handleAddToCart = useCallback(() => {
    if (selectedLotteries.length === 0) {
      Alert.alert('Sin loterías', 'Selecciona al menos una lotería');
      return;
    }
    
    if (!input) return;
    
    const detected = detectPlayType(input);
    if (!detected) {
      const len = input.length;
      if (len < 2) {
        Alert.alert('Formato', '02 = Quiniela\n0250 = Pale\n025080 = Tripleta');
      } else if (len === 1 || len === 3 || len === 5) {
        Alert.alert('Incompleto', `Faltan dígitos\n\n2 = Quiniela\n4 = Pale\n6 = Tripleta`);
      }
      return;
    }
    
    const amt = parseFloat(amount) || 20;
    if (amt <= 0) {
      Alert.alert('Monto inválido', 'Ingresa un monto válido');
      return;
    }
    
    // Add to cart for each selected lottery
    const newItems: CartItem[] = [];
    let skipped = 0;
    
    for (const lotteryId of selectedLotteries) {
      const lottery = lotteries.find(l => l.id === lotteryId);
      if (!lottery || !lottery.is_open) {
        skipped++;
        continue;
      }
      
      // Check if play type is enabled
      const playTypeConfig = lottery.play_types?.[detected.type];
      if (playTypeConfig && playTypeConfig.enabled === false) {
        skipped++;
        continue;
      }
      
      const multiplier = getMultiplier(lottery, detected.type);
      
      newItems.push({
        id: `${Date.now()}-${lotteryId}-${Math.random().toString(36).substr(2, 9)}`,
        lotteryId: lottery.id,
        lotteryName: lottery.name,
        numbers: detected.numbers,
        amount: amt,
        currency: lottery.currency,
        potentialWin: amt * multiplier,
        playType: detected.type,
        playTypeName: detected.name,
      });
    }
    
    if (newItems.length === 0) {
      Alert.alert('No disponible', 'Esta jugada no está disponible para las loterías seleccionadas');
      return;
    }
    
    setCart(prev => [...prev, ...newItems]);
    setInput('');
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    // Keep focus
    setTimeout(() => inputRef.current?.focus(), 50);
    
    if (skipped > 0) {
      Alert.alert('Agregado', `${newItems.length} jugada(s) agregadas\n(${skipped} lotería(s) no disponibles)`);
    }
  }, [input, selectedLotteries, amount, lotteries]);
  
  // Remove from cart
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
  const handleSubmit = async () => {
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
        body: JSON.stringify({ 
          plays,
          customer_name: customerName.trim() || undefined,
        }),
      });
      
      if (response.ok) {
        const ticket = await response.json();
        setLastTicket(ticket);
        setCart([]);
        setCustomerName('');
        setShowTicketModal(true);
        
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        
        // Refresh recent plays
        const recentsRes = await fetch(`${API_URL}/api/tickets/recent-plays?limit=10`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (recentsRes.ok) {
          setRecentPlays(await recentsRes.json());
        }
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
  
  // Handle duplicate ticket
  const handleDuplicateTicket = async (ticketId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/tickets/${ticketId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (!response.ok) return;
      
      const ticket = await response.json();
      const newItems: CartItem[] = [];
      
      if (ticket.plays) {
        for (const play of ticket.plays) {
          const lottery = lotteries.find(l => l.id === play.lottery_id || l.name === play.lottery_name);
          if (lottery) {
            const multiplier = getMultiplier(lottery, play.lottery_type || 'quiniela');
            newItems.push({
              id: `dup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              lotteryId: lottery.id,
              lotteryName: lottery.name,
              numbers: play.numbers,
              amount: play.amount,
              currency: lottery.currency,
              potentialWin: play.amount * multiplier,
              playType: play.lottery_type || 'quiniela',
              playTypeName: play.lottery_type === 'pale' ? 'Pale' : play.lottery_type === 'tripleta' ? 'Tripleta' : 'Quiniela',
            });
          }
        }
      }
      
      if (newItems.length > 0) {
        setCart(prev => [...prev, ...newItems]);
        Alert.alert('Duplicado', `${newItems.length} jugada(s) agregadas`);
      }
    } catch (error) {
      console.error('Duplicate error:', error);
    }
  };
  
  // Use favorite
  const handleUseFavorite = async (favorite: Favorite) => {
    const newItems: CartItem[] = [];
    
    for (const play of favorite.plays) {
      const lottery = play.lottery_id 
        ? lotteries.find(l => l.id === play.lottery_id && l.is_open)
        : lotteries.find(l => l.is_open);
      
      if (lottery) {
        const multiplier = getMultiplier(lottery, play.lottery_type);
        newItems.push({
          id: `fav-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          lotteryId: lottery.id,
          lotteryName: lottery.name,
          numbers: play.numbers,
          amount: play.amount,
          currency: lottery.currency,
          potentialWin: play.amount * multiplier,
          playType: play.lottery_type,
          playTypeName: play.lottery_type === 'pale' ? 'Pale' : play.lottery_type === 'tripleta' ? 'Tripleta' : 'Quiniela',
        });
      }
    }
    
    if (newItems.length > 0) {
      setCart(prev => [...prev, ...newItems]);
      setShowFavoritesModal(false);
      
      // Update use count
      fetch(`${API_URL}/api/favorites/${favorite.id}/use`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } else {
      Alert.alert('Error', 'No hay loterías abiertas disponibles');
    }
  };
  
  // Use recent play
  const handleUseRecent = (recent: RecentPlay) => {
    // Add for all selected lotteries
    const newItems: CartItem[] = [];
    
    for (const lotteryId of selectedLotteries) {
      const lottery = lotteries.find(l => l.id === lotteryId && l.is_open);
      if (lottery) {
        const multiplier = getMultiplier(lottery, recent.lottery_type);
        newItems.push({
          id: `rec-${Date.now()}-${lotteryId}-${Math.random().toString(36).substr(2, 9)}`,
          lotteryId: lottery.id,
          lotteryName: lottery.name,
          numbers: recent.numbers,
          amount: recent.amount,
          currency: lottery.currency,
          potentialWin: recent.amount * multiplier,
          playType: recent.lottery_type,
          playTypeName: recent.lottery_type === 'pale' ? 'Pale' : recent.lottery_type === 'tripleta' ? 'Tripleta' : 'Quiniela',
        });
      }
    }
    
    if (newItems.length > 0) {
      setCart(prev => [...prev, ...newItems]);
      setShowRecentsModal(false);
      
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } else {
      Alert.alert('Error', 'Selecciona loterías abiertas primero');
    }
  };
  
  // Input preview
  const getPreview = () => {
    const len = input.length;
    if (len === 0) return null;
    
    if (len === 2) {
      return { type: 'Quiniela', display: input.padStart(2, '0') };
    } else if (len === 4) {
      return { type: 'Pale', display: `${input.substring(0,2)}-${input.substring(2,4)}` };
    } else if (len === 6) {
      return { type: 'Tripleta', display: `${input.substring(0,2)}-${input.substring(2,4)}-${input.substring(4,6)}` };
    } else if (len === 1) {
      return { hint: 'Falta 1 dígito → Quiniela' };
    } else if (len === 3) {
      return { hint: 'Falta 1 dígito → Pale' };
    } else if (len === 5) {
      return { hint: 'Falta 1 dígito → Tripleta' };
    }
    return null;
  };
  
  const preview = getPreview();
  
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
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Venta</Text>
          <View style={styles.headerActions}>
            {favorites.length > 0 && (
              <TouchableOpacity 
                style={styles.headerActionBtn}
                onPress={() => setShowFavoritesModal(true)}
              >
                <Ionicons name="star" size={20} color="#f59e0b" />
              </TouchableOpacity>
            )}
            {recentPlays.length > 0 && (
              <TouchableOpacity 
                style={styles.headerActionBtn}
                onPress={() => setShowRecentsModal(true)}
              >
                <Ionicons name="time" size={20} color="#6366f1" />
              </TouchableOpacity>
            )}
          </View>
        </View>
        
        {/* Lottery Selection Bar */}
        <TouchableOpacity 
          style={styles.lotteryBar}
          onPress={() => setShowLotteryModal(true)}
        >
          <View style={styles.lotteryBarContent}>
            <Ionicons name="grid" size={18} color="#22c55e" />
            <Text style={styles.lotteryBarText}>
              {selectedCount === 0 
                ? 'Seleccionar loterías' 
                : selectedCount === openLotteries.length 
                  ? `Todas (${selectedCount})` 
                  : `${selectedCount} lotería${selectedCount > 1 ? 's' : ''}`}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={20} color="#64748b" />
        </TouchableOpacity>
        
        {/* Quick lottery chips */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.quickLotteries}
          contentContainerStyle={styles.quickLotteriesContent}
        >
          <TouchableOpacity 
            style={[styles.quickChip, selectedCount === openLotteries.length && styles.quickChipActive]}
            onPress={selectAllLotteries}
          >
            <Text style={[styles.quickChipText, selectedCount === openLotteries.length && styles.quickChipTextActive]}>
              Todas
            </Text>
          </TouchableOpacity>
          {lotteries.slice(0, 6).map(lottery => (
            <TouchableOpacity
              key={lottery.id}
              style={[
                styles.quickChip,
                selectedLotteries.includes(lottery.id) && styles.quickChipActive,
                !lottery.is_open && styles.quickChipDisabled
              ]}
              onPress={() => toggleLottery(lottery.id)}
              disabled={!lottery.is_open}
            >
              <View style={[
                styles.statusDot,
                lottery.is_open ? styles.dotOpen : styles.dotClosed
              ]} />
              <Text style={[
                styles.quickChipText,
                selectedLotteries.includes(lottery.id) && styles.quickChipTextActive,
                !lottery.is_open && styles.quickChipTextDisabled
              ]} numberOfLines={1}>
                {lottery.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        
        {/* Main Input */}
        <View style={styles.inputSection}>
          <Text style={styles.inputHint}>02=Quiniela | 0250=Pale | 025080=Tripleta</Text>
          
          <View style={styles.inputRow}>
            <TextInput
              ref={inputRef}
              style={styles.mainInput}
              value={input}
              onChangeText={handleInputChange}
              onSubmitEditing={handleAddToCart}
              placeholder="Números"
              placeholderTextColor="#4a5568"
              keyboardType="number-pad"
              returnKeyType="done"
              autoFocus
              maxLength={6}
            />
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="$"
              placeholderTextColor="#4a5568"
              selectTextOnFocus
            />
            <TouchableOpacity 
              style={styles.addBtn} 
              onPress={handleAddToCart} 
              testID="add-play-btn"
              accessibilityLabel="Agregar jugada"
            >
              <Ionicons name="add" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
          
          {/* Preview */}
          {preview && (
            <View style={styles.previewRow}>
              {preview.type ? (
                <Text style={styles.previewText}>
                  <Text style={styles.previewType}>{preview.type}: </Text>
                  <Text style={styles.previewNumbers}>{preview.display}</Text>
                  <Text style={styles.previewLotteries}> × {selectedCount} lotería(s)</Text>
                </Text>
              ) : (
                <Text style={styles.previewHint}>{preview.hint}</Text>
              )}
            </View>
          )}
        </View>
        
        {/* Cart */}
        <View style={styles.cartSection}>
          <View style={styles.cartHeader}>
            <Text style={styles.cartTitle}>Carrito ({cart.length})</Text>
            {cart.length > 0 && (
              <TouchableOpacity onPress={clearCart}>
                <Text style={styles.clearBtn}>Vaciar</Text>
              </TouchableOpacity>
            )}
          </View>
          
          <ScrollView style={styles.cartList} showsVerticalScrollIndicator={false}>
            {cart.length === 0 ? (
              <View style={styles.emptyCart}>
                <Ionicons name="cart-outline" size={40} color="#333" />
                <Text style={styles.emptyCartText}>Agrega jugadas</Text>
              </View>
            ) : (
              cart.map((item) => (
                <View key={item.id} style={styles.cartItem}>
                  <View style={styles.cartItemLeft}>
                    <Text style={styles.cartItemLottery}>{item.lotteryName}</Text>
                    <View style={styles.cartItemRow}>
                      <Text style={styles.cartItemType}>{item.playTypeName}</Text>
                      <Text style={styles.cartItemNumbers}>{formatNumbers(item.numbers)}</Text>
                    </View>
                  </View>
                  <View style={styles.cartItemRight}>
                    <Text style={styles.cartItemAmount}>{item.currency}{item.amount}</Text>
                    <TouchableOpacity onPress={() => removeFromCart(item.id)} hitSlop={{top:10,bottom:10,left:10,right:10}}>
                      <Ionicons name="close-circle" size={22} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
          
          {/* Customer name */}
          {cart.length > 0 && (
            <TextInput
              style={styles.customerInput}
              value={customerName}
              onChangeText={setCustomerName}
              placeholder="Nombre del cliente (opcional)"
              placeholderTextColor="#4a5568"
            />
          )}
        </View>
        
        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total:</Text>
            <Text style={styles.totalAmount}>{currency} {totalAmount.toFixed(2)}</Text>
          </View>
          <TouchableOpacity
            style={[styles.submitBtn, (cart.length === 0 || submitting) && styles.submitBtnDisabled]}
            onPress={handleSubmit}
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
      
      {/* Lottery Selection Modal */}
      <Modal visible={showLotteryModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.lotteryModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar Loterías</Text>
              <TouchableOpacity onPress={() => setShowLotteryModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity style={styles.selectAllRow} onPress={selectAllLotteries}>
              <Ionicons 
                name={selectedCount === openLotteries.length ? "checkbox" : "square-outline"} 
                size={24} 
                color="#22c55e" 
              />
              <Text style={styles.selectAllText}>
                Seleccionar todas ({openLotteries.length} abiertas)
              </Text>
            </TouchableOpacity>
            
            <ScrollView style={styles.lotteryList}>
              {lotteries.map(lottery => (
                <TouchableOpacity
                  key={lottery.id}
                  style={[
                    styles.lotteryItem,
                    selectedLotteries.includes(lottery.id) && styles.lotteryItemSelected,
                    !lottery.is_open && styles.lotteryItemDisabled
                  ]}
                  onPress={() => toggleLottery(lottery.id)}
                  disabled={!lottery.is_open}
                >
                  <View style={styles.lotteryItemLeft}>
                    <View style={[
                      styles.lotteryStatusDot,
                      lottery.is_open ? styles.dotOpen : styles.dotClosed
                    ]} />
                    <Text style={[
                      styles.lotteryItemName,
                      selectedLotteries.includes(lottery.id) && styles.lotteryItemNameSelected,
                      !lottery.is_open && styles.lotteryItemNameDisabled
                    ]}>
                      {lottery.name}
                    </Text>
                  </View>
                  {selectedLotteries.includes(lottery.id) && (
                    <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <TouchableOpacity 
              style={styles.modalDoneBtn}
              onPress={() => setShowLotteryModal(false)}
            >
              <Text style={styles.modalDoneBtnText}>Listo ({selectedCount})</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      
      {/* Favorites Modal */}
      <Modal visible={showFavoritesModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.lotteryModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Favoritos</Text>
              <TouchableOpacity onPress={() => setShowFavoritesModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.lotteryList}>
              {favorites.map(fav => (
                <TouchableOpacity
                  key={fav.id}
                  style={styles.favoriteItem}
                  onPress={() => handleUseFavorite(fav)}
                >
                  <View>
                    <Text style={styles.favoriteName}>{fav.name}</Text>
                    <Text style={styles.favoritePlays}>
                      {fav.plays.length} jugada(s) • Usado {fav.use_count}x
                    </Text>
                  </View>
                  <Ionicons name="add-circle" size={28} color="#22c55e" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
      
      {/* Recents Modal */}
      <Modal visible={showRecentsModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.lotteryModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Jugadas Recientes</Text>
              <TouchableOpacity onPress={() => setShowRecentsModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.recentsHint}>Toca para agregar a todas las loterías seleccionadas</Text>
            
            <ScrollView style={styles.lotteryList}>
              {recentPlays.map((recent, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.recentItem}
                  onPress={() => handleUseRecent(recent)}
                >
                  <View>
                    <Text style={styles.recentNumbers}>{formatNumbers(recent.numbers)}</Text>
                    <Text style={styles.recentInfo}>
                      {recent.lottery_type === 'pale' ? 'Pale' : recent.lottery_type === 'tripleta' ? 'Tripleta' : 'Quiniela'} • ${recent.amount}
                    </Text>
                  </View>
                  <Ionicons name="add-circle" size={28} color="#6366f1" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
      
      {/* Ticket Modal */}
      <TicketModal
        visible={showTicketModal}
        onClose={() => setShowTicketModal(false)}
        ticket={lastTicket}
        companyProfile={companyProfile}
      />
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#111',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerActionBtn: {
    padding: 6,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
  },
  lotteryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  lotteryBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lotteryBarText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
  quickLotteries: {
    backgroundColor: '#0a0a0a',
    maxHeight: 50,
  },
  quickLotteriesContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    marginRight: 6,
    gap: 6,
  },
  quickChipActive: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  quickChipDisabled: {
    opacity: 0.4,
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    maxWidth: 80,
  },
  quickChipTextActive: {
    color: '#fff',
  },
  quickChipTextDisabled: {
    color: '#4a5568',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotOpen: {
    backgroundColor: '#22c55e',
  },
  dotClosed: {
    backgroundColor: '#ef4444',
  },
  inputSection: {
    padding: 12,
    backgroundColor: '#0a0a0a',
  },
  inputHint: {
    fontSize: 11,
    color: '#4a5568',
    textAlign: 'center',
    marginBottom: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mainInput: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: 4,
    borderWidth: 2,
    borderColor: '#333',
  },
  amountInput: {
    width: 80,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#22c55e',
    textAlign: 'center',
    borderWidth: 2,
    borderColor: '#22c55e30',
  },
  addBtn: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewRow: {
    marginTop: 10,
    alignItems: 'center',
  },
  previewText: {
    fontSize: 14,
  },
  previewType: {
    color: '#64748b',
  },
  previewNumbers: {
    color: '#22c55e',
    fontWeight: 'bold',
    fontSize: 18,
  },
  previewLotteries: {
    color: '#6366f1',
    fontSize: 12,
  },
  previewHint: {
    color: '#f59e0b',
    fontStyle: 'italic',
    fontSize: 13,
  },
  cartSection: {
    flex: 1,
    backgroundColor: '#111',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 12,
  },
  cartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyCartText: {
    color: '#4a5568',
    marginTop: 8,
    fontSize: 14,
  },
  cartItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
  },
  cartItemLeft: {
    flex: 1,
  },
  cartItemLottery: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 2,
  },
  cartItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cartItemType: {
    fontSize: 10,
    color: '#22c55e',
    backgroundColor: '#22c55e20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cartItemNumbers: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 2,
  },
  cartItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cartItemAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
  },
  customerInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#fff',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  footer: {
    backgroundColor: '#111',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  totalLabel: {
    fontSize: 16,
    color: '#94a3b8',
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#22c55e',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    borderRadius: 12,
    paddingVertical: 14,
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  lotteryModal: {
    backgroundColor: '#111',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: '#1a1a1a',
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 10,
  },
  selectAllText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
  lotteryList: {
    padding: 12,
  },
  lotteryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  lotteryItemSelected: {
    borderColor: '#22c55e',
    backgroundColor: '#22c55e10',
  },
  lotteryItemDisabled: {
    opacity: 0.4,
  },
  lotteryItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  lotteryStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  lotteryItemName: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '500',
  },
  lotteryItemNameSelected: {
    color: '#22c55e',
  },
  lotteryItemNameDisabled: {
    color: '#4a5568',
  },
  modalDoneBtn: {
    backgroundColor: '#22c55e',
    margin: 12,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalDoneBtnText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  // Favorites
  favoriteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    marginBottom: 8,
  },
  favoriteName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  favoritePlays: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  // Recents
  recentsHint: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    marginBottom: 8,
  },
  recentNumbers: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 2,
  },
  recentInfo: {
    fontSize: 12,
    color: '#6366f1',
    marginTop: 2,
  },
});

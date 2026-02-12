import React, { useState, useEffect, useCallback } from 'react';
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
  Share,
  Platform,
  Dimensions,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Print from 'expo-print';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const { width } = Dimensions.get('window');
const isDesktop = width > 768;

interface Lottery {
  id: string;
  name: string;
  country: string;
  lottery_type: string;
  min_number: number;
  max_number: number;
  numbers_to_pick: number;
  price: number;
  currency: string;
  prize_multiplier: number;
  schedule: string[];
  is_open: boolean;
  next_draw_time: string | null;
  closing_minutes_before: number;
  closed_message?: string;
}

interface CartItem {
  id: string;
  lotteryId: string;
  lotteryName: string;
  numbers: number[];
  amount: number;
  currency: string;
  potentialWin: number;
  country: string;
}

interface MultiPlayTicketResponse {
  id: string;
  ticket_number: string;
  plays: Array<{
    lottery_name: string;
    numbers: number[];
    amount: number;
    potential_win: number;
  }>;
  total_amount: number;
  total_potential_win: number;
  currency: string;
  customer_name?: string;
  created_at: string;
  commission_earned?: number;
}

export default function Sales() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [lotteries, setLotteries] = useState<Lottery[]>([]);
  const [selectedLotteries, setSelectedLotteries] = useState<string[]>([]);
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [numberInput, setNumberInput] = useState('');
  const [amount, setAmount] = useState('20');
  const [customerName, setCustomerName] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showLotteryModal, setShowLotteryModal] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [lastTicket, setLastTicket] = useState<MultiPlayTicketResponse | null>(null);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [lotteryTypeFilter, setLotteryTypeFilter] = useState<string | null>(null);

  useEffect(() => {
    fetchLotteries();
  }, []);

  const fetchLotteries = async () => {
    try {
      const response = await fetch(`${API_URL}/api/lotteries`);
      if (response.ok) {
        const data = await response.json();
        setLotteries(data);
      }
    } catch (error) {
      console.error('Error fetching lotteries:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get unique lottery types for filtering
  const getLotteryTypes = () => {
    const types = [...new Set(lotteries.map(l => l.lottery_type))];
    return types.sort();
  };

  // Get first selected lottery for number range reference
  const getReferenceLottery = (): Lottery | null => {
    if (selectedLotteries.length === 0) return null;
    return lotteries.find(l => l.id === selectedLotteries[0]) || null;
  };

  // Get numbers to pick based on lottery type
  const getNumbersToPick = (): number => {
    const ref = getReferenceLottery();
    if (!ref) return 1;
    return ref.numbers_to_pick;
  };

  // Toggle lottery selection
  const toggleLotterySelection = (lotteryId: string) => {
    const lottery = lotteries.find(l => l.id === lotteryId);
    if (!lottery) return;

    if (selectedLotteries.includes(lotteryId)) {
      setSelectedLotteries(selectedLotteries.filter(id => id !== lotteryId));
    } else {
      // Check if the lottery type is compatible (same numbers_to_pick)
      if (selectedLotteries.length > 0) {
        const refLottery = getReferenceLottery();
        if (refLottery && refLottery.numbers_to_pick !== lottery.numbers_to_pick) {
          Alert.alert(
            'Lotería Incompatible',
            `Esta lotería requiere ${lottery.numbers_to_pick} números, pero ya seleccionaste loterías de ${refLottery.numbers_to_pick} números.`
          );
          return;
        }
      }
      setSelectedLotteries([...selectedLotteries, lotteryId]);
    }
  };

  // Add number from manual input
  const addNumberFromInput = () => {
    const ref = getReferenceLottery();
    if (!ref || !numberInput.trim()) {
      if (!ref) Alert.alert('Error', 'Selecciona al menos una lotería primero');
      return;
    }
    
    const num = parseInt(numberInput.trim(), 10);
    
    if (isNaN(num)) {
      Alert.alert('Error', 'Ingresa un número válido');
      return;
    }
    
    if (num < ref.min_number || num > ref.max_number) {
      Alert.alert('Error', `El número debe estar entre ${ref.min_number} y ${ref.max_number}`);
      return;
    }
    
    if (selectedNumbers.includes(num)) {
      Alert.alert('Error', 'Este número ya fue seleccionado');
      return;
    }
    
    if (selectedNumbers.length >= ref.numbers_to_pick) {
      Alert.alert('Error', `Solo puedes seleccionar ${ref.numbers_to_pick} número(s)`);
      return;
    }
    
    setSelectedNumbers([...selectedNumbers, num].sort((a, b) => a - b));
    setNumberInput('');
  };

  // Quick pick random numbers
  const handleQuickPick = () => {
    const ref = getReferenceLottery();
    if (!ref) {
      Alert.alert('Error', 'Selecciona al menos una lotería primero');
      return;
    }
    
    const numbers: number[] = [];
    while (numbers.length < ref.numbers_to_pick) {
      const num = Math.floor(Math.random() * (ref.max_number - ref.min_number + 1)) + ref.min_number;
      if (!numbers.includes(num)) {
        numbers.push(num);
      }
    }
    setSelectedNumbers(numbers.sort((a, b) => a - b));
  };

  // Add plays to cart
  const addToCart = () => {
    if (selectedLotteries.length === 0) {
      Alert.alert('Error', 'Selecciona al menos una lotería');
      return;
    }

    const ref = getReferenceLottery();
    if (!ref || selectedNumbers.length !== ref.numbers_to_pick) {
      Alert.alert('Error', `Selecciona ${ref?.numbers_to_pick || 1} número(s)`);
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Ingresa un monto válido');
      return;
    }

    // Check if all selected lotteries are open
    const closedLotteries = selectedLotteries
      .map(id => lotteries.find(l => l.id === id))
      .filter(l => l && !l.is_open);
    
    if (closedLotteries.length > 0) {
      Alert.alert('Error', `Las siguientes loterías están cerradas: ${closedLotteries.map(l => l?.name).join(', ')}`);
      return;
    }

    // Add one cart item per selected lottery
    const newItems: CartItem[] = selectedLotteries.map(lotteryId => {
      const lottery = lotteries.find(l => l.id === lotteryId)!;
      return {
        id: `${Date.now()}-${lotteryId}-${Math.random().toString(36).substr(2, 9)}`,
        lotteryId: lottery.id,
        lotteryName: lottery.name,
        numbers: [...selectedNumbers],
        amount: parseFloat(amount),
        currency: lottery.currency,
        potentialWin: parseFloat(amount) * lottery.prize_multiplier,
        country: lottery.country,
      };
    });

    setCart([...cart, ...newItems]);
    setSelectedNumbers([]);
    setSelectedLotteries([]);
    
    Alert.alert('Agregado', `${newItems.length} jugada(s) agregada(s) al carrito`);
  };

  // Remove item from cart
  const removeFromCart = (itemId: string) => {
    setCart(cart.filter(item => item.id !== itemId));
  };

  // Clear entire cart
  const clearCart = () => {
    Alert.alert(
      'Limpiar Carrito',
      '¿Estás seguro de eliminar todas las jugadas?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sí, limpiar', style: 'destructive', onPress: () => setCart([]) }
      ]
    );
  };

  // Calculate cart totals
  const getCartTotals = () => {
    const totalAmount = cart.reduce((sum, item) => sum + item.amount, 0);
    const totalPotentialWin = cart.reduce((sum, item) => sum + item.potentialWin, 0);
    const currency = cart[0]?.currency || 'RD$';
    return { totalAmount, totalPotentialWin, currency };
  };

  // Submit all plays as multi-play ticket
  const handleSubmit = async () => {
    if (cart.length === 0) {
      Alert.alert('Error', 'Agrega al menos una jugada al carrito');
      return;
    }

    setSubmitting(true);
    try {
      // Group plays for the API using lottery_type
      const plays = cart.map(item => {
        const lottery = lotteries.find(l => l.id === item.lotteryId);
        return {
          lottery_type: lottery?.lottery_type || 'quiniela',
          numbers: item.numbers,
          amount: item.amount,
          position: null,
        };
      });

      const response = await fetch(`${API_URL}/api/tickets/multi`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          plays,
          customer_name: customerName || null,
          currency: cart[0].currency === 'RD$' ? 'RD' : 'USD',
        }),
      });

      if (response.ok) {
        const ticket = await response.json();
        setLastTicket(ticket);
        setShowTicketModal(true);
        setCart([]);
        setCustomerName('');
        
        if (ticket.limit_warning_message) {
          setTimeout(() => {
            Alert.alert('Alerta de Límite', ticket.limit_warning_message);
          }, 500);
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

  // Generate ticket HTML for printing
  const generateTicketHTML = (ticket: MultiPlayTicketResponse) => {
    const date = new Date(ticket.created_at);
    const qrData = encodeURIComponent(`TICKET:${ticket.ticket_number}`);
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${qrData}`;
    
    const playsHTML = ticket.plays.map((play, idx) => `
      <div class="play-item">
        <div class="play-header">
          <span class="play-num">#${idx + 1}</span>
          <span class="play-lottery">${play.lottery_name}</span>
        </div>
        <div class="play-numbers">${play.numbers.map(n => n.toString().padStart(2, '0')).join(' - ')}</div>
        <div class="play-amount">${ticket.currency} ${play.amount.toLocaleString()}</div>
      </div>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 10px; max-width: 320px; margin: 0 auto; }
          .ticket { border: 2px solid #1e3a5f; border-radius: 10px; overflow: hidden; }
          .header { background: linear-gradient(135deg, #1e3a5f, #0f172a); color: white; padding: 12px; text-align: center; }
          .brand { font-size: 18px; font-weight: bold; }
          .ticket-number { background: #22c55e; color: white; padding: 8px; text-align: center; font-weight: bold; }
          .body { padding: 12px; }
          .play-item { background: #f8fafc; border-radius: 8px; padding: 10px; margin-bottom: 8px; border-left: 3px solid #22c55e; }
          .play-header { display: flex; justify-content: space-between; margin-bottom: 6px; }
          .play-num { background: #22c55e; color: white; padding: 2px 8px; border-radius: 10px; font-size: 11px; }
          .play-lottery { font-weight: bold; color: #1e3a5f; font-size: 13px; }
          .play-numbers { font-size: 20px; font-weight: bold; color: #1e3a5f; text-align: center; padding: 8px 0; }
          .play-amount { text-align: right; color: #22c55e; font-weight: bold; }
          .totals { background: #22c55e; color: white; padding: 12px; margin-top: 10px; border-radius: 8px; }
          .total-row { display: flex; justify-content: space-between; padding: 4px 0; }
          .total-value { font-weight: bold; font-size: 18px; }
          .footer { padding: 12px; text-align: center; border-top: 2px dashed #ccc; }
          .qr-code { width: 100px; height: 100px; margin: 10px auto; display: block; }
          .footer-text { font-size: 11px; color: #666; margin-top: 8px; }
        </style>
      </head>
      <body>
        <div class="ticket">
          <div class="header">
            <div class="brand">LOTERÍA NACIONAL</div>
          </div>
          <div class="ticket-number">BOLETO: ${ticket.ticket_number}</div>
          <div class="body">
            ${ticket.customer_name ? `<p style="margin-bottom:10px;color:#666;">Cliente: ${ticket.customer_name}</p>` : ''}
            ${playsHTML}
            <div class="totals">
              <div class="total-row">
                <span>Total Jugado:</span>
                <span class="total-value">${ticket.currency} ${ticket.total_amount.toLocaleString()}</span>
              </div>
              <div class="total-row">
                <span>Premio Potencial:</span>
                <span class="total-value">${ticket.currency} ${ticket.total_potential_win.toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div class="footer">
            <img class="qr-code" src="${qrCodeUrl}" alt="QR" />
            <div class="footer-text">Fecha: ${date.toLocaleDateString('es-DO')} ${date.toLocaleTimeString('es-DO', {hour: '2-digit', minute: '2-digit'})}</div>
            <div class="footer-text">¡BUENA SUERTE!</div>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  const handlePrintTicket = async () => {
    if (!lastTicket) return;
    try {
      await Print.printAsync({ html: generateTicketHTML(lastTicket) });
    } catch (error) {
      Alert.alert('Error', 'No se pudo imprimir');
    }
  };

  const handleShareWhatsApp = async () => {
    if (!lastTicket) return;
    const date = new Date(lastTicket.created_at);
    const playsText = lastTicket.plays.map((p, i) => 
      `  ${i+1}. ${p.lottery_name}: ${p.numbers.map(n => n.toString().padStart(2, '0')).join('-')} (${lastTicket.currency} ${p.amount})`
    ).join('\n');

    const message = `🎰 *BOLETO MULTI-JUGADA*\n\n` +
      `📋 *Boleto:* ${lastTicket.ticket_number}\n` +
      `📅 *Fecha:* ${date.toLocaleDateString('es-DO')}\n` +
      `${lastTicket.customer_name ? `👤 *Cliente:* ${lastTicket.customer_name}\n` : ''}\n` +
      `*JUGADAS:*\n${playsText}\n\n` +
      `💰 *Total:* ${lastTicket.currency} ${lastTicket.total_amount.toLocaleString()}\n` +
      `🏆 *Premio Potencial:* ${lastTicket.currency} ${lastTicket.total_potential_win.toLocaleString()}\n\n` +
      `¡Buena suerte! 🍀`;

    try {
      await Share.share({ message });
    } catch (error) {
      Alert.alert('Error', 'No se pudo compartir');
    }
  };

  // Render cart item
  const renderCartItem = ({ item }: { item: CartItem }) => (
    <View style={styles.cartItem}>
      <View style={styles.cartItemContent}>
        <View style={styles.cartItemHeader}>
          <Text style={styles.cartItemLottery}>{item.lotteryName}</Text>
          <Text style={styles.cartItemCountry}>
            {item.country === 'RD' ? '🇩🇴' : '🇺🇸'}
          </Text>
        </View>
        <View style={styles.cartItemNumbers}>
          {item.numbers.map((num, idx) => (
            <View key={idx} style={styles.cartNumberBall}>
              <Text style={styles.cartNumberText}>{num.toString().padStart(2, '0')}</Text>
            </View>
          ))}
        </View>
        <View style={styles.cartItemFooter}>
          <Text style={styles.cartItemAmount}>{item.currency} {item.amount}</Text>
          <Text style={styles.cartItemWin}>Premio: {item.currency} {item.potentialWin.toLocaleString()}</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.cartRemoveButton} onPress={() => removeFromCart(item.id)}>
        <Ionicons name="trash" size={20} color="#ef4444" />
      </TouchableOpacity>
    </View>
  );

  // Get filtered lotteries
  const getFilteredLotteries = () => {
    let filtered = lotteries.filter(l => l.is_open);
    if (lotteryTypeFilter) {
      filtered = filtered.filter(l => l.lottery_type === lotteryTypeFilter);
    }
    return filtered;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#22c55e" style={styles.loader} />
      </SafeAreaView>
    );
  }

  const ref = getReferenceLottery();
  const { totalAmount, totalPotentialWin, currency } = getCartTotals();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Vender Números</Text>
        <TouchableOpacity onPress={() => setShowLotteryModal(true)}>
          <Ionicons name="list" size={24} color="#22c55e" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={[styles.contentContainer, isDesktop && styles.contentDesktop]}>
        {/* Step 1: Select Lotteries */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Text style={styles.stepNumber}>1</Text> Seleccionar Loterías
          </Text>
          <Text style={styles.sectionSubtitle}>
            Toca para seleccionar una o varias loterías
          </Text>
          
          {/* Lottery Type Filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeFilter}>
            <TouchableOpacity
              style={[styles.typeButton, !lotteryTypeFilter && styles.typeButtonActive]}
              onPress={() => setLotteryTypeFilter(null)}
            >
              <Text style={[styles.typeButtonText, !lotteryTypeFilter && styles.typeButtonTextActive]}>
                Todas
              </Text>
            </TouchableOpacity>
            {getLotteryTypes().map(type => (
              <TouchableOpacity
                key={type}
                style={[styles.typeButton, lotteryTypeFilter === type && styles.typeButtonActive]}
                onPress={() => setLotteryTypeFilter(type)}
              >
                <Text style={[styles.typeButtonText, lotteryTypeFilter === type && styles.typeButtonTextActive]}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Lottery Grid */}
          <View style={styles.lotteryGrid}>
            {getFilteredLotteries().map(lottery => (
              <TouchableOpacity
                key={lottery.id}
                style={[
                  styles.lotteryChip,
                  selectedLotteries.includes(lottery.id) && styles.lotteryChipSelected,
                ]}
                onPress={() => toggleLotterySelection(lottery.id)}
              >
                <View style={styles.lotteryChipContent}>
                  <Text style={styles.lotteryChipFlag}>
                    {lottery.country === 'RD' ? '🇩🇴' : '🇺🇸'}
                  </Text>
                  <Text style={[
                    styles.lotteryChipName,
                    selectedLotteries.includes(lottery.id) && styles.lotteryChipNameSelected
                  ]} numberOfLines={1}>
                    {lottery.name}
                  </Text>
                  {selectedLotteries.includes(lottery.id) && (
                    <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
                  )}
                </View>
                <Text style={styles.lotteryChipInfo}>
                  x{lottery.prize_multiplier} • {lottery.numbers_to_pick}N
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {selectedLotteries.length > 0 && (
            <View style={styles.selectionSummary}>
              <Text style={styles.selectionText}>
                {selectedLotteries.length} lotería(s) seleccionada(s)
              </Text>
              <TouchableOpacity onPress={() => setSelectedLotteries([])}>
                <Text style={styles.clearSelectionText}>Limpiar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Step 2: Enter Numbers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Text style={styles.stepNumber}>2</Text> Ingresar Números
          </Text>
          {ref ? (
            <>
              <Text style={styles.sectionSubtitle}>
                Rango: {ref.min_number}-{ref.max_number} | Seleccionar: {ref.numbers_to_pick} número(s)
              </Text>
              <View style={styles.numberInputRow}>
                <TextInput
                  style={styles.numberInput}
                  value={numberInput}
                  onChangeText={setNumberInput}
                  placeholder={`Ej: ${ref.min_number}`}
                  placeholderTextColor="#64748b"
                  keyboardType="numeric"
                  maxLength={3}
                  onSubmitEditing={addNumberFromInput}
                />
                <TouchableOpacity style={styles.addButton} onPress={addNumberFromInput}>
                  <Ionicons name="add" size={24} color="#ffffff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.randomButton} onPress={handleQuickPick}>
                  <Ionicons name="shuffle" size={20} color="#ffffff" />
                </TouchableOpacity>
              </View>

              <View style={styles.selectedNumbers}>
                {selectedNumbers.length > 0 ? (
                  selectedNumbers.map(num => (
                    <TouchableOpacity
                      key={num}
                      style={styles.selectedBall}
                      onPress={() => setSelectedNumbers(selectedNumbers.filter(n => n !== num))}
                    >
                      <Text style={styles.selectedBallText}>{num.toString().padStart(2, '0')}</Text>
                      <Ionicons name="close" size={14} color="#fff" style={styles.removeBallIcon} />
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.noNumbers}>Ingresa números arriba</Text>
                )}
              </View>
            </>
          ) : (
            <Text style={styles.noLotteryText}>Selecciona una lotería primero</Text>
          )}
        </View>

        {/* Step 3: Amount and Add to Cart */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Text style={styles.stepNumber}>3</Text> Monto y Agregar
          </Text>
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>{ref?.currency || 'RD$'}</Text>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="20"
              placeholderTextColor="#64748b"
            />
            <TouchableOpacity
              style={[styles.addToCartButton, (!ref || selectedNumbers.length !== ref.numbers_to_pick) && styles.buttonDisabled]}
              onPress={addToCart}
              disabled={!ref || selectedNumbers.length !== ref.numbers_to_pick}
            >
              <Ionicons name="cart" size={20} color="#ffffff" />
              <Text style={styles.addToCartText}>Agregar al Carrito</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Cart Section */}
        <View style={styles.section}>
          <View style={styles.cartHeader}>
            <Text style={styles.sectionTitle}>
              <Text style={styles.stepNumber}>4</Text> Carrito ({cart.length} jugadas)
            </Text>
            {cart.length > 0 && (
              <TouchableOpacity onPress={clearCart}>
                <Text style={styles.clearCartText}>Vaciar</Text>
              </TouchableOpacity>
            )}
          </View>

          {cart.length > 0 ? (
            <>
              <FlatList
                data={cart}
                renderItem={renderCartItem}
                keyExtractor={item => item.id}
                scrollEnabled={false}
              />

              {/* Customer Name */}
              <View style={styles.customerSection}>
                <Text style={styles.customerLabel}>Nombre del cliente (opcional)</Text>
                <TextInput
                  style={styles.customerInput}
                  value={customerName}
                  onChangeText={setCustomerName}
                  placeholder="Nombre"
                  placeholderTextColor="#64748b"
                />
              </View>

              {/* Totals */}
              <View style={styles.totalsCard}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total a Pagar:</Text>
                  <Text style={styles.totalValue}>{currency} {totalAmount.toLocaleString()}</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Premio Potencial:</Text>
                  <Text style={[styles.totalValue, styles.totalWin]}>
                    {currency} {totalPotentialWin.toLocaleString()}
                  </Text>
                </View>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.buttonDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={24} color="#ffffff" />
                    <Text style={styles.submitText}>Crear Ticket ({cart.length} jugadas)</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.emptyCart}>
              <Ionicons name="cart-outline" size={48} color="#475569" />
              <Text style={styles.emptyCartText}>El carrito está vacío</Text>
              <Text style={styles.emptyCartSubtext}>Agrega jugadas seleccionando loterías y números</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Lottery Selection Modal */}
      <Modal visible={showLotteryModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDesktop && styles.modalContentDesktop]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Todas las Loterías</Text>
              <TouchableOpacity onPress={() => setShowLotteryModal(false)}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {lotteries.map(lottery => (
                <TouchableOpacity
                  key={lottery.id}
                  style={[
                    styles.lotteryOption,
                    selectedLotteries.includes(lottery.id) && styles.lotteryOptionSelected,
                    !lottery.is_open && styles.lotteryOptionClosed,
                  ]}
                  onPress={() => toggleLotterySelection(lottery.id)}
                >
                  <View style={styles.lotteryOptionContent}>
                    <Text style={styles.lotteryOptionFlag}>
                      {lottery.country === 'RD' ? '🇩🇴' : '🇺🇸'}
                    </Text>
                    <View style={styles.lotteryOptionInfo}>
                      <Text style={styles.lotteryOptionName}>{lottery.name}</Text>
                      <Text style={styles.lotteryOptionDetails}>
                        {lottery.currency} {lottery.price} • x{lottery.prize_multiplier} • {lottery.numbers_to_pick}N
                      </Text>
                    </View>
                  </View>
                  {selectedLotteries.includes(lottery.id) && (
                    <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                  )}
                  {!lottery.is_open && (
                    <View style={styles.closedBadge}>
                      <Text style={styles.closedBadgeText}>CERRADA</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowLotteryModal(false)}
            >
              <Text style={styles.modalCloseText}>Listo ({selectedLotteries.length} seleccionadas)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Ticket Created Modal */}
      <Modal visible={showTicketModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.ticketModalContent, isDesktop && styles.modalContentDesktop]}>
            <View style={styles.ticketModalHeader}>
              <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
              <Text style={styles.ticketModalTitle}>¡Venta Exitosa!</Text>
            </View>
            
            {lastTicket && (
              <View style={styles.ticketPreview}>
                <Text style={styles.ticketNumber}>{lastTicket.ticket_number}</Text>
                <Text style={styles.ticketPlaysCount}>{lastTicket.plays.length} jugada(s)</Text>
                
                <ScrollView style={styles.ticketPlaysList} nestedScrollEnabled>
                  {lastTicket.plays.map((play, idx) => (
                    <View key={idx} style={styles.ticketPlay}>
                      <Text style={styles.ticketPlayLottery}>{play.lottery_name}</Text>
                      <Text style={styles.ticketPlayNumbers}>
                        {play.numbers.map(n => n.toString().padStart(2, '0')).join(' - ')}
                      </Text>
                    </View>
                  ))}
                </ScrollView>

                <View style={styles.ticketTotals}>
                  <View style={styles.ticketTotalRow}>
                    <Text style={styles.ticketTotalLabel}>Total:</Text>
                    <Text style={styles.ticketTotalValue}>
                      {lastTicket.currency} {lastTicket.total_amount.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.ticketTotalRow}>
                    <Text style={styles.ticketTotalLabel}>Premio Potencial:</Text>
                    <Text style={[styles.ticketTotalValue, styles.ticketWinValue]}>
                      {lastTicket.currency} {lastTicket.total_potential_win.toLocaleString()}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            <View style={styles.ticketActions}>
              <TouchableOpacity style={styles.ticketActionButton} onPress={handlePrintTicket}>
                <Ionicons name="print" size={24} color="#ffffff" />
                <Text style={styles.ticketActionText}>Imprimir</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.ticketActionButton, styles.whatsappButton]} onPress={handleShareWhatsApp}>
                <Ionicons name="logo-whatsapp" size={24} color="#ffffff" />
                <Text style={styles.ticketActionText}>WhatsApp</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.closeTicketButton}
              onPress={() => setShowTicketModal(false)}
            >
              <Text style={styles.closeTicketButtonText}>Cerrar y Continuar</Text>
            </TouchableOpacity>
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
    backgroundColor: '#1e293b',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  contentDesktop: {
    maxWidth: 900,
    alignSelf: 'center',
    width: '100%',
  },
  section: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  stepNumber: {
    backgroundColor: '#22c55e',
    color: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: 8,
    fontSize: 14,
    overflow: 'hidden',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 12,
  },
  typeFilter: {
    marginBottom: 12,
  },
  typeButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#334155',
    marginRight: 8,
  },
  typeButtonActive: {
    backgroundColor: '#22c55e',
  },
  typeButtonText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  typeButtonTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  lotteryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  lotteryChip: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 10,
    minWidth: 140,
    borderWidth: 2,
    borderColor: '#334155',
  },
  lotteryChipSelected: {
    borderColor: '#22c55e',
    backgroundColor: '#14532d20',
  },
  lotteryChipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lotteryChipFlag: {
    fontSize: 16,
  },
  lotteryChipName: {
    flex: 1,
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '500',
  },
  lotteryChipNameSelected: {
    color: '#22c55e',
  },
  lotteryChipInfo: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
  },
  selectionSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  selectionText: {
    fontSize: 13,
    color: '#22c55e',
    fontWeight: '500',
  },
  clearSelectionText: {
    fontSize: 13,
    color: '#ef4444',
  },
  numberInputRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  numberInput: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 14,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    borderWidth: 2,
    borderColor: '#334155',
  },
  addButton: {
    backgroundColor: '#22c55e',
    width: 52,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  randomButton: {
    backgroundColor: '#3b82f6',
    width: 52,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedNumbers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    minHeight: 50,
    gap: 8,
  },
  selectedBall: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedBallText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  removeBallIcon: {
    marginLeft: 6,
  },
  noNumbers: {
    color: '#64748b',
    fontStyle: 'italic',
  },
  noLotteryText: {
    color: '#64748b',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  amountLabel: {
    fontSize: 16,
    color: '#22c55e',
    fontWeight: '600',
  },
  amountInput: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    width: 80,
    textAlign: 'center',
    borderWidth: 2,
    borderColor: '#334155',
  },
  addToCartButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8b5cf6',
    padding: 14,
    borderRadius: 10,
    gap: 8,
  },
  addToCartText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },
  buttonDisabled: {
    opacity: 0.5,
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
  },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#22c55e',
  },
  cartItemContent: {
    flex: 1,
  },
  cartItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cartItemLottery: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  cartItemCountry: {
    fontSize: 16,
  },
  cartItemNumbers: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  cartNumberBall: {
    backgroundColor: '#22c55e',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartNumberText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  cartItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cartItemAmount: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '500',
  },
  cartItemWin: {
    fontSize: 12,
    color: '#22c55e',
  },
  cartRemoveButton: {
    padding: 8,
    justifyContent: 'center',
  },
  customerSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  customerLabel: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 8,
  },
  customerInput: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#334155',
  },
  totalsCard: {
    backgroundColor: '#14532d',
    borderRadius: 10,
    padding: 16,
    marginTop: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  totalLabel: {
    fontSize: 14,
    color: '#86efac',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  totalWin: {
    color: '#22c55e',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    gap: 8,
  },
  submitText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyCart: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyCartText: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 12,
  },
  emptyCartSubtext: {
    fontSize: 13,
    color: '#475569',
    marginTop: 4,
    textAlign: 'center',
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
  lotteryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  lotteryOptionSelected: {
    backgroundColor: '#14532d20',
  },
  lotteryOptionClosed: {
    opacity: 0.5,
  },
  lotteryOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  lotteryOptionFlag: {
    fontSize: 20,
    marginRight: 12,
  },
  lotteryOptionInfo: {
    flex: 1,
  },
  lotteryOptionName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#ffffff',
  },
  lotteryOptionDetails: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  closedBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  closedBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  modalCloseButton: {
    backgroundColor: '#22c55e',
    margin: 16,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  ticketModalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '85%',
  },
  ticketModalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  ticketModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 12,
  },
  ticketPreview: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  ticketNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#22c55e',
    textAlign: 'center',
  },
  ticketPlaysCount: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  ticketPlaysList: {
    maxHeight: 200,
  },
  ticketPlay: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#22c55e',
  },
  ticketPlayLottery: {
    fontSize: 12,
    color: '#94a3b8',
  },
  ticketPlayNumbers: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 4,
  },
  ticketTotals: {
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 12,
    marginTop: 12,
  },
  ticketTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  ticketTotalLabel: {
    fontSize: 14,
    color: '#94a3b8',
  },
  ticketTotalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  ticketWinValue: {
    color: '#22c55e',
  },
  ticketActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  ticketActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  whatsappButton: {
    backgroundColor: '#25D366',
  },
  ticketActionText: {
    color: '#ffffff',
    fontWeight: '600',
    marginLeft: 8,
  },
  closeTicketButton: {
    backgroundColor: '#334155',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeTicketButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
});

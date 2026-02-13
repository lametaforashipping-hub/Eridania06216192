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
import * as Haptics from 'expo-haptics';

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

interface FavoritePlay {
  lottery_type: string;
  lottery_id?: string;
  numbers: number[];
  amount: number;
}

interface Favorite {
  id: string;
  name: string;
  plays: FavoritePlay[];
  currency: string;
  use_count: number;
  created_at: string;
  last_used?: string;
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
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [showFavoritesModal, setShowFavoritesModal] = useState(false);
  const [showSaveFavoriteModal, setShowSaveFavoriteModal] = useState(false);
  const [favoriteName, setFavoriteName] = useState('');
  const [savingFavorite, setSavingFavorite] = useState(false);

  useEffect(() => {
    fetchLotteries();
    fetchFavorites();
  }, []);

  const fetchFavorites = async () => {
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
    }
  };

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
    
    // Haptic feedback when items are added to cart (mobile only)
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    
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

  // Save current cart as favorite
  const handleSaveFavorite = async () => {
    if (cart.length === 0) {
      Alert.alert('Error', 'Agrega jugadas al carrito primero');
      return;
    }

    if (!favoriteName.trim()) {
      Alert.alert('Error', 'Ingresa un nombre para el favorito');
      return;
    }

    setSavingFavorite(true);
    try {
      const plays = cart.map(item => {
        const lottery = lotteries.find(l => l.id === item.lotteryId);
        return {
          lottery_type: lottery?.lottery_type || 'quiniela',
          lottery_id: item.lotteryId,
          numbers: item.numbers,
          amount: item.amount,
        };
      });

      const response = await fetch(`${API_URL}/api/favorites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: favoriteName.trim(),
          plays,
          currency: cart[0]?.currency === 'RD$' ? 'RD' : 'USD',
        }),
      });

      if (response.ok) {
        Alert.alert('Éxito', `Favorito "${favoriteName}" guardado`);
        setShowSaveFavoriteModal(false);
        setFavoriteName('');
        fetchFavorites();
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'No se pudo guardar');
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setSavingFavorite(false);
    }
  };

  // Use a favorite - add to cart
  const handleUseFavorite = async (favorite: Favorite) => {
    try {
      // Add plays to cart
      const newItems: CartItem[] = [];
      
      for (const play of favorite.plays) {
        // Find lottery by type or id
        let lottery = play.lottery_id 
          ? lotteries.find(l => l.id === play.lottery_id)
          : lotteries.find(l => l.lottery_type === play.lottery_type && l.is_open);
        
        if (!lottery) {
          lottery = lotteries.find(l => l.lottery_type === play.lottery_type);
        }
        
        if (lottery) {
          newItems.push({
            id: `${Date.now()}-${lottery.id}-${Math.random().toString(36).substr(2, 9)}`,
            lotteryId: lottery.id,
            lotteryName: lottery.name,
            numbers: play.numbers,
            amount: play.amount,
            currency: lottery.currency,
            potentialWin: play.amount * lottery.prize_multiplier,
            country: lottery.country,
          });
        }
      }

      if (newItems.length > 0) {
        setCart([...cart, ...newItems]);
        
        // Haptic feedback when favorites are added (mobile only)
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        
        // Increment use count
        await fetch(`${API_URL}/api/favorites/${favorite.id}/use`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        });
        
        setShowFavoritesModal(false);
        Alert.alert('Agregado', `Favorito "${favorite.name}" agregado al carrito (${newItems.length} jugadas)`);
        fetchFavorites();
      } else {
        Alert.alert('Error', 'No se encontraron loterías disponibles para este favorito');
      }
    } catch (error) {
      Alert.alert('Error', 'Error al usar favorito');
    }
  };

  // Delete favorite
  const handleDeleteFavorite = (favorite: Favorite) => {
    Alert.alert(
      'Eliminar Favorito',
      `¿Eliminar "${favorite.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await fetch(`${API_URL}/api/favorites/${favorite.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
              });
              fetchFavorites();
              Alert.alert('Eliminado', 'Favorito eliminado');
            } catch (error) {
              Alert.alert('Error', 'No se pudo eliminar');
            }
          }
        }
      ]
    );
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
          currency: cart[0].currency,
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
        // Handle token expired error
        if (response.status === 401 && (error.detail?.includes('expirado') || error.detail?.includes('Token'))) {
          Alert.alert('Sesión Expirada', 'Tu sesión ha expirado. Por favor, cierra la sesión y vuelve a iniciar.');
          router.replace('/');
        } else {
          Alert.alert('Error', error.detail || 'No se pudo crear el boleto');
        }
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
    
    // Generate QR code URL - Contains only ticket ID for system lookup
    const qrData = encodeURIComponent(ticket.ticket_number);
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${qrData}&bgcolor=ffffff&color=1e3a5f`;

    // Company Logo URL
    const logoUrl = 'https://customer-assets.emergentagent.com/job_0d52222c-173f-46ac-b2b0-ffceca2336e1/artifacts/cql3117b_loteria.jpg';
    
    const playsHTML = ticket.plays.map((play, idx) => `
      <div class="play-row">
        <span class="play-num">#${idx + 1}</span>
        <span class="play-lottery">${play.lottery_name}</span>
        <span class="play-numbers">${play.numbers.map(n => n.toString().padStart(2, '0')).join('-')}</span>
        <span class="play-amount">${ticket.currency} ${play.amount}</span>
      </div>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            padding: 0; 
            max-width: 320px; 
            margin: 0 auto; 
            background: #fff; 
          }
          .ticket { 
            border: 3px solid #1a365d; 
            border-radius: 16px; 
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
          
          /* Header con Logo */
          .header { 
            background: linear-gradient(180deg, #ffffff 0%, #f0f4f8 100%);
            padding: 20px 15px 15px; 
            text-align: center;
            border-bottom: 3px solid #1a365d;
          }
          .logo-container {
            width: 100px;
            height: 100px;
            margin: 0 auto 10px;
            border-radius: 12px;
            overflow: hidden;
            border: 2px solid #1a365d;
          }
          .logo-img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .brand-name { 
            font-size: 22px; 
            font-weight: 800; 
            color: #1a365d;
            letter-spacing: 1px;
            text-transform: uppercase;
          }
          .brand-tagline {
            font-size: 11px;
            color: #64748b;
            margin-top: 4px;
            font-style: italic;
          }
          
          /* Ticket Number Section */
          .ticket-number-section { 
            background: linear-gradient(135deg, #1a365d 0%, #2d4a6f 100%);
            color: white; 
            padding: 12px 15px; 
            text-align: center;
          }
          .ticket-label { 
            font-size: 11px; 
            opacity: 0.85;
            letter-spacing: 2px;
            text-transform: uppercase;
          }
          .ticket-number { 
            font-size: 20px; 
            font-weight: 800; 
            letter-spacing: 2px; 
            margin-top: 4px;
            font-family: 'Courier New', monospace;
          }
          
          /* Date and Customer Info */
          .info-section {
            background: #f8fafc;
            padding: 12px 15px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #e2e8f0;
          }
          .date-info {
            font-size: 13px;
            color: #475569;
            font-weight: 600;
          }
          .customer-info {
            font-size: 12px;
            color: #64748b;
            text-align: right;
          }
          
          /* Plays Section */
          .body { padding: 15px; background: #fff; }
          .plays-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 2px solid #1a365d;
          }
          .plays-title { 
            font-weight: 700; 
            font-size: 14px; 
            color: #1a365d;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .plays-count {
            background: #1a365d;
            color: white;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
          }
          .play-row { 
            display: flex; 
            flex-wrap: wrap;
            justify-content: space-between; 
            padding: 10px 8px; 
            margin-bottom: 6px;
            background: #f8fafc;
            border-radius: 8px;
            border-left: 4px solid #22c55e;
            align-items: center; 
          }
          .play-num { 
            background: #64748b; 
            color: white; 
            padding: 2px 8px; 
            border-radius: 10px; 
            font-size: 10px;
            font-weight: 600;
          }
          .play-lottery {
            font-size: 11px;
            color: #1a365d;
            font-weight: 600;
            flex: 1;
            margin-left: 8px;
          }
          .play-numbers { 
            font-weight: 800; 
            font-size: 20px; 
            color: #1a365d; 
            letter-spacing: 3px;
            font-family: 'Courier New', monospace;
            width: 100%;
            text-align: center;
            margin: 8px 0;
          }
          .play-amount { 
            color: #22c55e; 
            font-weight: 700; 
            font-size: 14px;
            width: 100%;
            text-align: right;
          }
          
          /* Totals Section */
          .totals { 
            background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); 
            border-radius: 12px; 
            padding: 16px; 
            margin: 15px 0;
            text-align: center;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
          }
          .total-row:last-child { margin-bottom: 0; }
          .total-label { 
            color: rgba(255,255,255,0.9); 
            font-size: 13px;
            font-weight: 500;
          }
          .total-amount { 
            font-size: 24px; 
            font-weight: 800; 
            color: #fff;
          }
          .potential-label {
            color: rgba(255,255,255,0.8);
            font-size: 11px;
          }
          .potential-amount {
            color: #fef08a;
            font-size: 16px;
            font-weight: 700;
          }
          
          /* QR Footer Section */
          .footer { 
            background: linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%);
            padding: 20px 15px; 
            text-align: center; 
            border-top: 2px dashed #94a3b8;
          }
          .qr-container { 
            background: #fff; 
            padding: 12px; 
            margin: 0 auto 12px; 
            border-radius: 12px;
            display: inline-block;
            border: 3px solid #1a365d;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .qr-code { 
            width: 130px; 
            height: 130px; 
            display: block;
          }
          .qr-label { 
            font-size: 10px; 
            color: #64748b; 
            margin-top: 8px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .scan-text {
            font-size: 12px;
            color: #1a365d;
            font-weight: 600;
            margin-top: 10px;
          }
          .footer-notes { 
            margin-top: 12px;
            padding-top: 12px;
            border-top: 1px solid #cbd5e1;
          }
          .footer-text { 
            font-size: 10px; 
            color: #64748b; 
            margin: 3px 0;
          }
          
          /* Promo Bar */
          .promo { 
            background: linear-gradient(135deg, #1a365d 0%, #2d4a6f 100%);
            color: #fbbf24; 
            padding: 12px; 
            text-align: center; 
            font-size: 14px; 
            font-weight: 700;
            letter-spacing: 2px;
          }
        </style>
      </head>
      <body>
        <div class="ticket">
          <!-- Header con Logo de Empresa -->
          <div class="header">
            <div class="logo-container">
              <img class="logo-img" src="${logoUrl}" alt="Loteria Magic" />
            </div>
            <div class="brand-name">Loteria Magic</div>
            <div class="brand-tagline">Tu suerte comienza aqui</div>
          </div>
          
          <!-- Numero de Ticket -->
          <div class="ticket-number-section">
            <div class="ticket-label">Boleto No.</div>
            <div class="ticket-number">${ticket.ticket_number}</div>
          </div>
          
          <!-- Info de Fecha y Cliente -->
          <div class="info-section">
            <div class="date-info">
              ${date.toLocaleDateString('es-DO', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
              <br>${date.toLocaleTimeString('es-DO', {hour: '2-digit', minute: '2-digit'})}
            </div>
            ${ticket.customer_name ? `<div class="customer-info">Cliente:<br><strong>${ticket.customer_name}</strong></div>` : ''}
          </div>
          
          <!-- Jugadas -->
          <div class="body">
            <div class="plays-header">
              <span class="plays-title">Jugadas</span>
              <span class="plays-count">${ticket.plays.length}</span>
            </div>
            ${playsHTML}
            
            <!-- Totales -->
            <div class="totals">
              <div class="total-row">
                <span class="total-label">Total Jugado:</span>
                <span class="total-amount">${ticket.currency} ${ticket.total_amount.toLocaleString()}</span>
              </div>
              <div class="total-row">
                <span class="potential-label">Premio Potencial:</span>
                <span class="potential-amount">${ticket.currency} ${ticket.total_potential_win.toLocaleString()}</span>
              </div>
            </div>
          </div>
          
          <!-- Footer con QR -->
          <div class="footer">
            <div class="qr-container">
              <img class="qr-code" src="${qrCodeUrl}" alt="QR Code" />
              <div class="qr-label">ID: ${ticket.ticket_number}</div>
            </div>
            <div class="scan-text">Escanea para verificar tu boleto</div>
            <div class="footer-notes">
              <div class="footer-text">Conserve este boleto para cobrar su premio</div>
              <div class="footer-text">Valido solo con boleto original</div>
            </div>
          </div>
          
          <!-- Promo -->
          <div class="promo">BUENA SUERTE!</div>
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
            <View style={styles.cartHeaderButtons}>
              <TouchableOpacity 
                style={styles.favoritesButton} 
                onPress={() => setShowFavoritesModal(true)}
              >
                <Ionicons name="star" size={18} color="#f59e0b" />
                <Text style={styles.favoritesButtonText}>Favoritos</Text>
              </TouchableOpacity>
              {cart.length > 0 && (
                <TouchableOpacity onPress={clearCart}>
                  <Text style={styles.clearCartText}>Vaciar</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {cart.length > 0 ? (
            <>
              <FlatList
                data={cart}
                renderItem={renderCartItem}
                keyExtractor={item => item.id}
                scrollEnabled={false}
              />

              {/* Save as Favorite Button */}
              <TouchableOpacity 
                style={styles.saveFavoriteButton}
                onPress={() => setShowSaveFavoriteModal(true)}
              >
                <Ionicons name="star-outline" size={20} color="#f59e0b" />
                <Text style={styles.saveFavoriteText}>Guardar como Favorito</Text>
              </TouchableOpacity>

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

      {/* Favorites List Modal */}
      <Modal visible={showFavoritesModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDesktop && styles.modalContentDesktop]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>⭐ Mis Favoritos</Text>
              <TouchableOpacity onPress={() => setShowFavoritesModal(false)}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.favoritesListContainer}>
              {favorites.length > 0 ? (
                favorites.map(fav => (
                  <View key={fav.id} style={styles.favoriteItem}>
                    <TouchableOpacity 
                      style={styles.favoriteItemContent}
                      onPress={() => handleUseFavorite(fav)}
                    >
                      <View style={styles.favoriteItemHeader}>
                        <Text style={styles.favoriteItemName}>{fav.name}</Text>
                        <Text style={styles.favoriteItemUses}>
                          Usado {fav.use_count}x
                        </Text>
                      </View>
                      <Text style={styles.favoriteItemPlays}>
                        {fav.plays.length} jugada(s) • {fav.plays.map(p => p.numbers.join('-')).join(', ')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.favoriteDeleteButton}
                      onPress={() => handleDeleteFavorite(fav)}
                    >
                      <Ionicons name="trash" size={20} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))
              ) : (
                <View style={styles.emptyFavorites}>
                  <Ionicons name="star-outline" size={48} color="#475569" />
                  <Text style={styles.emptyFavoritesText}>No tienes favoritos</Text>
                  <Text style={styles.emptyFavoritesSubtext}>
                    Agrega jugadas al carrito y guárdalas como favorito
                  </Text>
                </View>
              )}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowFavoritesModal(false)}
            >
              <Text style={styles.modalCloseText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Save Favorite Modal */}
      <Modal visible={showSaveFavoriteModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.saveFavoriteModalContent, isDesktop && styles.modalContentDesktop]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>⭐ Guardar Favorito</Text>
              <TouchableOpacity onPress={() => setShowSaveFavoriteModal(false)}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
            <View style={styles.saveFavoriteForm}>
              <Text style={styles.saveFavoriteLabel}>Nombre del favorito:</Text>
              <TextInput
                style={styles.saveFavoriteInput}
                value={favoriteName}
                onChangeText={setFavoriteName}
                placeholder="Ej: Don Pedro - 25"
                placeholderTextColor="#64748b"
                autoFocus
              />
              <Text style={styles.saveFavoriteInfo}>
                Se guardarán {cart.length} jugadas del carrito
              </Text>
              <TouchableOpacity
                style={[styles.saveFavoriteSubmit, savingFavorite && styles.buttonDisabled]}
                onPress={handleSaveFavorite}
                disabled={savingFavorite}
              >
                {savingFavorite ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="star" size={20} color="#ffffff" />
                    <Text style={styles.saveFavoriteSubmitText}>Guardar Favorito</Text>
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
  cartHeaderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  favoritesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  favoritesButtonText: {
    color: '#f59e0b',
    fontSize: 13,
    fontWeight: '500',
  },
  saveFavoriteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderStyle: 'dashed',
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
    gap: 8,
  },
  saveFavoriteText: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '500',
  },
  favoritesListContainer: {
    maxHeight: 400,
    padding: 16,
  },
  favoriteItem: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  favoriteItemContent: {
    flex: 1,
  },
  favoriteItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  favoriteItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  favoriteItemUses: {
    fontSize: 11,
    color: '#f59e0b',
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  favoriteItemPlays: {
    fontSize: 13,
    color: '#94a3b8',
  },
  favoriteDeleteButton: {
    padding: 8,
    justifyContent: 'center',
  },
  emptyFavorites: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyFavoritesText: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 12,
  },
  emptyFavoritesSubtext: {
    fontSize: 13,
    color: '#475569',
    marginTop: 4,
    textAlign: 'center',
  },
  saveFavoriteModalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    marginHorizontal: 20,
    marginTop: 'auto',
    marginBottom: 'auto',
  },
  saveFavoriteForm: {
    padding: 20,
  },
  saveFavoriteLabel: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 8,
  },
  saveFavoriteInput: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
  },
  saveFavoriteInfo: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 16,
  },
  saveFavoriteSubmit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f59e0b',
    padding: 14,
    borderRadius: 10,
    gap: 8,
  },
  saveFavoriteSubmitText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

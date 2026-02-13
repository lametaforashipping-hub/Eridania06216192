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

interface PlayTypeConfig {
  name: string;
  numbers_count: number;
  multipliers: {
    first: number;
    second: number;
    third: number;
  };
  enabled: boolean;
}

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
  play_types?: { [key: string]: PlayTypeConfig };
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
  playType: string;
  playTypeName: string;
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
  const [selectedLotteries, setSelectedLotteries] = useState<string[]>([]); // Multi-select loterías
  const [selectedPlayType, setSelectedPlayType] = useState<string | null>(null);
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
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [showFavoritesModal, setShowFavoritesModal] = useState(false);
  const [showSaveFavoriteModal, setShowSaveFavoriteModal] = useState(false);
  const [favoriteName, setFavoriteName] = useState('');
  const [savingFavorite, setSavingFavorite] = useState(false);
  // Recent plays state
  const [recentPlays, setRecentPlays] = useState<any[]>([]);
  const [showRecentModal, setShowRecentModal] = useState(false);
  const [loadingRecent, setLoadingRecent] = useState(false);

  useEffect(() => {
    fetchLotteries();
    fetchFavorites();
    fetchRecentPlays();
  }, []);

  const fetchRecentPlays = async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/api/tickets/recent-plays?limit=15`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setRecentPlays(data);
      }
    } catch (error) {
      console.error('Error fetching recent plays:', error);
    }
  };

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

  // Get selected lottery (first one for play type config - all share same play types structure)
  const getSelectedLottery = (): Lottery | null => {
    if (selectedLotteries.length === 0) return null;
    return lotteries.find(l => l.id === selectedLotteries[0]) || null;
  };

  // Get all selected lotteries
  const getSelectedLotteriesData = (): Lottery[] => {
    return lotteries.filter(l => selectedLotteries.includes(l.id));
  };

  // Get selected play type config
  const getSelectedPlayTypeConfig = (): PlayTypeConfig | null => {
    const lottery = getSelectedLottery();
    if (!lottery || !selectedPlayType || !lottery.play_types) return null;
    return lottery.play_types[selectedPlayType] || null;
  };

  // Get numbers to pick based on selected play type
  const getNumbersToPick = (): number => {
    const playTypeConfig = getSelectedPlayTypeConfig();
    if (playTypeConfig) return playTypeConfig.numbers_count;
    return 1;
  };

  // Toggle lottery selection (multi-select)
  const handleSelectLottery = (lotteryId: string) => {
    const lottery = lotteries.find(l => l.id === lotteryId);
    if (!lottery) return;
    
    if (!lottery.is_open) {
      Alert.alert('Lotería Cerrada', lottery.closed_message || 'Esta lotería está cerrada');
      return;
    }
    
    setSelectedLotteries(prev => {
      if (prev.includes(lotteryId)) {
        // Deselect - remove from array
        const newSelection = prev.filter(id => id !== lotteryId);
        // If no lotteries selected, reset play type and numbers
        if (newSelection.length === 0) {
          setSelectedPlayType(null);
          setSelectedNumbers([]);
        }
        return newSelection;
      } else {
        // Select - add to array
        return [...prev, lotteryId];
      }
    });
  };

  // Select all open lotteries
  const handleSelectAllLotteries = () => {
    const openLotteries = getFilteredLotteries().filter(l => l.is_open);
    if (selectedLotteries.length === openLotteries.length) {
      // Deselect all
      setSelectedLotteries([]);
      setSelectedPlayType(null);
      setSelectedNumbers([]);
    } else {
      // Select all open
      setSelectedLotteries(openLotteries.map(l => l.id));
    }
  };

  // Clear lottery selection
  const handleClearLotteries = () => {
    setSelectedLotteries([]);
    setSelectedPlayType(null);
    setSelectedNumbers([]);
  };

  // Select a play type
  const handleSelectPlayType = (playType: string) => {
    setSelectedPlayType(playType);
    setSelectedNumbers([]); // Reset numbers when play type changes
  };

  // Add number from manual input
  const addNumberFromInput = () => {
    const lottery = getSelectedLottery();
    const playTypeConfig = getSelectedPlayTypeConfig();
    
    if (!lottery || !playTypeConfig || !numberInput.trim()) {
      if (!lottery) Alert.alert('Error', 'Selecciona una lotería primero');
      else if (!playTypeConfig) Alert.alert('Error', 'Selecciona un tipo de jugada');
      return;
    }
    
    const num = parseInt(numberInput.trim(), 10);
    
    if (isNaN(num)) {
      Alert.alert('Error', 'Ingresa un número válido');
      return;
    }
    
    if (num < lottery.min_number || num > lottery.max_number) {
      Alert.alert('Error', `El número debe estar entre ${lottery.min_number} y ${lottery.max_number}`);
      return;
    }
    
    if (selectedNumbers.includes(num)) {
      Alert.alert('Error', 'Este número ya fue seleccionado');
      return;
    }
    
    if (selectedNumbers.length >= playTypeConfig.numbers_count) {
      Alert.alert('Error', `Solo puedes seleccionar ${playTypeConfig.numbers_count} número(s) para ${playTypeConfig.name}`);
      return;
    }
    
    setSelectedNumbers([...selectedNumbers, num].sort((a, b) => a - b));
    setNumberInput('');
  };

  // Quick pick random numbers
  const handleQuickPick = () => {
    const lottery = getSelectedLottery();
    const playTypeConfig = getSelectedPlayTypeConfig();
    
    if (!lottery || !playTypeConfig) {
      if (!lottery) Alert.alert('Error', 'Selecciona una lotería primero');
      else if (!playTypeConfig) Alert.alert('Error', 'Selecciona un tipo de jugada');
      return;
    }
    
    const numbers: number[] = [];
    while (numbers.length < playTypeConfig.numbers_count) {
      const num = Math.floor(Math.random() * (lottery.max_number - lottery.min_number + 1)) + lottery.min_number;
      if (!numbers.includes(num)) {
        numbers.push(num);
      }
    }
    setSelectedNumbers(numbers.sort((a, b) => a - b));
  };

  // Add plays to cart - creates one cart item per selected lottery
  const addToCart = () => {
    const selectedLotteriesData = getSelectedLotteriesData();
    const playTypeConfig = getSelectedPlayTypeConfig();
    
    if (selectedLotteriesData.length === 0) {
      Alert.alert('Error', 'Selecciona al menos una lotería');
      return;
    }
    
    if (!playTypeConfig || !selectedPlayType) {
      Alert.alert('Error', 'Selecciona un tipo de jugada');
      return;
    }

    if (selectedNumbers.length !== playTypeConfig.numbers_count) {
      Alert.alert('Error', `Selecciona ${playTypeConfig.numbers_count} número(s) para ${playTypeConfig.name}`);
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Ingresa un monto válido');
      return;
    }

    // Check all selected lotteries are open
    const closedLotteries = selectedLotteriesData.filter(l => !l.is_open);
    if (closedLotteries.length > 0) {
      Alert.alert('Error', `Las siguientes loterías están cerradas: ${closedLotteries.map(l => l.name).join(', ')}`);
      return;
    }

    // Create one cart item per selected lottery
    const newItems: CartItem[] = selectedLotteriesData.map(lottery => {
      // Get play type config for this specific lottery (might have different multipliers)
      const lotteryPlayType = lottery.play_types?.[selectedPlayType];
      const multiplier = lotteryPlayType?.multipliers?.first || playTypeConfig.multipliers.first;
      const potentialWin = parseFloat(amount) * multiplier;

      return {
        id: `${Date.now()}-${lottery.id}-${Math.random().toString(36).substr(2, 9)}`,
        lotteryId: lottery.id,
        lotteryName: lottery.name,
        numbers: [...selectedNumbers],
        amount: parseFloat(amount),
        currency: lottery.currency,
        potentialWin: potentialWin,
        country: lottery.country,
        playType: selectedPlayType,
        playTypeName: lotteryPlayType?.name || playTypeConfig.name,
      };
    });

    setCart([...cart, ...newItems]);
    setSelectedNumbers([]);
    // Keep lotteries and play type selected for quick repeated entries
    
    // Haptic feedback when items are added to cart (mobile only)
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    
    const lotteryNames = selectedLotteriesData.map(l => l.name).join(', ');
    Alert.alert('Agregado', `${playTypeConfig.name} agregado a ${selectedLotteriesData.length} lotería(s):\n${lotteryNames}`);
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

  // Use a recent play - add to cart
  const handleUseRecentPlay = (recentPlay: any) => {
    // Find the lottery by id or type
    let lottery = recentPlay.lottery_id 
      ? lotteries.find(l => l.id === recentPlay.lottery_id)
      : lotteries.find(l => l.lottery_type === recentPlay.lottery_type && l.is_open);
    
    if (!lottery) {
      lottery = lotteries.find(l => l.lottery_type === recentPlay.lottery_type);
    }
    
    if (!lottery) {
      Alert.alert('Error', 'No se encontró la lotería para esta jugada');
      return;
    }

    if (!lottery.is_open) {
      Alert.alert('Lotería Cerrada', `${lottery.name} está cerrada. ¿Deseas agregar a una lotería abierta?`, [
        { text: 'No', style: 'cancel' },
        { 
          text: 'Buscar Abierta', 
          onPress: () => {
            const openLottery = lotteries.find(l => l.lottery_type === recentPlay.lottery_type && l.is_open);
            if (openLottery) {
              addRecentPlayToCart(recentPlay, openLottery);
            } else {
              Alert.alert('Error', 'No hay loterías abiertas de este tipo');
            }
          }
        }
      ]);
      return;
    }

    addRecentPlayToCart(recentPlay, lottery);
  };

  const addRecentPlayToCart = (recentPlay: any, lottery: Lottery) => {
    const playTypeConfig = lottery.play_types?.[recentPlay.lottery_type];
    const multiplier = playTypeConfig?.multipliers?.first || lottery.prize_multiplier || 70;
    const potentialWin = recentPlay.amount * multiplier;

    const newItem: CartItem = {
      id: `${Date.now()}-${lottery.id}-${Math.random().toString(36).substr(2, 9)}`,
      lotteryId: lottery.id,
      lotteryName: lottery.name,
      numbers: recentPlay.numbers,
      amount: recentPlay.amount,
      currency: lottery.currency,
      potentialWin: potentialWin,
      country: lottery.country,
      playType: recentPlay.lottery_type,
      playTypeName: playTypeConfig?.name || recentPlay.lottery_type,
    };

    setCart([...cart, newItem]);
    setShowRecentModal(false);

    // Haptic feedback
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    Alert.alert('Agregado', `Jugada reciente agregada: ${recentPlay.numbers.join('-')} en ${lottery.name}`);
  };

  // Submit all plays as multi-play ticket
  const handleSubmit = async () => {
    if (cart.length === 0) {
      Alert.alert('Error', 'Agrega al menos una jugada al carrito');
      return;
    }

    setSubmitting(true);
    try {
      // Group plays for the API - backend expects lottery_type not play_type
      const plays = cart.map(item => {
        return {
          lottery_id: item.lotteryId,
          lottery_type: item.playType, // Backend expects lottery_type (quiniela, pale, etc)
          numbers: item.numbers,
          amount: item.amount,
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

  // Generate ticket HTML for printing - Black & White, Bold, Organized
  const generateTicketHTML = (ticket: MultiPlayTicketResponse) => {
    const date = new Date(ticket.created_at);
    
    // Generate QR code URL - Black & White
    const qrData = encodeURIComponent(ticket.ticket_number);
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${qrData}&bgcolor=ffffff&color=000000`;

    // Company Logo URL
    const logoUrl = 'https://customer-assets.emergentagent.com/job_0d52222c-173f-46ac-b2b0-ffceca2336e1/artifacts/cql3117b_loteria.jpg';
    
    // Get play type name from lottery_type
    const getPlayTypeName = (lotteryType: string) => {
      const names: {[key: string]: string} = {
        'quiniela': 'QUINIELA',
        'pale': 'PALE',
        'tripleta': 'TRIPLETA',
        'super_pale': 'SUPER PALE'
      };
      return names[lotteryType] || lotteryType.toUpperCase();
    };
    
    // Generate detailed plays HTML
    const playsHTML = ticket.plays.map((play, idx) => `
      <div class="play-card">
        <div class="play-header">
          <span class="play-index">${idx + 1}</span>
          <span class="play-type">${getPlayTypeName(play.lottery_type || 'quiniela')}</span>
        </div>
        <div class="play-lottery-name">${play.lottery_name}</div>
        <div class="play-numbers">${play.numbers.map(n => n.toString().padStart(2, '0')).join(' - ')}</div>
        <div class="play-details">
          <span class="play-amount">${ticket.currency} ${play.amount.toFixed(2)}</span>
        </div>
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
            font-family: 'Arial', 'Helvetica', sans-serif; 
            padding: 0; 
            max-width: 300px; 
            margin: 0 auto; 
            background: #fff;
            color: #000;
          }
          .ticket { 
            border: 3px solid #000; 
            background: #fff;
          }
          
          /* Header */
          .header { 
            background: #fff;
            padding: 12px 10px 8px; 
            text-align: center;
            border-bottom: 2px solid #000;
          }
          .logo-container {
            width: 60px;
            height: 60px;
            margin: 0 auto 6px;
            border: 2px solid #000;
            overflow: hidden;
          }
          .logo-img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .brand-name { 
            font-size: 18px; 
            font-weight: 900; 
            color: #000;
            letter-spacing: 1px;
            text-transform: uppercase;
          }
          
          /* Ticket Number */
          .ticket-number-section { 
            background: #000;
            color: #fff; 
            padding: 10px; 
            text-align: center;
          }
          .ticket-label { 
            font-size: 10px; 
            font-weight: 700;
            letter-spacing: 2px;
            text-transform: uppercase;
          }
          .ticket-number { 
            font-size: 16px; 
            font-weight: 900; 
            letter-spacing: 1px; 
            margin-top: 2px;
            font-family: 'Courier New', monospace;
          }
          
          /* Date Info */
          .info-section {
            background: #fff;
            padding: 8px 10px;
            border-bottom: 1px dashed #000;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .date-info {
            font-size: 11px;
            color: #000;
            font-weight: 700;
          }
          .customer-info {
            font-size: 10px;
            color: #000;
            font-weight: 700;
            text-align: right;
          }
          
          /* Plays Section */
          .body { 
            padding: 10px; 
            background: #fff; 
          }
          .plays-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            padding-bottom: 6px;
            border-bottom: 2px solid #000;
          }
          .plays-title { 
            font-weight: 900; 
            font-size: 12px; 
            color: #000;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .plays-count {
            background: #000;
            color: #fff;
            padding: 2px 8px;
            font-size: 11px;
            font-weight: 900;
          }
          
          /* Play Card - Detailed */
          .play-card { 
            border: 2px solid #000;
            margin-bottom: 8px;
            background: #fff;
          }
          .play-header {
            background: #000;
            color: #fff;
            padding: 4px 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .play-index { 
            font-size: 10px;
            font-weight: 900;
          }
          .play-type {
            font-size: 11px;
            font-weight: 900;
            letter-spacing: 1px;
          }
          .play-lottery-name {
            padding: 6px 8px 2px;
            font-size: 11px;
            font-weight: 700;
            color: #000;
            text-align: center;
            border-bottom: 1px dashed #000;
          }
          .play-numbers { 
            font-weight: 900; 
            font-size: 24px; 
            color: #000; 
            letter-spacing: 4px;
            font-family: 'Courier New', monospace;
            text-align: center;
            padding: 10px 8px;
          }
          .play-details {
            padding: 6px 8px;
            border-top: 1px dashed #000;
            text-align: right;
          }
          .play-amount { 
            color: #000; 
            font-weight: 900; 
            font-size: 14px;
          }
          
          /* Totals Section */
          .totals { 
            background: #fff;
            border: 2px solid #000;
            margin: 8px 0;
          }
          .totals-header {
            background: #000;
            color: #fff;
            padding: 6px 10px;
            font-size: 11px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .totals-body {
            padding: 10px;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 4px 0;
            border-bottom: 1px dashed #000;
          }
          .total-row:last-child { 
            border-bottom: none;
            padding-top: 8px;
          }
          .total-label { 
            color: #000;
            font-size: 11px;
            font-weight: 700;
          }
          .total-value { 
            font-size: 12px; 
            font-weight: 900; 
            color: #000;
          }
          .grand-total-label {
            font-size: 12px;
            font-weight: 900;
            color: #000;
          }
          .grand-total-value { 
            font-size: 18px; 
            font-weight: 900; 
            color: #000;
          }
          
          /* QR Footer */
          .footer { 
            background: #fff;
            padding: 12px 10px; 
            text-align: center; 
            border-top: 2px dashed #000;
          }
          .qr-container { 
            background: #fff; 
            padding: 8px; 
            margin: 0 auto 8px; 
            display: inline-block;
            border: 2px solid #000;
          }
          .qr-code { 
            width: 100px; 
            height: 100px; 
            display: block;
          }
          .qr-label { 
            font-size: 9px; 
            color: #000;
            font-weight: 700;
            margin-top: 4px;
            letter-spacing: 1px;
          }
          .scan-text {
            font-size: 10px;
            color: #000;
            font-weight: 700;
            margin-top: 6px;
          }
          .footer-notes { 
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px solid #000;
          }
          .footer-text { 
            font-size: 9px; 
            color: #000; 
            font-weight: 700;
            margin: 2px 0;
          }
          
          /* Bottom Bar */
          .bottom-bar { 
            background: #000;
            color: #fff; 
            padding: 8px; 
            text-align: center; 
            font-size: 12px; 
            font-weight: 900;
            letter-spacing: 2px;
          }
        </style>
      </head>
      <body>
        <div class="ticket">
          <!-- Header -->
          <div class="header">
            <div class="logo-container">
              <img class="logo-img" src="${logoUrl}" alt="Loteria" />
            </div>
            <div class="brand-name">LOTERIA MAGIC</div>
          </div>
          
          <!-- Ticket Number -->
          <div class="ticket-number-section">
            <div class="ticket-label">BOLETO No.</div>
            <div class="ticket-number">${ticket.ticket_number}</div>
          </div>
          
          <!-- Date & Customer Info -->
          <div class="info-section">
            <div class="date-info">
              ${date.toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' })} - ${date.toLocaleTimeString('es-DO', {hour: '2-digit', minute: '2-digit'})}
            </div>
            ${ticket.customer_name ? `<div class="customer-info">CLIENTE: ${ticket.customer_name.toUpperCase()}</div>` : ''}
          </div>
          
          <!-- Plays -->
          <div class="body">
            <div class="plays-header">
              <span class="plays-title">DETALLE DE JUGADAS</span>
              <span class="plays-count">${ticket.plays.length}</span>
            </div>
            ${playsHTML}
            
            <!-- Totals -->
            <div class="totals">
              <div class="totals-header">RESUMEN</div>
              <div class="totals-body">
                <div class="total-row">
                  <span class="total-label">CANTIDAD DE JUGADAS:</span>
                  <span class="total-value">${ticket.plays.length}</span>
                </div>
                <div class="total-row">
                  <span class="grand-total-label">TOTAL A PAGAR:</span>
                  <span class="grand-total-value">${ticket.currency} ${ticket.total_amount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Footer with QR -->
          <div class="footer">
            <div class="qr-container">
              <img class="qr-code" src="${qrCodeUrl}" alt="QR" />
              <div class="qr-label">${ticket.ticket_number}</div>
            </div>
            <div class="scan-text">ESCANEA PARA VERIFICAR</div>
            <div class="footer-notes">
              <div class="footer-text">CONSERVE ESTE BOLETO</div>
              <div class="footer-text">VALIDO SOLO CON ORIGINAL</div>
            </div>
          </div>
          
          <!-- Bottom -->
          <div class="bottom-bar">BUENA SUERTE!</div>
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
          <Text style={styles.cartItemPlayType}>{item.playTypeName}</Text>
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
          <Text style={styles.cartItemWin}>1er Premio: {item.currency} {item.potentialWin.toLocaleString()}</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.cartRemoveButton} onPress={() => removeFromCart(item.id)}>
        <Ionicons name="trash" size={20} color="#ef4444" />
      </TouchableOpacity>
    </View>
  );

  // Get filtered lotteries
  const getFilteredLotteries = () => {
    return lotteries.filter(l => l.is_open);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#22c55e" style={styles.loader} />
      </SafeAreaView>
    );
  }

  const lottery = getSelectedLottery();
  const playTypeConfig = getSelectedPlayTypeConfig();
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
        {/* Step 1: Select Lottery */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              <Text style={styles.stepNumber}>1</Text> Seleccionar Loterías
            </Text>
            <TouchableOpacity 
              style={styles.selectAllButton}
              onPress={handleSelectAllLotteries}
            >
              <Ionicons 
                name={selectedLotteries.length === getFilteredLotteries().filter(l => l.is_open).length ? "checkbox" : "square-outline"} 
                size={20} 
                color="#22c55e" 
              />
              <Text style={styles.selectAllText}>
                {selectedLotteries.length === getFilteredLotteries().filter(l => l.is_open).length ? 'Deseleccionar' : 'Todas'}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.sectionSubtitle}>
            Selecciona una o más loterías para jugar los mismos números
          </Text>
          
          {/* Selected count badge */}
          {selectedLotteries.length > 0 && (
            <View style={styles.selectedBadge}>
              <Text style={styles.selectedBadgeText}>
                {selectedLotteries.length} lotería(s) seleccionada(s)
              </Text>
            </View>
          )}
          
          {/* Lottery Grid with multi-select */}
          <View style={styles.lotteryGrid}>
            {getFilteredLotteries().map(lot => (
              <TouchableOpacity
                key={lot.id}
                style={[
                  styles.lotteryChip,
                  selectedLotteries.includes(lot.id) && styles.lotteryChipSelected,
                  !lot.is_open && styles.lotteryChipDisabled,
                ]}
                onPress={() => handleSelectLottery(lot.id)}
              >
                <View style={styles.lotteryChipContent}>
                  <Text style={styles.lotteryChipFlag}>
                    {lot.country === 'RD' ? '🇩🇴' : '🇺🇸'}
                  </Text>
                  <Text style={[
                    styles.lotteryChipName,
                    selectedLotteries.includes(lot.id) && styles.lotteryChipNameSelected
                  ]} numberOfLines={1}>
                    {lot.name}
                  </Text>
                  <Ionicons 
                    name={selectedLotteries.includes(lot.id) ? "checkbox" : "square-outline"} 
                    size={18} 
                    color={selectedLotteries.includes(lot.id) ? "#22c55e" : "#64748b"} 
                  />
                </View>
                <Text style={styles.lotteryChipInfo}>
                  {lot.schedule?.join(', ') || ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {selectedLotteries.length > 0 && (
            <View style={styles.selectionSummary}>
              <Text style={styles.selectionText}>
                ✓ {getSelectedLotteriesData().map(l => l.name).join(', ')}
              </Text>
              <TouchableOpacity onPress={handleClearLotteries}>
                <Text style={styles.clearSelectionText}>Limpiar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Step 2: Select Play Type */}
        {selectedLotteries.length > 0 && lottery && lottery.play_types && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <Text style={styles.stepNumber}>2</Text> Tipo de Jugada
            </Text>
            <Text style={styles.sectionSubtitle}>
              Selecciona el tipo de jugada (se aplicará a las {selectedLotteries.length} lotería(s) seleccionada(s))
            </Text>
            
            <View style={styles.playTypeGrid}>
              {Object.entries(lottery.play_types).map(([key, pt]) => {
                if (!pt.enabled) return null;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.playTypeChip,
                      selectedPlayType === key && styles.playTypeChipSelected,
                    ]}
                    onPress={() => handleSelectPlayType(key)}
                  >
                    <Text style={[
                      styles.playTypeName,
                      selectedPlayType === key && styles.playTypeNameSelected
                    ]}>
                      {pt.name}
                    </Text>
                    <Text style={styles.playTypeNumbers}>
                      {pt.numbers_count} número{pt.numbers_count > 1 ? 's' : ''}
                    </Text>
                    <View style={styles.playTypeMultipliers}>
                      <Text style={styles.playTypeMultiplier}>1ro: x{pt.multipliers.first}</Text>
                      <Text style={styles.playTypeMultiplier}>2do: x{pt.multipliers.second}</Text>
                      <Text style={styles.playTypeMultiplier}>3ro: x{pt.multipliers.third}</Text>
                    </View>
                    {selectedPlayType === key && (
                      <Ionicons name="checkmark-circle" size={20} color="#22c55e" style={styles.playTypeCheck} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Step 3: Enter Numbers */}
        {selectedLotteries.length > 0 && selectedPlayType && lottery && playTypeConfig && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <Text style={styles.stepNumber}>3</Text> Ingresar Números ({playTypeConfig.name})
            </Text>
            <Text style={styles.sectionSubtitle}>
              Rango: {lottery.min_number}-{lottery.max_number} | Seleccionar: {playTypeConfig.numbers_count} número(s)
            </Text>
            <View style={styles.numberInputRow}>
              <TextInput
                style={styles.numberInput}
                value={numberInput}
                onChangeText={setNumberInput}
                placeholder={`Ej: ${lottery.min_number}`}
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
                <Text style={styles.noNumbers}>Ingresa {playTypeConfig.numbers_count} número(s)</Text>
              )}
            </View>
          </View>
        )}

        {/* Step 4: Amount and Add to Cart */}
        {selectedLotteries.length > 0 && selectedPlayType && lottery && playTypeConfig && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <Text style={styles.stepNumber}>4</Text> Monto y Agregar
            </Text>
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>{lottery.currency}</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="20"
              placeholderTextColor="#64748b"
            />
            <TouchableOpacity
              style={[styles.addToCartButton, (selectedNumbers.length !== playTypeConfig.numbers_count) && styles.buttonDisabled]}
              onPress={addToCart}
              disabled={selectedNumbers.length !== playTypeConfig.numbers_count}
            >
              <Ionicons name="cart" size={20} color="#ffffff" />
              <Text style={styles.addToCartText}>Agregar {playTypeConfig.name}</Text>
            </TouchableOpacity>
          </View>
        </View>
        )}

        {/* Cart Section */}
        <View style={styles.section}>
          <View style={styles.cartHeader}>
            <Text style={styles.sectionTitle}>
              <Text style={styles.stepNumber}>5</Text> Carrito ({cart.length} jugadas)
            </Text>
            <View style={styles.cartHeaderButtons}>
              <TouchableOpacity 
                style={styles.favoritesButton} 
                onPress={() => setShowFavoritesModal(true)}
              >
                <Ionicons name="star" size={18} color="#f59e0b" />
                <Text style={styles.favoritesButtonText}>Favoritos</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.favoritesButton, { backgroundColor: 'rgba(99, 102, 241, 0.2)', marginLeft: 8 }]} 
                onPress={() => setShowRecentModal(true)}
              >
                <Ionicons name="time" size={18} color="#6366f1" />
                <Text style={[styles.favoritesButtonText, { color: '#6366f1' }]}>Recientes</Text>
                {recentPlays.length > 0 && (
                  <View style={styles.recentBadge}>
                    <Text style={styles.recentBadgeText}>{recentPlays.length}</Text>
                  </View>
                )}
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
              {lotteries.map(lot => (
                <TouchableOpacity
                  key={lot.id}
                  style={[
                    styles.lotteryOption,
                    selectedLotteries.includes(lot.id) && styles.lotteryOptionSelected,
                    !lot.is_open && styles.lotteryOptionClosed,
                  ]}
                  onPress={() => { handleSelectLottery(lot.id); }}
                >
                  <View style={styles.lotteryOptionContent}>
                    <Text style={styles.lotteryOptionFlag}>
                      {lot.country === 'RD' ? '🇩🇴' : '🇺🇸'}
                    </Text>
                    <View style={styles.lotteryOptionInfo}>
                      <Text style={styles.lotteryOptionName}>{lot.name}</Text>
                      <Text style={styles.lotteryOptionDetails}>
                        {lot.currency} {lot.price} • {lot.schedule?.join(', ') || ''}
                      </Text>
                    </View>
                  </View>
                  <Ionicons 
                    name={selectedLotteries.includes(lot.id) ? "checkbox" : "square-outline"} 
                    size={24} 
                    color={selectedLotteries.includes(lot.id) ? "#22c55e" : "#64748b"} 
                  />
                  {!lot.is_open && (
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
              <Text style={styles.modalCloseText}>Cerrar</Text>
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

      {/* Recent Plays Modal */}
      <Modal visible={showRecentModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.favoritesModalContent, isDesktop && styles.modalContentDesktop]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🕐 Jugadas Recientes</Text>
              <TouchableOpacity onPress={() => setShowRecentModal(false)}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.recentSubtitle}>
              Toca una jugada para agregarla al carrito
            </Text>
            <ScrollView style={styles.favoritesListContainer}>
              {recentPlays.length > 0 ? (
                recentPlays.map((play, index) => (
                  Platform.OS === 'web' ? (
                    <div 
                      key={play.id || index}
                      data-testid={`recent-play-${index}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUseRecentPlay(play);
                      }}
                      style={{
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: '#0f172a',
                        borderRadius: 10,
                        padding: 12,
                        marginBottom: 10,
                        borderLeft: '3px solid #6366f1',
                        cursor: 'pointer',
                      }}
                    >
                      <View style={styles.recentPlayContent}>
                        <View style={styles.recentPlayNumbers}>
                          <Text style={styles.recentPlayNumbersText}>
                            {play.numbers.join(' - ')}
                          </Text>
                          <View style={styles.recentPlayTypeBadge}>
                            <Text style={styles.recentPlayTypeText}>
                              {play.lottery_type?.charAt(0).toUpperCase() + play.lottery_type?.slice(1)}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.recentPlayInfo}>
                          <Text style={styles.recentPlayLottery}>
                            {play.lottery_name || 'Lotería'}
                          </Text>
                          <Text style={styles.recentPlayAmount}>
                            ${play.amount}
                          </Text>
                        </View>
                      </View>
                      <Ionicons name="add-circle" size={28} color="#22c55e" />
                    </div>
                  ) : (
                    <TouchableOpacity 
                      key={play.id || index} 
                      style={styles.recentPlayItem}
                      onPress={() => handleUseRecentPlay(play)}
                    >
                      <View style={styles.recentPlayContent}>
                        <View style={styles.recentPlayNumbers}>
                          <Text style={styles.recentPlayNumbersText}>
                            {play.numbers.join(' - ')}
                          </Text>
                          <View style={styles.recentPlayTypeBadge}>
                            <Text style={styles.recentPlayTypeText}>
                              {play.lottery_type?.charAt(0).toUpperCase() + play.lottery_type?.slice(1)}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.recentPlayInfo}>
                          <Text style={styles.recentPlayLottery}>
                            {play.lottery_name || 'Lotería'}
                          </Text>
                          <Text style={styles.recentPlayAmount}>
                            ${play.amount}
                          </Text>
                        </View>
                      </View>
                      <Ionicons name="add-circle" size={28} color="#22c55e" />
                    </TouchableOpacity>
                  )
                ))
              ) : (
                <View style={styles.emptyFavorites}>
                  <Ionicons name="time-outline" size={48} color="#475569" />
                  <Text style={styles.emptyFavoritesText}>No hay jugadas recientes</Text>
                  <Text style={styles.emptyFavoritesSubtext}>
                    Las jugadas que realices aparecerán aquí
                  </Text>
                </View>
              )}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowRecentModal(false)}
            >
              <Text style={styles.modalCloseText}>Cerrar</Text>
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#334155',
  },
  selectAllText: {
    fontSize: 12,
    color: '#22c55e',
    marginLeft: 6,
    fontWeight: '600',
  },
  selectedBadge: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  selectedBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  lotteryChipDisabled: {
    opacity: 0.5,
    backgroundColor: '#1e293b',
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
    flexWrap: 'wrap',
    gap: 4,
  },
  cartItemLottery: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  cartItemPlayType: {
    fontSize: 12,
    color: '#22c55e',
    backgroundColor: '#14532d',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    fontWeight: '500',
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
  // Play type styles
  playTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  playTypeChip: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 14,
    minWidth: '45%',
    flex: 1,
    borderWidth: 2,
    borderColor: '#334155',
  },
  playTypeChipSelected: {
    borderColor: '#22c55e',
    backgroundColor: '#14532d20',
  },
  playTypeName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  playTypeNameSelected: {
    color: '#22c55e',
  },
  playTypeNumbers: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 8,
  },
  playTypeMultipliers: {
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 8,
    marginTop: 4,
  },
  playTypeMultiplier: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 2,
  },
  playTypeCheck: {
    position: 'absolute',
    top: 10,
    right: 10,
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
  // Recent plays styles
  recentBadge: {
    backgroundColor: '#6366f1',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  recentBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  recentSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  recentPlayItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#6366f1',
  },
  recentPlayContent: {
    flex: 1,
  },
  recentPlayNumbers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  recentPlayNumbersText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  recentPlayTypeBadge: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  recentPlayTypeText: {
    fontSize: 11,
    color: '#6366f1',
    fontWeight: '500',
  },
  recentPlayInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recentPlayLottery: {
    fontSize: 13,
    color: '#94a3b8',
  },
  recentPlayAmount: {
    fontSize: 13,
    color: '#22c55e',
    fontWeight: '600',
  },
});

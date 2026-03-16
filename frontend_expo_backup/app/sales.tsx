import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

// Import modular components and types
import {
  styles,
  API_URL,
  isDesktop,
  DEFAULT_AMOUNT,
  Lottery,
  CartItem,
  CompanyProfile,
  MultiPlayTicketResponse,
  Favorite,
  RecentPlay,
  PlayTypeConfig,
  getPlayTypeDisplayName,
  TicketModal,
  FavoritesModal,
  SaveFavoriteModal,
  RecentPlaysModal,
  EditCartModal,
  ShortcutsHelpModal,
  LotterySelector,
  PlayTypeSelector,
  NumberInput,
  CartSection,
} from '../src/components/sales';

export default function Sales() {
  const { token, user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ duplicate?: string }>();
  
  // Core state
  const [lotteries, setLotteries] = useState<Lottery[]>([]);
  const [selectedLotteries, setSelectedLotteries] = useState<string[]>([]);
  const [selectedPlayType, setSelectedPlayType] = useState<string | null>(null);
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [numberInput, setNumberInput] = useState('');
  const [amount, setAmount] = useState(DEFAULT_AMOUNT);
  const [customerName, setCustomerName] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [lastTicket, setLastTicket] = useState<MultiPlayTicketResponse | null>(null);
  
  // Modal visibility state
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showFavoritesModal, setShowFavoritesModal] = useState(false);
  const [showSaveFavoriteModal, setShowSaveFavoriteModal] = useState(false);
  const [showRecentModal, setShowRecentModal] = useState(false);
  const [showEditCartModal, setShowEditCartModal] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  
  // Favorites and recent plays
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [recentPlays, setRecentPlays] = useState<RecentPlay[]>([]);
  
  // Edit cart item state
  const [editingCartItem, setEditingCartItem] = useState<CartItem | null>(null);
  
  // Company profile
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  
  // Track if duplicate has been processed
  const [duplicateProcessed, setDuplicateProcessed] = useState(false);
  
  // Input refs for keyboard navigation
  const numberInputRef = useRef<TextInput>(null);
  const amountInputRef = useRef<TextInput>(null);

  // Computed values
  const lottery = selectedLotteries.length > 0 
    ? lotteries.find(l => l.id === selectedLotteries[0]) 
    : null;
  const playTypeConfig = lottery?.play_types?.[selectedPlayType || ''];
  const currency = cart.length > 0 ? cart[0].currency : lottery?.currency || 'RD$';
  const totalAmount = cart.reduce((sum, item) => sum + item.amount, 0);
  const totalPotentialWin = cart.reduce((sum, item) => sum + item.potentialWin, 0);

  // Fetch company profile for ticket branding
  useEffect(() => {
    const fetchCompanyProfile = async () => {
      try {
        const response = await fetch(`${API_URL}/api/company-profile`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setCompanyProfile(data);
        }
      } catch (error) {
        console.error('Error fetching company profile:', error);
      }
    };
    if (token) fetchCompanyProfile();
  }, [token]);

  // Initial data fetch
  useEffect(() => {
    fetchLotteries();
    fetchFavorites();
    fetchRecentPlays();
  }, []);

  // Handle ticket duplication from URL params
  useEffect(() => {
    if (params.duplicate && !duplicateProcessed && lotteries.length > 0 && token) {
      handleDuplicateTicket(params.duplicate);
      setDuplicateProcessed(true);
    }
  }, [params.duplicate, lotteries, token, duplicateProcessed]);

  // Keyboard shortcuts handler (web only)
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      
      if (isInputFocused && event.key === 'Enter') return;

      const modalOpen = showTicketModal || showFavoritesModal || showSaveFavoriteModal || 
                        showRecentModal || showEditCartModal;
      
      if (event.key === 'Escape') {
        if (showTicketModal) setShowTicketModal(false);
        if (showFavoritesModal) setShowFavoritesModal(false);
        if (showSaveFavoriteModal) setShowSaveFavoriteModal(false);
        if (showRecentModal) setShowRecentModal(false);
        if (showEditCartModal) setShowEditCartModal(false);
        if (showShortcutsHelp) setShowShortcutsHelp(false);
        if (!modalOpen && !showShortcutsHelp) {
          setSelectedNumbers([]);
          setNumberInput('');
        }
        return;
      }

      if (modalOpen || isInputFocused) return;

      // F1-F4: Select play type
      if (event.key === 'F1' && selectedLotteries.length > 0) {
        event.preventDefault();
        handleSelectPlayType('quiniela');
      }
      if (event.key === 'F2' && selectedLotteries.length > 0) {
        event.preventDefault();
        handleSelectPlayType('pale');
      }
      if (event.key === 'F3' && selectedLotteries.length > 0) {
        event.preventDefault();
        handleSelectPlayType('tripleta');
      }
      if (event.key === 'F4' && selectedLotteries.length > 0) {
        event.preventDefault();
        handleSelectPlayType('super_pale');
      }

      // N: Focus number input
      if (event.key === 'n' || event.key === 'N') {
        event.preventDefault();
        numberInputRef.current?.focus();
      }

      // M: Focus amount input
      if (event.key === 'm' || event.key === 'M') {
        event.preventDefault();
        amountInputRef.current?.focus();
      }

      // R: Quick random numbers
      if (event.key === 'r' || event.key === 'R') {
        event.preventDefault();
        handleQuickPick();
      }

      // A: Select all lotteries
      if (event.key === 'a' || event.key === 'A') {
        event.preventDefault();
        handleSelectAllLotteries();
      }

      // Enter: Add to cart
      if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey) {
        if (playTypeConfig && selectedNumbers.length === playTypeConfig.numbers_count) {
          event.preventDefault();
          addToCart();
        }
      }

      // Ctrl+Enter: Submit sale
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        if (cart.length > 0 && !submitting) {
          handleSubmit();
        }
      }

      // F: Open favorites
      if (event.key === 'f' || event.key === 'F') {
        event.preventDefault();
        setShowFavoritesModal(true);
      }

      // H: Open recent plays
      if (event.key === 'h' || event.key === 'H') {
        event.preventDefault();
        setShowRecentModal(true);
      }

      // ?: Show shortcuts help
      if (event.key === '?' || (event.shiftKey && event.key === '/')) {
        event.preventDefault();
        setShowShortcutsHelp(true);
      }

      // Backspace: Remove last number
      if (event.key === 'Backspace' && selectedNumbers.length > 0) {
        event.preventDefault();
        setSelectedNumbers(prev => prev.slice(0, -1));
      }

      // Delete or X: Clear cart
      if ((event.key === 'Delete' || event.key === 'x' || event.key === 'X') && cart.length > 0) {
        event.preventDefault();
        clearCart();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedLotteries, selectedPlayType, selectedNumbers, cart, submitting,
    showTicketModal, showFavoritesModal, showSaveFavoriteModal, showRecentModal,
    showEditCartModal, showShortcutsHelp, playTypeConfig
  ]);

  // API functions
  const fetchLotteries = async () => {
    try {
      const response = await fetch(`${API_URL}/api/lotteries`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setLotteries(data.filter((l: Lottery) => l.is_open || true)); // Show all lotteries
      }
    } catch (error) {
      console.error('Error fetching lotteries:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFavorites = async () => {
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

  const fetchRecentPlays = async () => {
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

  // Handlers
  const handleToggleLottery = (id: string) => {
    const lottery = lotteries.find(l => l.id === id);
    if (!lottery?.is_open) return;
    
    setSelectedLotteries(prev => {
      if (prev.includes(id)) {
        return prev.filter(lid => lid !== id);
      }
      return [...prev, id];
    });
    
    // Reset play type when selection changes
    if (!selectedLotteries.includes(id)) {
      setSelectedPlayType(null);
      setSelectedNumbers([]);
    }
  };

  const handleSelectAllLotteries = () => {
    const openLotteries = lotteries.filter(l => l.is_open);
    const allSelected = openLotteries.every(l => selectedLotteries.includes(l.id));
    
    if (allSelected) {
      setSelectedLotteries([]);
    } else {
      setSelectedLotteries(openLotteries.map(l => l.id));
    }
  };

  const handleClearSelection = () => {
    setSelectedLotteries([]);
    setSelectedPlayType(null);
    setSelectedNumbers([]);
  };

  const handleSelectPlayType = (type: string) => {
    setSelectedPlayType(type);
    setSelectedNumbers([]);
  };

  const addNumberFromInput = () => {
    if (!lottery || !playTypeConfig) return;
    
    const num = parseInt(numberInput);
    if (isNaN(num)) return;
    if (num < lottery.min_number || num > lottery.max_number) {
      Alert.alert('Error', `Número debe estar entre ${lottery.min_number} y ${lottery.max_number}`);
      return;
    }
    if (selectedNumbers.includes(num)) {
      Alert.alert('Error', 'Este número ya está seleccionado');
      return;
    }
    if (selectedNumbers.length >= playTypeConfig.numbers_count) {
      Alert.alert('Error', `Solo puedes seleccionar ${playTypeConfig.numbers_count} número(s)`);
      return;
    }
    
    setSelectedNumbers([...selectedNumbers, num]);
    setNumberInput('');
  };

  const handleQuickPick = () => {
    if (!lottery || !playTypeConfig) return;
    
    const count = playTypeConfig.numbers_count;
    const nums: number[] = [];
    
    while (nums.length < count) {
      const rand = Math.floor(Math.random() * (lottery.max_number - lottery.min_number + 1)) + lottery.min_number;
      if (!nums.includes(rand)) {
        nums.push(rand);
      }
    }
    
    setSelectedNumbers(nums.sort((a, b) => a - b));
  };

  const addToCart = () => {
    if (!lottery || !playTypeConfig || selectedNumbers.length !== playTypeConfig.numbers_count) return;
    
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Error', 'Ingresa un monto válido');
      return;
    }
    
    const multiplier = playTypeConfig.multipliers?.first || lottery.prize_multiplier || 70;
    
    // Add to cart for each selected lottery
    const newItems: CartItem[] = selectedLotteries.map(lotteryId => {
      const lot = lotteries.find(l => l.id === lotteryId)!;
      const lotPlayTypeConfig = lot.play_types?.[selectedPlayType!];
      const lotMultiplier = lotPlayTypeConfig?.multipliers?.first || lot.prize_multiplier || 70;
      
      return {
        id: `${Date.now()}-${lotteryId}-${Math.random().toString(36).substr(2, 9)}`,
        lotteryId: lot.id,
        lotteryName: lot.name,
        numbers: [...selectedNumbers],
        amount: amt,
        currency: lot.currency,
        potentialWin: amt * lotMultiplier,
        country: lot.country,
        playType: selectedPlayType!,
        playTypeName: getPlayTypeDisplayName(selectedPlayType!),
      };
    });
    
    setCart([...cart, ...newItems]);
    setSelectedNumbers([]);
    setNumberInput('');
    
    // Haptic feedback
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    
    Alert.alert('Agregado', `${newItems.length} jugada(s) agregada(s) al carrito`);
  };

  const clearCart = () => {
    Alert.alert(
      'Vaciar Carrito',
      '¿Estás seguro de vaciar el carrito?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Vaciar', style: 'destructive', onPress: () => setCart([]) }
      ]
    );
  };

  const handleEditCartItem = (item: CartItem) => {
    setEditingCartItem(item);
    setShowEditCartModal(true);
  };

  const handleSaveEditedItem = (updatedItem: CartItem) => {
    setCart(cart.map(item => item.id === updatedItem.id ? updatedItem : item));
  };

  const handleDeleteCartItem = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const handleSubmit = async () => {
    if (cart.length === 0) {
      Alert.alert('Error', 'Agrega al menos una jugada al carrito');
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
        setShowTicketModal(true);
        setCart([]);
        setCustomerName('');
        fetchRecentPlays();
        
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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

  const handleDuplicateTicket = async (ticketId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/tickets/${ticketId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (!response.ok) {
        Alert.alert('Error', 'No se pudo cargar el ticket para duplicar');
        return;
      }
      
      const ticket = await response.json();
      const newCartItems: CartItem[] = [];
      
      if (ticket.ticket_type === 'multi_play' && ticket.plays) {
        for (const play of ticket.plays) {
          const lottery = lotteries.find(l => l.id === play.lottery_id) || 
                         lotteries.find(l => l.name === play.lottery_name);
          
          if (lottery) {
            const playType = play.lottery_type || 'quiniela';
            const playTypeConfig = lottery.play_types?.[playType];
            const multiplier = playTypeConfig?.multipliers?.first || lottery.prize_multiplier || 70;
            
            newCartItems.push({
              id: `dup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              lotteryId: lottery.id,
              lotteryName: lottery.name,
              numbers: play.numbers,
              amount: play.amount,
              currency: ticket.currency || lottery.currency,
              potentialWin: play.amount * multiplier,
              country: lottery.country,
              playType: playType,
              playTypeName: getPlayTypeDisplayName(playType),
            });
          }
        }
      } else if (ticket.numbers && ticket.lottery_id) {
        const lottery = lotteries.find(l => l.id === ticket.lottery_id);
        if (lottery) {
          const playType = ticket.lottery_type || 'quiniela';
          const playTypeConfig = lottery.play_types?.[playType];
          const multiplier = playTypeConfig?.multipliers?.first || lottery.prize_multiplier || 70;
          
          newCartItems.push({
            id: `dup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            lotteryId: lottery.id,
            lotteryName: lottery.name,
            numbers: ticket.numbers,
            amount: ticket.amount,
            currency: ticket.currency || lottery.currency,
            potentialWin: ticket.amount * multiplier,
            country: lottery.country,
            playType: playType,
            playTypeName: getPlayTypeDisplayName(playType),
          });
        }
      }
      
      if (newCartItems.length > 0) {
        setCart(prev => [...prev, ...newCartItems]);
        Alert.alert('Duplicado', `Se agregaron ${newCartItems.length} jugada(s) al carrito`);
      }
    } catch (error) {
      Alert.alert('Error', 'Error al duplicar el ticket');
    }
  };

  const handleSaveFavorite = async (name: string) => {
    if (cart.length === 0) {
      Alert.alert('Error', 'El carrito está vacío');
      return;
    }

    try {
      const plays = cart.map(item => ({
        lottery_type: item.playType,
        lottery_id: item.lotteryId,
        numbers: item.numbers,
        amount: item.amount,
      }));

      const response = await fetch(`${API_URL}/api/favorites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          plays,
          currency: cart[0]?.currency === 'RD$' ? 'RD' : 'USD',
        }),
      });

      if (response.ok) {
        Alert.alert('Éxito', `Favorito "${name}" guardado`);
        setShowSaveFavoriteModal(false);
        fetchFavorites();
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'No se pudo guardar');
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión');
    }
  };

  const handleUseFavorite = async (favorite: Favorite) => {
    const newItems: CartItem[] = [];
    
    for (const play of favorite.plays) {
      let lottery = play.lottery_id 
        ? lotteries.find(l => l.id === play.lottery_id)
        : lotteries.find(l => l.lottery_type === play.lottery_type && l.is_open);
      
      if (!lottery) {
        lottery = lotteries.find(l => l.lottery_type === play.lottery_type);
      }
      
      if (lottery) {
        const playTypeConfig = lottery.play_types?.[play.lottery_type];
        const multiplier = playTypeConfig?.multipliers?.first || lottery.prize_multiplier || 70;
        
        newItems.push({
          id: `${Date.now()}-${lottery.id}-${Math.random().toString(36).substr(2, 9)}`,
          lotteryId: lottery.id,
          lotteryName: lottery.name,
          numbers: play.numbers,
          amount: play.amount,
          currency: lottery.currency,
          potentialWin: play.amount * multiplier,
          country: lottery.country,
          playType: play.lottery_type,
          playTypeName: getPlayTypeDisplayName(play.lottery_type),
        });
      }
    }

    if (newItems.length > 0) {
      setCart([...cart, ...newItems]);
      
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      // Increment use count
      await fetch(`${API_URL}/api/favorites/${favorite.id}/use`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      setShowFavoritesModal(false);
      Alert.alert('Agregado', `Favorito "${favorite.name}" agregado al carrito`);
      fetchFavorites();
    } else {
      Alert.alert('Error', 'No se encontraron loterías disponibles');
    }
  };

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
            await fetch(`${API_URL}/api/favorites/${favorite.id}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` },
            });
            fetchFavorites();
            Alert.alert('Eliminado', 'Favorito eliminado');
          }
        }
      ]
    );
  };

  const handleUseRecentPlay = (recentPlay: RecentPlay) => {
    let lottery = recentPlay.lottery_id 
      ? lotteries.find(l => l.id === recentPlay.lottery_id)
      : lotteries.find(l => l.lottery_type === recentPlay.lottery_type && l.is_open);
    
    if (!lottery) {
      lottery = lotteries.find(l => l.lottery_type === recentPlay.lottery_type);
    }
    
    if (!lottery) {
      Alert.alert('Error', 'No se encontró la lotería');
      return;
    }

    if (!lottery.is_open) {
      Alert.alert('Lotería Cerrada', `${lottery.name} está cerrada. ¿Buscar una abierta?`, [
        { text: 'No', style: 'cancel' },
        { 
          text: 'Buscar', 
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

  const addRecentPlayToCart = (recentPlay: RecentPlay, lottery: Lottery) => {
    const playTypeConfig = lottery.play_types?.[recentPlay.lottery_type];
    const multiplier = playTypeConfig?.multipliers?.first || lottery.prize_multiplier || 70;

    const newItem: CartItem = {
      id: `${Date.now()}-${lottery.id}-${Math.random().toString(36).substr(2, 9)}`,
      lotteryId: lottery.id,
      lotteryName: lottery.name,
      numbers: recentPlay.numbers,
      amount: recentPlay.amount,
      currency: lottery.currency,
      potentialWin: recentPlay.amount * multiplier,
      country: lottery.country,
      playType: recentPlay.lottery_type,
      playTypeName: getPlayTypeDisplayName(recentPlay.lottery_type),
    };

    setCart([...cart, newItem]);
    setShowRecentModal(false);

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    Alert.alert('Agregado', `Jugada reciente agregada: ${recentPlay.numbers.join('-')}`);
  };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#22c55e" />
          <Text style={styles.loadingText}>Cargando loterías...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Vender</Text>
        </View>
        {Platform.OS === 'web' && (
          <TouchableOpacity
            style={styles.shortcutsHelpButton}
            onPress={() => setShowShortcutsHelp(true)}
          >
            <Text style={styles.shortcutsHelpButtonText}>?</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Main Content */}
      <ScrollView style={[styles.content, isDesktop && styles.contentDesktop]}>
        {/* Step 1: Select Lotteries */}
        <LotterySelector
          lotteries={lotteries}
          selectedLotteries={selectedLotteries}
          onToggleLottery={handleToggleLottery}
          onSelectAll={handleSelectAllLotteries}
          onClearSelection={handleClearSelection}
        />

        {/* Step 2: Select Play Type */}
        {selectedLotteries.length > 0 && lottery && (
          <PlayTypeSelector
            playTypes={lottery.play_types}
            selectedPlayType={selectedPlayType}
            onSelectPlayType={handleSelectPlayType}
            lotteriesCount={selectedLotteries.length}
          />
        )}

        {/* Step 3 & 4: Number Input & Add to Cart */}
        {selectedLotteries.length > 0 && selectedPlayType && lottery && playTypeConfig && (
          <NumberInput
            lottery={lottery}
            playTypeConfig={playTypeConfig}
            selectedNumbers={selectedNumbers}
            numberInput={numberInput}
            amount={amount}
            inputRef={numberInputRef}
            amountRef={amountInputRef}
            onNumberInputChange={setNumberInput}
            onAmountChange={setAmount}
            onAddNumber={addNumberFromInput}
            onRemoveNumber={(num) => setSelectedNumbers(selectedNumbers.filter(n => n !== num))}
            onQuickPick={handleQuickPick}
            onAddToCart={addToCart}
          />
        )}

        {/* Step 5: Cart */}
        <CartSection
          cart={cart}
          currency={currency}
          totalAmount={totalAmount}
          totalPotentialWin={totalPotentialWin}
          customerName={customerName}
          submitting={submitting}
          recentPlaysCount={recentPlays.length}
          onCustomerNameChange={setCustomerName}
          onEditItem={handleEditCartItem}
          onDeleteItem={handleDeleteCartItem}
          onClearCart={clearCart}
          onOpenFavorites={() => setShowFavoritesModal(true)}
          onOpenRecent={() => setShowRecentModal(true)}
          onSaveFavorite={() => setShowSaveFavoriteModal(true)}
          onSubmit={handleSubmit}
        />
      </ScrollView>

      {/* Modals */}
      <TicketModal
        visible={showTicketModal}
        onClose={() => setShowTicketModal(false)}
        ticket={lastTicket}
        companyProfile={companyProfile}
      />

      <FavoritesModal
        visible={showFavoritesModal}
        onClose={() => setShowFavoritesModal(false)}
        favorites={favorites}
        onUseFavorite={handleUseFavorite}
        onDeleteFavorite={handleDeleteFavorite}
      />

      <SaveFavoriteModal
        visible={showSaveFavoriteModal}
        onClose={() => setShowSaveFavoriteModal(false)}
        onSave={handleSaveFavorite}
        cartLength={cart.length}
      />

      <RecentPlaysModal
        visible={showRecentModal}
        onClose={() => setShowRecentModal(false)}
        recentPlays={recentPlays}
        onUseRecentPlay={handleUseRecentPlay}
      />

      <EditCartModal
        visible={showEditCartModal}
        onClose={() => setShowEditCartModal(false)}
        cartItem={editingCartItem}
        lottery={editingCartItem ? lotteries.find(l => l.id === editingCartItem.lotteryId) || null : null}
        onSave={handleSaveEditedItem}
      />

      <ShortcutsHelpModal
        visible={showShortcutsHelp}
        onClose={() => setShowShortcutsHelp(false)}
      />
    </SafeAreaView>
  );
}

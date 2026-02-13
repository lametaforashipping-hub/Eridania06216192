import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  Share,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Print from 'expo-print';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const { width } = Dimensions.get('window');
const isDesktop = width > 768;

interface PlayItem {
  id: string;
  lottery_type: string;
  lottery_type_label: string;
  lottery_id?: string;
  lottery_name?: string;
  numbers: number[];
  amount: number;
  position?: string;
}

interface Lottery {
  id: string;
  name: string;
  lottery_type: string;
  numbers_to_pick: number;
  min_number: number;
  max_number: number;
  is_open: boolean;
  closed_message?: string;
  prize_multiplier: number;
  currency: string;
}

interface TicketResponse {
  id: string;
  ticket_number: string;
  plays: Array<{
    lottery_type: string;
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

const LOTTERY_TYPES = [
  { key: 'quiniela', label: 'Quiniela', numbers: 1, icon: '1️⃣' },
  { key: 'pale', label: 'Pale', numbers: 2, icon: '2️⃣' },
  { key: 'tripleta', label: 'Tripleta', numbers: 3, icon: '3️⃣' },
  { key: 'super_pale', label: 'Super Pale', numbers: 2, icon: '💎' },
];

export default function MultiPlay() {
  const { token, user } = useAuth();
  const router = useRouter();
  const { actAs, actAsName } = useLocalSearchParams<{ actAs?: string; actAsName?: string }>();
  
  // Impersonation mode
  const isImpersonating = !!actAs;
  
  const [plays, setPlays] = useState<PlayItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastTicket, setLastTicket] = useState<TicketResponse | null>(null);
  const [showTicketModal, setShowTicketModal] = useState(false);
  
  // Form state for adding new play
  const [selectedType, setSelectedType] = useState(LOTTERY_TYPES[0]);
  const [numbersInput, setNumbersInput] = useState('');
  const [amountInput, setAmountInput] = useState('20'); // Default amount
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Lottery selection state
  const [lotteries, setLotteries] = useState<Lottery[]>([]);
  const [selectedLottery, setSelectedLottery] = useState<Lottery | null>(null);
  const [loadingLotteries, setLoadingLotteries] = useState(true);
  const [showLotterySelector, setShowLotterySelector] = useState(false);

  // Fetch available lotteries on mount
  useEffect(() => {
    fetchLotteries();
  }, []);

  const fetchLotteries = async () => {
    try {
      const response = await fetch(`${API_URL}/api/lotteries`);
      if (response.ok) {
        const data = await response.json();
        setLotteries(data);
        // Set default lottery to first open one
        const openLottery = data.find((l: Lottery) => l.is_open);
        if (openLottery) {
          setSelectedLottery(openLottery);
        } else if (data.length > 0) {
          setSelectedLottery(data[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching lotteries:', error);
    } finally {
      setLoadingLotteries(false);
    }
  };

  // Filter lotteries by compatible type
  const getCompatibleLotteries = () => {
    const typeMapping: { [key: string]: string[] } = {
      'quiniela': ['quiniela', 'quinieloto'],
      'pale': ['pale', 'super_pale'],
      'tripleta': ['tripleta'],
      'super_pale': ['super_pale', 'pale'],
    };
    const compatibleTypes = typeMapping[selectedType.key] || [selectedType.key];
    return lotteries.filter(l => compatibleTypes.includes(l.lottery_type));
  };

  const parseNumbers = (input: string): number[] => {
    // Parse input like "20-50" or "20,50" or "20 50" or "2050"
    const cleaned = input.trim();
    
    // Try hyphen format (20-50)
    if (cleaned.includes('-')) {
      return cleaned.split('-').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
    }
    
    // Try comma format (20,50)
    if (cleaned.includes(',')) {
      return cleaned.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
    }
    
    // Try space format (20 50)
    if (cleaned.includes(' ')) {
      return cleaned.split(' ').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
    }
    
    // Try consecutive 2-digit numbers (2050 -> [20, 50] or 205030 -> [20, 50, 30])
    if (cleaned.length >= 2) {
      const numbers: number[] = [];
      for (let i = 0; i < cleaned.length; i += 2) {
        const num = parseInt(cleaned.substring(i, i + 2));
        if (!isNaN(num)) {
          numbers.push(num);
        }
      }
      if (numbers.length > 0) return numbers;
    }
    
    // Single number
    const single = parseInt(cleaned);
    return isNaN(single) ? [] : [single];
  };

// Cross-platform alert function
const showAlert = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}: ${message}`);
  } else {
    Alert.alert(title, message);
  }
};

// Cross-platform button for modals
const ModalButton = ({ onPress, style, children, testID }: any) => {
  const handlePress = () => {
    console.log('ModalButton pressed');
    onPress();
  };

  return (
    <Pressable 
      style={({ pressed }) => [style, pressed && { opacity: 0.8 }]}
      onPress={handlePress}
      testID={testID}
      accessibilityRole="button"
    >
      {children}
    </Pressable>
  );
};

  const addPlay = () => {
    const numbers = parseNumbers(numbersInput);
    const amount = parseFloat(amountInput);
    
    console.log('Adding play:', { numbersInput, amountInput, numbers, amount, selectedType });
    
    if (numbers.length !== selectedType.numbers) {
      showAlert('Error', `${selectedType.label} requiere ${selectedType.numbers} número(s). Ingresa como: ${selectedType.numbers === 1 ? '25' : selectedType.numbers === 2 ? '20-50 o 2050' : '20-50-30 o 205030'}`);
      return;
    }
    
    // Validate number range (use selected lottery's range if available)
    const minNum = selectedLottery?.min_number ?? 0;
    const maxNum = selectedLottery?.max_number ?? 99;
    for (const num of numbers) {
      if (num < minNum || num > maxNum) {
        showAlert('Error', `Número ${num} fuera de rango (${minNum}-${maxNum})`);
        return;
      }
    }
    
    if (!amount || amount <= 0 || isNaN(amount)) {
      showAlert('Error', 'Ingresa un monto válido');
      return;
    }
    
    const newPlay: PlayItem = {
      id: Date.now().toString(),
      lottery_type: selectedType.key,
      lottery_type_label: selectedType.label,
      lottery_id: selectedLottery?.id,
      lottery_name: selectedLottery?.name || selectedType.label,
      numbers,
      amount,
    };
    
    console.log('New play created:', newPlay);
    setPlays(prev => [...prev, newPlay]);
    // Reset form for next play - IMPORTANT: keeps amount for convenience
    setNumbersInput('');
    // Keep the amount for consecutive plays with same amount
    setShowAddModal(false);
  };

  const removePlay = (playId: string) => {
    setPlays(plays.filter(p => p.id !== playId));
  };

  const getTotalAmount = () => plays.reduce((sum, p) => sum + p.amount, 0);

  const formatNumbers = (numbers: number[]) => {
    return numbers.map(n => n.toString().padStart(2, '0')).join('-');
  };

  const generateTicketHTML = (ticket: TicketResponse) => {
    const date = new Date(ticket.created_at);
    const playsHTML = ticket.plays.map(p => `
      <div class="play-row">
        <span class="play-type">${p.lottery_type.toUpperCase()}</span>
        <span class="play-numbers">${p.numbers.map(n => n.toString().padStart(2, '0')).join('-')}</span>
        <span class="play-amount">RD$ ${p.amount}</span>
      </div>
    `).join('');

    // Generate QR code URL
    const qrData = encodeURIComponent(`TICKET:${ticket.ticket_number}|TYPE:MULTI|DATE:${date.toISOString()}`);
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${qrData}`;

    // NOTE: Commission is NOT shown on the printed ticket - only in seller's view
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Arial', sans-serif; padding: 8px; max-width: 320px; margin: 0 auto; background: #fff; }
          .ticket { border: 3px solid #1e3a5f; border-radius: 12px; overflow: hidden; }
          .header { 
            background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%);
            color: white; padding: 16px 12px; text-align: center;
          }
          .company-logo { 
            width: 50px; 
            height: 50px; 
            background: linear-gradient(135deg, #22c55e, #16a34a);
            border-radius: 50%;
            margin: 0 auto 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid #fff;
          }
          .company-logo span { font-size: 26px; }
          .brand { font-size: 20px; font-weight: bold; letter-spacing: 2px; }
          .company-info { font-size: 10px; color: #94a3b8; margin-top: 6px; line-height: 1.5; }
          
          .ticket-number-section { background: #8b5cf6; color: white; padding: 10px; text-align: center; }
          .ticket-label { font-size: 12px; opacity: 0.9; }
          .ticket-number { font-size: 16px; font-weight: bold; letter-spacing: 1px; margin-top: 4px; }
          
          .body { padding: 14px; }
          .customer { 
            background: #f1f5f9; 
            border-radius: 8px; 
            padding: 10px; 
            margin-bottom: 12px; 
            text-align: center; 
            font-size: 14px;
            color: #334155;
          }
          .plays { margin: 12px 0; }
          .plays-title { 
            font-weight: bold; 
            font-size: 16px; 
            margin-bottom: 10px; 
            color: #1e3a5f; 
            border-bottom: 2px solid #1e3a5f; 
            padding-bottom: 6px; 
          }
          .play-row { 
            display: flex; 
            justify-content: space-between; 
            padding: 10px 6px; 
            border-bottom: 1px solid #e2e8f0; 
            align-items: center; 
          }
          .play-type { 
            background: #22c55e; 
            color: white; 
            padding: 4px 10px; 
            border-radius: 6px; 
            font-size: 12px; 
            font-weight: bold; 
          }
          .play-numbers { font-weight: bold; font-size: 20px; color: #1e3a5f; letter-spacing: 3px; }
          .play-amount { color: #22c55e; font-weight: bold; font-size: 14px; }
          
          .totals { 
            background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); 
            border-radius: 10px; 
            padding: 14px; 
            margin: 14px 0;
            text-align: center;
          }
          .total-label { color: rgba(255,255,255,0.9); font-size: 13px; }
          .total-amount { font-size: 28px; font-weight: bold; color: #fff; margin-top: 4px; }
          
          .footer { background: #f1f5f9; padding: 14px; text-align: center; border-top: 2px dashed #94a3b8; }
          .qr-container { 
            background: #fff; 
            padding: 10px; 
            margin: 0 auto 10px; 
            border-radius: 8px;
            display: inline-block;
            border: 2px solid #e2e8f0;
          }
          .qr-code { width: 120px; height: 120px; }
          .qr-label { font-size: 11px; color: #64748b; margin-top: 6px; }
          .footer-text { font-size: 12px; color: #475569; margin: 4px 0; font-weight: 500; }
          
          .promo { background: #1e3a5f; color: #fbbf24; padding: 10px; text-align: center; font-size: 13px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="ticket">
          <div class="header">
            <div class="company-logo">
              <span>🎰</span>
            </div>
            <div class="brand">LOTERÍA NACIONAL</div>
            <div class="company-info">
              RNC: 000-00000-0 | Tel: (809) 555-0000<br>
              Av. Principal #123, Santo Domingo, RD
            </div>
          </div>
          
          <div class="ticket-number-section">
            <div class="ticket-label">MULTI-JUGADA #</div>
            <div class="ticket-number">${ticket.ticket_number}</div>
          </div>
          
          <div class="body">
            <div class="customer">
              ${date.toLocaleDateString('es-DO')} | ${date.toLocaleTimeString('es-DO', {hour: '2-digit', minute: '2-digit'})}
              ${ticket.customer_name ? `<br>Cliente: ${ticket.customer_name}` : ''}
            </div>
            
            <div class="plays">
              <div class="plays-title">JUGADAS (${ticket.plays.length})</div>
              ${playsHTML}
            </div>
            
            <div class="totals">
              <div class="total-label">TOTAL JUGADO</div>
              <div class="total-amount">${ticket.currency} ${ticket.total_amount.toLocaleString()}</div>
            </div>
          </div>
          
          <div class="footer">
            <div class="qr-container">
              <img class="qr-code" src="${qrCodeUrl}" alt="QR Code" />
              <div class="qr-label">Escanear para verificar</div>
            </div>
            <div class="footer-text">✓ Conserve este boleto para cobrar</div>
            <div class="footer-text">✓ Válido solo con boleto original</div>
          </div>
          
          <div class="promo">🍀 ¡BUENA SUERTE! 🍀</div>
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
    const playsText = lastTicket.plays.map(p => 
      `  ${p.lottery_type.toUpperCase()}: ${p.numbers.map(n => n.toString().padStart(2, '0')).join('-')} x RD$ ${p.amount}`
    ).join('\n');

    const message = `🎰 *BOLETO MULTI-JUGADA*\n\n` +
      `📋 *Boleto:* ${lastTicket.ticket_number}\n` +
      `📅 *Fecha:* ${date.toLocaleDateString('es-DO')} ${date.toLocaleTimeString('es-DO')}\n` +
      `${lastTicket.customer_name ? `👤 *Cliente:* ${lastTicket.customer_name}\n` : ''}` +
      `\n🎲 *JUGADAS (${lastTicket.plays.length}):*\n${playsText}\n\n` +
      `💰 *Total:* ${lastTicket.currency} ${lastTicket.total_amount.toLocaleString()}\n` +
      `🏆 *Premio Potencial:* ${lastTicket.currency} ${lastTicket.total_potential_win.toLocaleString()}\n` +
      `\n¡Buena suerte! 🍀`;

    try {
      await Share.share({ message });
    } catch (error) {
      Alert.alert('Error', 'No se pudo compartir');
    }
  };

  const handleSubmit = async () => {
    if (plays.length === 0) {
      Alert.alert('Error', 'Agrega al menos una jugada');
      return;
    }

    setSubmitting(true);
    try {
      const requestBody: any = {
        plays: plays.map(p => ({
          lottery_type: p.lottery_type,
          lottery_id: p.lottery_id,
          numbers: p.numbers,
          amount: p.amount,
          position: p.position,
        })),
        customer_name: customerName || null,
        currency: 'RD$',
      };
      
      // Add impersonation parameter if in impersonate mode
      if (isImpersonating && actAs) {
        requestBody.act_as_user_id = actAs;
      }
      
      const response = await fetch(`${API_URL}/api/tickets/multi`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const ticket = await response.json();
        setLastTicket(ticket);
        setShowTicketModal(true);
        setPlays([]);
        setCustomerName('');
        
        // Show limit warning if any numbers are near their limit
        if (ticket.limit_warning_message) {
          setTimeout(() => {
            Alert.alert(
              '⚠️ Alerta de Límite',
              ticket.limit_warning_message,
              [{ text: 'Entendido', style: 'default' }]
            );
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Impersonation Warning Banner */}
      {isImpersonating && (
        <View style={styles.impersonationBanner}>
          <Ionicons name="warning" size={18} color="#ffffff" />
          <Text style={styles.impersonationText}>
            Creando ticket como: {actAsName || 'Vendedor'}
          </Text>
        </View>
      )}
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Multi-Jugada</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 20}
      >
        <ScrollView 
          style={styles.content} 
          contentContainerStyle={[isDesktop && styles.contentDesktop, { paddingBottom: 200 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
        >
          {/* Quick Add Buttons */}
          <View style={styles.quickAddContainer}>
            <Text style={styles.sectionTitle}>Agregar Jugada Rápida</Text>
            <View style={styles.typeButtons}>
              {LOTTERY_TYPES.map(type => (
                <TouchableOpacity
                  key={type.key}
                  style={[styles.typeButton, selectedType.key === type.key && styles.typeButtonSelected]}
                  onPress={() => {
                    setSelectedType(type);
                    setShowAddModal(true);
                  }}
                >
                  <Text style={styles.typeButtonIcon}>{type.icon}</Text>
                  <Text style={[styles.typeButtonText, selectedType.key === type.key && styles.typeButtonTextSelected]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Plays List */}
          <View style={styles.playsContainer}>
            <View style={styles.playsHeader}>
              <Text style={styles.sectionTitle}>Jugadas ({plays.length})</Text>
              {plays.length > 0 && (
                <TouchableOpacity onPress={() => setPlays([])}>
                  <Text style={styles.clearText}>Limpiar todo</Text>
                </TouchableOpacity>
              )}
            </View>
            
            {plays.length === 0 ? (
              <View style={styles.emptyPlays}>
                <Ionicons name="list-outline" size={48} color="#475569" />
                <Text style={styles.emptyText}>No hay jugadas</Text>
                <Text style={styles.emptySubtext}>Toca un tipo arriba para agregar</Text>
              </View>
            ) : (
              plays.map((play, index) => (
                <View key={play.id} style={styles.playCard}>
                  <View style={styles.playInfo}>
                    <View>
                      <View style={styles.playBadge}>
                        <Text style={styles.playBadgeText}>{play.lottery_type_label}</Text>
                      </View>
                      {play.lottery_name && play.lottery_name !== play.lottery_type_label && (
                        <Text style={styles.playLotteryName}>{play.lottery_name}</Text>
                      )}
                    </View>
                    <Text style={styles.playNumbers}>{formatNumbers(play.numbers)}</Text>
                  </View>
                  <View style={styles.playRight}>
                    <Text style={styles.playAmount}>RD$ {play.amount}</Text>
                    <TouchableOpacity onPress={() => removePlay(play.id)} style={styles.removeButton}>
                      <Ionicons name="trash-outline" size={18} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Customer Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Nombre del cliente (opcional)</Text>
            <TextInput
              style={styles.textInput}
              value={customerName}
              onChangeText={setCustomerName}
              placeholder="Nombre"
              placeholderTextColor="#64748b"
            />
          </View>

          {/* Total */}
          {plays.length > 0 && (
            <View style={styles.totalContainer}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total a jugar:</Text>
                <Text style={styles.totalValue}>RD$ {getTotalAmount().toLocaleString()}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Jugadas:</Text>
                <Text style={styles.totalPlays}>{plays.length}</Text>
              </View>
            </View>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, (submitting || plays.length === 0) && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting || plays.length === 0}
          >
            {submitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={24} color="#ffffff" />
                <Text style={styles.submitButtonText}>Crear Boleto ({plays.length} jugadas)</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Add Play Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <ScrollView 
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="always"
          >
            <View style={[styles.modalContent, isDesktop && styles.modalContentDesktop]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Agregar {selectedType.label}</Text>
                <TouchableOpacity onPress={() => setShowAddModal(false)}>
                  <Ionicons name="close" size={24} color="#ffffff" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.modalBody}>
                <Text style={styles.modalHint}>
                  {selectedType.numbers === 1 ? 'Ingresa 1 número (ej: 25)' : 
                   selectedType.numbers === 2 ? 'Ingresa 2 números (ej: 20-50 o 2050)' :
                   'Ingresa 3 números (ej: 20-50-30 o 205030)'}
                </Text>
                
                {/* Lottery Selector */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Lotería</Text>
                  <TouchableOpacity 
                    style={styles.lotterySelector}
                    onPress={() => setShowLotterySelector(true)}
                  >
                    <View style={styles.lotterySelectorContent}>
                      <Text style={styles.lotterySelectorText}>
                        {selectedLottery?.name || 'Seleccionar lotería'}
                      </Text>
                      {selectedLottery && !selectedLottery.is_open && (
                        <Text style={styles.lotteryClosed}>CERRADA</Text>
                      )}
                    </View>
                    <Ionicons name="chevron-down" size={20} color="#94a3b8" />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Número(s)</Text>
                  <TextInput
                    style={styles.numbersInput}
                    value={numbersInput}
                    onChangeText={setNumbersInput}
                    placeholder={selectedType.numbers === 1 ? '25' : selectedType.numbers === 2 ? '20-50' : '20-50-30'}
                    placeholderTextColor="#64748b"
                    keyboardType="numeric"
                    autoFocus
                  />
                </View>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Monto (RD$)</Text>
                  <TextInput
                    style={styles.amountInput}
                    value={amountInput}
                    onChangeText={setAmountInput}
                    placeholder="20"
                    placeholderTextColor="#64748b"
                    keyboardType="numeric"
                  />
                </View>
                
                {/* Quick amount buttons */}
                <View style={styles.quickAmounts}>
                  {[5, 10, 20, 50, 100].map(amt => (
                    <TouchableOpacity
                      key={amt}
                      style={[styles.quickAmountBtn, amountInput === amt.toString() && styles.quickAmountBtnSelected]}
                      onPress={() => setAmountInput(amt.toString())}
                    >
                      <Text style={[styles.quickAmountText, amountInput === amt.toString() && styles.quickAmountTextSelected]}>
                        ${amt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                
                <ModalButton 
                  style={styles.addButton} 
                  onPress={addPlay} 
                  testID="add-play-btn"
                >
                  <Ionicons name="add-circle" size={22} color="#ffffff" />
                  <Text style={styles.addButtonText}>Agregar Jugada</Text>
                </ModalButton>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Ticket Created Modal */}
      <Modal visible={showTicketModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.ticketModalContent, isDesktop && styles.modalContentDesktop]}>
            <View style={styles.ticketModalHeader}>
              <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
              <Text style={styles.ticketModalTitle}>¡Boleto Creado!</Text>
            </View>
            
            {lastTicket && (
              <View style={styles.ticketPreview}>
                <Text style={styles.ticketNumber}>{lastTicket.ticket_number}</Text>
                
                <View style={styles.ticketPlays}>
                  {lastTicket.plays.map((play, idx) => (
                    <View key={idx} style={styles.ticketPlayRow}>
                      <Text style={styles.ticketPlayType}>{play.lottery_type.toUpperCase()}</Text>
                      <Text style={styles.ticketPlayNumbers}>
                        {play.numbers.map(n => n.toString().padStart(2, '0')).join('-')}
                      </Text>
                      <Text style={styles.ticketPlayAmount}>RD$ {play.amount}</Text>
                    </View>
                  ))}
                </View>
                
                <View style={styles.ticketTotals}>
                  <View style={styles.ticketTotalRow}>
                    <Text style={styles.ticketTotalLabel}>Total:</Text>
                    <Text style={styles.ticketTotalValue}>
                      {lastTicket.currency} {lastTicket.total_amount.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.ticketTotalRow}>
                    <Text style={styles.ticketTotalLabel}>Premio Potencial:</Text>
                    <Text style={[styles.ticketTotalValue, styles.ticketPotentialWin]}>
                      {lastTicket.currency} {lastTicket.total_potential_win.toLocaleString()}
                    </Text>
                  </View>
                  {lastTicket.commission_earned && (
                    <View style={styles.ticketTotalRow}>
                      <Text style={styles.ticketTotalLabel}>Tu comisión:</Text>
                      <Text style={[styles.ticketTotalValue, styles.ticketCommission]}>
                        {lastTicket.currency} {lastTicket.commission_earned.toLocaleString()}
                      </Text>
                    </View>
                  )}
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

      {/* Lottery Selector Modal */}
      <Modal visible={showLotterySelector} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.lotterySelectorModal, isDesktop && styles.modalContentDesktop]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar Lotería</Text>
              <TouchableOpacity onPress={() => setShowLotterySelector(false)}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.lotteryList}>
              {loadingLotteries ? (
                <ActivityIndicator color="#22c55e" style={{ padding: 20 }} />
              ) : (
                getCompatibleLotteries().length > 0 ? (
                  getCompatibleLotteries().map((lottery) => (
                    <TouchableOpacity
                      key={lottery.id}
                      style={[
                        styles.lotteryOption,
                        selectedLottery?.id === lottery.id && styles.lotteryOptionSelected,
                        !lottery.is_open && styles.lotteryOptionClosed
                      ]}
                      onPress={() => {
                        setSelectedLottery(lottery);
                        setShowLotterySelector(false);
                      }}
                    >
                      <View style={styles.lotteryOptionContent}>
                        <Text style={styles.lotteryOptionName}>{lottery.name}</Text>
                        <Text style={styles.lotteryOptionType}>{lottery.lottery_type}</Text>
                        {!lottery.is_open && (
                          <Text style={styles.lotteryOptionClosedMsg}>
                            {lottery.closed_message || 'Cerrada'}
                          </Text>
                        )}
                      </View>
                      {selectedLottery?.id === lottery.id && (
                        <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                      )}
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.noLotteriesText}>
                    No hay loterías disponibles para {selectedType.label}
                  </Text>
                )
              )}
            </ScrollView>
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
  impersonationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f59e0b',
    paddingVertical: 8,
    gap: 8,
  },
  impersonationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
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
    padding: 16,
  },
  contentDesktop: {
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  quickAddContainer: {
    marginBottom: 20,
  },
  typeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  typeButton: {
    flex: 1,
    minWidth: isDesktop ? 120 : 80,
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeButtonSelected: {
    borderColor: '#22c55e',
    backgroundColor: '#14532d',
  },
  typeButtonIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  typeButtonText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  typeButtonTextSelected: {
    color: '#ffffff',
  },
  playsContainer: {
    marginBottom: 20,
  },
  playsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  clearText: {
    color: '#ef4444',
    fontSize: 13,
  },
  emptyPlays: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 16,
    marginTop: 12,
  },
  emptySubtext: {
    color: '#475569',
    fontSize: 13,
    marginTop: 4,
  },
  playCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
  },
  playInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  playBadge: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 12,
  },
  playBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  playNumbers: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  playRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22c55e',
    marginRight: 12,
  },
  removeButton: {
    padding: 6,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
    fontSize: 16,
    color: '#ffffff',
  },
  totalContainer: {
    backgroundColor: '#14532d',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  totalLabel: {
    fontSize: 14,
    color: '#86efac',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#22c55e',
  },
  totalPlays: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: '#22c55e',
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  submitButtonDisabled: {
    backgroundColor: '#475569',
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
  modalBody: {
    padding: 20,
  },
  modalHint: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  numbersInput: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 60,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: 4,
  },
  amountInput: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
    fontSize: 18,
    color: '#ffffff',
  },
  quickAmounts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  quickAmountBtn: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  quickAmountBtnSelected: {
    borderColor: '#22c55e',
    backgroundColor: '#14532d',
  },
  quickAmountText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  quickAmountTextSelected: {
    color: '#22c55e',
  },
  addButton: {
    flexDirection: 'row',
    backgroundColor: '#22c55e',
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
  },
  ticketModalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
  },
  ticketModalHeader: {
    alignItems: 'center',
    marginBottom: 20,
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
    padding: 20,
    marginBottom: 20,
  },
  ticketNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#22c55e',
    textAlign: 'center',
    marginBottom: 16,
  },
  ticketPlays: {
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 12,
  },
  ticketPlayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  ticketPlayType: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    width: 70,
  },
  ticketPlayNumbers: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    flex: 1,
    textAlign: 'center',
  },
  ticketPlayAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22c55e',
  },
  ticketTotals: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: '#334155',
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
    fontWeight: '600',
    color: '#ffffff',
  },
  ticketPotentialWin: {
    color: '#22c55e',
  },
  ticketCommission: {
    color: '#f59e0b',
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
  // Lottery Selector Styles
  lotterySelector: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#334155',
  },
  lotterySelectorContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  lotterySelectorText: {
    fontSize: 16,
    color: '#ffffff',
    flex: 1,
  },
  lotteryClosed: {
    backgroundColor: '#ef4444',
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  lotterySelectorModal: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  lotteryList: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  lotteryOption: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#334155',
  },
  lotteryOptionSelected: {
    borderColor: '#22c55e',
    backgroundColor: '#14532d',
  },
  lotteryOptionClosed: {
    opacity: 0.6,
  },
  lotteryOptionContent: {
    flex: 1,
  },
  lotteryOptionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  lotteryOptionType: {
    fontSize: 12,
    color: '#94a3b8',
    textTransform: 'capitalize',
  },
  lotteryOptionClosedMsg: {
    fontSize: 11,
    color: '#f59e0b',
    marginTop: 4,
  },
  noLotteriesText: {
    textAlign: 'center',
    color: '#64748b',
    padding: 20,
    fontSize: 14,
  },
  playLotteryName: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
  },
});

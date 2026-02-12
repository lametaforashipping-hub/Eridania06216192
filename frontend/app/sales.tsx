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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

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
  opening_time?: string;
  closing_time?: string;
  closed_message?: string;
}

interface TicketResponse {
  id: string;
  ticket_number: string;
  lottery_name: string;
  numbers: number[];
  amount: number;
  currency: string;
  potential_win: number;
  customer_name?: string;
  created_at: string;
  commission_earned?: number;
}

export default function Sales() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [lotteries, setLotteries] = useState<Lottery[]>([]);
  const [selectedLottery, setSelectedLottery] = useState<Lottery | null>(null);
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [numberInput, setNumberInput] = useState('');
  const [amount, setAmount] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showLotteryModal, setShowLotteryModal] = useState(false);
  const [lastTicket, setLastTicket] = useState<TicketResponse | null>(null);
  const [showTicketModal, setShowTicketModal] = useState(false);

  useEffect(() => {
    fetchLotteries();
  }, []);

  const fetchLotteries = async () => {
    try {
      const response = await fetch(`${API_URL}/api/lotteries`);
      if (response.ok) {
        const data = await response.json();
        setLotteries(data);
        if (data.length > 0) {
          const openLottery = data.find((l: Lottery) => l.is_open) || data[0];
          setSelectedLottery(openLottery);
          setAmount(openLottery.price.toString());
        }
      }
    } catch (error) {
      console.error('Error fetching lotteries:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNumberSelect = (num: number) => {
    if (!selectedLottery) return;

    if (selectedNumbers.includes(num)) {
      setSelectedNumbers(selectedNumbers.filter(n => n !== num));
    } else if (selectedNumbers.length < selectedLottery.numbers_to_pick) {
      setSelectedNumbers([...selectedNumbers, num].sort((a, b) => a - b));
    }
  };

  // Function to add a number from manual input
  const addNumberFromInput = () => {
    if (!selectedLottery || !numberInput.trim()) return;
    
    const num = parseInt(numberInput.trim(), 10);
    
    if (isNaN(num)) {
      Alert.alert('Error', 'Ingresa un número válido');
      return;
    }
    
    if (num < selectedLottery.min_number || num > selectedLottery.max_number) {
      Alert.alert('Error', `El número debe estar entre ${selectedLottery.min_number} y ${selectedLottery.max_number}`);
      return;
    }
    
    if (selectedNumbers.includes(num)) {
      Alert.alert('Error', 'Este número ya fue seleccionado');
      return;
    }
    
    if (selectedNumbers.length >= selectedLottery.numbers_to_pick) {
      Alert.alert('Error', `Solo puedes seleccionar ${selectedLottery.numbers_to_pick} número(s)`);
      return;
    }
    
    setSelectedNumbers([...selectedNumbers, num].sort((a, b) => a - b));
    setNumberInput('');
  };

  const handleQuickPick = () => {
    if (!selectedLottery) return;
    
    const numbers: number[] = [];
    while (numbers.length < selectedLottery.numbers_to_pick) {
      const num = Math.floor(Math.random() * (selectedLottery.max_number - selectedLottery.min_number + 1)) + selectedLottery.min_number;
      if (!numbers.includes(num)) {
        numbers.push(num);
      }
    }
    setSelectedNumbers(numbers.sort((a, b) => a - b));
  };

  const generateTicketHTML = (ticket: TicketResponse) => {
    const date = new Date(ticket.created_at);
    // Generate QR code URL using Google Charts API
    const qrData = encodeURIComponent(`TICKET:${ticket.ticket_number}|LOTTERY:${ticket.lottery_id}|DATE:${date.toISOString()}`);
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${qrData}`;
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Arial', sans-serif; 
            padding: 8px; 
            max-width: 320px; 
            margin: 0 auto;
            background: #fff;
          }
          .ticket {
            border: 3px solid #1e3a5f;
            border-radius: 12px;
            overflow: hidden;
          }
          .header { 
            background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%);
            color: white;
            padding: 16px 12px;
            text-align: center;
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
          
          .ticket-number-section {
            background: #22c55e;
            color: white;
            padding: 10px;
            text-align: center;
          }
          .ticket-label { font-size: 12px; opacity: 0.9; }
          .ticket-number { font-size: 16px; font-weight: bold; letter-spacing: 1px; margin-top: 4px; }
          
          .body { padding: 14px; }
          
          .lottery-name {
            background: linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%);
            border-radius: 8px;
            padding: 12px;
            text-align: center;
            margin-bottom: 14px;
          }
          .lottery-name span { font-weight: bold; color: #fff; font-size: 18px; }
          
          .numbers-section {
            background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
            border: 3px solid #f59e0b;
            border-radius: 10px;
            padding: 18px;
            text-align: center;
            margin: 14px 0;
          }
          .numbers-label { font-size: 14px; color: #92400e; margin-bottom: 8px; font-weight: 600; }
          .numbers { font-size: 42px; font-weight: bold; color: #1e3a5f; letter-spacing: 4px; }
          
          .details { 
            font-size: 14px; 
            margin: 14px 0;
            background: #f8fafc;
            border-radius: 8px;
            padding: 12px;
          }
          .row { 
            display: flex; 
            justify-content: space-between; 
            padding: 6px 0;
            border-bottom: 1px solid #e2e8f0;
          }
          .row:last-child { border-bottom: none; }
          .row span:first-child { color: #64748b; font-size: 13px; }
          .row span:last-child { font-weight: 700; color: #1e293b; font-size: 14px; }
          
          .amount-section {
            background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
            border-radius: 10px;
            padding: 14px;
            text-align: center;
            margin: 14px 0;
          }
          .amount-label { font-size: 13px; color: rgba(255,255,255,0.9); }
          .amount-value { font-size: 28px; font-weight: bold; color: #fff; margin-top: 4px; }
          
          .footer { 
            background: #f1f5f9;
            padding: 14px;
            text-align: center;
            border-top: 2px dashed #94a3b8;
          }
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
          
          .promo {
            background: #1e3a5f;
            color: #fbbf24;
            padding: 10px;
            text-align: center;
            font-size: 13px;
            font-weight: bold;
          }
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
            <div class="ticket-label">BOLETO #</div>
            <div class="ticket-number">${ticket.ticket_number}</div>
          </div>
          
          <div class="body">
            <div class="lottery-name">
              <span>🏆 ${ticket.lottery_name}</span>
            </div>
            
            <div class="numbers-section">
              <div class="numbers-label">NÚMEROS JUGADOS</div>
              <div class="numbers">${ticket.numbers.map(n => n.toString().padStart(2, '0')).join(' - ')}</div>
            </div>
            
            <div class="details">
              <div class="row">
                <span>Fecha:</span>
                <span>${date.toLocaleDateString('es-DO')}</span>
              </div>
              <div class="row">
                <span>Hora:</span>
                <span>${date.toLocaleTimeString('es-DO', {hour: '2-digit', minute: '2-digit'})}</span>
              </div>
              ${ticket.customer_name ? `
              <div class="row">
                <span>Cliente:</span>
                <span>${ticket.customer_name}</span>
              </div>` : ''}
            </div>
            
            <div class="amount-section">
              <div class="amount-label">MONTO JUGADO</div>
              <div class="amount-value">${ticket.currency} ${ticket.amount.toLocaleString()}</div>
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
      const html = generateTicketHTML(lastTicket);
      await Print.printAsync({ html });
    } catch (error) {
      Alert.alert('Error', 'No se pudo imprimir el boleto');
    }
  };

  const handleShareWhatsApp = async () => {
    if (!lastTicket) return;
    
    const date = new Date(lastTicket.created_at);
    const message = `🎰 *BOLETO DE LOTERIA*\n\n` +
      `📋 *Boleto:* ${lastTicket.ticket_number}\n` +
      `🎲 *Lotería:* ${lastTicket.lottery_name}\n` +
      `🔢 *Números:* ${lastTicket.numbers.map(n => n.toString().padStart(2, '0')).join(' - ')}\n` +
      `💰 *Monto:* ${lastTicket.currency} ${lastTicket.amount.toLocaleString()}\n` +
      `🏆 *Premio Potencial:* ${lastTicket.currency} ${lastTicket.potential_win.toLocaleString()}\n` +
      `📅 *Fecha:* ${date.toLocaleDateString('es-DO')} ${date.toLocaleTimeString('es-DO')}\n` +
      `${lastTicket.customer_name ? `👤 *Cliente:* ${lastTicket.customer_name}\n` : ''}` +
      `\n¡Buena suerte! 🍀`;

    try {
      await Share.share({ message });
    } catch (error) {
      Alert.alert('Error', 'No se pudo compartir');
    }
  };

  const handleSubmit = async () => {
    if (!selectedLottery || selectedNumbers.length !== selectedLottery.numbers_to_pick) {
      Alert.alert('Error', `Selecciona ${selectedLottery?.numbers_to_pick} números`);
      return;
    }

    if (!selectedLottery.is_open) {
      Alert.alert('Error', `La lotería está cerrada. Próximo sorteo: ${selectedLottery.next_draw_time}`);
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Ingresa un monto válido');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/api/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          lottery_id: selectedLottery.id,
          numbers: selectedNumbers,
          amount: parseFloat(amount),
          currency: selectedLottery.currency,
          customer_name: customerName || null,
        }),
      });

      if (response.ok) {
        const ticket = await response.json();
        setLastTicket(ticket);
        setShowTicketModal(true);
        setSelectedNumbers([]);
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

  // Manual number input section instead of grid
  const renderManualNumberInput = () => {
    if (!selectedLottery) return null;

    return (
      <View style={styles.manualInputSection}>
        <Text style={styles.manualInputTitle}>
          Ingresa el número ({selectedLottery.min_number}-{selectedLottery.max_number})
        </Text>
        <View style={styles.manualInputRow}>
          <TextInput
            style={styles.manualNumberInput}
            value={numberInput}
            onChangeText={setNumberInput}
            placeholder={`Ej: ${selectedLottery.min_number}`}
            placeholderTextColor="#64748b"
            keyboardType="numeric"
            maxLength={3}
            onSubmitEditing={addNumberFromInput}
          />
          <TouchableOpacity 
            style={styles.addNumberButton}
            onPress={addNumberFromInput}
          >
            <Ionicons name="add-circle" size={24} color="#ffffff" />
            <Text style={styles.addNumberButtonText}>Agregar</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.quickActionsRow}>
          <TouchableOpacity style={styles.quickPickButton} onPress={handleQuickPick}>
            <Ionicons name="shuffle" size={18} color="#ffffff" />
            <Text style={styles.quickPickText}>Aleatorio</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.clearButton} 
            onPress={() => setSelectedNumbers([])}
          >
            <Ionicons name="trash" size={18} color="#ffffff" />
            <Text style={styles.clearButtonText}>Limpiar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#22c55e" style={styles.loader} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Vender Números</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={isDesktop && styles.contentDesktop}>
        <View style={isDesktop ? styles.desktopLayout : undefined}>
          <View style={isDesktop ? styles.leftColumn : undefined}>
            {/* Lottery Selector */}
            <TouchableOpacity
              style={[styles.lotterySelector, !selectedLottery?.is_open && styles.lotterySelectorClosed]}
              onPress={() => setShowLotteryModal(true)}
            >
              <View>
                <Text style={styles.lotterySelectorLabel}>Lotería</Text>
                <Text style={styles.lotterySelectorValue}>
                  {selectedLottery?.name} ({selectedLottery?.country})
                </Text>
                {!selectedLottery?.is_open && (
                  <Text style={styles.closedText}>⚠️ {selectedLottery?.closed_message || `CERRADA - Próximo: ${selectedLottery?.next_draw_time}`}</Text>
                )}
              </View>
              <Ionicons name="chevron-down" size={24} color="#94a3b8" />
            </TouchableOpacity>

            {/* Lottery Info */}
            {selectedLottery && (
              <View style={styles.lotteryInfo}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Rango:</Text>
                  <Text style={styles.infoValue}>
                    {selectedLottery.min_number} - {selectedLottery.max_number}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Seleccionar:</Text>
                  <Text style={styles.infoValue}>{selectedLottery.numbers_to_pick} números</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Multiplicador:</Text>
                  <Text style={styles.infoValue}>x{selectedLottery.prize_multiplier}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Cierre:</Text>
                  <Text style={styles.infoValue}>{selectedLottery.closing_minutes_before} min antes</Text>
                </View>
              </View>
            )}

            {/* Number Grid */}
            {renderNumberGrid()}
          </View>

          <View style={isDesktop ? styles.rightColumn : undefined}>
            {/* Selected Numbers */}
            <View style={styles.selectedContainer}>
              <Text style={styles.selectedLabel}>
                Números seleccionados ({selectedNumbers.length}/{selectedLottery?.numbers_to_pick || 0})
              </Text>
              <View style={styles.selectedNumbers}>
                {selectedNumbers.length > 0 ? (
                  selectedNumbers.map(num => (
                    <View key={num} style={styles.selectedNumber}>
                      <Text style={styles.selectedNumberText}>
                        {num.toString().padStart(2, '0')}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.noSelection}>Selecciona números</Text>
                )}
              </View>
              <TouchableOpacity style={styles.quickPickButton} onPress={handleQuickPick}>
                <Ionicons name="shuffle" size={18} color="#22c55e" />
                <Text style={styles.quickPickText}>Selección Rápida</Text>
              </TouchableOpacity>
            </View>

            {/* Amount Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Monto a jugar</Text>
              <View style={styles.amountContainer}>
                <Text style={styles.currencyLabel}>{selectedLottery?.currency}</Text>
                <TextInput
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                  placeholder="0.00"
                  placeholderTextColor="#64748b"
                />
              </View>
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

            {/* Potential Win */}
            {selectedLottery && amount && (
              <View style={styles.potentialWin}>
                <Text style={styles.potentialLabel}>Premio potencial</Text>
                <Text style={styles.potentialValue}>
                  {selectedLottery.currency} {(parseFloat(amount || '0') * selectedLottery.prize_multiplier).toLocaleString()}
                </Text>
              </View>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton, 
                (submitting || !selectedLottery?.is_open) && styles.submitButtonDisabled
              ]}
              onPress={handleSubmit}
              disabled={submitting || !selectedLottery?.is_open}
            >
              {submitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={24} color="#ffffff" />
                  <Text style={styles.submitButtonText}>
                    {selectedLottery?.is_open ? 'Confirmar Venta' : 'Lotería Cerrada'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Lottery Modal */}
      <Modal visible={showLotteryModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDesktop && styles.modalContentDesktop]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar Lotería</Text>
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
                    selectedLottery?.id === lottery.id && styles.lotteryOptionSelected,
                    !lottery.is_open && styles.lotteryOptionClosed,
                  ]}
                  onPress={() => {
                    setSelectedLottery(lottery);
                    setSelectedNumbers([]);
                    setAmount(lottery.price.toString());
                    setShowLotteryModal(false);
                  }}
                >
                  <View style={styles.lotteryOptionContent}>
                    <View style={styles.lotteryOptionHeader}>
                      <Text style={styles.lotteryOptionName}>{lottery.name}</Text>
                      {!lottery.is_open && (
                        <View style={styles.closedBadge}>
                          <Text style={styles.closedBadgeText}>CERRADA</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.lotteryOptionInfo}>
                      {lottery.country} • {lottery.currency} {lottery.price} • x{lottery.prize_multiplier}
                    </Text>
                    {lottery.next_draw_time && (
                      <Text style={styles.nextDrawText}>Próximo: {lottery.next_draw_time}</Text>
                    )}
                  </View>
                  {selectedLottery?.id === lottery.id && (
                    <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
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
                <Text style={styles.ticketLottery}>{lastTicket.lottery_name}</Text>
                <View style={styles.ticketNumbers}>
                  {lastTicket.numbers.map((num, idx) => (
                    <View key={idx} style={styles.ticketNumberBall}>
                      <Text style={styles.ticketNumberBallText}>
                        {num.toString().padStart(2, '0')}
                      </Text>
                    </View>
                  ))}
                </View>
                <View style={styles.ticketAmountRow}>
                  <Text style={styles.ticketAmountLabel}>Monto:</Text>
                  <Text style={styles.ticketAmountValue}>
                    {lastTicket.currency} {lastTicket.amount.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.ticketAmountRow}>
                  <Text style={styles.ticketAmountLabel}>Premio potencial:</Text>
                  <Text style={[styles.ticketAmountValue, styles.ticketPotentialWin]}>
                    {lastTicket.currency} {lastTicket.potential_win.toLocaleString()}
                  </Text>
                </View>
                {lastTicket.commission_earned && (
                  <View style={styles.ticketAmountRow}>
                    <Text style={styles.ticketAmountLabel}>Tu comisión:</Text>
                    <Text style={[styles.ticketAmountValue, styles.ticketCommission]}>
                      {lastTicket.currency} {lastTicket.commission_earned.toLocaleString()}
                    </Text>
                  </View>
                )}
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
    padding: 16,
  },
  contentDesktop: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  desktopLayout: {
    flexDirection: 'row',
    gap: 24,
  },
  leftColumn: {
    flex: 2,
  },
  rightColumn: {
    flex: 1,
    minWidth: 320,
  },
  lotterySelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  lotterySelectorClosed: {
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  lotterySelectorLabel: {
    fontSize: 12,
    color: '#94a3b8',
  },
  lotterySelectorValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 4,
  },
  closedText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 4,
  },
  lotteryInfo: {
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 13,
    color: '#94a3b8',
  },
  infoValue: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '500',
  },
  selectedContainer: {
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  selectedLabel: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 12,
  },
  selectedNumbers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    minHeight: 50,
  },
  selectedNumber: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  selectedNumberText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  noSelection: {
    color: '#64748b',
    fontStyle: 'italic',
  },
  quickPickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#22c55e',
    borderRadius: 8,
  },
  quickPickText: {
    color: '#22c55e',
    marginLeft: 8,
    fontWeight: '500',
  },
  numberGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 16,
  },
  numberGridDesktop: {
    justifyContent: 'flex-start',
  },
  numberButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 4,
  },
  numberButtonDesktop: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  numberButtonSelected: {
    backgroundColor: '#22c55e',
  },
  numberText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '500',
  },
  numberTextSelected: {
    color: '#ffffff',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 8,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  currencyLabel: {
    fontSize: 16,
    color: '#22c55e',
    fontWeight: '600',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    height: 52,
    fontSize: 18,
    color: '#ffffff',
  },
  textInput: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
    fontSize: 16,
    color: '#ffffff',
  },
  potentialWin: {
    backgroundColor: '#14532d',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  potentialLabel: {
    fontSize: 12,
    color: '#86efac',
  },
  potentialValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#22c55e',
    marginTop: 4,
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
  modalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  lotteryOptionSelected: {
    backgroundColor: '#0f172a',
  },
  lotteryOptionClosed: {
    opacity: 0.7,
  },
  lotteryOptionContent: {
    flex: 1,
  },
  lotteryOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lotteryOptionName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
  },
  closedBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  closedBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  lotteryOptionInfo: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
  },
  nextDrawText: {
    fontSize: 12,
    color: '#f59e0b',
    marginTop: 2,
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
    alignItems: 'center',
    marginBottom: 20,
  },
  ticketNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#22c55e',
    marginBottom: 8,
  },
  ticketLottery: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 16,
  },
  ticketNumbers: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  ticketNumberBall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  ticketNumberBallText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  ticketAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 6,
  },
  ticketAmountLabel: {
    fontSize: 14,
    color: '#94a3b8',
  },
  ticketAmountValue: {
    fontSize: 14,
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
});

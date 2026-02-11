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
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Print from 'expo-print';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const { width } = Dimensions.get('window');
const isDesktop = width > 768;

interface Animalito {
  number: number;
  name: string;
  emoji: string;
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

export default function Animalitos() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [animalitos, setAnimalitos] = useState<Animalito[]>([]);
  const [lotteries, setLotteries] = useState<Lottery[]>([]);
  const [selectedLottery, setSelectedLottery] = useState<Lottery | null>(null);
  const [selectedAnimalitos, setSelectedAnimalitos] = useState<number[]>([]);
  const [amount, setAmount] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showLotteryModal, setShowLotteryModal] = useState(false);
  const [lastTicket, setLastTicket] = useState<TicketResponse | null>(null);
  const [showTicketModal, setShowTicketModal] = useState(false);

  useEffect(() => {
    Promise.all([fetchAnimalitos(), fetchLotteries()]).then(() => setLoading(false));
  }, []);

  const fetchAnimalitos = async () => {
    try {
      const response = await fetch(`${API_URL}/api/animalitos`);
      if (response.ok) {
        const data = await response.json();
        setAnimalitos(data);
      }
    } catch (error) {
      console.error('Error fetching animalitos:', error);
    }
  };

  const fetchLotteries = async () => {
    try {
      const response = await fetch(`${API_URL}/api/lotteries`);
      if (response.ok) {
        const data = await response.json();
        // Filter only animalitos lotteries
        const animalitosLotteries = data.filter(
          (l: Lottery) => l.lottery_type === 'animalitos' || l.lottery_type === 'animalitos_triple'
        );
        setLotteries(animalitosLotteries);
        if (animalitosLotteries.length > 0) {
          const openLottery = animalitosLotteries.find((l: Lottery) => l.is_open) || animalitosLotteries[0];
          setSelectedLottery(openLottery);
          setAmount(openLottery.price.toString());
        }
      }
    } catch (error) {
      console.error('Error fetching lotteries:', error);
    }
  };

  const handleAnimalSelect = (num: number) => {
    if (!selectedLottery) return;

    if (selectedAnimalitos.includes(num)) {
      setSelectedAnimalitos(selectedAnimalitos.filter(n => n !== num));
    } else if (selectedAnimalitos.length < selectedLottery.numbers_to_pick) {
      setSelectedAnimalitos([...selectedAnimalitos, num].sort((a, b) => a - b));
    }
  };

  const handleQuickPick = () => {
    if (!selectedLottery) return;
    
    const numbers: number[] = [];
    while (numbers.length < selectedLottery.numbers_to_pick) {
      const num = Math.floor(Math.random() * 37); // 0-36
      if (!numbers.includes(num)) {
        numbers.push(num);
      }
    }
    setSelectedAnimalitos(numbers.sort((a, b) => a - b));
  };

  const getAnimalName = (num: number) => {
    const animal = animalitos.find(a => a.number === num);
    return animal ? `${animal.emoji} ${animal.name}` : num.toString();
  };

  const generateTicketHTML = (ticket: TicketResponse) => {
    const date = new Date(ticket.created_at);
    const animalsHTML = ticket.numbers
      .map(n => {
        const animal = animalitos.find(a => a.number === n);
        return animal ? `<div class="animal-ball">${animal.emoji} ${animal.name} (${n})</div>` : n;
      })
      .join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Courier New', monospace; padding: 20px; max-width: 300px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
          .title { font-size: 18px; font-weight: bold; }
          .subtitle { font-size: 12px; color: #666; }
          .ticket-number { font-size: 14px; font-weight: bold; margin: 10px 0; }
          .animals { text-align: center; padding: 15px; background: #f0f0f0; border-radius: 8px; margin: 10px 0; }
          .animal-ball { font-size: 16px; font-weight: bold; padding: 8px; margin: 4px 0; background: #22c55e; color: white; border-radius: 8px; }
          .details { font-size: 12px; }
          .row { display: flex; justify-content: space-between; padding: 4px 0; }
          .amount { font-size: 16px; font-weight: bold; color: #22c55e; }
          .footer { text-align: center; border-top: 2px dashed #000; padding-top: 10px; margin-top: 10px; font-size: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">🐾 ANIMALITOS</div>
          <div class="subtitle">Sistema de Lotería</div>
        </div>
        <div class="ticket-number">BOLETO: ${ticket.ticket_number}</div>
        <div class="details">
          <div class="row"><span>Lotería:</span><span>${ticket.lottery_name}</span></div>
          <div class="row"><span>Fecha:</span><span>${date.toLocaleDateString('es-DO')}</span></div>
          <div class="row"><span>Hora:</span><span>${date.toLocaleTimeString('es-DO')}</span></div>
          ${ticket.customer_name ? `<div class="row"><span>Cliente:</span><span>${ticket.customer_name}</span></div>` : ''}
        </div>
        <div class="animals">${animalsHTML}</div>
        <div class="details">
          <div class="row"><span>Monto:</span><span class="amount">${ticket.currency} ${ticket.amount.toLocaleString()}</span></div>
          <div class="row"><span>Premio Potencial:</span><span>${ticket.currency} ${ticket.potential_win.toLocaleString()}</span></div>
        </div>
        <div class="footer">
          <p>🍀 ¡Buena Suerte!</p>
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
    const animalsText = lastTicket.numbers
      .map(n => {
        const animal = animalitos.find(a => a.number === n);
        return animal ? `${animal.emoji} ${animal.name} (${n})` : n;
      })
      .join('\n');

    const message = `🐾 *BOLETO ANIMALITOS*\n\n` +
      `📋 *Boleto:* ${lastTicket.ticket_number}\n` +
      `🎲 *Lotería:* ${lastTicket.lottery_name}\n\n` +
      `🔢 *Animalitos:*\n${animalsText}\n\n` +
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
    if (!selectedLottery || selectedAnimalitos.length !== selectedLottery.numbers_to_pick) {
      Alert.alert('Error', `Selecciona ${selectedLottery?.numbers_to_pick} animalito(s)`);
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
          numbers: selectedAnimalitos,
          amount: parseFloat(amount),
          currency: selectedLottery.currency,
          customer_name: customerName || null,
        }),
      });

      if (response.ok) {
        const ticket = await response.json();
        setLastTicket(ticket);
        setShowTicketModal(true);
        setSelectedAnimalitos([]);
        setCustomerName('');
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
        <Text style={styles.headerTitle}>🐾 Animalitos</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={isDesktop && styles.contentDesktop}>
        {/* Lottery Selector */}
        <TouchableOpacity
          style={[styles.lotterySelector, !selectedLottery?.is_open && styles.lotterySelectorClosed]}
          onPress={() => setShowLotteryModal(true)}
        >
          <View>
            <Text style={styles.lotterySelectorLabel}>Lotería de Animalitos</Text>
            <Text style={styles.lotterySelectorValue}>
              {selectedLottery?.name}
            </Text>
            {!selectedLottery?.is_open && (
              <Text style={styles.closedText}>⚠️ CERRADA - Próximo: {selectedLottery?.next_draw_time}</Text>
            )}
          </View>
          <Ionicons name="chevron-down" size={24} color="#94a3b8" />
        </TouchableOpacity>

        {/* Info */}
        {selectedLottery && (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Selecciona {selectedLottery.numbers_to_pick} animalito(s) • Premio x{selectedLottery.prize_multiplier}
            </Text>
          </View>
        )}

        {/* Selected Animalitos */}
        <View style={styles.selectedContainer}>
          <Text style={styles.selectedLabel}>
            Seleccionados ({selectedAnimalitos.length}/{selectedLottery?.numbers_to_pick || 0})
          </Text>
          <View style={styles.selectedAnimals}>
            {selectedAnimalitos.length > 0 ? (
              selectedAnimalitos.map(num => {
                const animal = animalitos.find(a => a.number === num);
                return (
                  <View key={num} style={styles.selectedAnimal}>
                    <Text style={styles.selectedAnimalEmoji}>{animal?.emoji}</Text>
                    <Text style={styles.selectedAnimalName}>{animal?.name}</Text>
                    <Text style={styles.selectedAnimalNumber}>({num})</Text>
                  </View>
                );
              })
            ) : (
              <Text style={styles.noSelection}>Toca un animalito para seleccionar</Text>
            )}
          </View>
          <TouchableOpacity style={styles.quickPickButton} onPress={handleQuickPick}>
            <Ionicons name="shuffle" size={18} color="#22c55e" />
            <Text style={styles.quickPickText}>Selección Rápida</Text>
          </TouchableOpacity>
        </View>

        {/* Animalitos Grid */}
        <View style={styles.animalsGrid}>
          {animalitos.map(animal => (
            <TouchableOpacity
              key={animal.number}
              style={[
                styles.animalCard,
                selectedAnimalitos.includes(animal.number) && styles.animalCardSelected,
              ]}
              onPress={() => handleAnimalSelect(animal.number)}
            >
              <Text style={styles.animalEmoji}>{animal.emoji}</Text>
              <Text style={[
                styles.animalName,
                selectedAnimalitos.includes(animal.number) && styles.animalNameSelected,
              ]}>
                {animal.name}
              </Text>
              <Text style={[
                styles.animalNumber,
                selectedAnimalitos.includes(animal.number) && styles.animalNumberSelected,
              ]}>
                {animal.number}
              </Text>
            </TouchableOpacity>
          ))}
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
              <Ionicons name="paw" size={24} color="#ffffff" />
              <Text style={styles.submitButtonText}>
                {selectedLottery?.is_open ? 'Confirmar Venta' : 'Lotería Cerrada'}
              </Text>
            </>
          )}
        </TouchableOpacity>
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
                  ]}
                  onPress={() => {
                    setSelectedLottery(lottery);
                    setSelectedAnimalitos([]);
                    setAmount(lottery.price.toString());
                    setShowLotteryModal(false);
                  }}
                >
                  <View>
                    <Text style={styles.lotteryOptionName}>{lottery.name}</Text>
                    <Text style={styles.lotteryOptionInfo}>
                      {lottery.numbers_to_pick} animalito(s) • x{lottery.prize_multiplier}
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
              <Text style={styles.successEmoji}>🎉</Text>
              <Text style={styles.ticketModalTitle}>¡Venta Exitosa!</Text>
            </View>
            
            {lastTicket && (
              <View style={styles.ticketPreview}>
                <Text style={styles.ticketNumber}>{lastTicket.ticket_number}</Text>
                <Text style={styles.ticketLottery}>{lastTicket.lottery_name}</Text>
                <View style={styles.ticketAnimals}>
                  {lastTicket.numbers.map(num => {
                    const animal = animalitos.find(a => a.number === num);
                    return (
                      <View key={num} style={styles.ticketAnimalBall}>
                        <Text style={styles.ticketAnimalEmoji}>{animal?.emoji}</Text>
                        <Text style={styles.ticketAnimalName}>{animal?.name}</Text>
                      </View>
                    );
                  })}
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
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  lotterySelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
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
  infoBox: {
    backgroundColor: '#14532d',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  infoText: {
    color: '#86efac',
    fontSize: 13,
    textAlign: 'center',
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
  selectedAnimals: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    minHeight: 50,
  },
  selectedAnimal: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22c55e',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  selectedAnimalEmoji: {
    fontSize: 20,
    marginRight: 6,
  },
  selectedAnimalName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  selectedAnimalNumber: {
    fontSize: 12,
    color: '#86efac',
    marginLeft: 4,
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
  animalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  animalCard: {
    width: isDesktop ? '18%' : '31%',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  animalCardSelected: {
    backgroundColor: '#14532d',
    borderColor: '#22c55e',
  },
  animalEmoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  animalName: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
  },
  animalNameSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },
  animalNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#64748b',
    marginTop: 2,
  },
  animalNumberSelected: {
    color: '#22c55e',
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
    maxHeight: '60%',
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
  lotteryOptionName: {
    fontSize: 16,
    fontWeight: '500',
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
  successEmoji: {
    fontSize: 48,
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
  ticketAnimals: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 16,
  },
  ticketAnimalBall: {
    alignItems: 'center',
    backgroundColor: '#22c55e',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    margin: 4,
  },
  ticketAnimalEmoji: {
    fontSize: 24,
  },
  ticketAnimalName: {
    fontSize: 11,
    color: '#ffffff',
    fontWeight: '600',
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

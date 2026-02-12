import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  Share,
  Dimensions,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Print from 'expo-print';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const { width } = Dimensions.get('window');
const isDesktop = width > 768;

interface Ticket {
  id: string;
  ticket_number: string;
  lottery_name?: string;
  numbers?: number[];
  amount?: number;
  total_amount?: number;
  currency: string;
  potential_win?: number;
  total_potential_win?: number;
  status: 'pending' | 'won' | 'lost' | 'cancelled' | 'paid';
  customer_name?: string;
  created_at: string;
  seller_name: string;
  ticket_type?: string;
  plays?: any[];
}

export default function Tickets() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'won' | 'lost' | 'cancelled' | 'paid'>('all');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchTickets = useCallback(async () => {
    try {
      let url = `${API_URL}/api/tickets`;
      if (filter !== 'all') {
        url += `?status=${filter}`;
      }
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setTickets(data);
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  }, [token, filter]);

  // Filter tickets based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredTickets(tickets);
    } else {
      const query = searchQuery.trim().toLowerCase();
      const filtered = tickets.filter(ticket => {
        // Search by full ticket number or last 4 digits
        const ticketNum = ticket.ticket_number.toLowerCase();
        return ticketNum.includes(query) || ticketNum.endsWith(query);
      });
      setFilteredTickets(filtered);
    }
  }, [tickets, searchQuery]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTickets();
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'won': return '#22c55e';
      case 'paid': return '#3b82f6';
      case 'lost': return '#ef4444';
      case 'cancelled': return '#64748b';
      default: return '#f59e0b';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'won': return 'GANADOR';
      case 'paid': return 'PAGADO';
      case 'lost': return 'PERDIDO';
      case 'cancelled': return 'CANCELADO';
      default: return 'PENDIENTE';
    }
  };

  const canCancel = (ticket: Ticket) => {
    if (ticket.status !== 'pending') return false;
    
    // Super Admin can cancel ANY pending ticket at ANY time
    if (user?.role === 'super_admin') return true;
    
    // For other users, check 5-minute limit
    const created = new Date(ticket.created_at);
    const now = new Date();
    const diffMinutes = (now.getTime() - created.getTime()) / 60000;
    return diffMinutes <= 5;
  };

  const handleCancel = async () => {
    if (!selectedTicket) return;
    
    Alert.alert(
      'Cancelar Boleto',
      `¿Estás seguro de cancelar el boleto ${selectedTicket.ticket_number}?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, Cancelar',
          style: 'destructive',
          onPress: async () => {
            setProcessing(true);
            try {
              const response = await fetch(`${API_URL}/api/tickets/${selectedTicket.id}/cancel`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
              });

              if (response.ok) {
                Alert.alert('Éxito', 'Boleto cancelado');
                setShowActionModal(false);
                fetchTickets();
              } else {
                const error = await response.json();
                Alert.alert('Error', error.detail || 'No se pudo cancelar');
              }
            } catch (error) {
              Alert.alert('Error', 'Error de conexión');
            } finally {
              setProcessing(false);
            }
          }
        }
      ]
    );
  };

  const handlePay = async () => {
    if (!selectedTicket) return;
    const winAmount = selectedTicket.potential_win || selectedTicket.total_potential_win || 0;
    
    Alert.alert(
      'Pagar Premio',
      `¿Confirmar pago de ${selectedTicket.currency} ${winAmount.toLocaleString()} al boleto ${selectedTicket.ticket_number}?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, Pagar',
          onPress: async () => {
            setProcessing(true);
            try {
              const response = await fetch(`${API_URL}/api/tickets/${selectedTicket.id}/pay`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
              });

              if (response.ok) {
                const result = await response.json();
                Alert.alert('Éxito', `Premio pagado: ${result.amount_paid.toLocaleString()}`);
                setShowActionModal(false);
                fetchTickets();
              } else {
                const error = await response.json();
                Alert.alert('Error', error.detail || 'No se pudo pagar');
              }
            } catch (error) {
              Alert.alert('Error', 'Error de conexión');
            } finally {
              setProcessing(false);
            }
          }
        }
      ]
    );
  };

  const generateTicketHTML = (ticket: Ticket) => {
    const date = new Date(ticket.created_at);
    const isMultiPlay = ticket.ticket_type === 'multi_play';
    const amount = ticket.amount || ticket.total_amount || 0;
    const potentialWin = ticket.potential_win || ticket.total_potential_win || 0;
    
    // Generate plays HTML for multi-play tickets
    const playsHTML = isMultiPlay && ticket.plays ? ticket.plays.map(play => 
      `<div class="play-row"><strong>${play.lottery_type || play.lottery_name}:</strong> ${(play.numbers || []).map((n: number) => n.toString().padStart(2, '0')).join('-')}</div>`
    ).join('') : '';
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Arial Black', 'Helvetica Neue', sans-serif; 
            padding: 10px; 
            max-width: 280px; 
            margin: 0 auto; 
            font-weight: 900; 
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .header { 
            text-align: center; 
            border-bottom: 2px dashed #000; 
            padding-bottom: 6px; 
            margin-bottom: 6px; 
          }
          .title { 
            font-size: 18px; 
            font-weight: 900; 
            letter-spacing: 2px; 
            text-transform: uppercase;
          }
          .ticket-number { 
            font-size: 12px; 
            font-weight: 900; 
            margin: 4px 0; 
            text-align: center; 
            background: #000;
            color: #fff;
            padding: 4px;
            border-radius: 4px;
          }
          .lottery-name { 
            font-size: 14px; 
            font-weight: 900; 
            text-align: center; 
            margin: 4px 0; 
            text-transform: uppercase;
          }
          .details { 
            font-size: 11px; 
            font-weight: 900; 
            margin: 6px 0;
          }
          .row { 
            display: flex; 
            justify-content: space-between; 
            padding: 2px 0; 
            font-weight: 900;
          }
          .numbers { 
            font-size: 22px; 
            font-weight: 900; 
            text-align: center; 
            padding: 10px 6px; 
            background: #f0f0f0; 
            border: 2px solid #000;
            border-radius: 6px; 
            margin: 6px 0; 
            letter-spacing: 4px;
          }
          .plays-container {
            background: #f5f5f5;
            border: 2px solid #000;
            border-radius: 6px;
            padding: 8px;
            margin: 6px 0;
          }
          .plays-title {
            font-size: 12px;
            font-weight: 900;
            text-align: center;
            margin-bottom: 6px;
            text-transform: uppercase;
          }
          .play-row {
            font-size: 11px;
            font-weight: 900;
            padding: 3px 0;
            border-bottom: 1px dotted #999;
          }
          .play-row:last-child {
            border-bottom: none;
          }
          .status { 
            text-align: center; 
            padding: 6px 8px; 
            margin: 6px 0; 
            font-weight: 900; 
            font-size: 14px; 
            border-radius: 4px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .won { background: #22c55e; color: white; }
          .paid { background: #3b82f6; color: white; }
          .pending { background: #f59e0b; color: white; }
          .lost { background: #ef4444; color: white; }
          .amounts { 
            font-size: 14px; 
            font-weight: 900; 
            margin: 6px 0;
            border: 2px solid #000;
            border-radius: 6px;
            padding: 8px;
            background: #fafafa;
          }
          .amounts .row { 
            padding: 4px 0; 
            font-weight: 900;
          }
          .amounts .label {
            font-weight: 900;
          }
          .amounts .value {
            font-weight: 900;
            font-size: 15px;
          }
          .prize { color: #16a34a; }
          .footer { 
            text-align: center; 
            border-top: 2px dashed #000; 
            padding-top: 6px; 
            margin-top: 6px; 
            font-size: 10px; 
            font-weight: 900;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">🎰 LOTERIA 🎰</div>
        </div>
        <div class="ticket-number">${ticket.ticket_number}</div>
        <div class="lottery-name">${isMultiPlay ? `MULTI-JUGADA (${ticket.plays?.length || 0})` : ticket.lottery_name}</div>
        <div class="details">
          <div class="row"><strong>${date.toLocaleDateString('es-DO')}</strong><strong>${date.toLocaleTimeString('es-DO', {hour: '2-digit', minute:'2-digit'})}</strong></div>
          ${ticket.customer_name ? `<div class="row"><strong>Cliente:</strong><strong>${ticket.customer_name}</strong></div>` : ''}
        </div>
        ${isMultiPlay ? `
          <div class="plays-container">
            <div class="plays-title">Jugadas</div>
            ${playsHTML}
          </div>
        ` : `
          <div class="numbers">${(ticket.numbers || []).map(n => n?.toString().padStart(2, '0') || '--').join(' - ')}</div>
        `}
        <div class="status ${ticket.status === 'won' ? 'won' : ticket.status === 'paid' ? 'paid' : ticket.status === 'lost' ? 'lost' : 'pending'}">${getStatusText(ticket.status)}</div>
        <div class="amounts">
          <div class="row"><span class="label">MONTO:</span><span class="value">${ticket.currency} ${amount.toLocaleString()}</span></div>
          <div class="row"><span class="label">PREMIO:</span><span class="value prize">${ticket.currency} ${potentialWin.toLocaleString()}</span></div>
        </div>
        <div class="footer"><strong>${ticket.seller_name}</strong></div>
      </body>
      </html>
    `;
  };

  const handlePrint = async () => {
    if (!selectedTicket) return;
    try {
      await Print.printAsync({ html: generateTicketHTML(selectedTicket) });
    } catch (error) {
      Alert.alert('Error', 'No se pudo imprimir');
    }
  };

  const handleShare = async () => {
    if (!selectedTicket) return;
    const date = new Date(selectedTicket.created_at);
    const message = `🎰 *BOLETO DE LOTERIA*\n\n` +
      `📋 *Boleto:* ${selectedTicket.ticket_number}\n` +
      `🎲 *Lotería:* ${selectedTicket.lottery_name}\n` +
      `🔢 *Números:* ${(selectedTicket.numbers || []).map(n => n?.toString().padStart(2, '0') || '--').join(' - ')}\n` +
      `💰 *Monto:* ${selectedTicket.currency} ${selectedTicket.amount.toLocaleString()}\n` +
      `🏆 *Estado:* ${getStatusText(selectedTicket.status)}\n` +
      `${selectedTicket.status === 'won' ? `💵 *Premio:* ${selectedTicket.currency} ${selectedTicket.potential_win.toLocaleString()}\n` : ''}`;

    try {
      await Share.share({ message });
    } catch (error) {
      Alert.alert('Error', 'No se pudo compartir');
    }
  };

  const renderTicket = ({ item }: { item: Ticket }) => {
    const amount = item.amount || item.total_amount || 0;
    const potentialWin = item.potential_win || item.total_potential_win || 0;
    const isMultiPlay = item.ticket_type === 'multi_play';
    const displayNumbers = item.numbers || [];
    const lotteryName = isMultiPlay 
      ? `Multi-jugada (${item.plays?.length || 0} jugadas)` 
      : (item.lottery_name || 'N/A');
    
    return (
      <TouchableOpacity
        style={[styles.ticketCard, item.status === 'cancelled' && styles.ticketCancelled]}
        onPress={() => {
          setSelectedTicket(item);
          setShowActionModal(true);
        }}
      >
        <View style={styles.ticketHeader}>
          <View>
            <Text style={styles.ticketNumber}>{item.ticket_number}</Text>
            <Text style={styles.lotteryName}>{lotteryName}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
          </View>
        </View>

        {!isMultiPlay && displayNumbers.length > 0 && (
          <View style={styles.numbersContainer}>
            {displayNumbers.map((num, index) => (
              <View key={index} style={[styles.numberBall, item.status === 'won' && styles.winnerBall]}>
                <Text style={styles.numberBallText}>{num?.toString().padStart(2, '0') || '--'}</Text>
              </View>
            ))}
          </View>
        )}

        {isMultiPlay && item.plays && (
          <View style={styles.playsContainer}>
            {item.plays.slice(0, 3).map((play: any, idx: number) => (
              <Text key={idx} style={styles.playText}>
                {play.lottery_type || play.lottery_name}: {(play.numbers || []).map((n: number) => n.toString().padStart(2, '0')).join('-')}
              </Text>
            ))}
            {item.plays.length > 3 && (
              <Text style={styles.playText}>+{item.plays.length - 3} más...</Text>
            )}
          </View>
        )}

        <View style={styles.ticketDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Monto:</Text>
            <Text style={styles.detailValue}>{item.currency} {amount.toLocaleString()}</Text>
          </View>
          {(item.status === 'won' || item.status === 'paid') && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Premio:</Text>
              <Text style={[styles.detailValue, styles.prizeValue]}>
                {item.currency} {potentialWin.toLocaleString()}
              </Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Fecha:</Text>
            <Text style={styles.detailValue}>
              {new Date(item.created_at).toLocaleString('es-DO')}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const filters = [
    { key: 'all', label: 'Todos' },
    { key: 'pending', label: 'Pendientes' },
    { key: 'won', label: 'Ganadores' },
    { key: 'paid', label: 'Pagados' },
    { key: 'lost', label: 'Perdidos' },
    { key: 'cancelled', label: 'Cancelados' },
  ] as const;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Boletos</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Ionicons name="refresh" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search" size={20} color="#64748b" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Buscar por # ticket (ej: 1234 o últimos 4 dígitos)"
            placeholderTextColor="#64748b"
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color="#64748b" />
            </TouchableOpacity>
          )}
        </View>
        {searchQuery.length > 0 && (
          <Text style={styles.searchResultsText}>
            {filteredTickets.length} resultado(s) encontrado(s)
          </Text>
        )}
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <FlatList
          data={filters}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.key}
          renderItem={({ item: f }) => (
            <TouchableOpacity
              style={[styles.filterButton, filter === f.key && styles.filterButtonActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.filtersContent}
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#22c55e" style={styles.loader} />
      ) : (
        <FlatList
          data={filteredTickets}
          renderItem={renderTicket}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, isDesktop && styles.listContentDesktop]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="ticket-outline" size={64} color="#475569" />
              <Text style={styles.emptyText}>
                {searchQuery ? 'No se encontró el boleto' : 'No hay boletos'}
              </Text>
            </View>
          }
          numColumns={isDesktop ? 2 : 1}
          key={isDesktop ? 'desktop' : 'mobile'}
        />
      )}

      {/* Action Modal */}
      <Modal visible={showActionModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDesktop && styles.modalContentDesktop]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Acciones del Boleto</Text>
              <TouchableOpacity onPress={() => setShowActionModal(false)}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>

            {selectedTicket && (
              <View style={styles.modalBody}>
                <View style={styles.ticketPreview}>
                  <Text style={styles.previewNumber}>{selectedTicket.ticket_number}</Text>
                  <Text style={styles.previewLottery}>
                    {selectedTicket.ticket_type === 'multi_play' 
                      ? `Multi-jugada (${selectedTicket.plays?.length || 0} jugadas)` 
                      : selectedTicket.lottery_name}
                  </Text>
                  {selectedTicket.numbers && selectedTicket.numbers.length > 0 ? (
                    <View style={styles.previewNumbers}>
                      {selectedTicket.numbers.map((num, idx) => (
                        <View key={idx} style={styles.previewBall}>
                          <Text style={styles.previewBallText}>{num?.toString().padStart(2, '0') || '--'}</Text>
                        </View>
                      ))}
                    </View>
                  ) : selectedTicket.plays && selectedTicket.plays.length > 0 ? (
                    <View style={styles.playsPreview}>
                      {selectedTicket.plays.slice(0, 4).map((play: any, idx: number) => (
                        <Text key={idx} style={styles.playPreviewText}>
                          {play.lottery_type || play.lottery_name}: {(play.numbers || []).map((n: number) => n.toString().padStart(2, '0')).join('-')}
                        </Text>
                      ))}
                      {selectedTicket.plays.length > 4 && (
                        <Text style={styles.playPreviewText}>+{selectedTicket.plays.length - 4} más...</Text>
                      )}
                    </View>
                  ) : null}
                  <View style={[styles.previewStatus, { backgroundColor: getStatusColor(selectedTicket.status) }]}>
                    <Text style={styles.previewStatusText}>{getStatusText(selectedTicket.status)}</Text>
                  </View>
                </View>

                <View style={styles.actionButtonsRow}>
                  <TouchableOpacity style={styles.actionButtonSmall} onPress={() => setShowReceiptModal(true)}>
                    <Ionicons name="eye" size={20} color="#ffffff" />
                    <Text style={styles.actionButtonSmallText}>Ver</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.actionButtonSmall} onPress={handlePrint}>
                    <Ionicons name="print" size={20} color="#ffffff" />
                    <Text style={styles.actionButtonSmallText}>Imprimir</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.actionButtonSmall, styles.whatsappButtonSmall]} onPress={handleShare}>
                    <Ionicons name="share-social" size={20} color="#ffffff" />
                    <Text style={styles.actionButtonSmallText}>Compartir</Text>
                  </TouchableOpacity>
                </View>

                {selectedTicket.status === 'won' && (
                  <TouchableOpacity
                    style={[styles.payButton, processing && styles.buttonDisabled]}
                    onPress={handlePay}
                    disabled={processing}
                  >
                    {processing ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <>
                        <Ionicons name="cash" size={22} color="#ffffff" />
                        <Text style={styles.payButtonText}>
                          Pagar Premio ({selectedTicket.currency} {(selectedTicket.potential_win || selectedTicket.total_potential_win || 0).toLocaleString()})
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {canCancel(selectedTicket) && (
                  <TouchableOpacity
                    style={[styles.cancelButton, processing && styles.buttonDisabled]}
                    onPress={handleCancel}
                    disabled={processing}
                  >
                    {processing ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <>
                        <Ionicons name="close-circle" size={22} color="#ffffff" />
                        <Text style={styles.cancelButtonText}>Cancelar Boleto</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {selectedTicket.status === 'pending' && !canCancel(selectedTicket) && (
                  <Text style={styles.cancelWarning}>
                    El tiempo de cancelación ha expirado (máx. 5 minutos)
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Receipt View Modal */}
      <Modal
        visible={showReceiptModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowReceiptModal(false)}
      >
        <View style={styles.receiptModalOverlay}>
          <View style={styles.receiptModalContent}>
            <View style={styles.receiptModalHeader}>
              <Text style={styles.receiptModalTitle}>Recibo del Boleto</Text>
              <TouchableOpacity onPress={() => setShowReceiptModal(false)}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
            
            {selectedTicket && (
              <View style={styles.receiptBody}>
                <View style={styles.receiptHeader}>
                  <Text style={styles.receiptLogo}>🎰 LOTERIA 🎰</Text>
                </View>
                
                <View style={styles.receiptTicketNumber}>
                  <Text style={styles.receiptTicketNumberText}>{selectedTicket.ticket_number}</Text>
                </View>
                
                <Text style={styles.receiptLotteryName}>
                  {selectedTicket.ticket_type === 'multi_play' 
                    ? `MULTI-JUGADA (${selectedTicket.plays?.length || 0})` 
                    : selectedTicket.lottery_name?.toUpperCase()}
                </Text>
                
                <View style={styles.receiptDateRow}>
                  <Text style={styles.receiptDate}>
                    {new Date(selectedTicket.created_at).toLocaleDateString('es-DO')}
                  </Text>
                  <Text style={styles.receiptTime}>
                    {new Date(selectedTicket.created_at).toLocaleTimeString('es-DO', {hour: '2-digit', minute:'2-digit'})}
                  </Text>
                </View>
                
                {selectedTicket.customer_name && (
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>Cliente:</Text>
                    <Text style={styles.receiptValue}>{selectedTicket.customer_name}</Text>
                  </View>
                )}
                
                {selectedTicket.ticket_type === 'multi_play' && selectedTicket.plays ? (
                  <View style={styles.receiptPlaysContainer}>
                    <Text style={styles.receiptPlaysTitle}>JUGADAS</Text>
                    {selectedTicket.plays.map((play: any, idx: number) => (
                      <View key={idx} style={styles.receiptPlayRow}>
                        <Text style={styles.receiptPlayType}>{play.lottery_type || play.lottery_name}</Text>
                        <Text style={styles.receiptPlayNumbers}>
                          {(play.numbers || []).map((n: number) => n.toString().padStart(2, '0')).join('-')}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.receiptNumbersContainer}>
                    <Text style={styles.receiptNumbersLabel}>NÚMEROS</Text>
                    <Text style={styles.receiptNumbers}>
                      {(selectedTicket.numbers || []).map(n => n?.toString().padStart(2, '0') || '--').join(' - ')}
                    </Text>
                  </View>
                )}
                
                <View style={[styles.receiptStatusBadge, { backgroundColor: getStatusColor(selectedTicket.status) }]}>
                  <Text style={styles.receiptStatusText}>{getStatusText(selectedTicket.status)}</Text>
                </View>
                
                <View style={styles.receiptAmounts}>
                  <View style={styles.receiptAmountRow}>
                    <Text style={styles.receiptAmountLabel}>MONTO:</Text>
                    <Text style={styles.receiptAmountValue}>
                      {selectedTicket.currency} {(selectedTicket.amount || selectedTicket.total_amount || 0).toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.receiptAmountRow}>
                    <Text style={styles.receiptAmountLabel}>PREMIO:</Text>
                    <Text style={[styles.receiptAmountValue, styles.greenText]}>
                      {selectedTicket.currency} {(selectedTicket.potential_win || selectedTicket.total_potential_win || 0).toLocaleString()}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.receiptFooter}>
                  <Text style={styles.receiptSellerName}>{selectedTicket.seller_name}</Text>
                </View>
              </View>
            )}
            
            <View style={styles.receiptActions}>
              <TouchableOpacity style={styles.receiptActionBtn} onPress={handlePrint}>
                <Ionicons name="print" size={20} color="#ffffff" />
                <Text style={styles.receiptActionText}>Imprimir</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.receiptActionBtn, styles.shareBtn]} onPress={handleShare}>
                <Ionicons name="share-social" size={20} color="#ffffff" />
                <Text style={styles.receiptActionText}>Compartir</Text>
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
  searchContainer: {
    backgroundColor: '#1e293b',
    padding: 12,
    paddingTop: 0,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    height: '100%',
  },
  clearButton: {
    padding: 4,
  },
  searchResultsText: {
    fontSize: 12,
    color: '#22c55e',
    marginTop: 8,
    marginLeft: 4,
  },
  filtersContainer: {
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  filtersContent: {
    padding: 12,
  },
  filterButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#334155',
  },
  filterButtonActive: {
    backgroundColor: '#22c55e',
  },
  filterText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  filterTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
  },
  listContentDesktop: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  ticketCard: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 4,
  },
  ticketCancelled: {
    opacity: 0.6,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  ticketNumber: {
    fontSize: 12,
    color: '#22c55e',
    fontWeight: '600',
  },
  lotteryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  numbersContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
  },
  numberBall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 3,
    borderWidth: 2,
    borderColor: '#334155',
  },
  winnerBall: {
    borderColor: '#22c55e',
    backgroundColor: '#14532d',
  },
  numberBallText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  playsContainer: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  playText: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 4,
  },
  ticketDetails: {
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  detailLabel: {
    fontSize: 12,
    color: '#94a3b8',
  },
  detailValue: {
    fontSize: 12,
    color: '#ffffff',
  },
  prizeValue: {
    color: '#22c55e',
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 12,
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
  ticketPreview: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  previewNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#22c55e',
  },
  previewLottery: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 4,
  },
  previewNumbers: {
    flexDirection: 'row',
    marginTop: 16,
  },
  previewBall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  previewBallText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  previewStatus: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  previewStatusText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    flexWrap: 'wrap',
  },
  actionButtonSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  actionButtonSmallText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  whatsappButtonSmall: {
    backgroundColor: '#22c55e',
  },
  actionButton: {
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
  actionButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    marginLeft: 8,
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 12,
  },
  payButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    paddingVertical: 14,
    borderRadius: 10,
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  cancelWarning: {
    textAlign: 'center',
    color: '#f59e0b',
    fontSize: 12,
    marginTop: 8,
  },
  playsPreview: {
    marginTop: 12,
    paddingHorizontal: 8,
  },
  playPreviewText: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 4,
    textAlign: 'center',
  },
  // Receipt Modal Styles
  receiptModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  receiptModalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    width: '100%',
    maxWidth: 360,
    maxHeight: '90%',
  },
  receiptModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  receiptModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  receiptBody: {
    padding: 16,
    backgroundColor: '#ffffff',
    margin: 16,
    borderRadius: 12,
  },
  receiptHeader: {
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    borderStyle: 'dashed',
  },
  receiptLogo: {
    fontSize: 18,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 2,
  },
  receiptTicketNumber: {
    backgroundColor: '#000000',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    marginVertical: 10,
    alignSelf: 'center',
  },
  receiptTicketNumberText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  receiptLotteryName: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 8,
  },
  receiptDateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  receiptDate: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000000',
  },
  receiptTime: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000000',
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  receiptLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000000',
  },
  receiptValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000000',
  },
  receiptPlaysContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 10,
    marginVertical: 10,
    borderWidth: 2,
    borderColor: '#000000',
  },
  receiptPlaysTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 8,
  },
  receiptPlayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#dddddd',
  },
  receiptPlayType: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000000',
  },
  receiptPlayNumbers: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000000',
  },
  receiptNumbersContainer: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 12,
    marginVertical: 10,
    borderWidth: 2,
    borderColor: '#000000',
  },
  receiptNumbersLabel: {
    fontSize: 10,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 4,
  },
  receiptNumbers: {
    fontSize: 22,
    fontWeight: '900',
    color: '#000000',
    textAlign: 'center',
    letterSpacing: 4,
  },
  receiptStatusBadge: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 4,
    alignSelf: 'center',
    marginVertical: 8,
  },
  receiptStatusText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  receiptAmounts: {
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 8,
    padding: 10,
    marginVertical: 8,
    backgroundColor: '#fafafa',
  },
  receiptAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  receiptAmountLabel: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000000',
  },
  receiptAmountValue: {
    fontSize: 15,
    fontWeight: '900',
    color: '#000000',
  },
  greenText: {
    color: '#16a34a',
  },
  receiptFooter: {
    borderTopWidth: 2,
    borderTopColor: '#000000',
    borderStyle: 'dashed',
    paddingTop: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  receiptSellerName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000000',
  },
  receiptActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  receiptActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 8,
  },
  shareBtn: {
    backgroundColor: '#22c55e',
  },
  receiptActionText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
});

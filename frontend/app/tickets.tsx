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
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Print from 'expo-print';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const { width } = Dimensions.get('window');
const isDesktop = width > 768;

interface CompanyProfile {
  company_name?: string;
  logo_url?: string;
  address?: string;
  phone?: string;
  email?: string;
  rnc?: string;
  slogan?: string;
  receipt_footer?: string;
}

interface Play {
  lottery_type?: string;
  lottery_name?: string;
  lottery_id?: string;
  numbers: number[];
  amount: number;
  position?: number;
  potential_win?: number;
}

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
  plays?: Play[];
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
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [expandedTickets, setExpandedTickets] = useState<Set<string>>(new Set());
  const [statusCounts, setStatusCounts] = useState<{[key: string]: number}>({});

  // Toggle expanded state for a ticket
  const toggleExpanded = (ticketId: string) => {
    setExpandedTickets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(ticketId)) {
        newSet.delete(ticketId);
      } else {
        newSet.add(ticketId);
      }
      return newSet;
    });
  };

  // Get lottery type color
  const getLotteryTypeColor = (type?: string): string => {
    const colors: {[key: string]: string} = {
      'quiniela': '#3b82f6',
      'pale': '#8b5cf6', 
      'tripleta': '#ec4899',
      'super_pale': '#f59e0b',
    };
    return colors[type?.toLowerCase() || ''] || '#64748b';
  };

  const fetchCompanyProfile = useCallback(async () => {
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
  }, [token]);

  const fetchTickets = useCallback(async () => {
    try {
      // Fetch all tickets first for counts
      const allResponse = await fetch(`${API_URL}/api/tickets`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (allResponse.ok) {
        const allData = await allResponse.json();
        
        // Calculate status counts
        const counts: {[key: string]: number} = { all: allData.length };
        allData.forEach((t: Ticket) => {
          counts[t.status] = (counts[t.status] || 0) + 1;
        });
        setStatusCounts(counts);
        
        // Apply filter
        if (filter === 'all') {
          setTickets(allData);
        } else {
          setTickets(allData.filter((t: Ticket) => t.status === filter));
        }
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
    fetchCompanyProfile();
  }, [fetchTickets, fetchCompanyProfile]);

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
    
    // Generate QR code URL - Black & White
    const qrData = encodeURIComponent(ticket.ticket_number);
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${qrData}&bgcolor=ffffff&color=000000`;
    
    // Company Logo URL - Loteria Magic
    const logoUrl = 'https://customer-assets.emergentagent.com/job_0d52222c-173f-46ac-b2b0-ffceca2336e1/artifacts/cql3117b_loteria.jpg';
    
    // Status mapping
    const statusText: { [key: string]: string } = {
      'won': 'GANADOR', 'paid': 'PAGADO', 'pending': 'PENDIENTE', 'lost': 'PERDIDO', 'cancelled': 'CANCELADO'
    };
    
    // Generate plays HTML for multi-play tickets
    const playsHTML = isMultiPlay && ticket.plays ? ticket.plays.map((play, idx) => 
      `<div class="play-card">
        <div class="play-header">
          <span class="play-index">${idx + 1}</span>
          <span class="play-type">${(play.lottery_type || 'JUGADA').toUpperCase()}</span>
        </div>
        <div class="play-lottery-name">${play.lottery_name || 'Loteria'}</div>
        <div class="play-numbers">${(play.numbers || []).map((n: number) => n.toString().padStart(2, '0')).join(' - ')}</div>
        <div class="play-details">
          <span class="play-amount">${ticket.currency} ${(play.amount || 0).toFixed(2)}</span>
        </div>
      </div>`
    ).join('') : '';
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Arial', sans-serif; max-width: 300px; margin: 0 auto; background: #fff; color: #000; }
          .ticket { border: 3px solid #000; background: #fff; }
          .header { background: #fff; padding: 12px 10px 8px; text-align: center; border-bottom: 2px solid #000; }
          .logo-container { width: 60px; height: 60px; margin: 0 auto 6px; border: 2px solid #000; overflow: hidden; }
          .logo-img { width: 100%; height: 100%; object-fit: cover; }
          .brand-name { font-size: 18px; font-weight: 900; color: #000; letter-spacing: 1px; text-transform: uppercase; }
          .ticket-number-section { background: #000; color: #fff; padding: 10px; text-align: center; }
          .ticket-label { font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
          .ticket-number { font-size: 16px; font-weight: 900; letter-spacing: 1px; margin-top: 2px; font-family: 'Courier New', monospace; }
          .status-section { padding: 8px 10px; text-align: center; border-bottom: 1px dashed #000; }
          .status-badge { display: inline-block; background: #000; color: #fff; padding: 6px 16px; font-weight: 900; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
          .info-section { background: #fff; padding: 8px 10px; border-bottom: 1px dashed #000; display: flex; justify-content: space-between; align-items: center; }
          .date-info { font-size: 11px; color: #000; font-weight: 700; }
          .customer-info { font-size: 10px; color: #000; font-weight: 700; text-align: right; }
          .body { padding: 10px; background: #fff; }
          .lottery-name { text-align: center; font-size: 14px; font-weight: 900; color: #000; margin-bottom: 8px; text-transform: uppercase; border: 2px solid #000; padding: 6px; }
          .plays-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 2px solid #000; }
          .plays-title { font-weight: 900; font-size: 12px; color: #000; text-transform: uppercase; letter-spacing: 1px; }
          .plays-count { background: #000; color: #fff; padding: 2px 8px; font-size: 11px; font-weight: 900; }
          .play-card { border: 2px solid #000; margin-bottom: 8px; background: #fff; }
          .play-header { background: #000; color: #fff; padding: 4px 8px; display: flex; justify-content: space-between; align-items: center; }
          .play-index { font-size: 10px; font-weight: 900; }
          .play-type { font-size: 11px; font-weight: 900; letter-spacing: 1px; }
          .play-lottery-name { padding: 6px 8px 2px; font-size: 11px; font-weight: 700; color: #000; text-align: center; border-bottom: 1px dashed #000; }
          .play-numbers { font-weight: 900; font-size: 24px; color: #000; letter-spacing: 4px; font-family: 'Courier New', monospace; text-align: center; padding: 10px 8px; }
          .play-details { padding: 6px 8px; border-top: 1px dashed #000; text-align: right; }
          .play-amount { color: #000; font-weight: 900; font-size: 14px; }
          .numbers-display { background: #fff; border: 3px solid #000; padding: 15px; margin: 10px 0; text-align: center; }
          .numbers-value { font-size: 28px; font-weight: 900; color: #000; letter-spacing: 4px; font-family: 'Courier New', monospace; }
          .totals { background: #fff; border: 2px solid #000; margin: 8px 0; }
          .totals-header { background: #000; color: #fff; padding: 6px 10px; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; }
          .totals-body { padding: 10px; }
          .total-row { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; }
          .total-label { color: #000; font-size: 11px; font-weight: 700; }
          .grand-total-label { font-size: 12px; font-weight: 900; color: #000; }
          .grand-total-value { font-size: 18px; font-weight: 900; color: #000; }
          .footer { background: #fff; padding: 12px 10px; text-align: center; border-top: 2px dashed #000; }
          .qr-container { background: #fff; padding: 8px; margin: 0 auto 8px; display: inline-block; border: 2px solid #000; }
          .qr-code { width: 100px; height: 100px; display: block; }
          .qr-label { font-size: 9px; color: #000; font-weight: 700; margin-top: 4px; letter-spacing: 1px; }
          .scan-text { font-size: 10px; color: #000; font-weight: 700; margin-top: 6px; }
          .seller-info { margin-top: 8px; padding-top: 8px; border-top: 1px solid #000; font-size: 10px; color: #000; font-weight: 700; }
          .footer-notes { margin-top: 8px; }
          .footer-text { font-size: 9px; color: #000; font-weight: 700; margin: 2px 0; }
          .bottom-bar { background: #000; color: #fff; padding: 8px; text-align: center; font-size: 12px; font-weight: 900; letter-spacing: 2px; }
        </style>
      </head>
      <body>
        <div class="ticket">
          <div class="header">
            <div class="logo-container"><img class="logo-img" src="${logoUrl}" alt="Loteria" /></div>
            <div class="brand-name">LOTERIA MAGIC</div>
          </div>
          <div class="ticket-number-section">
            <div class="ticket-label">BOLETO No.</div>
            <div class="ticket-number">${ticket.ticket_number}</div>
          </div>
          <div class="status-section">
            <span class="status-badge">${statusText[ticket.status] || ticket.status.toUpperCase()}</span>
          </div>
          <div class="info-section">
            <div class="date-info">${date.toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' })} - ${date.toLocaleTimeString('es-DO', {hour: '2-digit', minute: '2-digit'})}</div>
            ${ticket.customer_name ? `<div class="customer-info">CLIENTE: ${ticket.customer_name.toUpperCase()}</div>` : ''}
          </div>
          <div class="body">
            ${isMultiPlay ? `
              <div class="plays-header">
                <span class="plays-title">DETALLE DE JUGADAS</span>
                <span class="plays-count">${ticket.plays?.length || 0}</span>
              </div>
              ${playsHTML}
            ` : `
              <div class="lottery-name">${ticket.lottery_name}</div>
              <div class="numbers-display">
                <div class="numbers-value">${(ticket.numbers || []).map(n => n?.toString().padStart(2, '0') || '--').join(' - ')}</div>
              </div>
            `}
            <div class="totals">
              <div class="totals-header">RESUMEN</div>
              <div class="totals-body">
                <div class="total-row">
                  <span class="grand-total-label">TOTAL:</span>
                  <span class="grand-total-value">${ticket.currency} ${amount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="footer">
            <div class="qr-container">
              <img class="qr-code" src="${qrCodeUrl}" alt="QR" />
              <div class="qr-label">${ticket.ticket_number}</div>
            </div>
            <div class="scan-text">ESCANEA PARA VERIFICAR</div>
            <div class="seller-info">VENDEDOR: ${ticket.seller_name?.toUpperCase() || 'N/A'}</div>
            <div class="footer-notes">
              <div class="footer-text">CONSERVE ESTE BOLETO</div>
              <div class="footer-text">VALIDO SOLO CON ORIGINAL</div>
            </div>
          </div>
          <div class="bottom-bar">BUENA SUERTE!</div>
        </div>
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
    const isExpanded = expandedTickets.has(item.id);
    const playsCount = item.plays?.length || 0;
    
    const lotteryName = isMultiPlay 
      ? `Multi-jugada` 
      : (item.lottery_name || 'N/A');
    
    return (
      <View style={[styles.ticketCard, item.status === 'cancelled' && styles.ticketCancelled]}>
        {/* Clickable Header Area */}
        <TouchableOpacity
          onPress={() => {
            setSelectedTicket(item);
            setShowActionModal(true);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.ticketHeader}>
            <View style={styles.ticketHeaderLeft}>
              <Text style={styles.ticketNumber}>{item.ticket_number}</Text>
              <View style={styles.lotteryNameRow}>
                <Text style={styles.lotteryName}>{lotteryName}</Text>
                {isMultiPlay && (
                  <View style={styles.playsCountBadge}>
                    <Text style={styles.playsCountText}>{playsCount}</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
              <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
            </View>
          </View>

          {/* Simple ticket numbers */}
          {!isMultiPlay && displayNumbers.length > 0 && (
            <View style={styles.numbersContainer}>
              {displayNumbers.map((num, index) => (
                <View key={index} style={[styles.numberBall, item.status === 'won' && styles.winnerBall]}>
                  <Text style={styles.numberBallText}>{num?.toString().padStart(2, '0') || '--'}</Text>
                </View>
              ))}
            </View>
          )}
        </TouchableOpacity>

        {/* Multi-play expandable section */}
        {isMultiPlay && item.plays && item.plays.length > 0 && (
          <View style={styles.multiPlaySection}>
            {/* Collapsed preview - show first 2 plays */}
            {!isExpanded && (
              <View style={styles.playsPreviewContainer}>
                {item.plays.slice(0, 2).map((play: Play, idx: number) => (
                  <View key={idx} style={styles.playPreviewRow}>
                    <View style={[styles.playTypeBadge, { backgroundColor: getLotteryTypeColor(play.lottery_type) }]}>
                      <Text style={styles.playTypeBadgeText}>
                        {(play.lottery_type || 'Q').substring(0, 1).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.playLotteryText} numberOfLines={1}>
                      {play.lottery_name || play.lottery_type || 'Lotería'}
                    </Text>
                    <View style={styles.playNumbersPreview}>
                      {play.numbers.map((n: number, i: number) => (
                        <Text key={i} style={styles.playNumberText}>
                          {n.toString().padStart(2, '0')}{i < play.numbers.length - 1 ? '-' : ''}
                        </Text>
                      ))}
                    </View>
                    <Text style={styles.playAmountText}>{item.currency}{play.amount}</Text>
                  </View>
                ))}
                {playsCount > 2 && (
                  <Text style={styles.morePlaysBadge}>+{playsCount - 2} más</Text>
                )}
              </View>
            )}

            {/* Expanded view - show all plays */}
            {isExpanded && (
              <View style={styles.playsExpandedContainer}>
                {item.plays.map((play: Play, idx: number) => (
                  <View key={idx} style={styles.playCard}>
                    <View style={styles.playCardHeader}>
                      <View style={[styles.playTypeIndicator, { backgroundColor: getLotteryTypeColor(play.lottery_type) }]} />
                      <Text style={styles.playCardType}>
                        {(play.lottery_type || 'quiniela').toUpperCase()}
                      </Text>
                      <Text style={styles.playCardIndex}>#{idx + 1}</Text>
                    </View>
                    <Text style={styles.playCardLottery}>{play.lottery_name || 'Lotería'}</Text>
                    <View style={styles.playCardNumbers}>
                      {play.numbers.map((n: number, i: number) => (
                        <View key={i} style={[styles.playNumberBall, { borderColor: getLotteryTypeColor(play.lottery_type) }]}>
                          <Text style={styles.playNumberBallText}>{n.toString().padStart(2, '0')}</Text>
                        </View>
                      ))}
                    </View>
                    <View style={styles.playCardFooter}>
                      <Text style={styles.playCardAmount}>{item.currency} {play.amount.toFixed(2)}</Text>
                      {play.potential_win && (
                        <Text style={styles.playCardPotential}>Premio: {item.currency} {play.potential_win.toFixed(2)}</Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Expand/Collapse button */}
            <TouchableOpacity 
              style={styles.expandButton}
              onPress={() => toggleExpanded(item.id)}
              data-testid={`expand-btn-${item.id}`}
            >
              <Ionicons 
                name={isExpanded ? 'chevron-up' : 'chevron-down'} 
                size={18} 
                color="#64748b" 
              />
              <Text style={styles.expandButtonText}>
                {isExpanded ? 'Colapsar' : `Ver ${playsCount} jugadas`}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Ticket details footer */}
        <TouchableOpacity
          onPress={() => {
            setSelectedTicket(item);
            setShowActionModal(true);
          }}
          activeOpacity={0.7}
        >
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
      </View>
    );
  };

  const filters = [
    { key: 'all', label: 'Todos', icon: 'list' },
    { key: 'pending', label: 'Pendientes', icon: 'time' },
    { key: 'won', label: 'Ganadores', icon: 'trophy' },
    { key: 'paid', label: 'Pagados', icon: 'checkmark-circle' },
    { key: 'lost', label: 'Perdidos', icon: 'close-circle' },
    { key: 'cancelled', label: 'Cancelados', icon: 'ban' },
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
          renderItem={({ item: f }) => {
            const count = statusCounts[f.key] || 0;
            return (
              <TouchableOpacity
                style={[styles.filterButton, filter === f.key && styles.filterButtonActive]}
                onPress={() => setFilter(f.key)}
                data-testid={`filter-${f.key}`}
              >
                <View style={styles.filterContent}>
                  <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
                    {f.label}
                  </Text>
                  {count > 0 && (
                    <View style={[styles.filterCountBadge, filter === f.key && styles.filterCountBadgeActive]}>
                      <Text style={[styles.filterCountText, filter === f.key && styles.filterCountTextActive]}>
                        {count}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
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
                  {companyProfile?.logo_url && (
                    <Image source={{ uri: companyProfile.logo_url }} style={styles.receiptCompanyLogo} />
                  )}
                  <Text style={styles.receiptLogo}>
                    {companyProfile?.company_name || '🎰 LOTERIA 🎰'}
                  </Text>
                  {companyProfile?.slogan && (
                    <Text style={styles.receiptSlogan}>{companyProfile.slogan}</Text>
                  )}
                  {companyProfile?.address && (
                    <Text style={styles.receiptCompanyInfo}>{companyProfile.address}</Text>
                  )}
                  {companyProfile?.phone && (
                    <Text style={styles.receiptCompanyInfo}>Tel: {companyProfile.phone}</Text>
                  )}
                  {companyProfile?.rnc && (
                    <Text style={styles.receiptCompanyInfo}>RNC: {companyProfile.rnc}</Text>
                  )}
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
                  {companyProfile?.receipt_footer && (
                    <Text style={styles.receiptCustomFooter}>{companyProfile.receipt_footer}</Text>
                  )}
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
  receiptCompanyLogo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 8,
  },
  receiptSlogan: {
    fontSize: 10,
    color: '#666666',
    fontStyle: 'italic',
    marginTop: 2,
  },
  receiptCompanyInfo: {
    fontSize: 9,
    color: '#333333',
    marginTop: 2,
  },
  receiptCustomFooter: {
    fontSize: 9,
    color: '#666666',
    marginTop: 6,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // New styles for improved ticket display
  ticketHeaderLeft: {
    flex: 1,
  },
  lotteryNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  playsCountBadge: {
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  playsCountText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  multiPlaySection: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    marginVertical: 8,
    overflow: 'hidden',
  },
  playsPreviewContainer: {
    padding: 10,
  },
  playPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  playTypeBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  playTypeBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  playLotteryText: {
    flex: 1,
    fontSize: 11,
    color: '#94a3b8',
  },
  playNumbersPreview: {
    flexDirection: 'row',
    marginRight: 8,
  },
  playNumberText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  playAmountText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#22c55e',
  },
  morePlaysBadge: {
    textAlign: 'center',
    fontSize: 11,
    color: '#64748b',
    paddingTop: 4,
    fontStyle: 'italic',
  },
  playsExpandedContainer: {
    padding: 10,
  },
  playCard: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    marginBottom: 8,
    overflow: 'hidden',
  },
  playCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#0f172a',
  },
  playTypeIndicator: {
    width: 4,
    height: 20,
    borderRadius: 2,
    marginRight: 8,
  },
  playCardType: {
    flex: 1,
    fontSize: 11,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  playCardIndex: {
    fontSize: 10,
    color: '#64748b',
  },
  playCardLottery: {
    padding: 8,
    paddingTop: 6,
    paddingBottom: 4,
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
  },
  playCardNumbers: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 8,
    paddingTop: 0,
  },
  playNumberBall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
    borderWidth: 2,
  },
  playNumberBallText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  playCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#0f172a',
  },
  playCardAmount: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#22c55e',
  },
  playCardPotential: {
    fontSize: 10,
    color: '#64748b',
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  expandButtonText: {
    fontSize: 12,
    color: '#64748b',
    marginLeft: 4,
  },
  // Filter count badge styles
  filterContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterCountBadge: {
    backgroundColor: '#475569',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 6,
    minWidth: 20,
    alignItems: 'center',
  },
  filterCountBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  filterCountText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#94a3b8',
  },
  filterCountTextActive: {
    color: '#ffffff',
  },
});

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Ticket {
  id: string;
  ticket_number: string;
  plays: any[];
  total_amount: number;
  status: string;
  payment_status: string;
  payment_method: string;
  receipt_url?: string;
  created_at: string;
  payment_deadline?: string;
  bank_account_name?: string;
}

const STATUS_CONFIG: { [key: string]: { label: string; color: string; icon: string } } = {
  pending: { label: 'Pendiente', color: '#f59e0b', icon: 'time' },
  pending_payment: { label: 'Pago Pendiente', color: '#ef4444', icon: 'alert-circle' },
  won: { label: 'Ganador', color: '#22c55e', icon: 'trophy' },
  lost: { label: 'No Ganó', color: '#64748b', icon: 'close-circle' },
  cancelled: { label: 'Cancelado', color: '#475569', icon: 'ban' },
  paid: { label: 'Pagado', color: '#3b82f6', icon: 'checkmark-circle' },
};

const PAYMENT_STATUS_CONFIG: { [key: string]: { label: string; color: string } } = {
  pending: { label: 'Esperando Confirmación', color: '#f59e0b' },
  confirmed: { label: 'Confirmado', color: '#22c55e' },
  rejected: { label: 'Rechazado', color: '#ef4444' },
};

export default function ClientTicketsScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filter, setFilter] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  
  // Upload modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  
  // Ticket detail modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailTicket, setDetailTicket] = useState<Ticket | null>(null);

  const fetchTickets = useCallback(async (page = 1) => {
    try {
      let url = `${API_URL}/api/clients/tickets?page=${page}&limit=20`;
      if (filter) {
        url += `&status=${filter}`;
      }
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        setTickets(data.tickets || []);
        setPagination({
          page: data.pagination.page,
          total: data.pagination.total,
          totalPages: data.pagination.total_pages,
        });
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  }, [token, filter]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTickets();
    setRefreshing(false);
  };

  const openUploadModal = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setReceiptImage(null);
    setShowUploadModal(true);
  };

  const pickReceiptImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (!permissionResult.granted) {
      Alert.alert('Permiso Requerido', 'Necesitamos acceso a tus fotos para subir el comprobante');
      return;
    }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    
    if (!result.canceled && result.assets[0]) {
      setReceiptImage(result.assets[0].uri);
    }
  };

  const uploadReceipt = async () => {
    if (!receiptImage || !selectedTicket) return;
    
    setUploading(true);
    
    try {
      const formData = new FormData();
      const filename = receiptImage.split('/').pop() || 'receipt.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      
      formData.append('file', {
        uri: receiptImage,
        name: filename,
        type,
      } as any);
      
      const response = await fetch(
        `${API_URL}/api/clients/tickets/${selectedTicket.id}/upload-receipt`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        }
      );
      
      const data = await response.json();
      
      if (response.ok) {
        Alert.alert(
          'Comprobante Subido',
          'Tu comprobante ha sido enviado. Te notificaremos cuando sea confirmado.'
        );
        setShowUploadModal(false);
        fetchTickets();
      } else {
        Alert.alert('Error', data.detail || 'Error al subir el comprobante');
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setUploading(false);
    }
  };

  const openDetailModal = (ticket: Ticket) => {
    setDetailTicket(ticket);
    setShowDetailModal(true);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-DO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatNumbers = (numbers: number[]): string => {
    return numbers.map(n => n.toString().padStart(2, '0')).join('-');
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mis Jugadas</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={[styles.filterChip, !filter && styles.filterChipActive]}
            onPress={() => setFilter(null)}
          >
            <Text style={[styles.filterChipText, !filter && styles.filterChipTextActive]}>
              Todas
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, filter === 'pending_payment' && styles.filterChipActive]}
            onPress={() => setFilter('pending_payment')}
          >
            <Text style={[styles.filterChipText, filter === 'pending_payment' && styles.filterChipTextActive]}>
              Pago Pendiente
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, filter === 'pending' && styles.filterChipActive]}
            onPress={() => setFilter('pending')}
          >
            <Text style={[styles.filterChipText, filter === 'pending' && styles.filterChipTextActive]}>
              En Juego
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, filter === 'won' && styles.filterChipActive]}
            onPress={() => setFilter('won')}
          >
            <Text style={[styles.filterChipText, filter === 'won' && styles.filterChipTextActive]}>
              Ganadores
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Tickets List */}
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />}
        showsVerticalScrollIndicator={false}
      >
        {tickets.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="ticket-outline" size={64} color="#334155" />
            <Text style={styles.emptyStateTitle}>Sin Jugadas</Text>
            <Text style={styles.emptyStateText}>
              {filter ? 'No hay jugadas con este filtro' : 'Aún no has realizado ninguna jugada'}
            </Text>
            {!filter && (
              <TouchableOpacity
                style={styles.emptyStateButton}
                onPress={() => router.push('/client-play')}
              >
                <Text style={styles.emptyStateButtonText}>Hacer mi Primera Jugada</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
            {tickets.map(ticket => {
              const statusConfig = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.pending;
              const needsUpload = ticket.status === 'pending_payment' && !ticket.receipt_url;
              
              return (
                <TouchableOpacity
                  key={ticket.id}
                  style={styles.ticketCard}
                  onPress={() => openDetailModal(ticket)}
                >
                  <View style={styles.ticketHeader}>
                    <View style={styles.ticketNumberContainer}>
                      <Ionicons name="ticket" size={16} color="#22c55e" />
                      <Text style={styles.ticketNumber}>{ticket.ticket_number}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusConfig.color }]}>
                      <Ionicons name={statusConfig.icon as any} size={12} color="#ffffff" />
                      <Text style={styles.statusText}>{statusConfig.label}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.ticketBody}>
                    <View style={styles.ticketInfo}>
                      <Text style={styles.ticketPlays}>
                        {ticket.plays?.length || 0} jugada{(ticket.plays?.length || 0) !== 1 ? 's' : ''}
                      </Text>
                      <Text style={styles.ticketDate}>{formatDate(ticket.created_at)}</Text>
                    </View>
                    <Text style={styles.ticketAmount}>
                      RD$ {(ticket.total_amount || 0).toLocaleString()}
                    </Text>
                  </View>
                  
                  {/* Payment status for pending_payment tickets */}
                  {ticket.status === 'pending_payment' && (
                    <View style={styles.paymentStatusContainer}>
                      {ticket.receipt_url ? (
                        <View style={styles.paymentStatusRow}>
                          <Ionicons name="cloud-done" size={16} color="#f59e0b" />
                          <Text style={styles.paymentStatusText}>
                            Comprobante enviado - Esperando confirmación
                          </Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.uploadReceiptButton}
                          onPress={(e) => {
                            e.stopPropagation();
                            openUploadModal(ticket);
                          }}
                        >
                          <Ionicons name="cloud-upload" size={18} color="#ffffff" />
                          <Text style={styles.uploadReceiptButtonText}>Subir Comprobante</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
            
            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <View style={styles.pagination}>
                <TouchableOpacity
                  style={[styles.paginationButton, pagination.page === 1 && styles.paginationButtonDisabled]}
                  onPress={() => fetchTickets(pagination.page - 1)}
                  disabled={pagination.page === 1}
                >
                  <Ionicons name="chevron-back" size={20} color={pagination.page === 1 ? '#475569' : '#ffffff'} />
                </TouchableOpacity>
                <Text style={styles.paginationText}>
                  Página {pagination.page} de {pagination.totalPages}
                </Text>
                <TouchableOpacity
                  style={[styles.paginationButton, pagination.page === pagination.totalPages && styles.paginationButtonDisabled]}
                  onPress={() => fetchTickets(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                >
                  <Ionicons name="chevron-forward" size={20} color={pagination.page === pagination.totalPages ? '#475569' : '#ffffff'} />
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
        
        <View style={{ height: 30 }} />
      </ScrollView>

      {/* Upload Receipt Modal */}
      <Modal
        visible={showUploadModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowUploadModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Subir Comprobante</Text>
              <TouchableOpacity onPress={() => setShowUploadModal(false)}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              <Text style={styles.uploadTicketNumber}>
                Ticket: {selectedTicket?.ticket_number}
              </Text>
              <Text style={styles.uploadAmount}>
                Monto: RD$ {(selectedTicket?.total_amount || 0).toLocaleString()}
              </Text>
              
              <TouchableOpacity
                style={styles.uploadArea}
                onPress={pickReceiptImage}
              >
                {receiptImage ? (
                  <Image source={{ uri: receiptImage }} style={styles.receiptPreview} />
                ) : (
                  <>
                    <Ionicons name="image" size={48} color="#64748b" />
                    <Text style={styles.uploadAreaText}>Toca para seleccionar imagen</Text>
                  </>
                )}
              </TouchableOpacity>
              
              {receiptImage && (
                <TouchableOpacity
                  style={styles.changeImageLink}
                  onPress={pickReceiptImage}
                >
                  <Ionicons name="refresh" size={16} color="#22c55e" />
                  <Text style={styles.changeImageText}>Cambiar imagen</Text>
                </TouchableOpacity>
              )}
            </View>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowUploadModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, (!receiptImage || uploading) && styles.submitButtonDisabled]}
                onPress={uploadReceipt}
                disabled={!receiptImage || uploading}
              >
                {uploading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.submitButtonText}>Subir</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Ticket Detail Modal */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detalle de Jugada</Text>
              <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              {detailTicket && (
                <>
                  <View style={styles.detailSection}>
                    <Text style={styles.detailTicketNumber}>{detailTicket.ticket_number}</Text>
                    <View style={[
                      styles.detailStatusBadge,
                      { backgroundColor: STATUS_CONFIG[detailTicket.status]?.color || '#64748b' }
                    ]}>
                      <Text style={styles.detailStatusText}>
                        {STATUS_CONFIG[detailTicket.status]?.label || detailTicket.status}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.detailInfoRow}>
                    <Text style={styles.detailLabel}>Fecha:</Text>
                    <Text style={styles.detailValue}>{formatDate(detailTicket.created_at)}</Text>
                  </View>
                  
                  <View style={styles.detailInfoRow}>
                    <Text style={styles.detailLabel}>Total:</Text>
                    <Text style={styles.detailValueHighlight}>
                      RD$ {(detailTicket.total_amount || 0).toLocaleString()}
                    </Text>
                  </View>
                  
                  <View style={styles.detailInfoRow}>
                    <Text style={styles.detailLabel}>Método de Pago:</Text>
                    <Text style={styles.detailValue}>
                      {detailTicket.payment_method === 'zelle' ? 'Zelle' : 'Transferencia'}
                    </Text>
                  </View>
                  
                  {detailTicket.bank_account_name && (
                    <View style={styles.detailInfoRow}>
                      <Text style={styles.detailLabel}>Cuenta:</Text>
                      <Text style={styles.detailValue}>{detailTicket.bank_account_name}</Text>
                    </View>
                  )}
                  
                  <Text style={styles.detailSectionTitle}>Jugadas ({detailTicket.plays?.length || 0})</Text>
                  
                  {detailTicket.plays?.map((play, index) => (
                    <View key={index} style={styles.playItem}>
                      <View style={styles.playInfo}>
                        <Text style={styles.playLottery}>{play.lottery_name || 'Lotería'}</Text>
                        <View style={styles.playNumbersRow}>
                          <Text style={styles.playType}>{play.lottery_type}</Text>
                          <Text style={styles.playNumbers}>
                            {formatNumbers(play.numbers || [])}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.playAmount}>${play.amount}</Text>
                    </View>
                  ))}
                  
                  {/* Receipt preview if uploaded */}
                  {detailTicket.receipt_url && (
                    <View style={styles.receiptSection}>
                      <Text style={styles.detailSectionTitle}>Comprobante</Text>
                      <Image
                        source={{ uri: `${API_URL}${detailTicket.receipt_url}` }}
                        style={styles.receiptImage}
                        resizeMode="contain"
                      />
                    </View>
                  )}
                </>
              )}
            </ScrollView>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.closeDetailButton}
                onPress={() => setShowDetailModal(false)}
              >
                <Text style={styles.closeDetailButtonText}>Cerrar</Text>
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
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backButton: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  filtersContainer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#22c55e',
  },
  filterChipText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyStateButton: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyStateButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  ticketCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ticketNumberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ticketNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22c55e',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
  },
  ticketBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ticketInfo: {},
  ticketPlays: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  ticketDate: {
    fontSize: 12,
    color: '#64748b',
  },
  ticketAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  paymentStatusContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  paymentStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  paymentStatusText: {
    color: '#f59e0b',
    fontSize: 13,
  },
  uploadReceiptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ef4444',
    paddingVertical: 10,
    borderRadius: 10,
  },
  uploadReceiptButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 16,
  },
  paginationButton: {
    padding: 8,
    backgroundColor: '#1e293b',
    borderRadius: 8,
  },
  paginationButtonDisabled: {
    opacity: 0.5,
  },
  paginationText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  modalBody: {
    padding: 20,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  uploadTicketNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#22c55e',
    marginBottom: 4,
  },
  uploadAmount: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 20,
  },
  uploadArea: {
    height: 200,
    backgroundColor: '#0f172a',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#334155',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  uploadAreaText: {
    color: '#64748b',
    marginTop: 12,
  },
  receiptPreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  changeImageLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  changeImageText: {
    color: '#22c55e',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#22c55e',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  // Detail modal
  detailSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  detailTicketNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#22c55e',
    marginBottom: 8,
  },
  detailStatusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  detailStatusText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  detailInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  detailLabel: {
    color: '#94a3b8',
    fontSize: 14,
  },
  detailValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  detailValueHighlight: {
    color: '#22c55e',
    fontSize: 16,
    fontWeight: '700',
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 20,
    marginBottom: 12,
  },
  playItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f172a',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  playInfo: {},
  playLottery: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  playNumbersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playType: {
    fontSize: 11,
    color: '#22c55e',
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    textTransform: 'capitalize',
  },
  playNumbers: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  playAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#22c55e',
  },
  receiptSection: {
    marginTop: 8,
  },
  receiptImage: {
    width: '100%',
    height: 250,
    borderRadius: 12,
    backgroundColor: '#0f172a',
  },
  closeDetailButton: {
    flex: 1,
    backgroundColor: '#22c55e',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeDetailButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});

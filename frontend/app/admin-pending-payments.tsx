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
  TextInput,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Payment {
  id: string;
  ticket_id: string;
  client_id: string;
  client_name: string;
  client_phone: string;
  amount: number;
  payment_method: string;
  bank_account_name: string;
  receipt_url?: string;
  status: string;
  created_at: string;
  ticket?: {
    ticket_number: string;
    plays: any[];
    total_amount: number;
  };
}

export default function AdminPendingPaymentsScreen() {
  const router = useRouter();
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [pendingCount, setPendingCount] = useState(0);
  
  // Action modal
  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);
  
  // Receipt preview
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [previewReceipt, setPreviewReceipt] = useState<string | null>(null);

  const fetchPayments = useCallback(async (page = 1) => {
    try {
      const response = await fetch(`${API_URL}/api/payments/pending?page=${page}&limit=20`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        setPayments(data.payments || []);
        setPagination({
          page: data.pagination.page,
          total: data.pagination.total,
          totalPages: data.pagination.total_pages,
        });
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchPendingCount = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/payments/pending-count`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setPendingCount(data.count);
      }
    } catch (error) {
      console.error('Error fetching count:', error);
    }
  }, [token]);

  useEffect(() => {
    fetchPayments();
    fetchPendingCount();
  }, [fetchPayments, fetchPendingCount]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchPayments(), fetchPendingCount()]);
    setRefreshing(false);
  };

  const openActionModal = (payment: Payment, action: 'approve' | 'reject') => {
    setSelectedPayment(payment);
    setActionType(action);
    setRejectReason('');
    setShowActionModal(true);
  };

  const processPayment = async () => {
    if (!selectedPayment || !actionType) return;
    
    setProcessing(true);
    try {
      const response = await fetch(`${API_URL}/api/payments/${selectedPayment.id}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: actionType,
          notes: actionType === 'reject' ? rejectReason : null,
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        Alert.alert(
          actionType === 'approve' ? 'Pago Aprobado' : 'Pago Rechazado',
          data.message
        );
        setShowActionModal(false);
        fetchPayments();
        fetchPendingCount();
      } else {
        Alert.alert('Error', data.detail || 'Error al procesar el pago');
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setProcessing(false);
    }
  };

  const openReceiptPreview = (receiptUrl: string) => {
    setPreviewReceipt(receiptUrl);
    setShowReceiptModal(true);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-DO', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatNumbers = (numbers: number[]): string => {
    return numbers.map(n => n.toString().padStart(2, '0')).join('-');
  };

  // Check admin role
  useEffect(() => {
    if (user && !['super_admin', 'admin'].includes(user.role)) {
      router.replace('/dashboard');
    }
  }, [user, router]);

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
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Pagos Pendientes</Text>
          {pendingCount > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{pendingCount}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color="#22c55e" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />}
        showsVerticalScrollIndicator={false}
      >
        {payments.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle" size={64} color="#22c55e" />
            <Text style={styles.emptyStateTitle}>Sin Pagos Pendientes</Text>
            <Text style={styles.emptyStateText}>
              No hay pagos de clientes esperando confirmación.
            </Text>
          </View>
        ) : (
          <>
            {payments.map(payment => (
              <View key={payment.id} style={styles.paymentCard}>
                {/* Client Info */}
                <View style={styles.clientInfo}>
                  <View style={styles.clientAvatar}>
                    <Ionicons name="person" size={20} color="#22c55e" />
                  </View>
                  <View style={styles.clientDetails}>
                    <Text style={styles.clientName}>{payment.client_name}</Text>
                    <Text style={styles.clientPhone}>{payment.client_phone}</Text>
                  </View>
                  <Text style={styles.paymentDate}>{formatDate(payment.created_at)}</Text>
                </View>
                
                {/* Ticket Info */}
                <View style={styles.ticketInfo}>
                  <View style={styles.ticketRow}>
                    <Text style={styles.ticketLabel}>Ticket:</Text>
                    <Text style={styles.ticketNumber}>
                      {payment.ticket?.ticket_number || 'N/A'}
                    </Text>
                  </View>
                  <View style={styles.ticketRow}>
                    <Text style={styles.ticketLabel}>Jugadas:</Text>
                    <Text style={styles.ticketValue}>
                      {payment.ticket?.plays?.length || 0}
                    </Text>
                  </View>
                  <View style={styles.ticketRow}>
                    <Text style={styles.ticketLabel}>Método:</Text>
                    <Text style={styles.ticketValue}>
                      {payment.payment_method === 'zelle' ? 'Zelle' : 'Transferencia'}
                    </Text>
                  </View>
                  <View style={styles.ticketRow}>
                    <Text style={styles.ticketLabel}>Cuenta:</Text>
                    <Text style={styles.ticketValue}>{payment.bank_account_name || 'N/A'}</Text>
                  </View>
                </View>
                
                {/* Amount */}
                <View style={styles.amountContainer}>
                  <Text style={styles.amountLabel}>Monto:</Text>
                  <Text style={styles.amountValue}>
                    RD$ {(payment.amount || 0).toLocaleString()}
                  </Text>
                </View>
                
                {/* Plays Preview */}
                {payment.ticket?.plays && payment.ticket.plays.length > 0 && (
                  <View style={styles.playsPreview}>
                    <Text style={styles.playsTitle}>Jugadas:</Text>
                    <View style={styles.playsList}>
                      {payment.ticket.plays.slice(0, 3).map((play, idx) => (
                        <View key={idx} style={styles.playChip}>
                          <Text style={styles.playChipText}>
                            {formatNumbers(play.numbers || [])}
                          </Text>
                        </View>
                      ))}
                      {payment.ticket.plays.length > 3 && (
                        <Text style={styles.morePlays}>
                          +{payment.ticket.plays.length - 3} más
                        </Text>
                      )}
                    </View>
                  </View>
                )}
                
                {/* Receipt */}
                {payment.receipt_url ? (
                  <TouchableOpacity
                    style={styles.receiptButton}
                    onPress={() => openReceiptPreview(payment.receipt_url!)}
                  >
                    <Ionicons name="document" size={18} color="#3b82f6" />
                    <Text style={styles.receiptButtonText}>Ver Comprobante</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.noReceiptWarning}>
                    <Ionicons name="warning" size={16} color="#f59e0b" />
                    <Text style={styles.noReceiptText}>Sin comprobante</Text>
                  </View>
                )}
                
                {/* Actions */}
                <View style={styles.actionsContainer}>
                  <TouchableOpacity
                    style={styles.rejectButton}
                    onPress={() => openActionModal(payment, 'reject')}
                  >
                    <Ionicons name="close" size={18} color="#ef4444" />
                    <Text style={styles.rejectButtonText}>Rechazar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.approveButton}
                    onPress={() => openActionModal(payment, 'approve')}
                  >
                    <Ionicons name="checkmark" size={18} color="#ffffff" />
                    <Text style={styles.approveButtonText}>Aprobar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            
            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <View style={styles.pagination}>
                <TouchableOpacity
                  style={[styles.paginationButton, pagination.page === 1 && styles.paginationButtonDisabled]}
                  onPress={() => fetchPayments(pagination.page - 1)}
                  disabled={pagination.page === 1}
                >
                  <Ionicons name="chevron-back" size={20} color={pagination.page === 1 ? '#475569' : '#ffffff'} />
                </TouchableOpacity>
                <Text style={styles.paginationText}>
                  {pagination.page} / {pagination.totalPages}
                </Text>
                <TouchableOpacity
                  style={[styles.paginationButton, pagination.page === pagination.totalPages && styles.paginationButtonDisabled]}
                  onPress={() => fetchPayments(pagination.page + 1)}
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

      {/* Action Modal */}
      <Modal
        visible={showActionModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowActionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {actionType === 'approve' ? 'Aprobar Pago' : 'Rechazar Pago'}
              </Text>
              <TouchableOpacity onPress={() => setShowActionModal(false)}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              {selectedPayment && (
                <>
                  <View style={styles.confirmInfo}>
                    <Text style={styles.confirmLabel}>Cliente:</Text>
                    <Text style={styles.confirmValue}>{selectedPayment.client_name}</Text>
                  </View>
                  <View style={styles.confirmInfo}>
                    <Text style={styles.confirmLabel}>Ticket:</Text>
                    <Text style={styles.confirmValue}>
                      {selectedPayment.ticket?.ticket_number}
                    </Text>
                  </View>
                  <View style={styles.confirmInfo}>
                    <Text style={styles.confirmLabel}>Monto:</Text>
                    <Text style={[styles.confirmValue, { color: '#22c55e' }]}>
                      RD$ {(selectedPayment.amount || 0).toLocaleString()}
                    </Text>
                  </View>
                </>
              )}
              
              {actionType === 'approve' ? (
                <View style={styles.approveMessage}>
                  <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
                  <Text style={styles.approveMessageText}>
                    Al aprobar, el ticket quedará activo para los sorteos y el cliente recibirá una notificación.
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={styles.rejectReasonLabel}>Razón del rechazo (opcional):</Text>
                  <TextInput
                    style={styles.rejectReasonInput}
                    value={rejectReason}
                    onChangeText={setRejectReason}
                    placeholder="Ej: Comprobante ilegible, monto incorrecto..."
                    placeholderTextColor="#64748b"
                    multiline
                    numberOfLines={3}
                  />
                  <View style={styles.rejectWarning}>
                    <Ionicons name="warning" size={20} color="#ef4444" />
                    <Text style={styles.rejectWarningText}>
                      El ticket será cancelado y el cliente recibirá una notificación.
                    </Text>
                  </View>
                </>
              )}
            </View>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowActionModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  actionType === 'reject' && styles.confirmButtonReject,
                  processing && styles.confirmButtonDisabled
                ]}
                onPress={processPayment}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.confirmButtonText}>
                    {actionType === 'approve' ? 'Confirmar Aprobación' : 'Confirmar Rechazo'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Receipt Preview Modal */}
      <Modal
        visible={showReceiptModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowReceiptModal(false)}
      >
        <View style={styles.receiptModalOverlay}>
          <View style={styles.receiptModalContent}>
            <View style={styles.receiptModalHeader}>
              <Text style={styles.receiptModalTitle}>Comprobante de Pago</Text>
              <TouchableOpacity onPress={() => setShowReceiptModal(false)}>
                <Ionicons name="close" size={28} color="#ffffff" />
              </TouchableOpacity>
            </View>
            {previewReceipt && (
              <Image
                source={{ uri: `${API_URL}${previewReceipt}` }}
                style={styles.receiptImage}
                resizeMode="contain"
              />
            )}
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
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  countBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  refreshButton: {
    padding: 8,
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
  },
  paymentCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  clientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  clientAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clientDetails: {
    flex: 1,
    marginLeft: 12,
  },
  clientName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  clientPhone: {
    fontSize: 13,
    color: '#64748b',
  },
  paymentDate: {
    fontSize: 12,
    color: '#64748b',
  },
  ticketInfo: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  ticketRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  ticketLabel: {
    fontSize: 13,
    color: '#64748b',
  },
  ticketNumber: {
    fontSize: 13,
    fontWeight: '600',
    color: '#22c55e',
  },
  ticketValue: {
    fontSize: 13,
    color: '#ffffff',
  },
  amountContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  amountLabel: {
    fontSize: 14,
    color: '#94a3b8',
  },
  amountValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#22c55e',
  },
  playsPreview: {
    marginBottom: 12,
  },
  playsTitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 8,
  },
  playsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  playChip: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  playChipText: {
    color: '#22c55e',
    fontSize: 13,
    fontWeight: '600',
  },
  morePlays: {
    color: '#64748b',
    fontSize: 12,
    alignSelf: 'center',
  },
  receiptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
    marginBottom: 12,
  },
  receiptButtonText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '600',
  },
  noReceiptWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
    marginBottom: 12,
  },
  noReceiptText: {
    color: '#f59e0b',
    fontSize: 13,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  rejectButtonText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  approveButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
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
  confirmInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  confirmLabel: {
    color: '#64748b',
    fontSize: 14,
  },
  confirmValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  approveMessage: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  approveMessageText: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 20,
  },
  rejectReasonLabel: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 16,
    marginBottom: 8,
  },
  rejectReasonInput: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 14,
    color: '#ffffff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  rejectWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 12,
    borderRadius: 10,
    gap: 10,
    marginTop: 16,
  },
  rejectWarningText: {
    flex: 1,
    color: '#ef4444',
    fontSize: 13,
    lineHeight: 18,
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
  confirmButton: {
    flex: 2,
    backgroundColor: '#22c55e',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonReject: {
    backgroundColor: '#ef4444',
  },
  confirmButtonDisabled: {
    opacity: 0.7,
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  // Receipt modal
  receiptModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptModalContent: {
    width: SCREEN_WIDTH - 40,
    maxHeight: '80%',
  },
  receiptModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
  },
  receiptModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  receiptImage: {
    width: '100%',
    height: 400,
    borderRadius: 12,
    backgroundColor: '#1e293b',
  },
});

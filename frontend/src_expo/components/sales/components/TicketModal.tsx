import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Image,
  Share,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { styles } from '../styles';
import { isDesktop } from '../constants';
import { MultiPlayTicketResponse, CompanyProfile, PLAY_TYPE_ABBREVIATIONS } from '../types';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface TicketModalProps {
  visible: boolean;
  onClose: () => void;
  ticket: MultiPlayTicketResponse | null;
  companyProfile: CompanyProfile | null;
}

export const TicketModal: React.FC<TicketModalProps> = ({
  visible,
  onClose,
  ticket,
  companyProfile,
}) => {
  const [sharingImage, setSharingImage] = useState(false);
  const [receiptImageUrl, setReceiptImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);

  // Fetch receipt image URL from backend (single source of truth)
  useEffect(() => {
    if (ticket && visible) {
      setImageLoading(true);
      const url = `${API_URL}/api/tickets/receipt-image/${encodeURIComponent(ticket.ticket_number)}`;
      setReceiptImageUrl(url);
      setImageLoading(false);
    }
  }, [ticket?.ticket_number, visible]);

  if (!ticket) return null;

  // Print using the backend receipt image
  const handlePrintTicket = async () => {
    if (!receiptImageUrl) return;
    try {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { margin: 0; padding: 20px; display: flex; justify-content: center; }
            img { max-width: 100%; height: auto; }
          </style>
        </head>
        <body>
          <img src="${receiptImageUrl}" />
        </body>
        </html>
      `;
      await Print.printAsync({ html });
    } catch (error) {
      Alert.alert('Error', 'No se pudo imprimir el ticket');
    }
  };

  // Share as text fallback
  const handleShareWhatsApp = async () => {
    const message = generateTicketText(ticket, companyProfile, receiptImageUrl);
    try {
      await Share.share({ message });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  // Share the backend receipt image directly
  const handleShareWhatsAppImage = async () => {
    if (!receiptImageUrl) return;
    setSharingImage(true);
    
    try {
      if (Platform.OS === 'web') {
        // On web, download the image directly from backend
        const link = document.createElement('a');
        link.href = receiptImageUrl;
        link.download = `ticket-${ticket.ticket_number}.png`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        Alert.alert(
          '¡Imagen Descargada!', 
          'El ticket se guardó. Ahora puedes enviarlo por WhatsApp.'
        );
      } else {
        // On mobile: Download image from backend and share via expo-sharing
        const fileUri = `${FileSystem.cacheDirectory}ticket_${ticket.ticket_number}.png`;
        
        const downloadResult = await FileSystem.downloadAsync(receiptImageUrl, fileUri);
        
        if (downloadResult.status === 200) {
          const isAvailable = await Sharing.isAvailableAsync();
          if (isAvailable) {
            await Sharing.shareAsync(fileUri, {
              mimeType: 'image/png',
              dialogTitle: 'Enviar ticket por WhatsApp',
              UTI: 'public.png'
            });
          } else {
            // Fallback to text sharing
            handleShareWhatsApp();
          }
        } else {
          throw new Error('Download failed');
        }
      }
    } catch (error: any) {
      console.error('Error sharing image:', error);
      // Fallback to text sharing
      handleShareWhatsApp();
    }
    setSharingImage(false);
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={[styles.ticketModalContent, isDesktop && styles.modalContentDesktop]}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.ticketHeader}>
              <Text style={styles.ticketSuccess}>✓</Text>
              <Text style={styles.ticketTitle}>¡Venta Exitosa!</Text>
            </View>

            {/* Recibo Unificado - Imagen del Backend (Single Source of Truth) */}
            <View style={unifiedStyles.receiptContainer}>
              {imageLoading ? (
                <View style={unifiedStyles.loadingContainer}>
                  <ActivityIndicator size="large" color="#22c55e" />
                  <Text style={unifiedStyles.loadingText}>Cargando recibo...</Text>
                </View>
              ) : receiptImageUrl ? (
                <Image
                  source={{ uri: receiptImageUrl }}
                  style={unifiedStyles.receiptImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={unifiedStyles.errorContainer}>
                  <Ionicons name="alert-circle" size={40} color="#ef4444" />
                  <Text style={unifiedStyles.errorText}>No se pudo cargar el recibo</Text>
                </View>
              )}
            </View>

            {/* Resumen rápido (sin duplicar el recibo visual) */}
            <View style={unifiedStyles.summaryContainer}>
              <Text style={unifiedStyles.summaryTicketNumber}>{ticket.ticket_number}</Text>
              <Text style={unifiedStyles.summaryTotal}>
                Total: {ticket.currency} {ticket.total_amount.toFixed(2)}
              </Text>
              <Text style={unifiedStyles.summaryPlays}>{ticket.plays.length} jugada(s)</Text>
            </View>

            <View style={styles.ticketActions}>
              <TouchableOpacity style={styles.ticketActionButton} onPress={handlePrintTicket}>
                <Ionicons name="print" size={24} color="#ffffff" />
                <Text style={styles.ticketActionText}>Imprimir</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.ticketActionButton, styles.whatsappButton, sharingImage && styles.buttonDisabled]}
                onPress={handleShareWhatsAppImage}
                disabled={sharingImage}
              >
                {sharingImage ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <>
                    <Ionicons name="logo-whatsapp" size={24} color="#ffffff" />
                    <Text style={styles.ticketActionText}>WhatsApp</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.textShareButton} onPress={handleShareWhatsApp}>
              <Ionicons name="chatbubble-outline" size={18} color="#94a3b8" />
              <Text style={styles.textShareButtonText}>Compartir como texto</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.closeTicketButton} onPress={onClose}>
              <Text style={styles.closeTicketButtonText}>Cerrar y Continuar</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// Unified receipt styles
const unifiedStyles = {
  receiptContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 8,
    marginBottom: 16,
    alignItems: 'center' as const,
    minHeight: 300,
  },
  receiptImage: {
    width: '100%' as any,
    height: 450,
    borderRadius: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    color: '#64748b',
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: 40,
  },
  errorText: {
    marginTop: 12,
    color: '#ef4444',
    fontSize: 14,
  },
  summaryContainer: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    alignItems: 'center' as const,
  },
  summaryTicketNumber: {
    color: '#22c55e',
    fontSize: 14,
    fontWeight: '600' as const,
    marginBottom: 4,
  },
  summaryTotal: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold' as const,
  },
  summaryPlays: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 4,
  },
};

// Helper function for text sharing
const generateTicketText = (
  ticket: MultiPlayTicketResponse, 
  company: CompanyProfile | null,
  receiptUrl: string | null
): string => {
  const playsText = ticket.plays.map((play) =>
    `${PLAY_TYPE_ABBREVIATIONS[play.lottery_type || 'quiniela'] || 'Q'}: ${play.numbers.map(n => n.toString().padStart(2, '0')).join('-')} - ${ticket.currency}${play.amount}`
  ).join('\n');

  return `
🎰 ${company?.company_name || 'LOTERIA MAGICA'}
━━━━━━━━━━━━
📋 Boleto: ${ticket.ticket_number}
📅 ${new Date(ticket.created_at).toLocaleString('es-DO', { timeZone: 'America/Santo_Domingo' })}
${ticket.customer_name ? `👤 ${ticket.customer_name}` : ''}

🎲 JUGADAS:
${playsText}

💵 TOTAL: ${ticket.currency} ${ticket.total_amount.toFixed(2)}
━━━━━━━━━━━━
${receiptUrl ? `📄 Ver recibo: ${receiptUrl}\n` : ''}
¡BUENA SUERTE! 🍀
`.trim();
};

export default TicketModal;

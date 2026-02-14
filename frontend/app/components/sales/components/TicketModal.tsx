import React, { useRef, useState } from 'react';
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

const cacheDirectory = FileSystem.cacheDirectory || '';
import ViewShot from 'react-native-view-shot';
import QRCode from 'react-qr-code';
import { styles } from '../styles';
import { isDesktop } from '../constants';
import { MultiPlayTicketResponse, CompanyProfile, PLAY_TYPE_ABBREVIATIONS } from '../types';

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
  const ticketViewRef = useRef<ViewShot>(null);
  const [sharingImage, setSharingImage] = useState(false);

  if (!ticket) return null;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-DO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handlePrintTicket = async () => {
    const html = generateTicketHTML(ticket, companyProfile);
    try {
      await Print.printAsync({ html });
    } catch (error) {
      Alert.alert('Error', 'No se pudo imprimir el ticket');
    }
  };

  const handleShareWhatsApp = async () => {
    const message = generateTicketText(ticket, companyProfile);
    try {
      await Share.share({ message });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleShareWhatsAppImage = async () => {
    if (!ticketViewRef.current) return;
    
    setSharingImage(true);
    try {
      const uri = await (ticketViewRef.current as any).capture({
        format: 'png',
        quality: 1,
      });
      
      if (Platform.OS === 'web') {
        // Download on web
        const link = document.createElement('a');
        link.href = uri;
        link.download = `ticket-${ticket.ticket_number}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // Share on mobile
        const fileUri = `${cacheDirectory}ticket-${ticket.ticket_number}.png`;
        await FileSystem.copyAsync({ from: uri, to: fileUri });
        await Sharing.shareAsync(fileUri);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo compartir la imagen');
    } finally {
      setSharingImage(false);
    }
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

            {/* Ticket Image for WhatsApp */}
            <ViewShot
              ref={ticketViewRef}
              style={styles.ticketViewShot}
              options={{ format: 'png', quality: 1 }}
            >
              <View style={styles.ticketContainer}>
                {/* Header centrado */}
                <View style={styles.ticketHeaderSection}>
                  {companyProfile?.logo_url && (
                    <Image
                      source={{ uri: companyProfile.logo_url }}
                      style={styles.ticketLogo}
                      resizeMode="contain"
                    />
                  )}
                  <Text style={styles.ticketCompanyName}>
                    {companyProfile?.company_name || 'LOTERIA'}
                  </Text>
                  {companyProfile?.address && (
                    <Text style={styles.ticketCompanyInfo}>{companyProfile.address}</Text>
                  )}
                  {companyProfile?.rnc && (
                    <Text style={styles.ticketCompanyInfo}>RNC: {companyProfile.rnc}</Text>
                  )}
                </View>

                {/* Línea divisoria */}
                <View style={styles.ticketDivider} />

                {/* Número de Ticket */}
                <View style={styles.ticketNumberSection}>
                  <Text style={styles.ticketNumberLabel}>NO. BOLETO</Text>
                  <Text style={styles.ticketNumber}>{ticket.ticket_number}</Text>
                </View>

                {/* Fecha y hora */}
                <View style={styles.ticketDateSection}>
                  <Text style={styles.ticketDate}>{formatDate(ticket.created_at)}</Text>
                  {ticket.customer_name && (
                    <Text style={styles.ticketCustomer}>Cliente: {ticket.customer_name}</Text>
                  )}
                </View>

                {/* Línea divisoria */}
                <View style={styles.ticketDivider} />

                {/* Jugadas */}
                <View style={styles.ticketPlaysSection}>
                  {ticket.plays.map((play, index) => (
                    <View key={index} style={styles.ticketPlay}>
                      <Text style={styles.ticketPlayType}>
                        {PLAY_TYPE_ABBREVIATIONS[play.lottery_type || 'quiniela'] || 'Q'}
                      </Text>
                      <Text style={styles.ticketPlayNumbers}>
                        {play.numbers.map(n => n.toString().padStart(2, '0')).join('-')}
                      </Text>
                      <Text style={styles.ticketPlayAmount}>
                        {ticket.currency} {play.amount.toFixed(0)}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Total */}
                <View style={styles.ticketTotalSection}>
                  <Text style={styles.ticketTotalLabel}>
                    TOTAL ({ticket.plays.length} jugadas)
                  </Text>
                  <Text style={styles.ticketTotalValue}>
                    {ticket.currency} {ticket.total_amount.toFixed(2)}
                  </Text>
                </View>

                {/* Línea divisoria */}
                <View style={styles.ticketDivider} />

                {/* QR Code Centrado */}
                <View style={styles.ticketQRSection}>
                  <QRCode
                    value={ticket.ticket_number}
                    size={80}
                    bgColor="#ffffff"
                    fgColor="#000000"
                  />
                </View>

                {/* Footer */}
                <View style={styles.ticketFooterSection}>
                  <Text style={styles.ticketFooterText}>CONSERVE ESTE BOLETO</Text>
                  <Text style={styles.ticketFooterText}>¡BUENA SUERTE!</Text>
                </View>
              </View>
            </ViewShot>

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
                    <Ionicons name="image" size={24} color="#ffffff" />
                    <Text style={styles.ticketActionText}>Enviar Imagen</Text>
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

// Helper functions
const generateTicketHTML = (ticket: MultiPlayTicketResponse, company: CompanyProfile | null): string => {
  const playsHtml = ticket.plays.map((play, i) => `
    <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed #ccc;">
      <span style="font-weight: bold;">${PLAY_TYPE_ABBREVIATIONS[play.lottery_type || 'quiniela'] || 'Q'}</span>
      <span style="font-weight: bold;">${play.numbers.map(n => n.toString().padStart(2, '0')).join('-')}</span>
      <span>${ticket.currency} ${play.amount}</span>
    </div>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; max-width: 280px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 16px; }
        .company { font-size: 18px; font-weight: 900; }
        .divider { border-top: 1px solid #000; margin: 12px 0; }
        .ticket-number { text-align: center; margin: 12px 0; }
        .ticket-number-label { font-size: 10px; color: #666; }
        .ticket-number-value { font-size: 20px; font-weight: 900; }
        .total { display: flex; justify-content: space-between; font-weight: bold; margin-top: 12px; padding-top: 8px; border-top: 1px solid #ccc; }
        .footer { text-align: center; margin-top: 16px; font-size: 10px; color: #666; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company">${company?.company_name || 'LOTERIA'}</div>
        ${company?.address ? `<div style="font-size: 11px; color: #666;">${company.address}</div>` : ''}
        ${company?.rnc ? `<div style="font-size: 11px; color: #666;">RNC: ${company.rnc}</div>` : ''}
      </div>
      <div class="divider"></div>
      <div class="ticket-number">
        <div class="ticket-number-label">NO. BOLETO</div>
        <div class="ticket-number-value">${ticket.ticket_number}</div>
      </div>
      <div style="text-align: center; font-size: 11px; color: #666;">
        ${new Date(ticket.created_at).toLocaleString('es-DO')}
      </div>
      <div class="divider"></div>
      ${playsHtml}
      <div class="total">
        <span>TOTAL (${ticket.plays.length})</span>
        <span>${ticket.currency} ${ticket.total_amount.toFixed(2)}</span>
      </div>
      <div class="footer">
        <p>CONSERVE ESTE BOLETO</p>
        <p>¡BUENA SUERTE!</p>
      </div>
    </body>
    </html>
  `;
};

const generateTicketText = (ticket: MultiPlayTicketResponse, company: CompanyProfile | null): string => {
  const playsText = ticket.plays.map((play, i) =>
    `${PLAY_TYPE_ABBREVIATIONS[play.lottery_type || 'quiniela'] || 'Q'}: ${play.numbers.join('-')} - ${ticket.currency}${play.amount}`
  ).join('\n');

  return `
🎰 ${company?.company_name || 'LOTERIA'}
━━━━━━━━━━━━
📋 Boleto: ${ticket.ticket_number}
📅 ${new Date(ticket.created_at).toLocaleString('es-DO')}
${ticket.customer_name ? `👤 ${ticket.customer_name}` : ''}

🎲 JUGADAS:
${playsText}

💵 TOTAL: ${ticket.currency} ${ticket.total_amount.toFixed(2)}
━━━━━━━━━━━━
¡BUENA SUERTE! 🍀
`.trim();
};

export default TicketModal;

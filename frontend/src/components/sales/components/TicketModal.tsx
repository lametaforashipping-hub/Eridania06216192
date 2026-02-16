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

// Import local logo as fallback
const localLogo = require('../../../../assets/images/loteria_magica_logo.png');

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
        Alert.alert('Descargado', 'La imagen del ticket se descargó. Ahora puedes enviarla por WhatsApp.');
      } else {
        // Share on mobile - opens share sheet with WhatsApp option
        const fileUri = `${cacheDirectory}ticket-${ticket.ticket_number}.png`;
        await FileSystem.copyAsync({ from: uri, to: fileUri });
        
        // Check if sharing is available
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'image/png',
            dialogTitle: 'Compartir ticket por WhatsApp',
            UTI: 'public.png',
          });
        } else {
          Alert.alert('Error', 'No se puede compartir en este dispositivo');
        }
      }
    } catch (error) {
      console.error('Error sharing image:', error);
      Alert.alert('Error', 'No se pudo compartir la imagen. Intenta de nuevo.');
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

            {/* Ticket Image for WhatsApp - DISEÑO LIMPIO */}
            <ViewShot
              ref={ticketViewRef}
              style={styles.ticketViewShot}
              options={{ format: 'png', quality: 1 }}
            >
              <View style={styles.ticketContainer}>
                {/* Header con Logo y Empresa */}
                <View style={styles.ticketHeaderSection}>
                  <Image
                    source={companyProfile?.logo_url ? { uri: companyProfile.logo_url } : localLogo}
                    style={styles.ticketLogo}
                    resizeMode="contain"
                  />
                  <Text style={styles.ticketCompanyName}>
                    {companyProfile?.company_name || 'LOTERÍA MÁGICA'}
                  </Text>
                  <Text style={styles.ticketSlogan}>
                    {companyProfile?.slogan || 'Tu suerte comienza aquí'}
                  </Text>
                </View>

                {/* Separador simple */}
                <View style={styles.ticketSeparator} />

                {/* Número de Ticket GRANDE */}
                <Text style={styles.ticketNumberBig}>{ticket.ticket_number}</Text>
                
                {/* Fecha */}
                <Text style={styles.ticketDateBold}>{formatDate(ticket.created_at)}</Text>
                {ticket.customer_name && (
                  <Text style={styles.ticketCustomerBold}>Cliente: {ticket.customer_name}</Text>
                )}

                {/* Separador */}
                <View style={styles.ticketSeparator} />

                {/* JUGADAS - Formato limpio por lotería */}
                <View style={styles.ticketPlaysClean}>
                  {(() => {
                    // Group plays by lottery
                    const playsByLottery: { [key: string]: typeof ticket.plays } = {};
                    ticket.plays.forEach(play => {
                      const key = play.lottery_name || 'Lotería';
                      if (!playsByLottery[key]) playsByLottery[key] = [];
                      playsByLottery[key].push(play);
                    });
                    
                    return Object.entries(playsByLottery).map(([lotteryName, plays], lotteryIndex) => (
                      <View key={lotteryIndex} style={styles.ticketLotteryGroup}>
                        <Text style={styles.ticketLotteryName}>{lotteryName.toUpperCase()}</Text>
                        {plays.map((play, playIndex) => (
                          <View key={playIndex} style={styles.ticketPlayRow}>
                            <Text style={styles.ticketPlayTypeBold}>
                              {PLAY_TYPE_ABBREVIATIONS[play.lottery_type || 'quiniela'] || 'Q'}
                            </Text>
                            <Text style={styles.ticketPlayNumbersBold}>
                              {play.numbers.map(n => n.toString().padStart(2, '0')).join('-')}
                            </Text>
                            <Text style={styles.ticketPlayAmountBold}>
                              {ticket.currency}{play.amount.toFixed(0)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ));
                  })()}
                </View>

                {/* Separador */}
                <View style={styles.ticketSeparator} />

                {/* TOTAL GRANDE */}
                <View style={styles.ticketTotalClean}>
                  <Text style={styles.ticketTotalLabelBold}>TOTAL</Text>
                  <Text style={styles.ticketTotalValueBig}>
                    {ticket.currency} {ticket.total_amount.toFixed(2)}
                  </Text>
                </View>

                {/* QR Code */}
                <View style={styles.ticketQRSection}>
                  <QRCode
                    value={ticket.ticket_number}
                    size={70}
                    bgColor="#ffffff"
                    fgColor="#000000"
                  />
                </View>

                {/* Footer simple */}
                <Text style={styles.ticketFooterBold}>CONSERVE ESTE BOLETO</Text>
                {companyProfile?.phone && (
                  <Text style={styles.ticketPhoneBold}>Tel: {companyProfile.phone}</Text>
                )}
                <Text style={styles.ticketGoodLuck}>¡BUENA SUERTE!</Text>
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

import React, { useRef, useState, useEffect } from 'react';
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
import { styles } from '../styles';
import { isDesktop } from '../constants';
import { MultiPlayTicketResponse, CompanyProfile, PLAY_TYPE_ABBREVIATIONS } from '../types';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

// Conditionally import html2canvas for web
let html2canvas: any = null;
if (Platform.OS === 'web') {
  html2canvas = require('html2canvas');
}

// Import local logo as fallback
const localLogo = require('../../../../assets/images/loteria_magica_logo.png');

// Web-compatible logo URL - Using absolute URL for html2canvas compatibility
const getWebLogoUrl = (): string => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/logo.png`;
  }
  return '/logo.png';
};

// Convert relative URL to absolute for web (html2canvas needs absolute URLs)
const getAbsoluteLogoUrl = (logoUrl: string | undefined): string | undefined => {
  if (!logoUrl) return undefined;
  
  // If already absolute URL, return as-is
  if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
    return logoUrl;
  }
  
  // Convert relative URL to absolute for web
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}${logoUrl}`;
  }
  
  return logoUrl;
};

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
  const ticketContainerRef = useRef<any>(null);
  const [sharingImage, setSharingImage] = useState(false);
  const [qrBase64, setQrBase64] = useState<string | null>(null);

  // Fetch QR code as base64 image from backend (works on both web and native)
  useEffect(() => {
    if (ticket && visible) {
      setQrBase64(null);
      fetch(`${API_URL}/api/tickets/qr/${encodeURIComponent(ticket.ticket_number)}`)
        .then(res => res.json())
        .then(data => {
          if (data?.qr) setQrBase64(data.qr);
        })
        .catch(() => setQrBase64(null));
    }
  }, [ticket?.ticket_number, visible]);

  if (!ticket) return null;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-DO', {
      timeZone: 'America/Santo_Domingo',
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
    setSharingImage(true);
    
    try {
      if (Platform.OS === 'web') {
        // On web, use html2canvas with direct ref
        const ticketElement = ticketContainerRef.current;
        if (!ticketElement || !html2canvas) {
          const htmlContent = generateTicketHTML(ticket, companyProfile);
          const blob = new Blob([htmlContent], { type: 'text/html' });
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank');
          Alert.alert('Ticket', 'Se abrió el ticket. Usa Ctrl+P para guardar como imagen/PDF.');
          setSharingImage(false);
          return;
        }
        
        try {
          const canvas = await html2canvas(ticketElement, {
            backgroundColor: '#ffffff',
            scale: 2,
            useCORS: true,
            allowTaint: true,
            logging: false,
          });
          
          canvas.toBlob((blob: Blob | null) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `ticket-${ticket.ticket_number}.png`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
              
              Alert.alert(
                '¡Imagen Descargada!', 
                'El ticket se guardó. Ahora puedes enviarlo por WhatsApp.'
              );
            } else {
              throw new Error('No se pudo crear la imagen');
            }
            setSharingImage(false);
          }, 'image/png', 1.0);
          return;
        } catch (canvasError) {
          console.error('html2canvas error:', canvasError);
          handlePrintTicket();
          Alert.alert('Alternativa', 'Usa la opción de imprimir y selecciona "Guardar como PDF".');
        }
      } else {
        // ON MOBILE: Use expo-print to generate PDF, then share via expo-sharing
        // This approach does NOT depend on FileSystem directories (which can be null in Expo Go)
        const html = generateTicketHTML(ticket, companyProfile);
        const { uri } = await Print.printToFileAsync({ html });
        
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Enviar ticket por WhatsApp',
          });
        } else {
          // Fallback: open print dialog directly
          await Print.printAsync({ html });
        }
      }
    } catch (error: any) {
      console.error('Error sharing image:', error);
      Alert.alert('Error', 'No se pudo compartir la imagen. Intente de nuevo.');
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

            {/* Ticket Image for WhatsApp - DISEÑO ULTRA LIMPIO */}
            <ViewShot
              ref={ticketViewRef}
              style={styles.ticketViewShot}
              options={{ format: 'png', quality: 1 }}
            >
              <View 
                style={styles.ticketContainer} 
                ref={ticketContainerRef as any}
              >
                {/* Header con Logo y Empresa */}
                <View style={styles.ticketHeaderSection}>
                  <Image
                    source={
                      companyProfile?.logo_url 
                        ? { uri: getAbsoluteLogoUrl(companyProfile.logo_url) } 
                        : Platform.OS === 'web' 
                          ? { uri: getWebLogoUrl() }
                          : localLogo
                    }
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

                {/* Info del Ticket */}
                <Text style={styles.ticketNumberBig}>{ticket.ticket_number}</Text>
                <Text style={styles.ticketDateBold}>{formatDate(ticket.created_at)}</Text>
                {ticket.customer_name && (
                  <Text style={styles.ticketCustomerBold}>Cliente: {ticket.customer_name}</Text>
                )}

                {/* Una sola línea separadora */}
                <View style={styles.ticketSingleLine} />

                {/* JUGADAS - Una línea por lotería, formato compacto */}
                <View style={styles.ticketPlaysCompact}>
                  {(() => {
                    // Group plays by lottery
                    const playsByLottery: { [key: string]: typeof ticket.plays } = {};
                    ticket.plays.forEach(play => {
                      const key = play.lottery_name || 'Lotería';
                      if (!playsByLottery[key]) playsByLottery[key] = [];
                      playsByLottery[key].push(play);
                    });
                    
                    return Object.entries(playsByLottery).map(([lotteryName, plays], lotteryIndex) => (
                      <View key={lotteryIndex} style={styles.ticketLotteryLine}>
                        <Text style={styles.ticketLotteryNameCompact}>{lotteryName.toUpperCase()}</Text>
                        {plays.map((play, playIndex) => (
                          <Text key={playIndex} style={styles.ticketPlayLine}>
                            {PLAY_TYPE_ABBREVIATIONS[play.lottery_type || 'quiniela'] || 'Q'} {play.numbers.map(n => n.toString().padStart(2, '0')).join('-')} = {ticket.currency}{play.amount.toFixed(0)}
                          </Text>
                        ))}
                      </View>
                    ));
                  })()}
                </View>

                {/* TOTAL */}
                <View style={styles.ticketTotalLine}>
                  <Text style={styles.ticketTotalText}>TOTAL: {ticket.currency} {ticket.total_amount.toFixed(2)}</Text>
                </View>

                {/* QR Code - usando imagen base64 del backend para compatibilidad nativa */}
                <View style={styles.ticketQRSection}>
                  {qrBase64 ? (
                    <Image
                      source={{ uri: qrBase64 }}
                      style={{ width: 60, height: 60 }}
                    />
                  ) : (
                    <ActivityIndicator size="small" color="#000000" />
                  )}
                </View>

                {/* Footer */}
                <Text style={styles.ticketFooterCompact}>CONSERVE ESTE BOLETO • ¡BUENA SUERTE!</Text>
                {companyProfile?.phone && (
                  <Text style={styles.ticketPhoneBold}>Tel: {companyProfile.phone}</Text>
                )}
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
        body { font-family: Arial, sans-serif; padding: 20px; max-width: 300px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 16px; }
        .logo { font-size: 28px; font-weight: 900; color: #1a1a2e; letter-spacing: 1px; }
        .slogan { font-size: 11px; color: #e63946; font-style: italic; margin-top: 4px; }
        .divider { border-top: 2px dashed #333; margin: 12px 0; }
        .ticket-number { text-align: center; margin: 12px 0; }
        .ticket-number-label { font-size: 10px; color: #666; }
        .ticket-number-value { font-size: 18px; font-weight: 900; letter-spacing: 2px; }
        .play-row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed #ccc; }
        .total { display: flex; justify-content: space-between; font-weight: bold; font-size: 16px; margin-top: 12px; padding-top: 8px; border-top: 2px solid #000; }
        .footer { text-align: center; margin-top: 16px; font-weight: bold; font-size: 11px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">LOTERIA MAGICA</div>
        <div class="slogan">Tu Suerte Comienza Aqui</div>
        ${company?.phone ? `<div style="font-size: 10px; color: #666; margin-top: 4px;">${company.phone}</div>` : ''}
        ${company?.address ? `<div style="font-size: 10px; color: #666;">${company.address}</div>` : ''}
      </div>
      <div class="divider"></div>
      <div class="ticket-number">
        <div class="ticket-number-label">NO. BOLETO</div>
        <div class="ticket-number-value">${ticket.ticket_number}</div>
      </div>
      <div style="text-align: center; font-size: 11px; color: #666;">
        ${new Date(ticket.created_at).toLocaleString('es-DO', {timeZone: 'America/Santo_Domingo'})}
      </div>
      <div class="divider"></div>
      ${playsHtml}
      <div class="total">
        <span>TOTAL (${ticket.plays.length})</span>
        <span>${ticket.currency} ${ticket.total_amount.toFixed(2)}</span>
      </div>
      <div style="text-align: center; margin: 12px 0;">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(ticket.ticket_number)}" width="80" height="80" />
      </div>
      <div class="footer">
        <p>CONSERVE ESTE BOLETO</p>
        <p>BUENA SUERTE!</p>
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

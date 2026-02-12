import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  FlatList,
  Alert,
  Platform,
  Linking,
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart } from 'react-native-gifted-charts';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const { width } = Dimensions.get('window');
const isDesktop = width > 768;
const chartWidth = isDesktop ? 600 : width - 48;

interface TicketDetail {
  id: string;
  ticket_number: string;
  is_multi_play: boolean;
  lottery_name?: string;
  numbers?: number[];
  plays?: any[];
  amount?: number;
  total_amount?: number;
  potential_win?: number;
  total_potential_win?: number;
  status: string;
  created_at: string;
  customer_name?: string;
  currency: string;
}

interface DailyBreakdown {
  date: string;
  label: string;
  day_name: string;
  sales: number;
  wins: number;
  profit: number;
  tickets: number;
}

interface ReportData {
  period: string;
  period_label: string;
  seller?: {
    id: string;
    name: string;
    commission_rate: number;
    currency: string;
    country: string;
  };
  summary: {
    total_sales: number;
    total_wins: number;
    total_paid: number;
    total_pending_wins: number;
    total_commission: number;
    commission_rate: number;
    net_profit: number;
    net_after_commission: number;
    currency: string;
  };
  ticket_counts: {
    total: number;
    pending: number;
    won: number;
    paid: number;
    lost: number;
    cancelled: number;
  };
  daily_breakdown: DailyBreakdown[];
  tickets: TicketDetail[];
}

type PeriodType = 'daily' | 'weekly' | 'biweekly' | 'monthly';

export default function DetailedSellerReport() {
  const { token, user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const sellerId = params.sellerId as string | undefined;
  const sellerName = params.sellerName as string | undefined;

  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<PeriodType>('daily');
  const [showTickets, setShowTickets] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  const periods: { key: PeriodType; label: string; short: string }[] = [
    { key: 'daily', label: 'Diario', short: 'Hoy' },
    { key: 'weekly', label: 'Semanal', short: '7 días' },
    { key: 'biweekly', label: 'Quincenal', short: '15 días' },
    { key: 'monthly', label: 'Mensual', short: '30 días' },
  ];

  const fetchReport = useCallback(async () => {
    if (!token) return;
    try {
      let url = `${API_URL}/api/accounting/detailed-seller-report?period=${period}`;
      if (sellerId) {
        url += `&seller_id=${sellerId}`;
      }
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setReport(data);
      }
    } catch (error) {
      console.error('Error fetching report:', error);
    } finally {
      setLoading(false);
    }
  }, [token, period, sellerId]);

  useEffect(() => {
    setLoading(true);
    fetchReport();
  }, [fetchReport]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchReport();
    setRefreshing(false);
  };

  const generatePDF = async () => {
    if (!report) return;
    
    const getStatusText = (status: string) => {
      switch (status) {
        case 'won': return 'GANADOR';
        case 'paid': return 'PAGADO';
        case 'lost': return 'PERDIDO';
        case 'cancelled': return 'CANCELADO';
        default: return 'PENDIENTE';
      }
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

    const formatAmount = (amount: number) => {
      return amount.toLocaleString('es-DO', { minimumFractionDigits: 2 });
    };

    const currency = report.summary.currency;
    const reportTitle = sellerName || report.seller?.name || 'Reporte General';
    
    // Generate daily breakdown rows
    let dailyRows = '';
    if (report.daily_breakdown && report.daily_breakdown.length > 0) {
      dailyRows = report.daily_breakdown.map(day => `
        <tr>
          <td style="padding: 6px 8px; border-bottom: 1px solid #334155;">${day.day_name} ${day.label}</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #334155; text-align: right;">${currency} ${formatAmount(day.sales)}</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #334155; text-align: right; color: ${day.profit >= 0 ? '#22c55e' : '#ef4444'};">
            ${day.profit >= 0 ? '+' : ''}${currency} ${formatAmount(day.profit)}
          </td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #334155; text-align: center;">${day.tickets}</td>
        </tr>
      `).join('');
    }

    // Generate ticket rows (limit to 50 for PDF size)
    let ticketRows = '';
    if (report.tickets && report.tickets.length > 0) {
      ticketRows = report.tickets.slice(0, 50).map(t => {
        const amount = t.amount || t.total_amount || 0;
        const displayInfo = t.is_multi_play 
          ? `Multi-jugada (${t.plays?.length || 0})` 
          : `${t.lottery_name || ''} - ${(t.numbers || []).map(n => n.toString().padStart(2, '0')).join('-')}`;
        return `
          <tr>
            <td style="padding: 4px 6px; border-bottom: 1px solid #334155; font-size: 10px;">${t.ticket_number}</td>
            <td style="padding: 4px 6px; border-bottom: 1px solid #334155; font-size: 10px;">${displayInfo}</td>
            <td style="padding: 4px 6px; border-bottom: 1px solid #334155; text-align: right; font-size: 10px;">${currency} ${formatAmount(amount)}</td>
            <td style="padding: 4px 6px; border-bottom: 1px solid #334155; text-align: center;">
              <span style="background: ${getStatusColor(t.status)}; color: white; padding: 2px 6px; border-radius: 10px; font-size: 8px; font-weight: bold;">
                ${getStatusText(t.status)}
              </span>
            </td>
          </tr>
        `;
      }).join('');
      
      if (report.tickets.length > 50) {
        ticketRows += `<tr><td colspan="4" style="padding: 8px; text-align: center; color: #94a3b8; font-size: 10px;">... y ${report.tickets.length - 50} boletos más</td></tr>`;
      }
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Helvetica', 'Arial', sans-serif; background: #0f172a; color: #ffffff; padding: 20px; }
          .header { text-align: center; padding-bottom: 15px; border-bottom: 2px solid #22c55e; margin-bottom: 20px; }
          .title { font-size: 20px; font-weight: bold; color: #22c55e; }
          .subtitle { font-size: 12px; color: #94a3b8; margin-top: 5px; }
          .period { font-size: 14px; color: #ffffff; margin-top: 8px; }
          .summary-grid { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; }
          .summary-card { flex: 1; min-width: 120px; background: #1e293b; border-radius: 8px; padding: 12px; text-align: center; }
          .summary-card.profit { border: 1px solid #22c55e; }
          .summary-label { font-size: 10px; color: #94a3b8; }
          .summary-value { font-size: 14px; font-weight: bold; margin-top: 4px; }
          .green { color: #22c55e; }
          .red { color: #ef4444; }
          .yellow { color: #f59e0b; }
          .section { background: #1e293b; border-radius: 8px; padding: 15px; margin-bottom: 15px; }
          .section-title { font-size: 14px; font-weight: bold; margin-bottom: 10px; color: #ffffff; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #334155; padding: 8px; text-align: left; font-size: 11px; color: #94a3b8; }
          .counts-grid { display: flex; flex-wrap: wrap; gap: 15px; }
          .count-item { text-align: center; min-width: 60px; }
          .count-number { font-size: 20px; font-weight: bold; }
          .count-label { font-size: 9px; color: #94a3b8; }
          .footer { text-align: center; margin-top: 20px; padding-top: 15px; border-top: 1px dashed #334155; font-size: 10px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">REPORTE DETALLADO</div>
          <div class="subtitle">${reportTitle}</div>
          <div class="period">${report.period_label}</div>
        </div>

        <div class="summary-grid">
          <div class="summary-card">
            <div class="summary-label">Ventas Totales</div>
            <div class="summary-value">${currency} ${formatAmount(report.summary.total_sales)}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Premios</div>
            <div class="summary-value red">${currency} ${formatAmount(report.summary.total_wins)}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Comisión (${report.summary.commission_rate}%)</div>
            <div class="summary-value yellow">${currency} ${formatAmount(report.summary.total_commission)}</div>
          </div>
          <div class="summary-card profit">
            <div class="summary-label">Ganancia Neta</div>
            <div class="summary-value ${report.summary.net_profit >= 0 ? 'green' : 'red'}">
              ${currency} ${formatAmount(report.summary.net_profit)}
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Resumen de Boletos</div>
          <div class="counts-grid">
            <div class="count-item">
              <div class="count-number">${report.ticket_counts.total}</div>
              <div class="count-label">Total</div>
            </div>
            <div class="count-item">
              <div class="count-number" style="color: #f59e0b;">${report.ticket_counts.pending}</div>
              <div class="count-label">Pendientes</div>
            </div>
            <div class="count-item">
              <div class="count-number" style="color: #22c55e;">${report.ticket_counts.won}</div>
              <div class="count-label">Ganadores</div>
            </div>
            <div class="count-item">
              <div class="count-number" style="color: #3b82f6;">${report.ticket_counts.paid}</div>
              <div class="count-label">Pagados</div>
            </div>
            <div class="count-item">
              <div class="count-number" style="color: #ef4444;">${report.ticket_counts.lost}</div>
              <div class="count-label">Perdidos</div>
            </div>
            <div class="count-item">
              <div class="count-number" style="color: #64748b;">${report.ticket_counts.cancelled}</div>
              <div class="count-label">Cancelados</div>
            </div>
          </div>
        </div>

        ${dailyRows ? `
        <div class="section">
          <div class="section-title">Desglose Diario</div>
          <table>
            <thead>
              <tr>
                <th>Día</th>
                <th style="text-align: right;">Ventas</th>
                <th style="text-align: right;">Ganancia</th>
                <th style="text-align: center;">Boletos</th>
              </tr>
            </thead>
            <tbody>
              ${dailyRows}
            </tbody>
          </table>
        </div>
        ` : ''}

        ${ticketRows ? `
        <div class="section">
          <div class="section-title">Detalle de Boletos (${report.tickets.length})</div>
          <table>
            <thead>
              <tr>
                <th>Número</th>
                <th>Jugada</th>
                <th style="text-align: right;">Monto</th>
                <th style="text-align: center;">Estado</th>
              </tr>
            </thead>
            <tbody>
              ${ticketRows}
            </tbody>
          </table>
        </div>
        ` : ''}

        <div class="footer">
          Generado el ${new Date().toLocaleString('es-DO')} | Sistema de Lotería
        </div>
      </body>
      </html>
    `;

    try {
      if (Platform.OS === 'web') {
        // For web, open print dialog
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.print();
        }
      } else {
        // For mobile, use expo-print
        const { uri } = await Print.printToFileAsync({ html });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri);
        } else {
          await Print.printAsync({ uri });
        }
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      Alert.alert('Error', 'No se pudo generar el PDF');
    }
  };

  const generateReportText = () => {
    if (!report) return '';
    
    const currency = report.summary.currency;
    const reportTitle = sellerName || report.seller?.name || 'Reporte General';
    const formatAmount = (amount: number) => amount.toLocaleString('es-DO', { minimumFractionDigits: 2 });
    
    let text = `📊 *REPORTE DETALLADO*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    text += `👤 *${reportTitle}*\n`;
    text += `📅 ${report.period_label}\n\n`;
    
    text += `💰 *RESUMEN*\n`;
    text += `• Ventas: ${currency} ${formatAmount(report.summary.total_sales)}\n`;
    text += `• Premios: ${currency} ${formatAmount(report.summary.total_wins)}\n`;
    text += `• Comisión (${report.summary.commission_rate}%): ${currency} ${formatAmount(report.summary.total_commission)}\n`;
    text += `• *Ganancia Neta: ${currency} ${formatAmount(report.summary.net_profit)}*\n\n`;
    
    text += `🎫 *BOLETOS*\n`;
    text += `• Total: ${report.ticket_counts.total}\n`;
    text += `• Pendientes: ${report.ticket_counts.pending}\n`;
    text += `• Ganadores: ${report.ticket_counts.won}\n`;
    text += `• Pagados: ${report.ticket_counts.paid}\n`;
    text += `• Perdidos: ${report.ticket_counts.lost}\n`;
    text += `• Cancelados: ${report.ticket_counts.cancelled}\n`;
    
    if (report.daily_breakdown && report.daily_breakdown.length > 0) {
      text += `\n📈 *DESGLOSE DIARIO*\n`;
      report.daily_breakdown.forEach(day => {
        const sign = day.profit >= 0 ? '+' : '';
        text += `• ${day.day_name} ${day.label}: ${currency} ${formatAmount(day.sales)} (${sign}${formatAmount(day.profit)})\n`;
      });
    }
    
    text += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📱 Sistema de Lotería\n`;
    text += `⏰ ${new Date().toLocaleString('es-DO')}`;
    
    return text;
  };

  const shareViaWhatsApp = async () => {
    const text = generateReportText();
    const encodedText = encodeURIComponent(text);
    
    // Try to open WhatsApp with the message
    const whatsappUrl = `whatsapp://send?text=${encodedText}`;
    const webWhatsAppUrl = `https://wa.me/?text=${encodedText}`;
    
    try {
      if (Platform.OS === 'web') {
        window.open(webWhatsAppUrl, '_blank');
      } else {
        const canOpen = await Linking.canOpenURL(whatsappUrl);
        if (canOpen) {
          await Linking.openURL(whatsappUrl);
        } else {
          // Fallback to web version
          await Linking.openURL(webWhatsAppUrl);
        }
      }
      setShowShareModal(false);
    } catch (error) {
      console.error('Error sharing via WhatsApp:', error);
      Alert.alert('Error', 'No se pudo abrir WhatsApp');
    }
  };

  const shareViaEmail = async () => {
    if (!report) return;
    
    const reportTitle = sellerName || report.seller?.name || 'Reporte General';
    const subject = encodeURIComponent(`Reporte Detallado - ${reportTitle} - ${report.period_label}`);
    const body = encodeURIComponent(generateReportText().replace(/\*/g, '')); // Remove markdown asterisks for email
    
    const mailtoUrl = `mailto:?subject=${subject}&body=${body}`;
    
    try {
      if (Platform.OS === 'web') {
        window.open(mailtoUrl, '_blank');
      } else {
        await Linking.openURL(mailtoUrl);
      }
      setShowShareModal(false);
    } catch (error) {
      console.error('Error sharing via email:', error);
      Alert.alert('Error', 'No se pudo abrir el correo');
    }
  };

  const shareGeneric = async () => {
    if (!report) return;
    
    try {
      // Generate PDF and share
      const html = await generatePDFHTML();
      if (Platform.OS === 'web') {
        const text = generateReportText();
        await navigator.clipboard.writeText(text.replace(/\*/g, ''));
        Alert.alert('Copiado', 'El reporte ha sido copiado al portapapeles');
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri);
        }
      }
      setShowShareModal(false);
    } catch (error) {
      console.error('Error sharing:', error);
      Alert.alert('Error', 'No se pudo compartir el reporte');
    }
  };

  const generatePDFHTML = async () => {
    if (!report) return '';
    
    const getStatusTextLocal = (status: string) => {
      switch (status) {
        case 'won': return 'GANADOR';
        case 'paid': return 'PAGADO';
        case 'lost': return 'PERDIDO';
        case 'cancelled': return 'CANCELADO';
        default: return 'PENDIENTE';
      }
    };

    const getStatusColorLocal = (status: string) => {
      switch (status) {
        case 'won': return '#22c55e';
        case 'paid': return '#3b82f6';
        case 'lost': return '#ef4444';
        case 'cancelled': return '#64748b';
        default: return '#f59e0b';
      }
    };

    const formatAmount = (amount: number) => {
      return amount.toLocaleString('es-DO', { minimumFractionDigits: 2 });
    };

    const currency = report.summary.currency;
    const reportTitle = sellerName || report.seller?.name || 'Reporte General';
    
    let dailyRows = '';
    if (report.daily_breakdown && report.daily_breakdown.length > 0) {
      dailyRows = report.daily_breakdown.map(day => `
        <tr>
          <td style="padding: 6px 8px; border-bottom: 1px solid #334155;">${day.day_name} ${day.label}</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #334155; text-align: right;">${currency} ${formatAmount(day.sales)}</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #334155; text-align: right; color: ${day.profit >= 0 ? '#22c55e' : '#ef4444'};">
            ${day.profit >= 0 ? '+' : ''}${currency} ${formatAmount(day.profit)}
          </td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #334155; text-align: center;">${day.tickets}</td>
        </tr>
      `).join('');
    }

    let ticketRows = '';
    if (report.tickets && report.tickets.length > 0) {
      ticketRows = report.tickets.slice(0, 30).map(t => {
        const amount = t.amount || t.total_amount || 0;
        const displayInfo = t.is_multi_play 
          ? `Multi-jugada (${t.plays?.length || 0})` 
          : `${t.lottery_name || ''} - ${(t.numbers || []).map(n => n.toString().padStart(2, '0')).join('-')}`;
        return `
          <tr>
            <td style="padding: 4px 6px; border-bottom: 1px solid #334155; font-size: 10px;">${t.ticket_number}</td>
            <td style="padding: 4px 6px; border-bottom: 1px solid #334155; font-size: 10px;">${displayInfo}</td>
            <td style="padding: 4px 6px; border-bottom: 1px solid #334155; text-align: right; font-size: 10px;">${currency} ${formatAmount(amount)}</td>
            <td style="padding: 4px 6px; border-bottom: 1px solid #334155; text-align: center;">
              <span style="background: ${getStatusColorLocal(t.status)}; color: white; padding: 2px 6px; border-radius: 10px; font-size: 8px; font-weight: bold;">
                ${getStatusTextLocal(t.status)}
              </span>
            </td>
          </tr>
        `;
      }).join('');
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Helvetica', 'Arial', sans-serif; background: #0f172a; color: #ffffff; padding: 20px; }
          .header { text-align: center; padding-bottom: 15px; border-bottom: 2px solid #22c55e; margin-bottom: 20px; }
          .title { font-size: 20px; font-weight: bold; color: #22c55e; }
          .subtitle { font-size: 12px; color: #94a3b8; margin-top: 5px; }
          .period { font-size: 14px; color: #ffffff; margin-top: 8px; }
          .summary-grid { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; }
          .summary-card { flex: 1; min-width: 120px; background: #1e293b; border-radius: 8px; padding: 12px; text-align: center; }
          .summary-card.profit { border: 1px solid #22c55e; }
          .summary-label { font-size: 10px; color: #94a3b8; }
          .summary-value { font-size: 14px; font-weight: bold; margin-top: 4px; }
          .green { color: #22c55e; }
          .red { color: #ef4444; }
          .yellow { color: #f59e0b; }
          .section { background: #1e293b; border-radius: 8px; padding: 15px; margin-bottom: 15px; }
          .section-title { font-size: 14px; font-weight: bold; margin-bottom: 10px; color: #ffffff; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #334155; padding: 8px; text-align: left; font-size: 11px; color: #94a3b8; }
          .counts-grid { display: flex; flex-wrap: wrap; gap: 15px; }
          .count-item { text-align: center; min-width: 60px; }
          .count-number { font-size: 20px; font-weight: bold; }
          .count-label { font-size: 9px; color: #94a3b8; }
          .footer { text-align: center; margin-top: 20px; padding-top: 15px; border-top: 1px dashed #334155; font-size: 10px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">REPORTE DETALLADO</div>
          <div class="subtitle">${reportTitle}</div>
          <div class="period">${report.period_label}</div>
        </div>

        <div class="summary-grid">
          <div class="summary-card">
            <div class="summary-label">Ventas Totales</div>
            <div class="summary-value">${currency} ${formatAmount(report.summary.total_sales)}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Premios</div>
            <div class="summary-value red">${currency} ${formatAmount(report.summary.total_wins)}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Comisión (${report.summary.commission_rate}%)</div>
            <div class="summary-value yellow">${currency} ${formatAmount(report.summary.total_commission)}</div>
          </div>
          <div class="summary-card profit">
            <div class="summary-label">Ganancia Neta</div>
            <div class="summary-value ${report.summary.net_profit >= 0 ? 'green' : 'red'}">
              ${currency} ${formatAmount(report.summary.net_profit)}
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Resumen de Boletos</div>
          <div class="counts-grid">
            <div class="count-item">
              <div class="count-number">${report.ticket_counts.total}</div>
              <div class="count-label">Total</div>
            </div>
            <div class="count-item">
              <div class="count-number" style="color: #f59e0b;">${report.ticket_counts.pending}</div>
              <div class="count-label">Pendientes</div>
            </div>
            <div class="count-item">
              <div class="count-number" style="color: #22c55e;">${report.ticket_counts.won}</div>
              <div class="count-label">Ganadores</div>
            </div>
            <div class="count-item">
              <div class="count-number" style="color: #3b82f6;">${report.ticket_counts.paid}</div>
              <div class="count-label">Pagados</div>
            </div>
            <div class="count-item">
              <div class="count-number" style="color: #ef4444;">${report.ticket_counts.lost}</div>
              <div class="count-label">Perdidos</div>
            </div>
            <div class="count-item">
              <div class="count-number" style="color: #64748b;">${report.ticket_counts.cancelled}</div>
              <div class="count-label">Cancelados</div>
            </div>
          </div>
        </div>

        ${dailyRows ? `
        <div class="section">
          <div class="section-title">Desglose Diario</div>
          <table>
            <thead>
              <tr>
                <th>Día</th>
                <th style="text-align: right;">Ventas</th>
                <th style="text-align: right;">Ganancia</th>
                <th style="text-align: center;">Boletos</th>
              </tr>
            </thead>
            <tbody>
              ${dailyRows}
            </tbody>
          </table>
        </div>
        ` : ''}

        ${ticketRows ? `
        <div class="section">
          <div class="section-title">Detalle de Boletos</div>
          <table>
            <thead>
              <tr>
                <th>Número</th>
                <th>Jugada</th>
                <th style="text-align: right;">Monto</th>
                <th style="text-align: center;">Estado</th>
              </tr>
            </thead>
            <tbody>
              ${ticketRows}
            </tbody>
          </table>
        </div>
        ` : ''}

        <div class="footer">
          Generado el ${new Date().toLocaleString('es-DO')} | Sistema de Lotería
        </div>
      </body>
      </html>
    `;
  };

  const formatCurrency = (amount: number, currency: string = 'RD$') => {
    const flag = currency === 'USD' || currency === '$' ? '🇺🇸' : '🇩🇴';
    const symbol = currency === 'USD' || currency === '$' ? '$' : 'RD$';
    return `${flag} ${symbol} ${amount.toLocaleString('es-DO', { minimumFractionDigits: 0 })}`;
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

  const prepareChartData = () => {
    if (!report?.daily_breakdown || report.daily_breakdown.length === 0) return [];
    return report.daily_breakdown.map((d) => ({
      value: d.sales,
      label: d.label,
      frontColor: d.profit >= 0 ? '#22c55e' : '#ef4444',
    }));
  };

  const renderTicketItem = ({ item }: { item: TicketDetail }) => {
    const amount = item.amount || item.total_amount || 0;
    const win = item.potential_win || item.total_potential_win || 0;
    
    return (
      <View style={styles.ticketItem}>
        <View style={styles.ticketRow}>
          <Text style={styles.ticketNumber}>{item.ticket_number}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusBadgeText}>{getStatusText(item.status)}</Text>
          </View>
        </View>
        <View style={styles.ticketRow}>
          {item.is_multi_play ? (
            <Text style={styles.ticketInfo}>Multi-jugada ({item.plays?.length || 0} jugadas)</Text>
          ) : (
            <Text style={styles.ticketInfo}>
              {item.lottery_name} - {item.numbers?.map(n => n.toString().padStart(2, '0')).join('-')}
            </Text>
          )}
        </View>
        <View style={styles.ticketRow}>
          <Text style={styles.ticketAmount}>{formatCurrency(amount, item.currency)}</Text>
          <Text style={[styles.ticketAmount, styles.greenText]}>
            Premio: {formatCurrency(win, item.currency)}
          </Text>
        </View>
        <Text style={styles.ticketDate}>
          {new Date(item.created_at).toLocaleString('es-DO')}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Reporte Detallado</Text>
          <View style={{ width: 24 }} />
        </View>
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
        <Text style={styles.headerTitle}>
          {sellerName || report?.seller?.name || 'Reporte Detallado'}
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={generatePDF} style={styles.headerButton}>
            <Ionicons name="document-text" size={22} color="#22c55e" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onRefresh} style={styles.headerButton}>
            <Ionicons name="refresh" size={22} color="#22c55e" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Period Selector */}
      <View style={styles.periodSelector}>
        {periods.map((p) => (
          <TouchableOpacity
            key={p.key}
            style={[styles.periodButton, period === p.key && styles.periodButtonActive]}
            onPress={() => setPeriod(p.key)}
          >
            <Text style={[styles.periodButtonText, period === p.key && styles.periodButtonTextActive]}>
              {isDesktop ? p.label : p.short}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={isDesktop && styles.contentDesktop}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />
        }
      >
        {/* Period Label */}
        <Text style={styles.periodLabel}>{report?.period_label}</Text>

        {/* Summary Cards */}
        {report && (
          <View style={[styles.summaryGrid, isDesktop && styles.summaryGridDesktop]}>
            <View style={styles.summaryCard}>
              <Ionicons name="cart" size={20} color="#3b82f6" />
              <Text style={styles.summaryLabel}>Ventas</Text>
              <Text style={styles.summaryValue}>
                {formatCurrency(report.summary.total_sales, report.summary.currency)}
              </Text>
            </View>
            <View style={styles.summaryCard}>
              <Ionicons name="trophy" size={20} color="#ef4444" />
              <Text style={styles.summaryLabel}>Premios</Text>
              <Text style={[styles.summaryValue, styles.redText]}>
                {formatCurrency(report.summary.total_wins, report.summary.currency)}
              </Text>
            </View>
            <View style={styles.summaryCard}>
              <Ionicons name="wallet" size={20} color="#f59e0b" />
              <Text style={styles.summaryLabel}>Comisión ({report.summary.commission_rate}%)</Text>
              <Text style={[styles.summaryValue, styles.yellowText]}>
                {formatCurrency(report.summary.total_commission, report.summary.currency)}
              </Text>
            </View>
            <View style={[styles.summaryCard, styles.profitCard]}>
              <Ionicons name="trending-up" size={20} color="#22c55e" />
              <Text style={styles.summaryLabel}>Ganancia Neta</Text>
              <Text style={[styles.summaryValue, report.summary.net_profit >= 0 ? styles.greenText : styles.redText]}>
                {formatCurrency(report.summary.net_profit, report.summary.currency)}
              </Text>
            </View>
          </View>
        )}

        {/* Ticket Counts */}
        {report && (
          <View style={styles.ticketCountsCard}>
            <Text style={styles.sectionTitle}>Resumen de Boletos</Text>
            <View style={styles.ticketCountsGrid}>
              <View style={styles.countItem}>
                <Text style={styles.countNumber}>{report.ticket_counts.total}</Text>
                <Text style={styles.countLabel}>Total</Text>
              </View>
              <View style={styles.countItem}>
                <Text style={[styles.countNumber, { color: '#f59e0b' }]}>{report.ticket_counts.pending}</Text>
                <Text style={styles.countLabel}>Pendientes</Text>
              </View>
              <View style={styles.countItem}>
                <Text style={[styles.countNumber, { color: '#22c55e' }]}>{report.ticket_counts.won}</Text>
                <Text style={styles.countLabel}>Ganadores</Text>
              </View>
              <View style={styles.countItem}>
                <Text style={[styles.countNumber, { color: '#3b82f6' }]}>{report.ticket_counts.paid}</Text>
                <Text style={styles.countLabel}>Pagados</Text>
              </View>
              <View style={styles.countItem}>
                <Text style={[styles.countNumber, { color: '#ef4444' }]}>{report.ticket_counts.lost}</Text>
                <Text style={styles.countLabel}>Perdidos</Text>
              </View>
              <View style={styles.countItem}>
                <Text style={[styles.countNumber, { color: '#64748b' }]}>{report.ticket_counts.cancelled}</Text>
                <Text style={styles.countLabel}>Cancelados</Text>
              </View>
            </View>
          </View>
        )}

        {/* Daily Chart - Only for non-daily periods */}
        {report && report.daily_breakdown && report.daily_breakdown.length > 0 && (
          <View style={styles.chartCard}>
            <Text style={styles.sectionTitle}>Ventas por Día</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <BarChart
                data={prepareChartData()}
                width={chartWidth}
                height={180}
                barWidth={isDesktop ? 40 : 28}
                spacing={isDesktop ? 16 : 10}
                roundedTop
                xAxisThickness={1}
                yAxisThickness={1}
                xAxisColor="#334155"
                yAxisColor="#334155"
                yAxisTextStyle={{ color: '#94a3b8', fontSize: 9 }}
                xAxisLabelTextStyle={{ color: '#94a3b8', fontSize: 8 }}
                noOfSections={4}
                maxValue={Math.max(...report.daily_breakdown.map(d => d.sales)) * 1.2 || 100}
              />
            </ScrollView>
            
            {/* Daily breakdown list */}
            <View style={styles.dailyList}>
              {report.daily_breakdown.map((day, idx) => (
                <View key={idx} style={styles.dailyItem}>
                  <View style={styles.dailyLeft}>
                    <Text style={styles.dailyDay}>{day.day_name}</Text>
                    <Text style={styles.dailyDate}>{day.label}</Text>
                  </View>
                  <View style={styles.dailyRight}>
                    <Text style={styles.dailySales}>{formatCurrency(day.sales, report.summary.currency)}</Text>
                    <Text style={[styles.dailyProfit, day.profit >= 0 ? styles.greenText : styles.redText]}>
                      {day.profit >= 0 ? '+' : ''}{formatCurrency(day.profit, report.summary.currency)}
                    </Text>
                  </View>
                  <Text style={styles.dailyTickets}>{day.tickets} bol.</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Tickets Toggle */}
        <TouchableOpacity
          style={styles.toggleButton}
          onPress={() => setShowTickets(!showTickets)}
        >
          <Ionicons name={showTickets ? 'chevron-up' : 'chevron-down'} size={20} color="#22c55e" />
          <Text style={styles.toggleButtonText}>
            {showTickets ? 'Ocultar Detalle de Boletos' : `Ver Detalle de Boletos (${report?.tickets?.length || 0})`}
          </Text>
        </TouchableOpacity>

        {/* Tickets List */}
        {showTickets && report && report.tickets && (
          <View style={styles.ticketsList}>
            {report.tickets.map((ticket, idx) => (
              <View key={ticket.id || idx}>
                {renderTicketItem({ item: ticket })}
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
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
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    flex: 1,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerButton: {
    padding: 4,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#334155',
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: '#22c55e',
  },
  periodButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
  },
  periodButtonTextActive: {
    color: '#ffffff',
  },
  content: {
    flex: 1,
    padding: 12,
  },
  contentDesktop: {
    maxWidth: 1000,
    alignSelf: 'center',
    width: '100%',
  },
  periodLabel: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 12,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  summaryGridDesktop: {
    flexWrap: 'nowrap',
  },
  summaryCard: {
    flex: 1,
    minWidth: '48%',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  profitCard: {
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  summaryLabel: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 4,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 2,
  },
  greenText: {
    color: '#22c55e',
  },
  redText: {
    color: '#ef4444',
  },
  yellowText: {
    color: '#f59e0b',
  },
  ticketCountsCard: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 10,
  },
  ticketCountsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  countItem: {
    width: '30%',
    alignItems: 'center',
    marginBottom: 8,
  },
  countNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  countLabel: {
    fontSize: 9,
    color: '#94a3b8',
    marginTop: 2,
  },
  chartCard: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  dailyList: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 8,
  },
  dailyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  dailyLeft: {
    flex: 1,
  },
  dailyDay: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  dailyDate: {
    fontSize: 10,
    color: '#64748b',
  },
  dailyRight: {
    alignItems: 'flex-end',
    marginRight: 12,
  },
  dailySales: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  dailyProfit: {
    fontSize: 10,
  },
  dailyTickets: {
    fontSize: 10,
    color: '#64748b',
    width: 40,
    textAlign: 'right',
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingVertical: 12,
    marginBottom: 12,
  },
  toggleButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#22c55e',
    marginLeft: 8,
  },
  ticketsList: {
    gap: 8,
  },
  ticketItem: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
  },
  ticketRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  ticketNumber: {
    fontSize: 11,
    fontWeight: '700',
    color: '#22c55e',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#ffffff',
  },
  ticketInfo: {
    fontSize: 12,
    color: '#ffffff',
    flex: 1,
  },
  ticketAmount: {
    fontSize: 11,
    color: '#94a3b8',
  },
  ticketDate: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 4,
  },
});

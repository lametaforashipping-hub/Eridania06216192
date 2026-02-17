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
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const { width } = Dimensions.get('window');
const isDesktop = width > 768;

interface ClientProfile {
  id: string;
  name: string;
  phone: string;
  email?: string;
  balance: number;
  total_plays: number;
  total_won: number;
  country: string;
  recent_tickets: any[];
  pending_payments: number;
}

export default function ClientDashboardScreen() {
  const router = useRouter();
  const { token, user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<ClientProfile | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/clients/me`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // Check if user is a client
    if (user?.role !== 'cliente') {
      router.replace('/dashboard');
      return;
    }
    fetchProfile();
  }, [user, fetchProfile, router]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProfile();
    setRefreshing(false);
  };

  const handleLogout = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro que deseas salir?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Salir', 
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/client-login');
          }
        },
      ]
    );
  };

  const formatCurrency = (amount: number) => {
    return `RD$ ${amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      pending: '#f59e0b',
      pending_payment: '#ef4444',
      won: '#22c55e',
      lost: '#64748b',
      cancelled: '#475569',
      paid: '#3b82f6',
    };
    return colors[status] || '#64748b';
  };

  const getStatusLabel = (status: string) => {
    const labels: { [key: string]: string } = {
      pending: 'Pendiente',
      pending_payment: 'Pago Pendiente',
      won: 'Ganador',
      lost: 'Perdido',
      cancelled: 'Cancelado',
      paid: 'Pagado',
    };
    return labels[status] || status;
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
        <View>
          <Text style={styles.greeting}>¡Hola!</Text>
          <Text style={styles.userName}>{profile?.name || 'Cliente'}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={24} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Pending Payment Warning */}
        {profile && profile.pending_payments > 0 && (
          <TouchableOpacity style={styles.warningBanner} onPress={() => router.push('/client-tickets')}>
            <Ionicons name="warning" size={24} color="#f59e0b" />
            <View style={styles.warningContent}>
              <Text style={styles.warningTitle}>Pagos Pendientes</Text>
              <Text style={styles.warningText}>
                Tienes {profile.pending_payments} jugada(s) esperando confirmación de pago
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#f59e0b" />
          </TouchableOpacity>
        )}

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, styles.statCardPrimary]}>
            <Ionicons name="game-controller" size={28} color="#ffffff" />
            <Text style={styles.statValue}>{profile?.total_plays || 0}</Text>
            <Text style={styles.statLabel}>Jugadas</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="trophy" size={28} color="#22c55e" />
            <Text style={[styles.statValue, { color: '#22c55e' }]}>
              {formatCurrency(profile?.total_won || 0)}
            </Text>
            <Text style={styles.statLabel}>Ganado</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Acciones Rápidas</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={[styles.actionCard, styles.actionCardPlay]}
            onPress={() => router.push('/client-play')}
          >
            <View style={styles.actionIconContainer}>
              <Ionicons name="add-circle" size={32} color="#ffffff" />
            </View>
            <Text style={styles.actionTitle}>Jugar</Text>
            <Text style={styles.actionSubtitle}>Nueva jugada</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/client-tickets')}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: 'rgba(59, 130, 246, 0.2)' }]}>
              <Ionicons name="ticket" size={28} color="#3b82f6" />
            </View>
            <Text style={styles.actionTitle}>Mis Jugadas</Text>
            <Text style={styles.actionSubtitle}>Ver historial</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/client-results')}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: 'rgba(249, 115, 22, 0.2)' }]}>
              <Ionicons name="trophy-outline" size={28} color="#f97316" />
            </View>
            <Text style={styles.actionTitle}>Resultados</Text>
            <Text style={styles.actionSubtitle}>Ver ganadores</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/client-profile')}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: 'rgba(139, 92, 246, 0.2)' }]}>
              <Ionicons name="person" size={28} color="#8b5cf6" />
            </View>
            <Text style={styles.actionTitle}>Mi Perfil</Text>
            <Text style={styles.actionSubtitle}>Ver cuenta</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Tickets */}
        {profile?.recent_tickets && profile.recent_tickets.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Jugadas Recientes</Text>
              <TouchableOpacity onPress={() => router.push('/client-tickets')}>
                <Text style={styles.seeAllText}>Ver todas</Text>
              </TouchableOpacity>
            </View>
            
            {profile.recent_tickets.slice(0, 3).map((ticket) => (
              <View key={ticket.id} style={styles.ticketCard}>
                <View style={styles.ticketHeader}>
                  <Text style={styles.ticketNumber}>{ticket.ticket_number}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(ticket.status) }]}>
                    <Text style={styles.statusText}>{getStatusLabel(ticket.status)}</Text>
                  </View>
                </View>
                <View style={styles.ticketInfo}>
                  <Text style={styles.ticketAmount}>{formatCurrency(ticket.total_amount || ticket.amount || 0)}</Text>
                  <Text style={styles.ticketDate}>
                    {new Date(ticket.created_at).toLocaleDateString('es-DO')}
                  </Text>
                </View>
                {ticket.status === 'pending_payment' && (
                  <View style={styles.paymentWarning}>
                    <Ionicons name="alert-circle" size={16} color="#ef4444" />
                    <Text style={styles.paymentWarningText}>
                      Sube tu comprobante de pago para validar
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </>
        )}

        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle" size={24} color="#3b82f6" />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>¿Cómo funciona?</Text>
            <Text style={styles.infoText}>
              1. Selecciona tus números{'\n'}
              2. Paga con Zelle o transferencia{'\n'}
              3. Sube tu comprobante{'\n'}
              4. Espera la confirmación y ¡listo!
            </Text>
          </View>
        </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 10,
  },
  greeting: {
    fontSize: 14,
    color: '#64748b',
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  logoutButton: {
    padding: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    gap: 12,
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f59e0b',
  },
  warningText: {
    fontSize: 12,
    color: '#fbbf24',
    marginTop: 2,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  statCardPrimary: {
    backgroundColor: '#22c55e',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  seeAllText: {
    color: '#22c55e',
    fontSize: 14,
    fontWeight: '600',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  actionCard: {
    width: isDesktop ? 'calc(25% - 9px)' : '48%',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  actionCardPlay: {
    backgroundColor: '#22c55e',
  },
  actionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },
  actionSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
    textAlign: 'center',
  },
  ticketCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ticketNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22c55e',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
  },
  ticketInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ticketAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  ticketDate: {
    fontSize: 12,
    color: '#64748b',
  },
  paymentWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    gap: 8,
  },
  paymentWarningText: {
    fontSize: 12,
    color: '#ef4444',
    flex: 1,
  },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3b82f6',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 20,
  },
});

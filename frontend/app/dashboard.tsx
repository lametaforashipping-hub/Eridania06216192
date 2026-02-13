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
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const { width } = Dimensions.get('window');
const isDesktop = width > 768;

interface AccountingSummary {
  today: { sales: number; wins: number; profit: number; tickets: number };
  week: { sales: number; wins: number; profit: number; tickets: number };
  month: { sales: number; wins: number; profit: number; tickets: number };
  currency: string;
}

export default function Dashboard() {
  const { user, token, logout, refreshUser } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<AccountingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!token) return;
    try {
      let url = `${API_URL}/api/accounting/summary`;
      if (selectedCountry) {
        url += `?country=${selectedCountry}`;
      }
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSummary(data);
      }
    } catch (error) {
      console.error('Error fetching summary:', error);
    } finally {
      setLoading(false);
    }
  }, [token, selectedCountry]);

  const fetchUnreadCount = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/api/notifications/unread-count`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.unread_count || 0);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  }, [token]);

  useEffect(() => {
    fetchSummary();
    fetchUnreadCount();
    refreshUser();
    
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchSummary, fetchUnreadCount]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSummary();
    await fetchUnreadCount();
    await refreshUser();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const formatCurrency = (amount: number, currency: string) => {
    const flag = currency === 'USD' || currency === '$' ? '🇺🇸' : '🇩🇴';
    const symbol = currency === 'USD' || currency === '$' ? '$' : 'RD$';
    return `${flag} ${symbol} ${amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'super_admin': return 'Super Administrador';
      case 'admin': return 'Administrador';
      case 'vendedor': return 'Vendedor';
      default: return role;
    }
  };

  const menuItems = [
    { icon: 'cart-outline', emoji: '🛒', label: 'Vender', route: '/sales', roles: ['super_admin', 'admin', 'vendedor'], color: '#22c55e' },
    { icon: 'layers-outline', emoji: '📚', label: 'Multi-Jugada', route: '/multi-play', roles: ['super_admin', 'admin', 'vendedor'], color: '#8b5cf6' },
    { icon: 'barcode-outline', emoji: '📱', label: 'Verificar', route: '/scanner', roles: ['super_admin', 'admin', 'vendedor'], color: '#06b6d4' },
    { icon: 'list-outline', emoji: '🎫', label: 'Boletos', route: '/tickets', roles: ['super_admin', 'admin', 'vendedor'], color: '#3b82f6' },
    { icon: 'heart-outline', emoji: '⭐', label: 'Favoritos', route: '/favorites', roles: ['super_admin', 'admin', 'vendedor'], color: '#ec4899' },
    { icon: 'notifications-outline', emoji: '🔔', label: 'Resultados', route: '/notifications', roles: ['super_admin', 'admin', 'vendedor'], color: '#f59e0b' },
    { icon: 'trophy-outline', emoji: '🏆', label: 'Sorteos', route: '/draws', roles: ['super_admin', 'admin'], color: '#eab308' },
    { icon: 'pulse-outline', emoji: '📡', label: 'En Vivo', route: '/live-tickets', roles: ['super_admin', 'admin'], color: '#ef4444' },
    { icon: 'eye-outline', emoji: '👁️', label: 'Monitoreo', route: '/monitoring', roles: ['super_admin', 'admin'], color: '#ef4444' },
    { icon: 'speedometer-outline', emoji: '⚡', label: 'Límites', route: '/number-limits', roles: ['super_admin', 'admin'], color: '#dc2626' },
    { icon: 'bar-chart-outline', emoji: '📊', label: 'Mi Reporte', route: '/user-report', roles: ['super_admin', 'admin', 'vendedor'], color: '#8b5cf6' },
    { icon: 'people-outline', emoji: '👥', label: 'Vendedores', route: '/sellers-report', roles: ['super_admin', 'admin'], color: '#06b6d4' },
    { icon: 'hardware-chip-outline', emoji: '💻', label: 'Terminales', route: '/terminals', roles: ['super_admin', 'admin'], color: '#22c55e' },
    { icon: 'stats-chart-outline', emoji: '📈', label: 'Estadísticas', route: '/stats', roles: ['super_admin', 'admin', 'vendedor'], color: '#14b8a6' },
    { icon: 'calculator-outline', emoji: '🧮', label: 'Contabilidad', route: '/accounting', roles: ['super_admin', 'admin', 'vendedor'], color: '#0ea5e9' },
    { icon: 'receipt-outline', emoji: '💰', label: 'Comisiones', route: '/commission-report', roles: ['super_admin', 'admin', 'vendedor'], color: '#f59e0b' },
    { icon: 'cash-outline', emoji: '💵', label: 'Pagar Premios', route: '/pay-prizes', roles: ['super_admin', 'admin'], color: '#10b981' },
    { icon: 'person-add-outline', emoji: '👤', label: 'Usuarios', route: '/users', roles: ['super_admin', 'admin'], color: '#f97316' },
    { icon: 'grid-outline', emoji: '🎰', label: 'Loterías', route: '/lotteries', roles: ['super_admin'], color: '#a855f7' },
    { icon: 'business-outline', emoji: '🏢', label: 'Mi Empresa', route: '/company-profile', roles: ['super_admin'], color: '#6366f1' },
    { icon: 'settings-outline', emoji: '⚙️', label: 'Configuración', route: '/system-settings', roles: ['super_admin'], color: '#64748b' },
  ];

  const visibleMenuItems = menuItems.filter(item => 
    user && item.roles.includes(user.role)
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>¡Hola!</Text>
          <Text style={styles.userName}>{user?.name}</Text>
          <Text style={styles.userRole}>{getRoleLabel(user?.role || '')}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.notificationButton} 
            onPress={() => router.push('/notifications')}
          >
            <Ionicons name="notifications-outline" size={24} color="#f59e0b" />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={isDesktop && styles.contentDesktop}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />
        }
      >
        {/* Country Filter for Super Admin */}
        {user?.role === 'super_admin' && (
          <View style={styles.countryFilter}>
            <Text style={styles.filterLabel}>Filtrar por país:</Text>
            <View style={styles.countryButtons}>
              <TouchableOpacity
                style={[styles.countryButton, !selectedCountry && styles.countryButtonActive]}
                onPress={() => setSelectedCountry(null)}
              >
                <Text style={[styles.countryButtonText, !selectedCountry && styles.countryButtonTextActive]}>
                  Todos
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.countryButton, selectedCountry === 'RD' && styles.countryButtonActive]}
                onPress={() => setSelectedCountry('RD')}
              >
                <Text style={[styles.countryButtonText, selectedCountry === 'RD' && styles.countryButtonTextActive]}>
                  RD
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.countryButton, selectedCountry === 'US' && styles.countryButtonActive]}
                onPress={() => setSelectedCountry('US')}
              >
                <Text style={[styles.countryButtonText, selectedCountry === 'US' && styles.countryButtonTextActive]}>
                  USA
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Stats Cards */}
        {loading ? (
          <ActivityIndicator size="large" color="#22c55e" style={styles.loader} />
        ) : summary && (
          <View style={[styles.statsContainer, isDesktop && styles.statsContainerDesktop]}>
            <View style={styles.statCard}>
              <Ionicons name="cash-outline" size={24} color="#22c55e" />
              <Text style={styles.statLabel}>Ventas Hoy</Text>
              <Text style={styles.statValue}>
                {formatCurrency(summary.today.sales, summary.currency)}
              </Text>
              <Text style={styles.statSubtext}>{summary.today.tickets} boletos</Text>
            </View>

            <View style={[styles.statCard, styles.statCardProfit]}>
              <Ionicons 
                name={summary.today.profit >= 0 ? 'trending-up' : 'trending-down'} 
                size={24} 
                color={summary.today.profit >= 0 ? '#22c55e' : '#ef4444'} 
              />
              <Text style={styles.statLabel}>Ganancia Hoy</Text>
              <Text style={[styles.statValue, summary.today.profit >= 0 ? styles.positive : styles.negative]}>
                {formatCurrency(summary.today.profit, summary.currency)}
              </Text>
              <Text style={styles.statSubtext}>Premios: {formatCurrency(summary.today.wins, summary.currency)}</Text>
            </View>

            <View style={styles.statCard}>
              <Ionicons name="calendar-outline" size={24} color="#3b82f6" />
              <Text style={styles.statLabel}>Esta Semana</Text>
              <Text style={styles.statValue}>
                {formatCurrency(summary.week.sales, summary.currency)}
              </Text>
              <Text style={styles.statSubtext}>{summary.week.tickets} boletos</Text>
            </View>

            <View style={styles.statCard}>
              <Ionicons name="calendar" size={24} color="#8b5cf6" />
              <Text style={styles.statLabel}>Este Mes</Text>
              <Text style={styles.statValue}>
                {formatCurrency(summary.month.sales, summary.currency)}
              </Text>
              <Text style={styles.statSubtext}>{summary.month.tickets} boletos</Text>
            </View>
          </View>
        )}

        {/* Menu Grid */}
        <Text style={styles.sectionTitle}>Menú Principal</Text>
        <View style={[styles.menuGrid, isDesktop && styles.menuGridDesktop]}>
          {visibleMenuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.menuItem, isDesktop && styles.menuItemDesktop]}
              onPress={() => router.push(item.route as any)}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: item.color + '20' }]}>
                {isWeb ? (
                  <Text style={styles.menuEmoji}>{item.emoji}</Text>
                ) : (
                  <Ionicons name={item.icon as any} size={32} color={item.color} />
                )}
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* User Info Card */}
        {user && (
          <View style={styles.userInfoCard}>
            <Text style={styles.userInfoTitle}>Información de Cuenta</Text>
            <View style={styles.userInfoRow}>
              <Text style={styles.userInfoLabel}>Límite de Crédito:</Text>
              <Text style={styles.userInfoValue}>
                {formatCurrency(user.credit_limit, user.currency)}
              </Text>
            </View>
            <View style={styles.userInfoRow}>
              <Text style={styles.userInfoLabel}>Balance:</Text>
              <Text style={[styles.userInfoValue, styles.balanceValue]}>
                {formatCurrency(user.balance, user.currency)}
              </Text>
            </View>
            {user.role === 'vendedor' && (
              <View style={styles.userInfoRow}>
                <Text style={styles.userInfoLabel}>Comisión:</Text>
                <Text style={styles.userInfoValue}>{user.commission_rate || 10}%</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#1e293b',
  },
  greeting: {
    fontSize: 14,
    color: '#94a3b8',
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  userRole: {
    fontSize: 12,
    color: '#22c55e',
    marginTop: 2,
  },
  logoutButton: {
    padding: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  notificationButton: {
    padding: 8,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  contentDesktop: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  loader: {
    marginVertical: 40,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statsContainerDesktop: {
    flexWrap: 'nowrap',
    gap: 16,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  statCardProfit: {
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  statLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 4,
  },
  statSubtext: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
  },
  positive: {
    color: '#22c55e',
  },
  negative: {
    color: '#ef4444',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  menuGridDesktop: {
    justifyContent: 'flex-start',
    gap: 16,
  },
  menuItem: {
    width: '31%',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  menuItemDesktop: {
    width: 140,
  },
  menuIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  menuEmoji: {
    fontSize: 28,
  },
  menuLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#ffffff',
    textAlign: 'center',
  },
  userInfoCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 20,
    marginTop: 16,
    marginBottom: 32,
  },
  userInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
  },
  userInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  userInfoLabel: {
    fontSize: 14,
    color: '#94a3b8',
  },
  userInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  balanceValue: {
    color: '#22c55e',
  },
  countryFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '500',
  },
  countryButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  countryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#334155',
  },
  countryButtonActive: {
    backgroundColor: '#22c55e',
  },
  countryButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
  },
  countryButtonTextActive: {
    color: '#ffffff',
  },
});

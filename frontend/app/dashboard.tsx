import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface AccountingSummary {
  today: { sales: number; wins: number; profit: number; tickets: number };
  week: { sales: number; wins: number; profit: number; tickets: number };
  month: { sales: number; wins: number; profit: number; tickets: number };
  currency: string;
}

export default function Dashboard() {
  const { user, token, logout } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<AccountingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSummary = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/api/accounting/summary`, {
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
  }, [token]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSummary();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const formatCurrency = (amount: number, currency: string) => {
    return `${currency} ${amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;
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
    { icon: 'cart-outline', label: 'Vender Números', route: '/sales', roles: ['super_admin', 'admin', 'vendedor'] },
    { icon: 'list-outline', label: 'Mis Ventas', route: '/tickets', roles: ['super_admin', 'admin', 'vendedor'] },
    { icon: 'trophy-outline', label: 'Sorteos', route: '/draws', roles: ['super_admin', 'admin'] },
    { icon: 'stats-chart-outline', label: 'Estadísticas', route: '/stats', roles: ['super_admin', 'admin', 'vendedor'] },
    { icon: 'calculator-outline', label: 'Contabilidad', route: '/accounting', roles: ['super_admin', 'admin', 'vendedor'] },
    { icon: 'people-outline', label: 'Usuarios', route: '/users', roles: ['super_admin', 'admin'] },
    { icon: 'grid-outline', label: 'Loterías', route: '/lotteries', roles: ['super_admin'] },
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
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />
        }
      >
        {/* Stats Cards */}
        {loading ? (
          <ActivityIndicator size="large" color="#22c55e" style={styles.loader} />
        ) : summary && (
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Ventas Hoy</Text>
              <Text style={styles.statValue}>
                {formatCurrency(summary.today.sales, summary.currency)}
              </Text>
              <Text style={styles.statSubtext}>{summary.today.tickets} boletos</Text>
            </View>

            <View style={[styles.statCard, styles.statCardProfit]}>
              <Text style={styles.statLabel}>Ganancia Hoy</Text>
              <Text style={[styles.statValue, summary.today.profit >= 0 ? styles.positive : styles.negative]}>
                {formatCurrency(summary.today.profit, summary.currency)}
              </Text>
              <Text style={styles.statSubtext}>Premios: {formatCurrency(summary.today.wins, summary.currency)}</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Esta Semana</Text>
              <Text style={styles.statValue}>
                {formatCurrency(summary.week.sales, summary.currency)}
              </Text>
              <Text style={styles.statSubtext}>{summary.week.tickets} boletos</Text>
            </View>

            <View style={styles.statCard}>
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
        <View style={styles.menuGrid}>
          {visibleMenuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={() => router.push(item.route as any)}
            >
              <View style={styles.menuIconContainer}>
                <Ionicons name={item.icon as any} size={28} color="#22c55e" />
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Credit Info for Vendedor */}
        {user?.role === 'vendedor' && (
          <View style={styles.creditCard}>
            <Text style={styles.creditTitle}>Límite de Crédito</Text>
            <Text style={styles.creditValue}>
              {formatCurrency(user.credit_limit, user.currency)}
            </Text>
            <View style={styles.creditBar}>
              <View style={[styles.creditProgress, { width: '30%' }]} />
            </View>
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
  content: {
    flex: 1,
    padding: 16,
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
  statCard: {
    width: '48%',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  statCardProfit: {
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  statLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
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
  menuItem: {
    width: '31%',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  menuIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  menuLabel: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
  },
  creditCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 20,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  creditTitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 8,
  },
  creditValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#22c55e',
    marginBottom: 12,
  },
  creditBar: {
    height: 6,
    backgroundColor: '#334155',
    borderRadius: 3,
  },
  creditProgress: {
    height: '100%',
    backgroundColor: '#22c55e',
    borderRadius: 3,
  },
});

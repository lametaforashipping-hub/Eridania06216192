import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Ticket {
  id: string;
  lottery_name: string;
  numbers: number[];
  amount: number;
  currency: string;
  potential_win: number;
  status: 'pending' | 'won' | 'lost';
  customer_name?: string;
  created_at: string;
  seller_name: string;
}

export default function Tickets() {
  const { token } = useAuth();
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'won' | 'lost'>('all');

  const fetchTickets = useCallback(async () => {
    try {
      let url = `${API_URL}/api/tickets`;
      if (filter !== 'all') {
        url += `?status=${filter}`;
      }
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setTickets(data);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'won': return '#22c55e';
      case 'lost': return '#ef4444';
      default: return '#f59e0b';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'won': return 'GANADOR';
      case 'lost': return 'PERDIDO';
      default: return 'PENDIENTE';
    }
  };

  const renderTicket = ({ item }: { item: Ticket }) => (
    <View style={styles.ticketCard}>
      <View style={styles.ticketHeader}>
        <Text style={styles.lotteryName}>{item.lottery_name}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
        </View>
      </View>

      <View style={styles.numbersContainer}>
        {item.numbers.map((num, index) => (
          <View key={index} style={styles.numberBall}>
            <Text style={styles.numberBallText}>{num.toString().padStart(2, '0')}</Text>
          </View>
        ))}
      </View>

      <View style={styles.ticketDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Monto:</Text>
          <Text style={styles.detailValue}>{item.currency} {item.amount.toLocaleString()}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Premio potencial:</Text>
          <Text style={[styles.detailValue, styles.potentialWin]}>
            {item.currency} {item.potential_win.toLocaleString()}
          </Text>
        </View>
        {item.customer_name && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Cliente:</Text>
            <Text style={styles.detailValue}>{item.customer_name}</Text>
          </View>
        )}
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Vendedor:</Text>
          <Text style={styles.detailValue}>{item.seller_name}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Fecha:</Text>
          <Text style={styles.detailValue}>
            {new Date(item.created_at).toLocaleString('es-DO')}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mis Ventas</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Ionicons name="refresh" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={styles.filters}>
        {(['all', 'pending', 'won', 'lost'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterButton, filter === f && styles.filterButtonActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'Todos' : f === 'pending' ? 'Pendientes' : f === 'won' ? 'Ganados' : 'Perdidos'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#22c55e" style={styles.loader} />
      ) : (
        <FlatList
          data={tickets}
          renderItem={renderTicket}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="ticket-outline" size={64} color="#475569" />
              <Text style={styles.emptyText}>No hay boletos</Text>
            </View>
          }
        />
      )}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#1e293b',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  filters: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: '#334155',
  },
  filterButtonActive: {
    backgroundColor: '#22c55e',
  },
  filterText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  filterTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
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
  lotteryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  numbersContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  numberBall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
    borderWidth: 2,
    borderColor: '#22c55e',
  },
  numberBallText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#22c55e',
  },
  ticketDetails: {
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  detailLabel: {
    fontSize: 13,
    color: '#94a3b8',
  },
  detailValue: {
    fontSize: 13,
    color: '#ffffff',
  },
  potentialWin: {
    color: '#22c55e',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 12,
  },
});

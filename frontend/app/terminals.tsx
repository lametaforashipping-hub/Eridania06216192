import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const { width } = Dimensions.get('window');
const isDesktop = width > 768;

interface Terminal {
  id: string;
  name: string;
  email: string;
  terminal_id: string;
  role: string;
  currency: string;
  country: string;
  balance: number;
  credit_limit: number;
  commission_rate: number;
  active: boolean;
  phone?: string;
}

export default function Terminals() {
  const { token } = useAuth();
  const router = useRouter();
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchTerminals = useCallback(async () => {
    if (!token) return;
    try {
      let url = `${API_URL}/api/terminals`;
      if (searchQuery.trim()) {
        url += `?search=${encodeURIComponent(searchQuery.trim())}`;
      }
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setTerminals(data);
      }
    } catch (error) {
      console.error('Error fetching terminals:', error);
    } finally {
      setLoading(false);
    }
  }, [token, searchQuery]);

  useEffect(() => {
    setLoading(true);
    const timeout = setTimeout(() => {
      fetchTerminals();
    }, 300); // Debounce search
    return () => clearTimeout(timeout);
  }, [fetchTerminals]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTerminals();
    setRefreshing(false);
  };

  const getCountryFlag = (country: string) => {
    return country === 'US' ? '🇺🇸' : '🇩🇴';
  };

  const renderTerminal = ({ item }: { item: Terminal }) => (
    <TouchableOpacity
      style={[styles.terminalCard, !item.active && styles.terminalCardInactive]}
      onPress={() => router.push(`/detailed-seller-report?sellerId=${item.id}&sellerName=${encodeURIComponent(item.name)}`)}
      data-testid={`terminal-card-${item.terminal_id}`}
    >
      <View style={styles.terminalHeader}>
        <View style={styles.terminalIdBadge}>
          <Text style={styles.terminalIdText}>{item.terminal_id}</Text>
        </View>
        <View style={styles.terminalInfo}>
          <Text style={styles.terminalName}>{item.name}</Text>
          <Text style={styles.terminalEmail}>{item.email}</Text>
          {item.phone && <Text style={styles.terminalPhone}>{item.phone}</Text>}
        </View>
        <View style={styles.countryBadge}>
          <Text style={styles.countryFlag}>{getCountryFlag(item.country)}</Text>
        </View>
      </View>

      <View style={styles.terminalStats}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Balance</Text>
          <Text style={[styles.statValue, styles.greenText]}>
            {item.currency} {item.balance.toLocaleString()}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Crédito</Text>
          <Text style={styles.statValue}>
            {item.currency} {item.credit_limit.toLocaleString()}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Comisión</Text>
          <Text style={[styles.statValue, styles.yellowText]}>
            {item.commission_rate}%
          </Text>
        </View>
      </View>

      <View style={styles.terminalFooter}>
        <View style={[styles.statusBadge, item.active ? styles.statusActive : styles.statusInactive]}>
          <Text style={styles.statusText}>{item.active ? 'Activo' : 'Inactivo'}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#64748b" />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} data-testid="back-button">
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terminales</Text>
        <TouchableOpacity onPress={onRefresh} data-testid="refresh-button">
          <Ionicons name="refresh" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search" size={20} color="#64748b" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Buscar por terminal, nombre o email..."
            placeholderTextColor="#64748b"
            autoCapitalize="none"
            data-testid="search-input"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} data-testid="clear-search">
              <Ionicons name="close-circle" size={20} color="#64748b" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Results count */}
      <View style={styles.resultsInfo}>
        <Text style={styles.resultsText}>
          {terminals.length} terminal{terminals.length !== 1 ? 'es' : ''} encontrado{terminals.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#22c55e" style={styles.loader} />
      ) : (
        <FlatList
          data={terminals}
          renderItem={renderTerminal}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, isDesktop && styles.listContentDesktop]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />
          }
          numColumns={isDesktop ? 2 : 1}
          key={isDesktop ? 'desktop' : 'mobile'}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="hardware-chip-outline" size={64} color="#475569" />
              <Text style={styles.emptyText}>
                {searchQuery ? 'No se encontraron terminales' : 'No hay terminales registrados'}
              </Text>
              <Text style={styles.emptySubtext}>
                {searchQuery 
                  ? 'Intenta con otra búsqueda' 
                  : 'Crea usuarios con ID de terminal desde la sección Usuarios'}
              </Text>
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
  searchContainer: {
    padding: 12,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
  },
  resultsInfo: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  resultsText: {
    fontSize: 13,
    color: '#64748b',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
  },
  listContent: {
    padding: 12,
  },
  listContentDesktop: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  terminalCard: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 4,
    borderLeftWidth: 4,
    borderLeftColor: '#22c55e',
  },
  terminalCardInactive: {
    opacity: 0.6,
    borderLeftColor: '#64748b',
  },
  terminalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  terminalIdBadge: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 12,
  },
  terminalIdText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  terminalInfo: {
    flex: 1,
  },
  terminalName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  terminalEmail: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  terminalPhone: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  countryBadge: {
    marginLeft: 8,
  },
  countryFlag: {
    fontSize: 24,
  },
  terminalStats: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 12,
    marginBottom: 12,
  },
  statItem: {
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    color: '#94a3b8',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 2,
  },
  greenText: {
    color: '#22c55e',
  },
  yellowText: {
    color: '#f59e0b',
  },
  terminalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusActive: {
    backgroundColor: '#14532d',
  },
  statusInactive: {
    backgroundColor: '#7f1d1d',
  },
  statusText: {
    fontSize: 11,
    color: '#ffffff',
    fontWeight: '500',
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
  emptySubtext: {
    fontSize: 13,
    color: '#475569',
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});

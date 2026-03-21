import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Switch, Alert, RefreshControl
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface AlertSettings {
  milestone_rd: number;
  milestone_usd: number;
  daily_target_rd: number;
  daily_target_usd: number;
  notify_on_winner: boolean;
  notify_on_milestone: boolean;
  notify_on_daily_target: boolean;
}

interface AlertItem {
  id: string;
  type: string;
  title?: string;
  message?: string;
  created_at?: string;
  is_read?: boolean;
}

export default function AlertSettingsScreen() {
  const { user, token } = useAuth();
  const router = useRouter();
  const [settings, setSettings] = useState<AlertSettings | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const [sRes, aRes] = await Promise.all([
        fetch(`${API_URL}/api/alert-settings`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/api/alert-settings/recent-alerts?limit=20`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      if (sRes.ok) setSettings(await sRes.json());
      if (aRes.ok) setAlerts(await aRes.json());
    } catch (e) {
      console.error('Error fetching alerts:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    if (!token || !settings) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/alert-settings`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        Alert.alert('Guardado', 'Configuración de alertas actualizada');
      }
    } catch (e) {
      Alert.alert('Error', 'No se pudo guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const update = (key: keyof AlertSettings, value: any) => {
    if (settings) setSettings({ ...settings, [key]: value });
  };

  const getTypeConfig = (type: string) => {
    const configs: Record<string, { icon: string; color: string; label: string }> = {
      sales_milestone: { icon: 'trending-up', color: '#22c55e', label: 'Meta Ventas' },
      daily_target: { icon: 'flag', color: '#8b5cf6', label: 'Meta Diaria' },
      winner_alert: { icon: 'trophy', color: '#f59e0b', label: 'Ganador' },
      draw_result: { icon: 'trophy', color: '#3b82f6', label: 'Sorteo' },
      high_risk_alert: { icon: 'warning', color: '#ef4444', label: 'Alto Riesgo' },
    };
    return configs[type] || { icon: 'notifications', color: '#94a3b8', label: type };
  };

  const timeAgo = (dateStr?: string) => {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Ahora';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  const isSuperAdmin = user?.role === 'super_admin';

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Alertas</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8b5cf6" />
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor="#8b5cf6" />}
        >
          {/* Toggle Cards - Super Admin Only */}
          {isSuperAdmin && settings && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Tipos de Alertas</Text>
              
              {[
                { key: 'notify_on_milestone' as const, label: 'Meta de Ventas', desc: 'Cuando vendedor alcanza monto', icon: 'trending-up', color: '#22c55e' },
                { key: 'notify_on_daily_target' as const, label: 'Meta Diaria', desc: 'Cuando vendedor alcanza meta diaria', icon: 'flag', color: '#8b5cf6' },
                { key: 'notify_on_winner' as const, label: 'Ticket Ganador', desc: 'Cuando un ticket resulta ganador', icon: 'trophy', color: '#f59e0b' },
              ].map(({ key, label, desc, icon, color }) => (
                <View key={key} style={styles.toggleRow}>
                  <View style={[styles.toggleIcon, { backgroundColor: color + '20' }]}>
                    <Ionicons name={icon as any} size={20} color={color} />
                  </View>
                  <View style={styles.toggleInfo}>
                    <Text style={styles.toggleLabel}>{label}</Text>
                    <Text style={styles.toggleDesc}>{desc}</Text>
                  </View>
                  <Switch
                    value={settings[key]}
                    onValueChange={(v) => update(key, v)}
                    trackColor={{ false: '#334155', true: '#8b5cf6' }}
                    thumbColor={settings[key] ? '#ffffff' : '#94a3b8'}
                  />
                </View>
              ))}
            </View>
          )}

          {/* Threshold Config - Super Admin Only */}
          {isSuperAdmin && settings && (
            <View style={styles.thresholdContainer}>
              {/* RD */}
              <View style={[styles.card, styles.halfCard]}>
                <Text style={[styles.cardTitle, { color: '#22c55e' }]}>RD$</Text>
                <Text style={styles.inputLabel}>Meta Ventas</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={String(settings.milestone_rd)}
                  onChangeText={(t) => update('milestone_rd', parseFloat(t) || 0)}
                  placeholderTextColor="#64748b"
                />
                <Text style={styles.inputLabel}>Meta Diaria</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={String(settings.daily_target_rd)}
                  onChangeText={(t) => update('daily_target_rd', parseFloat(t) || 0)}
                  placeholderTextColor="#64748b"
                />
              </View>
              {/* US */}
              <View style={[styles.card, styles.halfCard]}>
                <Text style={[styles.cardTitle, { color: '#3b82f6' }]}>US$</Text>
                <Text style={styles.inputLabel}>Meta Ventas</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={String(settings.milestone_usd)}
                  onChangeText={(t) => update('milestone_usd', parseFloat(t) || 0)}
                  placeholderTextColor="#64748b"
                />
                <Text style={styles.inputLabel}>Meta Diaria</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={String(settings.daily_target_usd)}
                  onChangeText={(t) => update('daily_target_usd', parseFloat(t) || 0)}
                  placeholderTextColor="#64748b"
                />
              </View>
            </View>
          )}

          {/* Save Button - Super Admin Only */}
          {isSuperAdmin && (
            <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
              <Ionicons name="save-outline" size={20} color="#ffffff" />
              <Text style={styles.saveButtonText}>{saving ? 'Guardando...' : 'Guardar'}</Text>
            </TouchableOpacity>
          )}

          {/* Recent Alerts */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Alertas Recientes</Text>
            {alerts.length === 0 ? (
              <Text style={styles.emptyText}>Sin alertas recientes</Text>
            ) : (
              alerts.map((alert) => {
                const cfg = getTypeConfig(alert.type);
                return (
                  <View key={alert.id} style={[styles.alertRow, !alert.is_read && styles.alertUnread]}>
                    <View style={[styles.alertIcon, { backgroundColor: cfg.color + '20' }]}>
                      <Ionicons name={cfg.icon as any} size={16} color={cfg.color} />
                    </View>
                    <View style={styles.alertContent}>
                      <View style={styles.alertHeader}>
                        <Text style={[styles.alertType, { color: cfg.color }]}>{cfg.label}</Text>
                        <Text style={styles.alertTime}>{timeAgo(alert.created_at)}</Text>
                      </View>
                      <Text style={[styles.alertMessage, !alert.is_read && styles.alertMessageUnread]}>
                        {alert.message || alert.title}
                      </Text>
                    </View>
                    {!alert.is_read && <View style={styles.unreadDot} />}
                  </View>
                );
              })
            )}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, backgroundColor: '#1e293b',
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#ffffff' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, padding: 16 },
  card: {
    backgroundColor: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: '#334155',
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#ffffff', marginBottom: 16 },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#0f172a', borderRadius: 10, padding: 12, marginBottom: 8,
  },
  toggleIcon: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  toggleInfo: { flex: 1 },
  toggleLabel: { fontSize: 14, fontWeight: '500', color: '#ffffff' },
  toggleDesc: { fontSize: 11, color: '#64748b', marginTop: 2 },
  thresholdContainer: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  halfCard: { flex: 1 },
  inputLabel: { fontSize: 12, color: '#94a3b8', marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: '#0f172a', borderRadius: 8, padding: 12, fontSize: 16,
    color: '#ffffff', borderWidth: 1, borderColor: '#334155',
  },
  saveButton: {
    backgroundColor: '#8b5cf6', borderRadius: 10, padding: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginBottom: 16,
  },
  saveButtonText: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
  emptyText: { textAlign: 'center', color: '#64748b', fontSize: 14, padding: 20 },
  alertRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    padding: 10, borderRadius: 8, marginBottom: 6,
  },
  alertUnread: { backgroundColor: 'rgba(139,92,246,0.05)' },
  alertIcon: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  alertContent: { flex: 1 },
  alertHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  alertType: { fontSize: 11, fontWeight: '600' },
  alertTime: { fontSize: 11, color: '#64748b' },
  alertMessage: { fontSize: 13, color: '#94a3b8', lineHeight: 18 },
  alertMessageUnread: { color: '#e2e8f0' },
  unreadDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#8b5cf6', marginTop: 6,
  },
});

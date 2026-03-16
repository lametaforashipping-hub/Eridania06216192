import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

// Helper to convert relative URLs to absolute for web
const getAbsoluteUrl = (url: string | undefined): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  // On web, use window.location.origin for relative URLs
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}${url}`;
  }
  // On mobile, use the API URL as base
  return `${API_URL}${url}`;
};

interface CompanyProfile {
  id?: string;
  company_name: string;
  logo_url?: string;
  address?: string;
  phone?: string;
  email?: string;
  rnc?: string;
  slogan?: string;
  receipt_footer?: string;
}

export default function CompanyProfileScreen() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState<CompanyProfile>({
    company_name: '',
    logo_url: '',
    address: '',
    phone: '',
    email: '',
    rnc: '',
    slogan: '',
    receipt_footer: '',
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await fetch(`${API_URL}/api/company-profile`, {
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
  };

  const handleSave = async () => {
    if (!profile.company_name.trim()) {
      Alert.alert('Error', 'El nombre de la empresa es requerido');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/company-profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profile),
      });

      if (response.ok) {
        Alert.alert('Éxito', 'Perfil de empresa actualizado correctamente');
      } else {
        const data = await response.json();
        Alert.alert('Error', data.detail || 'No se pudo guardar');
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permisos', 'Se necesitan permisos para acceder a las fotos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      uploadImage(result.assets[0]);
    }
  };

  const uploadImage = async (asset: ImagePicker.ImagePickerAsset) => {
    setUploading(true);
    try {
      const formData = new FormData();
      
      if (Platform.OS === 'web') {
        // For web, convert base64 to blob
        const base64 = asset.base64;
        if (base64) {
          const response = await fetch(`data:image/jpeg;base64,${base64}`);
          const blob = await response.blob();
          formData.append('file', blob, 'logo.jpg');
        }
      } else {
        // For native
        const uri = asset.uri;
        const filename = uri.split('/').pop() || 'logo.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';
        
        formData.append('file', {
          uri,
          name: filename,
          type,
        } as any);
      }

      const response = await fetch(`${API_URL}/api/company-profile/logo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(prev => ({ ...prev, logo_url: data.logo_url }));
        Alert.alert('Éxito', 'Logo actualizado correctamente');
      } else {
        Alert.alert('Error', 'No se pudo subir el logo');
      }
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Error', 'Error al subir el logo');
    } finally {
      setUploading(false);
    }
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Perfil de Empresa</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#22c55e" />
          ) : (
            <Ionicons name="checkmark" size={24} color="#22c55e" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Logo Section */}
        <View style={styles.logoSection}>
          <TouchableOpacity style={styles.logoContainer} onPress={pickImage} disabled={uploading}>
            {uploading ? (
              <ActivityIndicator size="large" color="#22c55e" />
            ) : profile.logo_url ? (
              <Image source={{ uri: getAbsoluteUrl(profile.logo_url) }} style={styles.logoImage} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Ionicons name="business" size={48} color="#64748b" />
                <Text style={styles.logoPlaceholderText}>Toca para agregar logo</Text>
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.logoHint}>El logo aparecerá en los recibos de venta</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Nombre de la Empresa *</Text>
            <TextInput
              style={styles.input}
              value={profile.company_name}
              onChangeText={(text) => setProfile(prev => ({ ...prev, company_name: text }))}
              placeholder="Ej: Lotería Nacional RD"
              placeholderTextColor="#64748b"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>RNC</Text>
            <TextInput
              style={styles.input}
              value={profile.rnc}
              onChangeText={(text) => setProfile(prev => ({ ...prev, rnc: text }))}
              placeholder="Ej: 123-45678-9"
              placeholderTextColor="#64748b"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Dirección</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={profile.address}
              onChangeText={(text) => setProfile(prev => ({ ...prev, address: text }))}
              placeholder="Dirección de la empresa"
              placeholderTextColor="#64748b"
              multiline
              numberOfLines={2}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Teléfono</Text>
            <TextInput
              style={styles.input}
              value={profile.phone}
              onChangeText={(text) => setProfile(prev => ({ ...prev, phone: text }))}
              placeholder="809-000-0000"
              placeholderTextColor="#64748b"
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.input}
              value={profile.email}
              onChangeText={(text) => setProfile(prev => ({ ...prev, email: text }))}
              placeholder="info@empresa.com"
              placeholderTextColor="#64748b"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Slogan</Text>
            <TextInput
              style={styles.input}
              value={profile.slogan}
              onChangeText={(text) => setProfile(prev => ({ ...prev, slogan: text }))}
              placeholder="Tu suerte comienza aquí"
              placeholderTextColor="#64748b"
            />
            <Text style={styles.inputHint}>Aparecerá debajo del nombre en los tickets compartidos</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Pie de Recibo</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={profile.receipt_footer}
              onChangeText={(text) => setProfile(prev => ({ ...prev, receipt_footer: text }))}
              placeholder="Texto que aparecerá al final del recibo"
              placeholderTextColor="#64748b"
              multiline
              numberOfLines={3}
            />
          </View>
        </View>

        {/* Preview Section */}
        <View style={styles.previewSection}>
          <Text style={styles.previewTitle}>Vista Previa del Recibo</Text>
          <View style={styles.receiptPreview}>
            {profile.logo_url && (
              <Image source={{ uri: getAbsoluteUrl(profile.logo_url) }} style={styles.previewLogo} />
            )}
            <Text style={styles.previewCompanyName}>{profile.company_name || 'Nombre de Empresa'}</Text>
            {profile.slogan && <Text style={styles.previewSlogan}>{profile.slogan}</Text>}
            {profile.address && <Text style={styles.previewInfo}>{profile.address}</Text>}
            {profile.phone && <Text style={styles.previewInfo}>Tel: {profile.phone}</Text>}
            {profile.rnc && <Text style={styles.previewInfo}>RNC: {profile.rnc}</Text>}
            <View style={styles.previewDivider} />
            <Text style={styles.previewPlaceholder}>[ Contenido del ticket ]</Text>
            <View style={styles.previewDivider} />
            {profile.receipt_footer && (
              <Text style={styles.previewFooter}>{profile.receipt_footer}</Text>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Ionicons name="save" size={20} color="#ffffff" />
              <Text style={styles.saveButtonText}>Guardar Cambios</Text>
            </>
          )}
        </TouchableOpacity>
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
  loader: {
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoContainer: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#334155',
    borderStyle: 'dashed',
  },
  logoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  logoPlaceholder: {
    alignItems: 'center',
  },
  logoPlaceholderText: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  logoHint: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 8,
  },
  form: {
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 8,
  },
  inputHint: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
    fontStyle: 'italic',
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    color: '#ffffff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  previewSection: {
    marginBottom: 24,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  receiptPreview: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  previewLogo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 8,
  },
  previewCompanyName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
  previewSlogan: {
    fontSize: 11,
    color: '#6366f1',
    fontStyle: 'italic',
    marginTop: 2,
  },
  previewInfo: {
    fontSize: 10,
    color: '#475569',
    marginTop: 2,
  },
  previewDivider: {
    width: '100%',
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 12,
  },
  previewPlaceholder: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  previewFooter: {
    fontSize: 10,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
  },
  saveButton: {
    flexDirection: 'row',
    backgroundColor: '#22c55e',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 32,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

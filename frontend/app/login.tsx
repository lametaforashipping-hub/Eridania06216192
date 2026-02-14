import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const { width, height } = Dimensions.get('window');
const isDesktop = width > 768;

interface CompanyProfile {
  name: string;
  logo_url?: string;
  address?: string;
  rnc?: string;
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const { login } = useAuth();
  const router = useRouter();

  useEffect(() => {
    fetchCompanyProfile();
  }, []);

  const fetchCompanyProfile = async () => {
    try {
      const response = await fetch(`${API_URL}/api/company-profile`);
      if (response.ok) {
        const data = await response.json();
        setCompanyProfile(data);
      }
    } catch (error) {
      console.log('Could not fetch company profile');
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Por favor ingresa email y contraseña');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      router.replace('/dashboard');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const initializeSystem = async () => {
    setInitializing(true);
    try {
      const response = await fetch(`${API_URL}/api/init/super-admin`, {
        method: 'POST',
      });
      const data = await response.json();
      Alert.alert(
        'Sistema Inicializado',
        `Email: ${data.super_admin_email}\nContraseña: ${data.super_admin_password}\n\nLoterías creadas: ${data.lotteries_created || 7}`
      );
    } catch (error) {
      Alert.alert('Error', 'No se pudo inicializar el sistema');
    } finally {
      setInitializing(false);
    }
  };

  const companyName = companyProfile?.name || 'Lotería Mágica';

  return (
    <View style={styles.container}>
      {/* Background gradient */}
      <LinearGradient
        colors={['#0f172a', '#1e1b4b', '#0f172a']}
        style={styles.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      {/* Decorative elements */}
      <View style={styles.decorativeCircle1} />
      <View style={styles.decorativeCircle2} />
      <View style={styles.decorativeCircle3} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Login Card */}
          <View style={styles.card}>
            {/* Logo Section */}
            <View style={styles.logoSection}>
              <View style={styles.logoOuterRing}>
                <View style={styles.logoInnerRing}>
                  <View style={styles.logoContainer}>
                    {companyProfile?.logo_url ? (
                      <Image
                        source={{ uri: companyProfile.logo_url }}
                        style={styles.logoImage}
                        resizeMode="contain"
                      />
                    ) : (
                      <Image
                        source={require('../assets/images/loteria_magica_logo.png')}
                        style={styles.logoImageLocal}
                        resizeMode="contain"
                      />
                    )}
                  </View>
                </View>
              </View>
              
              <Text style={styles.companyName}>{companyName}</Text>
              <View style={styles.taglineContainer}>
                <View style={styles.taglineLine} />
                <Text style={styles.tagline}>Tu suerte comienza aquí</Text>
                <View style={styles.taglineLine} />
              </View>
            </View>

            {/* Form Section */}
            <View style={styles.formSection}>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Correo Electrónico</Text>
                <View style={styles.inputContainer}>
                  <View style={styles.inputIconContainer}>
                    <Ionicons name="mail" size={18} color="#a78bfa" />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="correo@ejemplo.com"
                    placeholderTextColor="#6b7280"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                  />
                </View>
              </View>

              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Contraseña</Text>
                <View style={styles.inputContainer}>
                  <View style={styles.inputIconContainer}>
                    <Ionicons name="lock-closed" size={18} color="#a78bfa" />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor="#6b7280"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoComplete="password"
                  />
                  <TouchableOpacity 
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeButton}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off' : 'eye'}
                      size={20}
                      color="#6b7280"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Login Button */}
              <TouchableOpacity
                style={[styles.loginButton, loading && styles.buttonDisabled]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#8b5cf6', '#6366f1']}
                  style={styles.loginButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="log-in" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                      <Text style={styles.loginButtonText}>Iniciar Sesión</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>o</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Initialize System Button */}
              <TouchableOpacity
                style={[styles.initButton, initializing && styles.buttonDisabled]}
                onPress={initializeSystem}
                disabled={initializing}
                activeOpacity={0.7}
              >
                {initializing ? (
                  <ActivityIndicator color="#a78bfa" size="small" />
                ) : (
                  <>
                    <Ionicons name="cog" size={18} color="#a78bfa" />
                    <Text style={styles.initButtonText}>Inicializar Sistema</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <View style={styles.footerBadge}>
              <Ionicons name="shield-checkmark" size={14} color="#22c55e" />
              <Text style={styles.footerBadgeText}>Conexión Segura</Text>
            </View>
            <Text style={styles.footerVersion}>v3.0.0</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  backgroundGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  decorativeCircle1: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    top: -100,
    right: -100,
  },
  decorativeCircle2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
    bottom: 100,
    left: -80,
  },
  decorativeCircle3: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    bottom: -50,
    right: 50,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: height,
  },
  card: {
    width: '100%',
    maxWidth: isDesktop ? 400 : 360,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: 24,
    padding: isDesktop ? 40 : 28,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 20,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoOuterRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoInnerRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#8b5cf6',
  },
  logoImage: {
    width: 50,
    height: 50,
  },
  logoImageLocal: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  logoIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  companyName: {
    fontSize: isDesktop ? 26 : 22,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  taglineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  taglineLine: {
    width: 30,
    height: 1,
    backgroundColor: '#4b5563',
  },
  tagline: {
    fontSize: 13,
    color: '#9ca3af',
    marginHorizontal: 12,
    fontStyle: 'italic',
  },
  formSection: {
    width: '100%',
  },
  inputWrapper: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: 8,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    overflow: 'hidden',
  },
  inputIconContainer: {
    width: 44,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRightWidth: 1,
    borderRightColor: 'rgba(139, 92, 246, 0.2)',
  },
  input: {
    flex: 1,
    height: 48,
    color: '#ffffff',
    fontSize: 15,
    paddingHorizontal: 14,
  },
  eyeButton: {
    padding: 12,
  },
  loginButton: {
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  loginButtonGradient: {
    flexDirection: 'row',
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(75, 85, 99, 0.5)',
  },
  dividerText: {
    color: '#6b7280',
    fontSize: 13,
    marginHorizontal: 16,
  },
  initButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(167, 139, 250, 0.4)',
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
  },
  initButtonText: {
    color: '#a78bfa',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  footer: {
    alignItems: 'center',
    marginTop: 28,
  },
  footerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.2)',
  },
  footerBadgeText: {
    color: '#22c55e',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 6,
  },
  footerVersion: {
    color: '#4b5563',
    fontSize: 11,
    marginTop: 8,
  },
});

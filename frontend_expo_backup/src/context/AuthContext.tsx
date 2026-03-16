import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert } from 'react-native';
import { registerForPushNotificationsAsync, saveTokenToServer } from '../services/pushNotifications';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'admin' | 'vendedor';
  credit_limit: number;
  balance: number;
  commission_rate: number;
  currency: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (tokenOrEmail: string, userOrPassword: any) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  handleAuthError: (error: any) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  // Auto-refresh token every 20 hours (token expires in 24 hours)
  useEffect(() => {
    if (!token) return;
    
    const refreshInterval = setInterval(() => {
      refreshToken();
    }, 20 * 60 * 60 * 1000); // 20 hours
    
    return () => clearInterval(refreshInterval);
  }, [token]);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('token');
      const storedUser = await AsyncStorage.getItem('user');
      
      if (storedToken && storedUser) {
        // Verify token is still valid by attempting to refresh
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        
        // Try to refresh token silently on app load
        setTimeout(async () => {
          try {
            const response = await fetch(`${API_URL}/api/auth/refresh`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${storedToken}` },
            });
            
            if (response.ok) {
              const data = await response.json();
              await AsyncStorage.setItem('token', data.token);
              await AsyncStorage.setItem('user', JSON.stringify(data.user));
              setToken(data.token);
              setUser(data.user);
              console.log('Token refreshed successfully on app load');
            } else if (response.status === 401) {
              // Token is expired, force logout
              console.log('Token expired on app load, logging out');
              await performLogout();
              showSessionExpiredAlert();
            }
          } catch (error) {
            console.log('Token refresh on load failed:', error);
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Error loading auth:', error);
    } finally {
      setLoading(false);
    }
  };

  const showSessionExpiredAlert = () => {
    if (Platform.OS === 'web') {
      window.alert('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
    } else {
      Alert.alert(
        'Sesión Expirada',
        'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.',
        [{ text: 'OK', style: 'default' }]
      );
    }
  };

  const performLogout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const login = async (tokenOrEmail: string, userOrPassword: any) => {
    try {
      // Check if this is a direct token login (from client portal)
      // If second param is an object with 'id' and 'role', it's a direct login with token and user
      if (userOrPassword && typeof userOrPassword === 'object' && userOrPassword.id && userOrPassword.role) {
        // Direct login with token and user object (for client portal)
        await AsyncStorage.setItem('token', tokenOrEmail);
        await AsyncStorage.setItem('user', JSON.stringify(userOrPassword));
        
        setToken(tokenOrEmail);
        setUser(userOrPassword);
        
        console.log('Logged in with token directly');
        return;
      }
      
      // Traditional email/password login
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: tokenOrEmail, password: userOrPassword }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Error al iniciar sesión');
      }

      const data = await response.json();
      
      await AsyncStorage.setItem('token', data.token);
      await AsyncStorage.setItem('user', JSON.stringify(data.user));
      
      setToken(data.token);
      setUser(data.user);
      
      // Register for push notifications (only on native platforms)
      if (Platform.OS !== 'web') {
        try {
          const pushToken = await registerForPushNotificationsAsync();
          if (pushToken && data.user?.id) {
            await saveTokenToServer(pushToken, data.user.id, data.token);
            console.log('Push notification token registered');
          }
        } catch (pushError) {
          console.log('Push notification registration skipped:', pushError);
        }
      }
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    await performLogout();
  };

  const refreshToken = useCallback(async (): Promise<boolean> => {
    if (!token) return false;
    
    try {
      const response = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        await AsyncStorage.setItem('token', data.token);
        await AsyncStorage.setItem('user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        console.log('Token refreshed successfully');
        return true;
      } else if (response.status === 401) {
        // Token is expired
        await performLogout();
        showSessionExpiredAlert();
        return false;
      }
      return false;
    } catch (error) {
      console.error('Error refreshing token:', error);
      return false;
    }
  }, [token]);

  const handleAuthError = useCallback(async (error: any): Promise<boolean> => {
    // Check if error is a 401 (token expired)
    const isAuthError = 
      error?.status === 401 || 
      error?.message?.includes('Token expirado') ||
      error?.message?.includes('token expirado') ||
      error?.detail?.includes('Token expirado') ||
      error?.detail?.includes('token expirado');
    
    if (isAuthError) {
      // Try to refresh the token first
      const refreshed = await refreshToken();
      if (!refreshed) {
        // If refresh failed, logout and show alert
        await performLogout();
        showSessionExpiredAlert();
      }
      return refreshed;
    }
    return true; // Not an auth error
  }, [refreshToken]);

  const refreshUser = async () => {
    if (!token) return;
    
    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        await AsyncStorage.setItem('user', JSON.stringify(userData));
      } else if (response.status === 401) {
        // Token expired during refresh
        const refreshed = await refreshToken();
        if (refreshed) {
          // Retry the request with new token
          const newToken = await AsyncStorage.getItem('token');
          if (newToken) {
            const retryResponse = await fetch(`${API_URL}/api/auth/me`, {
              headers: { 'Authorization': `Bearer ${newToken}` },
            });
            if (retryResponse.ok) {
              const userData = await retryResponse.json();
              setUser(userData);
              await AsyncStorage.setItem('user', JSON.stringify(userData));
            }
          }
        }
      }
    } catch (error) {
      console.error('Error refreshing user:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      loading, 
      login, 
      logout, 
      refreshUser,
      refreshToken,
      handleAuthError
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

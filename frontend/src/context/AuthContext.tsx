import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, BACKEND_URL } from '../utils/api';

type User = {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
  currency?: string;
  theme?: string;
  auth_provider?: string;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  loginWithGoogle: () => void;
  handleGoogleCallback: (sessionId: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const storeToken = async (t: string) => {
    await AsyncStorage.setItem('auth_token', t);
    setToken(t);
    api.setToken(t);
  };

  const clearToken = async () => {
    await AsyncStorage.removeItem('auth_token');
    setToken(null);
    api.setToken(null);
  };

  const checkAuth = useCallback(async () => {
    try {
      // CRITICAL: If returning from OAuth callback, skip check
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        if (window.location.hash?.includes('session_id=')) {
          setIsLoading(false);
          return;
        }
      }

      const storedToken = await AsyncStorage.getItem('auth_token');
      if (storedToken) {
        api.setToken(storedToken);
        const userData = await api.get('/auth/me');
        setUser(userData);
        setToken(storedToken);
      }
    } catch {
      await clearToken();
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email: string, password: string) => {
    const data = await api.post('/auth/login', { email, password });
    await storeToken(data.token);
    setUser(data.user);
  };

  const register = async (name: string, email: string, password: string) => {
    const data = await api.post('/auth/register', { email, password, name });
    await storeToken(data.token);
    setUser(data.user);
  };

  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  const loginWithGoogle = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const redirectUrl = window.location.origin + '/(tabs)/dashboard';
      window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    }
  };

  const handleGoogleCallback = async (sessionId: string) => {
    const data = await api.post('/auth/google-session', { session_id: sessionId });
    await storeToken(data.token);
    setUser(data.user);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch { /* ignore */ }
    await clearToken();
    setUser(null);
  };

  const updateUser = (u: User) => setUser(u);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, loginWithGoogle, handleGoogleCallback, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

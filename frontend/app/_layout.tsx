import React, { useEffect } from 'react';
import { Stack, useRouter, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, View, ActivityIndicator, StyleSheet } from 'react-native';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { Colors } from '../src/constants/theme';

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading, handleGoogleCallback } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Handle Google OAuth callback
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash?.includes('session_id=')) {
        const sessionId = hash.split('session_id=')[1]?.split('&')[0];
        if (sessionId) {
          handleGoogleCallback(sessionId).then(() => {
            window.history.replaceState(null, '', window.location.pathname);
            router.replace('/(tabs)/dashboard');
          }).catch(() => {
            window.history.replaceState(null, '', '/');
            router.replace('/');
          });
        }
      }
    }
  }, []);

  useEffect(() => {
    if (!isLoading) {
      if (user && pathname === '/') {
        router.replace('/(tabs)/dashboard');
      } else if (!user && pathname !== '/') {
        // Check if URL has session_id - don't redirect if processing OAuth
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.hash?.includes('session_id=')) {
          return;
        }
        router.replace('/');
      }
    }
  }, [user, isLoading, pathname]);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.secondary} />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <AuthGate>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.dark.background } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </AuthGate>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.dark.background,
  },
});

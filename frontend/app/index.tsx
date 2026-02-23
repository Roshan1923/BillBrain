import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import { Colors } from '../src/constants/theme';

export default function AuthScreen() {
  const { login, register, loginWithGoogle } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }
    if (!isLogin && !name.trim()) {
      setError('Please enter your name');
      return;
    }
    setLoading(true);
    try {
      if (isLogin) {
        await login(email.trim(), password);
      } else {
        await register(name.trim(), email.trim(), password);
      }
    } catch (e: any) {
      setError(e.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Image source={require('../assets/images/logo.jpeg')} style={styles.logo} />
            <Text style={styles.tagline}>Smart Receipt Tracking</Text>
          </View>

          {/* Tab Switcher */}
          <View style={styles.tabRow}>
            <TouchableOpacity
              testID="auth-tab-signin"
              style={[styles.tab, isLogin && styles.tabActive]}
              onPress={() => { setIsLogin(true); setError(''); }}
            >
              <Text style={[styles.tabText, isLogin && styles.tabTextActive]}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="auth-tab-signup"
              style={[styles.tab, !isLogin && styles.tabActive]}
              onPress={() => { setIsLogin(false); setError(''); }}
            >
              <Text style={[styles.tabText, !isLogin && styles.tabTextActive]}>Sign Up</Text>
            </TouchableOpacity>
          </View>

          {/* Error */}
          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={Colors.status.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Form */}
          <View style={styles.form}>
            {!isLogin && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Full Name</Text>
                <View style={styles.inputRow}>
                  <Ionicons name="person-outline" size={20} color={Colors.dark.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    testID="auth-name-input"
                    style={styles.input}
                    placeholder="John Doe"
                    placeholderTextColor={Colors.dark.textTertiary}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                  />
                </View>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputRow}>
                <Ionicons name="mail-outline" size={20} color={Colors.dark.textSecondary} style={styles.inputIcon} />
                <TextInput
                  testID="auth-email-input"
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor={Colors.dark.textTertiary}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputRow}>
                <Ionicons name="lock-closed-outline" size={20} color={Colors.dark.textSecondary} style={styles.inputIcon} />
                <TextInput
                  testID="auth-password-input"
                  style={[styles.input, styles.flex]}
                  placeholder="••••••••"
                  placeholderTextColor={Colors.dark.textTertiary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity testID="toggle-password-btn" onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.dark.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              testID="auth-submit-btn"
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.submitText}>{isLogin ? 'Sign In' : 'Create Account'}</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Social */}
          <TouchableOpacity testID="google-signin-btn" style={styles.googleBtn} onPress={loginWithGoogle}>
            <Ionicons name="logo-google" size={20} color={Colors.white} />
            <Text style={styles.googleText}>Continue with Google</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40, justifyContent: 'center' },
  logoContainer: { alignItems: 'center', marginBottom: 32 },
  logo: { width: 120, height: 120, borderRadius: 24 },
  tagline: { fontSize: 14, color: Colors.dark.textSecondary, marginTop: 12, letterSpacing: 1 },
  tabRow: { flexDirection: 'row', backgroundColor: Colors.dark.card, borderRadius: 12, padding: 4, marginBottom: 24 },
  tab: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: 15, fontWeight: '600', color: Colors.dark.textSecondary },
  tabTextActive: { color: Colors.white },
  errorBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.1)', padding: 12, borderRadius: 10, marginBottom: 16, gap: 8 },
  errorText: { color: Colors.status.error, fontSize: 13, flex: 1 },
  form: { gap: 16 },
  inputGroup: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.dark.textSecondary, marginLeft: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.dark.card, borderRadius: 12, borderWidth: 1, borderColor: Colors.dark.border, height: 52 },
  inputIcon: { marginLeft: 16 },
  input: { flex: 1, color: Colors.white, fontSize: 15, paddingHorizontal: 12, height: '100%' },
  eyeBtn: { padding: 12 },
  submitBtn: { backgroundColor: Colors.primary, height: 52, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  submitBtnDisabled: { opacity: 0.7 },
  submitText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 24, gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.dark.border },
  dividerText: { color: Colors.dark.textTertiary, fontSize: 13 },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 52, borderRadius: 12, borderWidth: 1, borderColor: Colors.dark.border, backgroundColor: Colors.dark.card, gap: 10 },
  googleText: { color: Colors.white, fontSize: 15, fontWeight: '600' },
});

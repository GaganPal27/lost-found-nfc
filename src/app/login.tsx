import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Alert,
  StatusBar, StyleSheet, ActivityIndicator,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Institution selected on the select-college screen
  const [institutionName, setInstitutionName] = useState<string | null>(null);

  const passwordRef = useRef<TextInput>(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    (async () => {
      const name = await AsyncStorage.getItem('selectedCollegeName');
      const id   = await AsyncStorage.getItem('selectedCollegeId');
      if (!id) {
        // No institution chosen yet — send them to picker first
        router.replace('/select-college');
        return;
      }
      setInstitutionName(name ?? null);
    })();
  }, []);

  const handleChangeInstitution = async () => {
    await AsyncStorage.multiRemove(['selectedCollegeId', 'selectedCollegeName', 'selectedCollegeDomain']);
    router.push('/select-college');
  };

  const handleLogin = async () => {
    if (!email.trim()) { Alert.alert('Required', 'Please enter your email address.'); return; }
    if (!password)     { Alert.alert('Required', 'Please enter your password.'); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) Alert.alert('Sign In Failed', error.message);
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* ── Institution Header (outside scroll view — has no inputs, doesn't need keyboard avoidance,
           and Android's KeyboardAwareScrollView eats touch events at scroll position 0) ── */}
      <View style={[styles.institutionHeader, { paddingTop: insets.top + 32 }]}>
        {/* App brand */}
        <View style={styles.brandRow}>
          <Text style={styles.brandEmoji}>📡</Text>
          <Text style={styles.brandName}>Keepr</Text>
        </View>

        {/* Institution name — the focal point */}
        {institutionName ? (
          <>
            <Text style={styles.institutionName}>{institutionName}</Text>
            <TouchableOpacity
              onPress={handleChangeInstitution}
              activeOpacity={0.6}
              style={styles.notFromWrap}
              hitSlop={{ top: 12, bottom: 12, left: 20, right: 20 }}
            >
              <Text style={styles.notFromText}>Not from {institutionName}?</Text>
            </TouchableOpacity>
          </>
        ) : (
          <ActivityIndicator color="#6366f1" style={{ marginTop: 16 }} />
        )}
      </View>

      {/* ── Form (keyboard-aware, inputs only) ── */}
      <KeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        extraScrollHeight={20}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.body}>
          {/* Email */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Username</Text>
            <View style={[styles.inputRow, focusedField === 'email' && styles.inputRowFocused]}>
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                placeholderTextColor="#94a3b8"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                returnKeyType="next"
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                onSubmitEditing={() => passwordRef.current?.focus()}
                blurOnSubmit={false}
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.fieldGroup}>
            <View style={styles.passwordLabelRow}>
              <Text style={styles.label}>Password</Text>
              <TouchableOpacity onPress={() => router.push('/forgot-password')} activeOpacity={0.7}>
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.inputRow, focusedField === 'password' && styles.inputRowFocused]}>
              <TextInput
                ref={passwordRef}
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor="#94a3b8"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                activeOpacity={0.7}
                style={styles.showBtn}
              >
                <Text style={styles.showBtnText}>{showPassword ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Login button */}
          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.88}
            style={[styles.loginBtn, loading && { opacity: 0.7 }]}
          >
            {loading
              ? <ActivityIndicator color="#ffffff" />
              : <Text style={styles.loginBtnText}>Login</Text>
            }
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Create account */}
          <TouchableOpacity
            onPress={() => router.push('/registration')}
            activeOpacity={0.7}
            style={styles.createAccountBtn}
          >
            <Text style={styles.createAccountText}>
              <Text style={styles.createAccountLink}>Create an account</Text>
            </Text>
          </TouchableOpacity>

          <Text style={[styles.termsText, { paddingBottom: insets.bottom + 24 }]}>
            By logging in, you agree to our{' '}
            <Text style={styles.termsLink}>Terms of Use</Text>
            {' '}and our{' '}
            <Text style={styles.termsLink}>Privacy Policy</Text>
          </Text>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },

  /* ── Institution Header ── */
  institutionHeader: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 32,
    backgroundColor: '#ffffff',
  },
  brandRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 28,
  },
  brandEmoji: { fontSize: 22, marginRight: 6 },
  brandName: { fontSize: 22, fontWeight: '900', color: '#0f172a', letterSpacing: 0.5 },

  institutionName: {
    fontSize: 26, fontWeight: '800', color: '#0f172a',
    textAlign: 'center', marginBottom: 10, letterSpacing: -0.3,
  },
  notFromWrap: { paddingVertical: 4 },
  notFromText: {
    color: '#6366f1', fontSize: 15, fontWeight: '700',
    textDecorationLine: 'underline',
  },

  /* ── Body ── */
  body: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingHorizontal: 24,
    paddingTop: 28,
  },

  /* ── Fields ── */
  fieldGroup: { marginBottom: 18 },
  label: { color: '#0f172a', fontSize: 14, fontWeight: '700', marginBottom: 8 },
  passwordLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  inputRow: {
    borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 12,
    paddingHorizontal: 14, backgroundColor: '#ffffff',
    flexDirection: 'row', alignItems: 'center',
  },
  inputRowFocused: { borderColor: '#6366f1' },
  input: { flex: 1, color: '#0f172a', fontSize: 15, fontWeight: '500', paddingVertical: 14 },
  showBtn: { paddingLeft: 8, paddingVertical: 4 },
  showBtnText: { color: '#6366f1', fontWeight: '700', fontSize: 13 },
  forgotText: { color: '#6366f1', fontWeight: '700', fontSize: 13 },

  /* ── Login button ── */
  loginBtn: {
    backgroundColor: '#4a9be8',
    borderRadius: 30, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 4, marginBottom: 24,
    shadowColor: '#4a9be8', shadowOpacity: 0.35,
    shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  loginBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },

  /* ── Divider ── */
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e2e8f0' },
  dividerText: { color: '#94a3b8', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginHorizontal: 12 },

  /* ── Bottom links ── */
  createAccountBtn: { alignItems: 'center', paddingVertical: 4, marginBottom: 24 },
  createAccountText: { color: '#64748b', fontSize: 15, fontWeight: '500' },
  createAccountLink: { color: '#6366f1', fontWeight: '800' },
  termsText: { color: '#64748b', fontSize: 12, textAlign: 'center', lineHeight: 18, paddingHorizontal: 16 },
  termsLink: { color: '#6366f1', fontWeight: '600' },
});

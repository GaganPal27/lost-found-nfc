import { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Alert,
  StatusBar, StyleSheet, ActivityIndicator,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const passwordRef = useRef<TextInput>(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();

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
      <StatusBar barStyle="light-content" backgroundColor="#6366f1" />

      <KeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        extraScrollHeight={20}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Gradient Header ── */}
        <LinearGradient
          colors={['#6366f1', '#7c3aed']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + 36 }]}
        >
          <View style={styles.circle1} />
          <View style={styles.circle2} />

          <View style={styles.logoWrap}>
            <Text style={styles.logoEmoji}>📡</Text>
          </View>
          <Text style={styles.appName}>Keepr</Text>
          <Text style={styles.appTagline}>NFC Lost & Found Network</Text>
          <Text style={styles.welcomeTitle}>Welcome back</Text>
          <Text style={styles.welcomeSub}>
            Sign in to protect your items{'\n'}and manage your network.
          </Text>
        </LinearGradient>

        {/* ── White body (overlaps gradient with rounded top corners) ── */}
        <View style={styles.body}>

          {/* Floating card */}
          <View style={styles.card}>

            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email address</Text>
              <View style={[styles.inputRow, focusedField === 'email' && styles.inputRowFocused]}>
                <Text style={styles.inputIcon}>✉️</Text>
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
              <Text style={styles.label}>Password</Text>
              <View style={[styles.inputRow, focusedField === 'password' && styles.inputRowFocused]}>
                <Text style={styles.inputIcon}>🔒</Text>
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

            {/* Forgot password */}
            <TouchableOpacity
              onPress={() => router.push('/forgot-password')}
              activeOpacity={0.7}
              style={styles.forgotWrap}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            {/* Sign In Button */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.88}
              style={{ borderRadius: 16, overflow: 'hidden', marginTop: 8 }}
            >
              <LinearGradient
                colors={loading ? ['#a5b4fc', '#c4b5fd'] : ['#6366f1', '#7c3aed']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.signInBtn}
              >
                {loading
                  ? <ActivityIndicator color="#ffffff" />
                  : <Text style={styles.signInBtnText}>Sign In  →</Text>
                }
              </LinearGradient>
            </TouchableOpacity>
          </View>

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
              Don't have an account?{'  '}
              <Text style={styles.createAccountLink}>Create one — it's free</Text>
            </Text>
          </TouchableOpacity>

          <Text style={[styles.termsText, { paddingBottom: insets.bottom + 24 }]}>
            By signing in, you agree to our{' '}
            <Text style={styles.termsLink}>Terms & Privacy Policy</Text>
          </Text>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8faff' },

  /* ── Header ── */
  header: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 60,
    overflow: 'hidden',
    position: 'relative',
  },
  circle1: {
    position: 'absolute', top: -40, right: -40,
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  circle2: {
    position: 'absolute', bottom: 10, left: -50,
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  logoWrap: {
    width: 68, height: 68, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  logoEmoji:    { fontSize: 32 },
  appName:      { color: '#fff', fontSize: 26, fontWeight: '900', letterSpacing: 0.5, marginBottom: 2 },
  appTagline:   { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700', letterSpacing: 1.8, textTransform: 'uppercase', marginBottom: 28 },
  welcomeTitle: { color: '#fff', fontSize: 34, fontWeight: '900', letterSpacing: -0.5, marginBottom: 8 },
  welcomeSub:   { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '500', textAlign: 'center', lineHeight: 21 },

  /* ── Body: white rounded-top sheet overlapping gradient ── */
  body: {
    flex: 1,
    backgroundColor: '#f8faff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -28,
    paddingHorizontal: 18,
    paddingTop: 24,
  },

  /* ── Form card ── */
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24, padding: 22, marginBottom: 16,
    shadowColor: '#6366f1', shadowOpacity: 0.10, shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 }, elevation: 5,
    borderWidth: 1, borderColor: '#f1f5f9',
  },

  /* ── Fields ── */
  fieldGroup:      { marginBottom: 16 },
  label:           { color: '#64748b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 7 },
  inputRow:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8faff', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 14, paddingHorizontal: 14 },
  inputRowFocused: { borderColor: '#6366f1', backgroundColor: '#eef2ff' },
  inputIcon:       { fontSize: 16, marginRight: 10 },
  input:           { flex: 1, color: '#0f172a', fontSize: 15, fontWeight: '500', paddingVertical: 14 },
  showBtn:         { paddingLeft: 8, paddingVertical: 4 },
  showBtnText:     { color: '#6366f1', fontWeight: '700', fontSize: 13 },
  forgotWrap:      { alignSelf: 'flex-end', marginBottom: 4, marginTop: -6 },
  forgotText:      { color: '#6366f1', fontWeight: '700', fontSize: 13 },

  /* ── Sign In button ── */
  signInBtn:     { paddingVertical: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  signInBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },

  /* ── Divider ── */
  dividerRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e2e8f0' },
  dividerText: { color: '#94a3b8', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginHorizontal: 12 },

  /* ── Bottom links ── */
  createAccountBtn:  { alignItems: 'center', paddingVertical: 4, marginBottom: 20 },
  createAccountText: { color: '#64748b', fontSize: 15, fontWeight: '500' },
  createAccountLink: { color: '#6366f1', fontWeight: '800' },
  termsText:         { color: '#94a3b8', fontSize: 12, textAlign: 'center', lineHeight: 18 },
  termsLink:         { color: '#6366f1', fontWeight: '600' },
});

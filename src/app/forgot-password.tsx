import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Alert, Animated,
  StatusBar, StyleSheet, ActivityIndicator
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

type Stage = 'email' | 'sent';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<Stage>('email');
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const handleReset = async () => {
    if (!email.trim()) { Alert.alert('Required', 'Please enter your email address.'); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: 'lostfoundnfc://reset-password',
    });
    if (error) { Alert.alert('Error', error.message); }
    else { setStage('sent'); }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#6366f1" />
      <KeyboardAwareScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" enableOnAndroid extraScrollHeight={20} showsVerticalScrollIndicator={false}>
        
        {/* ── Gradient Header ── */}
        <LinearGradient
          colors={['#6366f1', '#7c3aed']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + 16 }]}
        >
          <View style={styles.circle1} />
          <View style={styles.circle2} />

          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>

          <View style={styles.headerContent}>
            {stage === 'email' ? (
              <>
                <View style={styles.iconOrb}>
                  <Text style={styles.iconEmoji}>🔑</Text>
                </View>
                <Text style={styles.headerTitle}>Forgot Password?</Text>
                <Text style={styles.headerSub}>
                  No worries. Enter your email and we'll send you a link to reset your password.
                </Text>
              </>
            ) : (
              <>
                <View style={styles.iconOrb}>
                  <Text style={styles.iconEmoji}>📧</Text>
                </View>
                <Text style={styles.headerTitle}>Check your inbox</Text>
                <Text style={styles.headerSub}>
                  We sent a password reset link to{'\n'}
                  <Text style={{fontWeight: '800', color: '#ffffff'}}>{email}</Text>
                </Text>
              </>
            )}
          </View>
        </LinearGradient>

        {/* ── Body ── */}
        <View style={styles.body}>
          <Animated.View style={{ opacity: fadeIn }}>
            {stage === 'email' ? (
              <View style={styles.card}>
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
                      autoFocus
                      returnKeyType="done"
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                      onSubmitEditing={handleReset}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  onPress={handleReset}
                  disabled={loading}
                  activeOpacity={0.88}
                  style={styles.primaryBtnWrap}
                >
                  <LinearGradient
                    colors={loading ? ['#a5b4fc', '#c4b5fd'] : ['#6366f1', '#7c3aed']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.primaryBtn}
                  >
                    {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryBtnText}>Send Reset Link  →</Text>}
                  </LinearGradient>
                </TouchableOpacity>

                <View style={styles.infoBanner}>
                  <Text style={styles.infoBannerText}>
                    If an account exists for this email, you'll receive a reset link within a few minutes. Check your spam folder too.
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.card}>
                <View style={styles.stepList}>
                  {[
                    { num: '1', text: 'Open the email from Lost & Found Network' },
                    { num: '2', text: 'Tap the "Reset Password" link' },
                    { num: '3', text: 'Choose a new password and sign in' },
                  ].map((step, i) => (
                    <View key={i} style={[styles.stepItem, i !== 2 && styles.stepItemBorder]}>
                      <View style={styles.stepNumWrap}>
                        <Text style={styles.stepNumText}>{step.num}</Text>
                      </View>
                      <Text style={styles.stepText}>{step.text}</Text>
                    </View>
                  ))}
                </View>

                <TouchableOpacity
                  onPress={() => router.replace('/login')}
                  activeOpacity={0.88}
                  style={styles.primaryBtnWrap}
                >
                  <LinearGradient colors={['#6366f1', '#7c3aed']} start={{x:0,y:0}} end={{x:1,y:0}} style={styles.primaryBtn}>
                    <Text style={styles.primaryBtnText}>Back to Sign In  →</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => { setStage('email'); setEmail(''); }} style={styles.retryBtn} activeOpacity={0.7}>
                  <Text style={styles.retryBtnText}>Didn't receive it? Try again</Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8faff' },

  /* ── Header ── */
  header: { paddingHorizontal: 24, paddingBottom: 60, overflow: 'hidden', position: 'relative' },
  circle1: { position: 'absolute', top: -30, right: -30, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.08)' },
  circle2: { position: 'absolute', bottom: -20, left: -40, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.06)' },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 8, marginBottom: 12 },
  backBtnText: { color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: '700' },
  
  headerContent: { alignItems: 'center', marginTop: 10 },
  iconOrb: { width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  iconEmoji: { fontSize: 32 },
  headerTitle: { color: '#ffffff', fontSize: 28, fontWeight: '900', letterSpacing: -0.5, marginBottom: 8, textAlign: 'center' },
  headerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '500', textAlign: 'center', lineHeight: 21 },

  /* ── Body ── */
  body: { flex: 1, backgroundColor: '#f8faff', borderTopLeftRadius: 32, borderTopRightRadius: 32, marginTop: -28, paddingHorizontal: 18, paddingTop: 24 },
  card: { backgroundColor: '#ffffff', borderRadius: 24, padding: 22, shadowColor: '#6366f1', shadowOpacity: 0.1, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 5, borderWidth: 1, borderColor: '#f1f5f9' },

  /* ── Fields ── */
  fieldGroup: { marginBottom: 20 },
  label: { color: '#64748b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 7 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8faff', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 14, paddingHorizontal: 14 },
  inputRowFocused: { borderColor: '#6366f1', backgroundColor: '#eef2ff' },
  inputIcon: { fontSize: 16, marginRight: 10 },
  input: { flex: 1, color: '#0f172a', fontSize: 15, fontWeight: '500', paddingVertical: 14 },

  /* ── Buttons ── */
  primaryBtnWrap: { borderRadius: 16, overflow: 'hidden', shadowColor: '#6366f1', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  primaryBtn: { paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },

  /* ── Banners & Lists ── */
  infoBanner: { backgroundColor: '#f1f5f9', borderRadius: 16, padding: 16, marginTop: 16 },
  infoBannerText: { color: '#64748b', fontSize: 12, lineHeight: 18, textAlign: 'center', fontWeight: '500' },
  
  stepList: { backgroundColor: '#f8faff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, padding: 16, marginBottom: 20 },
  stepItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  stepItemBorder: { borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  stepNumWrap: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#eef2ff', borderWidth: 1, borderColor: '#c7d2fe', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  stepNumText: { color: '#6366f1', fontSize: 12, fontWeight: '800' },
  stepText: { flex: 1, color: '#0f172a', fontSize: 14, fontWeight: '600' },
  
  retryBtn: { marginTop: 16, alignItems: 'center', paddingVertical: 8 },
  retryBtnText: { color: '#64748b', fontSize: 13, fontWeight: '600' },
});

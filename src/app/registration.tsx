import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Alert, Animated,
  StatusBar, ScrollView, StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import * as Location from 'expo-location';
import { updateUserLocation } from '../lib/location';

export default function RegistrationScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  // DPDP Act 2023 — Section 6 Granular Consents
  const [consentAccount, setConsentAccount] = useState(false);   // MANDATORY
  const [consentLocation, setConsentLocation] = useState(false); // Optional
  const [consentComms, setConsentComms] = useState(false);       // Optional

  // DPDP Act 2023 — Section 9 Age Declaration
  const [ageConfirmed, setAgeConfirmed] = useState(false);       // MANDATORY

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const router = useRouter();

  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const getPasswordStrength = () => {
    if (!password) return null;
    if (password.length < 6) return { label: 'Too short', color: '#ef4444', widthPct: 25 };
    if (password.length < 8) return { label: 'Weak', color: '#f59e0b', widthPct: 50 };
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) return { label: 'Fair', color: '#eab308', widthPct: 70 };
    return { label: 'Strong', color: '#22c55e', widthPct: 100 };
  };

  const strength = getPasswordStrength();
  const canSubmit = consentAccount && ageConfirmed && !loading;

  const handleRegister = async () => {
    if (!consentAccount) {
      Alert.alert('Consent Required', 'You must consent to account data processing to create an account. This is required to identify you and keep your items secure.');
      return;
    }
    if (!ageConfirmed) {
      Alert.alert('Age Confirmation Required', 'You must confirm that you are 18 years of age or older to use this app.');
      return;
    }
    if (!name.trim()) { Alert.alert('Required', 'Please enter your name.'); return; }
    if (!email.trim()) { Alert.alert('Required', 'Please enter your email address.'); return; }
    if (password.length < 6) { Alert.alert('Weak Password', 'Password must be at least 6 characters.'); return; }
    if (password !== confirmPassword) { Alert.alert('Mismatch', 'Passwords do not match. Please try again.'); return; }

    const now = new Date().toISOString();

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: name.trim(),
          // Store consent timestamps in auth metadata as a backup
          consent_account_at: now,
          consent_location_at: consentLocation ? now : null,
          consent_comms_at: consentComms ? now : null,
          age_declared_at: now,
        },
      },
    });

    if (error) {
      Alert.alert('Registration Failed', error.message);
    } else if (data.user) {
      // Upsert the user row with consent timestamps (DPDP audit trail)
      await supabase.from('users').upsert({
        id: data.user.id,
        email: email.trim(),
        full_name: name.trim(),
        consent_account_at: now,
        consent_location_at: consentLocation ? now : null,
        consent_comms_at: consentComms ? now : null,
        age_declared_at: now,
      }, { onConflict: 'id' });

      // Request location permission only if user consented
      if (consentLocation) {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted' && data.session) {
            await updateUserLocation(data.user.id);
          }
        } catch (err) {
          console.log('Location ask failed', err);
        }
      }

      if (!data.session) {
        Alert.alert(
          '📧 Confirm your email',
          `We sent a confirmation link to ${email}. Click it to activate your account, then sign in.`,
          [{ text: 'OK', onPress: () => router.replace('/login') }]
        );
      }
    }
    setLoading(false);
  };

  const ConsentToggle = ({
    value, onToggle, required, title, subtitle,
  }: {
    value: boolean; onToggle: () => void; required?: boolean;
    title: string; subtitle: string;
  }) => (
    <TouchableOpacity onPress={onToggle} activeOpacity={0.7} style={styles.consentRow}>
      <View style={[
        styles.checkbox,
        { borderColor: value ? '#6366f1' : '#475569', backgroundColor: value ? '#6366f1' : 'transparent' }
      ]}>
        {value && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <View style={styles.consentText}>
        <View style={styles.consentTitleRow}>
          <Text style={styles.consentTitle}>{title}</Text>
          {required && <View style={styles.requiredBadge}><Text style={styles.requiredText}>Required</Text></View>}
          {!required && <View style={styles.optionalBadge}><Text style={styles.optionalText}>Optional</Text></View>}
        </View>
        <Text style={styles.consentSub}>{subtitle}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back Button */}
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backTxt}>← Back to Sign In</Text>
        </TouchableOpacity>

        <Animated.View style={{ opacity: fadeIn, transform: [{ translateY: slideUp }] }}>
          {/* Header */}
          <View style={styles.headerBlock}>
            <View style={styles.iconWrap}><Text style={styles.iconEmoji}>🛡️</Text></View>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>
              {'Join the Lost & Found Network.\nProtect your valuables — for free.'}
            </Text>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            {/* Name */}
            <Text style={styles.label}>Full Name</Text>
            <View style={styles.inputRow}>
              <Text style={styles.inputIcon}>👤</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Alex Chen"
                placeholderTextColor="#64748b"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
                blurOnSubmit={false}
              />
            </View>

            {/* Email */}
            <Text style={styles.label}>Email Address</Text>
            <View style={styles.inputRow}>
              <Text style={styles.inputIcon}>✉️</Text>
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                placeholderTextColor="#64748b"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                ref={emailRef}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                blurOnSubmit={false}
              />
            </View>

            {/* Password */}
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputRow}>
              <Text style={styles.inputIcon}>🔒</Text>
              <TextInput
                style={styles.input}
                placeholder="At least 6 characters"
                placeholderTextColor="#64748b"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                ref={passwordRef}
                returnKeyType="next"
                onSubmitEditing={() => confirmRef.current?.focus()}
                blurOnSubmit={false}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} activeOpacity={0.7}>
                <Text style={styles.showHide}>{showPassword ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>

            {/* Password Strength */}
            {strength && (
              <View style={styles.strengthWrap}>
                <View style={styles.strengthBar}>
                  <View style={[styles.strengthFill, { width: `${strength.widthPct}%` as any, backgroundColor: strength.color }]} />
                </View>
                <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
              </View>
            )}

            {/* Confirm Password */}
            <Text style={styles.label}>Confirm Password</Text>
            <View style={[styles.inputRow, confirmPassword && confirmPassword !== password ? styles.inputError : {}]}>
              <Text style={styles.inputIcon}>🔑</Text>
              <TextInput
                style={styles.input}
                placeholder="Re-enter password"
                placeholderTextColor="#64748b"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
                autoCorrect={false}
                ref={confirmRef}
                returnKeyType="done"
                onSubmitEditing={handleRegister}
              />
              <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} activeOpacity={0.7}>
                <Text style={styles.showHide}>{showConfirm ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>
            {confirmPassword && confirmPassword !== password && (
              <Text style={styles.errorText}>Passwords do not match</Text>
            )}
          </View>

          {/* ─── DPDP Consent Section ─── */}
          <View style={styles.consentCard}>
            <View style={styles.consentHeader}>
              <Text style={styles.consentHeaderEmoji}>📋</Text>
              <View>
                <Text style={styles.consentHeaderTitle}>Data & Privacy Consents</Text>
                <Text style={styles.consentHeaderSub}>Required under the DPDP Act 2023 (India)</Text>
              </View>
            </View>

            <ConsentToggle
              value={consentAccount}
              onToggle={() => setConsentAccount(!consentAccount)}
              required
              title="Account & Identity Data"
              subtitle="Your name and email are used for authentication and account security. Without this, we cannot create your account."
            />

            <View style={styles.divider} />

            <ConsentToggle
              value={consentLocation}
              onToggle={() => setConsentLocation(!consentLocation)}
              title="Location Data"
              subtitle="Your GPS coordinates are used to show you nearby lost items and send radius alerts to your community. You can change this later in Settings."
            />

            <View style={styles.divider} />

            <ConsentToggle
              value={consentComms}
              onToggle={() => setConsentComms(!consentComms)}
              title="Notifications & Communications"
              subtitle="Push notifications when your item is found, someone messages you, or a new lost report appears nearby. You can change this later in Settings."
            />

            <TouchableOpacity onPress={() => router.push('/privacy-policy')} style={styles.policyLink} activeOpacity={0.7}>
              <Text style={styles.policyLinkText}>Read our full Privacy Policy →</Text>
            </TouchableOpacity>
          </View>

          {/* ─── Age Declaration ─── */}
          <View style={styles.ageCard}>
            <TouchableOpacity onPress={() => setAgeConfirmed(!ageConfirmed)} activeOpacity={0.7} style={styles.consentRow}>
              <View style={[
                styles.checkbox,
                { borderColor: ageConfirmed ? '#0891b2' : '#475569', backgroundColor: ageConfirmed ? '#0891b2' : 'transparent' }
              ]}>
                {ageConfirmed && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <View style={styles.consentText}>
                <View style={styles.consentTitleRow}>
                  <Text style={styles.consentTitle}>I am 18 years or older</Text>
                  <View style={styles.requiredBadge}><Text style={styles.requiredText}>Required</Text></View>
                </View>
                <Text style={styles.consentSub}>
                  {'This app is intended for adults only. By checking this box, you confirm you are 18 years of age or older. This is required under Section 9 of the DPDP Act 2023.'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Create Button */}
          <TouchableOpacity
            style={[styles.createBtn, !canSubmit && styles.createBtnDisabled]}
            onPress={handleRegister}
            disabled={!canSubmit}
            activeOpacity={0.85}
          >
            <Text style={[styles.createBtnText, !canSubmit && styles.createBtnTextDisabled]}>
              {loading ? 'Creating Account...' : 'Create Free Account'}
            </Text>
          </TouchableOpacity>

          {!consentAccount && (
            <Text style={styles.gateHint}>⚠️ Account data consent is required to continue</Text>
          )}
          {consentAccount && !ageConfirmed && (
            <Text style={styles.gateHint}>⚠️ Please confirm you are 18 or older</Text>
          )}

          {/* What's Included */}
          <View style={styles.card}>
            <Text style={styles.includedTitle}>Free plan includes</Text>
            {[
              { icon: '📦', title: 'Protect up to 2 items', sub: 'NFC tags supported' },
              { icon: '📱', title: 'NFC Scanning', sub: 'Let finders contact you instantly' },
              { icon: '🔔', title: 'Real-time alerts', sub: 'Know when your item is found' },
            ].map((f, i) => (
              <View key={i} style={[styles.featureRow, i !== 2 && styles.featureRowBorder]}>
                <View style={styles.featureIcon}><Text style={styles.featureEmoji}>{f.icon}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureSub}>{f.sub}</Text>
                </View>
                <Text style={styles.featureCheck}>✓</Text>
              </View>
            ))}
          </View>

          {/* Sign In Link */}
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.signinLink}>
            <Text style={styles.signinText}>
              {'Already have an account?  '}
              <Text style={styles.signinHighlight}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 60, paddingBottom: 60 },
  backBtn: { marginBottom: 32, flexDirection: 'row', alignItems: 'center' },
  backTxt: { color: '#6366f1', fontSize: 15, fontWeight: '600' },
  headerBlock: { marginBottom: 28 },
  iconWrap: {
    width: 64, height: 64, backgroundColor: '#1e293b', borderWidth: 1,
    borderColor: '#334155', borderRadius: 18, alignItems: 'center',
    justifyContent: 'center', marginBottom: 20,
  },
  iconEmoji: { fontSize: 28 },
  title: { color: '#fff', fontSize: 32, fontWeight: '900', marginBottom: 8 },
  subtitle: { color: '#94a3b8', fontSize: 15, lineHeight: 23 },
  card: {
    backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155',
    borderRadius: 24, padding: 20, marginBottom: 16,
  },
  label: {
    color: '#94a3b8', fontSize: 11, textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 8, fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a',
    borderWidth: 1, borderColor: '#334155', borderRadius: 16, paddingHorizontal: 14, marginBottom: 16,
  },
  inputError: { borderColor: '#ef4444' },
  inputIcon: { fontSize: 16, marginRight: 10, color: '#64748b' },
  input: { flex: 1, color: '#fff', fontSize: 15, paddingVertical: 14 },
  showHide: { color: '#64748b', fontSize: 13, fontWeight: '600' },
  strengthWrap: { marginTop: -10, marginBottom: 16 },
  strengthBar: { height: 6, backgroundColor: '#334155', borderRadius: 99, overflow: 'hidden', marginBottom: 4 },
  strengthFill: { height: '100%', borderRadius: 99 },
  strengthLabel: { fontSize: 11, fontWeight: '700' },
  errorText: { color: '#ef4444', fontSize: 11, marginTop: -12, marginBottom: 12 },

  // Consent Section
  consentCard: {
    backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#6366f1',
    borderRadius: 24, padding: 20, marginBottom: 16,
  },
  consentHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  consentHeaderEmoji: { fontSize: 24, marginRight: 12 },
  consentHeaderTitle: { color: '#fff', fontWeight: '800', fontSize: 15 },
  consentHeaderSub: { color: '#6366f1', fontSize: 11, fontWeight: '600', marginTop: 2 },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start' },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, marginTop: 2, marginRight: 12,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  checkmark: { color: '#fff', fontWeight: '900', fontSize: 13 },
  consentText: { flex: 1 },
  consentTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  consentTitle: { color: '#e2e8f0', fontWeight: '700', fontSize: 14 },
  requiredBadge: {
    backgroundColor: '#7f1d1d', borderRadius: 99,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  requiredText: { color: '#fca5a5', fontSize: 10, fontWeight: '700' },
  optionalBadge: {
    backgroundColor: '#1e3a2f', borderRadius: 99,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  optionalText: { color: '#6ee7b7', fontSize: 10, fontWeight: '700' },
  consentSub: { color: '#64748b', fontSize: 12, lineHeight: 18 },
  divider: { height: 1, backgroundColor: '#334155', marginVertical: 16 },
  policyLink: { marginTop: 16, alignItems: 'center' },
  policyLinkText: { color: '#6366f1', fontSize: 13, fontWeight: '600' },

  // Age Card
  ageCard: {
    backgroundColor: '#0c1a2e', borderWidth: 1, borderColor: '#0891b2',
    borderRadius: 24, padding: 20, marginBottom: 20,
  },

  // Create Button
  createBtn: {
    backgroundColor: '#6366f1', borderRadius: 18, paddingVertical: 16,
    alignItems: 'center', marginBottom: 10,
    shadowColor: '#6366f1', shadowOpacity: 0.4, shadowRadius: 12, elevation: 5,
  },
  createBtnDisabled: { backgroundColor: '#334155', shadowOpacity: 0, elevation: 0 },
  createBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  createBtnTextDisabled: { color: '#64748b' },
  gateHint: { color: '#f59e0b', fontSize: 12, textAlign: 'center', marginBottom: 16, fontWeight: '600' },

  // Features
  includedTitle: {
    color: '#94a3b8', fontSize: 11, textTransform: 'uppercase',
    letterSpacing: 1, fontWeight: '700', marginBottom: 16,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  featureRowBorder: { borderBottomWidth: 1, borderBottomColor: '#334155' },
  featureIcon: {
    width: 40, height: 40, backgroundColor: '#0f172a', borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  featureEmoji: { fontSize: 18 },
  featureTitle: { color: '#e2e8f0', fontWeight: '600', fontSize: 14 },
  featureSub: { color: '#64748b', fontSize: 12, marginTop: 2 },
  featureCheck: { color: '#6366f1', fontWeight: '900', fontSize: 18 },

  // Sign-in link
  signinLink: { paddingVertical: 8, alignItems: 'center' },
  signinText: { color: '#64748b', fontSize: 15 },
  signinHighlight: { color: '#6366f1', fontWeight: '700' },
});

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
import * as Location from 'expo-location';
import { updateUserLocation } from '../lib/location';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Consent toggle component ──────────────────────────────────────────────────
function ConsentToggle({
  value, onToggle, required, title, subtitle,
}: {
  value: boolean; onToggle: () => void; required?: boolean;
  title: string; subtitle: string;
}) {
  return (
    <TouchableOpacity onPress={onToggle} activeOpacity={0.7} style={styles.consentRow}>
      <View style={[styles.checkbox, value ? styles.checkboxOn : styles.checkboxOff]}>
        {value && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.consentTitleRow}>
          <Text style={styles.consentTitle}>{title}</Text>
          {required
            ? <View style={styles.requiredBadge}><Text style={styles.requiredText}>Required</Text></View>
            : <View style={styles.optionalBadge}><Text style={styles.optionalText}>Optional</Text></View>
          }
        </View>
        <Text style={styles.consentSub}>{subtitle}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────
export default function RegistrationScreen() {
  const [name, setName]                       = useState('');
  const [email, setEmail]                     = useState('');
  const [password, setPassword]               = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword]       = useState(false);
  const [showConfirm, setShowConfirm]         = useState(false);
  const [loading, setLoading]                 = useState(false);
  const [focusedField, setFocusedField]       = useState<string | null>(null);

  // DPDP Act 2023 — Section 6 Granular Consents
  const [consentAccount, setConsentAccount]   = useState(false); // MANDATORY
  const [consentLocation, setConsentLocation] = useState(false); // Optional
  const [consentComms, setConsentComms]       = useState(false); // Optional

  // DPDP Act 2023 — Section 9 Age Declaration
  const [ageConfirmed, setAgeConfirmed]       = useState(false); // MANDATORY

  const emailRef    = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef  = useRef<TextInput>(null);
  const router      = useRouter();
  const insets      = useSafeAreaInsets();

  // Email domain validation (UX warning only — server enforces via trigger)
  const [emailDomainWarning, setEmailDomainWarning] = useState<string | null>(null);

  const checkEmailDomain = async (emailValue: string) => {
    const collegeId = await AsyncStorage.getItem('selectedCollegeId');
    if (!collegeId || collegeId === 'other') { setEmailDomainWarning(null); return; }
    const { data: college } = await supabase.from('colleges').select('domain, name').eq('id', collegeId).single();
    if (!college?.domain) { setEmailDomainWarning(null); return; }
    const enteredDomain = emailValue.trim().split('@')[1]?.toLowerCase();
    if (enteredDomain && enteredDomain !== college.domain.toLowerCase()) {
      setEmailDomainWarning(`${college.name} requires a @${college.domain} email. You can still register, but you won't be able to post in the ${college.name} community.`);
    } else {
      setEmailDomainWarning(null);
    }
  };

  // ── Password strength ────────────────────────────────────────────────────
  const getStrength = () => {
    if (!password) return null;
    if (password.length < 6)  return { label: 'Too short', color: '#ef4444', pct: 20 };
    if (password.length < 8)  return { label: 'Weak',      color: '#f59e0b', pct: 45 };
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password))
                               return { label: 'Fair',      color: '#eab308', pct: 70 };
    return                          { label: 'Strong',     color: '#22c55e', pct: 100 };
  };
  const strength  = getStrength();
  const canSubmit = consentAccount && ageConfirmed && !loading;

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleRegister = async () => {
    if (!consentAccount) { Alert.alert('Consent Required', 'You must consent to account data processing to create an account.'); return; }
    if (!ageConfirmed)   { Alert.alert('Age Confirmation Required', 'You must confirm you are 18 years or older.'); return; }
    if (!name.trim())    { Alert.alert('Required', 'Please enter your name.'); return; }
    if (!email.trim())   { Alert.alert('Required', 'Please enter your email address.'); return; }
    if (password.length < 6) { Alert.alert('Weak Password', 'Password must be at least 6 characters.'); return; }
    if (password !== confirmPassword) { Alert.alert('Mismatch', 'Passwords do not match.'); return; }

    const now = new Date().toISOString();
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: name.trim(),
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
      await supabase.from('users').upsert({
        id: data.user.id,
        email: email.trim(),
        full_name: name.trim(),
        consent_account_at: now,
        consent_location_at: consentLocation ? now : null,
        consent_comms_at: consentComms ? now : null,
        age_declared_at: now,
      }, { onConflict: 'id' });

      // ── College auto-join: Track 1 (institutional) vs Track 2 (personal email) ──
      let needsIdVerification = false;
      let verificationGroupId: string | null = null;

      try {
        const collegeId     = await AsyncStorage.getItem('selectedCollegeId');
        const collegeDomain = await AsyncStorage.getItem('selectedCollegeDomain');

        if (collegeId && collegeId !== 'other' && collegeId !== 'none') {
          const collegeName = await AsyncStorage.getItem('selectedCollegeName') || 'College Community';

          // Determine Track 1 vs Track 2 based on email domain
          const emailDomain = email.trim().split('@')[1]?.toLowerCase();
          const isTrack1 = !!(collegeDomain && emailDomain && emailDomain === collegeDomain.toLowerCase());

          // The handle_new_user trigger already created the users row — fetch internal ID.
          // Retry once in case of trigger latency.
          let internalUserId: string | null = null;
          for (let attempt = 0; attempt < 2; attempt++) {
            const { data: profile } = await supabase
              .from('users').select('id').eq('auth_id', data.user.id).single();
            internalUserId = profile?.id ?? null;
            if (internalUserId) break;
            await new Promise(r => setTimeout(r, 800)); // wait for trigger
          }

          if (!internalUserId) {
            console.warn('Could not fetch internal user ID — skipping community auto-join');
          } else {
            // Find or create the official community for this college
            let { data: existingGroup } = await supabase
              .from('community_groups').select('id').eq('college_id', collegeId).maybeSingle();
            let groupId = existingGroup?.id;

            if (!groupId) {
              const { data: newGroup } = await supabase
                .from('community_groups')
                .insert({ name: collegeName, is_official: true, creator_id: internalUserId, college_id: collegeId })
                .select('id').single();
              groupId = newGroup?.id;
            }

            if (groupId) {
              if (isTrack1) {
                // Track 1: institutional email → verified, full access immediately
                await supabase.from('group_members').upsert({
                  group_id: groupId, user_id: internalUserId,
                  role: 'member', status: 'active',
                  verified: true, membership_status: 'active',
                }, { onConflict: 'group_id,user_id' });
              } else {
                // Track 2: personal email → requested, needs ID upload
                await supabase.from('group_members').upsert({
                  group_id: groupId, user_id: internalUserId,
                  role: 'member', status: 'active',
                  verified: false, membership_status: 'requested',
                }, { onConflict: 'group_id,user_id' });
                needsIdVerification = true;
                verificationGroupId = groupId;
              }
              await supabase.rpc('increment_group_members', { g_id: groupId }).catch(() => {});
            }
          }
        }
      } catch (collegeErr) { console.warn('Failed to auto-join college community', collegeErr); }

      if (consentLocation) {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted' && data.session) await updateUserLocation(data.user.id);
        } catch (err) { console.log('Location ask failed', err); }
      }

      if (!data.session) {
        // Email confirmation required — they'll be routed to ID upload after login if Track 2
        const msg = needsIdVerification
          ? `We sent a confirmation link to ${email}. After confirming, sign in and you'll be prompted to upload your student ID.`
          : `We sent a confirmation link to ${email}. Click it to activate your account, then sign in.`;
        Alert.alert('📧 Confirm your email', msg, [{ text: 'OK', onPress: () => router.replace('/login') }]);
      } else if (needsIdVerification && verificationGroupId) {
        // Track 2 with immediate session — go to ID upload right now
        router.replace({ pathname: '/id-verification', params: { groupId: verificationGroupId } } as any);
      }
    }
    setLoading(false);
  };

  // ── Render ───────────────────────────────────────────────────────────────
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
          style={[styles.header, { paddingTop: insets.top + 20 }]}
        >
          <View style={styles.circle1} />
          <View style={styles.circle2} />

          {/* Back button inside gradient */}
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <View style={styles.logoWrap}>
            <Text style={styles.logoEmoji}>🛡️</Text>
          </View>
          <Text style={styles.headerTitle}>Create Account</Text>
          <Text style={styles.headerSub}>
            Join the Lost & Found Network.{'\n'}Protect your valuables — for free.
          </Text>
        </LinearGradient>

        {/* ── White body ── */}
        <View style={styles.body}>

          {/* ── Form card ── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Your Details</Text>

            {/* Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Full Name</Text>
              <View style={[styles.inputRow, focusedField === 'name' && styles.inputRowFocused]}>
                <Text style={styles.inputIcon}>👤</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Alex Chen"
                  placeholderTextColor="#94a3b8"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="next"
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField(null)}
                  onSubmitEditing={() => emailRef.current?.focus()}
                  blurOnSubmit={false}
                />
              </View>
            </View>

            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email Address</Text>
              <View style={[styles.inputRow, focusedField === 'email' && styles.inputRowFocused]}>
                <Text style={styles.inputIcon}>✉️</Text>
                <TextInput
                  ref={emailRef}
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
                  onBlur={() => { setFocusedField(null); checkEmailDomain(email); }}
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  blurOnSubmit={false}
                />
              </View>
              {emailDomainWarning && (
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 12, padding: 10, marginTop: 8 }}>
                  <Text style={{ fontSize: 14, marginRight: 6 }}>⚠️</Text>
                  <Text style={{ color: '#92400e', fontSize: 12, fontWeight: '600', flex: 1, lineHeight: 18 }}>{emailDomainWarning}</Text>
                </View>
              )}
            </View>


            {/* Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={[styles.inputRow, focusedField === 'password' && styles.inputRowFocused]}>
                <Text style={styles.inputIcon}>🔒</Text>
                <TextInput
                  ref={passwordRef}
                  style={styles.input}
                  placeholder="At least 6 characters"
                  placeholderTextColor="#94a3b8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  onSubmitEditing={() => confirmRef.current?.focus()}
                  blurOnSubmit={false}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} activeOpacity={0.7}>
                  <Text style={styles.showHide}>{showPassword ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </View>
              {/* Password strength bar */}
              {strength && (
                <View style={styles.strengthWrap}>
                  <View style={styles.strengthTrack}>
                    <View style={[styles.strengthFill, { width: `${strength.pct}%` as any, backgroundColor: strength.color }]} />
                  </View>
                  <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
                </View>
              )}
            </View>

            {/* Confirm Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={[
                styles.inputRow,
                focusedField === 'confirm' && styles.inputRowFocused,
                confirmPassword && confirmPassword !== password && styles.inputRowError,
              ]}>
                <Text style={styles.inputIcon}>🔑</Text>
                <TextInput
                  ref={confirmRef}
                  style={styles.input}
                  placeholder="Re-enter password"
                  placeholderTextColor="#94a3b8"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirm}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onFocus={() => setFocusedField('confirm')}
                  onBlur={() => setFocusedField(null)}
                  onSubmitEditing={handleRegister}
                />
                <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} activeOpacity={0.7}>
                  <Text style={styles.showHide}>{showConfirm ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </View>
              {confirmPassword && confirmPassword !== password && (
                <Text style={styles.errorText}>⚠️  Passwords do not match</Text>
              )}
            </View>
          </View>

          {/* ── DPDP Consent card ── */}
          <View style={styles.consentCard}>
            <View style={styles.consentHeader}>
              <Text style={styles.consentHeaderEmoji}>📋</Text>
              <View>
                <Text style={styles.consentHeaderTitle}>Data & Privacy Consents</Text>
                <Text style={styles.consentHeaderSub}>Required under the DPDP Act 2023 (India)</Text>
              </View>
            </View>

            <ConsentToggle
              value={consentAccount} onToggle={() => setConsentAccount(!consentAccount)} required
              title="Account & Identity Data"
              subtitle="Your name and email are used for authentication and account security. Without this, we cannot create your account."
            />
            <View style={styles.dividerLine} />
            <ConsentToggle
              value={consentLocation} onToggle={() => setConsentLocation(!consentLocation)}
              title="Location Data"
              subtitle="Your GPS coordinates are used to show nearby lost items and send radius alerts to your community."
            />
            <View style={styles.dividerLine} />
            <ConsentToggle
              value={consentComms} onToggle={() => setConsentComms(!consentComms)}
              title="Notifications & Communications"
              subtitle="Push notifications when your item is found, someone messages you, or a lost report appears nearby."
            />

            <TouchableOpacity onPress={() => router.push('/privacy-policy')} activeOpacity={0.7} style={styles.policyLink}>
              <Text style={styles.policyLinkText}>Read our full Privacy Policy →</Text>
            </TouchableOpacity>
          </View>

          {/* ── Age declaration card ── */}
          <View style={styles.ageCard}>
            <ConsentToggle
              value={ageConfirmed} onToggle={() => setAgeConfirmed(!ageConfirmed)} required
              title="I am 18 years or older"
              subtitle="This app is intended for adults only. Required under Section 9 of the DPDP Act 2023."
            />
          </View>

          {/* Hint messages */}
          {!consentAccount && (
            <Text style={styles.gateHint}>⚠️  Account data consent is required to continue</Text>
          )}
          {consentAccount && !ageConfirmed && (
            <Text style={styles.gateHint}>⚠️  Please confirm you are 18 or older</Text>
          )}

          {/* ── Create Account button ── */}
          <TouchableOpacity
            onPress={handleRegister}
            disabled={!canSubmit}
            activeOpacity={0.88}
            style={{ borderRadius: 18, overflow: 'hidden', marginBottom: 12 }}
          >
            <LinearGradient
              colors={canSubmit ? ['#6366f1', '#7c3aed'] : ['#e2e8f0', '#e2e8f0']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.createBtn}
            >
              {loading
                ? <ActivityIndicator color={canSubmit ? '#ffffff' : '#94a3b8'} />
                : <Text style={[styles.createBtnText, !canSubmit && styles.createBtnTextDisabled]}>
                    Create Free Account
                  </Text>
              }
            </LinearGradient>
          </TouchableOpacity>

          {/* ── Free plan perks ── */}
          <View style={styles.perksCard}>
            <Text style={styles.perksTitle}>Free plan includes</Text>
            {[
              { icon: '📦', title: 'Protect up to 2 items',    sub: 'NFC tags supported' },
              { icon: '📱', title: 'NFC Scanning',              sub: 'Let finders contact you instantly' },
              { icon: '🔔', title: 'Real-time alerts',          sub: 'Know when your item is found' },
            ].map((f, i) => (
              <View key={i} style={[styles.perkRow, i !== 2 && styles.perkRowBorder]}>
                <View style={styles.perkIcon}><Text style={{ fontSize: 18 }}>{f.icon}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.perkTitle}>{f.title}</Text>
                  <Text style={styles.perkSub}>{f.sub}</Text>
                </View>
                <Text style={styles.perkCheck}>✓</Text>
              </View>
            ))}
          </View>

          {/* Sign In Link */}
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={[styles.signInLink, { marginBottom: insets.bottom + 32 }]}>
            <Text style={styles.signInText}>
              Already have an account?{'  '}
              <Text style={styles.signInHighlight}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8faff' },

  /* Header */
  header: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 52,
    overflow: 'hidden',
    position: 'relative',
  },
  circle1: { position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.08)' },
  circle2: { position: 'absolute', bottom: 10, left: -50, width: 140, height: 140, borderRadius: 70,  backgroundColor: 'rgba(255,255,255,0.06)' },
  backBtn:  { alignSelf: 'flex-start', marginBottom: 20 },
  backText: { color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: '700' },
  logoWrap: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  logoEmoji:   { fontSize: 30 },
  headerTitle: { color: '#fff', fontSize: 28, fontWeight: '900', letterSpacing: -0.5, marginBottom: 6 },
  headerSub:   { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '500', textAlign: 'center', lineHeight: 21 },

  /* Body */
  body: {
    flex: 1, backgroundColor: '#f8faff',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    marginTop: -24, paddingHorizontal: 16, paddingTop: 22,
  },

  /* Form card */
  card: {
    backgroundColor: '#ffffff', borderRadius: 22, padding: 20, marginBottom: 14,
    shadowColor: '#6366f1', shadowOpacity: 0.08, shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 }, elevation: 4,
    borderWidth: 1, borderColor: '#f1f5f9',
  },
  cardTitle: { color: '#0f172a', fontWeight: '800', fontSize: 15, marginBottom: 16 },

  /* Fields */
  fieldGroup:       { marginBottom: 14 },
  label:            { color: '#64748b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 7 },
  inputRow:         { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8faff', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 14, paddingHorizontal: 14 },
  inputRowFocused:  { borderColor: '#6366f1', backgroundColor: '#eef2ff' },
  inputRowError:    { borderColor: '#ef4444', backgroundColor: '#fff5f5' },
  inputIcon:        { fontSize: 15, marginRight: 10 },
  input:            { flex: 1, color: '#0f172a', fontSize: 15, fontWeight: '500', paddingVertical: 13 },
  showHide:         { color: '#6366f1', fontWeight: '700', fontSize: 13, paddingLeft: 6 },
  errorText:        { color: '#ef4444', fontSize: 11, fontWeight: '600', marginTop: 5 },

  /* Strength bar */
  strengthWrap:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  strengthTrack: { flex: 1, height: 5, backgroundColor: '#e2e8f0', borderRadius: 99, overflow: 'hidden' },
  strengthFill:  { height: '100%', borderRadius: 99 },
  strengthLabel: { fontSize: 11, fontWeight: '700', width: 56, textAlign: 'right' },

  /* Consent card */
  consentCard: {
    backgroundColor: '#ffffff', borderRadius: 22, padding: 18, marginBottom: 12,
    borderWidth: 1.5, borderColor: '#e0e7ff',
    shadowColor: '#6366f1', shadowOpacity: 0.07, shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  consentHeader:      { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  consentHeaderEmoji: { fontSize: 22, marginRight: 10 },
  consentHeaderTitle: { color: '#0f172a', fontWeight: '800', fontSize: 14 },
  consentHeaderSub:   { color: '#6366f1', fontSize: 11, fontWeight: '600', marginTop: 1 },
  consentRow:         { flexDirection: 'row', alignItems: 'flex-start' },
  checkbox:           { width: 22, height: 22, borderRadius: 7, borderWidth: 2, marginTop: 2, marginRight: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkboxOn:         { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  checkboxOff:        { backgroundColor: 'transparent', borderColor: '#cbd5e1' },
  checkmark:          { color: '#fff', fontWeight: '900', fontSize: 13 },
  consentTitleRow:    { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 3 },
  consentTitle:       { color: '#0f172a', fontWeight: '700', fontSize: 13 },
  requiredBadge:      { backgroundColor: '#fee2e2', borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2 },
  requiredText:       { color: '#dc2626', fontSize: 10, fontWeight: '700' },
  optionalBadge:      { backgroundColor: '#dcfce7', borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2 },
  optionalText:       { color: '#16a34a', fontSize: 10, fontWeight: '700' },
  consentSub:         { color: '#64748b', fontSize: 12, lineHeight: 17 },
  dividerLine:        { height: 1, backgroundColor: '#f1f5f9', marginVertical: 14 },
  policyLink:         { marginTop: 14, alignItems: 'center' },
  policyLinkText:     { color: '#6366f1', fontSize: 13, fontWeight: '600' },

  /* Age card */
  ageCard: {
    backgroundColor: '#f0f9ff', borderRadius: 22, padding: 18, marginBottom: 14,
    borderWidth: 1.5, borderColor: '#bae6fd',
  },

  /* Hint */
  gateHint: { color: '#f59e0b', fontSize: 12, fontWeight: '700', textAlign: 'center', marginBottom: 10 },

  /* Create button */
  createBtn:             { paddingVertical: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  createBtnText:         { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  createBtnTextDisabled: { color: '#94a3b8' },

  /* Free perks card */
  perksCard: {
    backgroundColor: '#ffffff', borderRadius: 22, padding: 18, marginBottom: 16,
    borderWidth: 1, borderColor: '#f1f5f9',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  perksTitle:    { color: '#64748b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 },
  perkRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 11 },
  perkRowBorder: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  perkIcon:      { width: 38, height: 38, backgroundColor: '#f8faff', borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginRight: 13 },
  perkTitle:     { color: '#0f172a', fontWeight: '700', fontSize: 14 },
  perkSub:       { color: '#64748b', fontSize: 12, marginTop: 1 },
  perkCheck:     { color: '#6366f1', fontWeight: '900', fontSize: 18, marginLeft: 8 },

  /* Sign in link */
  signInLink:      { alignItems: 'center', paddingVertical: 6 },
  signInText:      { color: '#64748b', fontSize: 15, fontWeight: '500' },
  signInHighlight: { color: '#6366f1', fontWeight: '800' },
});

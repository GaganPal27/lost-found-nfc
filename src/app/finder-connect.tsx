import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, Alert, ActivityIndicator,
  Animated, StatusBar, StyleSheet,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import * as Sentry from '@sentry/react-native';

type Step = 'confirm' | 'location' | 'contact' | 'sent';

export default function FinderConnectScreen() {
  const { item_id, owner_id, item_name } = useLocalSearchParams<{
    item_id: string; owner_id: string; item_name: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const [step, setStep] = useState<Step>('confirm');
  const [loading, setLoading] = useState(false);
  const [finderName, setFinderName] = useState('');
  const [finderPhone, setFinderPhone] = useState('');
  const [message, setMessage] = useState('');
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const [focusedField, setFocusedField] = useState<string | null>(null);

  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
    const { user, dbUser } = useAuthStore.getState();
    if (dbUser?.full_name) {
      setFinderName(dbUser.full_name);
    } else if (user?.email) {
      setFinderName(user.email.split('@')[0]);
    }
  }, [step]);

  const captureLocation = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      try {
        const [place] = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        if (place) {
          const parts = [place.name, place.district || place.subregion, place.city].filter(Boolean);
          setLocationLabel(parts.join(', '));
        }
      } catch (_) {}
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!finderName.trim()) return Alert.alert('Required', 'Please enter your name so the owner can reach you.');
    if (!message.trim()) return Alert.alert('Required', 'Please write a short message to the owner.');
    setLoading(true);
    try {
      const { data: ownerAuthId, error: ownerErr } = await supabase.rpc('get_user_auth_id', { profile_id: owner_id });
      if (ownerErr || !ownerAuthId) throw new Error('Could not resolve item owner. Please try again.');

      let conv: { id: string } | null = null;
      if (user?.id) {
        const { data: existing } = await supabase.from('conversations')
          .select('id').eq('item_id', item_id).eq('finder_user_id', user.id).eq('resolved', false)
          .order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (existing) conv = existing;
      }

      if (!conv) {
        const { data: newConv, error: convError } = await supabase.from('conversations').insert({
          item_id, owner_id: ownerAuthId, finder_user_id: user?.id ?? null,
          finder_name: finderName.trim(), finder_phone: finderPhone.trim() || null,
          scan_lat: coords?.lat ?? null, scan_lng: coords?.lng ?? null, scan_location: locationLabel,
        }).select().single();
        if (convError || !newConv) throw convError ?? new Error('Could not create conversation');
        conv = newConv;
      }

      const { error: msgError } = await supabase.from('messages').insert({
        conversation_id: conv.id, sender_id: user?.id ?? null,
        sender_name: finderName.trim(), body: message.trim(),
      });
      if (msgError) Sentry.captureMessage(`finder-connect msg failed: ${msgError.message}`, 'warning');

      // Send location as a clickable Google Maps link in chat
      if (coords) {
        await supabase.from('messages').insert({
          conversation_id: conv.id,
          sender_id: null,
          sender_name: 'System',
          body: `📍 Location shared:\nhttps://www.google.com/maps?q=${coords.lat.toFixed(6)},${coords.lng.toFixed(6)}`,
        });
      }

      const { error: notifError } = await supabase.rpc('create_item_notification', {
        p_owner_id: ownerAuthId, p_type: 'nfc_tap',
        p_message: `${finderName.trim()} found your "${item_name}"${locationLabel ? ` near ${locationLabel}` : ''}`,
        p_metadata: { item_id, conversation_id: conv.id, finder_name: finderName.trim(), location_label: locationLabel, lat: coords?.lat, lng: coords?.lng },
      });
      if (notifError) Sentry.captureMessage(`finder-connect notif failed: ${notifError.message}`, 'warning');

      const { data: pushResult, error: pushError } = await supabase.functions.invoke('send-push-notification', {
        body: { owner_id: ownerAuthId, conversation_id: conv.id, item_id, item_name, finder_name: finderName.trim(), location_label: locationLabel },
      });

      if (pushError) Sentry.captureMessage(`push notification failed: ${pushError.message}`, 'error');

      setConversationId(conv.id);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep('sent');
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not send notification. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const stepConfig = {
    confirm: { title: 'Found Something?', emoji: '🔍', sub: `You scanned a Lost & Found tag for\n"${item_name}"` },
    location: { title: 'Share Location?', emoji: '📍', sub: 'Let the owner know where you found it' },
    contact:  { title: 'Contact Owner', emoji: '💬', sub: 'Leave your details so they can reach you' },
    sent:     { title: 'Owner Notified!', emoji: '✅', sub: 'They\'ll reach out to you shortly' },
  };
  const cfg = stepConfig[step];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#6366f1" />

      <KeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        extraScrollHeight={20}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* ── Gradient Header ── */}
        <LinearGradient
          colors={['#6366f1', '#7c3aed']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + 16 }]}
        >
          <View style={styles.hCircle1} />
          <View style={styles.hCircle2} />

          {step !== 'sent' ? (
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backBtn}>
              <Text style={styles.backBtnText}>← Back</Text>
            </TouchableOpacity>
          ) : <View style={{ height: 36 }} />}

          <Animated.View style={[styles.headerContent, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
            <View style={styles.emojiOrb}>
              <Text style={styles.emojiText}>{cfg.emoji}</Text>
            </View>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>
                {step === 'sent' ? 'COMPLETE' : `STEP ${['confirm','location','contact'].indexOf(step) + 1} OF 3`}
              </Text>
            </View>
            <Text style={styles.headerTitle}>{cfg.title}</Text>
            <Text style={styles.headerSub}>{cfg.sub}</Text>
          </Animated.View>
        </LinearGradient>

        {/* ── Body ── */}
        <View style={styles.body}>
          <Animated.View style={[{ flex: 1, paddingBottom: insets.bottom + 40 }, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>

            {/* Step 1: Confirm */}
            {step === 'confirm' && (
              <View style={styles.stepWrap}>
                <View style={styles.card}>
                  <View style={styles.confirmRow}>
                    <View style={styles.confirmIconWrap}><Text style={styles.confirmIcon}>🏷️</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.eyebrow}>Registered Item</Text>
                      <Text style={styles.confirmName}>{item_name}</Text>
                      <Text style={styles.confirmStatus}>System standing by ✓</Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity style={styles.primaryBtnWrap} onPress={() => setStep('location')} activeOpacity={0.88}>
                  <LinearGradient colors={['#6366f1', '#7c3aed']} style={styles.primaryBtn} start={{x:0,y:0}} end={{x:1,y:0}}>
                    <Text style={styles.primaryBtnText}>I Found This Item  →</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()} activeOpacity={0.7}>
                  <Text style={styles.secondaryBtnText}>Not my concern — go back</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Step 2: Location */}
            {step === 'location' && (
              <View style={styles.stepWrap}>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Why share location?</Text>
                  <Text style={styles.cardText}>
                    Your approximate location helps the owner know where to look. We never share your GPS coordinates directly — only a reverse-coded area name.
                  </Text>
                  {locationLabel && (
                    <View style={styles.locBadge}>
                      <Text style={styles.locBadgeTitle}>Location Captured</Text>
                      <Text style={styles.locBadgeText}>{locationLabel}</Text>
                    </View>
                  )}
                </View>

                {!locationLabel ? (
                  <TouchableOpacity style={[styles.primaryBtnWrap, loading && {opacity:0.7}]} onPress={captureLocation} disabled={loading} activeOpacity={0.88}>
                    <LinearGradient colors={['#6366f1', '#7c3aed']} style={styles.primaryBtn} start={{x:0,y:0}} end={{x:1,y:0}}>
                      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>📍 Allow Location & Continue</Text>}
                    </LinearGradient>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.primaryBtnWrap} onPress={() => setStep('contact')} activeOpacity={0.88}>
                    <LinearGradient colors={['#6366f1', '#7c3aed']} style={styles.primaryBtn} start={{x:0,y:0}} end={{x:1,y:0}}>
                      <Text style={styles.primaryBtnText}>Continue  →</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep('contact')} activeOpacity={0.7}>
                  <Text style={styles.secondaryBtnText}>Skip — don't share location</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Step 3: Contact */}
            {step === 'contact' && (
              <View style={styles.stepWrap}>
                <View style={[styles.card, { padding: 20 }]}>
                  
                  {/* Name */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Your Name <Text style={{color:'#e11d48'}}>*</Text></Text>
                    <View style={[styles.inputRow, focusedField === 'name' && styles.inputRowFocused]}>
                      <Text style={styles.inputIcon}>👤</Text>
                      <TextInput
                        style={styles.input} placeholder="How should they address you?" placeholderTextColor="#94a3b8"
                        value={finderName} onChangeText={setFinderName} autoCapitalize="words"
                        onFocus={() => setFocusedField('name')} onBlur={() => setFocusedField(null)}
                      />
                    </View>
                  </View>

                  {/* Phone */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Phone (Optional)</Text>
                    <View style={[styles.inputRow, focusedField === 'phone' && styles.inputRowFocused]}>
                      <Text style={styles.inputIcon}>📞</Text>
                      <TextInput
                        style={styles.input} placeholder="Your contact number" placeholderTextColor="#94a3b8"
                        value={finderPhone} onChangeText={setFinderPhone} keyboardType="phone-pad"
                        onFocus={() => setFocusedField('phone')} onBlur={() => setFocusedField(null)}
                      />
                    </View>
                    <Text style={styles.hint}>Only shared with the registered owner</Text>
                  </View>

                  {/* Message */}
                  <View style={[styles.fieldGroup, { marginBottom: 0 }]}>
                    <Text style={styles.label}>Message <Text style={{color:'#e11d48'}}>*</Text></Text>
                    <View style={[styles.inputRow, styles.inputRowMulti, focusedField === 'msg' && styles.inputRowFocused]}>
                      <TextInput
                        style={styles.inputMulti} placeholder={`e.g. "Hi! I found your ${item_name} at the metro station. Happy to help return it."`} placeholderTextColor="#94a3b8"
                        value={message} onChangeText={setMessage} multiline numberOfLines={4} textAlignVertical="top"
                        onFocus={() => setFocusedField('msg')} onBlur={() => setFocusedField(null)}
                      />
                    </View>
                  </View>
                </View>

                {locationLabel && (
                  <View style={styles.miniLocBadge}>
                    <Text style={{marginRight: 6}}>📍</Text>
                    <Text style={styles.miniLocText}>{locationLabel}</Text>
                  </View>
                )}

                <TouchableOpacity style={[styles.primaryBtnWrap, loading && {opacity:0.7}]} onPress={handleSend} disabled={loading} activeOpacity={0.88}>
                  <LinearGradient colors={['#6366f1', '#7c3aed']} style={styles.primaryBtn} start={{x:0,y:0}} end={{x:1,y:0}}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Send to Owner  🚀</Text>}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}

            {/* Step 4: Success */}
            {step === 'sent' && (
              <View style={styles.stepWrap}>
                <View style={styles.card}>
                  <View style={styles.successRow}>
                    <Text style={styles.successIcon}>🔔</Text>
                    <Text style={styles.successText}>Owner notified via push notification</Text>
                  </View>
                  <View style={styles.successRow}>
                    <Text style={styles.successIcon}>💬</Text>
                    <Text style={styles.successText}>Conversation created</Text>
                  </View>
                  {locationLabel && (
                    <View style={styles.successRow}>
                      <Text style={styles.successIcon}>📍</Text>
                      <Text style={styles.successText}>Location shared: {locationLabel}</Text>
                    </View>
                  )}
                  {finderPhone && (
                    <View style={styles.successRow}>
                      <Text style={styles.successIcon}>📞</Text>
                      <Text style={styles.successText}>Phone number shared</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.successMsg}>
                  Thank you for being a good samaritan! 🙏{'\n'}
                  The owner will contact you shortly.
                </Text>

                {user && conversationId && (
                  <TouchableOpacity style={styles.primaryBtnWrap} onPress={() => router.replace(`/conversation/${conversationId}`)} activeOpacity={0.88}>
                    <LinearGradient colors={['#6366f1', '#7c3aed']} style={styles.primaryBtn} start={{x:0,y:0}} end={{x:1,y:0}}>
                      <Text style={styles.primaryBtnText}>Open Chat  →</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.replace('/(tabs)/scan')} activeOpacity={0.7}>
                  <Text style={styles.secondaryBtnText}>Back to Scanner</Text>
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

  /* Header */
  header: { paddingHorizontal: 24, paddingBottom: 40, overflow: 'hidden', position: 'relative' },
  hCircle1: { position: 'absolute', top: -30, right: -30, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.08)' },
  hCircle2: { position: 'absolute', bottom: -10, left: -40, width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(255,255,255,0.06)' },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 8, marginBottom: 8 },
  backBtnText: { color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: '700' },
  
  headerContent: { alignItems: 'center', marginTop: 10 },
  emojiOrb: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emojiText: { fontSize: 36 },
  stepBadge: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, marginBottom: 8 },
  stepBadgeText: { color: '#ffffff', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  headerTitle: { color: '#ffffff', fontSize: 28, fontWeight: '900', letterSpacing: -0.5, marginBottom: 6 },
  headerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '500', textAlign: 'center', lineHeight: 20 },

  /* Body */
  body: { flex: 1, backgroundColor: '#f8faff', borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -24, paddingHorizontal: 20, paddingTop: 24 },
  stepWrap: { gap: 16 },

  /* Card */
  card: { backgroundColor: '#ffffff', borderRadius: 22, padding: 20, shadowColor: '#6366f1', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 3, borderWidth: 1, borderColor: '#f1f5f9' },
  confirmRow: { flexDirection: 'row', alignItems: 'center' },
  confirmIconWrap: { width: 56, height: 56, backgroundColor: '#eef2ff', borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  confirmIcon: { fontSize: 28 },
  eyebrow: { color: '#64748b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  confirmName: { color: '#0f172a', fontSize: 18, fontWeight: '800' },
  confirmStatus: { color: '#16a34a', fontSize: 13, fontWeight: '600', marginTop: 2 },

  cardTitle: { color: '#0f172a', fontSize: 16, fontWeight: '800', marginBottom: 6 },
  cardText: { color: '#64748b', fontSize: 14, lineHeight: 22, fontWeight: '500' },
  locBadge: { marginTop: 16, backgroundColor: '#eef2ff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#e0e7ff' },
  locBadgeTitle: { color: '#6366f1', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  locBadgeText: { color: '#0f172a', fontSize: 14, fontWeight: '700' },

  /* Form */
  fieldGroup: { marginBottom: 16 },
  label: { color: '#64748b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, paddingLeft: 4 },
  inputRow: { backgroundColor: '#f8faff', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  inputRowFocused: { borderColor: '#6366f1', backgroundColor: '#eef2ff' },
  inputIcon: { fontSize: 18, marginRight: 10 },
  input: { flex: 1, color: '#0f172a', fontSize: 15, fontWeight: '500', paddingVertical: 14 },
  hint: { color: '#94a3b8', fontSize: 11, fontWeight: '600', marginTop: 6, paddingLeft: 4 },
  inputRowMulti: { paddingVertical: 12, alignItems: 'flex-start' },
  inputMulti: { flex: 1, color: '#0f172a', fontSize: 15, fontWeight: '500', minHeight: 100 },
  
  miniLocBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eef2ff', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: '#e0e7ff' },
  miniLocText: { color: '#6366f1', fontSize: 13, fontWeight: '700', flex: 1 },

  /* Buttons */
  primaryBtnWrap: { borderRadius: 18, overflow: 'hidden', shadowColor: '#6366f1', shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  primaryBtn: { paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  secondaryBtn: { paddingVertical: 16, alignItems: 'center' },
  secondaryBtnText: { color: '#64748b', fontSize: 14, fontWeight: '600' },

  /* Success */
  successRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  successIcon: { fontSize: 20, marginRight: 12 },
  successText: { color: '#0f172a', fontSize: 14, fontWeight: '700', flex: 1 },
  successMsg: { color: '#64748b', textAlign: 'center', fontSize: 14, lineHeight: 22, fontWeight: '500', marginVertical: 8 },
});

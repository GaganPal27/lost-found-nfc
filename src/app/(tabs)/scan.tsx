import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Alert, ActivityIndicator,
  Animated, Easing, StatusBar, ScrollView, StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { readAnyTag } from '../../lib/nfc';
import { scanForNearbyBeacons } from '../../lib/ble';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';

type ScanMode = 'nfc' | 'qr';
type BLEResult = {
  name: string; rssi: number; serviceUUID?: string;
  item?: { id: string; item_name: string; user_id: string } | null;
};

export default function ScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const [mode, setMode]           = useState<ScanMode>('nfc');
  const [scanning, setScanning]   = useState(false);
  const [bleResults, setBleResults]             = useState<BLEResult[]>([]);
  const [qrScanned, setQrScanned]               = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // ── Pulse rings ──────────────────────────────────────────────────────────
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;

  const startPulse = () => {
    const loop = (a: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(a, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(a, { toValue: 0, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]));
    Animated.parallel([loop(ring1, 0), loop(ring2, 350), loop(ring3, 700)]).start();
  };
  const stopPulse = () => { [ring1, ring2, ring3].forEach(r => { r.stopAnimation(); r.setValue(0); }); };
  useEffect(() => () => stopPulse(), []);

  const ringOp    = (a: Animated.Value) => a.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.55] });
  const ringScale = (a: Animated.Value, max: number) => a.interpolate({ inputRange: [0, 1], outputRange: [1, max] });

  // ── NFC ──────────────────────────────────────────────────────────────────
  const handleNFCScan = async () => {
    setScanning(true); startPulse();
    try {
      const { url, hardwareId } = await readAnyTag();
      const lookupByUid = async (uid: string) => {
        const { data } = await supabase.from('items').select('id,item_name,user_id,status').eq('nfc_uid', uid).neq('status', 'deleted').maybeSingle();
        return data;
      };
      let item = null;
      if (url) {
        const m = url.match(/[?&]id=([a-zA-Z0-9-]+)/) || url.match(/\/item\/([a-zA-Z0-9-]+)/) || url.match(/\/i\/([a-zA-Z0-9-]+)/);
        if (m?.[1]) item = await lookupByUid(m[1]);
      }
      if (!item && hardwareId) item = await lookupByUid(hardwareId);
      if (item) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const { data: ownerAuthId } = await supabase.rpc('get_user_auth_id', { profile_id: item.user_id });
        router.push({ pathname: '/finder-connect', params: { item_id: item.id, owner_id: ownerAuthId ?? item.user_id, item_name: item.item_name, nfc_uid: hardwareId || url } });
      } else {
        Alert.alert('Not Registered', 'This tag is not in the Lost & Found Network.');
      }
    } catch {
      Alert.alert('Scan Failed', 'Could not read tag. Hold steady and try again.');
    } finally { setScanning(false); stopPulse(); }
  };

  // ── QR ───────────────────────────────────────────────────────────────────
  const handleQRScanned = async ({ data }: { data: string }) => {
    if (qrScanned) return;
    setQrScanned(true);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const m = data.match(/[?&]id=([a-zA-Z0-9-]+)/) || data.match(/\/item\/([a-zA-Z0-9-]+)/) || data.match(/\/i\/([a-zA-Z0-9-]+)/);
    if (m?.[1]) {
      const { data: item } = await supabase.from('items').select('id,item_name,user_id,status,owner:users(auth_id)').eq('nfc_uid', m[1]).neq('status', 'deleted').maybeSingle();
      if (item) {
        router.push({ pathname: '/finder-connect', params: { item_id: item.id, owner_id: (item.owner as any)?.auth_id ?? item.user_id, item_name: item.item_name, nfc_uid: m[1] } });
        return;
      }
    }
    Alert.alert('Not Registered', 'This QR code is not in the Lost & Found Network.', [{ text: 'OK', onPress: () => setQrScanned(false) }]);
  };

  const rssiToStrength = (rssi: number) => {
    if (rssi > -60) return { label: 'Very Close', color: '#22c55e' };
    if (rssi > -75) return { label: 'Near',       color: '#eab308' };
    return               { label: 'Far',         color: '#ef4444' };
  };

  const MODES: { key: ScanMode; label: string; icon: string }[] = [
    { key: 'nfc', label: 'NFC Tag', icon: '📱' },
    { key: 'qr',  label: 'QR Code', icon: '📸' },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#6366f1" />

      {/* ── Gradient Header ── */}
      <LinearGradient
        colors={['#6366f1', '#7c3aed']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.hCircle1} />
        <View style={styles.hCircle2} />
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerEyebrow}>Universal Scanner</Text>
            <Text style={styles.headerTitle}>Found something?</Text>
          </View>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>📡 Live</Text>
          </View>
        </View>

        {/* Mode switcher — inside gradient */}
        <View style={styles.modeBar}>
          {MODES.map(m => (
            <TouchableOpacity
              key={m.key}
              onPress={() => { setMode(m.key); setScanning(false); setBleResults([]); setQrScanned(false); stopPulse(); }}
              activeOpacity={0.8}
              style={[styles.modeBtn, mode === m.key && styles.modeBtnActive]}
            >
              <Text style={styles.modeBtnIcon}>{m.icon}</Text>
              <Text style={[styles.modeBtnText, mode === m.key && styles.modeBtnTextActive]}>
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      {/* ── Body ── */}
      <View style={styles.body}>

        {/* ── NFC Mode ── */}
        {mode === 'nfc' && (
          <View style={styles.scanCenter}>
            {/* Pulse rings */}
            <View style={styles.ringsWrap}>
              {[
                { a: ring3, s: 1.18, w: 230 },
                { a: ring2, s: 1.14, w: 175 },
                { a: ring1, s: 1.10, w: 124 },
              ].map(({ a, s, w }, i) => (
                <Animated.View
                  key={i}
                  style={[
                    styles.ring,
                    { width: w, height: w, borderRadius: w / 2,
                      borderColor: scanning ? '#6366f1' : '#c7d2fe',
                      opacity: ringOp(a), transform: [{ scale: ringScale(a, s) }] },
                  ]}
                />
              ))}
              {/* Centre button */}
              <TouchableOpacity
                onPress={scanning ? () => { setScanning(false); stopPulse(); } : handleNFCScan}
                activeOpacity={0.88}
                style={{ borderRadius: 60, overflow: 'hidden' }}
              >
                <LinearGradient
                  colors={scanning ? ['#818cf8', '#a78bfa'] : ['#6366f1', '#7c3aed']}
                  style={styles.scanOrb}
                >
                  <Text style={styles.scanOrbEmoji}>📱</Text>
                  <Text style={styles.scanOrbLabel}>
                    {scanning ? 'Hold near tag...' : 'Tap to Scan'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <Text style={styles.scanTitle}>
              {scanning ? 'Scanning for NFC tag…' : 'Tap any NFC tag or card'}
            </Text>
            <Text style={styles.scanSub}>
              {scanning
                ? 'Hold your phone flat against the tag.\nDon\'t move until it vibrates.'
                : 'Supports NFC tags, linked cards,\nand NFC stickers.'}
            </Text>

            {/* Status pills */}
            <View style={styles.pillRow}>
              <View style={[styles.pill, { borderColor: '#bbf7d0' }]}>
                <View style={styles.pillDot} />
                <Text style={styles.pillText}>NFC Ready</Text>
              </View>
              <View style={[styles.pill, { borderColor: '#e0e7ff' }]}>
                <Text style={styles.pillText}>💳 Cards Supported</Text>
              </View>
            </View>
          </View>
        )}

        {/* ── QR Mode ── */}
        {mode === 'qr' && (
          <View style={styles.qrWrap}>
            {!cameraPermission?.granted ? (
              <View style={styles.permissionBox}>
                <View style={styles.permissionIcon}>
                  <Text style={{ fontSize: 40 }}>📸</Text>
                </View>
                <Text style={styles.permissionTitle}>Camera Access Required</Text>
                <Text style={styles.permissionSub}>
                  We need camera access to scan QR codes on Lost & Found items.
                </Text>
                <TouchableOpacity
                  onPress={requestCameraPermission}
                  activeOpacity={0.88}
                  style={{ borderRadius: 16, overflow: 'hidden', width: '100%' }}
                >
                  <LinearGradient colors={['#6366f1', '#7c3aed']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.permissionBtn}>
                    <Text style={styles.permissionBtnText}>Grant Camera Access</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ flex: 1 }}>
                <CameraView
                  style={{ flex: 1 }}
                  facing="back"
                  onBarcodeScanned={qrScanned ? undefined : handleQRScanned}
                  barcodeScannerSettings={{ barcodeTypes: ['qr', 'pdf417', 'code128', 'code39'] }}
                >
                  <View style={styles.qrOverlay}>
                    {/* Finder frame */}
                    <View style={styles.qrFrame}>
                      {[
                        { top: -2, left: -2 }, { top: -2, right: -2 },
                        { bottom: -2, left: -2 }, { bottom: -2, right: -2 },
                      ].map((s, i) => (
                        <View key={i} style={[styles.qrCorner, s as any]} />
                      ))}
                    </View>
                    <View style={styles.qrHint}>
                      <Text style={styles.qrHintText}>Point camera at a QR code</Text>
                    </View>
                  </View>
                </CameraView>
                {qrScanned && (
                  <View style={styles.qrRescanWrap}>
                    <TouchableOpacity style={styles.qrRescanBtn} onPress={() => setQrScanned(false)} activeOpacity={0.7}>
                      <Text style={styles.qrRescanText}>Tap to Scan Again</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8faff' },

  /* ── Header ── */
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  hCircle1: { position: 'absolute', top: -30, right: -30, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.08)' },
  hCircle2: { position: 'absolute', bottom: -20, left: -40, width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(255,255,255,0.06)' },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  headerEyebrow: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2 },
  headerTitle:   { color: '#ffffff', fontSize: 24, fontWeight: '900', letterSpacing: -0.3 },
  headerBadge:   { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  headerBadgeText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },

  /* Mode switcher */
  modeBar: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: 4, gap: 4 },
  modeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 13, gap: 6 },
  modeBtnActive: { backgroundColor: '#ffffff' },
  modeBtnIcon:   { fontSize: 16 },
  modeBtnText:   { color: 'rgba(255,255,255,0.8)', fontWeight: '700', fontSize: 14 },
  modeBtnTextActive: { color: '#6366f1' },

  /* ── Body ── */
  body: {
    flex: 1,
    backgroundColor: '#f8faff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -16,
  },

  /* NFC scan area */
  scanCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingBottom: 130 },
  ringsWrap:  { width: 280, height: 280, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  ring: { position: 'absolute', borderWidth: 1.5 },
  scanOrb: {
    width: 120, height: 120, borderRadius: 60,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#6366f1', shadowOpacity: 0.4, shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 }, elevation: 10,
  },
  scanOrbEmoji: { fontSize: 36, marginBottom: 2 },
  scanOrbLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },

  scanTitle: { color: '#0f172a', fontSize: 20, fontWeight: '900', textAlign: 'center', marginBottom: 8 },
  scanSub:   { color: '#64748b', fontSize: 14, fontWeight: '500', textAlign: 'center', lineHeight: 21, marginBottom: 24 },

  pillRow: { flexDirection: 'row', gap: 10 },
  pill:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderWidth: 1, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6, gap: 6 },
  pillDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22c55e' },
  pillText: { color: '#475569', fontSize: 12, fontWeight: '700' },

  /* QR */
  qrWrap: { flex: 1 },
  permissionBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 130 },
  permissionIcon: { width: 90, height: 90, borderRadius: 28, backgroundColor: '#eef2ff', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  permissionTitle: { color: '#0f172a', fontSize: 20, fontWeight: '900', textAlign: 'center', marginBottom: 8 },
  permissionSub:   { color: '#64748b', fontSize: 14, fontWeight: '500', textAlign: 'center', lineHeight: 21, marginBottom: 28 },
  permissionBtn:   { paddingVertical: 16, alignItems: 'center', borderRadius: 16 },
  permissionBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  qrOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  qrFrame:   { width: 240, height: 240, borderColor: '#6366f1', borderWidth: 2.5, borderRadius: 18, backgroundColor: 'transparent' },
  qrCorner:  { position: 'absolute', width: 26, height: 26, borderColor: '#7c3aed', borderWidth: 3.5 },
  qrHint:    { marginTop: 20, backgroundColor: 'rgba(15,23,42,0.65)', borderRadius: 16, paddingHorizontal: 20, paddingVertical: 10 },
  qrHintText: { color: '#ffffff', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  qrRescanWrap: { position: 'absolute', bottom: 32, left: 24, right: 24 },
  qrRescanBtn: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  qrRescanText: { color: '#0f172a', fontWeight: '700', fontSize: 15 },
});

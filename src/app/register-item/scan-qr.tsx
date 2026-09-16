import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Animated, Keyboard,
  StatusBar,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';

type ScreenState = 'scanning' | 'manual' | 'verifying' | 'error';

// Regex that matches our tag format: KEEP- followed by exactly 8 chars
// from the unambiguous charset (no 0/O/1/I/L).
const QR_REGEX = /^KEEP-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/;

/** Extract qr_id from a full URL or a bare code typed manually. */
function extractQrId(raw: string): string | null {
  const trimmed = raw.trim().toUpperCase();
  // Bare code (e.g. KEEP-AB2C3D4E)
  if (QR_REGEX.test(trimmed)) return trimmed;
  // Full URL (e.g. https://keepr.dpdns.org/i/KEEP-AB2C3D4E)
  const match = trimmed.match(/\/I\/(KEEP-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8})$/);
  if (match) return match[1];
  return null;
}

export default function ScanQrScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();

  const [screenState, setScreenState] = useState<ScreenState>('scanning');
  const [manualCode, setManualCode]   = useState('');
  const [errorMsg, setErrorMsg]       = useState('');
  const [scanned, setScanned]         = useState(false);  // debounce repeat scans

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, []);

  // ── Shake animation for error feedback ──────────────────────────────────────
  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 60, useNativeDriver: true }),
    ]).start();
  };

  // ── Validate a QR/code against the database ──────────────────────────────────
  const verify = async (rawValue: string) => {
    const qrId = extractQrId(rawValue);

    if (!qrId) {
      setErrorMsg('Unrecognised tag — make sure you\'re scanning a Keepr tag.');
      setScreenState('error');
      shake();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setScanned(false);
      return;
    }

    setScreenState('verifying');

    const { data, error } = await supabase
      .from('tags_pool')
      .select('qr_id, status')
      .eq('qr_id', qrId)
      .maybeSingle();

    if (error || !data) {
      setErrorMsg('This tag isn\'t in our system. It may be counterfeit or misprinted.');
      setScreenState('error');
      shake();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setScanned(false);
      return;
    }

    if (data.status !== 'unclaimed') {
      setErrorMsg('This tag is already registered to another item. If this is your tag, contact support.');
      setScreenState('error');
      shake();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setScanned(false);
      return;
    }

    // Valid unclaimed tag — proceed to item details
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.push({
      pathname: '/register-item',
      params: { qr_id: qrId },
    });
  };

  // ── Camera scan handler ──────────────────────────────────────────────────────
  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || screenState === 'verifying') return;
    setScanned(true);
    Keyboard.dismiss();
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await verify(data);
  };

  // ── Manual submit ────────────────────────────────────────────────────────────
  const handleManualSubmit = async () => {
    if (!manualCode.trim() || screenState === 'verifying') return;
    Keyboard.dismiss();
    await verify(manualCode);
  };

  const resetToScanner = () => {
    setErrorMsg('');
    setManualCode('');
    setScanned(false);
    setScreenState('scanning');
  };

  // ── Camera permission not yet granted ────────────────────────────────────────
  if (!permission) {
    return (
      <View style={styles.permCenter}>
        <ActivityIndicator color="#6366f1" size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.permCenter, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.permTitle}>Camera Access Needed</Text>
        <Text style={styles.permBody}>
          We need camera access to scan your Keepr tag's QR code.
        </Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission} activeOpacity={0.85}>
          <Text style={styles.permBtnText}>Allow Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.manualLink}
          onPress={() => setScreenState('manual')}
          activeOpacity={0.7}
        >
          <Text style={styles.manualLinkText}>Type code instead →</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.root, { opacity: fadeAnim }]}>
      <StatusBar barStyle="light-content" backgroundColor="#6366f1" />

      {/* ── Header ── */}
      <LinearGradient
        colors={['#6366f1', '#7c3aed']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={20} color="rgba(255,255,255,0.9)" />
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerEye}>STEP 1 OF 3</Text>
        <Text style={styles.headerTitle}>Scan Your Tag</Text>
        <Text style={styles.headerSub}>
          Point the camera at the QR code on your Keepr tag.
        </Text>
      </LinearGradient>

      {/* ── Body ── */}
      <View style={styles.body}>

        {/* ── Camera / Verifying / Error ── */}
        {screenState !== 'manual' && (
          <View style={styles.cameraWrap}>
            {screenState === 'scanning' && (
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={handleBarCodeScanned}
              />
            )}

            {/* Overlay frame */}
            {screenState === 'scanning' && (
              <View style={styles.overlay}>
                <View style={styles.scanFrame}>
                  {/* Corner accents */}
                  <View style={[styles.corner, styles.cornerTL]} />
                  <View style={[styles.corner, styles.cornerTR]} />
                  <View style={[styles.corner, styles.cornerBL]} />
                  <View style={[styles.corner, styles.cornerBR]} />
                </View>
                <Text style={styles.overlayHint}>Align QR code within the frame</Text>
              </View>
            )}

            {screenState === 'verifying' && (
              <View style={styles.verifyOverlay}>
                <ActivityIndicator size="large" color="#6366f1" />
                <Text style={styles.verifyText}>Verifying tag…</Text>
              </View>
            )}

            {screenState === 'error' && (
              <Animated.View
                style={[styles.errorOverlay, { transform: [{ translateX: shakeAnim }] }]}
              >
                <View style={styles.errorIconWrap}>
                  <Feather name="x-circle" size={44} color="#e11d48" />
                </View>
                <Text style={styles.errorTitle}>Tag not valid</Text>
                <Text style={styles.errorBody}>{errorMsg}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={resetToScanner} activeOpacity={0.85}>
                  <Text style={styles.retryBtnText}>Try Again</Text>
                </TouchableOpacity>
              </Animated.View>
            )}
          </View>
        )}

        {/* ── Manual entry mode ── */}
        {screenState === 'manual' && (
          <View style={styles.manualWrap}>
            <Feather name="tag" size={40} color="#6366f1" style={{ marginBottom: 16 }} />
            <Text style={styles.manualTitle}>Enter Tag Code</Text>
            <Text style={styles.manualBody}>
              Type the code printed on your tag.{'\n'}Format: <Text style={styles.mono}>KEEP-XXXXXXXX</Text>
            </Text>

            <View style={styles.codeInputWrap}>
              <TextInput
                style={styles.codeInput}
                placeholder="KEEP-AB2C3D4E"
                placeholderTextColor="#94a3b8"
                value={manualCode}
                onChangeText={(t) => {
                  setManualCode(t.toUpperCase());
                  if (errorMsg) setErrorMsg('');
                }}
                autoCapitalize="characters"
                autoCorrect={false}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleManualSubmit}
                maxLength={13}  // 'KEEP-' (5) + 8 chars
              />
            </View>

            {errorMsg ? (
              <Animated.Text style={[styles.inlineError, { transform: [{ translateX: shakeAnim }] }]}>
                {errorMsg}
              </Animated.Text>
            ) : null}

            <TouchableOpacity
              style={[styles.submitBtn, !manualCode.trim() && styles.submitBtnDisabled]}
              onPress={handleManualSubmit}
              activeOpacity={0.85}
              disabled={!manualCode.trim() || screenState === 'verifying'}
            >
              {screenState === 'verifying'
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.submitBtnText}>Verify Tag →</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity onPress={resetToScanner} activeOpacity={0.7} style={styles.backToScanBtn}>
              <Feather name="camera" size={15} color="#6366f1" />
              <Text style={styles.backToScanText}>Use camera instead</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Toggle: camera ↔ manual (only visible in scanning/error state) ── */}
        {(screenState === 'scanning' || screenState === 'error') && (
          <TouchableOpacity
            style={styles.manualToggle}
            onPress={() => { setErrorMsg(''); setScreenState('manual'); }}
            activeOpacity={0.7}
          >
            <Feather name="edit-2" size={14} color="#6366f1" />
            <Text style={styles.manualToggleText}>QR scratched? Type code manually</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#f8faff' },
  permCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#f8faff' },
  permTitle:  { fontSize: 22, fontWeight: '800', color: '#0f172a', marginBottom: 12, textAlign: 'center' },
  permBody:   { fontSize: 15, color: '#64748b', textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  permBtn:    { backgroundColor: '#6366f1', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 40 },
  permBtnText:{ color: '#fff', fontWeight: '800', fontSize: 16 },
  manualLink: { marginTop: 20 },
  manualLinkText: { color: '#6366f1', fontWeight: '700', fontSize: 15 },

  header: { paddingHorizontal: 24, paddingBottom: 28, overflow: 'hidden' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16, alignSelf: 'flex-start' },
  backBtnText: { color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: '700' },
  headerEye: { color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 },
  headerTitle: { color: '#fff', fontSize: 30, fontWeight: '900', letterSpacing: -0.5, marginBottom: 6 },
  headerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: '500', lineHeight: 20 },

  body: { flex: 1, backgroundColor: '#f8faff', borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -20, overflow: 'hidden' },

  // Camera
  cameraWrap: { flex: 1, margin: 20, borderRadius: 24, overflow: 'hidden', backgroundColor: '#0f172a' },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  scanFrame: { width: 220, height: 220, position: 'relative' },
  corner: { position: 'absolute', width: 28, height: 28, borderColor: '#6366f1', borderWidth: 3 },
  cornerTL: { top: 0, left: 0,  borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 4 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0,  borderBottomWidth: 0, borderTopRightRadius: 4 },
  cornerBL: { bottom: 0, left: 0,  borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 4 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0,  borderTopWidth: 0, borderBottomRightRadius: 4 },
  overlayHint: { marginTop: 24, color: 'rgba(255,255,255,0.8)', fontWeight: '600', fontSize: 13 },

  verifyOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(248,250,255,0.97)', alignItems: 'center', justifyContent: 'center', gap: 14 },
  verifyText: { color: '#475569', fontWeight: '700', fontSize: 16 },

  errorOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(248,250,255,0.97)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  errorIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#fff1f2', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  errorTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginBottom: 8 },
  errorBody:  { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  retryBtn:   { backgroundColor: '#6366f1', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 36 },
  retryBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  // Manual
  manualWrap: { flex: 1, padding: 28, alignItems: 'center', justifyContent: 'center' },
  manualTitle: { fontSize: 24, fontWeight: '800', color: '#0f172a', marginBottom: 8, textAlign: 'center' },
  manualBody: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 21, marginBottom: 28 },
  mono: { fontFamily: 'monospace', color: '#6366f1' },
  codeInputWrap: { width: '100%', marginBottom: 8 },
  codeInput: {
    width: '100%', backgroundColor: '#fff', borderWidth: 2, borderColor: '#e2e8f0',
    borderRadius: 16, paddingHorizontal: 20, paddingVertical: 16,
    fontSize: 18, fontWeight: '700', letterSpacing: 2, color: '#0f172a',
    textAlign: 'center', fontFamily: 'monospace',
  },
  inlineError: { color: '#e11d48', fontSize: 13, fontWeight: '600', textAlign: 'center', marginBottom: 16, marginTop: 4 },
  submitBtn: { width: '100%', backgroundColor: '#6366f1', borderRadius: 16, paddingVertical: 17, alignItems: 'center', marginTop: 8, marginBottom: 18 },
  submitBtnDisabled: { opacity: 0.45 },
  submitBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  backToScanBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backToScanText: { color: '#6366f1', fontWeight: '700', fontSize: 14 },

  manualToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 16 },
  manualToggleText: { color: '#6366f1', fontWeight: '600', fontSize: 13 },
});

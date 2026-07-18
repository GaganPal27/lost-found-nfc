import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Alert, ActivityIndicator,
  Animated, Easing, StatusBar, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { readAnyTag } from '../../lib/nfc';
import { scanForNearbyBeacons } from '../../lib/ble';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';

type ScanMode = 'nfc' | 'ble' | 'qr';
type BLEResult = { name: string; rssi: number; serviceUUID?: string; item?: { id: string; item_name: string; user_id: string } | null };

export default function ScanScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [mode, setMode] = useState<ScanMode>('nfc');
  const [scanning, setScanning] = useState(false);
  const [bleResults, setBleResults] = useState<BLEResult[]>([]);
  const [qrScanned, setQrScanned] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;

  const startPulse = () => {
    const loop = (a: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(a, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(a, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]));
    Animated.parallel([loop(ring1, 0), loop(ring2, 300), loop(ring3, 600)]).start();
  };

  const stopPulse = () => {
    [ring1, ring2, ring3].forEach(r => { r.stopAnimation(); r.setValue(0); });
  };

  useEffect(() => { return () => stopPulse(); }, []);

  const ringOp = (a: Animated.Value) => a.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.7] });
  const ringScale = (a: Animated.Value, max: number) => a.interpolate({ inputRange: [0, 1], outputRange: [1, max] });

  // ── NFC ───────────────────────────────────────────────────────────────────
  const handleNFCScan = async () => {
    setScanning(true);
    startPulse();
    try {
      const { url, hardwareId } = await readAnyTag();
      const lookupByUid = async (uid: string) => {
        const { data } = await supabase.from('items').select('id,item_name,user_id,status').eq('nfc_uid', uid).neq('status', 'deleted').maybeSingle();
        return data;
      };
      let item = null;
      if (url) {
        // Match both old format (/item/UUID) and new edge function format (?id=UUID)
        const m = url.match(/[?&]id=([a-zA-Z0-9-]+)/) || url.match(/\/item\/([a-zA-Z0-9-]+)/) || url.match(/\/i\/([a-zA-Z0-9-]+)/);
        if (m?.[1]) item = await lookupByUid(m[1]);
      }
      if (!item && hardwareId) item = await lookupByUid(hardwareId);
      if (item) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.push({ pathname: '/finder-connect', params: { item_id: item.id, owner_id: item.user_id, item_name: item.item_name, nfc_uid: hardwareId || url } });
      } else {
        Alert.alert('Not Registered', 'This tag is not in the Lost & Found Network.');
      }
    } catch {
      Alert.alert('Scan Failed', 'Could not read tag. Hold steady and try again.');
    } finally {
      setScanning(false);
      stopPulse();
    }
  };

  // ── BLE ───────────────────────────────────────────────────────────────────
  const handleBLEScan = useCallback(async () => {
    setScanning(true);
    startPulse();
    setBleResults([]);
    const found: BLEResult[] = [];

    try {
      // Sprint 1: fetch this user's registered service_uuids for UUID-based matching
      let knownServiceUUIDs: string[] = [];
      if (user?.id) {
        const { data: userItems } = await supabase
          .from('items')
          .select('service_uuid')
          .eq('user_id', user.id)
          .not('service_uuid', 'is', null);
        knownServiceUUIDs = (userItems ?? []).map((i: any) => i.service_uuid).filter(Boolean);
      }

      const result = await scanForNearbyBeacons(
        (device) => {
          found.push({ name: device.name, rssi: device.rssi, serviceUUID: device.serviceUUID });
          setBleResults([...found]);
        },
        8000,
        knownServiceUUIDs, // pass known UUIDs for service UUID matching
      );

      if (result?.permissionDenied) {
        Alert.alert(
          'Bluetooth Permission Required',
          'Please enable Bluetooth & "Nearby Devices" permission in your phone Settings to scan for beacons.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Enrich with DB items — match by beacon name OR service_uuid
      const enriched = await Promise.all(found.map(async (d) => {
        // Try name match first
        let { data } = await supabase
          .from('items')
          .select('id,item_name,user_id')
          .eq('ble_beacon_id', d.name)
          .neq('status', 'deleted')
          .maybeSingle();
        return { ...d, item: data };
      }));
      setBleResults(enriched);

      // Relay location for all found beacons
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const edgeUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ble-location-relay`;
          const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
          for (const d of enriched) {
            fetch(edgeUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` },
              body: JSON.stringify({ beacon_id: d.name, lat: loc.coords.latitude, lng: loc.coords.longitude, accuracy_metres: loc.coords.accuracy, source: 'app_relay' }),
            }).catch(() => {});
          }
        }
      } catch { /* location optional */ }

      if (found.length === 0) Alert.alert('No Beacons', 'No Poki beacons detected nearby. Make sure your beacon is powered on.');
      else await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setScanning(false);
      stopPulse();
    }
  }, [user]);

  // ── QR ────────────────────────────────────────────────────────────────────
  const handleQRScanned = async ({ data }: { data: string }) => {
    if (qrScanned) return;
    setQrScanned(true);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Match both old format (/item/UUID) and new edge function format (?id=UUID or /i/UUID)
    const m = data.match(/[?&]id=([a-zA-Z0-9-]+)/) || data.match(/\/item\/([a-zA-Z0-9-]+)/) || data.match(/\/i\/([a-zA-Z0-9-]+)/);
    if (m?.[1]) {
      const { data: item } = await supabase.from('items').select('id,item_name,user_id,status').eq('nfc_uid', m[1]).neq('status', 'deleted').maybeSingle();
      if (item) {
        router.push({ pathname: '/finder-connect', params: { item_id: item.id, owner_id: item.user_id, item_name: item.item_name, nfc_uid: m[1] } });
        return;
      }
    }
    Alert.alert('Not Registered', 'This QR code is not in the Lost & Found Network.', [{ text: 'OK', onPress: () => setQrScanned(false) }]);
  };

  const MODES: { key: ScanMode; label: string; icon: string }[] = [
    { key: 'nfc', label: 'NFC', icon: '📱' },
    { key: 'qr',  label: 'QR',  icon: '📸' },
  ];

  const rssiToStrength = (rssi: number) => {
    if (rssi > -60) return { label: 'Very Close', color: '#22c55e' };
    if (rssi > -75) return { label: 'Near',       color: '#eab308' };
    return             { label: 'Far',         color: '#ef4444' };
  };

  return (
    <View className="flex-1 bg-slate-50">
      <StatusBar barStyle="dark-content" />

      {/* Mode Selector */}
      <View className="pt-14 px-6 pb-4">
        <Text className="text-slate-500 text-xs uppercase tracking-widest mb-1 font-bold">Universal Scanner</Text>
        <Text className="text-slate-900 text-2xl font-black mb-4">Found something?</Text>
        <View className="flex-row bg-white border border-slate-200 rounded-2xl p-1 shadow-sm">
          {MODES.map(m => (
            <TouchableOpacity
              key={m.key}
              onPress={() => { setMode(m.key); setScanning(false); setBleResults([]); setQrScanned(false); stopPulse(); }}
              className={`flex-1 py-2.5 rounded-xl flex-row items-center justify-center gap-1 ${mode === m.key ? 'bg-primary' : ''}`}
              activeOpacity={0.7}
            >
              <Text className="text-base">{m.icon}</Text>
              <Text className={`font-bold text-sm ${mode === m.key ? 'text-white' : 'text-slate-500'}`}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── NFC Mode ─────────────────────────────────────────────────────── */}
      {mode === 'nfc' && (
        <View className="flex-1 items-center justify-center px-6 pb-[140px]">
          <View style={{ width: 260, height: 260, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
            {[{ a: ring3, s: 1.15, w: 220 }, { a: ring2, s: 1.12, w: 170 }, { a: ring1, s: 1.1, w: 120 }].map(({ a, s, w }, i) => (
              <Animated.View key={i} style={{ position: 'absolute', width: w, height: w, borderRadius: w / 2, borderWidth: 1.5, borderColor: '#e11d48', opacity: ringOp(a), transform: [{ scale: ringScale(a, s) }] }} />
            ))}
            <View className="w-28 h-28 bg-white rounded-full items-center justify-center border-2 border-slate-200" style={{ shadowColor: '#e11d48', shadowOpacity: scanning ? 0.3 : 0.05, shadowRadius: 20, elevation: 6 }}>
              <Text className="text-5xl">📱</Text>
            </View>
          </View>
          <Text className="text-slate-900 text-xl font-bold text-center mb-2">{scanning ? 'Scanning NFC...' : 'Tap any NFC tag or card'}</Text>
          <Text className="text-slate-500 text-sm text-center mb-8 leading-5 font-medium">Supports programmed tags, linked cards,{'\n'}and NFC stickers.</Text>
          {!scanning
            ? <TouchableOpacity className="w-full bg-primary py-4 rounded-2xl items-center" style={{ shadowColor: '#e11d48', shadowOpacity: 0.4, shadowRadius: 16, elevation: 6 }} onPress={handleNFCScan} activeOpacity={0.85}><Text className="text-white font-bold text-lg">Scan NFC Tag →</Text></TouchableOpacity>
            : <TouchableOpacity className="border border-slate-300 py-3 px-10 rounded-2xl bg-white" onPress={() => { setScanning(false); stopPulse(); }} activeOpacity={0.7}><Text className="text-slate-500 font-semibold">Cancel</Text></TouchableOpacity>
          }
          <View className="flex-row mt-6 gap-3">
            <View className="bg-white border border-slate-200 px-4 py-2 rounded-full flex-row items-center shadow-sm"><View className="w-2 h-2 rounded-full bg-green-500 mr-2" /><Text className="text-slate-600 text-xs font-bold">NFC Ready</Text></View>
            <View className="bg-white border border-slate-200 px-4 py-2 rounded-full shadow-sm"><Text className="text-slate-600 text-xs font-bold">Cards Supported 💳</Text></View>
          </View>
        </View>
      )}

      {/* ── BLE Mode ─────────────────────────────────────────────────────── */}
      {mode === 'ble' && (
        bleResults.length > 0 ? (
          // Results view — scrollable
          <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 140 }}>
            <View className="mt-2">
              <Text className="text-slate-500 text-xs uppercase tracking-wider mb-3 font-bold">{bleResults.length} Beacon{bleResults.length > 1 ? 's' : ''} Detected</Text>
              {bleResults.map((d, i) => {
                const sig = rssiToStrength(d.rssi);
                const isKnown = !!d.item;
                return (
                  <TouchableOpacity
                    key={i}
                    activeOpacity={isKnown ? 0.8 : 1}
                    onPress={() => {
                      if (isKnown && d.item) router.push({ pathname: '/finder-connect', params: { item_id: d.item.id, owner_id: d.item.user_id, item_name: d.item.item_name } });
                    }}
                    className={`bg-white border rounded-2xl p-4 mb-3 shadow-sm ${isKnown ? 'border-primary/50' : 'border-slate-200'}`}
                  >
                    <View className="flex-row items-center justify-between mb-2">
                      <View className="flex-row items-center">
                        <Text className="text-2xl mr-3">{isKnown ? '🎯' : '📡'}</Text>
                        <View>
                          <Text className="text-slate-900 font-bold text-base">{d.name}</Text>
                          <View className="flex-row items-center mt-0.5">
                            <Text className="text-slate-500 text-xs font-medium mr-2">RSSI: {d.rssi} dBm</Text>
                            {d.serviceUUID && (
                              <Text className="text-slate-400 text-[10px] font-mono">UUID: {d.serviceUUID.split('-')[0]}...</Text>
                            )}
                          </View>
                        </View>
                      </View>
                      <View className="items-end">
                        <View className="px-2 py-1 rounded-full mb-1" style={{ backgroundColor: sig.color + '22' }}>
                          <Text className="text-xs font-bold" style={{ color: sig.color }}>{sig.label}</Text>
                        </View>
                        {isKnown && <View className="bg-primary/10 px-2 py-0.5 rounded-full"><Text className="text-primary text-[10px] font-bold">REGISTERED ✓</Text></View>}
                      </View>
                    </View>
                    {isKnown && d.item && (
                      <View className="bg-slate-50 rounded-xl px-3 py-2 flex-row justify-between items-center border border-slate-200 mt-2">
                        <Text className="text-slate-700 text-sm font-bold">🏷 {d.item.item_name}</Text>
                        <Text className="text-primary text-xs font-bold">Tap to Connect →</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity className="w-full border border-slate-300 bg-white shadow-sm py-3 rounded-2xl items-center mt-2" onPress={() => { setBleResults([]); setScanning(false); }} activeOpacity={0.7}>
                <Text className="text-slate-600 font-bold">Scan Again</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : (
          // Idle or scanning — same layout as NFC
          <View className="flex-1 items-center justify-center px-6 pb-[140px]">
            <View style={{ width: 260, height: 260, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
              {[{ a: ring3, s: 1.15, w: 220 }, { a: ring2, s: 1.12, w: 170 }, { a: ring1, s: 1.1, w: 120 }].map(({ a, s, w }, i) => (
                <Animated.View key={i} style={{ position: 'absolute', width: w, height: w, borderRadius: w / 2, borderWidth: 1.5, borderColor: '#6366f1', opacity: ringOp(a), transform: [{ scale: ringScale(a, s) }] }} />
              ))}
              <View className="w-28 h-28 bg-white rounded-full items-center justify-center border-2 border-slate-200" style={{ shadowColor: '#6366f1', shadowOpacity: scanning ? 0.3 : 0.05, shadowRadius: 20, elevation: 6 }}>
                <Text className="text-5xl">📡</Text>
              </View>
            </View>
            <Text className="text-slate-900 text-xl font-bold text-center mb-2">
              {scanning ? 'Scanning for beacons...' : 'Scan for BLE Beacons'}
            </Text>
            <Text className="text-slate-500 text-sm text-center mb-8 leading-5 font-medium">
              {scanning
                ? `Finding nearby Lost & Found beacons${bleResults.length > 0 ? ` · ${bleResults.length} found` : ''}`
                : 'Detects nearby Lost & Found beacons\nand updates their location automatically.'}
            </Text>
            {!scanning
              ? <TouchableOpacity className="w-full bg-primary py-4 rounded-2xl items-center" style={{ shadowColor: '#6366f1', shadowOpacity: 0.4, shadowRadius: 16, elevation: 6 }} onPress={handleBLEScan} activeOpacity={0.85}><Text className="text-white font-bold text-lg">Start BLE Scan →</Text></TouchableOpacity>
              : <TouchableOpacity className="border border-slate-300 py-3 px-10 rounded-2xl bg-white" onPress={() => { setScanning(false); stopPulse(); }} activeOpacity={0.7}><Text className="text-slate-500 font-semibold">Cancel</Text></TouchableOpacity>
            }
            <View className="flex-row mt-6 gap-3">
              <View className="bg-white border border-slate-200 px-4 py-2 rounded-full flex-row items-center shadow-sm"><View className="w-2 h-2 rounded-full bg-blue-500 mr-2" /><Text className="text-slate-600 text-xs font-bold">BLE Active</Text></View>
              <View className="bg-white border border-slate-200 px-4 py-2 rounded-full shadow-sm"><Text className="text-slate-600 text-xs font-bold">8s Scan ⏱</Text></View>
            </View>
          </View>
        )
      )}

      {/* ── QR Mode ──────────────────────────────────────────────────────── */}
      {mode === 'qr' && (
        <View className="flex-1 pb-[140px]">
          {!cameraPermission?.granted ? (
            <View className="flex-1 items-center justify-center px-6">
              <Text className="text-5xl mb-6">📸</Text>
              <Text className="text-slate-900 text-xl font-bold text-center mb-3">Camera Permission Required</Text>
              <Text className="text-slate-500 text-center text-sm mb-8 leading-5 font-medium">We need camera access to scan QR codes on Lost & Found items.</Text>
              <TouchableOpacity className="w-full bg-primary py-4 rounded-2xl items-center shadow-md shadow-primary/30" onPress={requestCameraPermission} activeOpacity={0.85}>
                <Text className="text-white font-bold text-lg">Grant Camera Access</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="flex-1">
              <CameraView
                style={{ flex: 1 }}
                facing="back"
                onBarcodeScanned={qrScanned ? undefined : handleQRScanned}
                barcodeScannerSettings={{ barcodeTypes: ['qr', 'pdf417', 'code128', 'code39'] }}
              >
                <View className="flex-1 items-center justify-center">
                  {/* Finder frame */}
                  <View style={{ width: 240, height: 240, borderColor: '#e11d48', borderWidth: 3, borderRadius: 16, backgroundColor: 'transparent' }}>
                    {/* Corner marks */}
                    {[{ top: -2, left: -2 }, { top: -2, right: -2 }, { bottom: -2, left: -2 }, { bottom: -2, right: -2 }].map((s, i) => (
                      <View key={i} style={{ position: 'absolute', width: 24, height: 24, borderColor: '#f43f5e', borderWidth: 3, ...s }} />
                    ))}
                  </View>
                  <View className="bg-black/60 rounded-2xl px-6 py-3 mt-8">
                    <Text className="text-white text-sm font-semibold text-center">Point camera at a QR code</Text>
                  </View>
                </View>
              </CameraView>
              {qrScanned && (
                <View className="absolute bottom-6 left-6 right-6">
                  <TouchableOpacity className="bg-white border border-slate-200 py-4 rounded-2xl items-center shadow-md" onPress={() => setQrScanned(false)} activeOpacity={0.7}>
                    <Text className="text-slate-700 font-bold">Tap to Scan Again</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

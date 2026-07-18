import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Alert,
  Animated, Easing, StatusBar, ScrollView, Clipboard,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { writeNDEFUrl, linkExistingTag } from '../../lib/nfc';
import { supabase } from '../../lib/supabase';
import * as Haptics from 'expo-haptics';

type Mode = 'choose' | 'writing' | 'linking' | 'success';

export default function WriteTagScreen() {
  const { id, nfc_uid, ble_beacon_id, tag_type, service_uuid } = useLocalSearchParams<{
    id: string;
    nfc_uid: string;
    ble_beacon_id: string;
    tag_type: string;
    service_uuid: string;
  }>();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('choose');
  const [linkedUid, setLinkedUid] = useState<string | null>(null);

  const tagType = String(tag_type);
  const itemId = String(id);
  const presetNfcUid = String(nfc_uid); // UUID pre-generated for programmed tags
  const beaconId = String(ble_beacon_id);
  const serviceUuid = String(service_uuid);

  const isNFC = tagType === 'nfc_only' || tagType === 'nfc_ble';
  const isBLE = tagType === 'ble_only' || tagType === 'nfc_ble';

  // Animations
  const pulse = useRef(new Animated.Value(1)).current;
  const ripple1 = useRef(new Animated.Value(0)).current;
  const ripple2 = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    if (mode === 'writing' || mode === 'linking') {
      const anim = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulse, { toValue: 1.06, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(ripple1, { toValue: 1, duration: 1200, useNativeDriver: true }),
            Animated.timing(ripple1, { toValue: 0, duration: 0, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.delay(400),
            Animated.timing(ripple2, { toValue: 1, duration: 1200, useNativeDriver: true }),
            Animated.timing(ripple2, { toValue: 0, duration: 0, useNativeDriver: true }),
          ]),
        ])
      );
      anim.start();
      return () => anim.stop();
    }
  }, [mode]);

  const rippleScale = (anim: Animated.Value) =>
    anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] });
  const rippleOp = (anim: Animated.Value) =>
    anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.5, 0.2, 0] });

  // ── Program Blank Tag ──────────────────────────────────────────────────────
  const handleProgramTag = async () => {
    setMode('writing');
    // SPRINT 3 / SPRINT 0 INTEGRATION: Use the new official domain for NFC tags
    // Format: https://keepr.dpdns.org/i/[uuid]
    const url = `https://keepr.dpdns.org/i/${presetNfcUid}`;
    const wrote = await writeNDEFUrl(url);

    if (wrote) {
      // Update the item row with the UUID we wrote
      await supabase.from('items').update({
        nfc_uid: presetNfcUid,
        nfc_link_type: 'programmed',
      }).eq('id', itemId);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMode('success');
    } else {
      setMode('choose');
      Alert.alert('Write Failed', 'Could not write to NFC tag. Please try again.');
    }
  };

  // ── Link Existing Card ─────────────────────────────────────────────────────
  const handleLinkCard = async () => {
    setMode('linking');
    const hardwareId = await linkExistingTag();

    if (hardwareId) {
      // Check if this card is already linked to another item
      const { data: existing } = await supabase
        .from('items')
        .select('id, item_name')
        .eq('nfc_uid', hardwareId)
        .neq('id', itemId)
        .maybeSingle();

      if (existing) {
        setMode('choose');
        Alert.alert(
          'Card Already Linked',
          `This card is already linked to "${existing.item_name}". Please use a different card.`
        );
        return;
      }

      // Save the hardware UID
      await supabase.from('items').update({
        nfc_uid: hardwareId,
        nfc_link_type: 'linked_existing',
      }).eq('id', itemId);

      setLinkedUid(hardwareId);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMode('success');
    } else {
      setMode('choose');
      Alert.alert('Scan Failed', 'Could not read the card. Hold it steady and try again.');
    }
  };

  const handleDone = () => {
    router.replace('/(tabs)/my-items');
  };

  const isActive = mode === 'writing' || mode === 'linking';

  // ── BLE-only setup UI ──────────────────────────────────────────────────────
  if (!isNFC && isBLE) {
    return (
      <View className="flex-1 bg-slate-50">
        <StatusBar barStyle="dark-content" />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 80, paddingTop: 60 }}>

          {/* Back */}
          <TouchableOpacity onPress={() => router.back()} className="mb-8 flex-row items-center" activeOpacity={0.7}>
            <Text className="text-primary text-lg mr-1">←</Text>
            <Text className="text-primary font-semibold">Back</Text>
          </TouchableOpacity>

          {/* Header */}
          <Text className="text-slate-500 text-xs uppercase tracking-widest mb-2 font-bold">BLE Beacon Setup</Text>
          <Text className="text-slate-900 text-3xl font-black mb-2">Activate Your Beacon</Text>
          <Text className="text-slate-500 text-sm leading-6 mb-8 font-medium">
            Your item has been registered! Flash your ESP32 beacon with the ID below and it will appear live on the tracking map.
          </Text>

          {/* Beacon ID Card */}
          <View className="bg-white border border-primary/30 rounded-3xl p-6 mb-6 shadow-sm">
            <Text className="text-slate-500 text-xs uppercase tracking-wider mb-3 font-bold">Your Beacon ID</Text>
            <View className="bg-slate-50 rounded-2xl px-5 py-4 flex-row justify-between items-center border border-slate-200 mb-4">
              <Text className="text-primary font-mono text-xl font-bold tracking-widest">{beaconId}</Text>
              <TouchableOpacity
                onPress={() => {
                  Clipboard.setString(beaconId);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  Alert.alert('Copied!', 'Beacon ID copied to clipboard.');
                }}
                activeOpacity={0.7}
                className="bg-primary/10 border border-primary/20 px-3 py-2 rounded-xl"
              >
                <Text className="text-primary font-bold text-sm">Copy</Text>
              </TouchableOpacity>
            </View>

            <Text className="text-slate-500 text-xs uppercase tracking-wider mb-3 font-bold mt-2">Service UUID (iOS Background Support)</Text>
            <View className="bg-slate-50 rounded-2xl px-4 py-3 flex-row justify-between items-center border border-slate-200 mb-4">
              <Text className="text-primary font-mono text-[10px] font-bold" numberOfLines={1}>{serviceUuid}</Text>
              <TouchableOpacity
                onPress={() => {
                  Clipboard.setString(serviceUuid);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  Alert.alert('Copied!', 'Service UUID copied to clipboard.');
                }}
                activeOpacity={0.7}
                className="bg-primary/10 border border-primary/20 px-3 py-2 rounded-xl ml-2"
              >
                <Text className="text-primary font-bold text-sm">Copy</Text>
              </TouchableOpacity>
            </View>

            <Text className="text-slate-500 text-xs leading-5 font-medium">
              These IDs are required for dual-mode tracking (Name + UUID). Your beacon must broadcast both for the app to detect it reliably.
            </Text>
          </View>

          {/* Steps */}
          <View className="bg-white border border-slate-200 rounded-3xl p-6 mb-6 shadow-sm">
            <Text className="text-slate-500 text-xs uppercase tracking-wider mb-4 font-bold">Setup Steps</Text>
            {[
              { n: '1', icon: '📋', title: 'Copy the Beacon ID above', sub: 'You\'ll paste it into your Arduino code.' },
              { n: '2', icon: '💻', title: 'Open your beacon firmware', sub: 'In Arduino IDE, find the BEACON_NAME variable.' },
              { n: '3', icon: '✏️', title: 'Set BEACON_NAME', sub: `Replace the current value with "${beaconId}"` },
              { n: '4', icon: '⚡', title: 'Flash your ESP32-C3', sub: 'Upload the sketch and plug in your beacon.' },
              { n: '5', icon: '✅', title: 'Tap Done below', sub: 'The app will start detecting your beacon automatically.' },
            ].map(step => (
              <View key={step.n} className="flex-row items-start mb-4 last:mb-0">
                <View className="w-8 h-8 bg-primary/10 border border-primary/20 rounded-full items-center justify-center mr-4 mt-0.5">
                  <Text className="text-primary font-bold text-sm">{step.n}</Text>
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center mb-1">
                    <Text className="text-lg mr-2">{step.icon}</Text>
                    <Text className="text-slate-900 font-bold">{step.title}</Text>
                  </View>
                  <Text className="text-slate-500 text-sm leading-5 font-medium">{step.sub}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Firmware snippet */}
          <View className="bg-slate-900 border border-slate-700 rounded-2xl p-4 mb-8 shadow-inner">
            <Text className="text-slate-400 text-xs uppercase tracking-wider mb-3 font-bold">Firmware Snippet</Text>
            <Text className="text-green-400 font-mono text-[10px] leading-5">
              {`// In beacon.ino, change these lines:
#define BEACON_NAME "${beaconId}"
#define SERVICE_UUID "${serviceUuid}"

// The rest of the firmware stays the same.
// Flash → your beacon is live!`}
            </Text>
          </View>

          {/* Done button */}
          <TouchableOpacity
            className="w-full bg-primary py-5 rounded-2xl items-center mb-5 shadow-md shadow-primary/30"
            onPress={handleDone}
            activeOpacity={0.85}
          >
            <Text className="text-white font-bold text-lg tracking-wide">Done — My Beacon is Set Up ✓</Text>
          </TouchableOpacity>

          {/* Skip */}
          <TouchableOpacity
            className="items-center py-3"
            onPress={handleDone}
            activeOpacity={0.7}
          >
            <Text className="text-slate-500 font-bold text-sm">Skip — I'll flash the firmware later</Text>
          </TouchableOpacity>

        </ScrollView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50">
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 60 }}>

        {/* Header */}
        <Text className="text-slate-500 text-xs uppercase tracking-widest mb-2 font-bold">
          {mode === 'success' ? 'Setup Complete' : 'NFC Setup'}
        </Text>
        <Text className="text-slate-900 text-3xl font-black mb-10 text-center">
          {mode === 'success' ? 'Item Protected! 🎉' :
           mode === 'writing' ? 'Writing to Tag...' :
           mode === 'linking' ? 'Reading Card...' :
           'Link Your Tag'}
        </Text>

        {/* Animated Rings + Icon */}
        {(isNFC && mode !== 'success') && (
          <View style={{ width: 220, height: 220, alignItems: 'center', justifyContent: 'center', marginBottom: 36 }}>
            <Animated.View style={{
              position: 'absolute', width: 190, height: 190, borderRadius: 95,
              borderWidth: 1.5, borderColor: '#06b6d4',
              opacity: isActive ? rippleOp(ripple2) : 0.08,
              transform: isActive ? [{ scale: rippleScale(ripple2) }] : [],
            }} />
            <Animated.View style={{
              position: 'absolute', width: 150, height: 150, borderRadius: 75,
              borderWidth: 1.5, borderColor: '#22d3ee',
              opacity: isActive ? rippleOp(ripple1) : 0.12,
              transform: isActive ? [{ scale: rippleScale(ripple1) }] : [],
            }} />
            <Animated.View style={{ transform: [{ scale: isActive ? pulse : 1 }] }}>
              <View
                className="w-28 h-28 bg-white rounded-full items-center justify-center border-2 border-primary"
                style={{ shadowColor: '#e11d48', shadowOpacity: isActive ? 0.3 : 0.1, shadowRadius: 20, elevation: 6 }}
              >
                <Text className="text-5xl">
                  {mode === 'linking' ? '💳' : '📱'}
                </Text>
              </View>
            </Animated.View>
          </View>
        )}

        {/* Success state */}
        {mode === 'success' && (
          <Animated.View style={{ opacity: fadeIn, alignItems: 'center', marginBottom: 32 }}>
            <View className="w-32 h-32 bg-green-100 border border-green-200 rounded-full items-center justify-center mb-6 shadow-sm">
              <Text className="text-6xl">✅</Text>
            </View>
            {linkedUid && (
              <View className="bg-white border border-slate-200 rounded-2xl px-5 py-3 mb-4 items-center shadow-sm">
                <Text className="text-slate-500 text-xs mb-1 uppercase tracking-wider font-bold">Linked Card ID</Text>
                <Text className="text-primary font-mono text-sm font-bold">{linkedUid}</Text>
              </View>
            )}
            <Text className="text-slate-600 text-base text-center leading-6 px-4 font-medium">
              {linkedUid
                ? 'Your existing card is now linked. Finders using the app will be able to identify it.'
                : 'NFC tag programmed. Any smartphone that taps it will see it belongs to you.'}
            </Text>
          </Animated.View>
        )}

        {/* Choose Mode — two buttons */}
        {isNFC && mode === 'choose' && (
          <View className="w-full gap-4 mb-6">
            {/* Program Blank Tag */}
            <TouchableOpacity
              className="w-full bg-primary rounded-2xl overflow-hidden shadow-md shadow-primary/30"
              onPress={handleProgramTag}
              activeOpacity={0.85}
            >
              <View className="px-6 py-5">
                <View className="flex-row items-center mb-2">
                  <Text className="text-2xl mr-3">📱</Text>
                  <Text className="text-white font-bold text-lg">Program a Blank Tag</Text>
                </View>
                <Text className="text-white/80 text-sm leading-5 font-medium">
                  Write our URL to an NFC sticker. Any smartphone can tap it — no app needed by the finder.
                </Text>
              </View>
            </TouchableOpacity>

            {/* Link Existing Card */}
            <TouchableOpacity
              className="w-full bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm"
              onPress={handleLinkCard}
              activeOpacity={0.85}
            >
              <View className="px-6 py-5">
                <View className="flex-row items-center mb-2">
                  <Text className="text-2xl mr-3">💳</Text>
                  <Text className="text-slate-900 font-bold text-lg">Link an Existing Card</Text>
                </View>
                <Text className="text-slate-500 text-sm leading-5 font-medium">
                  Metro card, debit card, NFC ring, etc. Finders must have the app to identify it.
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Active scanning hint */}
        {isActive && (
          <Text className="text-slate-500 text-base text-center px-6 leading-6 font-medium">
            {mode === 'writing'
              ? 'Hold your phone flat against the NFC sticker.\nKeep it steady for 2–3 seconds.'
              : 'Hold your phone against the card or tag.\nMetro cards, debit cards, NFC rings all work.'}
          </Text>
        )}

        {/* Done / Cancel */}
        {mode === 'success' && (
          <TouchableOpacity
            className="w-full bg-primary py-5 rounded-2xl items-center mt-4 shadow-md shadow-primary/30"
            onPress={handleDone}
            activeOpacity={0.85}
          >
            <Text className="text-white font-bold text-lg tracking-wide">Go to My Items →</Text>
          </TouchableOpacity>
        )}

        {isActive && (
          <TouchableOpacity
            className="mt-8 bg-transparent border border-slate-300 py-4 px-10 rounded-2xl shadow-sm bg-white"
            onPress={() => setMode('choose')}
            activeOpacity={0.7}
          >
            <Text className="text-slate-600 font-bold text-base">Cancel</Text>
          </TouchableOpacity>
        )}

        {/* Dev skip */}
        {mode === 'choose' && (
          <TouchableOpacity
            className="mt-10 bg-white border border-slate-200 px-6 py-3 rounded-xl shadow-sm"
            onPress={() => router.replace('/(tabs)/my-items')}
            activeOpacity={0.7}
          >
            <Text className="text-slate-400 font-bold text-sm">Skip (Dev Mode)</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

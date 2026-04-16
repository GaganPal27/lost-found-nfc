import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, Animated, Easing, StatusBar } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { writeNDEFUrl } from '../../lib/nfc';
import * as Haptics from 'expo-haptics';

export default function WriteTagScreen() {
  const { nfc_uid, ble_beacon_id, tag_type } = useLocalSearchParams();
  const router = useRouter();
  const [writing, setWriting] = useState(false);
  const [success, setSuccess] = useState(false);

  const tagType = String(tag_type);
  const nfcUid = String(nfc_uid);
  const beaconId = String(ble_beacon_id);

  const isNFC = tagType === 'nfc_only' || tagType === 'nfc_ble';
  const isBLE = tagType === 'ble_only' || tagType === 'nfc_ble';

  // Pulse animation
  const pulse = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.7)).current;
  const ripple1 = useRef(new Animated.Value(0)).current;
  const ripple2 = useRef(new Animated.Value(0)).current;

  const startPulse = () => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.05, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(pulseOpacity, { toValue: 0.2, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0.8, duration: 600, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(ripple1, { toValue: 0.1, duration: 600, useNativeDriver: true }),
          Animated.timing(ripple1, { toValue: 0.6, duration: 600, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(ripple2, { toValue: 0.1, duration: 600, useNativeDriver: true }),
          Animated.timing(ripple2, { toValue: 0.6, duration: 600, useNativeDriver: true }),
        ]),
      ])
    ).start();
  };

  useEffect(() => {
    if (writing) startPulse();
    return () => { pulse.stopAnimation(); };
  }, [writing]);

  useEffect(() => {
    if (success && !isBLE) setTimeout(() => router.replace('/(tabs)/my-items'), 2500);
  }, [success]);

  const handleWriteNFC = async () => {
    setWriting(true);
    const url = `https://lostandfound.app/item/${nfcUid}`;
    const wrote = await writeNDEFUrl(url);
    setWriting(false);
    if (wrote) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccess(true);
    } else {
      Alert.alert('Write Failed', 'Could not write to NFC tag. Try again.');
    }
  };

  const copyBeaconId = async () => {
    Alert.alert('BLE Beacon ID Copied', `Set your beacon's name to:\n\n${beaconId}`);
    setTimeout(() => router.replace('/(tabs)/my-items'), 1500);
  };

  const rippleScale = (anim: Animated.Value) => anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.5] });
  const rippleOp = (anim: Animated.Value) => anim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.5, 0.15, 0] });

  return (
    <View className="flex-1 bg-darkBg items-center justify-center px-6">
      <StatusBar barStyle="light-content" />

      <Text className="text-slate-400 text-xs uppercase tracking-widest mb-2">
        {isNFC && !success ? 'NFC Setup' : isBLE ? 'BLE Setup' : 'Complete'}
      </Text>
      <Text className="text-white text-3xl font-bold mb-12 text-center">
        {success && !isBLE ? 'Tag Programmed! 🎉' : isNFC && !success ? 'Program NFC Tag' : 'Configure BLE Beacon'}
      </Text>

      {/* NFC Write State */}
      {isNFC && !success && (
        <View className="items-center w-full mb-10">
          {/* Animated Rings */}
          <View style={{ width: 200, height: 200, alignItems: 'center', justifyContent: 'center', marginBottom: 32 }}>
            <Animated.View style={{
              position: 'absolute', width: 170, height: 170, borderRadius: 85,
              borderWidth: 1.5, borderColor: '#06b6d4',
              opacity: writing ? ripple2 : 0.1,
            }} />
            <Animated.View style={{
              position: 'absolute', width: 130, height: 130, borderRadius: 65,
              borderWidth: 1.5, borderColor: '#22d3ee',
              opacity: writing ? ripple1 : 0.15,
            }} />
            <Animated.View style={{
              transform: [{ scale: writing ? pulse : 1 }],
              opacity: writing ? pulseOpacity : 0.8,
            }}>
              <View
                className="w-28 h-28 bg-darkCard rounded-full items-center justify-center border-2 border-primary"
                style={{
                  shadowColor: '#06b6d4',
                  shadowOpacity: writing ? 0.7 : 0.3,
                  shadowRadius: 20,
                  elevation: 6,
                }}
              >
                <Text className="text-5xl">📱</Text>
              </View>
            </Animated.View>
          </View>

          <Text className="text-slate-300 text-lg text-center mb-2 font-semibold">
            {writing ? 'Scanning for NFC tag...' : 'Hold your phone to the NFC tag'}
          </Text>
          <Text className="text-slate-500 text-sm text-center mb-8">
            {writing ? 'Keep your phone steady near the tag surface' : 'Place the tag close to the back of your device'}
          </Text>

          <TouchableOpacity
            className={`w-full bg-primary py-4 rounded-2xl items-center ${writing ? 'opacity-60' : ''}`}
            onPress={handleWriteNFC}
            disabled={writing}
            activeOpacity={0.85}
            style={{ shadowColor: '#06b6d4', shadowOpacity: 0.35, shadowRadius: 12, elevation: 5 }}
          >
            {writing
              ? <ActivityIndicator color="#0f172a" />
              : <Text className="text-slate-900 font-bold text-lg">Start NFC Write</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {/* BLE Setup */}
      {isBLE && (!isNFC || success) && (
        <View className="w-full bg-darkCard border border-darkBorder rounded-3xl p-6 mb-8">
          <View className="items-center mb-6">
            <View className="w-20 h-20 bg-cyan-500/15 border border-cyan-500/30 rounded-full items-center justify-center mb-4">
              <Text className="text-4xl">📡</Text>
            </View>
            <Text className="text-white text-xl font-bold mb-2 text-center">Configure BLE Beacon</Text>
            <Text className="text-slate-400 text-sm text-center leading-6">
              Open your beacon's companion app and set the beacon's broadcast name to:
            </Text>
          </View>

          <View className="bg-slate-800 border border-primary/30 rounded-2xl py-4 px-6 items-center mb-6">
            <Text className="text-primary font-mono text-2xl font-bold tracking-widest">{beaconId}</Text>
          </View>

          <TouchableOpacity
            className="w-full bg-primary py-4 rounded-2xl items-center"
            onPress={copyBeaconId}
            activeOpacity={0.85}
          >
            <Text className="text-slate-900 font-bold text-lg">Copy ID & Complete Setup</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Success */}
      {success && !isBLE && (
        <View className="items-center mt-4">
          <View className="w-28 h-28 bg-green-500/15 border border-green-500/30 rounded-full items-center justify-center mb-6">
            <Text className="text-5xl">✅</Text>
          </View>
          <Text className="text-white text-2xl font-bold mb-2">Tag Programmed!</Text>
          <Text className="text-slate-400 text-center">Stick the NFC tag on your item and you're protected.</Text>
        </View>
      )}

      {/* Dev Skip */}
      <TouchableOpacity
        className="mt-8 bg-darkCard border border-darkBorder px-6 py-3 rounded-xl"
        onPress={() => router.replace('/(tabs)/my-items')}
        activeOpacity={0.7}
      >
        <Text className="text-slate-500 font-semibold text-sm">Skip (Dev Mode)</Text>
      </TouchableOpacity>
    </View>
  );
}

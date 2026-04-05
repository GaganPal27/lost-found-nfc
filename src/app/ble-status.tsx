import { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch, StatusBar, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { useSubscriptionStore } from '../stores/subscriptionStore';

// Mock BLE data
const MOCK_BEACONS = [
  { id: 'LF-BLE-A2F1C3', name: 'Nearby Backpack', rssi: -62, distance: '~2m', time: '2 min ago' },
  { id: 'LF-BLE-D9E4B7', name: 'Unknown device', rssi: -78, distance: '~5m', time: '8 min ago' },
  { id: 'LF-BLE-07C2A9', name: 'Network relay', rssi: -85, distance: '~10m', time: '15 min ago' },
];

export default function BLEStatusScreen() {
  const router = useRouter();
  const { tier } = useSubscriptionStore();
  const [bleEnabled, setBleEnabled] = useState(tier === 'pro' || tier === 'max');
  const [scanning, setScanning] = useState(false);

  const isPremium = tier === 'pro' || tier === 'max';

  // Wave animation
  const wave1 = useRef(new Animated.Value(0)).current;
  const wave2 = useRef(new Animated.Value(0)).current;
  const wave3 = useRef(new Animated.Value(0)).current;

  const startWaves = () => {
    const createWave = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 2000, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );
    Animated.parallel([
      createWave(wave1, 0),
      createWave(wave2, 600),
      createWave(wave3, 1200),
    ]).start();
  };

  useEffect(() => {
    if (bleEnabled && isPremium) {
      setScanning(true);
      startWaves();
    } else {
      setScanning(false);
      wave1.stopAnimation(); wave1.setValue(0);
      wave2.stopAnimation(); wave2.setValue(0);
      wave3.stopAnimation(); wave3.setValue(0);
    }
  }, [bleEnabled, isPremium]);

  const waveScale = (anim: Animated.Value) => anim.interpolate({ inputRange: [0, 1], outputRange: [1, 3.5] });
  const waveOp = (anim: Animated.Value) => anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.5, 0.15, 0] });

  const getStrengthLabel = (rssi: number) => {
    if (rssi > -65) return { label: 'Strong', color: 'text-green-400' };
    if (rssi > -75) return { label: 'Medium', color: 'text-amber-400' };
    return { label: 'Weak', color: 'text-red-400' };
  };

  return (
    <View className="flex-1 bg-darkBg">
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 60, paddingTop: 60 }}>
        {/* Back */}
        <TouchableOpacity onPress={() => router.back()} className="mb-6 flex-row items-center" activeOpacity={0.7}>
          <Text className="text-primary text-lg mr-1">←</Text>
          <Text className="text-primary font-semibold">Profile</Text>
        </TouchableOpacity>

        <Text className="text-slate-400 text-xs uppercase tracking-widest mb-2">Bluetooth</Text>
        <Text className="text-white text-3xl font-bold mb-2">BLE Relay Network</Text>
        <Text className="text-slate-400 text-sm mb-8 leading-6">
          Your device contributes to the Lost & Found passive detection network by relaying beacon signals from nearby tagged items.
        </Text>

        {/* BLE Visualizer */}
        <View className="items-center mb-8">
          <View style={{ width: 200, height: 200, alignItems: 'center', justifyContent: 'center' }}>
            {/* Waves */}
            {[wave1, wave2, wave3].map((w, i) => (
              <Animated.View
                key={i}
                style={{
                  position: 'absolute',
                  width: 100, height: 100,
                  borderRadius: 50,
                  borderWidth: 1.5,
                  borderColor: isPremium && bleEnabled ? '#06b6d4' : '#334155',
                  opacity: waveOp(w),
                  transform: [{ scale: waveScale(w) }],
                }}
              />
            ))}
            {/* Center */}
            <View
              className={`w-24 h-24 rounded-full items-center justify-center border-2 ${
                isPremium && bleEnabled ? 'bg-cyan-500/20 border-cyan-500/50' : 'bg-darkCard border-darkBorder'
              }`}
              style={{
                shadowColor: isPremium && bleEnabled ? '#06b6d4' : 'transparent',
                shadowOpacity: 0.5,
                shadowRadius: 16,
                elevation: 6,
              }}
            >
              <Text className="text-4xl">📡</Text>
            </View>
          </View>

          <View className={`flex-row items-center px-4 py-2 rounded-full border mt-4 ${
            isPremium && bleEnabled
              ? 'bg-cyan-500/15 border-cyan-500/30'
              : 'bg-slate-700/30 border-slate-600'
          }`}>
            <View className={`w-2 h-2 rounded-full mr-2 ${isPremium && bleEnabled ? 'bg-cyan-400' : 'bg-slate-500'}`} />
            <Text className={`font-bold text-sm ${isPremium && bleEnabled ? 'text-cyan-300' : 'text-slate-400'}`}>
              {isPremium && bleEnabled ? 'CONTRIBUTING TO NETWORK' : 'INACTIVE'}
            </Text>
          </View>
        </View>

        {/* BLE Toggle */}
        <View className="bg-darkCard border border-darkBorder rounded-3xl p-5 mb-5">
          <View className="flex-row justify-between items-center">
            <View className="flex-1 pr-4">
              <Text className="text-white font-bold text-base mb-1">BLE Relay Scanning</Text>
              <Text className="text-slate-400 text-sm leading-5">
                {isPremium
                  ? 'Enable to contribute to the passive detection network.'
                  : 'Available with Pro or Max plan.'}
              </Text>
            </View>
            <Switch
              value={bleEnabled && isPremium}
              onValueChange={v => isPremium ? setBleEnabled(v) : router.push('/subscription')}
              trackColor={{ true: '#06b6d4', false: '#334155' }}
              thumbColor={bleEnabled && isPremium ? '#22d3ee' : '#94a3b8'}
            />
          </View>
          {!isPremium && (
            <TouchableOpacity
              onPress={() => router.push('/subscription')}
              className="bg-primary/15 border border-primary/30 rounded-2xl p-3 mt-4 items-center"
              activeOpacity={0.7}
            >
              <Text className="text-primary font-bold text-sm">⬆ Upgrade to Activate BLE</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Nearby Beacons */}
        <View className="bg-darkCard border border-darkBorder rounded-3xl overflow-hidden mb-5">
          <View className="px-5 pt-4 pb-3 border-b border-slate-700 flex-row justify-between items-center">
            <Text className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Nearby Devices</Text>
            {scanning && (
              <View className="flex-row items-center">
                <View className="w-2 h-2 rounded-full bg-cyan-400 mr-2" />
                <Text className="text-cyan-400 text-xs font-bold">SCANNING</Text>
              </View>
            )}
          </View>

          {!isPremium || !bleEnabled ? (
            <View className="p-8 items-center">
              <Text className="text-slate-600 text-center text-sm">
                {!isPremium ? 'Upgrade to see nearby Lost & Found beacons' : 'Enable BLE to start scanning'}
              </Text>
            </View>
          ) : (
            MOCK_BEACONS.map((b, i) => {
              const strength = getStrengthLabel(b.rssi);
              return (
                <View key={b.id} className={`px-5 py-4 flex-row items-center ${i !== MOCK_BEACONS.length - 1 ? 'border-b border-slate-700' : ''}`}>
                  <View className="w-10 h-10 bg-slate-700 rounded-xl items-center justify-center mr-4">
                    <Text className="text-lg">📡</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-white font-semibold text-sm">{b.id}</Text>
                    <Text className="text-slate-500 text-xs mt-0.5">{b.distance} · {b.time}</Text>
                  </View>
                  <Text className={`text-xs font-bold ${strength.color}`}>{strength.label}</Text>
                </View>
              );
            })
          )}
        </View>

        {/* Stats */}
        <View className="bg-darkCard border border-darkBorder rounded-3xl p-5 mb-5">
          <Text className="text-slate-400 text-xs uppercase tracking-wider mb-4 font-semibold">Network Contribution</Text>
          <View className="flex-row">
            {[
              { val: isPremium && bleEnabled ? '247' : '--', label: 'Beacons relayed' },
              { val: isPremium && bleEnabled ? '12' : '--', label: 'Items sighted' },
              { val: isPremium && bleEnabled ? '5h' : '--', label: 'Active today' },
            ].map((s, i) => (
              <View key={i} className="flex-1 items-center">
                <Text className={`text-2xl font-bold mb-1 ${isPremium && bleEnabled ? 'text-primary' : 'text-slate-600'}`}>
                  {s.val}
                </Text>
                <Text className="text-slate-500 text-xs text-center">{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Info */}
        <View className="bg-darkCard border border-darkBorder rounded-3xl p-5">
          <Text className="text-slate-400 text-xs uppercase tracking-wider mb-3 font-semibold">How BLE Relay Works</Text>
          {[
            { icon: '📡', text: 'Your phone passively listens for Lost & Found BLE beacon signals nearby.' },
            { icon: '☁️', text: 'Detected signals are securely relayed to our network to update item locations.' },
            { icon: '🔒', text: 'Your identity and precise location are never shared with item owners.' },
          ].map((info, i) => (
            <View key={i} className={`flex-row py-3 ${i !== 2 ? 'border-b border-slate-700' : ''}`}>
              <Text className="text-xl mr-4">{info.icon}</Text>
              <Text className="text-slate-400 text-sm leading-5 flex-1">{info.text}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

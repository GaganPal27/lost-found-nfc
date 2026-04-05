import { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, Animated, Easing, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { readNDEFUrl } from '../../lib/nfc';
import { supabase } from '../../lib/supabase';

export default function ScanScreen() {
  const [scanning, setScanning] = useState(false);
  const router = useRouter();

  // Pulsing ring animations
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;

  const startPulse = () => {
    const createLoop = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 1600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );
    Animated.parallel([
      createLoop(ring1, 0),
      createLoop(ring2, 500),
      createLoop(ring3, 1000),
    ]).start();
  };

  const stopPulse = () => {
    ring1.stopAnimation(); ring2.stopAnimation(); ring3.stopAnimation();
    ring1.setValue(0); ring2.setValue(0); ring3.setValue(0);
  };

  useEffect(() => {
    return () => stopPulse();
  }, []);

  const handleScan = async () => {
    setScanning(true);
    startPulse();
    try {
      const url = await readNDEFUrl();
      if (!url) {
        Alert.alert('Scan Failed', 'Could not read NFC tag. Hold steady and try again.');
        return;
      }

      const match = url.match(/\/item\/([a-zA-Z0-9-]+)/);
      if (!match || !match[1]) {
        Alert.alert('Invalid Tag', 'This tag is not part of the Lost & Found Network.');
        return;
      }

      const nfcUid = match[1];
      const { data, error } = await supabase
        .from('items')
        .select('id')
        .eq('nfc_uid', nfcUid)
        .neq('status', 'deleted')
        .single();

      if (error || !data) {
        Alert.alert('Not Found', 'This item is not registered in our network yet.');
        return;
      }

      router.push(`/item/${nfcUid}`);
    } catch (err) {
      Alert.alert('Error', 'An error occurred during scanning.');
    } finally {
      setScanning(false);
      stopPulse();
    }
  };

  const ringScale = (anim: Animated.Value, max: number) =>
    anim.interpolate({ inputRange: [0, 1], outputRange: [1, max] });

  const ringOpacity = (anim: Animated.Value) =>
    anim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.6, 0.2, 0] });

  return (
    <View className="flex-1 bg-darkBg items-center justify-center px-6">
      <StatusBar barStyle="light-content" />

      {/* Header text */}
      <Text className="text-slate-400 text-xs uppercase tracking-widest mb-2">
        {scanning ? 'Scan in progress' : 'NFC Scanner'}
      </Text>

      {/* Pulse rings + icon */}
      <View className="items-center justify-center mb-12 mt-4" style={{ width: 260, height: 260 }}>
        {/* Ring 3 (outermost) */}
        <Animated.View
          style={{
            position: 'absolute',
            width: 220, height: 220,
            borderRadius: 110,
            borderWidth: 1.5,
            borderColor: '#06b6d4',
            opacity: ringOpacity(ring3),
            transform: [{ scale: ringScale(ring3, 1.5) }],
          }}
        />
        {/* Ring 2 */}
        <Animated.View
          style={{
            position: 'absolute',
            width: 170, height: 170,
            borderRadius: 85,
            borderWidth: 1.5,
            borderColor: '#06b6d4',
            opacity: ringOpacity(ring2),
            transform: [{ scale: ringScale(ring2, 1.5) }],
          }}
        />
        {/* Ring 1 (inner) */}
        <Animated.View
          style={{
            position: 'absolute',
            width: 120, height: 120,
            borderRadius: 60,
            borderWidth: 2,
            borderColor: '#22d3ee',
            opacity: ringOpacity(ring1),
            transform: [{ scale: ringScale(ring1, 1.5) }],
          }}
        />
        {/* Center icon */}
        <View
          className="w-28 h-28 bg-darkCard rounded-full items-center justify-center border-2 border-darkBorder"
          style={{ shadowColor: '#06b6d4', shadowOpacity: scanning ? 0.6 : 0.2, shadowRadius: 20, elevation: 6 }}
        >
          <Text className="text-5xl">📡</Text>
        </View>
      </View>

      {/* Text */}
      <Text className="text-white text-3xl font-bold text-center mb-3">
        {scanning ? 'Scanning NFC Tag...' : 'Found an item?'}
      </Text>

      {scanning && (
        <View className="flex-row mb-4">
          {[0, 1, 2].map(i => (
            <View key={i} className={`w-2 h-2 rounded-full mx-1 ${i === 1 ? 'bg-primary' : 'bg-slate-600'}`} />
          ))}
        </View>
      )}

      <Text className="text-slate-400 text-base text-center mb-10 px-6 leading-6">
        {scanning
          ? 'Hold your phone near the NFC tag.\nEnsure NFC is enabled in settings.'
          : 'Tap your phone against a Lost & Found\nNFC tag to notify the owner instantly.'}
      </Text>

      {/* Button */}
      {!scanning ? (
        <TouchableOpacity
          className="w-full bg-primary py-5 rounded-2xl items-center"
          style={{ shadowColor: '#06b6d4', shadowOpacity: 0.4, shadowRadius: 16, elevation: 6 }}
          onPress={handleScan}
          activeOpacity={0.85}
        >
          <Text className="text-slate-900 font-bold text-lg tracking-wide">Tap to Scan NFC Tag</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          className="bg-transparent border border-slate-600 py-4 px-10 rounded-2xl"
          onPress={() => { setScanning(false); stopPulse(); }}
          activeOpacity={0.7}
        >
          <Text className="text-slate-400 font-semibold text-base">Cancel</Text>
        </TouchableOpacity>
      )}

      {/* Info chips */}
      {!scanning && (
        <View className="flex-row mt-10 gap-3">
          <View className="bg-darkCard border border-darkBorder px-4 py-2 rounded-full flex-row items-center">
            <View className="w-2 h-2 rounded-full bg-green-400 mr-2" />
            <Text className="text-slate-400 text-xs font-medium">NFC Ready</Text>
          </View>
          <View className="bg-darkCard border border-darkBorder px-4 py-2 rounded-full flex-row items-center">
            <Text className="text-slate-400 text-xs font-medium">Passive Network 📡</Text>
          </View>
        </View>
      )}
    </View>
  );
}

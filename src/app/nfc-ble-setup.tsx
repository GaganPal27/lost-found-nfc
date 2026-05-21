import { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Animated, Easing, StatusBar } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { writeNDEFUrl } from '../lib/nfc';

type Step = 'nfc' | 'ble' | 'done';

export default function NFCBLESetupScreen() {
  const { id, nfc_uid, ble_beacon_id } = useLocalSearchParams();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>('nfc');
  const [nfcWriting, setNfcWriting] = useState(false);
  const [nfcDone, setNfcDone] = useState(false);

  const nfcUid = String(nfc_uid);
  const beaconId = String(ble_beacon_id);

  // NFC pulse animation
  const pulse = useRef(new Animated.Value(1)).current;
  const ripple1 = useRef(new Animated.Value(0)).current;
  const ripple2 = useRef(new Animated.Value(0)).current;

  const startPulse = () => {
    Animated.parallel([
      Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])),
      Animated.loop(Animated.sequence([
        Animated.timing(ripple1, { toValue: 1, duration: 1500, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(ripple1, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])),
      Animated.loop(Animated.sequence([
        Animated.delay(750),
        Animated.timing(ripple2, { toValue: 1, duration: 1500, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(ripple2, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])),
    ]).start();
  };

  const stopPulse = () => {
    pulse.stopAnimation(); ripple1.stopAnimation(); ripple2.stopAnimation();
    pulse.setValue(1); ripple1.setValue(0); ripple2.setValue(0);
  };

  const handleWriteNFC = async () => {
    setNfcWriting(true);
    startPulse();
    const url = `https://lostandfound.app/item/${nfcUid}`;
    const wrote = await writeNDEFUrl(url);
    setNfcWriting(false);
    stopPulse();
    if (wrote) {
      setNfcDone(true);
      setTimeout(() => setCurrentStep('ble'), 1000);
    } else {
      Alert.alert('Write Failed', 'Could not write to NFC tag. Please try again.');
    }
  };

  const handleFinishBLE = () => {
    setCurrentStep('done');
    setTimeout(() => router.replace('/(tabs)/my-items'), 2200);
  };

  const rippleScale = (anim: Animated.Value) => anim.interpolate({ inputRange: [0, 1], outputRange: [1, 3] });
  const rippleOp = (anim: Animated.Value) => anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.5, 0.15, 0] });

  const steps = ['nfc', 'ble', 'done'];
  const stepIdx = steps.indexOf(currentStep);

  return (
    <View className="flex-1 bg-slate-50">
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 60, paddingTop: 60 }}>
        {/* Back */}
        <TouchableOpacity onPress={() => router.back()} className="mb-8 flex-row items-center" activeOpacity={0.7}>
          <Text className="text-primary text-lg mr-1">←</Text>
          <Text className="text-primary font-semibold">Back</Text>
        </TouchableOpacity>

        {/* Header */}
        <Text className="text-slate-500 text-xs uppercase tracking-widest mb-2 font-bold">NFC + BLE Tag</Text>
        <Text className="text-slate-900 text-3xl font-black mb-2">Setup Combo Tag</Text>
        <Text className="text-slate-500 text-sm mb-8 leading-6 font-medium">
          Your item uses both NFC and BLE. Follow these 2 steps to fully activate it.
        </Text>

        {/* Progress Steps */}
        <View className="flex-row items-center mb-10">
          {['NFC Write', 'BLE Config', 'Done'].map((label, i) => (
            <View key={i} className="flex-1 items-center">
              <View className="flex-row items-center w-full">
                {i > 0 && <View className={`flex-1 h-0.5 ${i <= stepIdx ? 'bg-primary' : 'bg-slate-200'}`} />}
                <View className={`w-8 h-8 rounded-full items-center justify-center border-2 ${
                  i < stepIdx ? 'bg-primary border-primary' :
                  i === stepIdx ? 'border-primary bg-primary/10' :
                  'border-slate-300 bg-white'
                }`}>
                  {i < stepIdx ? (
                    <Text className="text-white font-bold text-xs">✓</Text>
                  ) : (
                    <Text className={`font-bold text-xs ${i === stepIdx ? 'text-primary' : 'text-slate-400'}`}>{i + 1}</Text>
                  )}
                </View>
                {i < 2 && <View className={`flex-1 h-0.5 ${i < stepIdx ? 'bg-primary' : 'bg-slate-200'}`} />}
              </View>
              <Text className={`text-xs mt-2 font-bold ${i === stepIdx ? 'text-primary' : i < stepIdx ? 'text-slate-600' : 'text-slate-400'}`}>
                {label}
              </Text>
            </View>
          ))}
        </View>

        {/* Step 1: NFC Write */}
        {currentStep === 'nfc' && (
          <View className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <View className="items-center mb-8">
              <Text className="text-slate-900 text-xl font-bold mb-2">Step 1: Program NFC Tag</Text>
              <Text className="text-slate-500 text-sm text-center leading-6 font-medium">
                Hold the back of your phone against the NFC sticker to write the tracking link.
              </Text>
            </View>

            {/* Animated rings */}
            <View style={{ alignItems: 'center', height: 200, justifyContent: 'center', marginBottom: 24 }}>
              <Animated.View style={{
                position: 'absolute', width: 140, height: 140, borderRadius: 70,
                borderWidth: 1.5, borderColor: '#06b6d4',
                opacity: nfcWriting ? rippleOp(ripple2) : 0.1,
                transform: [{ scale: nfcWriting ? rippleScale(ripple2) : 1 }],
              }} />
              <Animated.View style={{
                position: 'absolute', width: 100, height: 100, borderRadius: 50,
                borderWidth: 2, borderColor: '#22d3ee',
                opacity: nfcWriting ? rippleOp(ripple1) : 0.15,
                transform: [{ scale: nfcWriting ? rippleScale(ripple1) : 1 }],
              }} />
              <Animated.View style={{ transform: [{ scale: nfcWriting ? pulse : 1 }] }}>
                <View
                  className={`w-24 h-24 rounded-full items-center justify-center border-2 ${nfcDone ? 'bg-green-100 border-green-300' : 'bg-primary/10 border-primary/30'}`}
                  style={{ shadowColor: nfcDone ? '#22c55e' : '#e11d48', shadowOpacity: 0.2, shadowRadius: 16, elevation: 5 }}
                >
                  <Text className="text-4xl">{nfcDone ? '✅' : '📱'}</Text>
                </View>
              </Animated.View>
            </View>

            {nfcDone ? (
              <View className="bg-green-50 border border-green-200 rounded-2xl p-4 items-center">
                <Text className="text-green-700 font-bold">NFC tag written successfully!</Text>
                <Text className="text-slate-500 text-xs mt-1 font-medium">Moving to BLE setup...</Text>
              </View>
            ) : (
              <TouchableOpacity
                className={`w-full bg-primary py-4 rounded-2xl items-center shadow-md shadow-primary/30 ${nfcWriting ? 'opacity-60' : ''}`}
                onPress={handleWriteNFC}
                disabled={nfcWriting}
                activeOpacity={0.85}
              >
                {nfcWriting
                  ? <ActivityIndicator color="#ffffff" />
                  : <Text className="text-white font-bold text-lg">Start NFC Write</Text>
                }
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Step 2: BLE Config */}
        {currentStep === 'ble' && (
          <View className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <View className="items-center mb-6">
              <View className="w-20 h-20 bg-blue-100 border border-blue-200 rounded-full items-center justify-center mb-4">
                <Text className="text-4xl">📡</Text>
              </View>
              <Text className="text-slate-900 text-xl font-bold mb-2">Step 2: Configure BLE Beacon</Text>
              <Text className="text-slate-500 text-sm text-center leading-6 font-medium">
                Open your BLE beacon's companion app and set its broadcast name exactly as shown below:
              </Text>
            </View>

            {/* Beacon ID */}
            <View className="bg-slate-50 border border-slate-200 rounded-2xl py-5 px-6 items-center mb-6 shadow-inner">
              <Text className="text-slate-500 text-xs mb-2 uppercase tracking-wider font-bold">Beacon Broadcast Name</Text>
              <Text className="text-primary font-mono text-2xl font-bold tracking-widest">{beaconId}</Text>
            </View>

            {/* Instructions */}
            <View className="bg-slate-50 rounded-2xl p-4 mb-6 border border-slate-100">
              {[
                'Open your beacon\'s companion app (e.g. nRF Toolbox, EddyStone config)',
                'Navigate to "Broadcast Name" or "Device Name" settings',
                `Set the name to exactly: ${beaconId}`,
                'Save and restart the beacon',
              ].map((step, i) => (
                <View key={i} className="flex-row items-start py-2">
                  <View className="w-5 h-5 bg-primary/10 border border-primary/20 rounded-full items-center justify-center mr-3 mt-0.5">
                    <Text className="text-primary text-xs font-bold">{i + 1}</Text>
                  </View>
                  <Text className="text-slate-600 text-sm leading-5 flex-1 font-medium">{step}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              className="w-full bg-primary py-4 rounded-2xl items-center shadow-md shadow-primary/30"
              onPress={handleFinishBLE}
              activeOpacity={0.85}
            >
              <Text className="text-white font-bold text-lg">I've Set It Up — Finish</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Step 3: Done */}
        {currentStep === 'done' && (
          <View className="items-center py-8">
            <View className="w-28 h-28 bg-green-100 border border-green-200 rounded-full items-center justify-center mb-6 shadow-sm">
              <Text className="text-6xl">🎉</Text>
            </View>
            <Text className="text-slate-900 text-3xl font-black mb-3">All Done!</Text>
            <Text className="text-slate-500 text-center text-base leading-6 px-6 font-medium">
              Your NFC + BLE combo tag is fully set up.{'\n'}Your item is now protected by both{'\n'}NFC scanning and passive BLE tracking.
            </Text>
          </View>
        )}

        {/* Dev Skip */}
        {currentStep !== 'done' && (
          <TouchableOpacity
            className="mt-6 bg-white border border-slate-200 px-6 py-3 rounded-xl items-center shadow-sm"
            onPress={() => router.replace('/(tabs)/my-items')}
            activeOpacity={0.7}
          >
            <Text className="text-slate-500 font-bold text-sm">Skip (Dev Mode)</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

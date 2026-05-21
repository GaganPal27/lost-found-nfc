import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StatusBar, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { NETWORK_INFO, type NetworkType } from '../lib/constants';
import { getTrackingStatus, type NetworkRegistration } from '../lib/fmdn';

export default function BeaconFirmwareScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<any>(null);
  const [firmwareConfig, setFirmwareConfig] = useState<string | null>(null);
  const [networks, setNetworks] = useState<NetworkRegistration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [itemRes, fwRes] = await Promise.all([
        supabase.from('items').select('*').eq('id', id).single(),
        supabase.from('beacon_firmware_configs').select('*').eq('item_id', id).maybeSingle(),
      ]);
      if (itemRes.data) setItem(itemRes.data);
      if (fwRes.data) setFirmwareConfig(fwRes.data.firmware_payload);

      const trackingStatus = await getTrackingStatus(id!);
      setNetworks(trackingStatus);
    } catch (err) {
      console.warn('Failed to load beacon data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyConfig = () => {
    if (firmwareConfig) {
      Alert.alert(
        'Firmware Configuration',
        'Copy the configuration shown below and use it with the ESP32/nRF52 flashing tool.\n\nAlternatively, scan the QR code with the companion flashing app.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleMarkFlashed = async () => {
    if (!id) return;
    await supabase.from('beacon_firmware_configs').update({
      flash_status: 'flashed',
      flashed_at: new Date().toISOString(),
    }).eq('item_id', id);
    Alert.alert('✅ Marked as Flashed', 'Your beacon is now configured. Multi-network tracking is active!');
    loadData();
  };

  if (loading) {
    return (
      <View className="flex-1 bg-slate-50 items-center justify-center">
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator color="#e11d48" size="large" />
      </View>
    );
  }

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
        <Text className="text-slate-500 text-xs uppercase tracking-widest mb-2 font-bold">Beacon Setup</Text>
        <Text className="text-slate-900 text-3xl font-black mb-2">
          Flash Firmware — {item?.item_name}
        </Text>
        <Text className="text-slate-600 text-sm mb-8 leading-6 font-medium">
          Configure your BLE beacon to work with Google Find My Device and Apple Find My networks.
        </Text>

        {/* Network Registration Status */}
        <View className="bg-white border border-slate-200 rounded-3xl p-5 mb-5 shadow-sm">
          <Text className="text-slate-500 text-xs uppercase tracking-wider mb-4 font-bold">
            Registered Networks
          </Text>
          {networks.map((net) => {
            const info = NETWORK_INFO[net.network as NetworkType];
            if (!info) return null;
            return (
              <View key={net.network} className="flex-row items-center py-3 border-b border-slate-100 last:border-b-0">
                <Text className="text-xl mr-3">{info.icon}</Text>
                <View className="flex-1">
                  <Text className="text-slate-900 font-bold">{info.name}</Text>
                  <Text className="text-slate-500 text-xs font-medium">
                    {net.isRegistered
                      ? `Registered · ${net.isActive ? 'Active' : 'Inactive'}`
                      : 'Not registered'}
                  </Text>
                </View>
                <View className={`w-3 h-3 rounded-full shadow-sm ${
                  net.isRegistered && net.isActive ? 'bg-green-500' :
                  net.isRegistered ? 'bg-amber-500' : 'bg-slate-300'
                }`} />
              </View>
            );
          })}
        </View>

        {/* Beacon ID */}
        {item?.ble_beacon_id && (
          <View className="bg-primary/5 border border-primary/20 rounded-2xl py-5 px-6 items-center mb-5 shadow-sm">
            <Text className="text-slate-600 text-xs mb-2 uppercase tracking-wider font-bold">Beacon Identifier</Text>
            <Text className="text-primary font-mono text-2xl font-black tracking-widest">{item.ble_beacon_id}</Text>
          </View>
        )}

        {/* Hardware Selection */}
        <View className="bg-white border border-slate-200 rounded-3xl p-5 mb-5 shadow-sm">
          <Text className="text-slate-500 text-xs uppercase tracking-wider mb-4 font-bold">
            Supported Hardware
          </Text>
          {[
            { name: 'ESP32-C3', desc: 'Most affordable. ~₹200-400. Arduino/PlatformIO flashing.', emoji: '🔧', recommended: true },
            { name: 'nRF52832', desc: '~₹300-500. Ultra low power. nRF Connect SDK.', emoji: '⚡' },
            { name: 'nRF52840', desc: '~₹400-600. Best range & battery life.', emoji: '🔋' },
            { name: 'Generic BLE Beacon', desc: '~₹300 (like Bimatix). Manual configuration via app.', emoji: '📡' },
          ].map((hw, i) => (
            <View key={i} className={`flex-row py-3 ${i !== 3 ? 'border-b border-slate-100' : ''}`}>
              <Text className="text-xl mr-3">{hw.emoji}</Text>
              <View className="flex-1">
                <View className="flex-row items-center">
                  <Text className="text-slate-900 font-bold">{hw.name}</Text>
                  {hw.recommended && (
                    <View className="bg-green-50 border border-green-200 px-2 py-0.5 rounded-full ml-2 shadow-sm">
                      <Text className="text-green-700 text-xs font-bold">Recommended</Text>
                    </View>
                  )}
                </View>
                <Text className="text-slate-500 text-sm mt-0.5 font-medium">{hw.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Flashing Instructions */}
        <View className="bg-white border border-slate-200 rounded-3xl p-5 mb-5 shadow-sm">
          <Text className="text-slate-500 text-xs uppercase tracking-wider mb-4 font-bold">
            Flashing Instructions
          </Text>
          {[
            'Purchase an ESP32-C3 or nRF52 development board',
            'Download the Lost & Found beacon firmware from our GitHub',
            'Open the firmware project in Arduino IDE or PlatformIO',
            `Paste your firmware config key (shown above) into the config.h file`,
            'Connect the board via USB and flash the firmware',
            'The beacon will start broadcasting multi-network advertisements',
            'Nearby Android phones and iPhones will begin relaying its location automatically',
          ].map((step, i) => (
            <View key={i} className="flex-row items-start py-2">
              <View className="w-6 h-6 bg-primary/10 border border-primary/20 rounded-full items-center justify-center mr-3 mt-0.5 shadow-sm">
                <Text className="text-primary text-xs font-bold">{i + 1}</Text>
              </View>
              <Text className="text-slate-600 text-sm leading-5 flex-1 font-medium">{step}</Text>
            </View>
          ))}
        </View>

        {/* Quick Setup (for generic beacons) */}
        <View className="bg-white border border-slate-200 rounded-3xl p-5 mb-5 shadow-sm">
          <Text className="text-slate-500 text-xs uppercase tracking-wider mb-4 font-bold">
            Quick Setup (Generic Beacons)
          </Text>
          <Text className="text-slate-600 text-sm leading-6 mb-4 font-medium">
            If you're using a generic BLE beacon (like the ₹300 Bimatix), it won't support FMDN/OpenHaystack natively.
            However, it will still work with our app relay network (Layer 3). Set the broadcast name to:
          </Text>
          <View className="bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 items-center mb-4 shadow-sm">
            <Text className="text-slate-900 font-mono text-xl font-bold tracking-widest">{item?.ble_beacon_id || 'LF-BLE-XXXXXX'}</Text>
          </View>
          <View className="bg-amber-50 border border-amber-200 rounded-2xl p-3 shadow-sm">
            <Text className="text-amber-800 text-sm leading-5 font-medium">
              ⚠️ Generic beacons only work with Layer 3 (our app users). For full multi-network tracking (Layers 1 & 2),
              you need an ESP32-C3 or nRF52 beacon with our custom firmware.
            </Text>
          </View>
        </View>

        {/* Actions */}
        <TouchableOpacity
          className="w-full bg-primary py-4 rounded-2xl items-center mb-3 shadow-md shadow-primary/30"
          onPress={handleMarkFlashed}
          activeOpacity={0.85}
        >
          <Text className="text-white font-bold text-lg tracking-wide">✅ I've Flashed the Firmware</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="w-full bg-white border border-slate-200 py-4 rounded-2xl items-center mb-3 shadow-sm"
          onPress={() => router.replace('/(tabs)/my-items')}
          activeOpacity={0.7}
        >
          <Text className="text-slate-600 font-semibold">Skip for Now → My Items</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

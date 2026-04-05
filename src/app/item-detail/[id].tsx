import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, ScrollView, TouchableOpacity, Alert, Switch, StatusBar } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useItemStore } from '../../stores/itemStore';
import { useSubscriptionStore } from '../../stores/subscriptionStore';
import EntitlementGate from '../../components/subscription/EntitlementGate';

const STATUS_CONFIG: Record<string, { label: string; color: string; border: string; dot: string }> = {
  active:  { label: 'ACTIVE',  color: 'bg-green-500/15',  border: 'border-green-500/30',  dot: 'bg-green-400'  },
  lost:    { label: 'LOST',    color: 'bg-red-500/15',    border: 'border-red-500/30',    dot: 'bg-red-400'    },
  found:   { label: 'FOUND',   color: 'bg-cyan-500/15',   border: 'border-cyan-500/30',   dot: 'bg-cyan-400'   },
};

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { deleteItem, updateStatus } = useItemStore();
  const { tier } = useSubscriptionStore();

  const [item, setItem] = useState<any>(null);
  const [scans, setScans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>('active');

  useEffect(() => {
    async function loadData() {
      const { data: itemData } = await supabase.from('items').select('*').eq('id', id).single();
      if (itemData) {
        setItem(itemData);
        setStatus(itemData.status);

        const days = tier === 'max' ? 90 : tier === 'pro' ? 30 : 7;
        const d = new Date();
        d.setDate(d.getDate() - days);

        const { data: scanData } = await supabase
          .from('nfc_scans')
          .select('*')
          .eq('nfc_uid', itemData.nfc_uid)
          .gte('scanned_at', d.toISOString())
          .order('scanned_at', { ascending: false });

        setScans(scanData || []);
      }
      setLoading(false);
    }
    loadData();
  }, [id, tier]);

  const handleUpdateStatus = async (newStatus: string) => {
    setStatus(newStatus);
    await updateStatus(id as string, newStatus as any);
  };

  const handleDelete = () => {
    Alert.alert('Delete Item', 'This will permanently remove this item and its tag registration.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteItem(id as string);
          router.replace('/(tabs)/my-items');
        }
      },
    ]);
  };

  const handleRewrite = () => {
    router.push({
      pathname: '/register-item/write-tag',
      params: { id: item.id, nfc_uid: item.nfc_uid, ble_beacon_id: item.ble_beacon_id || '', tag_type: item.tag_type },
    });
  };

  if (loading) return (
    <View className="flex-1 bg-darkBg justify-center items-center">
      <ActivityIndicator size="large" color="#06b6d4" />
    </View>
  );
  if (!item) return (
    <View className="flex-1 bg-darkBg justify-center items-center">
      <Text className="text-slate-400">Item not found</Text>
    </View>
  );

  const sc = STATUS_CONFIG[status] || STATUS_CONFIG.active;
  const hasLocation = item.last_seen_lat && item.last_seen_lng;

  return (
    <View className="flex-1 bg-darkBg">
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 60, paddingTop: 60 }}>
        {/* Back */}
        <TouchableOpacity onPress={() => router.back()} className="mb-6 flex-row items-center" activeOpacity={0.7}>
          <Text className="text-primary text-lg mr-1">←</Text>
          <Text className="text-primary font-semibold">My Items</Text>
        </TouchableOpacity>

        {/* Title Row */}
        <View className="flex-row justify-between items-start mb-3">
          <Text className="text-white text-3xl font-bold flex-1 mr-4" numberOfLines={2}>{item.item_name}</Text>
          <TouchableOpacity
            onPress={handleDelete}
            className="bg-red-500/10 border border-red-500/25 px-4 py-2 rounded-xl"
            activeOpacity={0.7}
          >
            <Text className="text-red-400 font-bold text-sm">Delete</Text>
          </TouchableOpacity>
        </View>

        {/* Tags Row */}
        <View className="flex-row items-center mb-6 gap-2">
          <View className={`flex-row items-center px-3 py-1.5 rounded-full border ${sc.color} ${sc.border}`}>
            <View className={`w-2 h-2 rounded-full mr-2 ${sc.dot}`} />
            <Text className={`text-xs font-bold tracking-widest ${sc.dot.replace('bg-', 'text-').replace('-400', '-300')}`}>
              {sc.label}
            </Text>
          </View>
          <View className="bg-darkCard border border-darkBorder px-3 py-1.5 rounded-full">
            <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider">
              {item.tag_type.replace(/_/g, ' ')}
            </Text>
          </View>
          <View className="bg-darkCard border border-darkBorder px-3 py-1.5 rounded-full">
            <Text className="text-slate-400 text-xs font-medium">{item.category}</Text>
          </View>
        </View>

        {/* Lost Mode Toggle */}
        <View className="bg-darkCard border border-darkBorder rounded-3xl p-5 mb-5">
          <View className="flex-row justify-between items-center">
            <View className="flex-1 pr-4">
              <Text className="text-white font-bold text-base mb-1">Lost Mode</Text>
              <Text className="text-slate-400 text-sm leading-5">
                When enabled, finders will see your contact details when they scan this tag.
              </Text>
            </View>
            <Switch
              value={status === 'lost'}
              onValueChange={(v) => handleUpdateStatus(v ? 'lost' : 'active')}
              trackColor={{ true: '#ef4444', false: '#334155' }}
              thumbColor={status === 'lost' ? '#fca5a5' : '#94a3b8'}
            />
          </View>
          {status === 'lost' && (
            <View className="mt-4 bg-red-500/10 border border-red-500/20 rounded-2xl p-3">
              <Text className="text-red-400 text-xs font-semibold text-center">
                🔴 LOST MODE ACTIVE — Finders can contact you
              </Text>
            </View>
          )}
        </View>

        {/* Passive Tracking Map */}
        <View className="mb-5">
          <Text className="text-white text-base font-bold mb-3">Passive Tracking Map</Text>
          <EntitlementGate requiredTier="pro" featureName="Passive Tracking Map">
            {hasLocation ? (
              <View className="w-full h-48 bg-darkCard border border-darkBorder rounded-3xl overflow-hidden items-center justify-center">
                <Text className="text-5xl mb-3">🗺️</Text>
                <Text className="text-white font-bold text-lg">Last Known Location</Text>
                <Text className="text-primary font-mono text-sm mt-1">
                  {item.last_seen_lat.toFixed(4)}, {item.last_seen_lng.toFixed(4)}
                </Text>
                <Text className="text-slate-500 text-xs mt-2">
                  {new Date(item.last_seen_at).toLocaleTimeString()}
                </Text>
              </View>
            ) : (
              <View className="w-full h-32 bg-darkCard border border-dashed border-slate-700 rounded-3xl items-center justify-center">
                <Text className="text-slate-500 font-medium">No location data yet</Text>
                <Text className="text-slate-600 text-xs mt-1">Data appears after a BLE sighting</Text>
              </View>
            )}
          </EntitlementGate>
        </View>

        {/* NFC Scan History */}
        <Text className="text-white text-base font-bold mb-3">NFC Scan History</Text>
        <View className="bg-darkCard border border-darkBorder rounded-3xl overflow-hidden mb-5">
          {scans.length === 0 ? (
            <View className="p-6 items-center">
              <Text className="text-slate-500 text-sm">No recent scans found</Text>
              <Text className="text-slate-600 text-xs mt-1">Scans appear here when someone taps your tag</Text>
            </View>
          ) : (
            scans.map((scan, i) => (
              <View key={scan.id} className={`p-4 flex-row items-center ${i !== scans.length - 1 ? 'border-b border-slate-700' : ''}`}>
                <View className="w-10 h-10 bg-slate-700 rounded-xl items-center justify-center mr-4">
                  <Text className="text-xl">📍</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-white font-semibold text-sm">{scan.location_label || 'Unknown location'}</Text>
                  <Text className="text-slate-500 text-xs mt-0.5">{new Date(scan.scanned_at).toLocaleString()}</Text>
                </View>
              </View>
            ))
          )}
          {scans.length > 0 && tier === 'basic' && (
            <View className="bg-amber-500/10 border-t border-amber-500/20 p-3 items-center">
              <Text className="text-amber-400 text-xs font-bold uppercase tracking-wide">
                Showing 7-day history · Upgrade for 30 days
              </Text>
            </View>
          )}
        </View>

        {/* Re-program Tag */}
        <TouchableOpacity
          onPress={handleRewrite}
          className="bg-darkCard border border-primary/30 p-4 rounded-2xl items-center mb-4"
          activeOpacity={0.7}
        >
          <Text className="text-primary font-bold text-base">↺ Re-program Tag</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

import { useEffect, useState } from 'react';
import {
  View, Text, ActivityIndicator, ScrollView, TouchableOpacity,
  Alert, Switch, StatusBar, Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { supabase } from '../../lib/supabase';
import { useItemStore } from '../../stores/itemStore';
import { useSubscriptionStore } from '../../stores/subscriptionStore';
import EntitlementGate from '../../components/subscription/EntitlementGate';

const STATUS_CONFIG: Record<string, { label: string; color: string; border: string; dot: string }> = {
  active:  { label: 'ACTIVE',  color: 'bg-green-100',  border: 'border-green-200',  dot: 'bg-green-500'  },
  lost:    { label: 'LOST',    color: 'bg-red-100',    border: 'border-red-200',    dot: 'bg-red-500'    },
  found:   { label: 'FOUND',   color: 'bg-blue-100',   border: 'border-blue-200',   dot: 'bg-blue-500'   },
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
  const [locationAddress, setLocationAddress] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      const { data: itemData } = await supabase.from('items').select('*').eq('id', id).single();
      if (itemData) {
        setItem(itemData);
        setStatus(itemData.status);

        // Reverse geocode last known location → human-readable address
        if (itemData.last_seen_lat && itemData.last_seen_lng) {
          try {
            const results = await Location.reverseGeocodeAsync({
              latitude: itemData.last_seen_lat,
              longitude: itemData.last_seen_lng,
            });
            if (results.length > 0) {
              const r = results[0];
              const parts = [r.name, r.street, r.district, r.city, r.region].filter(Boolean);
              setLocationAddress(parts.join(', '));
            }
          } catch {
            // non-fatal – fall back to coordinates
          }
        }

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

  // Open native Maps app at the last known location
  const openInMaps = () => {
    if (!item?.last_seen_lat || !item?.last_seen_lng) return;
    const lat = item.last_seen_lat;
    const lng = item.last_seen_lng;
    const label = encodeURIComponent(item.item_name || 'Lost Item');
    // Works on both Android (Google Maps intent) and iOS (Apple Maps)
    const url = `geo:${lat},${lng}?q=${lat},${lng}(${label})`;
    const fallbackUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    Linking.canOpenURL(url)
      .then(supported => Linking.openURL(supported ? url : fallbackUrl))
      .catch(() => Linking.openURL(fallbackUrl));
  };

  if (loading) return (
    <View className="flex-1 bg-slate-50 justify-center items-center">
      <ActivityIndicator size="large" color="#e11d48" />
    </View>
  );
  if (!item) return (
    <View className="flex-1 bg-slate-50 justify-center items-center">
      <Text className="text-slate-500">Item not found</Text>
    </View>
  );

  const sc = STATUS_CONFIG[status] || STATUS_CONFIG.active;
  const hasLocation = item.last_seen_lat && item.last_seen_lng;

  return (
    <View className="flex-1 bg-slate-50">
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 60, paddingTop: 60 }}>
        {/* Back */}
        <TouchableOpacity onPress={() => router.back()} className="mb-6 flex-row items-center" activeOpacity={0.7}>
          <Text className="text-primary text-lg mr-1">←</Text>
          <Text className="text-primary font-semibold">My Items</Text>
        </TouchableOpacity>

        {/* Title Row */}
        <View className="flex-row justify-between items-start mb-3">
          <Text className="text-slate-900 text-3xl font-black flex-1 mr-4" numberOfLines={2}>{item.item_name}</Text>
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={() => router.push(`/edit-item/${id}`)}
              className="bg-primary/10 border border-primary/20 px-4 py-2 rounded-xl"
              activeOpacity={0.7}
            >
              <Text className="text-primary font-bold text-sm">Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleDelete}
              className="bg-red-50 border border-red-200 px-4 py-2 rounded-xl"
              activeOpacity={0.7}
            >
              <Text className="text-red-600 font-bold text-sm">Delete</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tags Row */}
        <View className="flex-row items-center mb-6 gap-2">
          <View className={`flex-row items-center px-3 py-1.5 rounded-full border ${sc.color} ${sc.border}`}>
            <View className={`w-2 h-2 rounded-full mr-2 ${sc.dot}`} />
            <Text className={`text-xs font-bold tracking-widest ${sc.dot.replace('bg-', 'text-').replace('-500', '-700')}`}>
              {sc.label}
            </Text>
          </View>
          <View className="bg-white border border-slate-200 px-3 py-1.5 rounded-full shadow-sm">
            <Text className="text-slate-500 text-xs font-bold uppercase tracking-wider">
              {item.tag_type.replace(/_/g, ' ')}
            </Text>
          </View>
          <View className="bg-white border border-slate-200 px-3 py-1.5 rounded-full shadow-sm">
            <Text className="text-slate-600 text-xs font-medium">{item.category}</Text>
          </View>
        </View>

        {/* Lost Mode Toggle */}
        <View className="bg-white border border-slate-200 rounded-3xl p-5 mb-5 shadow-sm">
          <View className="flex-row justify-between items-center">
            <View className="flex-1 pr-4">
              <Text className="text-slate-900 font-bold text-base mb-1">Lost Mode</Text>
              <Text className="text-slate-500 text-sm leading-5 font-medium">
                When enabled, finders will see your contact details when they scan this tag.
              </Text>
            </View>
            <Switch
              value={status === 'lost'}
              onValueChange={(v) => handleUpdateStatus(v ? 'lost' : 'active')}
              trackColor={{ true: '#fca5a5', false: '#e2e8f0' }}
              thumbColor={status === 'lost' ? '#ef4444' : '#94a3b8'}
            />
          </View>
          {status === 'lost' && (
            <View className="mt-4 bg-red-50 border border-red-200 rounded-2xl p-3">
              <Text className="text-red-700 text-xs font-bold text-center">
                🔴 LOST MODE ACTIVE — Finders can contact you
              </Text>
            </View>
          )}
        </View>

        {/* Removed Passive Tracking Map for now */}

        {/* NFC Scan History */}
        <Text className="text-slate-900 text-base font-bold mb-3">NFC Scan History</Text>
        <View className="bg-white border border-slate-200 rounded-3xl overflow-hidden mb-5 shadow-sm">
          {scans.length === 0 ? (
            <View className="p-6 items-center">
              <Text className="text-slate-500 text-sm font-bold">No recent scans found</Text>
              <Text className="text-slate-400 text-xs mt-1 font-medium">Scans appear here when someone taps your tag</Text>
            </View>
          ) : (
            scans.map((scan, i) => (
              <View key={scan.id} className={`p-4 flex-row items-center ${i !== scans.length - 1 ? 'border-b border-slate-100' : ''}`}>
                <View className="w-10 h-10 bg-slate-100 rounded-xl items-center justify-center mr-4">
                  <Text className="text-xl">📍</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-slate-900 font-semibold text-sm">{scan.location_label || 'Unknown location'}</Text>
                  <Text className="text-slate-500 text-xs mt-0.5 font-medium">{new Date(scan.scanned_at).toLocaleString()}</Text>
                </View>
              </View>
            ))
          )}
          {scans.length > 0 && tier === 'basic' && (
            <View className="bg-amber-50 border-t border-amber-200 p-3 items-center">
              <Text className="text-amber-700 text-xs font-bold uppercase tracking-wide">
                Showing 7-day history · Upgrade for 30 days
              </Text>
            </View>
          )}
        </View>

        {/* Re-program Tag */}
        <TouchableOpacity
          onPress={handleRewrite}
          className="bg-white border border-primary/30 p-4 rounded-2xl items-center mb-4 shadow-sm"
          activeOpacity={0.7}
        >
          <Text className="text-primary font-bold text-base">↺ Re-program Tag</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

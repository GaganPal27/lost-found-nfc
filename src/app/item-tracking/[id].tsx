import { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StatusBar, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { supabase } from '../../lib/supabase';
import { NETWORK_INFO, type NetworkType } from '../../lib/constants';

type PingEvent = {
  id: string;
  source: string;
  pinged_at: string;
  lat: number | null;
  lng: number | null;
  accuracy_metres: number | null;
  beacon_id: string;
};

type Item = {
  id: string;
  item_name: string;
  category: string;
  last_seen_lat: number | null;
  last_seen_lng: number | null;
  last_seen_at: string | null;
  last_seen_location: string | null;
  last_seen_source: string | null;
  status: string;
  tracking_networks: string[];
  ble_beacon_id: string | null;
  nfc_uid: string | null;
};

export default function ItemTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<Item | null>(null);
  const [pings, setPings] = useState<PingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    
    // Fetch item
    const { data: itemData } = await supabase.from('items').select('*').eq('id', id).single();
    if (itemData) setItem(itemData as Item);

    // Fetch pings from ble_pings (multi-source) + nfc_scans
    const allPings: PingEvent[] = [];

    // BLE pings (all sources: app_relay, fmdn, openhaystack)
    if (itemData?.ble_beacon_id) {
      const { data: blePings } = await supabase
        .from('ble_pings')
        .select('id, source, pinged_at, lat, lng, accuracy_metres, beacon_id')
        .eq('beacon_id', itemData.ble_beacon_id)
        .order('pinged_at', { ascending: false })
        .limit(50);
      
      if (blePings) allPings.push(...(blePings as PingEvent[]));

      // Also check FMDN/OpenHaystack-specific beacon IDs
      const { data: fmdnPings } = await supabase
        .from('ble_pings')
        .select('id, source, pinged_at, lat, lng, accuracy_metres, beacon_id')
        .or(`beacon_id.eq.fmdn-${id},beacon_id.eq.ofha-${id}`)
        .order('pinged_at', { ascending: false })
        .limit(50);
      
      if (fmdnPings) allPings.push(...(fmdnPings as PingEvent[]));
    }

    // NFC scans
    if (itemData?.nfc_uid) {
      const { data: nfcScans } = await supabase
        .from('nfc_scans')
        .select('id, scanned_at, lat, lng, location_label')
        .eq('nfc_uid', itemData.nfc_uid)
        .order('scanned_at', { ascending: false })
        .limit(20);
      
      if (nfcScans) {
        allPings.push(...nfcScans.map(s => ({
          id: s.id,
          source: 'nfc_scan',
          pinged_at: s.scanned_at,
          lat: s.lat,
          lng: s.lng,
          accuracy_metres: null,
          beacon_id: itemData.nfc_uid || '',
        })));
      }
    }

    // Sort by timestamp descending and deduplicate
    allPings.sort((a, b) => new Date(b.pinged_at).getTime() - new Date(a.pinged_at).getTime());
    
    // Deduplicate by id
    const seen = new Set();
    const deduped = allPings.filter(p => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });

    setPings(deduped);
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const filteredPings = selectedSource
    ? pings.filter(p => p.source === selectedSource)
    : pings;

  const pingsWithLocation = filteredPings.filter(p => p.lat && p.lng);

  const formatDate = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatTimeAgo = (ts: string) => {
    const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
    return `${Math.floor(mins / 1440)}d ago`;
  };

  const getSourceInfo = (source: string) => {
    if (source === 'nfc_scan') return { icon: '📱', name: 'NFC Scan', color: '#f97316' };
    return NETWORK_INFO[source as NetworkType] || { icon: '📡', shortName: source, color: '#06b6d4' };
  };

  const hasLocation = item?.last_seen_lat && item?.last_seen_lng;
  const lastSourceInfo = item?.last_seen_source ? getSourceInfo(item.last_seen_source) : null;

  const initialRegion = hasLocation
    ? {
        latitude: item!.last_seen_lat!,
        longitude: item!.last_seen_lng!,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : {
        latitude: 28.6139,
        longitude: 77.2090,
        latitudeDelta: 0.5,
        longitudeDelta: 0.5,
      };

  // Count pings by source
  const sourceCounts: Record<string, number> = {};
  pings.forEach(p => {
    sourceCounts[p.source] = (sourceCounts[p.source] || 0) + 1;
  });

  if (loading) {
    return (
      <View className="flex-1 bg-slate-50 items-center justify-center">
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator color="#e11d48" size="large" />
        <Text className="text-slate-500 mt-4 font-medium">Loading tracking data...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50">
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View className="px-6 pt-14 pb-4 border-b border-slate-200 bg-white shadow-sm z-10">
        <TouchableOpacity onPress={() => router.back()} className="flex-row items-center mb-3" activeOpacity={0.7}>
          <Text className="text-primary text-lg mr-1">←</Text>
          <Text className="text-primary font-semibold">Back</Text>
        </TouchableOpacity>
        <Text className="text-slate-500 text-xs uppercase tracking-widest mb-1 font-bold">Multi-Network Tracking</Text>
        <Text className="text-slate-900 text-2xl font-black">{item?.item_name ?? 'Item'}</Text>
        {item?.last_seen_at && (
          <View className="flex-row items-center mt-1">
            {lastSourceInfo && <Text className="mr-1">{lastSourceInfo.icon}</Text>}
            <Text className="text-slate-500 text-sm font-medium">
              Last seen: {formatTimeAgo(item.last_seen_at)}
              {item.last_seen_location ? ` · ${item.last_seen_location}` : ''}
              {item.last_seen_source ? ` via ${getSourceInfo(item.last_seen_source).name || getSourceInfo(item.last_seen_source).shortName}` : ''}
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#06b6d4" colors={['#06b6d4']} />}
      >
        {/* Map */}
        <View style={{ height: 320 }}>
          {hasLocation ? (
            <MapView
              style={{ flex: 1 }}
              provider={PROVIDER_GOOGLE}
              initialRegion={initialRegion}
              mapType="standard"
              customMapStyle={lightMapStyle}
            >
              {/* Last known position */}
              <Circle
                center={{ latitude: item!.last_seen_lat!, longitude: item!.last_seen_lng! }}
                radius={200}
                strokeColor="#e11d48"
                fillColor="rgba(225,29,72,0.15)"
                strokeWidth={2}
              />
              <Marker
                coordinate={{ latitude: item!.last_seen_lat!, longitude: item!.last_seen_lng! }}
                title={item?.item_name}
                description={item?.last_seen_location ?? 'Last known location'}
              >
                <View className="bg-primary w-10 h-10 rounded-full items-center justify-center border-2 border-white"
                  style={{ shadowColor: '#e11d48', shadowOpacity: 0.5, shadowRadius: 8, elevation: 5 }}>
                  <Text className="text-lg">📍</Text>
                </View>
              </Marker>

              {/* Historical pings as smaller markers */}
              {pingsWithLocation.slice(0, 20).map((ping, i) => {
                if (i === 0 && ping.lat === item!.last_seen_lat && ping.lng === item!.last_seen_lng) return null;
                const srcInfo = getSourceInfo(ping.source);
                return (
                  <Marker
                    key={ping.id}
                    coordinate={{ latitude: ping.lat!, longitude: ping.lng! }}
                    title={`${srcInfo.icon} ${srcInfo.name || srcInfo.shortName}`}
                    description={formatDate(ping.pinged_at)}
                    opacity={0.6}
                  >
                    <View
                      style={{
                        width: 16, height: 16, borderRadius: 8,
                        backgroundColor: srcInfo.color,
                        borderWidth: 2, borderColor: '#fff',
                      }}
                    />
                  </Marker>
                );
              })}
            </MapView>
          ) : (
            <View className="flex-1 bg-slate-200 items-center justify-center border-b border-slate-300">
              <Text className="text-4xl mb-3">🗺️</Text>
              <Text className="text-slate-900 font-bold mb-1 text-lg">No Location Data Yet</Text>
              <Text className="text-slate-500 text-sm text-center px-8 font-medium">
                Location will appear here once a phone relays your beacon's signal.
              </Text>
            </View>
          )}
        </View>

        {/* Status + Network Coverage */}
        <View className="px-5 pt-5">
          <View className="flex-row items-center mb-4">
            {/* Status Badge */}
            <View className={`px-4 py-2 rounded-full border flex-row items-center mr-3 ${
              item?.status === 'active'  ? 'bg-green-50 border-green-200' :
              item?.status === 'lost'   ? 'bg-red-50 border-red-200' :
              item?.status === 'found'  ? 'bg-blue-50 border-blue-200' :
              'bg-slate-100 border-slate-200'
            }`}>
              <Text className={`text-sm font-bold uppercase tracking-wider ${
                item?.status === 'active' ? 'text-green-700' :
                item?.status === 'lost'   ? 'text-red-700' :
                item?.status === 'found'  ? 'text-blue-700' :
                'text-slate-600'
              }`}>
                {item?.status === 'active' ? '● Safe' :
                 item?.status === 'lost'   ? '⚠ Lost' :
                 item?.status === 'found'  ? '✓ Found' : item?.status}
              </Text>
            </View>

            {/* Active Networks */}
            {item?.tracking_networks?.map((net) => {
              const info = NETWORK_INFO[net as NetworkType];
              if (!info) return null;
              return (
                <View key={net} className="bg-white border border-slate-200 px-3 py-1.5 rounded-full mr-2 shadow-sm">
                  <Text className="text-slate-700 text-xs font-bold">{info.icon} {info.shortName}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Source Filter */}
        <View className="px-5 mb-3">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => setSelectedSource(null)}
                className={`px-4 py-2 rounded-full border shadow-sm ${
                  !selectedSource ? 'bg-primary/10 border-primary/20' : 'bg-white border-slate-200'
                }`}
              >
                <Text className={`font-bold text-sm ${!selectedSource ? 'text-primary' : 'text-slate-500'}`}>
                  All ({pings.length})
                </Text>
              </TouchableOpacity>
              {Object.entries(sourceCounts).map(([source, count]) => {
                const info = getSourceInfo(source);
                return (
                  <TouchableOpacity
                    key={source}
                    onPress={() => setSelectedSource(selectedSource === source ? null : source)}
                    className={`px-4 py-2 rounded-full border flex-row items-center shadow-sm ${
                      selectedSource === source ? 'bg-primary/10 border-primary/20' : 'bg-white border-slate-200'
                    }`}
                  >
                    <Text className="mr-1">{info.icon}</Text>
                    <Text className={`font-bold text-sm ${selectedSource === source ? 'text-primary' : 'text-slate-500'}`}>
                      {info.name || info.shortName} ({count})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* Sighting History */}
        <View className="px-5 pt-3 pb-24">
          <Text className="text-slate-500 text-xs uppercase tracking-wider mb-4 font-bold">
            Sighting History {selectedSource ? `(${getSourceInfo(selectedSource).name || getSourceInfo(selectedSource).shortName})` : ''}
          </Text>

          {filteredPings.length === 0 ? (
            <View className="bg-white border border-slate-200 rounded-2xl p-6 items-center shadow-sm">
              <Text className="text-3xl mb-2">📋</Text>
              <Text className="text-slate-900 font-bold mb-1">No sightings recorded</Text>
              <Text className="text-slate-500 text-sm text-center font-medium">
                Sightings from Google FMDN, Apple Find My, NFC scans, and app relays will appear here.
              </Text>
            </View>
          ) : (
            filteredPings.map((ping, idx) => {
              const srcInfo = getSourceInfo(ping.source);
              return (
                <View key={ping.id} className="flex-row mb-4">
                  {/* Timeline line */}
                  <View className="items-center mr-4">
                    <View
                      className="w-4 h-4 rounded-full mt-1"
                      style={{ backgroundColor: srcInfo.color }}
                    />
                    {idx < filteredPings.length - 1 && (
                      <View className="w-0.5 bg-slate-200 flex-1 mt-1" />
                    )}
                  </View>
                  {/* Content */}
                  <View className="flex-1 pb-3">
                    <View className="flex-row items-center mb-0.5">
                      <Text className="text-sm mr-1">{srcInfo.icon}</Text>
                      <Text className="text-slate-900 font-bold text-sm">
                        {srcInfo.name || srcInfo.shortName}
                      </Text>
                      <Text className="text-slate-500 text-xs ml-2 font-medium">{formatTimeAgo(ping.pinged_at)}</Text>
                    </View>
                    <Text className="text-slate-600 text-sm font-medium">{formatDate(ping.pinged_at)}</Text>
                    {ping.lat && ping.lng && (
                      <Text className="text-slate-400 text-xs font-mono mt-0.5">
                        {ping.lat.toFixed(4)}, {ping.lng.toFixed(4)}
                        {ping.accuracy_metres ? ` ±${ping.accuracy_metres}m` : ''}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// Light map style 
const lightMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#f8fafc' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#cbd5e1' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#e2e8f0' }] },
  { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#bae6fd' }] },
];

import { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch, StatusBar, Animated, Easing, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useSubscriptionStore } from '../stores/subscriptionStore';
import { useItemStore } from '../stores/itemStore';
import { useAuthStore } from '../stores/authStore';
import { NETWORK_INFO, PLAN_LIMITS, type NetworkType } from '../lib/constants';
import { getTrackingStatus, type NetworkRegistration } from '../lib/fmdn';
import { supabase } from '../lib/supabase';

type NetworkStats = {
  network: NetworkType;
  isActive: boolean;
  lastPingAt: string | null;
  totalPings: number;
  itemsTracked: number;
  itemNames: string[];
};

export default function BLEStatusScreen() {
  const router = useRouter();
  const { tier } = useSubscriptionStore();
  const { user } = useAuthStore();
  const { items } = useItemStore();
  const [bleEnabled, setBleEnabled] = useState(tier === 'pro' || tier === 'max');
  const [networkStats, setNetworkStats] = useState<NetworkStats[]>([]);
  const [recentPings, setRecentPings] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const isPremium = tier === 'pro' || tier === 'max';
  const allowedNetworks = PLAN_LIMITS[tier].trackingNetworks || [];

  // BLE items the user has registered
  const bleItems = items.filter(i => i.tag_type === 'ble_only' || i.tag_type === 'nfc_ble');
  const hasBleItems = bleItems.length > 0;

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
      startWaves();
    } else {
      wave1.stopAnimation(); wave1.setValue(0);
      wave2.stopAnimation(); wave2.setValue(0);
      wave3.stopAnimation(); wave3.setValue(0);
    }
  }, [bleEnabled, isPremium]);

  // Load real stats
  const loadStats = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      // Get pings per source
      const stats: NetworkStats[] = [];
      
      for (const networkKey of ['fmdn', 'openhaystack', 'app_relay'] as NetworkType[]) {
        const { count } = await supabase
          .from('ble_pings')
          .select('*', { count: 'exact', head: true })
          .eq('source', networkKey);

        const { data: latestPing } = await supabase
          .from('ble_pings')
          .select('pinged_at')
          .eq('source', networkKey)
          .order('pinged_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Count items registered on this network + fetch names
        let itemsOnNetwork = 0;
        let itemNames: string[] = [];
        if (networkKey === 'app_relay') {
          itemsOnNetwork = bleItems.length;
          itemNames = bleItems.map((i: any) => i.item_name || 'Unnamed').slice(0, 5);
        } else {
          const { data: keyRows } = await supabase
            .from('beacon_keys')
            .select('item_id, items(item_name)')
            .eq('network', networkKey)
            .eq('is_active', true)
            .limit(5);
          itemsOnNetwork = keyRows?.length || 0;
          itemNames = (keyRows || []).map((r: any) => r.items?.item_name || 'Unnamed');
        }

        // LIVE = tier allows it AND toggle on AND user has at least one item on this network
        const isActive = allowedNetworks.includes(networkKey) && bleEnabled && itemsOnNetwork > 0;

        stats.push({
          network: networkKey,
          isActive,
          lastPingAt: latestPing?.pinged_at || null,
          totalPings: count || 0,
          itemsTracked: itemsOnNetwork,
          itemNames,
        });
      }

      setNetworkStats(stats);

      // Get recent pings across all sources
      const { data: pings } = await supabase
        .from('ble_pings')
        .select('id, beacon_id, source, lat, lng, accuracy_metres, pinged_at')
        .order('pinged_at', { ascending: false })
        .limit(10);

      setRecentPings(pings || []);
    } catch (err) {
      console.warn('Failed to load BLE stats:', err);
    } finally {
      setLoading(false);
    }
  }, [user, items, bleEnabled, tier]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  const waveScale = (anim: Animated.Value) => anim.interpolate({ inputRange: [0, 1], outputRange: [1, 3.5] });
  const waveOp = (anim: Animated.Value) => anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.5, 0.15, 0] });

  const formatTimeAgo = (ts: string | null) => {
    if (!ts) return 'Never';
    const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
    return `${Math.floor(mins / 1440)}d ago`;
  };

  const totalPings = networkStats.reduce((sum, n) => sum + n.totalPings, 0);
  const activeNetworks = networkStats.filter(n => n.isActive).length;
  const totalTrackedItems = new Set(networkStats.flatMap(n => Array(n.itemsTracked).fill(0))).size || 
    networkStats.reduce((max, n) => Math.max(max, n.itemsTracked), 0);

  return (
    <View className="flex-1 bg-slate-50">
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 60, paddingTop: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#06b6d4" />}
      >
        {/* Back */}
        <TouchableOpacity onPress={() => router.back()} className="mb-6 flex-row items-center" activeOpacity={0.7}>
          <Text className="text-primary text-lg mr-1">←</Text>
          <Text className="text-primary font-semibold">Profile</Text>
        </TouchableOpacity>

        <Text className="text-slate-500 text-xs uppercase tracking-widest mb-2 font-bold">Multi-Network</Text>
        <Text className="text-slate-900 text-3xl font-black mb-2">Tracking Networks</Text>
        <Text className="text-slate-600 text-sm mb-8 leading-6 font-medium">
          Your items are tracked by billions of phones worldwide — no app needed on the finder's device.
        </Text>

        {/* Visualizer */}
        <View className="items-center mb-8">
          <View style={{ width: 200, height: 200, alignItems: 'center', justifyContent: 'center' }}>
            {[wave1, wave2, wave3].map((w, i) => (
              <Animated.View
                key={i}
                style={{
                  position: 'absolute',
                  width: 100, height: 100,
                  borderRadius: 50,
                  borderWidth: 1.5,
                  borderColor: isPremium && bleEnabled ? '#e11d48' : '#e2e8f0',
                  opacity: waveOp(w),
                  transform: [{ scale: waveScale(w) }],
                }}
              />
            ))}
            <View
              className={`w-24 h-24 rounded-full items-center justify-center border-2 ${
                isPremium && bleEnabled ? 'bg-primary/10 border-primary/30' : 'bg-white border-slate-200'
              }`}
              style={{
                shadowColor: isPremium && bleEnabled ? '#e11d48' : 'transparent',
                shadowOpacity: 0.2,
                shadowRadius: 16,
                elevation: 6,
              }}
            >
              <Text className="text-4xl">🌐</Text>
            </View>
          </View>

          <View className={`flex-row items-center px-4 py-2 rounded-full border mt-4 ${
            isPremium && bleEnabled
              ? 'bg-blue-50 border-blue-200'
              : 'bg-slate-50 border-slate-200'
          }`}>
            <View className={`w-2 h-2 rounded-full mr-2 ${isPremium && bleEnabled ? 'bg-blue-500' : 'bg-slate-400'}`} />
            <Text className={`font-bold text-sm ${isPremium && bleEnabled ? 'text-blue-700' : 'text-slate-500'}`}>
              {isPremium && bleEnabled ? `${activeNetworks} NETWORKS ACTIVE` : 'INACTIVE'}
            </Text>
          </View>
        </View>

        {/* Master Toggle */}
        <View className="bg-white border border-slate-200 rounded-3xl p-5 mb-5 shadow-sm">
          <View className="flex-row justify-between items-center">
            <View className="flex-1 pr-4">
              <Text className="text-slate-900 font-bold text-base mb-1">Multi-Network Tracking</Text>
              <Text className="text-slate-500 text-sm leading-5 font-medium">
                {isPremium
                  ? 'Enable passive tracking via global phone networks.'
                  : 'Available with Pro or Max plan.'}
              </Text>
            </View>
            <Switch
              value={bleEnabled && isPremium}
              onValueChange={v => isPremium ? setBleEnabled(v) : router.push('/subscription')}
              trackColor={{ true: '#e11d48', false: '#e2e8f0' }}
              thumbColor={bleEnabled && isPremium ? '#ffffff' : '#f1f5f9'}
            />
          </View>
          {!isPremium && (
            <TouchableOpacity
              onPress={() => router.push('/subscription')}
              className="bg-primary/10 border border-primary/20 rounded-2xl p-3 mt-4 items-center shadow-sm"
              activeOpacity={0.7}
            >
              <Text className="text-primary font-bold text-sm">⬆ Upgrade to Activate Multi-Network</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Network Cards */}
        <View className="mb-5">
          <Text className="text-slate-500 text-xs uppercase tracking-wider mb-3 font-bold">Tracking Layers</Text>
          
          {(['fmdn', 'openhaystack', 'app_relay'] as NetworkType[]).map((networkKey) => {
            const info = NETWORK_INFO[networkKey];
            const stat = networkStats.find(n => n.network === networkKey);
            const isAllowed = allowedNetworks.includes(networkKey);
            const isActive = isAllowed && bleEnabled && isPremium;
            const isLocked = !isAllowed && isPremium;
            const needsUpgrade = !isPremium;
            
            return (
              <View
                key={networkKey}
                className={`bg-white border rounded-3xl p-5 mb-3 shadow-sm ${
                  isActive ? 'border-primary/30' : 'border-slate-200'
                }`}
                style={isActive ? { shadowColor: info.color, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 } : {}}
              >
                <View className="flex-row items-center mb-3">
                  <View className={`w-12 h-12 rounded-2xl items-center justify-center mr-4 ${
                    isActive ? 'bg-primary/10 border border-primary/20' : 'bg-slate-50 border border-slate-200'
                  }`}>
                    <Text className="text-2xl">{info.icon}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-slate-900 font-bold text-base">{info.name}</Text>
                    <Text className="text-slate-500 text-xs font-medium">{info.deviceCount}</Text>
                  </View>
                  <View className={`px-3 py-1 rounded-full ${
                    isActive ? 'bg-green-100' :
                    isLocked ? 'bg-amber-100' :
                    needsUpgrade ? 'bg-slate-100' :
                    'bg-slate-100'
                  }`}>
                    <Text className={`text-xs font-bold ${
                      isActive ? 'text-green-700' :
                      isLocked ? 'text-amber-700' :
                      'text-slate-600'
                    }`}>
                      {isActive ? '● LIVE' :
                       isLocked ? '🔒 MAX' :
                       needsUpgrade ? '🔒 PRO+' :
                       'OFF'}
                    </Text>
                  </View>
                </View>

                <Text className="text-slate-600 text-sm leading-5 mb-3 font-medium">{info.description}</Text>

                {isActive && stat && (
                  <View className="flex-row bg-slate-50 border border-slate-100 rounded-2xl p-3 mb-2 shadow-sm">
                    <View className="flex-1 items-center">
                      <Text className="text-primary font-black text-lg">{stat.totalPings}</Text>
                      <Text className="text-slate-500 text-xs font-bold uppercase tracking-wide">Pings</Text>
                    </View>
                    <View className="w-px bg-slate-200 mx-2" />
                    <View className="flex-1 items-center">
                      <Text className="text-primary font-black text-lg">{stat.itemsTracked}</Text>
                      <Text className="text-slate-500 text-xs font-bold uppercase tracking-wide">Items</Text>
                    </View>
                    <View className="w-px bg-slate-200 mx-2" />
                    <View className="flex-1 items-center">
                      <Text className="text-primary font-black text-lg">{formatTimeAgo(stat.lastPingAt)}</Text>
                      <Text className="text-slate-500 text-xs font-bold uppercase tracking-wide">Last ping</Text>
                    </View>
                  </View>
                )}

                {/* Item names list */}
                {isActive && stat && stat.itemNames.length > 0 && (
                  <View className="mt-1">
                    <Text className="text-slate-500 text-xs uppercase tracking-wider mb-2 font-bold">Tracked Items</Text>
                    {stat.itemNames.map((name, idx) => (
                      <View key={idx} className="flex-row items-center py-1.5 border-t border-slate-100">
                        <View className="w-1.5 h-1.5 rounded-full bg-primary mr-3" />
                        <Text className="text-slate-700 text-sm font-semibold">{name}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {isActive && stat && stat.itemsTracked === 0 && (
                  <View className="bg-slate-50 border border-slate-100 rounded-xl p-3 mt-1 items-center shadow-sm">
                    <Text className="text-slate-500 text-xs text-center font-medium">No items on this network yet.{networkKey === 'app_relay' ? '\nRegister a BLE or NFC+BLE item to start.' : '\nKeys will register after next firmware sync.'}</Text>
                  </View>
                )}

                {isLocked && (
                  <TouchableOpacity
                    onPress={() => router.push('/subscription')}
                    className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-2.5 items-center"
                    activeOpacity={0.7}
                  >
                    <Text className="text-amber-400 font-bold text-xs">Upgrade to Max for Apple Find My</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>

        {/* Global Stats */}
        <View className="bg-white border border-slate-200 rounded-3xl p-5 mb-5 shadow-sm">
          <Text className="text-slate-500 text-xs uppercase tracking-wider mb-4 font-bold">Global Tracking Stats</Text>
          <View className="flex-row">
            {[
              { val: isPremium && bleEnabled ? String(totalPings) : '--', label: 'Total sightings' },
              { val: isPremium && bleEnabled ? String(activeNetworks) : '--', label: 'Active networks' },
              { val: isPremium && bleEnabled ? String(totalTrackedItems) : '--', label: 'Items tracked' },
            ].map((s, i) => (
              <View key={i} className="flex-1 items-center">
                <Text className={`text-2xl font-black mb-1 ${isPremium && bleEnabled ? 'text-primary' : 'text-slate-400'}`}>
                  {s.val}
                </Text>
                <Text className="text-slate-500 text-xs text-center font-bold uppercase">{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Recent Activity */}
        {isPremium && bleEnabled && recentPings.length > 0 && (
          <View className="bg-white border border-slate-200 rounded-3xl overflow-hidden mb-5 shadow-sm">
            <View className="px-5 pt-4 pb-3 border-b border-slate-100 bg-slate-50">
              <Text className="text-slate-500 text-xs uppercase tracking-wider font-bold">Recent Sightings</Text>
            </View>
            {recentPings.slice(0, 5).map((ping, i) => {
              const netInfo = NETWORK_INFO[ping.source as NetworkType] || NETWORK_INFO.app_relay;
              return (
                <View key={ping.id} className={`px-5 py-4 flex-row items-center bg-white ${i < Math.min(recentPings.length, 5) - 1 ? 'border-b border-slate-100' : ''}`}>
                  <View className="w-10 h-10 bg-slate-100 border border-slate-200 rounded-xl items-center justify-center mr-4 shadow-sm">
                    <Text className="text-lg">{netInfo.icon}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-slate-900 font-bold text-sm">{netInfo.shortName}</Text>
                    <Text className="text-slate-500 text-xs mt-0.5 font-medium">
                      {ping.lat?.toFixed(4)}, {ping.lng?.toFixed(4)} · {formatTimeAgo(ping.pinged_at)}
                    </Text>
                  </View>
                  <View className={`w-2 h-2 rounded-full`} style={{ backgroundColor: netInfo.color, shadowColor: netInfo.color, shadowOpacity: 0.5, shadowRadius: 4 }} />
                </View>
              );
            })}
          </View>
        )}

        {/* How it works */}
        <View className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
          <Text className="text-slate-500 text-xs uppercase tracking-wider mb-3 font-bold">How Multi-Network Tracking Works</Text>
          {[
            { icon: '📡', text: 'Your beacon broadcasts signals that Android and iPhone networks understand — no app needed on finder devices.' },
            { icon: '🌐', text: '~4.8 billion phones worldwide relay your beacon\'s encrypted location to Google and Apple servers automatically.' },
            { icon: '🔓', text: 'Our backend polls these servers, decrypts the reports with your private keys, and updates your item\'s location.' },
            { icon: '🔒', text: 'End-to-end encryption: only you can decrypt your item\'s location. Neither Google, Apple, nor we can read other users\' reports.' },
          ].map((info, i) => (
            <View key={i} className={`flex-row py-3 ${i !== 3 ? 'border-b border-slate-100' : ''}`}>
              <Text className="text-xl mr-4">{info.icon}</Text>
              <Text className="text-slate-600 text-sm leading-5 flex-1 font-medium">{info.text}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

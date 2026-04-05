import { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StatusBar, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../stores/authStore';
import { useSubscriptionStore } from '../stores/subscriptionStore';
import { useItemStore } from '../stores/itemStore';
import { PLAN_LIMITS } from '../lib/constants';
import { supabase } from '../lib/supabase';

const PLAN_FEATURES = {
  basic: ['Up to 2 items', 'NFC tags only', '7-day scan history', 'Basic notifications'],
  pro: ['Up to 10 items', 'NFC + BLE tags', '30-day scan history', 'Passive BLE tracking', 'Priority alerts'],
  max: ['Unlimited items', 'All tag types', '90-day scan history', 'Passive BLE tracking', 'Priority alerts', 'Live location sharing'],
};

export default function ProfileScreen() {
  const { user, setSession } = useAuthStore();
  const { tier } = useSubscriptionStore();
  const { itemsCount } = useItemStore();
  const router = useRouter();

  const fadeIn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    router.replace('/login');
  };

  const getTierConfig = () => {
    if (tier === 'max') return { label: 'MAX', bg: 'bg-purple-500/20', border: 'border-purple-500/40', text: 'text-purple-300', dot: 'bg-purple-400' };
    if (tier === 'pro') return { label: 'PRO', bg: 'bg-cyan-500/20', border: 'border-cyan-500/40', text: 'text-cyan-300', dot: 'bg-cyan-400' };
    return { label: 'BASIC', bg: 'bg-slate-700/50', border: 'border-slate-600', text: 'text-slate-300', dot: 'bg-slate-400' };
  };

  const tierConfig = getTierConfig();
  const maxItems = PLAN_LIMITS[tier].maxItems;
  const progressPct = maxItems === Infinity ? 0 : Math.min((itemsCount / maxItems) * 100, 100);

  const initials = user?.email?.[0]?.toUpperCase() || 'U';

  return (
    <View className="flex-1 bg-darkBg">
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View className="px-6 pt-14 pb-6 flex-row justify-between items-center">
          <Text className="text-white text-2xl font-bold">Profile</Text>
          <TouchableOpacity onPress={() => router.back()} className="bg-darkCard border border-darkBorder px-4 py-2 rounded-full" activeOpacity={0.7}>
            <Text className="text-slate-300 font-semibold text-sm">✕ Close</Text>
          </TouchableOpacity>
        </View>

        <Animated.View style={{ opacity: fadeIn }}>
          {/* Avatar Card */}
          <View className="mx-6 bg-darkCard border border-darkBorder rounded-3xl p-6 mb-5 items-center">
            <View className="w-24 h-24 bg-slate-700 rounded-full items-center justify-center mb-4 border-2 border-primary">
              <Text className="text-4xl text-white font-bold">{initials}</Text>
            </View>
            <Text className="text-white font-bold text-lg mb-1">{user?.email}</Text>
            <View className={`flex-row items-center px-4 py-1.5 rounded-full border mt-2 ${tierConfig.bg} ${tierConfig.border}`}>
              <View className={`w-2 h-2 rounded-full mr-2 ${tierConfig.dot}`} />
              <Text className={`font-bold text-xs tracking-widest uppercase ${tierConfig.text}`}>{tierConfig.label} PLAN</Text>
            </View>
          </View>

          {/* Plan Usage */}
          <View className="mx-6 bg-darkCard border border-darkBorder rounded-3xl p-6 mb-5">
            <Text className="text-slate-400 text-xs uppercase tracking-wider mb-4 font-semibold">Plan Usage</Text>
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-white font-semibold">Items Protected</Text>
              <Text className="text-primary font-bold">
                {itemsCount} / {maxItems === Infinity ? '∞' : maxItems}
              </Text>
            </View>
            {maxItems !== Infinity && (
              <View className="h-2 bg-slate-700 rounded-full overflow-hidden mb-4">
                <View
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${progressPct}%` }}
                />
              </View>
            )}
            {tier !== 'max' && (
              <TouchableOpacity
                onPress={() => router.push('/subscription')}
                className="bg-primary/15 border border-primary/30 p-4 rounded-2xl items-center mt-2"
                activeOpacity={0.7}
              >
                <Text className="text-primary font-bold tracking-wide">⬆ Upgrade Plan</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Device Capabilities */}
          <View className="mx-6 bg-darkCard border border-darkBorder rounded-3xl p-6 mb-5">
            <Text className="text-slate-400 text-xs uppercase tracking-wider mb-4 font-semibold">Device Capabilities</Text>

            <TouchableOpacity
              className="flex-row justify-between items-center py-4 border-b border-slate-700"
              activeOpacity={0.7}
            >
              <View className="flex-row items-center">
                <Text className="text-xl mr-3">📱</Text>
                <Text className="text-white font-semibold">NFC Support</Text>
              </View>
              <View className="flex-row items-center bg-green-500/15 border border-green-500/30 px-3 py-1.5 rounded-full">
                <View className="w-2 h-2 rounded-full bg-green-400 mr-2" />
                <Text className="text-green-400 text-xs font-bold tracking-wider">READY</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-row justify-between items-center py-4"
              onPress={() => router.push('/ble-status')}
              activeOpacity={0.7}
            >
              <View className="flex-row items-center">
                <Text className="text-xl mr-3">📡</Text>
                <View>
                  <Text className="text-white font-semibold">BLE Relay Network</Text>
                  <Text className="text-slate-500 text-xs">Tap to view status</Text>
                </View>
              </View>
              {tier === 'pro' || tier === 'max' ? (
                <View className="flex-row items-center bg-cyan-500/15 border border-cyan-500/30 px-3 py-1.5 rounded-full">
                  <View className="w-2 h-2 rounded-full bg-cyan-400 mr-2" />
                  <Text className="text-cyan-400 text-xs font-bold tracking-wider">ACTIVE</Text>
                </View>
              ) : (
                <View className="flex-row items-center bg-slate-700/50 border border-slate-600 px-3 py-1.5 rounded-full">
                  <View className="w-2 h-2 rounded-full bg-slate-500 mr-2" />
                  <Text className="text-slate-400 text-xs font-bold tracking-wider">INACTIVE</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Current Plan Features */}
          <View className="mx-6 bg-darkCard border border-darkBorder rounded-3xl p-6 mb-5">
            <Text className="text-slate-400 text-xs uppercase tracking-wider mb-4 font-semibold">Your Plan Includes</Text>
            {(PLAN_FEATURES[tier as keyof typeof PLAN_FEATURES] || PLAN_FEATURES.basic).map((feat, i) => (
              <View key={i} className="flex-row items-center py-2">
                <Text className="text-primary font-bold mr-3">✓</Text>
                <Text className="text-slate-300">{feat}</Text>
              </View>
            ))}
          </View>

          {/* Log Out */}
          <TouchableOpacity
            onPress={handleLogout}
            className="mx-6 bg-red-500/10 border border-red-500/25 p-4 rounded-2xl items-center mb-5"
            activeOpacity={0.7}
          >
            <Text className="text-red-400 font-bold text-base tracking-wide">Log Out</Text>
          </TouchableOpacity>

          <Text className="text-slate-700 text-xs text-center">Lost & Found Network v1.0.0</Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

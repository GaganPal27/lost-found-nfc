import { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StatusBar, Animated, TextInput, Alert, ActivityIndicator } from 'react-native';
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
  const { user, dbUser, setSession } = useAuthStore();
  const { tier } = useSubscriptionStore();
  const { itemsCount } = useItemStore();
  const router = useRouter();

  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const fadeIn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    router.replace('/login');
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      '⚠️ Delete Account',
      'This will permanently delete your account and ALL your data including items, messages, and history. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Delete My Account',
          style: 'destructive',
          onPress: confirmDeleteAccount,
        },
      ]
    );
  };

  const confirmDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      // Call the secure Edge Function (uses service-role key server-side)
      const res = await fetch(
        `${(supabase as any).supabaseUrl}/functions/v1/delete-account`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Deletion failed');

      // Clear local session
      setSession(null);
      Alert.alert(
        '✅ Account Deleted',
        'Your account and all associated data have been permanently deleted. Thank you for using Poki.',
        [{ text: 'OK', onPress: () => router.replace('/login') }]
      );
    } catch (err: any) {
      Alert.alert('Error', `Could not delete account: ${err.message}\n\nPlease contact gaganpal101722@gmail.com for manual deletion.`);
    } finally {
      setDeletingAccount(false);
    }
  };

  const getTierConfig = () => {
    if (tier === 'max') return { label: 'MAX', bg: 'bg-red-100', border: 'border-red-200', text: 'text-red-700', dot: 'bg-red-500' };
    if (tier === 'pro') return { label: 'PRO', bg: 'bg-blue-100', border: 'border-blue-200', text: 'text-blue-700', dot: 'bg-blue-500' };
    return { label: 'BASIC', bg: 'bg-slate-100', border: 'border-slate-200', text: 'text-slate-600', dot: 'bg-slate-500' };
  };

  const tierConfig = getTierConfig();
  const maxItems = PLAN_LIMITS[tier].maxItems;
  const progressPct = maxItems === Infinity ? 0 : Math.min((itemsCount / maxItems) * 100, 100);

  const displayName = dbUser?.full_name || user?.email?.split('@')[0] || 'User';
  const initials = displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  const memberSince = dbUser?.created_at ? new Date(dbUser.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Recently';

  const handleSaveName = async () => {
    if (!tempName.trim()) return;
    setSavingName(true);
    const { error } = await supabase.from('users').update({ full_name: tempName.trim() }).eq('id', dbUser?.id);
    setSavingName(false);
    if (error) {
      Alert.alert('Error', 'Could not update name.');
    } else {
      setEditingName(false);
      // Force refresh of auth store session to update dbUser
      const { data: { session } } = await supabase.auth.getSession();
      useAuthStore.getState().setSession(session);
    }
  };

  return (
    <View className="flex-1 bg-slate-50">
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={{ paddingBottom: 160 }}>
        {/* Header */}
        <View className="px-6 pt-14 pb-6 flex-row justify-between items-center">
          <Text className="text-slate-900 text-2xl font-black">Profile</Text>
          <TouchableOpacity onPress={() => router.back()} className="bg-white border border-slate-200 px-4 py-2 rounded-full shadow-sm" activeOpacity={0.7}>
            <Text className="text-slate-600 font-semibold text-sm">✕ Close</Text>
          </TouchableOpacity>
        </View>

        <Animated.View style={{ opacity: fadeIn }}>
          {/* Avatar Card */}
          <View className="mx-6 bg-white border border-slate-200 rounded-3xl p-6 mb-5 items-center shadow-sm relative">
            {(dbUser?.successful_recoveries || 0) > 0 && (
              <View className="absolute top-4 right-4 bg-yellow-100 border border-yellow-300 px-3 py-1.5 rounded-full flex-row items-center">
                <Text className="mr-1">🏆</Text>
                <Text className="text-yellow-700 font-bold text-xs">TRUSTED</Text>
              </View>
            )}
            
            <View className="w-24 h-24 bg-slate-100 rounded-full items-center justify-center mb-4 border-2 border-primary">
              <Text className="text-4xl text-primary font-black">{initials}</Text>
            </View>

            {editingName ? (
              <View className="w-full flex-row items-center border-b border-slate-300 pb-1 mb-2">
                <TextInput
                  value={tempName}
                  onChangeText={setTempName}
                  className="flex-1 text-center text-slate-900 font-bold text-lg"
                  autoFocus
                  placeholder="Your Name"
                />
                <TouchableOpacity onPress={handleSaveName} disabled={savingName} className="ml-2 bg-primary/10 px-3 py-1 rounded-full">
                  {savingName ? <ActivityIndicator size="small" color="#6366f1" /> : <Text className="text-primary font-bold">Save</Text>}
                </TouchableOpacity>
              </View>
            ) : (
              <View className="flex-row items-center justify-center mb-1 gap-2">
                <Text className="text-slate-900 font-bold text-xl">{displayName}</Text>
                <TouchableOpacity onPress={() => { setTempName(displayName); setEditingName(true); }}>
                  <Text className="text-slate-400">✏️</Text>
                </TouchableOpacity>
              </View>
            )}

            <Text className="text-slate-500 font-medium text-sm mb-1">{user?.email}</Text>
            <Text className="text-slate-400 text-xs mb-2">Joined {memberSince}</Text>

            <View className={`flex-row items-center px-4 py-1.5 rounded-full border mt-2 ${tierConfig.bg} ${tierConfig.border}`}>
              <View className={`w-2 h-2 rounded-full mr-2 ${tierConfig.dot}`} />
              <Text className={`font-bold text-xs tracking-widest uppercase ${tierConfig.text}`}>{tierConfig.label} PLAN</Text>
            </View>
          </View>
          
          {/* Stats */}
          <View className="mx-6 flex-row gap-4 mb-5">
            <View className="flex-1 bg-white border border-slate-200 rounded-3xl p-4 items-center shadow-sm">
              <Text className="text-3xl font-black text-slate-900 mb-1">{itemsCount}</Text>
              <Text className="text-slate-500 text-xs uppercase font-bold text-center">Items{'\n'}Registered</Text>
            </View>
            <View className="flex-1 bg-white border border-slate-200 rounded-3xl p-4 items-center shadow-sm">
              <Text className="text-3xl font-black text-slate-900 mb-1">{dbUser?.successful_recoveries || 0}</Text>
              <Text className="text-slate-500 text-xs uppercase font-bold text-center">Successful{'\n'}Recoveries</Text>
            </View>
          </View>

          {/* Plan Usage */}
          <View className="mx-6 bg-white border border-slate-200 rounded-3xl p-6 mb-5 shadow-sm">
            <Text className="text-slate-500 text-xs uppercase tracking-wider mb-4 font-bold">Plan Usage</Text>
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-slate-900 font-semibold">Items Protected</Text>
              <Text className="text-primary font-bold">
                {itemsCount} / {maxItems === Infinity ? '∞' : maxItems}
              </Text>
            </View>
            {maxItems !== Infinity && (
              <View className="h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
                <View
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${progressPct}%` }}
                />
              </View>
            )}
            {tier !== 'max' && (
              <TouchableOpacity
                onPress={() => router.push('/subscription')}
                className="bg-primary/10 border border-primary/20 p-4 rounded-2xl items-center mt-2"
                activeOpacity={0.7}
              >
                <Text className="text-primary font-bold tracking-wide">⬆ Upgrade Plan</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Device Capabilities */}
          <View className="mx-6 bg-white border border-slate-200 rounded-3xl p-6 mb-5 shadow-sm">
            <Text className="text-slate-500 text-xs uppercase tracking-wider mb-4 font-bold">Device Capabilities</Text>

            <TouchableOpacity
              className="flex-row justify-between items-center py-4 border-b border-slate-100"
              activeOpacity={0.7}
            >
              <View className="flex-row items-center">
                <Text className="text-xl mr-3">📱</Text>
                <Text className="text-slate-900 font-semibold">NFC Support</Text>
              </View>
              <View className="flex-row items-center bg-green-100 border border-green-200 px-3 py-1.5 rounded-full">
                <View className="w-2 h-2 rounded-full bg-green-500 mr-2" />
                <Text className="text-green-700 text-xs font-bold tracking-wider">READY</Text>
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
                  <Text className="text-slate-900 font-semibold">BLE Relay Network</Text>
                  <Text className="text-slate-500 text-xs">Tap to view status</Text>
                </View>
              </View>
              {tier === 'pro' || tier === 'max' ? (
                <View className="flex-row items-center bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-full">
                  <View className="w-2 h-2 rounded-full bg-blue-500 mr-2" />
                  <Text className="text-blue-700 text-xs font-bold tracking-wider">ACTIVE</Text>
                </View>
              ) : (
                <View className="flex-row items-center bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-full">
                  <View className="w-2 h-2 rounded-full bg-slate-400 mr-2" />
                  <Text className="text-slate-600 text-xs font-bold tracking-wider">INACTIVE</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Current Plan Features */}
          <View className="mx-6 bg-white border border-slate-200 rounded-3xl p-6 mb-5 shadow-sm">
            <Text className="text-slate-500 text-xs uppercase tracking-wider mb-4 font-bold">Your Plan Includes</Text>
            {(PLAN_FEATURES[tier as keyof typeof PLAN_FEATURES] || PLAN_FEATURES.basic).map((feat, i) => (
              <View key={i} className="flex-row items-center py-2">
                <Text className="text-primary font-bold mr-3">✓</Text>
                <Text className="text-slate-700">{feat}</Text>
              </View>
            ))}
          </View>

          {/* Admin Portal (Only visible to admins) */}
          {useAuthStore.getState().isAdmin && (
            <TouchableOpacity
              onPress={() => router.push('/admin')}
              className="mx-6 bg-purple-100 border border-purple-200 p-4 rounded-2xl flex-row items-center justify-between mb-5 shadow-sm"
              activeOpacity={0.7}
            >
              <View className="flex-row items-center">
                <Text className="text-2xl mr-3">👑</Text>
                <View>
                  <Text className="text-purple-900 font-bold text-base">Admin Dashboard</Text>
                  <Text className="text-purple-600 text-xs font-medium">Manage users and platform</Text>
                </View>
              </View>
              <Text className="text-purple-700 font-bold">→</Text>
            </TouchableOpacity>
          )}

          {/* Log Out */}
          <TouchableOpacity
            onPress={handleLogout}
            className="mx-6 bg-slate-100 border border-slate-200 p-4 rounded-2xl items-center mb-4 shadow-sm"
            activeOpacity={0.7}
          >
            <Text className="text-slate-700 font-bold text-base tracking-wide">Log Out</Text>
          </TouchableOpacity>

          {/* Legal & Privacy */}
          <View className="mx-6 bg-white border border-slate-200 rounded-3xl overflow-hidden mb-5 shadow-sm">
            <Text className="text-slate-500 text-xs uppercase tracking-wider px-6 pt-5 pb-3 font-bold">Legal & Privacy</Text>
            <TouchableOpacity
              onPress={() => router.push('/privacy-policy')}
              className="flex-row items-center justify-between px-6 py-4 border-b border-slate-100"
              activeOpacity={0.7}
            >
              <View className="flex-row items-center">
                <Text className="text-xl mr-3">🔒</Text>
                <Text className="text-slate-900 font-semibold">Privacy Policy</Text>
              </View>
              <Text className="text-slate-400 font-bold">→</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/terms-of-service')}
              className="flex-row items-center justify-between px-6 py-4"
              activeOpacity={0.7}
            >
              <View className="flex-row items-center">
                <Text className="text-xl mr-3">📄</Text>
                <Text className="text-slate-900 font-semibold">Terms of Service</Text>
              </View>
              <Text className="text-slate-400 font-bold">→</Text>
            </TouchableOpacity>
          </View>

          {/* Delete Account — DPDP Section 12 Right to Erasure */}
          <TouchableOpacity
            onPress={handleDeleteAccount}
            disabled={deletingAccount}
            className="mx-6 bg-red-50 border border-red-200 p-4 rounded-2xl items-center mb-6"
            activeOpacity={0.7}
          >
            {deletingAccount ? (
              <ActivityIndicator color="#ef4444" />
            ) : (
              <Text className="text-red-600 font-bold text-sm tracking-wide">🗑️ Delete My Account & All Data</Text>
            )}
          </TouchableOpacity>

          <Text className="text-slate-400 text-xs text-center font-medium mb-2">Lost & Found Network v1.0.0</Text>
          <Text className="text-slate-400 text-xs text-center px-8 mb-4">DPDP Act 2023 compliant. Your data rights are protected.</Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

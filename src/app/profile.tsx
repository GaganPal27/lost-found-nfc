import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StatusBar, Animated,
  TextInput, Alert, ActivityIndicator, StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../stores/authStore';
import { useSubscriptionStore } from '../stores/subscriptionStore';
import { useItemStore } from '../stores/itemStore';
import { PLAN_LIMITS } from '../lib/constants';
import { supabase } from '../lib/supabase';
import { useTabBarClearance } from '../components/FloatingTabBar';
import { Feather } from '@expo/vector-icons';

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
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();

  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
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
        { text: 'Yes, Delete My Account', style: 'destructive', onPress: confirmDeleteAccount },
      ]
    );
  };

  const confirmDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');
      const res = await fetch(`${(supabase as any).supabaseUrl}/functions/v1/delete-account`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Deletion failed');
      setSession(null);
      Alert.alert('✅ Account Deleted', 'Your account and all data have been deleted. Thank you.', [{ text: 'OK', onPress: () => router.replace('/login') }]);
    } catch (err: any) {
      Alert.alert('Error', `Could not delete account: ${err.message}\n\nPlease contact support.`);
    } finally {
      setDeletingAccount(false);
    }
  };

  const getTierConfig = () => {
    if (tier === 'max') return { label: 'MAX', bg: '#fee2e2', border: '#fecaca', text: '#b91c1c', dot: '#ef4444' };
    if (tier === 'pro') return { label: 'PRO', bg: '#e0e7ff', border: '#c7d2fe', text: '#4338ca', dot: '#3b82f6' };
    return { label: 'BASIC', bg: '#f1f5f9', border: '#e2e8f0', text: '#475569', dot: '#64748b' };
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
    if (error) Alert.alert('Error', 'Could not update name.');
    else {
      setEditingName(false);
      const { data: { session } } = await supabase.auth.getSession();
      useAuthStore.getState().setSession(session);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#6366f1" />
      <ScrollView contentContainerStyle={{ paddingBottom: tabBarClearance + 20 }} showsVerticalScrollIndicator={false}>
        
        {/* ── Gradient Header Background ── */}
        <LinearGradient
          colors={['#6366f1', '#7c3aed']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[styles.headerBg, { paddingTop: insets.top + 16 }]}
        >
          <View style={styles.hCircle1} />
          <View style={styles.hCircle2} />
          
          <View style={styles.headerTop}>
            <Text style={styles.headerTitle}>Profile</Text>
            <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn} activeOpacity={0.8}>
              <Feather name="x" size={20} color="#6366f1" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* ── Body ── */}
        <Animated.View style={[styles.body, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
          
          {/* Avatar Card */}
          <View style={[styles.card, styles.avatarCard]}>
            {(dbUser?.successful_recoveries || 0) > 0 && (
              <View style={styles.trustedBadge}>
                <Text style={{ fontSize: 12, marginRight: 4 }}>🏆</Text>
                <Text style={styles.trustedText}>TRUSTED</Text>
              </View>
            )}
            
            <View style={styles.avatarWrap}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>

            {editingName ? (
              <View style={styles.nameEditRow}>
                <TextInput
                  value={tempName} onChangeText={setTempName}
                  style={styles.nameInput} autoFocus placeholder="Your Name"
                />
                <TouchableOpacity onPress={handleSaveName} disabled={savingName} style={styles.saveBtn} activeOpacity={0.7}>
                  {savingName ? <ActivityIndicator size="small" color="#6366f1" /> : <Text style={styles.saveBtnText}>Save</Text>}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.nameRow}>
                <Text style={styles.displayName}>{displayName}</Text>
                <TouchableOpacity onPress={() => { setTempName(displayName); setEditingName(true); }} hitSlop={{top:10,bottom:10,left:10,right:10}}>
                  <Feather name="edit-2" size={14} color="#94a3b8" />
                </TouchableOpacity>
              </View>
            )}

            <Text style={styles.emailText}>{user?.email}</Text>
            <Text style={styles.joinText}>Joined {memberSince}</Text>

            <View style={[styles.tierPill, { backgroundColor: tierConfig.bg, borderColor: tierConfig.border }]}>
              <View style={[styles.tierDot, { backgroundColor: tierConfig.dot }]} />
              <Text style={[styles.tierText, { color: tierConfig.text }]}>{tierConfig.label} PLAN</Text>
            </View>
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={[styles.card, styles.statCard]}>
              <Text style={styles.statNum}>{itemsCount}</Text>
              <Text style={styles.statLabel}>Items{'\n'}Registered</Text>
            </View>
            <View style={[styles.card, styles.statCard]}>
              <Text style={styles.statNum}>{dbUser?.successful_recoveries || 0}</Text>
              <Text style={styles.statLabel}>Successful{'\n'}Recoveries</Text>
            </View>
          </View>

          {/* Plan Usage */}
          <View style={styles.card}>
            <Text style={styles.sectionEyebrow}>Plan Usage</Text>
            <View style={styles.usageRow}>
              <Text style={styles.usageLabel}>Items Protected</Text>
              <Text style={styles.usageValue}>{itemsCount} / {maxItems === Infinity ? '∞' : maxItems}</Text>
            </View>
            {maxItems !== Infinity && (
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${progressPct}%` }]} />
              </View>
            )}
            {tier !== 'max' && (
              <TouchableOpacity onPress={() => router.push('/subscription')} style={styles.upgradeBtn} activeOpacity={0.8}>
                <LinearGradient colors={['#eef2ff', '#e0e7ff']} style={styles.upgradeBtnInner} start={{x:0,y:0}} end={{x:1,y:1}}>
                  <Text style={styles.upgradeBtnText}>↑ Upgrade Plan</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>

          {/* Device Capabilities */}
          <View style={styles.card}>
            <Text style={styles.sectionEyebrow}>Device Capabilities</Text>

            <TouchableOpacity style={styles.capRow} activeOpacity={0.7}>
              <View style={styles.capLeft}>
                <Text style={styles.capIcon}>📱</Text>
                <Text style={styles.capTitle}>NFC Support</Text>
              </View>
              <View style={[styles.capStatus, { backgroundColor: '#dcfce7', borderColor: '#bbf7d0' }]}>
                <View style={[styles.capDot, { backgroundColor: '#22c55e' }]} />
                <Text style={[styles.capStatusText, { color: '#15803d' }]}>READY</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.capRow, { borderBottomWidth: 0, paddingBottom: 0 }]} onPress={() => router.push('/ble-status')} activeOpacity={0.7}>
              <View style={styles.capLeft}>
                <Text style={styles.capIcon}>📡</Text>
                <View>
                  <Text style={styles.capTitle}>BLE Relay Network</Text>
                  <Text style={styles.capSub}>Tap to view status</Text>
                </View>
              </View>
              {tier === 'pro' || tier === 'max' ? (
                <View style={[styles.capStatus, { backgroundColor: '#e0e7ff', borderColor: '#c7d2fe' }]}>
                  <View style={[styles.capDot, { backgroundColor: '#3b82f6' }]} />
                  <Text style={[styles.capStatusText, { color: '#4338ca' }]}>ACTIVE</Text>
                </View>
              ) : (
                <View style={[styles.capStatus, { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' }]}>
                  <View style={[styles.capDot, { backgroundColor: '#94a3b8' }]} />
                  <Text style={[styles.capStatusText, { color: '#475569' }]}>INACTIVE</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Plan Features */}
          <View style={styles.card}>
            <Text style={styles.sectionEyebrow}>Your Plan Includes</Text>
            {(PLAN_FEATURES[tier as keyof typeof PLAN_FEATURES] || PLAN_FEATURES.basic).map((feat, i) => (
              <View key={i} style={styles.featRow}>
                <Text style={styles.featCheck}>✓</Text>
                <Text style={styles.featText}>{feat}</Text>
              </View>
            ))}
          </View>

          {/* Admin */}
          {useAuthStore.getState().isAdmin && (
            <TouchableOpacity onPress={() => router.push('/admin')} style={styles.adminBtn} activeOpacity={0.88}>
              <LinearGradient colors={['#faf5ff', '#f3e8ff']} style={styles.adminInner} start={{x:0,y:0}} end={{x:1,y:1}}>
                <View style={styles.adminLeft}>
                  <Text style={{ fontSize: 24, marginRight: 12 }}>👑</Text>
                  <View>
                    <Text style={styles.adminTitle}>Admin Dashboard</Text>
                    <Text style={styles.adminSub}>Manage users and platform</Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={20} color="#9333ea" />
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Legal / Secondary actions */}
          <View style={[styles.card, { padding: 0 }]}>
            <Text style={[styles.sectionEyebrow, { paddingHorizontal: 20, paddingTop: 20 }]}>Legal & Privacy</Text>
            <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/privacy-policy')} activeOpacity={0.7}>
              <Text style={styles.linkIcon}>🔒</Text>
              <Text style={styles.linkText}>Privacy Policy</Text>
              <Feather name="chevron-right" size={16} color="#cbd5e1" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.linkRow, { borderBottomWidth: 0 }]} onPress={() => router.push('/terms-of-service')} activeOpacity={0.7}>
              <Text style={styles.linkIcon}>📄</Text>
              <Text style={styles.linkText}>Terms of Service</Text>
              <Feather name="chevron-right" size={16} color="#cbd5e1" />
            </TouchableOpacity>
          </View>

          {/* Danger zone */}
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn} activeOpacity={0.7}>
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleDeleteAccount} disabled={deletingAccount} style={styles.deleteBtn} activeOpacity={0.7}>
            {deletingAccount ? <ActivityIndicator color="#ef4444" /> : <Text style={styles.deleteText}>🗑️ Delete My Account & All Data</Text>}
          </TouchableOpacity>

          <Text style={styles.footerText}>Lost & Found Network v1.0.0</Text>
          <Text style={styles.footerSubText}>DPDP Act 2023 compliant. Your data rights are protected.</Text>

        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8faff' },

  /* Header */
  headerBg: { paddingHorizontal: 20, paddingBottom: 60, position: 'relative', overflow: 'hidden' },
  hCircle1: { position: 'absolute', top: -30, right: -30, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.08)' },
  hCircle2: { position: 'absolute', bottom: -10, left: -40, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.06)' },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: '#ffffff', fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },

  /* Body */
  body: { flex: 1, marginTop: -32, paddingHorizontal: 16 },

  /* Card Base */
  card: { backgroundColor: '#ffffff', borderRadius: 24, padding: 20, marginBottom: 16, shadowColor: '#6366f1', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 3, borderWidth: 1, borderColor: '#f1f5f9' },
  sectionEyebrow: { color: '#94a3b8', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 },

  /* Avatar Card */
  avatarCard: { alignItems: 'center', paddingTop: 32 },
  trustedBadge: { position: 'absolute', top: 16, right: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fde68a', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  trustedText: { color: '#b45309', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  avatarWrap: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#eef2ff', borderWidth: 2, borderColor: '#c7d2fe', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  avatarInitials: { color: '#6366f1', fontSize: 32, fontWeight: '900' },
  
  nameEditRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#cbd5e1', paddingBottom: 4, marginBottom: 8, width: '80%' },
  nameInput: { flex: 1, textAlign: 'center', fontSize: 20, fontWeight: '800', color: '#0f172a' },
  saveBtn: { backgroundColor: '#eef2ff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  saveBtnText: { color: '#6366f1', fontWeight: '800', fontSize: 13 },
  
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  displayName: { fontSize: 20, fontWeight: '900', color: '#0f172a', marginRight: 8 },
  emailText: { color: '#64748b', fontSize: 14, fontWeight: '500', marginBottom: 4 },
  joinText: { color: '#94a3b8', fontSize: 12, fontWeight: '500', marginBottom: 16 },

  tierPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  tierDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  tierText: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },

  /* Stats Row */
  statsRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: 24, marginBottom: 0 },
  statNum: { fontSize: 36, fontWeight: '900', color: '#0f172a', marginBottom: 4 },
  statLabel: { fontSize: 11, color: '#64748b', fontWeight: '800', textTransform: 'uppercase', textAlign: 'center', letterSpacing: 0.5, lineHeight: 14 },

  /* Usage */
  usageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  usageLabel: { color: '#0f172a', fontSize: 14, fontWeight: '700' },
  usageValue: { color: '#6366f1', fontSize: 15, fontWeight: '900' },
  progressBarBg: { height: 8, backgroundColor: '#f1f5f9', borderRadius: 4, overflow: 'hidden', marginBottom: 16 },
  progressBarFill: { height: '100%', backgroundColor: '#6366f1', borderRadius: 4 },
  upgradeBtn: { borderRadius: 14, overflow: 'hidden' },
  upgradeBtnInner: { alignItems: 'center', paddingVertical: 12, borderWidth: 1, borderColor: '#c7d2fe', borderRadius: 14 },
  upgradeBtnText: { color: '#6366f1', fontSize: 14, fontWeight: '800' },

  /* Capabilities */
  capRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  capLeft: { flexDirection: 'row', alignItems: 'center' },
  capIcon: { fontSize: 20, marginRight: 12 },
  capTitle: { color: '#0f172a', fontSize: 15, fontWeight: '700' },
  capSub: { color: '#64748b', fontSize: 12, fontWeight: '500', marginTop: 2 },
  capStatus: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  capDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  capStatusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  /* Features */
  featRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  featCheck: { color: '#6366f1', fontSize: 14, fontWeight: '900', marginRight: 10 },
  featText: { color: '#475569', fontSize: 14, fontWeight: '500' },

  /* Admin */
  adminBtn: { borderRadius: 24, overflow: 'hidden', marginBottom: 16, shadowColor: '#9333ea', shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  adminInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderWidth: 1, borderColor: '#e9d5ff', borderRadius: 24 },
  adminLeft: { flexDirection: 'row', alignItems: 'center' },
  adminTitle: { color: '#6b21a8', fontSize: 16, fontWeight: '800' },
  adminSub: { color: '#9333ea', fontSize: 12, fontWeight: '500', marginTop: 2 },

  /* Links */
  linkRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  linkIcon: { fontSize: 18, marginRight: 12 },
  linkText: { flex: 1, color: '#0f172a', fontSize: 15, fontWeight: '600' },

  /* Danger / Footer */
  logoutBtn: { backgroundColor: '#ffffff', borderRadius: 18, paddingVertical: 16, alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  logoutText: { color: '#475569', fontSize: 15, fontWeight: '800' },
  deleteBtn: { backgroundColor: '#fef2f2', borderRadius: 18, paddingVertical: 16, alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: '#fecaca' },
  deleteText: { color: '#dc2626', fontSize: 14, fontWeight: '800' },

  footerText: { textAlign: 'center', color: '#94a3b8', fontSize: 12, fontWeight: '600', marginBottom: 4 },
  footerSubText: { textAlign: 'center', color: '#94a3b8', fontSize: 11, paddingHorizontal: 32 },
});

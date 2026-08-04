import { useEffect, useState, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  RefreshControl, StatusBar, Animated, StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/authStore';
import { useItemStore } from '../../stores/itemStore';
import { useSubscriptionStore } from '../../stores/subscriptionStore';
import { PLAN_LIMITS } from '../../lib/constants';
import ItemCard from '../../components/ItemCard';
import { useTabBarClearance } from '../../components/FloatingTabBar';

export default function MyItemsScreen() {
  const router           = useRouter();
  const insets           = useSafeAreaInsets();
  const { user }         = useAuthStore();
  const { items, itemsCount, fetchMyItems, subscribeToItems, unsubscribeFromItems } = useItemStore();
  const { tier }         = useSubscriptionStore();
  const [refreshing, setRefreshing] = useState(false);
  const tabBarClearance  = useTabBarClearance();

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    if (user?.id) { fetchMyItems(user.id); subscribeToItems(user.id); }
    return () => unsubscribeFromItems();
  }, [user]);

  const limit    = PLAN_LIMITS[tier as keyof typeof PLAN_LIMITS].maxItems;
  const isAtLimit = itemsCount >= limit;
  const usedPct  = limit === Infinity ? 0 : Math.min((itemsCount / limit) * 100, 100);

  const tierColors: Record<string, [string, string]> = {
    max:   ['#6366f1', '#8b5cf6'],
    pro:   ['#ec4899', '#f43f5e'],
    basic: ['#94a3b8', '#64748b'],
  };
  const gradColors = tierColors[tier] || tierColors.basic;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#6366f1" />

      {/* ── Gradient Header ── */}
      <LinearGradient
        colors={['#6366f1', '#7c3aed']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.hCircle1} />
        <View style={styles.hCircle2} />

        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerEyebrow}>Lost & Found Network</Text>
            <Text style={styles.headerTitle}>My Items</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/profile')} activeOpacity={0.8} style={styles.settingsBtn}>
            <Feather name="settings" size={20} color="#6366f1" />
          </TouchableOpacity>
        </View>

        {/* Quota card — floats inside gradient, overlapped by body */}
        <View style={styles.quotaCard}>
          <View style={styles.quotaRow}>
            {/* Tier badge */}
            <LinearGradient colors={gradColors} style={styles.tierBadge} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={styles.tierBadgeText}>{tier.toUpperCase()}</Text>
            </LinearGradient>
            <Text style={styles.quotaCount}>
              {itemsCount} / {limit === Infinity ? '∞' : limit} items protected
            </Text>
            {tier !== 'max' && (
              <TouchableOpacity onPress={() => router.push('/subscription')} activeOpacity={0.8} style={styles.upgradeBtn}>
                <Text style={styles.upgradeBtnText}>⬆ Upgrade</Text>
              </TouchableOpacity>
            )}
          </View>
          {tier !== 'max' && (
            <View style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressFill,
                  { width: `${usedPct}%` as any, backgroundColor: isAtLimit ? '#f43f5e' : '#6366f1' },
                ]}
              />
            </View>
          )}
        </View>
      </LinearGradient>

      {/* ── Body ── */}
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          renderItem={({ item }) => <ItemCard item={item} />}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: tabBarClearance,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                if (user?.id) await fetchMyItems(user.id);
                setRefreshing(false);
              }}
              tintColor="#6366f1"
              colors={['#6366f1']}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}>
                <Text style={{ fontSize: 44 }}>🎒</Text>
              </View>
              <Text style={styles.emptyTitle}>Nothing protected yet</Text>
              <Text style={styles.emptySub}>
                Register your first item and let the{'\n'}global tracking network watch over it.
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/register-item')}
                activeOpacity={0.88}
                style={{ borderRadius: 18, overflow: 'hidden' }}
              >
                <LinearGradient
                  colors={['#6366f1', '#7c3aed']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.emptyBtn}
                >
                  <Text style={styles.emptyBtnText}>+ Register First Item</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          }
        />
      </Animated.View>

      {/* ── FAB ── */}
      {items.length > 0 && (
        <TouchableOpacity
          onPress={() => router.push('/register-item')}
          activeOpacity={0.88}
          style={[styles.fab, { bottom: tabBarClearance + 16 }]}
        >
          <LinearGradient colors={['#6366f1', '#7c3aed']} style={styles.fabGrad}>
            <Text style={styles.fabText}>+</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8faff' },

  /* Header */
  header: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    overflow: 'hidden',
    position: 'relative',
  },
  hCircle1: { position: 'absolute', top: -30, right: -30, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.08)' },
  hCircle2: { position: 'absolute', bottom: 30, left: -50, width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(255,255,255,0.06)' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  headerEyebrow: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2 },
  headerTitle:   { color: '#ffffff', fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  settingsBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#ffffff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },

  /* Quota card */
  quotaCard: {
    backgroundColor: '#ffffff', borderRadius: 18, padding: 14,
    shadowColor: '#6366f1', shadowOpacity: 0.12, shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
    borderWidth: 1, borderColor: '#f1f5f9',
  },
  quotaRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  tierBadge:     { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  tierBadgeText: { color: '#ffffff', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  quotaCount:    { color: '#475569', fontSize: 12, fontWeight: '600', flex: 1 },
  upgradeBtn:    { backgroundColor: 'rgba(99,102,241,0.1)', borderWidth: 1, borderColor: 'rgba(99,102,241,0.2)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  upgradeBtnText: { color: '#6366f1', fontSize: 11, fontWeight: '800' },
  progressTrack: { height: 6, backgroundColor: '#e0e7ff', borderRadius: 4, overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: 4 },

  /* Empty state */
  empty:        { alignItems: 'center', paddingTop: 56, paddingHorizontal: 32 },
  emptyIconWrap: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginBottom: 22, shadowColor: '#6366f1', shadowOpacity: 0.1, shadowRadius: 20, elevation: 4 },
  emptyTitle:   { color: '#0f172a', fontSize: 20, fontWeight: '800', marginBottom: 10 },
  emptySub:     { color: '#64748b', textAlign: 'center', fontSize: 14, lineHeight: 22, marginBottom: 28 },
  emptyBtn:     { paddingHorizontal: 28, paddingVertical: 15, borderRadius: 18 },
  emptyBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 15, letterSpacing: 0.3 },

  /* FAB */
  fab:    { position: 'absolute', right: 20, width: 60, height: 60, borderRadius: 30, overflow: 'hidden', shadowColor: '#6366f1', shadowOpacity: 0.4, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
  fabGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fabText: { color: '#ffffff', fontSize: 30, fontWeight: '300', lineHeight: 36 },
});

import { useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, StatusBar, Animated, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../stores/authStore';
import { useItemStore } from '../../stores/itemStore';
import { useSubscriptionStore } from '../../stores/subscriptionStore';
import { PLAN_LIMITS } from '../../lib/constants';
import ItemCard from '../../components/ItemCard';
import { supabase } from '../../lib/supabase';
import { Feather } from '@expo/vector-icons';

export default function MyItemsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { items, itemsCount, fetchMyItems, subscribeToItems, unsubscribeFromItems } = useItemStore();
  const { tier } = useSubscriptionStore();
  const [refreshing, setRefreshing] = useState(false);
  const headerY = useRef(new Animated.Value(-20)).current;
  const headerOp = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerY, { toValue: 0, duration: 500, useNativeDriver: true }),
      Animated.timing(headerOp, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
    if (user?.id) { fetchMyItems(user.id); subscribeToItems(user.id); }
    return () => unsubscribeFromItems();
  }, [user]);

  // Notification logic removed

  const limit = PLAN_LIMITS[tier as keyof typeof PLAN_LIMITS].maxItems;
  const isAtLimit = itemsCount >= limit;
  const usedPct = limit === Infinity ? 0 : Math.min((itemsCount / limit) * 100, 100);

  const tierColors: Record<string, [string, string]> = {
    max: ['#6366f1', '#8b5cf6'],
    pro: ['#ec4899', '#f43f5e'],
    basic: ['#94a3b8', '#64748b'],
  };
  const gradColors = tierColors[tier] || tierColors.basic;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9ff" />

      {/* Header */}
      <Animated.View style={{ transform: [{ translateY: headerY }], opacity: headerOp }}>
        <LinearGradient colors={['#f8f9ff', '#ffffff', '#ffffff']} style={styles.header}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerSub}>Lost & Found Network</Text>
              <Text style={styles.headerTitle}>My Items</Text>
              <Text style={{ fontSize: 10, color: 'red', marginTop: 4 }}>DEBUG URL: {process.env.EXPO_PUBLIC_SUPABASE_URL}</Text>
            </View>

            {/* Settings icon */}
            <TouchableOpacity
              onPress={() => router.push('/profile')}
              style={styles.bellBtn}
              activeOpacity={0.8}
            >
              <View style={styles.bellIconWrap}>
                <Feather name="settings" size={20} color="#6366f1" />
              </View>
            </TouchableOpacity>
          </View>

          {/* Plan / Quota bar */}
          <View style={styles.quotaCard}>
            <View style={styles.quotaRow}>
              <View style={styles.quotaTierBadge}>
                <LinearGradient colors={gradColors} style={styles.quotaTierGradient}>
                  <Text style={styles.quotaTierText}>{tier.toUpperCase()}</Text>
                </LinearGradient>
              </View>
              <Text style={styles.quotaCount}>
                {itemsCount} / {limit === Infinity ? '∞' : limit} items
              </Text>
              {tier !== 'max' && (
                <TouchableOpacity onPress={() => router.push('/subscription')} style={styles.upgradeBtn} activeOpacity={0.8}>
                  <Text style={styles.upgradeBtnText}>⬆ Upgrade</Text>
                </TouchableOpacity>
              )}
            </View>
            {tier !== 'max' && (
              <View style={styles.progressTrack}>
                <Animated.View style={[styles.progressFill, { width: `${usedPct}%`, backgroundColor: isAtLimit ? '#f43f5e' : '#6366f1' }]} />
              </View>
            )}
            
          {/* Live Tag Map removed — coming soon */}
          </View>
        </LinearGradient>
      </Animated.View>

      <FlatList
        data={items}
        keyExtractor={i => i.id}
        renderItem={({ item }) => <ItemCard item={item} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); if (user?.id) await fetchMyItems(user.id); setRefreshing(false); }} tintColor="#6366f1" colors={['#6366f1']} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Text style={{ fontSize: 44 }}>🎒</Text>
            </View>
            <Text style={styles.emptyTitle}>Nothing protected yet</Text>
            <Text style={styles.emptySubtitle}>Register your first item and let the{'\n'}global tracking network watch over it.</Text>
            <TouchableOpacity onPress={() => router.push('/register-item')} style={styles.emptyBtn} activeOpacity={0.85}>
              <LinearGradient colors={['#6366f1', '#8b5cf6']} style={styles.emptyBtnGrad}>
                <Text style={styles.emptyBtnText}>+ Register First Item</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        }
      />

      {/* FAB */}
      {items.length > 0 && (
        <TouchableOpacity onPress={() => router.push('/register-item')} style={styles.fab} activeOpacity={0.88}>
          <LinearGradient colors={['#6366f1', '#8b5cf6']} style={styles.fabGrad}>
            <Text style={styles.fabText}>+</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9ff' },
  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerSub: { color: '#64748b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 2 },
  headerTitle: { color: '#0f172a', fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },

  // Bell button
  bellBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#ffffff',
    borderWidth: 1, borderColor: '#e2e8f0',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#6366f1', shadowOpacity: 0.08, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  bellIconWrap: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  bellDome: {
    width: 14, height: 12,
    borderRadius: 5,
    borderWidth: 2, borderColor: '#6366f1',
    backgroundColor: 'transparent',
    marginTop: 2,
  },
  bellStem: {
    position: 'absolute', top: 0,
    width: 2, height: 5,
    backgroundColor: '#6366f1', borderRadius: 1,
  },
  bellClapper: {
    width: 5, height: 5, borderRadius: 3,
    borderWidth: 2, borderColor: '#6366f1',
    backgroundColor: 'transparent',
    marginTop: -1,
  },
  bellBadge: {
    position: 'absolute', top: 4, right: 4,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#e11d48',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: '#ffffff',
  },
  bellBadgeText: { color: '#fff', fontSize: 8, fontWeight: '800' },

  // Quota
  quotaCard: { backgroundColor: '#ffffff', borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0', padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  quotaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  quotaTierBadge: { borderRadius: 12, overflow: 'hidden' },
  quotaTierGradient: { paddingHorizontal: 10, paddingVertical: 4 },
  quotaTierText: { color: '#ffffff', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  quotaCount: { color: '#475569', fontSize: 12, fontWeight: '600', flex: 1 },
  upgradeBtn: { backgroundColor: 'rgba(99,102,241,0.1)', borderWidth: 1, borderColor: 'rgba(99,102,241,0.2)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  upgradeBtnText: { color: '#6366f1', fontSize: 11, fontWeight: '800' },
  progressTrack: { height: 6, backgroundColor: '#e0e7ff', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },

  // Empty
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyIcon: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginBottom: 24, shadowColor: '#6366f1', shadowOpacity: 0.08, shadowRadius: 20, elevation: 4 },
  emptyTitle: { color: '#0f172a', fontSize: 20, fontWeight: '800', marginBottom: 10 },
  emptySubtitle: { color: '#64748b', textAlign: 'center', fontSize: 14, lineHeight: 22, marginBottom: 28 },
  emptyBtn: { borderRadius: 24, overflow: 'hidden', shadowColor: '#6366f1', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  emptyBtnGrad: { paddingHorizontal: 28, paddingVertical: 14 },
  emptyBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 15, letterSpacing: 0.3 },

  // FAB
  fab: { position: 'absolute', bottom: 140, right: 20, width: 64, height: 64, borderRadius: 32, overflow: 'hidden', shadowColor: '#6366f1', shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
  fabGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fabText: { color: '#ffffff', fontSize: 32, fontWeight: '300', lineHeight: 38 },
});

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl,
  StatusBar, Animated, StyleSheet, Image, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

type CommunityItem = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  location_label: string | null;
  image_url: string | null;
  status: 'open' | 'claimed' | 'closed';
  created_at: string;
  finder_id: string;
  // joined via users table
  finder_email?: string | null;
};

const CATEGORY_META: Record<string, { icon: string; bg: string }> = {
  Personal:    { icon: '👤', bg: '#E0E7FF' },
  Electronics: { icon: '💻', bg: '#FEF08A' },
  Bag:         { icon: '👜', bg: '#FCE7F3' },
  Keys:        { icon: '🔑', bg: '#DCFCE7' },
  Wallet:      { icon: '💳', bg: '#F3E8FF' },
  Travel:      { icon: '✈️', bg: '#FFE4E6' },
  Other:       { icon: '📦', bg: '#F3F4F6' },
};

const STATUS_COLORS = {
  open:    { bg: '#DCFCE7', text: '#15803d', dot: '#22c55e', label: 'Open' },
  claimed: { bg: '#E0E7FF', text: '#4338ca', dot: '#6366f1', label: 'Claimed' },
  closed:  { bg: '#F3F4F6', text: '#475569', dot: '#94a3b8', label: 'Closed' },
};

function timeAgo(ts: string) {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function CommunityCard({ item, currentUserId, onClaim }: {
  item: CommunityItem;
  currentUserId: string | null;
  onClaim: (id: string) => void;
}) {
  const meta   = CATEGORY_META[item.category] || CATEGORY_META.Other;
  const status = STATUS_COLORS[item.status] || STATUS_COLORS.open;
  const isOwn  = item.finder_id === currentUserId;

  return (
    <View style={styles.card}>
      {/* Top row */}
      <View style={styles.cardRow}>
        {/* Category icon */}
        <View style={[styles.catBox, { backgroundColor: meta.bg }]}>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={styles.catImage} />
          ) : (
            <Text style={styles.catIcon}>{meta.icon}</Text>
          )}
        </View>

        {/* Info */}
        <View style={styles.cardInfo}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            {/* Status pill */}
            <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: status.dot }]} />
              <Text style={[styles.statusText, { color: status.text }]}>{status.label}</Text>
            </View>
          </View>

          <Text style={styles.cardCategory}>{item.category}</Text>

          {item.location_label ? (
            <Text style={styles.cardLocation} numberOfLines={1}>📍 {item.location_label}</Text>
          ) : null}

          <Text style={styles.cardTime}>{timeAgo(item.created_at)}</Text>
        </View>
      </View>

      {/* Description */}
      {item.description ? (
        <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
      ) : null}

      {/* Action */}
      {!isOwn && item.status === 'open' && (
        <TouchableOpacity
          style={styles.claimBtn}
          onPress={() => onClaim(item.id)}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#6366f1', '#8b5cf6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.claimBtnGrad}
          >
            <Text style={styles.claimBtnText}>🙋 This is Mine</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
      {isOwn && (
        <View style={styles.ownBadge}>
          <Text style={styles.ownBadgeText}>✨ Your post</Text>
        </View>
      )}
    </View>
  );
}

export default function CommunityScreen() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [items, setItems]         = useState<CommunityItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dbUserId, setDbUserId]   = useState<string | null>(null);

  const headerOp = useRef(new Animated.Value(0)).current;
  const headerY  = useRef(new Animated.Value(-16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerOp, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(headerY,  { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();

    // Resolve the DB user id (users.id, not auth.uid)
    if (user?.id) {
      supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single()
        .then(({ data }) => { if (data) setDbUserId(data.id); });
    }

    fetchFeed();

    // Realtime subscription
    const channel = supabase
      .channel('community_feed')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'community_items' },
        () => fetchFeed()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const fetchFeed = useCallback(async () => {
    const { data, error } = await supabase
      .from('community_items')
      .select('id, title, description, category, location_label, image_url, status, created_at, finder_id')
      .neq('status', 'closed')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) setItems(data as CommunityItem[]);
    setLoading(false);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchFeed();
    setRefreshing(false);
  };

  const handleClaim = (id: string) => {
    if (!user) {
      router.push('/login');
      return;
    }
    router.push(`/community-claim/${id}`);
  };

  const openCount = items.filter(i => i.status === 'open').length;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9ff" />

      {/* Header */}
      <Animated.View style={{ opacity: headerOp, transform: [{ translateY: headerY }] }}>
        <LinearGradient colors={['#f8f9ff', '#ffffff']} style={styles.header}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerSub}>Community</Text>
              <Text style={styles.headerTitle}>Found Board</Text>
            </View>
            {/* Open count badge */}
            <View style={styles.countBadge}>
              <LinearGradient colors={['#6366f1', '#8b5cf6']} style={styles.countGrad}>
                <Text style={styles.countText}>{openCount} open</Text>
              </LinearGradient>
            </View>
          </View>
          <Text style={styles.headerHint}>
            Found something without an NFC tag? Post it here so the owner can claim it.
          </Text>
        </LinearGradient>
      </Animated.View>

      {/* Feed */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          renderItem={({ item }) => (
            <CommunityCard
              item={item}
              currentUserId={dbUserId}
              onClaim={handleClaim}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#6366f1"
              colors={['#6366f1']}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Text style={{ fontSize: 44 }}>🗺️</Text>
              </View>
              <Text style={styles.emptyTitle}>Board is empty</Text>
              <Text style={styles.emptySubtitle}>
                Found something without a tag?{'\\n'}Be the first to post it here!
              </Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => router.push('/create-community-post')}
                activeOpacity={0.85}
              >
                <LinearGradient colors={['#6366f1', '#8b5cf6']} style={styles.emptyBtnGrad}>
                  <Text style={styles.emptyBtnText}>+ Post a Found Item</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* FAB */}
      {items.length > 0 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/create-community-post')}
          activeOpacity={0.88}
        >
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
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header
  header:     { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 },
  headerRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  headerSub:  { color: '#64748b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 2 },
  headerTitle:{ color: '#0f172a', fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  headerHint: { color: '#64748b', fontSize: 13, fontWeight: '500', lineHeight: 20 },
  countBadge: { borderRadius: 12, overflow: 'hidden' },
  countGrad:  { paddingHorizontal: 14, paddingVertical: 7 },
  countText:  { color: '#ffffff', fontSize: 12, fontWeight: '800' },

  // Feed
  listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120 },

  // Card
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    marginBottom: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    shadowColor: '#6366f1',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  cardRow:      { flexDirection: 'row', alignItems: 'flex-start' },
  catBox: {
    width: 72, height: 72, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 14, overflow: 'hidden',
  },
  catImage:     { width: '100%', height: '100%' },
  catIcon:      { fontSize: 32 },
  cardInfo:     { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  cardTitle:    { color: '#0f172a', fontSize: 15, fontWeight: '800', flex: 1, marginRight: 8 },
  statusPill:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  statusDot:    { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  statusText:   { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  cardCategory: { color: '#64748b', fontSize: 12, fontWeight: '600', marginBottom: 4 },
  cardLocation: { color: '#94a3b8', fontSize: 11, fontWeight: '500', marginBottom: 4 },
  cardTime:     { color: '#cbd5e1', fontSize: 11, fontWeight: '500' },
  cardDesc:     { color: '#475569', fontSize: 13, fontWeight: '500', lineHeight: 19, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f8fafc' },

  // Claim button
  claimBtn:     { marginTop: 14, borderRadius: 18, overflow: 'hidden', shadowColor: '#6366f1', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  claimBtnGrad: { paddingVertical: 12, alignItems: 'center' },
  claimBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '800', letterSpacing: 0.3 },

  // Own badge
  ownBadge:     { marginTop: 12, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start' },
  ownBadgeText: { color: '#15803d', fontSize: 11, fontWeight: '700' },

  // Empty
  empty:        { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyIcon:    { width: 100, height: 100, borderRadius: 50, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginBottom: 24, shadowColor: '#6366f1', shadowOpacity: 0.08, shadowRadius: 20, elevation: 4 },
  emptyTitle:   { color: '#0f172a', fontSize: 20, fontWeight: '800', marginBottom: 10 },
  emptySubtitle:{ color: '#64748b', textAlign: 'center', fontSize: 14, lineHeight: 22, marginBottom: 28 },
  emptyBtn:     { borderRadius: 24, overflow: 'hidden', shadowColor: '#6366f1', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  emptyBtnGrad: { paddingHorizontal: 28, paddingVertical: 14 },
  emptyBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 15, letterSpacing: 0.3 },

  // FAB
  fab:     { position: 'absolute', bottom: 28, right: 20, width: 64, height: 64, borderRadius: 32, overflow: 'hidden', shadowColor: '#6366f1', shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
  fabGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fabText: { color: '#ffffff', fontSize: 32, fontWeight: '300', lineHeight: 38 },
});

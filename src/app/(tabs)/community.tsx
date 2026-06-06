import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl,
  StatusBar, Animated, StyleSheet, ActivityIndicator, Dimensions, Linking, Alert
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

// --- Shared Types ---
type Tab = 'found' | 'lost' | 'groups';

// --- Types: Found Items ---
type CommunityItem = {
  id: string; title: string; description: string | null; category: string;
  location_label: string | null; image_url: string | null;
  status: 'open' | 'claimed' | 'closed'; created_at: string; finder_id: string;
  users?: { full_name?: string | null; successful_recoveries?: number | null };
};

// --- Types: Lost Posts ---
type LostPost = {
  id: string; title: string; description: string | null; category: string;
  radius_km: number; image_url: string | null;
  status: 'searching' | 'found' | 'closed'; created_at: string; poster_id: string;
  users?: { full_name?: string | null; successful_recoveries?: number | null };
};

// --- Types: Groups ---
type CommunityGroup = {
  id: string; name: string; description: string | null; image_url: string | null;
  type: 'public' | 'private'; member_count: number; created_at: string;
};

const { width } = Dimensions.get('window');

// --- Helper Functions ---
function timeAgo(ts: string) {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const STATUS_COLORS = {
  open: { bg: '#DCFCE7', text: '#15803d', dot: '#22c55e', label: 'Open' },
  claimed: { bg: '#E0E7FF', text: '#4338ca', dot: '#6366f1', label: 'Claimed' },
  closed: { bg: '#F3F4F6', text: '#475569', dot: '#94a3b8', label: 'Closed' },
  searching: { bg: '#FEF3C7', text: '#b45309', dot: '#f59e0b', label: 'Searching' },
  found: { bg: '#DCFCE7', text: '#15803d', dot: '#22c55e', label: 'Found' },
};

// --- Components ---
function FoundCard({ item, currentUserId, onClaim }: { item: CommunityItem; currentUserId: string | null; onClaim: (id: string) => void }) {
  const isMine = currentUserId === item.finder_id;
  const s = STATUS_COLORS[item.status as keyof typeof STATUS_COLORS] || STATUS_COLORS.open;
  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <View style={styles.cardInfo}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: s.dot }]} />
              <Text style={[styles.statusText, { color: s.text }]}>{s.label}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <Text style={{ fontSize: 13, color: '#64748b', fontWeight: '600', marginRight: 6 }}>
              {item.users?.full_name || 'Anonymous Finder'}
            </Text>
            {(item.users?.successful_recoveries || 0) > 0 && (
              <View style={{ backgroundColor: '#fef9c3', borderColor: '#fde047', borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 10, marginRight: 2 }}>🏆</Text>
                <Text style={{ fontSize: 9, fontWeight: '800', color: '#a16207' }}>TRUSTED</Text>
              </View>
            )}
          </View>
          <Text style={styles.cardCategory}>{item.category} • {item.location_label || 'Unknown location'}</Text>
          <Text style={styles.cardTime}>Found {timeAgo(item.created_at)}</Text>
          {item.description && <Text style={styles.cardDesc}>{item.description}</Text>}
          
          {isMine ? (
            <View>
              <View style={styles.ownBadge}><Text style={styles.ownBadgeText}>You posted this</Text></View>
              {item.status !== 'closed' && (
                <TouchableOpacity style={styles.claimBtn} activeOpacity={0.8} onPress={() => onResolve(item.id)}>
                  <LinearGradient colors={['#10b981', '#059669']} style={styles.claimBtnGrad}>
                    <Text style={styles.claimBtnText}>Mark as Handed Over</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            item.status === 'open' && (
              <TouchableOpacity style={styles.claimBtn} activeOpacity={0.8} onPress={() => onClaim(item.id)}>
                <LinearGradient colors={['#6366f1', '#8b5cf6']} style={styles.claimBtnGrad}>
                  <Text style={styles.claimBtnText}>This is mine</Text>
                </LinearGradient>
              </TouchableOpacity>
            )
          )}
        </View>
      </View>
    </View>
  );
}

function LostCard({ item, currentUserId, onResolve }: { item: LostPost; currentUserId: string | null; onResolve: (id: string) => void }) {
  const isMine = currentUserId === item.poster_id;
  const s = STATUS_COLORS[item.status as keyof typeof STATUS_COLORS] || STATUS_COLORS.searching;
  return (
    <View style={styles.card}>
      <View style={styles.cardInfo}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: s.dot }]} />
            <Text style={[styles.statusText, { color: s.text }]}>{s.label}</Text>
          </View>
        </View>
        <Text style={{ fontSize: 13, color: '#64748b', fontWeight: '600', marginBottom: 4 }}>
          {item.users?.full_name || 'Anonymous Poster'}
        </Text>
        <Text style={styles.cardCategory}>{item.category} • Alert radius: {item.radius_km}km</Text>
        <Text style={styles.cardTime}>Lost {timeAgo(item.created_at)}</Text>
        {item.description && <Text style={styles.cardDesc}>{item.description}</Text>}
        {isMine && (
          <View>
            <View style={styles.ownBadge}><Text style={styles.ownBadgeText}>Your post</Text></View>
            {item.status === 'searching' && (
              <TouchableOpacity style={styles.claimBtn} activeOpacity={0.8} onPress={() => onResolve(item.id)}>
                <LinearGradient colors={['#10b981', '#059669']} style={styles.claimBtnGrad}>
                  <Text style={styles.claimBtnText}>Mark as Resolved</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        )}
        {item.status === 'searching' && (
          <TouchableOpacity 
            style={{ marginTop: 12, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: '#25D366', borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
            activeOpacity={0.8}
            onPress={() => {
              // https:// URL so WhatsApp makes it a clickable link
              // The edge function shows a branded page and redirects to the app
              const link = `https://pzhuszyyykususkmzpud.supabase.co/functions/v1/deep-link?type=lost-post&id=${item.id}`;
              const descPart = item.description ? `\n\n📝 "${item.description}"` : '';
              const msg = `🚨 Lost Item Alert!\n\nHelp me find my *${item.title}* (${item.category}).${descPart}\n\nIf you spot it nearby, please reach out! The owner is looking within a *${item.radius_km}km* radius.\n\n📲 View item details:\n${link}\n\n— Posted on the Poki Lost & Found Network`;
              Linking.openURL(`whatsapp://send?text=${encodeURIComponent(msg)}`).catch(() => {
                Alert.alert('WhatsApp Not Available', 'Could not open WhatsApp. Please make sure it is installed.');
              });
            }}
          >
            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 14 }}>💬 Share to WhatsApp</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function GroupCard({ group, onJoin }: { group: CommunityGroup; onJoin: (id: string) => void }) {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => onJoin(group.id)}>
      <View style={styles.cardInfo}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle} numberOfLines={1}>{group.name}</Text>
          <View style={[styles.statusPill, { backgroundColor: group.type === 'public' ? '#E0E7FF' : '#FCE7F3' }]}>
            <Text style={[styles.statusText, { color: group.type === 'public' ? '#4338ca' : '#be185d' }]}>
              {group.type.toUpperCase()}
            </Text>
          </View>
        </View>
        <Text style={styles.cardCategory}>{group.member_count} member{group.member_count !== 1 ? 's' : ''}</Text>
        {group.description && <Text style={styles.cardDesc} numberOfLines={2}>{group.description}</Text>}
      </View>
    </TouchableOpacity>
  );
}

// --- Main Screen ---
export default function CommunityScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const dbUserId = user?.id || null;

  const [activeTab, setActiveTab] = useState<Tab>('found');

  // tabParam read below — useEffect is placed after switchTab is defined
  
  // Data states
  const [foundItems, setFoundItems] = useState<CommunityItem[]>([]);
  const [lostPosts, setLostPosts] = useState<LostPost[]>([]);
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Animations
  const headerY = useRef(new Animated.Value(-20)).current;
  const headerOp = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerY, { toValue: 0, duration: 500, useNativeDriver: true }),
      Animated.timing(headerOp, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
    
    fetchData(true);

    // Realtime: silent refresh (no loader) on DB changes
    const silentRefresh = () => fetchData(false);
    const foundSub = supabase.channel('community_found_feed').on('postgres_changes', { event: '*', schema: 'public', table: 'community_items' }, silentRefresh).subscribe();
    const lostSub  = supabase.channel('community_lost_feed').on('postgres_changes', { event: '*', schema: 'public', table: 'lost_item_posts' }, silentRefresh).subscribe();
    const groupSub = supabase.channel('community_group_feed').on('postgres_changes', { event: '*', schema: 'public', table: 'community_groups' }, silentRefresh).subscribe();

    return () => {
      supabase.removeChannel(foundSub);
      supabase.removeChannel(lostSub);
      supabase.removeChannel(groupSub);
    };
  }, []);

  const fetchData = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const [foundRes, lostRes, groupsRes] = await Promise.all([
        supabase.from('community_items').select('*, users(full_name, successful_recoveries)').neq('status', 'closed').order('created_at', { ascending: false }).limit(50),
        supabase.from('lost_item_posts').select('*, users(full_name, successful_recoveries)').neq('status', 'closed').order('created_at', { ascending: false }).limit(50),
        supabase.from('community_groups').select('*').order('created_at', { ascending: false }).limit(50)
      ]);
      
      if (foundRes.data) setFoundItems(foundRes.data as CommunityItem[]);
      if (lostRes.data) setLostPosts(lostRes.data as LostPost[]);
      if (groupsRes.data) setGroups(groupsRes.data as CommunityGroup[]);
    } catch (e) {
      console.warn('Community fetchData error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData(false);
    setRefreshing(false);
  };

  const handleResolveLostPost = (id: string) => {
    Alert.alert('Mark as Resolved', 'Are you sure you found this item? It will be removed from the active search board.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes, I found it! 🎉', onPress: async () => {
          const { error } = await supabase.from('lost_item_posts').update({ status: 'found' }).eq('id', id);
          if (error) {
            Alert.alert('Error', error.message);
          } else {
            // Give user a celebratory alert
            Alert.alert('Successfully Recovered 🎉', 'Glad you found your item!');
            fetchData();
          }
      }}
    ]);
  };

  const handleResolveFoundPost = (id: string) => {
    Alert.alert('Mark as Handed Over', 'Are you sure you successfully handed this over to the owner?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes, Handed Over 🤝', onPress: async () => {
          const { error } = await supabase.from('community_items').update({ status: 'closed' }).eq('id', id);
          if (error) {
            Alert.alert('Error', error.message);
          } else {
            // Record successful recovery on the user profile (done securely in future migration, simple local alert for now)
            Alert.alert('Hero! 🦸', 'Thanks for returning the item and keeping the community safe!');
            fetchData();
          }
      }}
    ]);
  };

  const switchTab = (tab: Tab) => {
    setActiveTab(tab);
    // Simple slide animation
    Animated.sequence([
      Animated.timing(slideAnim, { toValue: 10, duration: 100, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true })
    ]).start();
  };

  // Deep-link / notification tap: auto-switch to the correct tab when opened from a push notification.
  // Must be defined after switchTab so it can safely call it.
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  useEffect(() => {
    const validTabs: Tab[] = ['found', 'lost', 'groups'];
    if (tabParam && validTabs.includes(tabParam as Tab)) {
      switchTab(tabParam as Tab);
    }
  }, [tabParam]);

  const renderContent = () => {
    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#6366f1" /></View>;

    if (activeTab === 'found') {
      return (
        <FlatList data={foundItems} keyExtractor={i => i.id}
          renderItem={({ item }) => <FoundCard item={item} currentUserId={dbUserId} onClaim={(id) => router.push(`/community-claim/${id}`)} onResolve={handleResolveFoundPost} />}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#6366f1" />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={{ fontSize: 44, marginBottom: 10 }}>🗺️</Text>
              <Text style={styles.emptyTitle}>Board is empty</Text>
              <Text style={styles.emptySubtitle}>Be the first to post a found item!</Text>
            </View>
          }
        />
      );
    }
    
    if (activeTab === 'lost') {
      return (
        <FlatList data={lostPosts} keyExtractor={i => i.id}
          renderItem={({ item }) => <LostCard item={item} currentUserId={dbUserId} onResolve={handleResolveLostPost} />}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#6366f1" />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={{ fontSize: 44, marginBottom: 10 }}>🔍</Text>
              <Text style={styles.emptyTitle}>No lost items nearby</Text>
              <Text style={styles.emptySubtitle}>Create a post if you lost something</Text>
            </View>
          }
        />
      );
    }

    if (activeTab === 'groups') {
      return (
        <FlatList data={groups} keyExtractor={i => i.id}
          renderItem={({ item }) => <GroupCard group={item} onJoin={(id) => router.push(`/group/${id}`)} />}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#6366f1" />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={{ fontSize: 44, marginBottom: 10 }}>👥</Text>
              <Text style={styles.emptyTitle}>No groups yet</Text>
              <Text style={styles.emptySubtitle}>Start a community group in your area</Text>
            </View>
          }
        />
      );
    }
  };

  const getFabAction = () => {
    if (activeTab === 'found') return () => router.push('/create-community-post');
    if (activeTab === 'lost') return () => router.push('/create-lost-post');
    return () => router.push('/create-group');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9ff" />

      {/* Header */}
      <Animated.View style={{ opacity: headerOp, transform: [{ translateY: headerY }] }}>
        <LinearGradient colors={['#f8f9ff', '#ffffff']} style={styles.header}>
          <Text style={styles.headerSub}>Community</Text>
          <Text style={styles.headerTitle}>Network</Text>
          
          {/* 3 Tab Selector */}
          <View style={styles.tabSelector}>
            {(['found', 'lost', 'groups'] as Tab[]).map((tab) => {
              const isActive = activeTab === tab;
              return (
                <TouchableOpacity key={tab} style={[styles.tabBtn, isActive && styles.tabBtnActive]} onPress={() => switchTab(tab)} activeOpacity={0.8}>
                  <Text style={[styles.tabBtnText, isActive && styles.tabBtnTextActive]}>
                    {tab === 'found' ? 'Found Board' : tab === 'lost' ? 'Lost Posts' : 'Groups'}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Content */}
      <Animated.View style={{ flex: 1, transform: [{ translateX: slideAnim }] }}>
        {renderContent()}
      </Animated.View>

      {/* Dynamic FAB */}
      <TouchableOpacity style={styles.fab} onPress={getFabAction()} activeOpacity={0.88}>
        <LinearGradient colors={['#6366f1', '#8b5cf6']} style={styles.fabGrad}>
          <Text style={styles.fabText}>+</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9ff' },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:     { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 },
  headerSub:  { color: '#64748b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 2 },
  headerTitle:{ color: '#0f172a', fontSize: 28, fontWeight: '900', letterSpacing: -0.5, marginBottom: 16 },
  
  tabSelector: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 12, padding: 4 },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabBtnActive: { backgroundColor: '#ffffff', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  tabBtnText: { color: '#64748b', fontSize: 13, fontWeight: '600' },
  tabBtnTextActive: { color: '#0f172a', fontWeight: '800' },

  listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 140 },
  card: { backgroundColor: '#ffffff', borderRadius: 24, marginBottom: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)', shadowColor: '#6366f1', shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start' },
  cardInfo: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  cardTitle: { color: '#0f172a', fontSize: 15, fontWeight: '800', flex: 1, marginRight: 8 },
  statusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  cardCategory: { color: '#64748b', fontSize: 12, fontWeight: '600', marginBottom: 4 },
  cardTime: { color: '#cbd5e1', fontSize: 11, fontWeight: '500' },
  cardDesc: { color: '#475569', fontSize: 13, fontWeight: '500', lineHeight: 19, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f8fafc' },
  
  claimBtn: { marginTop: 14, borderRadius: 18, overflow: 'hidden' },
  claimBtnGrad: { paddingVertical: 12, alignItems: 'center' },
  claimBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  ownBadge: { marginTop: 12, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start' },
  ownBadgeText: { color: '#15803d', fontSize: 11, fontWeight: '700' },
  
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle: { color: '#0f172a', fontSize: 20, fontWeight: '800', marginBottom: 10 },
  emptySubtitle: { color: '#64748b', textAlign: 'center', fontSize: 14, lineHeight: 22 },
  
  fab: { position: 'absolute', bottom: 140, right: 20, width: 64, height: 64, borderRadius: 32, overflow: 'hidden', shadowColor: '#6366f1', shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
  fabGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fabText: { color: '#ffffff', fontSize: 32, fontWeight: '300', lineHeight: 38 },
});

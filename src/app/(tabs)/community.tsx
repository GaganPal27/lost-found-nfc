import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl,
  StatusBar, StyleSheet, ActivityIndicator, Image, Share,
  Alert, Linking, TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

// ─── Types ────────────────────────────────────────────────────────────────────
type PostType = 'found' | 'lost';
type Tab = 'feed' | 'groups';

type FeedPost = {
  id: string;
  postType: PostType;
  title: string;
  description: string | null;
  category: string;
  location_label?: string | null;
  radius_km?: number;
  image_url: string | null;
  status: string;
  created_at: string;
  owner_id: string;
  author_name: string | null;
};

type CommunityGroup = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  type: 'public' | 'private';
  member_count: number;
  created_at: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(ts: string) {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── Post Card (list-style like reference image) ──────────────────────────────
function PostCard({
  post,
  currentUserId,
  onResolve,
  onDelete,
  onReport,
}: {
  post: FeedPost;
  currentUserId: string | null;
  onResolve: (p: FeedPost) => void;
  onDelete: (p: FeedPost) => void;
  onReport: (p: FeedPost) => void;
}) {
  const router = useRouter();
  const isLost = post.postType === 'lost';
  const isMine = currentUserId === post.owner_id;

  const handleShare = async () => {
    try {
      const link = `https://pzhuszyyykususkmzpud.supabase.co/functions/v1/deep-link?type=post&id=${post.id}`;
      await Share.share({
        message: isLost
          ? `🚨 Help find: *${post.title}* (${post.category})\n\n${post.description ?? ''}\n\nTap to view details on Poki:\n${link}`
          : `📦 Found: *${post.title}* near ${post.location_label ?? 'nearby'}\n\n${post.description ?? ''}\n\nTap to view details on Poki:\n${link}`,
      });
    } catch {}
  };

  const handleWhatsApp = () => {
    // Generate a deep link for this post
    const link = `https://pzhuszyyykususkmzpud.supabase.co/functions/v1/deep-link?type=post&id=${post.id}`;
    const msg = isLost 
      ? `🚨 Lost: *${post.title}* (${post.category})\n${post.description ?? ''}\n\nTap to view details on Poki:\n${link}`
      : `📦 Found: *${post.title}* near ${post.location_label ?? 'nearby'}\n${post.description ?? ''}\n\nTap to view details on Poki:\n${link}`;
    
    Linking.openURL(`whatsapp://send?text=${encodeURIComponent(msg)}`).catch(() =>
      Alert.alert('WhatsApp Not Available', 'Please install WhatsApp.')
    );
  };

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.9}
      onPress={() => router.push({ pathname: '/post/[id]', params: { id: String(post.id) } } as any)}
    >
      {/* Left image */}
      <View style={styles.cardImg}>
        {post.image_url ? (
          <Image source={{ uri: post.image_url }} style={styles.cardImgFull} />
        ) : (
          <View style={[styles.cardImgFull, styles.cardImgPlaceholder]}>
            <Text style={{ fontSize: 28 }}>{isLost ? '🔍' : '📦'}</Text>
          </View>
        )}
      </View>

      {/* Right content */}
      <View style={styles.cardBody}>
        {/* Top row: time + badge + delete */}
        <View style={styles.cardTopRow}>
          <Text style={styles.cardTime}>{timeAgo(post.created_at)}</Text>
          <View style={{ flex: 1 }} />
          {isMine && (
            <TouchableOpacity
              onPress={() => onDelete(post)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.deleteBtn}
            >
              <Feather name="trash-2" size={13} color="#f43f5e" />
            </TouchableOpacity>
          )}
          <View style={[styles.badge, isLost ? styles.badgeLost : styles.badgeFound]}>
            <Text style={[styles.badgeText, isLost ? styles.badgeLostText : styles.badgeFoundText]}>
              {isLost ? 'LOST' : 'FOUND'}
            </Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.cardTitle} numberOfLines={1}>
          {isLost ? 'Lost: ' : 'Found: '}{post.title}
        </Text>

        {/* Description */}
        {post.description ? (
          <Text style={styles.cardDesc} numberOfLines={2}>{post.description}</Text>
        ) : null}

        {/* Location */}
        {(post.location_label || post.radius_km) ? (
          <View style={styles.cardLocRow}>
            <Feather name="map-pin" size={11} color="#94a3b8" />
            <Text style={styles.cardLoc}>
              {post.location_label ?? `${post.radius_km}km radius`}
            </Text>
          </View>
        ) : null}

        {/* Actions */}
        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.7}>
            <Feather name="share-2" size={12} color="#64748b" />
            <Text style={styles.shareBtnText}>Share</Text>
          </TouchableOpacity>

          {isLost && (
            <TouchableOpacity style={styles.waBtn} onPress={handleWhatsApp} activeOpacity={0.7}>
              <Text style={{ fontSize: 12 }}>💬</Text>
              <Text style={styles.waBtnText}>WhatsApp</Text>
            </TouchableOpacity>
          )}

          {isMine && post.status !== 'closed' && post.status !== 'found' && (
            <TouchableOpacity
              style={styles.resolveBtn}
              onPress={() => onResolve(post)}
              activeOpacity={0.8}
            >
              <Text style={styles.resolveBtnText}>
                {isLost ? 'Found ✓' : 'Done ✓'}
              </Text>
            </TouchableOpacity>
          )}

          {!isMine && !isLost && post.status === 'open' && (
            <TouchableOpacity
              style={styles.claimBtn}
              onPress={() => router.push(`/community-claim/${post.id}` as any)}
              activeOpacity={0.8}
            >
              <Text style={styles.claimBtnText}>This is mine →</Text>
            </TouchableOpacity>
          )}

          {!isMine && (
            <TouchableOpacity style={styles.reportBtn} onPress={() => onReport(post)} activeOpacity={0.7}>
              <Feather name="flag" size={12} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Group Card ───────────────────────────────────────────────────────────────
function GroupCard({ group, onPress }: { group: CommunityGroup; onPress: () => void }) {
  const groupType = group.type === 'private' ? 'private' : 'public';
  return (
    <TouchableOpacity style={styles.groupCard} onPress={onPress} activeOpacity={0.8}>
      {group.image_url ? (
        <Image source={{ uri: group.image_url }} style={styles.groupAvatar} />
      ) : (
        <View style={[styles.groupAvatar, styles.groupAvatarPlaceholder]}>
          <Text style={{ fontSize: 22 }}>🏛️</Text>
        </View>
      )}
      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={styles.groupTitleRow}>
          <Text style={styles.groupName} numberOfLines={1}>{group.name || 'Unnamed Group'}</Text>
          <View style={[
            styles.groupTypeBadge,
            groupType === 'public' ? styles.groupTypeBadgePublic : styles.groupTypeBadgePrivate
          ]}>
            <Text style={[
              styles.groupTypeBadgeText,
              groupType === 'public' ? { color: '#4338ca' } : { color: '#be185d' }
            ]}>{groupType.toUpperCase()}</Text>
          </View>
        </View>
        <Text style={styles.groupMeta}>
          {group.member_count ?? 0} member{(group.member_count ?? 0) !== 1 ? 's' : ''}
        </Text>
        {group.description ? (
          <Text style={styles.groupDesc} numberOfLines={2}>{group.description}</Text>
        ) : null}
      </View>
      <Feather name="chevron-right" size={18} color="#cbd5e1" style={{ marginLeft: 8 }} />
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function CommunityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { dbUser } = useAuthStore();
  const dbUserId = dbUser?.id ?? null;

  const [activeTab, setActiveTab] = useState<Tab>('feed');
  const [feed, setFeed] = useState<FeedPost[]>([]);
  const [filteredFeed, setFilteredFeed] = useState<FeedPost[]>([]);
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  useEffect(() => {
    if (tabParam === 'groups') setActiveTab('groups');
  }, [tabParam]);

  useEffect(() => {
    fetchAll(true);
    const s1 = supabase.channel('feed_found_v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_items' }, () => fetchAll(false))
      .subscribe();
    const s2 = supabase.channel('feed_lost_v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lost_item_posts' }, () => fetchAll(false))
      .subscribe();
    const s3 = supabase.channel('feed_groups_v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_groups' }, () => fetchAll(false))
      .subscribe();
    return () => {
      try { supabase.removeChannel(s1); } catch {}
      try { supabase.removeChannel(s2); } catch {}
      try { supabase.removeChannel(s3); } catch {}
    };
  }, []);

  // Filter feed on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredFeed(feed);
    } else {
      const q = searchQuery.toLowerCase();
      setFilteredFeed(feed.filter(p =>
        p.title.toLowerCase().includes(q) ||
        (p.description?.toLowerCase().includes(q)) ||
        p.category.toLowerCase().includes(q) ||
        (p.location_label?.toLowerCase().includes(q))
      ));
    }
  }, [searchQuery, feed]);

  const fetchAll = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const [foundRes, lostRes, groupsRes] = await Promise.all([
        supabase
          .from('community_items')
          .select('*, users(full_name)')
          .neq('status', 'closed')
          .order('created_at', { ascending: false })
          .limit(60),
        supabase
          .from('lost_item_posts')
          .select('*, users(full_name)')
          .neq('status', 'closed')
          .order('created_at', { ascending: false })
          .limit(60),
        supabase
          .from('community_groups')
          .select('*')
          .eq('is_official', false)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      const foundPosts: FeedPost[] = (foundRes.data ?? []).map((d: any) => ({
        id: d.id,
        postType: 'found' as PostType,
        title: d.title,
        description: d.description,
        category: d.category,
        location_label: d.location_label,
        image_url: d.image_url,
        status: d.status,
        created_at: d.created_at,
        owner_id: d.finder_id,
        author_name: d.users?.full_name ?? null,
      }));

      const lostPosts: FeedPost[] = (lostRes.data ?? []).map((d: any) => ({
        id: d.id,
        postType: 'lost' as PostType,
        title: d.title,
        description: d.description,
        category: d.category,
        radius_km: d.radius_km,
        image_url: d.image_url,
        status: d.status,
        created_at: d.created_at,
        owner_id: d.poster_id,
        author_name: d.users?.full_name ?? null,
      }));

      const merged = [...foundPosts, ...lostPosts].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setFeed(merged);
      setGroups(
        (Array.isArray(groupsRes.data) ? groupsRes.data : [])
          .filter((g: any) => g?.id)
          .map((g: any) => ({
            id: String(g.id),
            name: g.name ?? 'Unnamed Group',
            description: g.description ?? null,
            image_url: g.image_url ?? null,
            type: g.type === 'private' ? 'private' : 'public',
            member_count: typeof g.member_count === 'number' ? g.member_count : 0,
            created_at: g.created_at ?? new Date().toISOString(),
          }))
      );
    } catch (e) {
      console.warn('Community fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAll(false);
    setRefreshing(false);
  };

  const handleResolve = (post: FeedPost) => {
    const isLost = post.postType === 'lost';
    Alert.alert(
      isLost ? 'Mark as Found' : 'Mark as Handed Over',
      isLost ? 'Did you get your item back? 🎉' : 'Did you successfully return it? 🤝',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isLost ? 'Yes, found it! 🎉' : 'Yes, handed over! 🤝',
          onPress: async () => {
            try {
              const table = isLost ? 'lost_item_posts' : 'community_items';
              const status = isLost ? 'found' : 'closed';
              await supabase.from(table).update({ status }).eq('id', post.id);
              fetchAll();
            } catch {}
          },
        },
      ]
    );
  };

  const handleDelete = (post: FeedPost) => {
    Alert.alert('Delete Post', 'Are you sure you want to delete this post?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const table = post.postType === 'lost' ? 'lost_item_posts' : 'community_items';
            await supabase.from(table).delete().eq('id', post.id);
            fetchAll();
          } catch {}
        },
      },
    ]);
  };

  const handleReport = (post: FeedPost) => {
    Alert.alert(
      'Report Post',
      'Why are you reporting this post?',
      [
        { text: 'False Information', onPress: () => submitReport(post, 'False Information') },
        { text: 'Inappropriate / Sexual Content', onPress: () => submitReport(post, 'Inappropriate Content') },
        { text: 'Spam', onPress: () => submitReport(post, 'Spam') },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const submitReport = async (post: FeedPost, reason: string) => {
    // In a real app, this would insert into a 'reports' table.
    // For now, we show a confirmation.
    Alert.alert('Report Submitted', 'Thank you for keeping the community safe. Our team will review this post.');
  };

  const handleGroupPress = (id: string) => {
    try {
      router.push({ pathname: '/group/[id]', params: { id: String(id) } } as any);
    } catch (e) {
      console.warn('Group nav error:', e);
      Alert.alert('Error', 'Could not open group. Please try again.');
    }
  };

  const topPad = insets.top > 0 ? insets.top : 44;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* ── Header ──────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: topPad }]}>
        <View style={styles.headerTitleRow}>
          <View>
            <Text style={styles.headerTitle}>Finder - Community Feed</Text>
          </View>
          <TouchableOpacity
            style={styles.bellBtn}
            onPress={() => router.push('/notifications' as any)}
            activeOpacity={0.7}
          >
            <Feather name="bell" size={20} color="#0f172a" />
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <View style={styles.searchBar}>
          <Feather name="search" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for items..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={14} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'feed' && styles.tabBtnActive]}
            onPress={() => setActiveTab('feed')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabBtnText, activeTab === 'feed' && styles.tabBtnTextActive]}>
              🏠 Feed
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'groups' && styles.tabBtnActive]}
            onPress={() => setActiveTab('groups')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabBtnText, activeTab === 'groups' && styles.tabBtnTextActive]}>
              👥 Groups
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Content ─────────────────────────────────────────────────── */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : activeTab === 'feed' ? (
        <FlatList
          data={filteredFeed}
          keyExtractor={i => `${i.postType}-${i.id}`}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              currentUserId={dbUserId}
              onResolve={handleResolve}
              onDelete={handleDelete}
              onReport={handleReport}
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
              <Text style={{ fontSize: 52, marginBottom: 12 }}>📋</Text>
              <Text style={styles.emptyTitle}>
                {searchQuery ? 'No results found' : 'Community board is empty'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? `No items match "${searchQuery}"`
                  : 'Tap + Post to report a found or lost item.'}
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={groups}
          keyExtractor={i => i.id}
          renderItem={({ item }) => (
            <GroupCard group={item} onPress={() => handleGroupPress(item.id)} />
          )}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View>
              <TouchableOpacity
                style={styles.createGroupBtn}
                activeOpacity={0.8}
                onPress={() => router.push('/create-group')}
              >
                <Text style={styles.createGroupBtnText}>+ Create Group</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.joinCommunityLink}
                activeOpacity={0.7}
                onPress={() => router.push('/join-community')}
              >
                <Text style={styles.joinCommunityLinkText}>Can't find your college? Search communities →</Text>
              </TouchableOpacity>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#6366f1" colors={['#6366f1']} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={{ fontSize: 52, marginBottom: 12 }}>👥</Text>
              <Text style={styles.emptyTitle}>No groups yet</Text>
              <Text style={styles.emptySubtitle}>Create your university group to get started!</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },

  createGroupBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 4,
    shadowColor: '#6366f1',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  createGroupBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  joinCommunityLink: { alignItems: 'center', marginTop: 10, marginBottom: 6 },
  joinCommunityLinkText: { color: '#6366f1', fontWeight: '700', fontSize: 13 },

  // Header
  header: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 3,
  },
  headerTitleRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 12,
  },
  headerTitle: {
    fontSize: 20, fontWeight: '900', color: '#0f172a', letterSpacing: -0.4,
  },
  bellBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    alignItems: 'center', justifyContent: 'center',
  },

  // Search
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f1f5f9', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#0f172a', padding: 0 },

  // Tabs
  tabRow: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 10, padding: 3 },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabBtnActive: { backgroundColor: '#ffffff', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  tabBtnText: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  tabBtnTextActive: { color: '#0f172a', fontWeight: '800' },

  listContent: { paddingTop: 10, paddingBottom: 160 },

  // Post Card (horizontal list-item style)
  card: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    marginHorizontal: 12, marginBottom: 10,
    borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
  },
  cardImg: { width: 100, height: 120 },
  cardImgFull: { width: '100%', height: '100%' },
  cardImgPlaceholder: {
    backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center',
  },
  cardBody: { flex: 1, padding: 12 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  cardTime: { fontSize: 11, color: '#94a3b8', fontWeight: '500' },
  deleteBtn: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#fef2f2', alignItems: 'center', justifyContent: 'center',
    marginRight: 6,
  },
  badge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  badgeLost: { backgroundColor: '#FEE2E2' },
  badgeFound: { backgroundColor: '#DCFCE7' },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  badgeLostText: { color: '#B91C1C' },
  badgeFoundText: { color: '#15803D' },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  cardDesc: { fontSize: 12, color: '#64748b', lineHeight: 17, marginBottom: 4 },
  cardLocRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 6 },
  cardLoc: { fontSize: 11, color: '#94a3b8', fontWeight: '500', flex: 1 },

  cardActions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#f8fafc', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 5, borderWidth: 1, borderColor: '#e2e8f0',
  },
  shareBtnText: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  waBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#f0fdf4', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 5, borderWidth: 1, borderColor: '#bbf7d0',
  },
  waBtnText: { fontSize: 11, color: '#16a34a', fontWeight: '600' },
  resolveBtn: {
    backgroundColor: '#10b981', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 5,
  },
  resolveBtnText: { fontSize: 11, color: '#fff', fontWeight: '800' },
  claimBtn: {
    backgroundColor: '#6366f1', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 5,
  },
  claimBtnText: { fontSize: 11, color: '#fff', fontWeight: '800' },
  reportBtn: {
    padding: 6, marginLeft: 'auto',
  },

  // Group Cards
  groupCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 12, marginBottom: 10, borderRadius: 16,
    padding: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  groupAvatar: { width: 52, height: 52, borderRadius: 14 },
  groupAvatarPlaceholder: {
    backgroundColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center',
  },
  groupTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  groupName: { fontSize: 15, fontWeight: '800', color: '#0f172a', flex: 1 },
  groupTypeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  groupTypeBadgePublic: { backgroundColor: '#e0e7ff' },
  groupTypeBadgePrivate: { backgroundColor: '#fce7f3' },
  groupTypeBadgeText: { fontSize: 10, fontWeight: '800' },
  groupMeta: { fontSize: 12, color: '#94a3b8', fontWeight: '500', marginBottom: 2 },
  groupDesc: { fontSize: 12, color: '#64748b', lineHeight: 17 },

  // Empty
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginBottom: 10 },
  emptySubtitle: { color: '#64748b', textAlign: 'center', fontSize: 14, lineHeight: 22 },
});

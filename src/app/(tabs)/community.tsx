import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl,
  StatusBar, StyleSheet, ActivityIndicator, Image, Share,
  Alert, Linking, TextInput, Animated,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarClearance } from '../../components/FloatingTabBar';
import { Feather } from '@expo/vector-icons';

// ─── Types ────────────────────────────────────────────────────────────────────
type PostType = 'found' | 'lost';
type Tab = 'feed' | 'groups';

type FeedPost = {
  id: string; postType: PostType; title: string; description: string | null;
  category: string; location_label?: string | null; radius_km?: number;
  image_url: string | null; status: string; created_at: string;
  owner_id: string; author_name: string | null;
};

type CommunityGroup = {
  id: string; name: string; description: string | null; image_url: string | null;
  type: 'public' | 'private'; member_count: number; created_at: string;
};

function timeAgo(ts: string) {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── Post Card ────────────────────────────────────────────────────────────────
function PostCard({ post, currentUserId, onResolve, onDelete, onReport }: any) {
  const router = useRouter();
  const isLost = post.postType === 'lost';
  const isMine = currentUserId === post.owner_id;

  const handleShare = async () => {
    try {
      const link = `https://keepr.dpdns.org/p/${post.id}`;
      await Share.share({
        message: isLost
          ? `🚨 Help find: *${post.title}* (${post.category})\n\n${post.description ?? ''}\n\nView on Keepr:\n${link}`
          : `📦 Found: *${post.title}* near ${post.location_label ?? 'nearby'}\n\n${post.description ?? ''}\n\nView on Keepr:\n${link}`,
      });
    } catch {}
  };

  const handleWhatsApp = () => {
    const link = `https://keepr.dpdns.org/p/${post.id}`;
    const msg = isLost ? `🚨 Lost: *${post.title}*` : `📦 Found: *${post.title}*`;
    Linking.openURL(`whatsapp://send?text=${encodeURIComponent(msg + '\n' + link)}`).catch(() =>
      Alert.alert('WhatsApp Not Available', 'Please install WhatsApp.')
    );
  };

  return (
    <TouchableOpacity
      style={[styles.card, isLost && styles.cardLost]}
      activeOpacity={0.88}
      onPress={() => router.push({ pathname: '/post/[id]', params: { id: String(post.id) } } as any)}
    >
      {isLost && <View style={styles.cardLostBar} />}
      
      <View style={styles.cardContent}>
        {/* Thumbnail */}
        <View style={styles.cardThumbnail}>
          {post.image_url ? (
            <Image source={{ uri: post.image_url }} style={styles.cardImg} />
          ) : (
            <View style={[styles.cardImgPlaceholder, isLost ? {backgroundColor:'#fff1f2'} : {backgroundColor:'#f0fdf4'}]}>
              <Text style={{ fontSize: 32 }}>{isLost ? '🔍' : '📦'}</Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.cardInfo}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.pill, isLost ? styles.pillLost : styles.pillFound]}>
              <View style={[styles.pillDot, isLost ? {backgroundColor:'#ef4444'} : {backgroundColor:'#22c55e'}]} />
              <Text style={[styles.pillText, isLost ? {color:'#dc2626'} : {color:'#16a34a'}]}>{isLost ? 'LOST' : 'FOUND'}</Text>
            </View>
            <View style={{ flex: 1 }} />
            <Text style={styles.cardTime}>{timeAgo(post.created_at)}</Text>
            {isMine && (
              <TouchableOpacity onPress={() => onDelete(post)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginLeft: 8 }}>
                <Feather name="trash-2" size={14} color="#f43f5e" />
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.cardTitle} numberOfLines={1}>{post.title}</Text>
          
          {(post.location_label || post.radius_km) && (
            <View style={styles.cardLocRow}>
              <Feather name="map-pin" size={12} color="#6366f1" />
              <Text style={styles.cardLocText} numberOfLines={1}>
                {post.location_label ?? `${post.radius_km}km radius`}
              </Text>
            </View>
          )}
          
          {post.description && <Text style={styles.cardDesc} numberOfLines={2}>{post.description}</Text>}

          {/* Actions */}
          <View style={styles.cardActionsRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={handleShare} activeOpacity={0.7}>
              <Feather name="share-2" size={12} color="#6366f1" />
              <Text style={styles.actionBtnText}>Share</Text>
            </TouchableOpacity>

            {isLost && (
              <TouchableOpacity style={styles.actionBtn} onPress={handleWhatsApp} activeOpacity={0.7}>
                <Text style={{ fontSize: 10 }}>💬</Text>
                <Text style={styles.actionBtnText}>WhatsApp</Text>
              </TouchableOpacity>
            )}

            {isMine && post.status !== 'closed' && post.status !== 'found' && (
              <TouchableOpacity style={styles.actionBtnPrimary} onPress={() => onResolve(post)} activeOpacity={0.8}>
                <Text style={styles.actionBtnPrimaryText}>{isLost ? 'Found ✓' : 'Done ✓'}</Text>
              </TouchableOpacity>
            )}

            {!isMine && !isLost && post.status === 'open' && (
              <TouchableOpacity style={styles.actionBtnPrimary} onPress={() => router.push(`/community-claim/${post.id}` as any)} activeOpacity={0.8}>
                <Text style={styles.actionBtnPrimaryText}>Claim →</Text>
              </TouchableOpacity>
            )}

            {!isMine && (
              <TouchableOpacity style={{ marginLeft: 'auto', padding: 4 }} onPress={() => onReport(post)} activeOpacity={0.7}>
                <Feather name="flag" size={14} color="#cbd5e1" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Group Card ───────────────────────────────────────────────────────────────
function GroupCard({ group, onPress }: any) {
  const isPrivate = group.type === 'private';
  return (
    <TouchableOpacity style={styles.groupCard} onPress={onPress} activeOpacity={0.88}>
      {group.image_url ? (
        <Image source={{ uri: group.image_url }} style={styles.groupAvatar} />
      ) : (
        <View style={styles.groupAvatarPlaceholder}>
          <Text style={{ fontSize: 24 }}>🏛️</Text>
        </View>
      )}
      <View style={{ flex: 1, marginLeft: 14 }}>
        <View style={styles.groupTitleRow}>
          <Text style={styles.groupTitle} numberOfLines={1}>{group.name || 'Unnamed Group'}</Text>
          <View style={[styles.groupBadge, isPrivate ? styles.groupBadgePrivate : styles.groupBadgePublic]}>
            <Text style={[styles.groupBadgeText, isPrivate ? {color:'#be185d'} : {color:'#4338ca'}]}>
              {isPrivate ? 'PRIVATE' : 'PUBLIC'}
            </Text>
          </View>
        </View>
        <Text style={styles.groupMembers}>{group.member_count ?? 0} member{(group.member_count ?? 0) !== 1 ? 's' : ''}</Text>
        {group.description && <Text style={styles.groupDesc} numberOfLines={2}>{group.description}</Text>}
      </View>
      <Feather name="chevron-right" size={20} color="#cbd5e1" />
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function CommunityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const { dbUser } = useAuthStore();
  const dbUserId = dbUser?.id ?? null;

  const [activeTab, setActiveTab] = useState<Tab>('feed');
  const [feed, setFeed] = useState<FeedPost[]>([]);
  const [filteredFeed, setFilteredFeed] = useState<FeedPost[]>([]);
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [communityName, setCommunityName] = useState<string | null>(null);
  const [communityMemberCount, setCommunityMemberCount] = useState<number | null>(null);
  const [userCollegeId, setUserCollegeId] = useState<string | null>(null);

  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  useEffect(() => { if (tabParam === 'groups') setActiveTab('groups'); }, [tabParam]);

  useEffect(() => {
    if (!dbUserId) return;
    (async () => {
      const { data } = await supabase
        .from('group_members')
        .select('community_groups!inner(id, name, member_count, is_official, college_id)')
        .eq('user_id', dbUserId)
        .eq('community_groups.is_official', true)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      const group = (data as any)?.community_groups;
      if (group) {
        setCommunityName(group.name);
        setCommunityMemberCount(group.member_count ?? null);
        setUserCollegeId(group.college_id ?? null);
      }
    })();
  }, [dbUserId]);

  useEffect(() => {
    fetchAll(true);
    const s1 = supabase.channel('feed_found_v2').on('postgres_changes', { event: '*', schema: 'public', table: 'community_items' }, () => fetchAll(false)).subscribe();
    const s2 = supabase.channel('feed_lost_v2').on('postgres_changes', { event: '*', schema: 'public', table: 'lost_item_posts' }, () => fetchAll(false)).subscribe();
    const s3 = supabase.channel('feed_groups_v2').on('postgres_changes', { event: '*', schema: 'public', table: 'community_groups' }, () => fetchAll(false)).subscribe();
    return () => { try { supabase.removeChannel(s1); supabase.removeChannel(s2); supabase.removeChannel(s3); } catch {} };
  }, [userCollegeId]);

  useEffect(() => {
    if (!searchQuery.trim()) { setFilteredFeed(feed); }
    else {
      const q = searchQuery.toLowerCase();
      setFilteredFeed(feed.filter(p => p.title.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || p.location_label?.toLowerCase().includes(q)));
    }
  }, [searchQuery, feed]);

  const fetchAll = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      // Build feed queries — filter by user's college if known, else show nothing community-specific
      let foundQuery = supabase.from('community_items').select('*, users(full_name)').neq('status', 'closed').order('created_at', { ascending: false }).limit(60);
      let lostQuery  = supabase.from('lost_item_posts').select('*, users(full_name)').neq('status', 'closed').order('created_at', { ascending: false }).limit(60);

      if (userCollegeId) {
        foundQuery = foundQuery.eq('college_id', userCollegeId);
        lostQuery  = lostQuery.eq('college_id', userCollegeId);
      } else {
        // No verified college — show empty feed rather than global feed
        foundQuery = foundQuery.eq('college_id', '00000000-0000-0000-0000-000000000000');
        lostQuery  = lostQuery.eq('college_id', '00000000-0000-0000-0000-000000000000');
      }

      const [foundRes, lostRes, groupsRes] = await Promise.all([
        foundQuery,
        lostQuery,
        supabase.from('community_groups').select('*').eq('is_official', false).order('created_at', { ascending: false }).limit(50),
      ]);

      const foundPosts: FeedPost[] = (foundRes.data ?? []).map((d: any) => ({ ...d, postType: 'found', owner_id: d.finder_id, author_name: d.users?.full_name }));
      const lostPosts: FeedPost[] = (lostRes.data ?? []).map((d: any) => ({ ...d, postType: 'lost', owner_id: d.poster_id, author_name: d.users?.full_name }));
      setFeed([...foundPosts, ...lostPosts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      setGroups((groupsRes.data ?? []).filter((g:any) => g?.id).map((g:any) => ({ ...g, id: String(g.id), type: g.type === 'private' ? 'private' : 'public', member_count: g.member_count ?? 0 })));
    } catch (e) {} finally { setLoading(false); }
  }, [userCollegeId]);

  const handleRefresh = async () => { setRefreshing(true); await fetchAll(false); setRefreshing(false); };
  
  const handleResolve = (post: FeedPost) => {
    const isLost = post.postType === 'lost';
    Alert.alert(isLost ? 'Mark as Found' : 'Mark as Handed Over', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes', onPress: async () => { await supabase.from(isLost ? 'lost_item_posts' : 'community_items').update({ status: isLost ? 'found' : 'closed' }).eq('id', post.id); fetchAll(); } }
    ]);
  };
  const handleDelete = (post: FeedPost) => {
    Alert.alert('Delete Post', 'Are you sure?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { await supabase.from(post.postType === 'lost' ? 'lost_item_posts' : 'community_items').delete().eq('id', post.id); fetchAll(); } }]);
  };
  const handleReport = () => Alert.alert('Report Submitted', 'Thank you. Our team will review this post.');

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#6366f1" />

      {/* ── Gradient Header ── */}
      <LinearGradient
        colors={['#6366f1', '#7c3aed']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.hCircle1} />
        <View style={styles.hCircle2} />

        <View style={styles.headerTop}>
          <View style={{ flex: 1, paddingRight: 16 }}>
            <Text style={styles.headerLabel}>YOUR COMMUNITY</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {communityName ?? 'Community'}
            </Text>
            {communityMemberCount != null && (
              <Text style={styles.headerMemberCount}>
                {communityMemberCount.toLocaleString()} member{communityMemberCount === 1 ? '' : 's'}
              </Text>
            )}
          </View>
          <TouchableOpacity style={styles.bellBtn} onPress={() => router.push('/notifications' as any)} activeOpacity={0.8}>
            <Feather name="bell" size={20} color="#6366f1" />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchBar}>
          <Feather name="search" size={16} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search posts or groups..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Feather name="x" size={16} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Tabs */}
        <View style={styles.tabRow}>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'feed' && styles.tabBtnActive]} onPress={() => setActiveTab('feed')} activeOpacity={0.8}>
            <Text style={[styles.tabBtnText, activeTab === 'feed' && styles.tabBtnTextActive]}>Found & Lost Board</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'groups' && styles.tabBtnActive]} onPress={() => setActiveTab('groups')} activeOpacity={0.8}>
            <Text style={[styles.tabBtnText, activeTab === 'groups' && styles.tabBtnTextActive]}>Local Groups</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* ── Body ── */}
      <View style={styles.body}>
        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color="#6366f1" /></View>
        ) : activeTab === 'feed' ? (
          <FlatList
            data={filteredFeed}
            keyExtractor={i => `${i.postType}-${i.id}`}
            renderItem={({ item }) => <PostCard post={item} currentUserId={dbUserId} onResolve={handleResolve} onDelete={handleDelete} onReport={handleReport} />}
            contentContainerStyle={[styles.listContent, { paddingBottom: tabBarClearance }]}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#6366f1" />}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={{ fontSize: 52, marginBottom: 12 }}>📋</Text>
                <Text style={styles.emptyTitle}>{searchQuery ? 'No results found' : 'Board is empty'}</Text>
                <Text style={styles.emptySub}>Tap + to report a found or lost item.</Text>
              </View>
            }
          />
        ) : (
          <FlatList
            data={groups}
            keyExtractor={i => i.id}
            renderItem={({ item }) => <GroupCard group={item} onPress={() => router.push({ pathname: '/group/[id]', params: { id: String(item.id) } } as any)} />}
            contentContainerStyle={[styles.listContent, { paddingBottom: tabBarClearance }]}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View style={{ marginBottom: 16 }}>
                <TouchableOpacity style={styles.createGroupBtn} activeOpacity={0.88} onPress={() => router.push('/create-group')}>
                  <LinearGradient colors={['#6366f1', '#7c3aed']} style={styles.createGroupGrad} start={{x:0,y:0}} end={{x:1,y:0}}>
                    <Text style={styles.createGroupText}>+ Create Group</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity style={styles.joinLink} onPress={() => router.push('/join-community')}>
                  <Text style={styles.joinLinkText}>Browse all communities →</Text>
                </TouchableOpacity>
              </View>
            }
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#6366f1" />}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={{ fontSize: 52, marginBottom: 12 }}>👥</Text>
                <Text style={styles.emptyTitle}>No groups yet</Text>
                <Text style={styles.emptySub}>Create your university group to get started!</Text>
              </View>
            }
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8faff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  /* Header */
  header: { paddingHorizontal: 20, paddingBottom: 12, overflow: 'hidden', position: 'relative' },
  hCircle1: { position: 'absolute', top: -30, right: -30, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.08)' },
  hCircle2: { position: 'absolute', bottom: -20, left: -40, width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(255,255,255,0.06)' },
  
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  headerTitle: { color: '#ffffff', fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  headerLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 0 },
  headerMemberCount: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '600', marginTop: 1 },
  bellBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },

  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: '#0f172a', fontWeight: '500' },

  tabRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: 4 },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabBtnActive: { backgroundColor: '#ffffff', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  tabBtnText: { fontSize: 14, color: '#ffffff', fontWeight: '700' },
  tabBtnTextActive: { color: '#6366f1', fontWeight: '800' },

  /* Body */
  body: { flex: 1, backgroundColor: '#f8faff' },
  listContent: { paddingHorizontal: 16, paddingTop: 16 },

  /* Post Card */
  card: { backgroundColor: '#ffffff', borderRadius: 22, marginBottom: 16, shadowColor: '#6366f1', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 3, borderWidth: 1, borderColor: '#f1f5f9', overflow: 'hidden' },
  cardLost: { borderColor: 'rgba(244,63,94,0.3)', shadowColor: '#f43f5e', shadowOpacity: 0.15 },
  cardLostBar: { height: 4, backgroundColor: '#f43f5e', width: '100%' },
  cardContent: { flexDirection: 'row', padding: 14 },
  
  cardThumbnail: { width: 80, height: 80, borderRadius: 16, overflow: 'hidden', marginRight: 14 },
  cardImg: { width: '100%', height: '100%' },
  cardImgPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },

  cardInfo: { flex: 1 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  pillLost: { backgroundColor: '#fee2e2' }, pillFound: { backgroundColor: '#dcfce7' },
  pillDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  pillText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  cardTime: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },

  cardTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  cardLocRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  cardLocText: { fontSize: 12, color: '#6366f1', fontWeight: '600', marginLeft: 4 },
  cardDesc: { fontSize: 13, color: '#64748b', lineHeight: 18, marginBottom: 10 },

  cardActionsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  actionBtnText: { fontSize: 11, color: '#475569', fontWeight: '700', marginLeft: 4 },
  actionBtnPrimary: { backgroundColor: '#eef2ff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: '#c7d2fe' },
  actionBtnPrimaryText: { fontSize: 11, color: '#6366f1', fontWeight: '800' },

  /* Group Card */
  groupCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 20, padding: 16, marginBottom: 12, shadowColor: '#8b5cf6', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3, borderWidth: 1, borderColor: '#f1f5f9' },
  groupAvatar: { width: 60, height: 60, borderRadius: 18 },
  groupAvatarPlaceholder: { width: 60, height: 60, borderRadius: 18, backgroundColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center' },
  groupTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  groupTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', flex: 1, marginRight: 8 },
  groupBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  groupBadgePublic: { backgroundColor: '#e0e7ff' }, groupBadgePrivate: { backgroundColor: '#fce7f3' },
  groupBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  groupMembers: { fontSize: 12, color: '#94a3b8', fontWeight: '600', marginBottom: 4 },
  groupDesc: { fontSize: 13, color: '#64748b', lineHeight: 18 },

  createGroupBtn: { borderRadius: 18, overflow: 'hidden', shadowColor: '#6366f1', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  createGroupGrad: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  createGroupText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  joinLink: { alignItems: 'center', marginTop: 12 },
  joinLinkText: { color: '#6366f1', fontSize: 13, fontWeight: '700' },

  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginBottom: 8 },
  emptySub: { color: '#64748b', textAlign: 'center', fontSize: 14, lineHeight: 22 },
});

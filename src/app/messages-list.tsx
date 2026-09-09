import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl,
  StatusBar, Animated, Alert, LayoutAnimation, StyleSheet,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

type ConversationRow = {
  id: string;
  item_id: string | null;
  owner_id: string;
  finder_user_id: string | null;
  finder_name: string | null;
  finder_phone: string | null;
  scan_location: string | null;
  resolved: boolean;
  created_at: string;
  community_item_id?: string | null;
  lost_post_id?: string | null;
  items?: { item_name: string; image_url?: string } | null;
  community_items?: { title: string; image_url?: string } | null;
  lost_posts?: { title: string } | null;
  last_message?: string;
};

export function MessagesList({ bottomPadding = 100 }: { bottomPadding?: number }) {
  const { user } = useAuthStore();
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    if (!user?.id) return;
    fetchConversations();
    // Real-time: new conversations (works when the screen is already open)
    const channel = supabase
      .channel(`connect_convs_${user.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'conversations', filter: `owner_id=eq.${user.id}` },
        () => { fetchConversations(); }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'conversations', filter: `finder_user_id=eq.${user.id}` },
        () => { fetchConversations(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  // Refetch every time this tab regains focus — the previous version only
  // fetched once on mount, so navigating away and back showed stale/empty
  // data even after a conversation was created in the meantime.
  useFocusEffect(
    useCallback(() => {
      if (user?.id) fetchConversations();
    }, [user])
  );

  const fetchConversations = async () => {
    if (!user?.id) return;
    setLoading(true);

    // Note: community_items cannot be joined directly because PostgREST's schema
    // cache doesn't recognise the community_item_id foreign key yet (PGRST200).
    // We fetch community item names in a second pass instead.
    const { data, error } = await supabase
      .from('conversations')
      .select('*, items(item_name, image_url)')
      .or(`owner_id.eq.${user.id},finder_user_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Messages] fetch error:', error.message, error.code);
      setLoading(false);
      return;
    }

    if (data) {
      // Load locally-cleared IDs so we can hide them even if the DB delete
      // hasn't taken effect yet (e.g. before migration 015 is applied).
      const clearedRaw = await AsyncStorage.getItem(`@cleared_convs_${user.id}`);
      const clearedIds: string[] = clearedRaw ? JSON.parse(clearedRaw) : [];

      // Filter out cleared conversations and enrich with last message + CI name
      const visible = (data as ConversationRow[]).filter(c => !clearedIds.includes(c.id));

      const withMessages = await Promise.all(
        visible.map(async (conv) => {
          const [msgRes, ciRes, lpRes] = await Promise.all([
            supabase.from('messages').select('body').eq('conversation_id', conv.id).order('created_at', { ascending: false }).limit(1),
            conv.community_item_id
              ? supabase.from('community_items').select('title, image_url').eq('id', conv.community_item_id).single()
              : Promise.resolve({ data: null }),
            (conv as any).lost_post_id
              ? supabase.from('lost_item_posts').select('title').eq('id', (conv as any).lost_post_id).single()
              : Promise.resolve({ data: null }),
          ]);
          return {
            ...conv,
            last_message: msgRes.data?.[0]?.body ?? null,
            community_items: ciRes.data ?? null,
            lost_posts: lpRes.data ?? null,
          };
        })
      );
      setConversations(withMessages);
    }
    setLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchConversations();
    setRefreshing(false);
  };

  const clearAll = async () => {
    const uid = user?.id;
    if (!uid || conversations.length === 0) return;
    Alert.alert(
      'Clear All Messages',
      'Remove all conversations from your inbox?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            const ids = conversations.map(c => c.id);

            // 1. Persist the cleared IDs locally so they stay hidden after
            //    useFocusEffect refetches (works even without the DB delete policy).
            const existing = await AsyncStorage.getItem(`@cleared_convs_${uid}`);
            const prev: string[] = existing ? JSON.parse(existing) : [];
            await AsyncStorage.setItem(
              `@cleared_convs_${uid}`,
              JSON.stringify([...new Set([...prev, ...ids])])
            );

            // 2. Attempt real DB deletion (requires migration 015 to be applied).
            //    Silent failure is OK — the AsyncStorage filter above handles it.
            await Promise.all([
              supabase.from('conversations').delete().eq('owner_id', uid),
              supabase.from('conversations').delete().eq('finder_user_id', uid),
            ]);

            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setConversations([]);
          },
        },
      ]
    );
  };

  const formatDate = (ts: string) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = (now.getTime() - d.getTime()) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString();
  };

  const renderItem = ({ item }: { item: ConversationRow }) => {
    const isFinder = item.finder_user_id === user?.id;

    // Determine display name and subtext based on conversation type
    let itemName = 'Chat';
    let subText  = '';
    let emoji    = '🔍';

    if ((item as any).lost_posts?.title) {
      // Lost-item contact conversation (Sprint I: "I Found This")
      itemName = (item as any).lost_posts.title;
      subText  = isFinder ? 'You contacted the owner' : 'Someone says they found this';
      emoji    = '👋';
    } else if (item.community_items?.title) {
      // Community found-item claim
      itemName = item.community_items.title;
      subText  = isFinder ? 'Found Item Claim Chat' : 'Ownership Claim Chat';
      emoji    = '🙋';
    } else if (item.items?.item_name) {
      // NFC item scan conversation
      itemName = item.items.item_name;
      subText  = isFinder ? 'You scanned this' : (item.finder_name ? `Found by ${item.finder_name}` : 'Anonymous finder');
      emoji    = '📡';
    } else {
      subText = isFinder ? 'You initiated contact' : 'Incoming message';
      emoji   = '💬';
    }

    return (
      <TouchableOpacity
        style={[
          styles.convCard,
          item.resolved ? styles.convCardResolved : styles.convCardActive,
        ]}
        onPress={() => router.push(`/conversation/${item.id}`)}
        activeOpacity={0.8}
      >
        <View style={styles.convRow}>
          {/* Avatar */}
          <View style={[styles.avatar, item.resolved && styles.avatarResolved]}>
            <Text style={styles.avatarEmoji}>{item.resolved ? '✅' : emoji}</Text>
          </View>

          {/* Content */}
          <View style={styles.convContent}>
            <View style={styles.convTopRow}>
              <Text style={styles.convTitle} numberOfLines={1}>{itemName}</Text>
              <Text style={styles.convTime}>{formatDate(item.created_at)}</Text>
            </View>
            <Text style={styles.convSub}>{subText}</Text>
            {item.scan_location && (
              <Text style={styles.convLocation}>📍 {item.scan_location}</Text>
            )}
            {item.last_message && (
              <Text style={styles.convPreview} numberOfLines={1}>
                "{item.last_message}"
              </Text>
            )}
          </View>
        </View>

        {item.resolved && (
          <View style={styles.resolvedPill}>
            <Text style={styles.resolvedPillText}>✓ Resolved</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.listRoot}>
      <StatusBar barStyle="dark-content" />

      {loading && conversations.length === 0 ? (
        <View style={styles.loadingBox}>
          <Text style={{ fontSize: 40, marginBottom: 16 }}>💬</Text>
          <Text style={{ color: '#6366f1', fontWeight: '700' }}>Loading messages…</Text>
        </View>
      ) : (
        <Animated.View style={{ opacity: fadeIn, flex: 1 }}>
          <FlatList
            data={conversations}
            keyExtractor={(c) => c.id}
            renderItem={renderItem}
            contentContainerStyle={{ padding: 16, paddingBottom: bottomPadding }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#6366f1" colors={['#6366f1']} />
            }
            ListHeaderComponent={
              conversations.length > 0 ? (
                <TouchableOpacity
                  onPress={clearAll}
                  activeOpacity={0.7}
                  style={styles.clearBtn}
                >
                  <Text style={styles.clearBtnText}>🗑 Clear All</Text>
                </TouchableOpacity>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <View style={styles.emptyIcon}>
                  <Text style={{ fontSize: 40 }}>🤝</Text>
                </View>
                <Text style={styles.emptyTitle}>No Messages Yet</Text>
                <Text style={styles.emptySub}>
                  When someone contacts you about a lost item or you claim a found item, your conversations appear here.
                </Text>
              </View>
            }
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  listRoot: { flex: 1, backgroundColor: '#f8faff' },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  convCard: {
    backgroundColor: '#ffffff', borderRadius: 20, padding: 16, marginBottom: 12,
    borderWidth: 1, shadowColor: '#6366f1', shadowOpacity: 0.06, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  convCardActive: { borderColor: '#e2e8f0' },
  convCardResolved: { borderColor: '#bbf7d0', opacity: 0.8 },
  convRow: { flexDirection: 'row', alignItems: 'flex-start' },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#ede9fe', borderWidth: 1, borderColor: '#c4b5fd',
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  avatarResolved: { backgroundColor: '#dcfce7', borderColor: '#86efac' },
  avatarEmoji: { fontSize: 22 },
  convContent: { flex: 1 },
  convTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  convTitle: { color: '#0f172a', fontWeight: '800', fontSize: 15, flex: 1 },
  convTime: { color: '#94a3b8', fontSize: 11, fontWeight: '600', marginLeft: 8 },
  convSub: { color: '#6366f1', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  convLocation: { color: '#64748b', fontSize: 11, marginBottom: 4 },
  convPreview: { color: '#64748b', fontSize: 13, fontStyle: 'italic' },
  resolvedPill: {
    marginTop: 10, alignSelf: 'flex-start',
    backgroundColor: '#dcfce7', borderWidth: 1, borderColor: '#86efac',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4,
  },
  resolvedPillText: { color: '#15803d', fontSize: 11, fontWeight: '800' },

  clearBtn: {
    alignSelf: 'flex-end', marginBottom: 12,
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: '#fee2e2', borderRadius: 20,
    borderWidth: 1, borderColor: '#fecaca',
  },
  clearBtnText: { color: '#dc2626', fontWeight: '700', fontSize: 13 },

  emptyBox: { paddingTop: 60, alignItems: 'center', paddingHorizontal: 32 },
  emptyIcon: {
    width: 88, height: 88, backgroundColor: '#ffffff',
    borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 44,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
    shadowColor: '#6366f1', shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
  },
  emptyTitle: { color: '#0f172a', fontSize: 20, fontWeight: '800', marginBottom: 10 },
  emptySub: {
    color: '#64748b', fontSize: 13, fontWeight: '500',
    textAlign: 'center', lineHeight: 20,
  },
});

// Default export so Expo Router treats /messages-list as a valid route
export default MessagesList;

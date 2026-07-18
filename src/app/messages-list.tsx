import { useEffect, useState, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl,
  StatusBar, Animated, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
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
  items?: { item_name: string; image_url?: string } | null;
  community_items?: { title: string; image_url?: string } | null;
  last_message?: string;
};

export function MessagesList() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    if (user?.id) {
      fetchConversations();
      // Real-time: new conversations
      const channel = supabase
        .channel('connect_convs')
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'conversations' },
          () => fetchConversations()
        )
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [user]);

  const fetchConversations = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('conversations')
      .select('*, items(item_name, image_url), community_items:community_item_id(title, image_url)')
      .or(`owner_id.eq.${user.id},finder_user_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (data) {
      // Fetch last message for each conversation
      const withMessages = await Promise.all(
        (data as ConversationRow[]).map(async (conv) => {
          const { data: msgs } = await supabase
            .from('messages')
            .select('body')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1);
          return { ...conv, last_message: msgs?.[0]?.body ?? null };
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
    const itemName = item.community_items?.title ?? item.items?.item_name ?? 'Unknown Item';
    const isFinder = item.finder_user_id === user?.id;

    let subText = '';
    if (item.community_item_id) {
      subText = isFinder ? 'Found Item Claim Chat' : 'Ownership Claim Chat';
    } else {
      subText = isFinder ? 'You scanned this' : (item.finder_name ? `Found by ${item.finder_name}` : 'Anonymous finder');
    }

    return (
      <TouchableOpacity
        className={`bg-white border rounded-2xl p-4 mb-3 shadow-sm ${item.resolved ? 'border-green-200 opacity-70' : 'border-slate-200'}`}
        onPress={() => router.push(`/conversation/${item.id}`)}
        activeOpacity={0.8}
      >
        <View className="flex-row items-start">
          {/* Avatar */}
          <View className="w-12 h-12 bg-primary/10 border border-primary/20 rounded-full items-center justify-center mr-4 shrink-0">
            <Text className="text-xl">
              {item.resolved ? '✅' : item.community_item_id ? '🙋' : '🔍'}
            </Text>
          </View>

          {/* Content */}
          <View className="flex-1">
            <View className="flex-row justify-between items-center mb-0.5">
              <Text className="text-slate-900 font-bold text-base flex-1" numberOfLines={1}>
                {itemName}
              </Text>
              <Text className="text-slate-500 text-xs ml-2">{formatDate(item.created_at)}</Text>
            </View>

            <Text className="text-slate-600 text-sm mb-1 font-medium">
              {subText}
            </Text>

            {item.scan_location && (
              <Text className="text-slate-500 text-xs mb-1">📍 {item.scan_location}</Text>
            )}

            {item.last_message && (
              <Text className="text-slate-500 text-sm italic" numberOfLines={1}>
                "{item.last_message}"
              </Text>
            )}
          </View>
        </View>

        {item.resolved && (
          <View className="mt-2 bg-green-100 border border-green-200 rounded-xl px-3 py-1 self-start">
            <Text className="text-green-700 text-xs font-bold">Resolved</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 bg-slate-50">
      <StatusBar barStyle="dark-content" />

      {/* Header removed for unified wrapper */}

      {loading && conversations.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#e11d48" size="large" />
        </View>
      ) : (
        <Animated.View style={{ opacity: fadeIn, flex: 1 }}>
          <FlatList
            data={conversations}
            keyExtractor={(c) => c.id}
            renderItem={renderItem}
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#e11d48" colors={['#e11d48']} />
            }
            ListEmptyComponent={
              <View className="items-center justify-center py-28">
                <View className="w-24 h-24 bg-white border border-slate-200 rounded-full items-center justify-center mb-6 shadow-sm">
                  <Text className="text-4xl">🤝</Text>
                </View>
                <Text className="text-slate-900 text-xl font-bold mb-2">No Connections Yet</Text>
                <Text className="text-slate-500 text-center px-10 leading-6 font-medium">
                  When someone finds one of your items and scans its tag, they'll appear here.
                </Text>
              </View>
            }
          />
        </Animated.View>
      )}
    </View>
  );
}

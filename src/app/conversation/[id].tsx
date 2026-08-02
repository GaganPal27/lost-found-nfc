import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, FlatList,
  KeyboardAvoidingView, Platform, StatusBar, ActivityIndicator,
  Alert, Linking, StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { useTabBarClearance } from '../../components/FloatingTabBar';
import * as Haptics from 'expo-haptics';

type Message = {
  id: string;
  sender_name: string;
  sender_id: string | null;
  body: string;
  created_at: string;
};

type Conversation = {
  id: string;
  item_id: string | null;
  owner_id: string;
  finder_name: string | null;
  finder_phone: string | null;
  scan_location: string | null;
  scan_lat: number | null;
  scan_lng: number | null;
  resolved: boolean;
  community_item_id?: string | null;
  items?: { item_name: string } | null;
  communityItemTitle?: string | null;
};

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, dbUser } = useAuthStore();

  const [conv, setConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const tabBarClearance = useTabBarClearance();

  // ── Load conversation + initial messages ─────────────────────────────────
  useEffect(() => {
    if (!id) return;
    loadConversation();
    loadMessages();

    const channel = supabase
      .channel(`conv_${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const loadConversation = async () => {
    // NOTE: community_items join removed — PostgREST schema cache doesn't recognise
    // the community_item_id FK yet (PGRST200). We fetch community item title separately.
    const { data, error } = await supabase
      .from('conversations')
      .select('*, items(item_name)')
      .eq('id', id)
      .single();

    if (error) {
      console.warn('[Conversation] loadConversation error:', error.message);
      return;
    }

    if (data) {
      // Fetch community item title separately if needed
      let communityItemTitle: string | null = null;
      if (data.community_item_id) {
        const { data: ci } = await supabase
          .from('community_items')
          .select('title')
          .eq('id', data.community_item_id)
          .single();
        communityItemTitle = ci?.title ?? null;
      }
      setConv({ ...data, communityItemTitle } as Conversation);
    }
  };

  const loadMessages = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });
    if (data) setMessages(data as Message[]);
    setLoading(false);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
  };

  // ── Send a message ─────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!body.trim()) return;
    setSending(true);
    const senderName = dbUser?.full_name ?? (user?.email?.split('@')[0] ?? 'User');
    const { error } = await supabase.from('messages').insert({
      conversation_id: id,
      sender_id: user?.id ?? null,
      sender_name: senderName,
      body: body.trim(),
    });
    if (error) {
      Alert.alert('Error', 'Could not send message. Please try again.');
      console.error('[Conversation] sendMessage error:', error.message);
    } else {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setBody('');
    }
    setSending(false);
  };

  const handleCallFinder = () => {
    if (!conv?.finder_phone) {
      Alert.alert('No Phone', 'The finder did not provide a phone number.');
      return;
    }
    Linking.openURL(`tel:${conv.finder_phone}`);
  };

  const handleResolve = async () => {
    Alert.alert(
      'Mark as Resolved?',
      'This will close the conversation and mark the item as found.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Resolve', style: 'default',
          onPress: async () => {
            await supabase.from('conversations').update({ resolved: true }).eq('id', id);
            if (conv?.item_id) {
              await supabase.from('items').update({ status: 'found' }).eq('id', conv.item_id);
            } else if (conv?.community_item_id) {
              await supabase.from('community_items').update({ status: 'closed' }).eq('id', conv.community_item_id);
            }
            setConv((prev) => prev ? { ...prev, resolved: true } : prev);
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const isOwner = user?.id === conv?.owner_id;
  const itemName = conv?.communityItemTitle ?? conv?.items?.item_name ?? 'Chat';

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender_id === user?.id;
    return (
      <View style={[styles.msgWrapper, isMe ? styles.msgWrapperMe : styles.msgWrapperOther]}>
        <Text style={styles.msgSender}>{isMe ? 'You' : item.sender_name}</Text>
        <View style={[styles.msgBubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
          <Text style={isMe ? styles.msgTextMe : styles.msgTextOther}>{item.body}</Text>
        </View>
        <Text style={styles.msgTime}>{formatTime(item.created_at)}</Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <Text style={styles.backArrow}>←</Text>
            <Text style={styles.backLabel}>Back</Text>
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>{itemName}</Text>
            {conv?.scan_location && (
              <Text style={styles.headerSub} numberOfLines={1}>📍 {conv.scan_location}</Text>
            )}
          </View>

          {isOwner && (
            <View style={styles.headerActions}>
              {conv?.finder_phone && (
                <TouchableOpacity style={styles.actionBtn} onPress={handleCallFinder} activeOpacity={0.7}>
                  <Text style={{ fontSize: 18 }}>📞</Text>
                </TouchableOpacity>
              )}
              {!conv?.resolved && (
                <TouchableOpacity style={[styles.actionBtn, styles.resolveBtn]} onPress={handleResolve} activeOpacity={0.7}>
                  <Text style={{ color: '#6366f1', fontWeight: '800', fontSize: 13 }}>✓</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {conv?.resolved && (
          <View style={styles.resolvedBanner}>
            <Text style={styles.resolvedText}>✓ Resolved — Item Returned</Text>
          </View>
        )}

        {/* Finder info banner (owner only) */}
        {isOwner && conv?.finder_name && (
          <View style={styles.finderBanner}>
            <View style={styles.finderAvatar}>
              <Text style={{ fontSize: 18 }}>👤</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.finderName}>{conv.finder_name}</Text>
              {conv.finder_phone && (
                <Text style={styles.finderPhone}>{conv.finder_phone}</Text>
              )}
            </View>
            {conv.finder_phone && (
              <TouchableOpacity onPress={handleCallFinder} activeOpacity={0.7} style={styles.callBtn}>
                <Text style={styles.callBtnText}>Call</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Messages list */}
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#6366f1" size="large" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={renderMessage}
            // paddingBottom pushes the last message above both the input bar
            // AND the FloatingTabBar that sits at the very bottom of the screen.
            contentContainerStyle={{ padding: 16, paddingBottom: 16 }}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Text style={{ fontSize: 40, marginBottom: 12 }}>💬</Text>
                <Text style={styles.emptyText}>No messages yet.{'\n'}Start the conversation below.</Text>
              </View>
            }
          />
        )}

        {/* ── Input bar ── */}
        {/* paddingBottom pushes the input content above the FloatingTabBar
            which is absolutely positioned at the very bottom of the screen. */}
        <View style={[styles.inputBar, { paddingBottom: tabBarClearance }]}>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.textInput}
              placeholder="Type a message..."
              placeholderTextColor="#94a3b8"
              value={body}
              onChangeText={setBody}
              multiline
              maxLength={500}
              editable={!conv?.resolved}
            />
          </View>
          <TouchableOpacity
            style={[styles.sendBtn, (!body.trim() || sending || conv?.resolved) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!body.trim() || sending || !!conv?.resolved}
            activeOpacity={0.85}
          >
            {sending
              ? <ActivityIndicator color="#ffffff" size="small" />
              : <Text style={styles.sendIcon}>↑</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 52, paddingBottom: 12, paddingHorizontal: 16,
    backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  backBtn:    { flexDirection: 'row', alignItems: 'center' },
  backArrow:  { color: '#6366f1', fontSize: 20, marginRight: 4 },
  backLabel:  { color: '#6366f1', fontWeight: '700', fontSize: 15 },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 12 },
  headerTitle:  { color: '#0f172a', fontWeight: '800', fontSize: 15 },
  headerSub:    { color: '#64748b', fontSize: 11, fontWeight: '500', marginTop: 1 },
  headerActions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0',
    alignItems: 'center', justifyContent: 'center',
  },
  resolveBtn: { backgroundColor: '#eef2ff', borderColor: '#c7d2fe' },

  resolvedBanner: {
    backgroundColor: '#f0fdf4', borderBottomWidth: 1, borderBottomColor: '#bbf7d0',
    paddingVertical: 8, alignItems: 'center',
  },
  resolvedText: { color: '#15803d', fontSize: 13, fontWeight: '800' },

  finderBanner: {
    flexDirection: 'row', alignItems: 'center',
    margin: 12, padding: 14,
    backgroundColor: '#ffffff', borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0',
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, elevation: 1,
  },
  finderAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#eef2ff', borderWidth: 1, borderColor: '#c7d2fe',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  finderName:  { color: '#0f172a', fontWeight: '800', fontSize: 15 },
  finderPhone: { color: '#64748b', fontSize: 13, fontWeight: '500', marginTop: 2 },
  callBtn:     { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  callBtnText: { color: '#15803d', fontWeight: '800', fontSize: 13 },

  // Messages
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyBox:   { flex: 1, alignItems: 'center', paddingTop: 80 },
  emptyText:  { color: '#94a3b8', fontSize: 15, fontWeight: '600', textAlign: 'center', lineHeight: 22 },

  msgWrapper:      { marginBottom: 14 },
  msgWrapperMe:    { alignItems: 'flex-end' },
  msgWrapperOther: { alignItems: 'flex-start' },
  msgSender: { color: '#94a3b8', fontSize: 11, fontWeight: '600', marginBottom: 3, marginHorizontal: 4 },
  msgBubble: { maxWidth: '78%', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  bubbleMe:    { backgroundColor: '#6366f1', borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderBottomLeftRadius: 4 },
  msgTextMe:    { color: '#ffffff', fontSize: 15, fontWeight: '500' },
  msgTextOther: { color: '#0f172a', fontSize: 15, fontWeight: '500' },
  msgTime: { color: '#94a3b8', fontSize: 10, fontWeight: '500', marginTop: 3, marginHorizontal: 4 },

  // Input
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 14, paddingTop: 12,
    backgroundColor: '#ffffff',
    borderTopWidth: 1, borderTopColor: '#e2e8f0',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: -4 }, elevation: 8,
  },
  inputWrap: {
    flex: 1, backgroundColor: '#f8fafc',
    borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10, minHeight: 44,
  },
  textInput: {
    color: '#0f172a', fontSize: 15, fontWeight: '500',
    maxHeight: 120, lineHeight: 22,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: '#6366f1',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#6366f1', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 5,
    marginBottom: 2,
  },
  sendBtnDisabled: { opacity: 0.45 },
  sendIcon: { color: '#ffffff', fontSize: 20, fontWeight: '900' },
});

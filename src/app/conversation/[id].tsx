import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, FlatList,
  StatusBar, ActivityIndicator, Alert, Linking, StyleSheet, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
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
  const insets = useSafeAreaInsets();

  const [conv, setConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  // The FloatingTabBar sits at the bottom with position:absolute + zIndex:999.
  // paddingBottom on the input bar must clear exactly that tab bar height so
  // the input is never hidden under it.
  // Formula mirrors FloatingTabBar internals:
  //   paddingTop(8) + icon+label(~46) + bottomPad(max(insets.bottom+12, 24))
  const tabBarPad = Math.max(insets.bottom + 12, 24) + 54;

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
    // community_items join removed — PGRST200 schema cache issue.
    // Community item title is fetched separately below.
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
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 150);
  };

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
          text: 'Resolve',
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

  const formatTime = (ts: string) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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

  // ── Render ──────────────────────────────────────────────────────────────
  // No KeyboardAvoidingView — softwareKeyboardLayoutMode:'pan' in app.json
  // handles panning the entire screen above the keyboard on Android.
  // KAV + pan would double-adjust and break the layout.
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
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
                <Text>📞</Text>
              </TouchableOpacity>
            )}
            {!conv?.resolved && (
              <TouchableOpacity style={[styles.actionBtn, styles.resolveBtn]} onPress={handleResolve} activeOpacity={0.7}>
                <Text style={styles.resolveBtnText}>✓</Text>
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

      {/* Finder info banner — owner only */}
      {isOwner && conv?.finder_name && (
        <View style={styles.finderBanner}>
          <View style={styles.finderAvatar}>
            <Text style={{ fontSize: 18 }}>👤</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.finderName}>{conv.finder_name}</Text>
            {conv.finder_phone && <Text style={styles.finderPhone}>{conv.finder_phone}</Text>}
          </View>
          {conv.finder_phone && (
            <TouchableOpacity onPress={handleCallFinder} activeOpacity={0.7} style={styles.callBtn}>
              <Text style={styles.callBtnText}>Call</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Messages ── */}
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
          // Extra bottom padding so the last message clears the input bar
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>💬</Text>
              <Text style={styles.emptyText}>No messages yet.{'\n'}Start the conversation below.</Text>
            </View>
          }
        />
      )}

      {/* ── Input bar ──
          paddingBottom = exact height of the FloatingTabBar so the typed text
          area sits just above the tab bar icons. No extra dead space. */}
      {!conv?.resolved && (
        <View style={[styles.inputBar, { paddingBottom: tabBarPad }]}>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.textInput}
              placeholder="Type a message..."
              placeholderTextColor="#94a3b8"
              value={body}
              onChangeText={setBody}
              multiline
              maxLength={500}
            />
          </View>
          <TouchableOpacity
            style={[styles.sendBtn, (!body.trim() || sending) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!body.trim() || sending}
            activeOpacity={0.85}
          >
            {sending
              ? <ActivityIndicator color="#ffffff" size="small" />
              : <Text style={styles.sendIcon}>↑</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {conv?.resolved && (
        <View style={[styles.resolvedInputPlaceholder, { paddingBottom: tabBarPad }]}>
          <Text style={styles.resolvedInputText}>This conversation is resolved ✓</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  backBtn:    { flexDirection: 'row', alignItems: 'center', minWidth: 60 },
  backArrow:  { color: '#6366f1', fontSize: 20, marginRight: 4 },
  backLabel:  { color: '#6366f1', fontWeight: '700', fontSize: 15 },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  headerTitle:  { color: '#0f172a', fontWeight: '800', fontSize: 15 },
  headerSub:    { color: '#64748b', fontSize: 11, fontWeight: '500', marginTop: 1 },
  headerActions:  { flexDirection: 'row', gap: 8, minWidth: 60, justifyContent: 'flex-end' },
  actionBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0',
    alignItems: 'center', justifyContent: 'center',
  },
  resolveBtn: { backgroundColor: '#eef2ff', borderColor: '#c7d2fe' },
  resolveBtnText: { color: '#6366f1', fontWeight: '800', fontSize: 14 },

  resolvedBanner: {
    backgroundColor: '#f0fdf4', borderBottomWidth: 1, borderBottomColor: '#bbf7d0',
    paddingVertical: 8, alignItems: 'center',
  },
  resolvedText: { color: '#15803d', fontSize: 13, fontWeight: '800' },

  finderBanner: {
    flexDirection: 'row', alignItems: 'center',
    margin: 12, padding: 12,
    backgroundColor: '#ffffff', borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0',
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, elevation: 1,
  },
  finderAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#eef2ff', borderWidth: 1, borderColor: '#c7d2fe',
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  finderName:  { color: '#0f172a', fontWeight: '800', fontSize: 14 },
  finderPhone: { color: '#64748b', fontSize: 12, fontWeight: '500', marginTop: 2 },
  callBtn:     { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  callBtnText: { color: '#15803d', fontWeight: '800', fontSize: 12 },

  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyBox:   { paddingTop: 60, alignItems: 'center' },
  emptyText:  { color: '#94a3b8', fontSize: 15, fontWeight: '600', textAlign: 'center', lineHeight: 22 },

  msgWrapper:      { marginBottom: 12 },
  msgWrapperMe:    { alignItems: 'flex-end' },
  msgWrapperOther: { alignItems: 'flex-start' },
  msgSender:    { color: '#94a3b8', fontSize: 11, fontWeight: '600', marginBottom: 3, marginHorizontal: 4 },
  msgBubble:    { maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleMe:     { backgroundColor: '#6366f1', borderBottomRightRadius: 4 },
  bubbleOther:  { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderBottomLeftRadius: 4 },
  msgTextMe:    { color: '#ffffff', fontSize: 15, fontWeight: '500', lineHeight: 21 },
  msgTextOther: { color: '#0f172a', fontSize: 15, fontWeight: '500', lineHeight: 21 },
  msgTime:      { color: '#94a3b8', fontSize: 10, fontWeight: '500', marginTop: 3, marginHorizontal: 4 },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 14, paddingTop: 10,
    backgroundColor: '#ffffff',
    borderTopWidth: 1, borderTopColor: '#e2e8f0',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: -4 }, elevation: 8,
  },
  inputWrap: {
    flex: 1, backgroundColor: '#f8fafc',
    borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  textInput: {
    color: '#0f172a', fontSize: 15, fontWeight: '500',
    maxHeight: 100, lineHeight: 21,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 13,
    backgroundColor: '#6366f1',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#6366f1', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
    marginBottom: 2,
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendIcon: { color: '#ffffff', fontSize: 20, fontWeight: '900' },

  resolvedInputPlaceholder: {
    alignItems: 'center', paddingTop: 12,
    backgroundColor: '#f8fafc', borderTopWidth: 1, borderTopColor: '#e2e8f0',
  },
  resolvedInputText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
});

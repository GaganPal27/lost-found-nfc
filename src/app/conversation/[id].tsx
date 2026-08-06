import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, FlatList,
  StatusBar, ActivityIndicator, Alert, Linking, StyleSheet, Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import * as Haptics from 'expo-haptics';

type Message = { id: string; sender_name: string; sender_id: string | null; body: string; created_at: string; image_url?: string | null; };

type Conversation = {
  id: string; item_id: string | null; owner_id: string; finder_name: string | null; finder_phone: string | null;
  scan_location: string | null; scan_lat: number | null; scan_lng: number | null; resolved: boolean;
  community_item_id?: string | null; items?: { item_name: string } | null; communityItemTitle?: string | null;
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
  const tabBarPad = Math.max(insets.bottom + 12, 24) + 54;

  useEffect(() => {
    if (!id) return;
    loadConversation();
    loadMessages();

    const channel = supabase
      .channel(`conv_${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message]);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const loadConversation = async () => {
    const { data, error } = await supabase.from('conversations').select('*, items(item_name)').eq('id', id).single();
    if (error) return;
    if (data) {
      let communityItemTitle: string | null = null;
      if (data.community_item_id) {
        const { data: ci } = await supabase.from('community_items').select('title').eq('id', data.community_item_id).single();
        communityItemTitle = ci?.title ?? null;
      }
      setConv({ ...data, communityItemTitle } as Conversation);
    }
  };

  const loadMessages = async () => {
    setLoading(true);
    const { data } = await supabase.from('messages').select('*').eq('conversation_id', id).order('created_at', { ascending: true });
    if (data) setMessages(data as Message[]);
    setLoading(false);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 150);
  };

  const sendMessage = async () => {
    if (!body.trim()) return;
    setSending(true);
    const senderName = dbUser?.full_name ?? (user?.email?.split('@')[0] ?? 'User');
    const { error } = await supabase.from('messages').insert({ conversation_id: id, sender_id: user?.id ?? null, sender_name: senderName, body: body.trim() });
    if (error) Alert.alert('Error', 'Could not send message. Please try again.');
    else { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setBody(''); }
    setSending(false);
  };

  const handleCallFinder = () => {
    if (!conv?.finder_phone) return Alert.alert('No Phone', 'The finder did not provide a phone number.');
    Linking.openURL(`tel:${conv.finder_phone}`);
  };

  const handleResolve = async () => {
    Alert.alert('Mark as Resolved?', 'This will close the conversation and mark the item as found.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Resolve', onPress: async () => {
          await supabase.from('conversations').update({ resolved: true }).eq('id', id);
          if (conv?.item_id) await supabase.from('items').update({ status: 'found' }).eq('id', conv.item_id);
          else if (conv?.community_item_id) await supabase.from('community_items').update({ status: 'closed' }).eq('id', conv.community_item_id);
          setConv((prev) => prev ? { ...prev, resolved: true } : prev);
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    ]);
  };

  const isOwner = user?.id === conv?.owner_id;
  const itemName = conv?.communityItemTitle ?? conv?.items?.item_name ?? 'Chat';
  const formatTime = (ts: string) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender_id === user?.id;
    return (
      <View style={[styles.msgWrapper, isMe ? styles.msgWrapperMe : styles.msgWrapperOther]}>
        {!isMe && <Text style={styles.msgSender}>{item.sender_name}</Text>}
        {isMe ? (
          <LinearGradient colors={['#6366f1', '#7c3aed']} start={{x:0,y:0}} end={{x:1,y:1}} style={[styles.msgBubble, styles.bubbleMe]}>
            {item.image_url ? <Image source={{ uri: item.image_url }} style={{ width: 200, height: 200, borderRadius: 12, marginBottom: item.body ? 8 : 0 }} resizeMode="cover" /> : null}
            {item.body ? <Text style={styles.msgTextMe} selectable={true}>{item.body}</Text> : null}
          </LinearGradient>
        ) : (
          <View style={[styles.msgBubble, styles.bubbleOther]}>
            {item.image_url ? <Image source={{ uri: item.image_url }} style={{ width: 200, height: 200, borderRadius: 12, marginBottom: item.body && item.body !== 'Sent a photo' ? 8 : 0 }} resizeMode="cover" /> : null}
            {(!item.image_url || (item.body && item.body !== 'Sent a photo')) && <Text style={styles.msgTextOther} selectable={true}>{item.body}</Text>}
            {item.body.includes('https://www.google.com/maps') && (
              <TouchableOpacity onPress={() => {
                const url = item.body.match(/https:\/\/www\.google\.com\/maps\?q=[-0-9.]+,[-0-9.]+/)?.[0];
                if (url) Linking.openURL(url);
              }} style={{ marginTop: 8, backgroundColor: '#eff6ff', padding: 8, borderRadius: 8 }}>
                <Text style={{ color: '#2563eb', fontWeight: '700', fontSize: 13, textAlign: 'center' }}>🗺️ Open in Google Maps</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        <Text style={styles.msgTime}>{formatTime(item.created_at)}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#6366f1" />

      {/* ── Header ── */}
      <LinearGradient colors={['#6366f1', '#7c3aed']} start={{x:0,y:0}} end={{x:1,y:1}} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.hCircle1} />
        <View style={styles.hCircle2} />

        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backArrow}>←</Text>
          <Text style={styles.backLabel}>Back</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{itemName}</Text>
          {conv?.scan_location && <Text style={styles.headerSub} numberOfLines={1}>📍 {conv.scan_location}</Text>}
        </View>

        <View style={styles.headerActions}>
          {isOwner && conv?.finder_phone && (
            <TouchableOpacity style={styles.actionBtn} onPress={handleCallFinder} activeOpacity={0.8}>
              <Text>📞</Text>
            </TouchableOpacity>
          )}
          {isOwner && !conv?.resolved && (
            <TouchableOpacity style={[styles.actionBtn, styles.resolveBtn]} onPress={handleResolve} activeOpacity={0.8}>
              <Text style={styles.resolveBtnText}>✓</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {conv?.resolved && (
        <View style={styles.resolvedBanner}>
          <Text style={styles.resolvedText}>✓ Resolved — Item Returned</Text>
        </View>
      )}

      {/* ── Messages ── */}
      <View style={styles.body}>
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
            contentContainerStyle={styles.listContent}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Text style={{ fontSize: 48, marginBottom: 16 }}>💬</Text>
                <Text style={styles.emptyText}>No messages yet.{'\n'}Start the conversation below.</Text>
              </View>
            }
          />
        )}
      </View>

      {/* ── Input bar ── */}
      {!conv?.resolved ? (
        <View style={[styles.inputContainer, { paddingBottom: tabBarPad }]}>
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
          <TouchableOpacity style={[styles.sendBtnWrap, (!body.trim() || sending) && {opacity: 0.4}]} onPress={sendMessage} disabled={!body.trim() || sending} activeOpacity={0.88}>
            <LinearGradient colors={['#6366f1', '#7c3aed']} style={styles.sendBtn} start={{x:0,y:0}} end={{x:1,y:1}}>
              {sending ? <ActivityIndicator color="#ffffff" size="small" /> : <Text style={styles.sendIcon}>↑</Text>}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.resolvedInputPlaceholder, { paddingBottom: tabBarPad }]}>
          <Text style={styles.resolvedInputText}>This conversation is resolved ✓</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8faff' },

  /* Header */
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16, overflow: 'hidden', position: 'relative' },
  hCircle1: { position: 'absolute', top: -40, right: -20, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.08)' },
  hCircle2: { position: 'absolute', bottom: -30, left: -40, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.06)' },
  
  backBtn: { flexDirection: 'row', alignItems: 'center', minWidth: 60 },
  backArrow: { color: 'rgba(255,255,255,0.9)', fontSize: 20, marginRight: 4 },
  backLabel: { color: 'rgba(255,255,255,0.9)', fontWeight: '700', fontSize: 15 },
  
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  headerTitle: { color: '#ffffff', fontWeight: '900', fontSize: 16 },
  headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '600', marginTop: 2 },
  
  headerActions: { flexDirection: 'row', gap: 8, minWidth: 60, justifyContent: 'flex-end' },
  actionBtn: { width: 34, height: 34, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center' },
  resolveBtn: { backgroundColor: '#dcfce7' },
  resolveBtnText: { color: '#16a34a', fontWeight: '900', fontSize: 15 },

  resolvedBanner: { backgroundColor: '#dcfce7', paddingVertical: 8, alignItems: 'center' },
  resolvedText: { color: '#16a34a', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },

  /* Body */
  body: { flex: 1 },
  listContent: { padding: 20, paddingBottom: 24 },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyBox: { paddingTop: 80, alignItems: 'center' },
  emptyText: { color: '#64748b', fontSize: 15, fontWeight: '600', textAlign: 'center', lineHeight: 22 },

  /* Messages */
  msgWrapper: { marginBottom: 16 },
  msgWrapperMe: { alignItems: 'flex-end' },
  msgWrapperOther: { alignItems: 'flex-start' },
  msgSender: { color: '#64748b', fontSize: 11, fontWeight: '700', marginBottom: 4, marginHorizontal: 4 },
  msgBubble: { maxWidth: '82%', paddingHorizontal: 16, paddingVertical: 12, shadowColor: '#6366f1', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  bubbleMe: { borderRadius: 22, borderBottomRightRadius: 6 },
  bubbleOther: { backgroundColor: '#ffffff', borderRadius: 22, borderBottomLeftRadius: 6, borderWidth: 1, borderColor: '#f1f5f9' },
  msgTextMe: { color: '#ffffff', fontSize: 15, fontWeight: '500', lineHeight: 22 },
  msgTextOther: { color: '#0f172a', fontSize: 15, fontWeight: '500', lineHeight: 22 },
  msgTime: { color: '#94a3b8', fontSize: 10, fontWeight: '600', marginTop: 4, marginHorizontal: 4 },

  /* Input Bar */
  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#f1f5f9', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 8 },
  inputWrap: { flex: 1, backgroundColor: '#f8faff', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10 },
  textInput: { color: '#0f172a', fontSize: 15, fontWeight: '500', maxHeight: 100, lineHeight: 21 },
  sendBtnWrap: { borderRadius: 20, overflow: 'hidden', shadowColor: '#6366f1', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4, marginBottom: 2 },
  sendBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sendIcon: { color: '#ffffff', fontSize: 22, fontWeight: '900' },

  resolvedInputPlaceholder: { alignItems: 'center', paddingTop: 16, backgroundColor: '#f8faff', borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  resolvedInputText: { color: '#94a3b8', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
});

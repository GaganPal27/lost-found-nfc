import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, FlatList,
  KeyboardAvoidingView, Platform, StatusBar, ActivityIndicator,
  Alert, Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
  item_id: string;
  owner_id: string;
  finder_name: string | null;
  finder_phone: string | null;
  scan_location: string | null;
  scan_lat: number | null;
  scan_lng: number | null;
  resolved: boolean;
  items?: { item_name: string };
};

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const router = useRouter();

  const [conv, setConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  // ── Load conversation + initial messages ─────────────────────────────────
  useEffect(() => {
    if (!id) return;
    loadConversation();
    loadMessages();

    // Real-time subscription for new messages
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
    const { data } = await supabase
      .from('conversations')
      .select('*, items(item_name)')
      .eq('id', id)
      .single();
    if (data) setConv(data as Conversation);
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
    const senderName = user?.email?.split('@')[0] ?? 'Owner';
    await supabase.from('messages').insert({
      conversation_id: id,
      sender_id: user?.id ?? null,
      sender_name: senderName,
      body: body.trim(),
    });
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBody('');
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
            await supabase.from('items').update({ status: 'found' }).eq('id', conv?.item_id);
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.replace('/(tabs)/connect');
          },
        },
      ]
    );
  };

  const isOwner = user?.id === conv?.owner_id;
  const itemName = (conv as any)?.items?.item_name ?? 'Item';

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender_id === user?.id || (!item.sender_id && !isOwner);
    return (
      <View className={`mb-3 ${isMe ? 'items-end' : 'items-start'}`}>
        <Text className="text-slate-500 text-xs mb-1 mx-1">{item.sender_name}</Text>
        <View
          className={`max-w-xs px-4 py-3 rounded-2xl shadow-sm ${isMe
            ? 'bg-primary rounded-br-sm'
            : 'bg-white border border-slate-200 rounded-bl-sm'
          }`}
        >
          <Text className={isMe ? 'text-white font-medium' : 'text-slate-900 font-medium'}>{item.body}</Text>
        </View>
        <Text className="text-slate-600 text-xs mt-1 mx-1">{formatTime(item.created_at)}</Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <View className="flex-1 bg-slate-50">
        <StatusBar barStyle="dark-content" />

        {/* Header */}
        <View className="px-4 pt-14 pb-3 border-b border-slate-200 bg-white shadow-sm z-10">
          <View className="flex-row items-center justify-between">
            <TouchableOpacity onPress={() => router.back()} className="flex-row items-center" activeOpacity={0.7}>
              <Text className="text-primary text-lg mr-1">←</Text>
              <Text className="text-primary font-semibold">Back</Text>
            </TouchableOpacity>

            <View className="items-center flex-1 px-4">
              <Text className="text-slate-900 font-bold text-base" numberOfLines={1}>{itemName}</Text>
              {conv?.scan_location && (
                <Text className="text-slate-500 text-xs font-medium" numberOfLines={1}>📍 {conv.scan_location}</Text>
              )}
            </View>

            {/* Action buttons */}
            {isOwner && (
              <View className="flex-row gap-2">
                {conv?.finder_phone && (
                  <TouchableOpacity
                    className="w-9 h-9 bg-green-100 border border-green-200 rounded-xl items-center justify-center"
                    onPress={handleCallFinder}
                    activeOpacity={0.7}
                  >
                    <Text className="text-lg">📞</Text>
                  </TouchableOpacity>
                )}
                {!conv?.resolved && (
                  <TouchableOpacity
                    className="w-9 h-9 bg-primary/10 border border-primary/20 rounded-xl items-center justify-center"
                    onPress={handleResolve}
                    activeOpacity={0.7}
                  >
                    <Text className="text-lg">✓</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {conv?.resolved && (
            <View className="mt-2 bg-green-50 border border-green-200 rounded-xl px-3 py-1.5 items-center">
              <Text className="text-green-700 text-xs font-bold">✓ Resolved — Item Returned</Text>
            </View>
          )}
        </View>

        {/* Finder info banner (owner only) */}
        {isOwner && conv?.finder_name && (
          <View className="mx-4 mt-3 bg-white border border-slate-200 rounded-2xl px-4 py-3 flex-row items-center shadow-sm">
            <View className="w-10 h-10 bg-primary/10 border border-primary/20 rounded-full items-center justify-center mr-3">
              <Text className="text-lg">👤</Text>
            </View>
            <View className="flex-1">
              <Text className="text-slate-900 font-bold">{conv.finder_name}</Text>
              {conv.finder_phone && (
                <Text className="text-slate-500 text-sm font-medium">{conv.finder_phone}</Text>
              )}
            </View>
            {conv.finder_phone && (
              <TouchableOpacity onPress={handleCallFinder} activeOpacity={0.7}>
                <View className="bg-green-100 border border-green-200 px-3 py-1.5 rounded-xl shadow-sm">
                  <Text className="text-green-700 text-xs font-bold">Call</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Messages */}
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#06b6d4" size="large" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={renderMessage}
            contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={
              <View className="items-center py-16">
                <Text className="text-4xl mb-3">💬</Text>
                <Text className="text-slate-500 text-center font-medium">No messages yet.\nStart the conversation below.</Text>
              </View>
            }
          />
        )}

        {/* Input bar */}
        {!conv?.resolved && (
          <View className="px-4 py-3 border-t border-slate-200 bg-white flex-row items-end gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <View className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">
              <TextInput
                className="text-slate-900 text-base font-medium"
                placeholder="Type a message..."
                placeholderTextColor="#94a3b8"
                value={body}
                onChangeText={setBody}
                multiline
                maxLength={500}
                style={{ maxHeight: 100 }}
              />
            </View>
            <TouchableOpacity
              className={`w-12 h-12 bg-primary rounded-2xl items-center justify-center shadow-md shadow-primary/30 ${(!body.trim() || sending) ? 'opacity-50' : ''}`}
              onPress={sendMessage}
              disabled={!body.trim() || sending}
              activeOpacity={0.85}
            >
              {sending
                ? <ActivityIndicator color="#ffffff" size="small" />
                : <Text className="text-xl text-white">↑</Text>
              }
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

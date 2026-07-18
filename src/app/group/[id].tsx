import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, ScrollView,
  KeyboardAvoidingView, Platform, StyleSheet, ActivityIndicator, Alert, Image, Share
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Modal } from 'react-native';

type Message = {
  id: string; group_id: string; sender_id: string;
  body: string | null; image_url: string | null; created_at: string;
  sender_name?: string; sender_email?: string; // We'll map these
};

export default function GroupChatScreen() {
  const { id: rawId } = useLocalSearchParams();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();
  const { user, dbUser } = useAuthStore();
  
  const [group, setGroup] = useState<any>(null);
  const [myRole, setMyRole] = useState<'admin' | 'member' | null>(null);
  const [status, setStatus] = useState<'pending' | 'active' | 'banned' | 'none'>('none');
  const insets = useSafeAreaInsets();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    fetchGroupAndMembership();
  }, [id, user]);

  const fetchGroupAndMembership = async () => {
    if (!id || !user) return;
    
    // 1. Get group details
    const { data: grp } = await supabase.from('community_groups').select('*').eq('id', id).single();
    if (grp) setGroup(grp);

    // 2. Get my membership — use dbUser.id (users table PK), not user.id (auth UUID)
    const myDbId = dbUser?.id;
    if (!myDbId) {
      setLoading(false);
      setStatus('none');
      return;
    }

    const { data: mem } = await supabase.from('group_members')
      .select('*').eq('group_id', id).eq('user_id', myDbId).single();
      
    if (mem) {
      setMyRole(mem.role);
      setStatus(mem.status);
      if (mem.status === 'active') {
        fetchMessages();
        subscribeToMessages();
      }
    } else {
      setStatus('none');
    }
    setLoading(false);
  };

  const fetchMessages = async () => {
    const { data } = await supabase.from('group_messages')
      .select('*, sender:sender_id(full_name, email)') // full_name not name
      .eq('group_id', id)
      .order('created_at', { ascending: false })
      .limit(100);
      
    if (data) {
      const formatted = data.map((m: any) => ({
        ...m,
        sender_name: m.sender?.full_name || m.sender?.email?.split('@')[0] || 'User'
      }));
      setMessages(formatted);
    }
  };

  const subscribeToMessages = () => {
    const channel = supabase.channel(`group_${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${id}` }, 
      (payload) => {
        // Optimistic update might already show it, but for incoming msgs:
        // Re-fetch to get joined user data, or just fetch the single new message.
        fetchMessages(); // keep it simple
      }).subscribe();
      
    return () => { supabase.removeChannel(channel); };
  };

  const handleJoin = async () => {
    if (!user || !group) return;
    const myDbId = dbUser?.id;
    if (!myDbId) return;
    setLoading(true);
    try {
      const joinStatus = group.type === 'public' ? 'active' : 'pending';
      await supabase.from('group_members').insert({
        group_id: group.id,
        user_id: myDbId, // use the users table PK
        role: 'member',
        status: joinStatus
      });
      
      if (joinStatus === 'active') {
        await supabase.rpc('increment_group_members', { g_id: group.id });
        setStatus('active');
        fetchMessages();
        subscribeToMessages();
      } else {
        setStatus('pending');
        Alert.alert('Requested', 'Your request to join this private group has been sent to the admins.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setLoading(false);
  };

  const handleShare = async () => {
    try {
      // https:// URL so WhatsApp renders it as a clickable hyperlink
      const link = `https://pzhuszyyykususkmzpud.supabase.co/functions/v1/deep-link?type=group&id=${group.id}`;
      const msg = `👥 Join my community group *"${group.name}"* on the Poki Lost & Found Network!\n\nTap the link to join:\n${link}`;
      await Share.share({ message: msg, title: `Join "${group.name}" on Poki` });
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !group) return;
    setInviting(true);
    try {
      // Find user by email
      const { data: foundUser, error: findErr } = await supabase
        .from('users')
        .select('id')
        .eq('email', inviteEmail.trim().toLowerCase())
        .single();

      if (findErr || !foundUser) {
        Alert.alert('Not Found', 'No user found with that email address.');
        return;
      }

      // Check if already member
      const { data: existing } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', group.id)
        .eq('user_id', foundUser.id)
        .single();

      if (existing) {
        Alert.alert('Already a Member', 'This user is already in the group.');
        return;
      }

      // Add member (active for public, pending for private)
      const memberStatus = group.type === 'public' ? 'active' : 'pending';
      await supabase.from('group_members').insert({
        group_id: group.id,
        user_id: foundUser.id,
        role: 'member',
        status: memberStatus
      });

      setInviteEmail('');
      setShowInvite(false);
      Alert.alert('Invited!', group.type === 'public'
        ? 'User has been added to the group.'
        : 'Invite sent. Awaiting user\'s acceptance.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setInviting(false);
    }
  };

  const handleSend = async () => {
    if ((!inputText.trim() && !attachment) || !user) return;
    const myDbId = dbUser?.id;
    if (!myDbId) { Alert.alert('Error', 'User profile not loaded. Please restart the app.'); return; }
    
    const body = inputText.trim() || null;
    const image_url = attachment || null;

    // 1. Optimistic Update: Add to UI immediately
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      group_id: id as string,
      sender_id: myDbId,
      body,
      image_url,
      created_at: new Date().toISOString(),
      sender_name: dbUser?.full_name || 'You',
    };
    
    setMessages(prev => [optimisticMsg, ...prev]);
    
    // Clear input immediately so it feels fast
    setInputText('');
    setAttachment(null);
    setSending(true);

    try {
      const { error } = await supabase.from('group_messages').insert({
        group_id: id,
        sender_id: myDbId, // ✅ users table PK
        body,
        image_url
      });

      if (error) throw error;
      // Realtime subscription will fetch the real message and overwrite the optimistic one
    } catch (e: any) {
      // Revert optimistic update on failure
      setMessages(prev => prev.filter(m => m.id !== tempId));
      Alert.alert('Message Failed', `Could not send message: ${e.message}`);
    }
    setSending(false);
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5,
    });
    if (!result.canceled) {
      setAttachment(result.assets[0].uri);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#6366f1" /></View>;
  if (!group) return <View style={styles.center}><Text>Group not found</Text></View>;

  const canChat = status === 'active';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Text style={styles.backTxt}>←</Text></TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.groupName} numberOfLines={1}>{group.name}</Text>
          <Text style={styles.groupMembers}>{group.member_count ?? 0} member{(group.member_count ?? 0) !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity onPress={() => setShowInvite(true)} style={styles.settingsBtn}>
          <Text style={styles.settingsTxt}>👤+</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleShare} style={styles.settingsBtn}>
          <Text style={styles.settingsTxt}>🔗</Text>
        </TouchableOpacity>
        {myRole === 'admin' && (
          <TouchableOpacity onPress={() => router.push(`/group-settings/${id}`)} style={styles.settingsBtn}>
            <Text style={styles.settingsTxt}>⚙️</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Invite Modal */}
      <Modal visible={showInvite} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add People</Text>
            <Text style={styles.modalSubtitle}>Enter their email address to add them to this group</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Email address"
              placeholderTextColor="#94a3b8"
              value={inviteEmail}
              onChangeText={setInviteEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoFocus
            />
            <TouchableOpacity
              style={[styles.modalBtn, (!inviteEmail.trim() || inviting) && { opacity: 0.5 }]}
              onPress={handleInvite}
              disabled={!inviteEmail.trim() || inviting}
            >
              {inviting ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnText}>Add to Group</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setShowInvite(false); setInviteEmail(''); }} style={styles.modalCancel}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Chat Area */}
      {canChat ? (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={i => i.id}
          inverted // starts at bottom
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isMe = item.sender_id === dbUser?.id;
            return (
              <View style={[styles.msgWrapper, isMe ? styles.msgRight : styles.msgLeft]}>
                {!isMe && <Text style={styles.msgSender}>{item.sender_name}</Text>}
                <View style={[styles.msgBubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                  {item.image_url && (
                    <Image source={{ uri: item.image_url }} style={styles.msgImage} />
                  )}
                  {item.body && (
                    <Text style={[styles.msgText, isMe ? styles.textMe : styles.textThem]}>{item.body}</Text>
                  )}
                </View>
              </View>
            );
          }}
        />
      ) : (
        <View style={styles.center}>
          <View style={styles.lockIcon}><Text style={{fontSize:40}}>🔒</Text></View>
          <Text style={styles.lockTitle}>{status === 'pending' ? 'Request Pending' : 'Join Group'}</Text>
          <Text style={styles.lockSubtitle}>
            {status === 'pending' 
              ? 'Waiting for an admin to approve your request.'
              : group.type === 'private' ? 'This is a private group. Admins must approve requests.' : 'Join this public group to start chatting!'}
          </Text>
          {status === 'none' && (
            <TouchableOpacity style={styles.joinBtn} onPress={handleJoin}>
              <Text style={styles.joinBtnText}>Join Group</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Input Area */}
      {canChat && (
        <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          {attachment && (
            <View style={styles.attachmentPreview}>
              <Image source={{ uri: attachment }} style={styles.previewImg} />
              <TouchableOpacity style={styles.clearBtn} onPress={() => setAttachment(null)}>
                <Text style={styles.clearTxt}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.inputRow}>
            <TouchableOpacity style={styles.attachBtn} onPress={pickImage}>
              <Text style={styles.attachTxt}>+</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder="Type a message..."
              value={inputText}
              onChangeText={setInputText}
              multiline
            />
            <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={sending || (!inputText.trim() && !attachment)}>
              {sending ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.sendTxt}>↑</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  header: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    paddingBottom: 16, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  backBtn: { padding: 10, marginRight: 8 },
  backTxt: { fontSize: 24, color: '#0f172a' },
  headerInfo: { flex: 1 },
  groupName: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  groupMembers: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  settingsBtn: { padding: 10 },
  settingsTxt: { fontSize: 18 },
  
  listContent: { padding: 16 },
  msgWrapper: { marginBottom: 12, maxWidth: '80%' },
  msgLeft: { alignSelf: 'flex-start' },
  msgRight: { alignSelf: 'flex-end' },
  msgSender: { fontSize: 11, color: '#64748b', marginBottom: 4, marginLeft: 4, fontWeight: '600' },
  msgBubble: { padding: 12, borderRadius: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  bubbleThem: { backgroundColor: '#fff', borderBottomLeftRadius: 4 },
  bubbleMe: { backgroundColor: '#6366f1', borderBottomRightRadius: 4 },
  msgText: { fontSize: 15, lineHeight: 20 },
  textThem: { color: '#0f172a' },
  textMe: { color: '#fff' },
  msgImage: { width: 200, height: 200, borderRadius: 12, marginBottom: 8 },

  inputContainer: { backgroundColor: '#fff', padding: 12, paddingBottom: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end' },
  attachBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9', borderRadius: 22, marginRight: 8 },
  attachTxt: { fontSize: 24, color: '#64748b' },
  input: { flex: 1, backgroundColor: '#f1f5f9', borderRadius: 20, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, fontSize: 15, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#6366f1', borderRadius: 22, marginLeft: 8 },
  sendTxt: { fontSize: 20, color: '#fff', fontWeight: 'bold' },
  
  attachmentPreview: { marginBottom: 12, alignSelf: 'flex-start' },
  previewImg: { width: 100, height: 100, borderRadius: 12 },
  clearBtn: { position: 'absolute', top: -8, right: -8, backgroundColor: '#0f172a', width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  clearTxt: { color: '#fff', fontSize: 12, fontWeight: 'bold' },

  lockIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 16, shadowOpacity: 0.1, shadowRadius: 10, elevation: 2 },
  lockTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginBottom: 8 },
  lockSubtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 24 },
  joinBtn: { backgroundColor: '#6366f1', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 20 },
  joinBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { width: '100%', backgroundColor: '#fff', borderRadius: 20, padding: 24, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginBottom: 6 },
  modalSubtitle: { fontSize: 13, color: '#64748b', marginBottom: 20, lineHeight: 19 },
  modalInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#0f172a', marginBottom: 16 },
  modalBtn: { backgroundColor: '#6366f1', paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginBottom: 12 },
  modalBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  modalCancel: { alignItems: 'center', paddingVertical: 8 },
  modalCancelText: { color: '#ef4444', fontWeight: '700', fontSize: 14 }
});

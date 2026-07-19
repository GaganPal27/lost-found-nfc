import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, Animated, StyleSheet, KeyboardAvoidingView, Platform, Switch
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CreateGroupScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();

  const shakeAnim = useState(new Animated.Value(0))[0];

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 100, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 100, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 100, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 100, useNativeDriver: true })
    ]).start();
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      triggerShake();
      return;
    }
    if (!user) return;

    setLoading(true);
    try {
      // ── STEP 1: Get the real users.id (Postgres UUID) via auth_id ──────────
      // users.id is a generated UUID; auth_id holds the Supabase auth UID.
      // community_groups.creator_id references users.id — NOT the auth UID.
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single();

      if (profileError || !profile) {
        Alert.alert('Error', 'Could not find your user profile. Please try logging out and back in.');
        return;
      }

      const dbUserId = profile.id; // This is the real users.id Postgres UUID

      // ── STEP 1.5: Find the creator's own official (college) community ────
      // Every sub-group must belong to exactly one college, so other
      // colleges' students can't see or join it (enforced by RLS too).
      const { data: officialMembership, error: officialError } = await supabase
        .from('group_members')
        .select('group_id, community_groups!inner(is_official)')
        .eq('user_id', dbUserId)
        .eq('status', 'active')
        .eq('community_groups.is_official', true)
        .maybeSingle();

      if (officialError || !officialMembership) {
        Alert.alert(
          'Join your college first',
          'You need to be part of your official college community before creating a sub-group. If you weren\u2019t auto-joined, use "Search communities" on the Groups tab.'
        );
        setLoading(false);
        return;
      }

      const parentGroupId = officialMembership.group_id;

      // ── STEP 2: Create the group using the real users.id ─────────────────
      const { data: group, error: groupError } = await supabase
        .from('community_groups')
        .insert({
          name: name.trim(),
          description: description.trim(),
          type: isPublic ? 'public' : 'private',
          creator_id: dbUserId,   // ✅ real users.id, not auth UID
          parent_group_id: parentGroupId, // scopes this sub-group to the creator's college
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // ── STEP 3: Add creator as admin using the real users.id ─────────────
      const { error: memberError } = await supabase
        .from('group_members')
        .insert({
          group_id: group.id,
          user_id: dbUserId,      // ✅ real users.id
          role: 'admin',
          status: 'active'
        });

      if (memberError) throw memberError;

      Alert.alert('Success', 'Group created successfully!', [
        { text: 'Let\'s Go', onPress: () => router.replace(`/group/${group.id}`) }
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message);
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20 }]}>
        <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
          
          <Text style={styles.headerTitle}>Create Group</Text>
          <Text style={styles.headerSubtitle}>Start a community group in your area</Text>

          <View style={styles.card}>
            <Text style={styles.label}>Group Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Connaught Place Finders"
              value={name}
              onChangeText={setName}
              maxLength={50}
            />

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="What is this group for?"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <View style={styles.divider} />

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchTitle}>Public Group</Text>
                <Text style={styles.switchDesc}>
                  {isPublic 
                    ? "Anyone can find and join this group instantly." 
                    : "People can find this group but you must approve their join request."}
                </Text>
              </View>
              <Switch
                value={isPublic}
                onValueChange={setIsPublic}
                trackColor={{ false: '#cbd5e1', true: '#a5b4fc' }}
                thumbColor={isPublic ? '#6366f1' : '#f8fafc'}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, !name.trim() && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={loading || !name.trim()}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Create Group</Text>}
          </TouchableOpacity>
          
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9ff' },
  scroll: { padding: 20, paddingBottom: 140 },
  headerTitle: { fontSize: 28, fontWeight: '900', color: '#0f172a', marginBottom: 4 },
  headerSubtitle: { fontSize: 14, color: '#64748b', marginBottom: 24 },
  card: {
    backgroundColor: '#fff', borderRadius: 20, padding: 20,
    marginBottom: 24, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)',
  },
  label: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#0f172a', marginBottom: 20,
  },
  textArea: { height: 80 },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 10 },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  switchTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  switchDesc: { fontSize: 13, color: '#64748b', lineHeight: 18, paddingRight: 10 },
  submitBtn: {
    backgroundColor: '#6366f1', paddingVertical: 16, borderRadius: 16,
    alignItems: 'center', shadowColor: '#6366f1', shadowOpacity: 0.3,
    shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' }
});

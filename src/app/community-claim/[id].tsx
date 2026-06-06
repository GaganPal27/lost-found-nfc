import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Alert, StatusBar, StyleSheet, Image, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import * as Haptics from 'expo-haptics';

type CommunityItem = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  location_label: string | null;
  image_url: string | null;
  proof_question: string;
  status: string;
  finder_id: string;
};

export default function CommunityClaimScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const { user } = useAuthStore();

  const [item, setItem]           = useState<CommunityItem | null>(null);
  const [answer, setAnswer]       = useState('');
  const [loading, setLoading]     = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dbUserId, setDbUserId]   = useState<string | null>(null);

  useEffect(() => {
    // Resolve DB user id
    if (user?.id) {
      supabase.from('users').select('id').eq('auth_id', user.id).single()
        .then(({ data }) => { if (data) setDbUserId(data.id); });
    }

    // Load item (NOT exposing proof_question to FlatList — only revealed here)
    supabase
      .from('community_items')
      .select('id, title, description, category, location_label, image_url, proof_question, status, finder_id')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          Alert.alert('Error', 'Could not load this item.', [{ text: 'Back', onPress: () => router.back() }]);
        } else {
          setItem(data as CommunityItem);
        }
        setLoading(false);
      });
  }, [id, user]);

  const handleSubmit = async () => {
    if (item?.proof_question && !answer.trim()) {
      Alert.alert('Required', 'Please answer the proof question to submit your claim.');
      return;
    }
    if (!dbUserId) {
      Alert.alert('Error', 'Could not verify your account.');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('community_claims').insert({
        community_item_id: id,
        claimant_id:       dbUserId,
        proof_answer:      answer.trim() || '[No proof question provided]',
        status:            'pending',
      });

      if (error) {
        // Unique constraint = already claimed
        if (error.code === '23505') {
          Alert.alert('Already Claimed', 'You have already submitted a claim for this item. The finder will review it soon.');
        } else {
          throw error;
        }
        return;
      }

      // Notify finder via notifications table
      if (item) {
        await supabase.from('notifications').insert({
          user_id:  item.finder_id,
          type:     'message',
          message:  `Someone claims to own "${item.title}" — review their proof answer.`,
          metadata: { community_item_id: id, claimant_id: dbUserId },
        }).then(() => {}); // Non-fatal if this fails
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        '✅ Claim Submitted',
        'Your answer has been sent to the finder. They will review it and get back to you if it\'s correct.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not submit claim. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (!item) return null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9ff" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back */}
        <TouchableOpacity onPress={() => router.back()} style={styles.back} activeOpacity={0.7}>
          <Text style={styles.backArrow}>←</Text>
          <Text style={styles.backLabel}>Back to Board</Text>
        </TouchableOpacity>

        <Text style={styles.pageSuper}>Ownership Claim</Text>
        <Text style={styles.pageTitle}>Is this yours?</Text>

        {/* Item summary card */}
        <View style={styles.itemCard}>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={styles.itemImage} />
          ) : (
            <View style={styles.itemImagePlaceholder}>
              <Text style={{ fontSize: 36 }}>📦</Text>
            </View>
          )}
          <View style={styles.itemInfo}>
            <Text style={styles.itemTitle}>{item.title}</Text>
            {item.category ? <Text style={styles.itemCat}>{item.category}</Text> : null}
            {item.location_label ? (
              <Text style={styles.itemLocation}>📍 {item.location_label}</Text>
            ) : null}
            {item.description ? (
              <Text style={styles.itemDesc} numberOfLines={3}>{item.description}</Text>
            ) : null}
          </View>
        </View>

        {/* Security notice */}
        <View style={styles.securityNote}>
          <Text style={styles.securityIcon}>🔒</Text>
          <Text style={styles.securityText}>
            To verify your ownership, please answer the question the finder set. Your answer is only visible to the finder — not publicly.
          </Text>
        </View>

        {/* Proof question + answer */}
        {item.proof_question ? (
          <View style={styles.proofCard}>
            <Text style={styles.label}>Proof Question</Text>
            <View style={styles.questionBox}>
              <Text style={styles.questionText}>"{item.proof_question}"</Text>
            </View>

            <Text style={[styles.label, { marginTop: 16 }]}>Your Answer *</Text>
            <View style={styles.inputBox}>
              <TextInput
                style={styles.input}
                placeholder="Type your answer here…"
                placeholderTextColor="#94a3b8"
                value={answer}
                onChangeText={setAnswer}
                autoCapitalize="sentences"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </View>
        ) : (
          <View style={styles.proofCard}>
            <Text style={styles.questionText} style={{ color: '#475569', fontStyle: 'normal', lineHeight: 22 }}>
              The finder hasn't set a proof question. You can send a claim request to initiate a secure chat instead.
            </Text>
          </View>
        )}

        {/* Privacy note */}
        <Text style={styles.privacyNote}>
          After your claim is submitted, the finder will review your answer. If approved, you'll receive their contact details to arrange return.
        </Text>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          <LinearGradient colors={['#6366f1', '#8b5cf6']} style={styles.submitGrad}>
            {submitting
              ? <ActivityIndicator color="#ffffff" />
              : <Text style={styles.submitText}>Submit My Claim →</Text>
            }
          </LinearGradient>
        </TouchableOpacity>

        <Text style={styles.finePrint}>
          False claims are reported to admins and may result in account suspension.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9ff' },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f9ff' },
  scroll:    { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 60 },

  back:      { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  backArrow: { color: '#6366f1', fontSize: 20, marginRight: 6 },
  backLabel: { color: '#6366f1', fontWeight: '700', fontSize: 15 },

  pageSuper: { color: '#64748b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 },
  pageTitle: { color: '#0f172a', fontSize: 28, fontWeight: '900', letterSpacing: -0.5, marginBottom: 24 },

  // Item card
  itemCard: {
    backgroundColor: '#ffffff', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)',
    overflow: 'hidden', marginBottom: 20,
    shadowColor: '#6366f1', shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  itemImage:            { width: '100%', height: 180 },
  itemImagePlaceholder: { width: '100%', height: 140, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  itemInfo:             { padding: 16 },
  itemTitle:            { color: '#0f172a', fontSize: 18, fontWeight: '800', marginBottom: 4 },
  itemCat:              { color: '#6366f1', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  itemLocation:         { color: '#64748b', fontSize: 12, fontWeight: '500', marginBottom: 8 },
  itemDesc:             { color: '#475569', fontSize: 13, fontWeight: '500', lineHeight: 19 },

  // Security note
  securityNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#fdf4ff', borderWidth: 1, borderColor: '#e9d5ff',
    borderRadius: 16, padding: 14, marginBottom: 20,
  },
  securityIcon: { fontSize: 18 },
  securityText: { flex: 1, color: '#7e22ce', fontSize: 13, fontWeight: '500', lineHeight: 20 },

  // Proof card
  proofCard: {
    backgroundColor: '#ffffff', borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0',
    padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  label:       { color: '#64748b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  questionBox: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 14, marginBottom: 4 },
  questionText:{ color: '#0f172a', fontSize: 15, fontWeight: '600', lineHeight: 22, fontStyle: 'italic' },
  inputBox:    { backgroundColor: '#f8f9ff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 14, paddingHorizontal: 14 },
  input:       { color: '#0f172a', fontSize: 15, fontWeight: '500', paddingVertical: 12 },

  privacyNote: { color: '#64748b', fontSize: 13, fontWeight: '500', lineHeight: 20, marginBottom: 24, textAlign: 'center', paddingHorizontal: 8 },

  // Submit
  submitBtn:  { borderRadius: 20, overflow: 'hidden', shadowColor: '#6366f1', shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8, marginBottom: 16 },
  submitGrad: { paddingVertical: 16, alignItems: 'center' },
  submitText: { color: '#ffffff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },

  finePrint: { color: '#94a3b8', fontSize: 11, textAlign: 'center', fontWeight: '500', lineHeight: 17 },
});

import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, Alert,
  ActivityIndicator, ScrollView, StatusBar, StyleSheet, Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import * as Haptics from 'expo-haptics';

const CATEGORY_META: Record<string, { icon: string; bg: string }> = {
  Personal:    { icon: '👤', bg: '#E0E7FF' },
  Electronics: { icon: '💻', bg: '#FEF08A' },
  Bag:         { icon: '👜', bg: '#FCE7F3' },
  Keys:        { icon: '🔑', bg: '#DCFCE7' },
  Wallet:      { icon: '💳', bg: '#F3E8FF' },
  Travel:      { icon: '✈️', bg: '#FFE4E6' },
  Other:       { icon: '📦', bg: '#F3F4F6' },
};

export default function NotificationDetailScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuthStore();
  const router = useRouter();

  const [notification, setNotification] = useState<any>(null);
  const [loading, setLoading]           = useState(true);

  // Community Claim states
  const [communityItem, setCommunityItem] = useState<any>(null);
  const [claimDetail, setClaimDetail]     = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    async function loadNotif() {
      const { data } = await supabase.from('notifications').select('*').eq('id', id).single();
      if (data) {
        setNotification(data);
        if (!data.is_read) {
          await supabase.from('notifications').update({ is_read: true }).eq('id', id);
        }

        // ── NFC TAP: redirect straight to the real conversation ───────────
        // The 'Coordinate Return' UI was a dead-end placeholder. The actual
        // conversation is the source of truth for all owner<->finder chat.
        if (data.type === 'nfc_tap' && data.metadata?.conversation_id) {
          router.replace(`/conversation/${data.metadata.conversation_id}`);
          return;
        }

        // ── Community claim: load item + claim details ─────────────────
        if (data.metadata?.community_item_id && data.metadata?.claimant_id) {
          try {
            const { data: item } = await supabase
              .from('community_items')
              .select('*')
              .eq('id', data.metadata.community_item_id)
              .single();
            if (item) setCommunityItem(item);

            const { data: claim } = await supabase
              .from('community_claims')
              .select('*, claimant:claimant_id(email, name)')
              .eq('community_item_id', data.metadata.community_item_id)
              .eq('claimant_id', data.metadata.claimant_id)
              .single();
            if (claim) setClaimDetail(claim);
          } catch (err) {
            console.warn('Failed to load community claim details:', err);
          }
        }
      }
      setLoading(false);
    }
    loadNotif();
  }, [id]);

  // ── Community Board Claim Review flow ─────────────────────────
  const handleApproveClaim = async () => {
    if (!communityItem || !claimDetail || !user) return;
    setActionLoading(true);

    try {
      const { data: claimantUser, error: uErr } = await supabase
        .from('users')
        .select('auth_id')
        .eq('id', claimDetail.claimant_id)
        .single();

      if (uErr || !claimantUser?.auth_id) {
        throw new Error('Claimant auth account not found.');
      }

      const { data: conv, error: convErr } = await supabase
        .from('conversations')
        .insert({
          owner_id:          claimantUser.auth_id,
          finder_user_id:    user.id,
          community_item_id: communityItem.id,
          resolved:          false,
        })
        .select()
        .single();

      if (convErr) throw convErr;

      const { data: finderProfile } = await supabase
        .from('users')
        .select('name')
        .eq('auth_id', user.id)
        .single();
      const finderName = finderProfile?.name || 'Finder';

      const { error: msgErr } = await supabase
        .from('messages')
        .insert({
          conversation_id: conv.id,
          sender_id:       user.id,
          sender_name:     finderName,
          body:            `Proof accepted! Let's coordinate returning your lost item: "${communityItem.title}".`,
        });

      if (msgErr) throw msgErr;

      await supabase
        .from('community_claims')
        .update({ status: 'approved' })
        .eq('community_item_id', communityItem.id)
        .eq('claimant_id', claimDetail.claimant_id);

      await supabase
        .from('community_claims')
        .update({ status: 'rejected' })
        .eq('community_item_id', communityItem.id)
        .neq('claimant_id', claimDetail.claimant_id);

      await supabase
        .from('community_items')
        .update({ status: 'claimed' })
        .eq('id', communityItem.id);

      await supabase.from('notifications').insert({
        user_id:  claimantUser.auth_id,
        type:     'message',
        message:  `Your claim for "${communityItem.title}" has been approved! Chat is now open.`,
        metadata: { conversation_id: conv.id },
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('🎉 Claim Approved', 'A conversation has been created. You can now chat with the owner.', [
        { text: 'Go to Chat', onPress: () => router.push(`/conversation/${conv.id}`) },
      ]);
    } catch (err: any) {
      Alert.alert('Approval Error', err?.message ?? 'Could not approve claim. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectClaim = async () => {
    if (!communityItem || !claimDetail) return;
    setActionLoading(true);

    try {
      await supabase
        .from('community_claims')
        .update({ status: 'rejected' })
        .eq('community_item_id', communityItem.id)
        .eq('claimant_id', claimDetail.claimant_id);

      await supabase.from('notifications').insert({
        user_id:  claimDetail.claimant_id,
        type:     'message',
        message:  `Your claim for "${communityItem.title}" was not approved by the finder.`,
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Claim Rejected', 'The claimant has been notified.', [
        { text: 'Back', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not reject claim. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#6366f1" />
    </View>
  );

  if (!notification) return (
    <View style={styles.center}>
      <Text style={styles.notFound}>Notification not found</Text>
    </View>
  );

  const { metadata } = notification;
  const isCommunityClaim = !!(communityItem && claimDetail);

  // ── RENDER 1: Community Claim Review ──────────────────────────────────
  if (isCommunityClaim) {
    const meta = CATEGORY_META[communityItem.category] || CATEGORY_META.Other;
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8f9ff" />
        <ScrollView contentContainerStyle={styles.scroll}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back} activeOpacity={0.7}>
            <Text style={styles.backArrow}>←</Text>
            <Text style={styles.backLabel}>Activity</Text>
          </TouchableOpacity>

          <Text style={styles.pageSuper}>Claim Verification</Text>
          <Text style={styles.pageTitle}>Review Proof</Text>

          <View style={styles.card}>
            <Text style={styles.label}>Found Item</Text>
            <View style={styles.itemRow}>
              {communityItem.image_url ? (
                <Image source={{ uri: communityItem.image_url }} style={styles.itemImage} />
              ) : (
                <View style={[styles.catBox, { backgroundColor: meta.bg }]}>
                  <Text style={{ fontSize: 24 }}>{meta.icon}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{communityItem.title}</Text>
                <Text style={styles.itemCat}>{communityItem.category}</Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Claimant</Text>
            <Text style={styles.detailTitle}>{claimDetail.claimant?.name || 'Anonymous User'}</Text>
            <Text style={styles.detailSub}>{claimDetail.claimant?.email || 'No email shared'}</Text>
          </View>

          <View style={[styles.card, styles.proofCard]}>
            <Text style={[styles.label, { color: '#7e22ce' }]}>Proof Question</Text>
            <Text style={styles.proofQuestion}>"{communityItem.proof_question}"</Text>
            <View style={styles.proofDivider} />
            <Text style={[styles.label, { color: '#7e22ce' }]}>Submitted Answer</Text>
            <Text style={styles.proofAnswer}>"{claimDetail.proof_answer}"</Text>
          </View>

          {claimDetail.status === 'pending' ? (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.btn, styles.btnReject, actionLoading && { opacity: 0.6 }]}
                onPress={handleRejectClaim}
                disabled={actionLoading}
                activeOpacity={0.8}
              >
                <Text style={styles.btnRejectText}>Reject Claim</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btn, styles.btnApprove, actionLoading && { opacity: 0.6 }]}
                onPress={handleApproveClaim}
                disabled={actionLoading}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#6366f1', '#8b5cf6']}
                  style={StyleSheet.absoluteFillObject}
                />
                <Text style={styles.btnApproveText}>Approve & Chat</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.statusBanner, claimDetail.status === 'approved' ? styles.approvedBanner : styles.rejectedBanner]}>
              <Text style={styles.statusBannerText}>
                This claim was {claimDetail.status.toUpperCase()}
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  // ── RENDER 2: NFC Scan fallback (no conversation_id — legacy notification) ─
  // Modern notifications redirect to /conversation/[id] before reaching here.
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9ff" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} activeOpacity={0.7}>
          <Text style={styles.backArrow}>←</Text>
          <Text style={styles.backLabel}>Activity</Text>
        </TouchableOpacity>

        <View style={styles.nfcBanner}>
          <View style={styles.nfcIconBox}>
            <Text style={{ fontSize: 24 }}>📱</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.nfcBannerTitle}>Item Found!</Text>
            <Text style={styles.nfcBannerSub}>Someone scanned your lost item</Text>
          </View>
        </View>

        <Text style={styles.pageTitle}>Item Scanned</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Scan Location</Text>
          <Text style={styles.detailTitle}>{metadata?.location_label || 'Unknown Area'}</Text>
          <Text style={styles.detailSub}>{notification.message}</Text>
        </View>

        {metadata?.conversation_id ? (
          <TouchableOpacity
            style={styles.submitBtn}
            onPress={() => router.push(`/conversation/${metadata.conversation_id}`)}
            activeOpacity={0.85}
          >
            <LinearGradient colors={['#6366f1', '#8b5cf6']} style={styles.submitGrad}>
              <Text style={styles.submitText}>Open Chat with Finder →</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <View style={[styles.card, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
            <Text style={{ color: '#15803d', fontWeight: '700', textAlign: 'center' }}>
              The finder will contact you using the details provided when registering.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9ff' },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f9ff' },
  scroll:    { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 120 },
  notFound:  { color: '#64748b', fontSize: 15, fontWeight: '600' },

  back:      { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  backArrow: { color: '#6366f1', fontSize: 20, marginRight: 6 },
  backLabel: { color: '#6366f1', fontWeight: '700', fontSize: 15 },

  pageSuper: { color: '#64748b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 },
  pageTitle: { color: '#0f172a', fontSize: 28, fontWeight: '900', letterSpacing: -0.5, marginBottom: 24 },

  card: {
    backgroundColor: '#ffffff', borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0',
    padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  label: { color: '#64748b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },

  itemRow:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemImage: { width: 48, height: 48, borderRadius: 12 },
  catBox:    { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  itemTitle: { color: '#0f172a', fontSize: 16, fontWeight: '800' },
  itemCat:   { color: '#64748b', fontSize: 12, fontWeight: '600' },

  detailTitle: { color: '#0f172a', fontSize: 17, fontWeight: '800' },
  detailSub:   { color: '#64748b', fontSize: 12, fontWeight: '600', marginTop: 2 },

  proofCard:     { backgroundColor: '#faf5ff', borderColor: '#e9d5ff' },
  proofQuestion: { color: '#0f172a', fontSize: 15, fontWeight: '600', lineHeight: 22, fontStyle: 'italic', marginBottom: 12 },
  proofDivider:  { height: 1, backgroundColor: '#f3e8ff', marginVertical: 12 },
  proofAnswer:   { color: '#7e22ce', fontSize: 16, fontWeight: '700', lineHeight: 24 },

  actionRow:     { flexDirection: 'row', gap: 12, marginTop: 12 },
  btn:           { flex: 1, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  btnReject:     { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  btnRejectText: { color: '#64748b', fontSize: 15, fontWeight: '800' },
  btnApprove:    { position: 'relative', shadowColor: '#6366f1', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  btnApproveText: { color: '#ffffff', fontSize: 15, fontWeight: '800', zIndex: 1 },

  statusBanner:     { padding: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  approvedBanner:   { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0' },
  rejectedBanner:   { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca' },
  statusBannerText: { color: '#15803d', fontSize: 15, fontWeight: '800' },

  nfcBanner:      { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 20, padding: 16, marginBottom: 20 },
  nfcIconBox:     { width: 48, height: 48, borderRadius: 12, backgroundColor: '#dbeafe', alignItems: 'center', justifyContent: 'center' },
  nfcBannerTitle: { color: '#1d4ed8', fontSize: 16, fontWeight: '800' },
  nfcBannerSub:   { color: '#475569', fontSize: 13, fontWeight: '500' },

  submitBtn:  { borderRadius: 20, overflow: 'hidden', shadowColor: '#6366f1', shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  submitGrad: { paddingVertical: 16, alignItems: 'center' },
  submitText: { color: '#ffffff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
});

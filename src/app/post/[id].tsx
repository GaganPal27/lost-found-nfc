import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../stores/authStore';

export default function PostDetailScreen() {
  const { id: rawId } = useLocalSearchParams();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, dbUser } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [post, setPost] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPost() {
      try {
        if (!id) return;

        // 1. Check community_items (Found items) first — most common from NearbyBoard
        const { data: foundData } = await supabase
          .from('community_items')
          .select('*, users(id, auth_id, full_name)')
          .eq('id', id)
          .single();

        if (foundData) {
          setPost({ ...foundData, type: 'found' });
          return;
        }

        // 2. Fall back to lost_item_posts
        const { data: lostData } = await supabase
          .from('lost_item_posts')
          .select('*, users(id, auth_id, full_name)')
          .eq('id', id)
          .single();

        if (lostData) {
          setPost({ ...lostData, type: 'lost' });
          return;
        }

        setError('Post not found or has been deleted.');
      } catch (err: any) {
        setError(err.message || 'Error fetching post');
      } finally {
        setLoading(false);
      }
    }
    fetchPost();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (error || !post) {
    return (
      <View style={styles.center}>
        <Feather name="alert-circle" size={48} color="#f43f5e" />
        <Text style={styles.errorText}>{error || 'Post not found'}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isFound = post.type === 'found';
  const badgeColor      = isFound ? '#bbf7d0' : '#fecaca';
  const badgeTextColor  = isFound ? '#166534' : '#991b1b';
  const badgeLabel      = isFound ? 'Found Item' : 'Lost Item';

  // For found items: finder is post.finder_id (users.id)
  // Hide the claim button if the current user is the finder who posted it
  const isMyFoundPost = isFound && dbUser?.id === post.finder_id;
  // For lost items: poster is post.poster_id
  const isMyLostPost  = !isFound && dbUser?.id === post.poster_id;

  const handleClaimFound = () => {
    // community_items claim flow (proof question)
    router.push({ pathname: '/community-claim/[id]', params: { id: post.id } } as any);
  };

  const handleContactForLost = () => {
    // Lost items come from the NearbyBoard; push to their dedicated detail which has the full contact flow
    router.push({ pathname: '/lost-post/[id]', params: { id: post.id } } as any);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Feather name="arrow-left" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post Details</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {post.image_url ? (
          <Image source={{ uri: post.image_url }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Feather name="image" size={48} color="#cbd5e1" />
            <Text style={styles.noImageText}>No image provided</Text>
          </View>
        )}

        <View style={styles.content}>
          <View style={styles.metaRow}>
            <View style={[styles.badge, { backgroundColor: badgeColor }]}>
              <Text style={[styles.badgeText, { color: badgeTextColor }]}>{badgeLabel}</Text>
            </View>
            <Text style={styles.dateText}>
              {new Date(post.created_at).toDateString()}
            </Text>
          </View>

          <Text style={styles.title}>{post.title}</Text>
          <Text style={styles.category}>{post.category}</Text>

          {post.location_label && (
            <View style={styles.locationRow}>
              <Feather name="map-pin" size={16} color="#64748b" />
              <Text style={styles.locationText}>{post.location_label}</Text>
            </View>
          )}

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>
            {post.description || 'No additional description provided.'}
          </Text>

          {/* ── Action buttons ── */}

          {/* Found item: "This is Mine" */}
          {isFound && !isMyFoundPost && post.status !== 'closed' && (
            <TouchableOpacity onPress={handleClaimFound} activeOpacity={0.85} style={styles.ctaWrap}>
              <LinearGradient colors={['#6366f1', '#8b5cf6']} style={styles.ctaGrad}>
                <Text style={styles.ctaEmoji}>🔑</Text>
                <Text style={styles.ctaTitle}>This is Mine</Text>
                <Text style={styles.ctaSub}>
                  Answer a quick proof question to claim this item and connect with the finder.
                </Text>
                <View style={styles.ctaInnerBtn}>
                  <Text style={styles.ctaInnerBtnText}>Submit a Claim →</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Lost item: nudge to full detail screen which has the contact flow */}
          {!isFound && !isMyLostPost && post.status === 'searching' && (
            <TouchableOpacity onPress={handleContactForLost} activeOpacity={0.85} style={styles.ctaWrap}>
              <LinearGradient colors={['#f59e0b', '#f97316']} style={styles.ctaGrad}>
                <Text style={styles.ctaEmoji}>👋</Text>
                <Text style={styles.ctaTitle}>I Found This</Text>
                <Text style={styles.ctaSub}>
                  Contact the owner privately to arrange the return.
                </Text>
                <View style={styles.ctaInnerBtn}>
                  <Text style={styles.ctaInnerBtnText}>Message the Owner →</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Resolved / closed notice */}
          {(post.status === 'closed' || post.status === 'found' || post.status === 'resolved') && (
            <View style={styles.resolvedNote}>
              <Text style={styles.resolvedNoteText}>✓ This item has already been resolved.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  errorText: { fontSize: 16, color: '#334155', marginTop: 12, textAlign: 'center', marginBottom: 20 },
  backBtn: { backgroundColor: '#f1f5f9', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  backBtnText: { color: '#0f172a', fontWeight: '600', fontSize: 16 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  headerBtn: { padding: 8, width: 40 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },

  scroll: { paddingBottom: 40 },
  image: { width: '100%', height: 350, backgroundColor: '#f8f9ff' },
  imagePlaceholder: {
    width: '100%', height: 250, backgroundColor: '#f8f9ff',
    alignItems: 'center', justifyContent: 'center',
  },
  noImageText: { color: '#94a3b8', marginTop: 12, fontSize: 14, fontWeight: '500' },

  content: { padding: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  dateText: { fontSize: 13, color: '#94a3b8', fontWeight: '500' },

  title: { fontSize: 24, fontWeight: '800', color: '#0f172a', marginBottom: 8, letterSpacing: -0.5 },
  category: { fontSize: 15, color: '#6366f1', fontWeight: '600', marginBottom: 16 },

  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  locationText: { fontSize: 14, color: '#64748b', flex: 1 },

  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 20 },

  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
  description: { fontSize: 15, color: '#475569', lineHeight: 24, marginBottom: 24 },

  // CTA
  ctaWrap: { borderRadius: 24, overflow: 'hidden', marginBottom: 16, shadowColor: '#6366f1', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  ctaGrad: { borderRadius: 24, padding: 24, alignItems: 'center' },
  ctaEmoji: { fontSize: 32, marginBottom: 8 },
  ctaTitle: { fontSize: 18, fontWeight: '900', color: '#fff', marginBottom: 6 },
  ctaSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 20, marginBottom: 18 },
  ctaInnerBtn: { backgroundColor: 'rgba(255,255,255,0.22)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.55)', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 11 },
  ctaInnerBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  resolvedNote: { backgroundColor: '#dcfce7', borderWidth: 1, borderColor: '#86efac', borderRadius: 16, padding: 14 },
  resolvedNoteText: { color: '#15803d', fontSize: 13, fontWeight: '700', textAlign: 'center' },
});

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

const STATUS_COLORS: Record<string, { bg: string; dot: string; text: string; label: string }> = {
  searching: { bg: '#FEF3C7', dot: '#F59E0B', text: '#D97706', label: 'SEARCHING' },
  found:     { bg: '#DCFCE7', dot: '#22C55E', text: '#16A34A', label: 'FOUND'     },
  resolved:  { bg: '#E0E7FF', dot: '#6366F1', text: '#4338CA', label: 'RESOLVED'  },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'Just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function LostPostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function fetchPost() {
      if (!id) { setNotFound(true); setLoading(false); return; }
      const { data, error } = await supabase
        .from('lost_item_posts')
        .select('*, users(full_name, successful_recoveries)')
        .eq('id', id)
        .single();

      if (error || !data) {
        setNotFound(true);
      } else {
        setPost(data);
      }
      setLoading(false);
    }
    fetchPost();
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (notFound || !post) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>🔍</Text>
        <Text style={styles.notFoundTitle}>Item Not Found</Text>
        <Text style={styles.notFoundSub}>This post may have been removed or resolved.</Text>
        <TouchableOpacity style={styles.backBtnLarge} onPress={() => router.replace('/(tabs)/community')}>
          <Text style={styles.backBtnLargeText}>Go to Community Board</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const s = STATUS_COLORS[post.status] || STATUS_COLORS.searching;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/community')} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
          <Text style={styles.backLabel}>Lost Posts</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Status banner */}
        <View style={[styles.statusBanner, { backgroundColor: s.bg }]}>
          <View style={[styles.statusDot, { backgroundColor: s.dot }]} />
          <Text style={[styles.statusLabel, { color: s.text }]}>{s.label}</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>{post.title}</Text>
        <Text style={styles.poster}>Posted by {post.users?.full_name || 'Anonymous'}</Text>

        {/* Image if available */}
        {post.image_url ? (
          <Image source={{ uri: post.image_url }} style={styles.itemImage} resizeMode="cover" />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={{ fontSize: 56 }}>🔍</Text>
            <Text style={{ color: '#94a3b8', marginTop: 8, fontWeight: '600' }}>No photo</Text>
          </View>
        )}

        {/* Details card */}
        <View style={styles.detailCard}>
          <Row label="Category" value={post.category} icon="🏷️" />
          <Row label="Alert Radius" value={`${post.radius_km} km`} icon="📡" />
          <Row label="Posted" value={timeAgo(post.created_at)} icon="🕐" />
          {post.last_seen_lat && post.last_seen_lng && (
            <Row label="Last Known Location" value={`${post.last_seen_lat.toFixed(4)}, ${post.last_seen_lng.toFixed(4)}`} icon="📍" />
          )}
        </View>

        {/* Description */}
        {post.description ? (
          <View style={styles.descCard}>
            <Text style={styles.descLabel}>Description</Text>
            <Text style={styles.descText}>{post.description}</Text>
          </View>
        ) : null}

        {/* CTA — If still searching, prompt finder */}
        {post.status === 'searching' && (
          <LinearGradient colors={['#6366f1', '#8b5cf6']} style={styles.cta}>
            <Text style={styles.ctaEmoji}>👋</Text>
            <Text style={styles.ctaTitle}>Did you find this item?</Text>
            <Text style={styles.ctaSub}>
              If you found something matching this description, please reply on the Community Board so the owner can be reunited with it!
            </Text>
            <TouchableOpacity
              style={styles.ctaBtn}
              onPress={() => router.replace('/(tabs)/community')}
              activeOpacity={0.85}
            >
              <Text style={styles.ctaBtnText}>Go to Community Board →</Text>
            </TouchableOpacity>
          </LinearGradient>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function Row({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9ff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backArrow: { fontSize: 22, color: '#6366f1', marginRight: 6 },
  backLabel: { fontSize: 15, color: '#6366f1', fontWeight: '700' },
  scroll: { padding: 20 },
  statusBanner: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 12 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  title: { fontSize: 26, fontWeight: '900', color: '#0f172a', marginBottom: 6, lineHeight: 32 },
  poster: { fontSize: 13, color: '#64748b', fontWeight: '600', marginBottom: 20 },
  itemImage: { width: '100%', height: 220, borderRadius: 20, marginBottom: 20 },
  imagePlaceholder: { width: '100%', height: 160, borderRadius: 20, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  detailCard: { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#f1f5f9', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  rowIcon: { fontSize: 20, width: 32 },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  rowValue: { fontSize: 14, color: '#0f172a', fontWeight: '700', marginTop: 2 },
  descCard: { backgroundColor: '#fff', borderRadius: 20, padding: 18, marginBottom: 20, borderWidth: 1, borderColor: '#f1f5f9' },
  descLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  descText: { fontSize: 15, color: '#334155', lineHeight: 22, fontWeight: '500' },
  cta: { borderRadius: 24, padding: 24, alignItems: 'center', marginBottom: 16 },
  ctaEmoji: { fontSize: 36, marginBottom: 10 },
  ctaTitle: { fontSize: 18, fontWeight: '900', color: '#fff', marginBottom: 8 },
  ctaSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  ctaBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 },
  ctaBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  notFoundTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginBottom: 8 },
  notFoundSub: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 24 },
  backBtnLarge: { backgroundColor: '#6366f1', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16 },
  backBtnLargeText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});

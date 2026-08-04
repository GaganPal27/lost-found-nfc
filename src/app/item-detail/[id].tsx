import { useEffect, useState } from 'react';
import {
  View, Text, ActivityIndicator, ScrollView, TouchableOpacity,
  Alert, Switch, StatusBar, Linking, StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useItemStore } from '../../stores/itemStore';
import { useSubscriptionStore } from '../../stores/subscriptionStore';

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  active:  { label: 'ACTIVE', bg: '#dcfce7', text: '#16a34a', dot: '#22c55e' },
  lost:    { label: 'LOST',   bg: '#fee2e2', text: '#dc2626', dot: '#ef4444' },
  found:   { label: 'FOUND',  bg: '#dbeafe', text: '#2563eb', dot: '#3b82f6' },
};

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { deleteItem, updateStatus } = useItemStore();
  const { tier } = useSubscriptionStore();

  const [item, setItem] = useState<any>(null);
  const [scans, setScans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>('active');
  const [locationAddress, setLocationAddress] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      const { data: itemData } = await supabase.from('items').select('*').eq('id', id).single();
      if (itemData) {
        setItem(itemData);
        setStatus(itemData.status);

        if (itemData.last_seen_lat && itemData.last_seen_lng) {
          try {
            const results = await Location.reverseGeocodeAsync({
              latitude: itemData.last_seen_lat,
              longitude: itemData.last_seen_lng,
            });
            if (results.length > 0) {
              const r = results[0];
              const parts = [r.name, r.street, r.district, r.city, r.region].filter(Boolean);
              setLocationAddress(parts.join(', '));
            }
          } catch {
            // non-fatal
          }
        }

        const days = tier === 'max' ? 90 : tier === 'pro' ? 30 : 7;
        const d = new Date();
        d.setDate(d.getDate() - days);

        const { data: scanData } = await supabase
          .from('nfc_scans')
          .select('*')
          .eq('nfc_uid', itemData.nfc_uid)
          .gte('scanned_at', d.toISOString())
          .order('scanned_at', { ascending: false });

        setScans(scanData || []);
      }
      setLoading(false);
    }
    loadData();
  }, [id, tier]);

  const handleUpdateStatus = async (newStatus: string) => {
    setStatus(newStatus);
    await updateStatus(id as string, newStatus as any);
  };

  const handleDelete = () => {
    Alert.alert('Delete Item', 'This will permanently remove this item and its tag registration.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteItem(id as string);
          router.replace('/(tabs)/my-items');
        }
      },
    ]);
  };

  const handleRewrite = () => {
    router.push({
      pathname: '/register-item/write-tag',
      params: { id: item.id, nfc_uid: item.nfc_uid, ble_beacon_id: item.ble_beacon_id || '', tag_type: item.tag_type },
    });
  };

  if (loading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#6366f1" />
    </View>
  );
  if (!item) return (
    <View style={styles.loadingContainer}>
      <Text style={styles.notFoundText}>Item not found</Text>
    </View>
  );

  const sc = STATUS_CONFIG[status] || STATUS_CONFIG.active;
  const isLost = status === 'lost';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#6366f1" />

      {/* ── Gradient Header ── */}
      <LinearGradient
        colors={isLost ? ['#f43f5e', '#be123c'] : ['#6366f1', '#7c3aed']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.hCircle1} />
        <View style={styles.hCircle2} />

        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle} numberOfLines={2}>{item.item_name}</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => router.push(`/edit-item/${id}`)} activeOpacity={0.8} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>Edit Item</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} activeOpacity={0.8} style={styles.headerBtnDanger}>
            <Text style={styles.headerBtnDangerText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* ── Body ── */}
      <View style={styles.body}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* Tags Row */}
          <View style={styles.tagsRow}>
            <View style={[styles.statusTag, { backgroundColor: sc.bg }]}>
              <View style={[styles.statusTagDot, { backgroundColor: sc.dot }]} />
              <Text style={[styles.statusTagText, { color: sc.text }]}>{sc.label}</Text>
            </View>
            <View style={styles.metaBadge}>
              <Text style={styles.metaBadgeText}>{item.tag_type.replace(/_/g, ' ')}</Text>
            </View>
            <View style={styles.metaBadge}>
              <Text style={styles.metaBadgeText}>{item.category}</Text>
            </View>
          </View>

          {/* Lost Mode Toggle */}
          <View style={[styles.card, isLost && styles.cardLost]}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Text style={styles.cardTitle}>Lost Mode</Text>
                <Text style={styles.cardSub}>
                  When enabled, finders will see your contact details when they scan this tag.
                </Text>
              </View>
              <Switch
                value={isLost}
                onValueChange={(v) => handleUpdateStatus(v ? 'lost' : 'active')}
                trackColor={{ true: '#fda4af', false: '#e2e8f0' }}
                thumbColor={isLost ? '#f43f5e' : '#94a3b8'}
              />
            </View>
            {isLost && (
              <View style={styles.lostAlert}>
                <Text style={styles.lostAlertText}>🔴 LOST MODE ACTIVE — Finders can contact you</Text>
              </View>
            )}
          </View>

          {/* NFC Scan History */}
          <Text style={styles.sectionTitle}>NFC Scan History</Text>
          <View style={styles.card}>
            {scans.length === 0 ? (
              <View style={styles.emptyScans}>
                <Text style={styles.emptyScansTitle}>No recent scans found</Text>
                <Text style={styles.emptyScansSub}>Scans appear here when someone taps your tag</Text>
              </View>
            ) : (
              scans.map((scan, i) => (
                <View key={scan.id} style={[styles.scanRow, i !== scans.length - 1 && styles.scanRowBorder]}>
                  <View style={styles.scanIconWrap}>
                    <Text style={styles.scanIcon}>📍</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.scanLoc}>{scan.location_label || 'Unknown location'}</Text>
                    <Text style={styles.scanDate}>{new Date(scan.scanned_at).toLocaleString()}</Text>
                  </View>
                </View>
              ))
            )}
            {scans.length > 0 && tier === 'basic' && (
              <View style={styles.upsellBar}>
                <Text style={styles.upsellText}>Showing 7-day history · Upgrade for 30 days</Text>
              </View>
            )}
          </View>

          {/* Re-program Tag */}
          <TouchableOpacity onPress={handleRewrite} activeOpacity={0.88} style={styles.reprogramBtn}>
            <Text style={styles.reprogramBtnText}>↺ Re-program Tag</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8faff' },
  loadingContainer: { flex: 1, backgroundColor: '#f8faff', justifyContent: 'center', alignItems: 'center' },
  notFoundText: { color: '#64748b', fontSize: 16, fontWeight: '500' },

  /* ── Header ── */
  header: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    overflow: 'hidden',
    position: 'relative',
  },
  hCircle1: { position: 'absolute', top: -30, right: -30, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.08)' },
  hCircle2: { position: 'absolute', bottom: -20, left: -40, width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(255,255,255,0.06)' },
  
  backBtn: { alignSelf: 'flex-start', paddingVertical: 8, marginBottom: 8 },
  backBtnText: { color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: '700' },

  headerTitleRow: { marginBottom: 16 },
  headerTitle: { color: '#ffffff', fontSize: 32, fontWeight: '900', letterSpacing: -0.5 },

  headerActions: { flexDirection: 'row', gap: 10 },
  headerBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12,
  },
  headerBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  headerBtnDanger: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12,
  },
  headerBtnDangerText: { color: '#e11d48', fontSize: 13, fontWeight: '800' },

  /* ── Body ── */
  body: {
    flex: 1,
    backgroundColor: '#f8faff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -24,
  },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 60 },

  tagsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, gap: 8 },
  statusTag: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  statusTagDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  statusTagText: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  
  metaBadge: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  metaBadgeText: { color: '#64748b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  /* Cards */
  card: {
    backgroundColor: '#ffffff', borderRadius: 22, padding: 20, marginBottom: 24,
    shadowColor: '#6366f1', shadowOpacity: 0.08, shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 }, elevation: 3,
    borderWidth: 1, borderColor: '#f1f5f9',
  },
  cardLost: { borderColor: '#fda4af', shadowColor: '#f43f5e', shadowOpacity: 0.15 },
  cardTitle: { color: '#0f172a', fontWeight: '800', fontSize: 16, marginBottom: 4 },
  cardSub: { color: '#64748b', fontSize: 13, lineHeight: 19, fontWeight: '500' },
  
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleInfo: { flex: 1, paddingRight: 16 },
  
  lostAlert: { marginTop: 16, backgroundColor: '#fff1f2', borderWidth: 1, borderColor: '#ffe4e6', borderRadius: 14, padding: 12 },
  lostAlertText: { color: '#e11d48', fontSize: 12, fontWeight: '800', textAlign: 'center' },

  sectionTitle: { color: '#0f172a', fontSize: 16, fontWeight: '800', marginBottom: 12, marginLeft: 4 },

  /* Scans */
  emptyScans: { paddingVertical: 24, alignItems: 'center' },
  emptyScansTitle: { color: '#64748b', fontSize: 14, fontWeight: '700' },
  emptyScansSub: { color: '#94a3b8', fontSize: 12, marginTop: 4, fontWeight: '500' },
  
  scanRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  scanRowBorder: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  scanIconWrap: { width: 40, height: 40, backgroundColor: '#f8faff', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  scanIcon: { fontSize: 18 },
  scanLoc: { color: '#0f172a', fontWeight: '700', fontSize: 14, marginBottom: 2 },
  scanDate: { color: '#64748b', fontSize: 12, fontWeight: '500' },
  
  upsellBar: { backgroundColor: '#fffbeb', borderTopWidth: 1, borderTopColor: '#fef3c7', marginHorizontal: -20, marginBottom: -20, padding: 12, borderBottomLeftRadius: 22, borderBottomRightRadius: 22, alignItems: 'center', marginTop: 10 },
  upsellText: { color: '#d97706', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },

  /* Reprogram button */
  reprogramBtn: { backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#e0e7ff', padding: 16, borderRadius: 18, alignItems: 'center', shadowColor: '#6366f1', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  reprogramBtnText: { color: '#6366f1', fontSize: 15, fontWeight: '800' },
});

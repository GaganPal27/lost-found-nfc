import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Item } from '../stores/itemStore';
import * as Haptics from 'expo-haptics';

const STATUS_PILL: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  active: { bg: '#dcfce7', text: '#16a34a', dot: '#22c55e', label: 'Active' },
  lost:   { bg: '#fee2e2', text: '#dc2626', dot: '#ef4444', label: 'Lost'   },
  found:  { bg: '#dbeafe', text: '#2563eb', dot: '#3b82f6', label: 'Found'  },
};

const TAG_META: Record<string, { icon: string; label: string }> = {
  nfc_only: { icon: '📱', label: 'NFC' },
  ble_only: { icon: '📡', label: 'BLE' },
  nfc_ble:  { icon: '🔗', label: 'NFC+BLE' },
};

const CATEGORY_META: Record<string, { icon: string; bg: string }> = {
  Personal:    { icon: '👤', bg: '#E0E7FF' }, // Indigo
  Electronics: { icon: '💻', bg: '#FEF08A' }, // Yellow
  Bag:         { icon: '👜', bg: '#FCE7F3' }, // Pink
  Keys:        { icon: '🔑', bg: '#DCFCE7' }, // Green
  Wallet:      { icon: '💳', bg: '#F3E8FF' }, // Purple
  Travel:      { icon: '✈️', bg: '#FFE4E6' }, // Rose
  Other:       { icon: '📦', bg: '#F3F4F6' }, // Gray
};

export default function ItemCard({ item }: { item: Item }) {
  const router = useRouter();
  const pill = STATUS_PILL[item.status] || STATUS_PILL.active;
  const tag = TAG_META[item.tag_type] || TAG_META.nfc_only;
  const catMeta = CATEGORY_META[item.category] || CATEGORY_META.Other;
  const isLost = item.status === 'lost';
  const isLinked = (item as any).nfc_link_type === 'linked_existing';

  const handleTrack = (e: any) => {
    e.stopPropagation();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/item-tracking/${item.id}`);
  };

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={() => router.push(`/item-detail/${item.id}`)}
      style={[
        styles.card,
        isLost && styles.cardLost,
      ]}
    >
      {/* Lost mode accent bar */}
      {isLost && <View style={styles.lostBar} />}

      <View style={styles.contentRow}>
        {/* Item Thumbnail */}
        <View style={[styles.thumbnail, { backgroundColor: catMeta.bg }]}>
          {item.image_url && !item.image_url.includes('placeholder') ? (
            <Image source={{ uri: item.image_url }} style={styles.thumbnailImg} />
          ) : (
            <Text style={styles.thumbnailIcon}>{catMeta.icon}</Text>
          )}
        </View>

        {/* Info Column */}
        <View style={styles.infoCol}>
          {/* Header Row: Name + Status */}
          <View style={styles.headerRow}>
            <Text style={styles.itemName} numberOfLines={1}>
              {item.item_name}
            </Text>
            <View style={[styles.statusPill, { backgroundColor: pill.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: pill.dot }]} />
              <Text style={[styles.statusText, { color: pill.text }]}>
                {pill.label}
              </Text>
            </View>
          </View>

          {/* Last seen + Track button */}
          <View style={styles.actionRow}>
            {item.last_seen_at ? (
              <View style={styles.lastSeenWrap}>
                <View style={styles.lastSeenDot} />
                <Text style={styles.lastSeenText} numberOfLines={1}>
                  Seen {new Date(item.last_seen_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  {(item as any).last_seen_location ? ` · ${(item as any).last_seen_location}` : ''}
                </Text>
              </View>
            ) : (
              <View style={{ flex: 1 }} />
            )}

            <TouchableOpacity
              onPress={handleTrack}
              activeOpacity={0.7}
              style={styles.trackBtn}
            >
              <Text style={styles.trackBtnText}>📍 Track</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Chevron */}
        <View style={styles.chevronWrap}>
          <Text style={styles.chevron}>→</Text>
        </View>
      </View>

      {/* Bottom Meta Bar */}
      <View style={styles.bottomMeta}>
        <View style={styles.metaBadge}>
          <Text style={styles.metaIcon}>{tag.icon}</Text>
          <Text style={styles.metaLabel}>{tag.label}</Text>
        </View>
        <Text style={styles.metaCategory}>· {item.category}</Text>
        {isLinked && (
          <View style={styles.linkedBadge}>
            <Text style={styles.linkedText}>💳 Linked</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
    shadowColor: '#6366f1',
    shadowOpacity: 0.08,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
    overflow: 'hidden',
  },
  cardLost: {
    borderColor: 'rgba(244,63,94,0.4)',
    shadowColor: '#f43f5e',
    shadowOpacity: 0.25,
  },
  lostBar: {
    height: 4,
    backgroundColor: '#f43f5e',
    width: '100%',
  },
  contentRow: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 12,
    alignItems: 'center',
  },
  thumbnail: {
    width: 76,
    height: 76,
    borderRadius: 20,
    marginRight: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailImg: { width: '100%', height: '100%' },
  thumbnailIcon: { fontSize: 34 },
  
  infoCol: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemName: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
    flex: 1,
    marginRight: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  lastSeenWrap: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  lastSeenDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#6366f1', marginRight: 6 },
  lastSeenText: { color: '#64748b', fontSize: 11, fontWeight: '600' },
  
  trackBtn: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
  },
  trackBtnText: { color: '#ffffff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  chevronWrap: { justifyContent: 'center', paddingLeft: 10 },
  chevron: { color: '#6366f1', fontSize: 20, fontWeight: '600' },

  bottomMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 6,
    flexWrap: 'wrap',
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99,102,241,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  metaIcon: { fontSize: 10, marginRight: 4 },
  metaLabel: { color: '#6366f1', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  metaCategory: { color: '#64748b', fontSize: 12, fontWeight: '600', marginLeft: 2 },
  
  linkedBadge: {
    backgroundColor: 'rgba(139,92,246,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 4,
  },
  linkedText: { color: '#8b5cf6', fontSize: 10, fontWeight: '700' },
});

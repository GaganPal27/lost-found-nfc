import { View, Text, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Item } from '../stores/itemStore';
import * as Haptics from 'expo-haptics';

const STATUS_PILL: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  active: { bg: 'bg-green-100 border-green-200',  text: 'text-green-700',  dot: 'bg-green-500', label: 'Active' },
  lost:   { bg: 'bg-red-100 border-red-200',      text: 'text-red-700',    dot: 'bg-red-500',   label: 'Lost'   },
  found:  { bg: 'bg-blue-100 border-blue-200',    text: 'text-blue-700',   dot: 'bg-blue-500',  label: 'Found'  },
};

const TAG_META: Record<string, { icon: string; label: string }> = {
  nfc_only: { icon: '📱', label: 'NFC' },
  ble_only: { icon: '📡', label: 'BLE' },
  nfc_ble:  { icon: '🔗', label: 'NFC+BLE' },
};

const CATEGORY_META: Record<string, { icon: string; bg: string }> = {
  Personal: { icon: '👤', bg: '#E0E7FF' }, // Indigo
  Electronics: { icon: '💻', bg: '#FEF08A' }, // Yellow
  Bag: { icon: '👜', bg: '#FCE7F3' }, // Pink
  Keys: { icon: '🔑', bg: '#DCFCE7' }, // Green
  Wallet: { icon: '💳', bg: '#F3E8FF' }, // Purple
  Travel: { icon: '✈️', bg: '#FFE4E6' }, // Rose
  Other: { icon: '📦', bg: '#F3F4F6' }, // Gray
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
      activeOpacity={0.82}
      onPress={() => router.push(`/item-detail/${item.id}`)}
      style={{
        backgroundColor: '#ffffff',
        borderRadius: 24, // Larger, more modern border radius
        marginBottom: 16,
        borderWidth: 1,
        borderColor: isLost ? 'rgba(244,63,94,0.4)' : 'rgba(0,0,0,0.03)',
        shadowColor: isLost ? '#f43f5e' : '#6366f1',
        shadowOpacity: isLost ? 0.25 : 0.08,
        shadowRadius: 15,
        shadowOffset: { width: 0, height: 6 },
        elevation: 4,
        overflow: 'hidden',
      }}
    >
      {/* Lost mode accent bar */}
      {isLost && (
        <View style={{ height: 4, backgroundColor: '#f43f5e', width: '100%' }} />
      )}

      <View style={{ flexDirection: 'row', padding: 14, alignItems: 'center' }}>
        {/* Item Thumbnail */}
        <View
          style={{
            width: 72,
            height: 72,
            backgroundColor: catMeta.bg,
            borderRadius: 20,
            marginRight: 14,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {item.image_url && !item.image_url.includes('placeholder') ? (
            <Image source={{ uri: item.image_url }} style={{ width: '100%', height: '100%' }} />
          ) : (
            <Text style={{ fontSize: 32 }}>{catMeta.icon}</Text>
          )}
        </View>

        {/* Content */}
        <View style={{ flex: 1 }}>
          {/* Name + Status pill */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Text
              style={{ color: '#0f172a', fontSize: 15, fontWeight: '800', flex: 1, marginRight: 8 }}
              numberOfLines={1}
            >
              {item.item_name}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 20,
                borderWidth: 1,
              }}
              className={`${pill.bg}`}
            >
              <View
                style={{ width: 6, height: 6, borderRadius: 3, marginRight: 5 }}
                className={pill.dot}
              />
              <Text
                style={{ fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' }}
                className={pill.text}
              >
                {pill.label}
              </Text>
            </View>
          </View>

          {/* Tag type + Category meta row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'rgba(99,102,241,0.1)',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 12,
              }}
            >
              <Text style={{ fontSize: 10, marginRight: 4 }}>{tag.icon}</Text>
              <Text style={{ color: '#6366f1', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>
                {tag.label}
              </Text>
            </View>
            <Text style={{ color: '#64748b', fontSize: 12, marginLeft: 2, fontWeight: '600' }}>{item.category}</Text>
            {isLinked && (
              <View style={{ backgroundColor: 'rgba(139,92,246,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginLeft: 4 }}>
                <Text style={{ color: '#8b5cf6', fontSize: 10, fontWeight: '700' }}>💳 Linked</Text>
              </View>
            )}
          </View>

          {/* Last seen + Track */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 7 }}>
            {item.last_seen_at ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981', marginRight: 6 }} />
                <Text style={{ color: '#64748b', fontSize: 11, fontWeight: '500' }} numberOfLines={1}>
                  Seen {new Date(item.last_seen_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  {' '}· {(item as any).last_seen_location ?? ''}
                </Text>
              </View>
            ) : (
              <View style={{ flex: 1 }} />
            )}
            <TouchableOpacity
              onPress={handleTrack}
              activeOpacity={0.7}
              style={{ backgroundColor: '#6366f1', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, shadowColor: '#6366f1', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4 }}
            >
              <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }}>📍 Track</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Arrow */}
        <View style={{ justifyContent: 'center', paddingLeft: 8 }}>
          <Text style={{ color: '#94a3b8', fontSize: 24, fontWeight: '300' }}>›</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

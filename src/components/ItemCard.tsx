import { View, Text, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Item } from '../stores/itemStore';

const STATUS_PILL: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  active: { bg: 'bg-green-500/15 border-green-500/30',  text: 'text-green-400',  dot: 'bg-green-400', label: 'Active' },
  lost:   { bg: 'bg-red-500/15 border-red-500/30',      text: 'text-red-400',    dot: 'bg-red-400',   label: 'Lost'   },
  found:  { bg: 'bg-cyan-500/15 border-cyan-500/30',    text: 'text-cyan-400',   dot: 'bg-cyan-400',  label: 'Found'  },
};

const TAG_META: Record<string, { icon: string; label: string }> = {
  nfc_only: { icon: '📱', label: 'NFC' },
  ble_only: { icon: '📡', label: 'BLE' },
  nfc_ble:  { icon: '🔗', label: 'NFC+BLE' },
};

const CATEGORY_ICONS: Record<string, string> = {
  Personal: '👤', Electronics: '💻', Bag: '👜', Keys: '🔑',
  Wallet: '💳', Travel: '✈️', Other: '📦',
};

export default function ItemCard({ item }: { item: Item }) {
  const router = useRouter();
  const pill = STATUS_PILL[item.status] || STATUS_PILL.active;
  const tag = TAG_META[item.tag_type] || TAG_META.nfc_only;
  const catIcon = CATEGORY_ICONS[item.category] || '📦';
  const isLost = item.status === 'lost';

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={() => router.push(`/item-detail/${item.id}`)}
      style={{
        backgroundColor: '#1e293b',
        borderRadius: 20,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: isLost ? 'rgba(239,68,68,0.35)' : '#334155',
        shadowColor: isLost ? '#ef4444' : '#06b6d4',
        shadowOpacity: isLost ? 0.15 : 0.08,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
        elevation: 4,
        overflow: 'hidden',
      }}
    >
      {/* Lost mode accent bar */}
      {isLost && (
        <View style={{ height: 2.5, backgroundColor: '#ef4444', width: '100%' }} />
      )}

      <View style={{ flexDirection: 'row', padding: 14, alignItems: 'center' }}>
        {/* Item Thumbnail */}
        <View
          style={{
            width: 68,
            height: 68,
            backgroundColor: '#0f172a',
            borderRadius: 16,
            marginRight: 14,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: '#334155',
          }}
        >
          {item.image_url && !item.image_url.includes('placeholder') ? (
            <Image source={{ uri: item.image_url }} style={{ width: '100%', height: '100%' }} />
          ) : (
            <Text style={{ fontSize: 30 }}>{catIcon}</Text>
          )}
        </View>

        {/* Content */}
        <View style={{ flex: 1 }}>
          {/* Name + Status pill */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Text
              style={{ color: '#f1f5f9', fontSize: 15, fontWeight: '700', flex: 1, marginRight: 8 }}
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
                style={{ fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' }}
                className={pill.text}
              >
                {pill.label}
              </Text>
            </View>
          </View>

          {/* Tag type + Category meta row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'rgba(6,182,212,0.1)',
                borderColor: 'rgba(6,182,212,0.25)',
                borderWidth: 1,
                paddingHorizontal: 7,
                paddingVertical: 3,
                borderRadius: 12,
              }}
            >
              <Text style={{ fontSize: 10, marginRight: 3 }}>{tag.icon}</Text>
              <Text style={{ color: '#22d3ee', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>
                {tag.label}
              </Text>
            </View>
            <Text style={{ color: '#64748b', fontSize: 12, marginLeft: 2 }}>{item.category}</Text>
          </View>

          {/* Last seen timestamp */}
          {item.last_seen_at && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 7 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981', marginRight: 6 }} />
              <Text style={{ color: '#475569', fontSize: 11 }}>
                Last seen {new Date(item.last_seen_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                at {new Date(item.last_seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          )}
        </View>

        {/* Arrow */}
        <View style={{ justifyContent: 'center', paddingLeft: 8 }}>
          <Text style={{ color: '#475569', fontSize: 20, fontWeight: '300' }}>›</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

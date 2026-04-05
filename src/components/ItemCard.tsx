import { View, Text, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Item } from '../stores/itemStore';

const STATUS_PILL: Record<string, { bg: string; text: string; dot: string }> = {
  active: { bg: 'bg-green-500/15 border-green-500/30',  text: 'text-green-400',  dot: 'bg-green-400' },
  lost:   { bg: 'bg-red-500/15 border-red-500/30',      text: 'text-red-400',    dot: 'bg-red-400'   },
  found:  { bg: 'bg-cyan-500/15 border-cyan-500/30',    text: 'text-cyan-400',   dot: 'bg-cyan-400'  },
};

const TAG_ICONS: Record<string, string> = {
  nfc_only: '📱',
  ble_only: '📡',
  nfc_ble:  '🔗',
};

export default function ItemCard({ item }: { item: Item }) {
  const router = useRouter();
  const pill = STATUS_PILL[item.status] || STATUS_PILL.active;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => router.push(`/item-detail/${item.id}`)}
      className="bg-darkCard border border-darkBorder rounded-3xl mb-4 p-4 flex-row"
      style={{ shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 }}
    >
      {/* Image/Icon */}
      <View className="w-16 h-16 bg-slate-700 rounded-2xl mr-4 overflow-hidden items-center justify-center border border-slate-600">
        {item.image_url && !item.image_url.includes('placeholder') ? (
          <Image source={{ uri: item.image_url }} className="w-full h-full" />
        ) : (
          <Text className="text-3xl">{TAG_ICONS[item.tag_type] || '📦'}</Text>
        )}
      </View>

      {/* Info */}
      <View className="flex-1 justify-center">
        <View className="flex-row justify-between items-start mb-2">
          <Text className="text-white text-base font-bold flex-1 mr-3" numberOfLines={1}>
            {item.item_name}
          </Text>
          {/* Status Pill */}
          <View className={`flex-row items-center px-2.5 py-1 rounded-full border ${pill.bg}`}>
            <View className={`w-1.5 h-1.5 rounded-full mr-1.5 ${pill.dot}`} />
            <Text className={`text-[10px] font-bold uppercase tracking-wider ${pill.text}`}>
              {item.status}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center mt-1">
          <View className="bg-slate-700/60 border border-slate-600 px-2 py-0.5 rounded-full mr-2">
            <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
              {item.tag_type.replace(/_/g, '+')}
            </Text>
          </View>
          <Text className="text-slate-500 text-xs capitalize">{item.category}</Text>
        </View>

        {item.last_seen_at && (
          <Text className="text-slate-500 text-xs mt-2">
            💡 Last seen: {new Date(item.last_seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}
      </View>

      {/* Chevron */}
      <View className="justify-center pl-2">
        <Text className="text-slate-600 text-lg">›</Text>
      </View>
    </TouchableOpacity>
  );
}

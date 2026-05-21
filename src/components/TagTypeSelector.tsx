import { View, Text, TouchableOpacity } from 'react-native';
import { useSubscriptionStore } from '../stores/subscriptionStore';

type TagType = 'nfc_only' | 'nfc_ble' | 'ble_only';

interface Props {
  selectedType: TagType;
  onSelect: (t: TagType) => void;
  onLockedSelect?: (requiredTier: string) => void;
}

const TAG_OPTIONS = [
  {
    id: 'nfc_only' as TagType,
    label: 'NFC Only',
    icon: '📱',
    desc: 'Sticker tag on your item. Any phone can scan it to get your contact info instantly.',
    requiredTier: 'basic',
    badge: 'Free',
    badgeColor: 'bg-green-100 border-green-200 text-green-700',
  },
  {
    id: 'nfc_ble' as TagType,
    label: 'NFC + BLE',
    icon: '🔗',
    desc: 'Combines NFC sticker with a BLE beacon. Passive location tracking even without scanning.',
    requiredTier: 'pro',
    badge: 'Pro',
    badgeColor: 'bg-blue-100 border-blue-200 text-blue-700',
  },
  {
    id: 'ble_only' as TagType,
    label: 'BLE Only',
    icon: '📡',
    desc: 'BLE beacon only — no sticker needed. Item appears on the passive tracking map automatically.',
    requiredTier: 'max',
    badge: 'Max',
    badgeColor: 'bg-red-100 border-red-200 text-red-700',
  },
];

const TIER_RANK: Record<string, number> = { basic: 0, pro: 1, max: 2 };

export default function TagTypeSelector({ selectedType, onSelect, onLockedSelect }: Props) {
  const { tier } = useSubscriptionStore();

  const isLocked = (opt: typeof TAG_OPTIONS[0]) => TIER_RANK[tier] < TIER_RANK[opt.requiredTier];

  return (
    <View>
      <Text className="text-slate-500 text-xs uppercase tracking-wider mb-3 font-bold">Tag Type</Text>
      {TAG_OPTIONS.map(opt => {
        const locked = isLocked(opt);
        const selected = selectedType === opt.id;
        return (
          <TouchableOpacity
            key={opt.id}
            activeOpacity={0.8}
            onPress={() => locked ? onLockedSelect?.(opt.requiredTier) : onSelect(opt.id)}
            className={`rounded-3xl border p-4 mb-3 flex-row shadow-sm ${
              selected
                ? 'bg-primary/10 border-primary/20 shadow-primary/10'
                : locked
                ? 'bg-darkBg border-slate-200 opacity-60 shadow-none'
                : 'bg-white border-slate-200'
            }`}
          >
            {/* Icon */}
            <View className={`w-12 h-12 rounded-2xl items-center justify-center mr-4 ${
              selected ? 'bg-primary/10 border border-primary/20' : 'bg-slate-100 border border-slate-200'
            }`}>
              <Text className="text-2xl">{opt.icon}</Text>
            </View>

            {/* Content */}
            <View className="flex-1">
              <View className="flex-row items-center mb-1">
                <Text className={`font-bold text-base mr-2 ${selected ? 'text-slate-900' : 'text-slate-700'}`}>
                  {opt.label}
                </Text>
                <View className={`px-2 py-0.5 rounded-full border ${opt.badgeColor.split(' ').slice(0, 2).join(' ')}`}>
                  <Text className={`text-[10px] font-bold uppercase tracking-wider ${opt.badgeColor.split(' ')[2]}`}>
                    {opt.badge}
                  </Text>
                </View>
                {locked && (
                  <Text className="text-slate-500 text-xs ml-2">🔒</Text>
                )}
              </View>
              <Text className={`text-sm leading-5 font-medium ${selected ? 'text-slate-700' : 'text-slate-500'}`}>
                {opt.desc}
              </Text>
            </View>

            {/* Selection dot */}
            <View className="justify-center pl-2">
              <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
                selected ? 'border-primary' : 'border-slate-300'
              }`}>
                {selected && <View className="w-2.5 h-2.5 rounded-full bg-primary" />}
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

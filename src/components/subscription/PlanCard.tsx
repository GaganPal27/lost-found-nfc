import { View, Text, TouchableOpacity } from 'react-native';

interface PlanCardProps {
  id: 'basic' | 'pro' | 'max';
  name: string;
  price: string;
  period?: string;
  oneLiner: string;
  badges: string[];
  isPopular?: boolean;
  selected: boolean;
  onSelect: () => void;
}

const PLAN_STYLES: Record<string, { accent: string; glow: string; badge: string }> = {
  basic: { accent: 'border-slate-600',     glow: '',                              badge: 'bg-slate-700/60 text-slate-300' },
  pro:   { accent: 'border-cyan-500/60',   glow: 'shadow-cyan-500/20',            badge: 'bg-cyan-500/20 text-cyan-300'  },
  max:   { accent: 'border-purple-500/60', glow: 'shadow-purple-500/20',          badge: 'bg-purple-500/20 text-purple-300' },
};

export default function PlanCard({
  id, name, price, period = '/mo', oneLiner, badges, isPopular, selected, onSelect,
}: PlanCardProps) {
  const style = PLAN_STYLES[id] || PLAN_STYLES.basic;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onSelect}
      className={`rounded-3xl border p-5 mb-3 ${
        selected
          ? `bg-slate-800 ${style.accent}`
          : 'bg-darkCard border-darkBorder'
      }`}
      style={selected ? { shadowColor: id === 'pro' ? '#06b6d4' : id === 'max' ? '#a855f7' : '#334155', shadowOpacity: 0.25, shadowRadius: 16, elevation: 5 } : {}}
    >
      {/* Popular badge */}
      {isPopular && (
        <View className="absolute top-4 right-4 bg-primary px-3 py-1 rounded-full">
          <Text className="text-slate-900 text-[10px] font-bold uppercase tracking-widest">Most Popular</Text>
        </View>
      )}

      {/* Header */}
      <View className="flex-row justify-between items-start mb-3">
        <View>
          <Text className="text-white font-bold text-xl mb-0.5">{name}</Text>
          <Text className="text-slate-400 text-sm">{oneLiner}</Text>
        </View>
        <View className="items-end">
          <Text className="text-white font-bold text-2xl">{price}</Text>
          {price !== 'Free' && <Text className="text-slate-500 text-xs">{period}</Text>}
        </View>
      </View>

      {/* Divider */}
      <View className={`h-px mb-3 ${selected ? style.accent.replace('border-', 'bg-').split('/')[0] + '/20' : 'bg-slate-700'}`} />

      {/* Feature Badges */}
      <View className="flex-row flex-wrap gap-2">
        {badges.map((badge, idx) => (
          <View key={idx} className={`px-3 py-1 rounded-full ${selected ? style.badge.split(' ')[0] : 'bg-slate-700/60'}`}>
            <Text className={`text-xs font-medium ${selected ? style.badge.split(' ')[1] : 'text-slate-400'}`}>
              {badge}
            </Text>
          </View>
        ))}
      </View>

      {/* Selected indicator */}
      {selected && (
        <View className={`absolute top-4 left-4 w-2 h-2 rounded-full ${id === 'pro' ? 'bg-cyan-400' : id === 'max' ? 'bg-purple-400' : 'bg-slate-400'}`} />
      )}
    </TouchableOpacity>
  );
}

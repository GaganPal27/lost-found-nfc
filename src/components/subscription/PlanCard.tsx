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
  basic: { accent: 'border-slate-300',     glow: '',                              badge: 'bg-slate-100 text-slate-700' },
  pro:   { accent: 'border-blue-400',      glow: 'shadow-blue-500/20',            badge: 'bg-blue-100 text-blue-700'  },
  max:   { accent: 'border-red-400',       glow: 'shadow-red-500/20',             badge: 'bg-red-100 text-red-700' },
};

export default function PlanCard({
  id, name, price, period = '/mo', oneLiner, badges, isPopular, selected, onSelect,
}: PlanCardProps) {
  const style = PLAN_STYLES[id] || PLAN_STYLES.basic;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onSelect}
      className={`rounded-3xl border p-5 mb-3 shadow-sm ${
        selected
          ? `bg-slate-50 ${style.accent}`
          : 'bg-white border-slate-200'
      }`}
      style={selected ? { shadowColor: id === 'pro' ? '#3b82f6' : id === 'max' ? '#ef4444' : '#64748b', shadowOpacity: 0.15, shadowRadius: 12, elevation: 2 } : {}}
    >
      {/* Popular badge */}
      {isPopular && (
        <View className="absolute top-4 right-4 bg-primary px-3 py-1 rounded-full shadow-sm shadow-primary/20">
          <Text className="text-white text-[10px] font-bold uppercase tracking-widest">Most Popular</Text>
        </View>
      )}

      {/* Header */}
      <View className="flex-row justify-between items-start mb-3">
        <View>
          <Text className="text-slate-900 font-bold text-xl mb-0.5">{name}</Text>
          <Text className="text-slate-500 text-sm font-medium">{oneLiner}</Text>
        </View>
        <View className="items-end">
          <Text className="text-slate-900 font-bold text-2xl">{price}</Text>
          {price !== 'Free' && <Text className="text-slate-500 text-xs font-medium">{period}</Text>}
        </View>
      </View>

      {/* Divider */}
      <View className={`h-px mb-3 ${selected ? style.accent.replace('border-', 'bg-') + '/20' : 'bg-slate-100'}`} />

      {/* Feature Badges */}
      <View className="flex-row flex-wrap gap-2">
        {badges.map((badge, idx) => (
          <View key={idx} className={`px-3 py-1 rounded-full ${selected ? style.badge.split(' ')[0] : 'bg-slate-100'}`}>
            <Text className={`text-xs font-bold ${selected ? style.badge.split(' ')[1] : 'text-slate-500'}`}>
              {badge}
            </Text>
          </View>
        ))}
      </View>

      {/* Selected indicator */}
      {selected && (
        <View className={`absolute top-4 left-4 w-2 h-2 rounded-full ${id === 'pro' ? 'bg-blue-500' : id === 'max' ? 'bg-red-500' : 'bg-slate-400'}`} />
      )}
    </TouchableOpacity>
  );
}

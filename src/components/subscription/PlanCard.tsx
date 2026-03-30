import { View, Text, TouchableOpacity } from 'react-native';

interface PlanCardProps {
  id: 'basic' | 'pro' | 'max';
  name: string;
  price: string;
  oneLiner: string;
  badges: string[];
  isPopular?: boolean;
  selected: boolean;
  onSelect: () => void;
}

export default function PlanCard({
  name,
  price,
  oneLiner,
  badges,
  isPopular,
  selected,
  onSelect,
}: PlanCardProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onSelect}
      className={`p-4 rounded-xl border-2 mb-3 ${
        selected ? 'border-primary bg-teal-50' : 'border-gray-200 bg-white'
      }`}
    >
      {isPopular && (
        <View className="absolute top-0 right-0 bg-primary px-3 py-1 rounded-bl-xl rounded-tr-xl">
          <Text className="text-white text-xs font-bold uppercase tracking-wider">
            Most Popular
          </Text>
        </View>
      )}

      <View className="flex-row justify-between items-center mb-2">
        <Text className="text-2xl font-bold text-gray-900">{name}</Text>
        <Text className="text-lg font-semibold text-gray-700">{price}</Text>
      </View>

      <Text className="text-gray-600 mb-4">{oneLiner}</Text>

      <View className="flex-row flex-wrap gap-2">
        {badges.map((badge, idx) => (
          <View key={idx} className="bg-gray-100 px-3 py-1 rounded-full">
            <Text className="text-xs text-gray-700 font-medium">{badge}</Text>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );
}

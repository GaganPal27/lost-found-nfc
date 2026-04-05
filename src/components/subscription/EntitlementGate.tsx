import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

interface Props {
  requiredTier: 'pro' | 'max';
  featureName: string;
  children: React.ReactNode;
}

import { useSubscriptionStore } from '../../stores/subscriptionStore';

export default function EntitlementGate({ requiredTier, featureName, children }: Props) {
  const { tier } = useSubscriptionStore();
  const router = useRouter();

  const tierRank: Record<string, number> = { basic: 0, pro: 1, max: 2 };
  const hasAccess = tierRank[tier] >= tierRank[requiredTier];

  if (hasAccess) return <>{children}</>;

  const isPro = requiredTier === 'pro';
  const accentClass = isPro ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-purple-500/30 bg-purple-500/5';
  const badgeClass = isPro ? 'bg-cyan-500/20 text-cyan-300' : 'bg-purple-500/20 text-purple-300';
  const btnClass = isPro ? 'bg-cyan-500/15 border-cyan-500/30' : 'bg-purple-500/15 border-purple-500/30';
  const btnTextClass = isPro ? 'text-cyan-400' : 'text-purple-400';

  return (
    <View className={`rounded-3xl border p-5 mb-4 ${accentClass}`}>
      <View className="flex-row items-center mb-3">
        <Text className="text-2xl mr-3">🔒</Text>
        <View>
          <Text className="text-white font-bold text-base">{featureName}</Text>
          <View className={`self-start px-2 py-0.5 rounded-full mt-1 ${badgeClass.split(' ')[0]}`}>
            <Text className={`font-bold text-[10px] uppercase tracking-widest ${badgeClass.split(' ')[1]}`}>
              {requiredTier.toUpperCase()} FEATURE
            </Text>
          </View>
        </View>
      </View>

      <Text className="text-slate-400 text-sm leading-5 mb-4">
        Upgrade to <Text className="font-bold text-white">{requiredTier.toUpperCase()}</Text> to unlock {featureName.toLowerCase()} and {isPro ? 'passive BLE tracking, extended scan history, and more' : 'unlimited items, live location sharing, and total protection'}.
      </Text>

      <TouchableOpacity
        onPress={() => router.push('/subscription')}
        className={`border rounded-2xl py-3 items-center ${btnClass}`}
        activeOpacity={0.7}
      >
        <Text className={`font-bold text-sm tracking-wide ${btnTextClass}`}>
          ⬆ Upgrade to {requiredTier.toUpperCase()} →
        </Text>
      </TouchableOpacity>
    </View>
  );
}

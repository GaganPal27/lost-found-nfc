import { ReactNode } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSubscriptionStore } from '../../stores/subscriptionStore';
import type { SubscriptionTier } from '../../lib/revenuecat';

// Helpers to rank tiers
const TIER_RANK = { basic: 0, pro: 1, max: 2 };

interface EntitlementGateProps {
  requiredTier: 'pro' | 'max';
  featureName: string;
  children: ReactNode;
}

export default function EntitlementGate({ requiredTier, featureName, children }: EntitlementGateProps) {
  const { tier, initialized } = useSubscriptionStore();
  const router = useRouter();

  if (!initialized) return null;

  const hasAccess = TIER_RANK[tier] >= TIER_RANK[requiredTier];

  if (hasAccess) {
    return <>{children}</>;
  }

  return (
    <View className="bg-gray-50 border border-gray-200 p-6 rounded-xl items-center">
      <View className="bg-gray-200 w-12 h-12 rounded-full items-center justify-center mb-4">
        {/* Lock icon placeholder */}
        <Text className="text-2xl">🔒</Text>
      </View>
      <Text className="text-lg font-bold text-gray-900 mb-2 text-center">
        {featureName}
      </Text>
      <Text className="text-gray-600 text-center mb-6">
        Upgrade to {requiredTier === 'pro' ? 'Pro' : 'Max'} to unlock this feature and many more.
      </Text>
      <TouchableOpacity
        className="bg-primary px-6 py-3 rounded-xl w-full"
        onPress={() => router.push('/subscription')}
      >
        <Text className="text-white font-semibold text-center text-lg">
          Upgrade Now
        </Text>
      </TouchableOpacity>
    </View>
  );
}

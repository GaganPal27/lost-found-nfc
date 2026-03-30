import { View } from 'react-native';
import PlanCard from './PlanCard';
import { PLAN_LIMITS } from '../../lib/constants';
import type { SubscriptionTier } from '../../lib/revenuecat';

interface PlanSelectorProps {
  selectedTier: SubscriptionTier;
  onSelectTier: (tier: SubscriptionTier) => void;
}

export default function PlanSelector({ selectedTier, onSelectTier }: PlanSelectorProps) {
  return (
    <View className="w-full">
      <PlanCard
        id="basic"
        name="Basic"
        price={PLAN_LIMITS.basic.price}
        oneLiner={PLAN_LIMITS.basic.oneLiner}
        badges={[...PLAN_LIMITS.basic.badges]}
        selected={selectedTier === 'basic'}
        onSelect={() => onSelectTier('basic')}
      />
      <PlanCard
        id="pro"
        name="Pro"
        price={PLAN_LIMITS.pro.price}
        oneLiner={PLAN_LIMITS.pro.oneLiner}
        badges={[...PLAN_LIMITS.pro.badges]}
        isPopular={PLAN_LIMITS.pro.mostPopular}
        selected={selectedTier === 'pro'}
        onSelect={() => onSelectTier('pro')}
      />
      <PlanCard
        id="max"
        name="Max"
        price={PLAN_LIMITS.max.price}
        oneLiner={PLAN_LIMITS.max.oneLiner}
        badges={[...PLAN_LIMITS.max.badges]}
        selected={selectedTier === 'max'}
        onSelect={() => onSelectTier('max')}
      />
    </View>
  );
}

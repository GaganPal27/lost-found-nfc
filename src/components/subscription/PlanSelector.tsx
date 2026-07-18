import { View } from 'react-native';
import PlanCard from './PlanCard';
import { SubscriptionTier } from '../../stores/subscriptionStore';

const PLANS = [
  {
    id: 'basic' as SubscriptionTier,
    name: 'Basic',
    price: 'Free',
    oneLiner: 'Get started with essentials',
    badges: ['5 items', 'NFC only', '7-day history'],
    isPopular: false,
  },
  {
    id: 'pro' as SubscriptionTier,
    name: 'Premium',
    price: '$2.99',
    oneLiner: 'NFC stickers & unlimited protection',
    badges: ['Unlimited items', 'NFC Stickers', '30-day history'],
    isPopular: true,
  },
];

interface Props {
  selectedTier: SubscriptionTier;
  onSelectTier: (t: SubscriptionTier) => void;
}

export default function PlanSelector({ selectedTier, onSelectTier }: Props) {
  return (
    <View>
      {PLANS.map(plan => (
        <PlanCard
          key={plan.id}
          {...plan}
          selected={selectedTier === plan.id}
          onSelect={() => onSelectTier(plan.id)}
        />
      ))}
    </View>
  );
}

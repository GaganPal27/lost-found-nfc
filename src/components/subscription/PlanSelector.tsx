import { View } from 'react-native';
import PlanCard from './PlanCard';
import { SubscriptionTier } from '../../stores/subscriptionStore';

const PLANS = [
  {
    id: 'basic' as SubscriptionTier,
    name: 'Basic',
    price: 'Free',
    oneLiner: 'Get started with essentials',
    badges: ['2 items', 'NFC only', '7-day history'],
    isPopular: false,
  },
  {
    id: 'pro' as SubscriptionTier,
    name: 'Pro',
    price: '$4.99',
    oneLiner: 'For the frequent traveller',
    badges: ['10 items', 'NFC + BLE', '30-day history', 'Passive tracking'],
    isPopular: true,
  },
  {
    id: 'max' as SubscriptionTier,
    name: 'Max',
    price: '$9.99',
    oneLiner: 'Ultimate protection',
    badges: ['Unlimited items', 'All tag types', '90-day history', 'Live location'],
    isPopular: false,
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

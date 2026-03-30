import { create } from 'zustand';
import { SubscriptionTier, getCurrentEntitlement } from '../lib/revenuecat';

interface SubscriptionState {
  tier: SubscriptionTier;
  initialized: boolean;
  refreshTier: () => Promise<void>;
  setTier: (tier: SubscriptionTier) => void;
}

export const useSubscriptionStore = create<SubscriptionState>((set) => ({
  tier: 'basic',
  initialized: false,
  refreshTier: async () => {
    const tier = await getCurrentEntitlement();
    set({ tier, initialized: true });
  },
  setTier: (tier) => set({ tier, initialized: true }),
}));

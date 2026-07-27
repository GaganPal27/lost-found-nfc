import { create } from 'zustand';

export type SubscriptionTier = 'basic' | 'pro' | 'max';

interface SubscriptionState {
  tier: SubscriptionTier;
  initialized: boolean;
  refreshTier: () => Promise<void>;
  setTier: (tier: SubscriptionTier) => void;
}

import { useAuthStore } from './authStore';

// Raw RevenueCat entitlement fetch — no admin check, safe to call in parallel
// with the session/role lookup instead of waiting for it to finish first.
export async function getRawEntitlementTier(): Promise<SubscriptionTier> {
  try {
    // RevenueCat only works on native (iOS/Android)
    // On web or when not configured, it will throw — we catch and return 'basic'
    const { getCurrentEntitlement } = await import('../lib/revenuecat');
    return await getCurrentEntitlement();
  } catch {
    return 'basic';
  }
}

// Safe tier refresh — works on web (no RevenueCat) and on native (with RevenueCat)
async function safGetTier(): Promise<SubscriptionTier> {
  // Implicitly grant Max tier to all admins
  if (useAuthStore.getState().isAdmin) {
    return 'max';
  }
  return getRawEntitlementTier();
}

export const useSubscriptionStore = create<SubscriptionState>((set) => ({
  tier: 'basic',
  initialized: false,
  refreshTier: async () => {
    const tier = await safGetTier();
    set({ tier, initialized: true });
  },
  setTier: (tier) => set({ tier, initialized: true }),
}));

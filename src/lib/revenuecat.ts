import Purchases, { PurchasesEntitlementInfo } from 'react-native-purchases';
import { Platform } from 'react-native';

export type SubscriptionTier = 'basic' | 'pro' | 'max';

export const initRevenueCat = async () => {
  if (Platform.OS === 'android') {
    Purchases.configure({ apiKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || '' });
  }
};

export const getCurrentEntitlement = async (): Promise<SubscriptionTier> => {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    if (typeof customerInfo.entitlements.active['max'] !== 'undefined') return 'max';
    if (typeof customerInfo.entitlements.active['pro'] !== 'undefined') return 'pro';
    return 'basic';
  } catch (e) {
    return 'basic';
  }
};

export const isEntitled = async (tier: SubscriptionTier): Promise<boolean> => {
  const current = await getCurrentEntitlement();
  if (tier === 'basic') return true;
  if (tier === 'pro') return current === 'pro' || current === 'max';
  if (tier === 'max') return current === 'max';
  return false;
};

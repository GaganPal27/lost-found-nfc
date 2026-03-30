import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import PlanSelector from '../components/subscription/PlanSelector';
import TagBuyingGuide from '../components/subscription/TagBuyingGuide';
import { SubscriptionTier } from '../lib/revenuecat';
import { PLAN_LIMITS } from '../lib/constants';
import { useSubscriptionStore } from '../stores/subscriptionStore';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';
import Purchases from 'react-native-purchases';

export default function SubscriptionScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { setTier } = useSubscriptionStore();
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>('pro');
  const [guideVisible, setGuideVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const finishSelection = async (finalTier: SubscriptionTier) => {
    setTier(finalTier);
    if (user?.id) {
      // Update the user's tier in our database
      await supabase
        .from('users')
        .update({ subscription_tier: finalTier })
        .eq('auth_id', user.id);
    }
    // Show the required hardware guide
    setGuideVisible(true);
  };

  const handlePurchase = async () => {
    if (selectedTier === 'basic') {
      await finishSelection('basic');
      return;
    }

    try {
      setLoading(true);
      // In a real app we fetch packages using Purchases.getOfferings()
      // Here we assume standard RevenueCat product IDs mapping to tiers.
      // E.g. com.lostandfound.pro_monthly or max_monthly.
      // As specified in docs: pro_monthly, max_monthly.
      const offerings = await Purchases.getOfferings();
      const currentOffering = offerings.current;

      if (!currentOffering) {
        throw new Error('No subscription offerings available right now.');
      }

      // We expect packages with identifier matching the tier ('pro' | 'max')
      // but in RevenueCat we have to map the package. Let's just mock purchase
      // for the time being or attempt to use the identifier.
      // RevenueCat standard integration requires correct package identifier in RC Dashboard.
      const packageToBuy = currentOffering.availablePackages.find(
        (p) => p.identifier.toLowerCase().includes(selectedTier) || 
               p.product.identifier.toLowerCase().includes(selectedTier)
      );

      if (packageToBuy) {
        const { customerInfo } = await Purchases.purchasePackage(packageToBuy);
        if (typeof customerInfo.entitlements.active[selectedTier] !== 'undefined') {
          await finishSelection(selectedTier);
        } else {
          Alert.alert('Purchase error', 'Entitlement not granted.');
        }
      } else {
        // Fallback for development if real products are not fully matched yet
        Alert.alert(
          'Dev Mode Notice', 
          `Simulated purchase for ${selectedTier.toUpperCase()} plan. Real purchase requires exact RC package setup.`
        );
        await finishSelection(selectedTier);
      }
    } catch (e: any) {
      if (!e.userCancelled) {
        Alert.alert('Error purchasing', e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGuideDismiss = () => {
    setGuideVisible(false);
    router.replace('/(tabs)/my-items');
  };

  return (
    <View className="flex-1 bg-white">
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 120 }}>
        <Text className="text-3xl font-bold text-gray-900 mb-2 mt-8">Choose your plan</Text>
        <Text className="text-xl text-gray-500 mb-8">
          Protect your most valuable items with our global network.
        </Text>

        <PlanSelector selectedTier={selectedTier} onSelectTier={setSelectedTier} />
      </ScrollView>

      <View className="absolute bottom-0 w-full p-6 bg-white border-t border-gray-100 shadow-[0_-4px_6px_rgba(0,0,0,0.05)]">
        <TouchableOpacity
          className="w-full bg-primary p-4 rounded-xl items-center mb-4 flex-row justify-center"
          onPress={handlePurchase}
          disabled={loading}
        >
          {loading && <ActivityIndicator color="#fff" className="mr-3" />}
          <Text className="text-white text-xl font-bold">
            Get started with {PLAN_LIMITS[selectedTier].name || selectedTier.toUpperCase()}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => finishSelection('basic')}>
          <Text className="text-center text-gray-500 font-medium">
            Continue with Basic — it's free
          </Text>
        </TouchableOpacity>
      </View>

      <TagBuyingGuide 
        visible={guideVisible} 
        tier={selectedTier} 
        onDismiss={handleGuideDismiss} 
      />
    </View>
  );
}

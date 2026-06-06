import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import PlanSelector from '../components/subscription/PlanSelector';
import TagBuyingGuide from '../components/subscription/TagBuyingGuide';
import { SubscriptionTier } from '../stores/subscriptionStore';
import { PLAN_LIMITS } from '../lib/constants';
import { useSubscriptionStore } from '../stores/subscriptionStore';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';
import Purchases from 'react-native-purchases';

const PLAN_PERKS = {
  basic:  { price: 'Free', color: 'text-slate-500', desc: 'Perfect for getting started' },
  pro:    { price: '$4.99/mo', color: 'text-blue-600', desc: 'For the frequent traveller' },
  max:    { price: '$9.99/mo', color: 'text-red-600', desc: 'Ultimate protection' },
};

export default function SubscriptionScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { tier: currentTier, setTier } = useSubscriptionStore();
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>('pro');
  const [guideVisible, setGuideVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const finishSelection = async (finalTier: SubscriptionTier) => {
    setTier(finalTier);
    if (user?.id) {
      await supabase.from('users').update({ subscription_tier: finalTier }).eq('auth_id', user.id);
    }
    setGuideVisible(true);
  };

  const handlePurchase = async () => {
    if (selectedTier === 'basic') { await finishSelection('basic'); return; }
    try {
      setLoading(true);
      const offerings = await Purchases.getOfferings();
      const currentOffering = offerings.current;
      if (!currentOffering) throw new Error('No subscription offerings available right now.');
      const packageToBuy = currentOffering.availablePackages.find(
        p => p.identifier.toLowerCase().includes(selectedTier) || p.product.identifier.toLowerCase().includes(selectedTier)
      );
      if (packageToBuy) {
        const { customerInfo } = await Purchases.purchasePackage(packageToBuy);
        if (typeof customerInfo.entitlements.active[selectedTier] !== 'undefined') {
          await finishSelection(selectedTier);
        } else {
          Alert.alert('Purchase error', 'Entitlement not granted.');
        }
      } else {
        Alert.alert('Dev Mode', `Simulated purchase for ${selectedTier.toUpperCase()} plan.`);
        await finishSelection(selectedTier);
      }
    } catch (e: any) {
      if (!e.userCancelled) Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGuideDismiss = () => { setGuideVisible(false); router.replace('/(tabs)/my-items'); };

  const selectedPerk = PLAN_PERKS[selectedTier as keyof typeof PLAN_PERKS];

  return (
    <View className="flex-1 bg-slate-50">
      <StatusBar barStyle="dark-content" />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 180, paddingTop: 60 }}>
        {/* Back */}
        <TouchableOpacity onPress={() => router.back()} className="mb-6 flex-row items-center" activeOpacity={0.7}>
          <Text className="text-primary text-lg mr-1">←</Text>
          <Text className="text-primary font-semibold">Back</Text>
        </TouchableOpacity>

        {/* Header */}
        <Text className="text-slate-500 text-xs uppercase tracking-widest mb-2 font-bold">Plans</Text>
        <Text className="text-slate-900 text-4xl font-black mb-2">Choose your{'\n'}protection level</Text>
        <Text className="text-slate-600 text-base mb-8 leading-6 font-medium">
          Protect your most valuable items with{'\n'}the Lost & Found global network.
        </Text>

        {/* Current plan badge */}
        {currentTier !== 'basic' && (
          <View className="bg-primary/10 border border-primary/20 rounded-2xl px-4 py-3 mb-6 flex-row items-center">
            <View className="w-2 h-2 rounded-full bg-primary mr-3" />
            <Text className="text-primary font-bold text-sm">
              Currently on <Text className="font-black uppercase">{currentTier}</Text> plan
            </Text>
          </View>
        )}

        {/* Plan Cards */}
        <PlanSelector selectedTier={selectedTier} onSelectTier={setSelectedTier} />

        {/* Feature Comparison */}
        <View className="bg-white border border-slate-200 rounded-3xl p-5 mt-6 shadow-sm">
          <Text className="text-slate-500 text-xs uppercase tracking-wider mb-4 font-bold">What's included</Text>
          {[
            { feature: 'Items protected', basic: '5', pro: '15', max: '∞' },
            { feature: 'Tag types', basic: 'NFC', pro: 'BLE', max: 'All types' },
            { feature: 'Scan history', basic: '7 days', pro: '30 days', max: '90 days' },
            { feature: 'Passive BLE tracking', basic: '✕', pro: '✓', max: '✓' },
            { feature: 'Live location share', basic: '✕', pro: '✕', max: '✓' },
          ].map((row, i) => (
            <View key={i} className={`flex-row items-center py-3 ${i !== 4 ? 'border-b border-slate-100' : ''}`}>
              <Text className="text-slate-600 text-sm flex-1 font-medium">{row.feature}</Text>
              <Text className={`text-xs font-bold w-16 text-center ${selectedTier === 'basic' ? 'text-slate-900' : 'text-slate-400'}`}>{row.basic}</Text>
              <Text className={`text-xs font-bold w-16 text-center ${selectedTier === 'pro' ? 'text-blue-600' : 'text-slate-400'}`}>{row.pro}</Text>
              <Text className={`text-xs font-bold w-16 text-center ${selectedTier === 'max' ? 'text-red-600' : 'text-slate-400'}`}>{row.max}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View className="absolute bottom-0 w-full bg-white border-t border-slate-200 px-6 pt-4 shadow-lg" style={{ paddingBottom: 100 }}>
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-slate-900 font-bold text-base capitalize">{selectedTier} Plan</Text>
          <Text className={`font-bold text-lg ${selectedPerk?.color}`}>{selectedPerk?.price}</Text>
        </View>

        <TouchableOpacity
          className={`w-full bg-primary py-4 rounded-2xl items-center flex-row justify-center mb-3 shadow-md shadow-primary/30 ${loading ? 'opacity-60' : ''}`}
          onPress={handlePurchase}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading && <ActivityIndicator color="#ffffff" className="mr-3" />}
          <Text className="text-white font-bold text-lg">
            {selectedTier === 'basic' ? 'Continue with Basic — Free' : `Get ${selectedTier.toUpperCase()}`}
          </Text>
        </TouchableOpacity>

        {selectedTier !== 'basic' && (
          <TouchableOpacity onPress={() => finishSelection('basic')} activeOpacity={0.7}>
            <Text className="text-slate-500 text-center text-sm">Continue with Basic — it's free</Text>
          </TouchableOpacity>
        )}
      </View>

      <TagBuyingGuide visible={guideVisible} tier={selectedTier} onDismiss={handleGuideDismiss} />
    </View>
  );
}

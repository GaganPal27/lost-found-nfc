import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, StatusBar, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import PlanSelector from '../components/subscription/PlanSelector';
import TagBuyingGuide from '../components/subscription/TagBuyingGuide';
import { SubscriptionTier } from '../stores/subscriptionStore';
import { useSubscriptionStore } from '../stores/subscriptionStore';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';
import Purchases from 'react-native-purchases';
import { Feather } from '@expo/vector-icons';

const PLAN_PERKS = {
  basic:  { price: 'Free', color: '#64748b' },
  pro:    { price: '$2.99/mo', color: '#6366f1' },
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
    if (user?.id) await supabase.from('users').update({ subscription_tier: finalTier }).eq('auth_id', user.id);
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
        if (typeof customerInfo.entitlements.active[selectedTier] !== 'undefined') await finishSelection(selectedTier);
        else Alert.alert('Purchase error', 'Entitlement not granted.');
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

  const selectedPerk = PLAN_PERKS[selectedTier as keyof typeof PLAN_PERKS];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8faff" />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={20} color="#6366f1" />
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.eyebrow}>Plans</Text>
        <Text style={styles.title}>Choose your{'\n'}protection level</Text>
        <Text style={styles.subtitle}>Protect your most valuable items with{'\n'}the Lost & Found global network.</Text>

        {currentTier !== 'basic' && (
          <View style={styles.currentPlanBadge}>
            <View style={styles.currentPlanDot} />
            <Text style={styles.currentPlanText}>
              Currently on <Text style={{fontWeight: '900', textTransform: 'uppercase'}}>{currentTier}</Text> plan
            </Text>
          </View>
        )}

        <PlanSelector selectedTier={selectedTier} onSelectTier={setSelectedTier} />

        <View style={styles.compareCard}>
          <Text style={styles.compareTitle}>What's included</Text>
          {[
            { feature: 'Items protected', basic: '5', pro: 'Unlimited' },
            { feature: 'Tag types', basic: 'Digital only', pro: 'NFC Stickers' },
            { feature: 'Scan history', basic: '7 days', pro: '30 days' },
          ].map((row, i) => (
            <View key={i} style={[styles.compareRow, i === 2 && { borderBottomWidth: 0 }]}>
              <Text style={styles.compareFeature}>{row.feature}</Text>
              <Text style={[styles.compareValue, selectedTier === 'basic' ? { color: '#0f172a' } : { color: '#94a3b8' }]}>{row.basic}</Text>
              <Text style={[styles.compareValue, selectedTier === 'pro' ? { color: '#6366f1' } : { color: '#94a3b8' }]}>{row.pro}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <View style={styles.bottomBarTop}>
          <Text style={styles.bottomBarTitle}>{selectedTier} Plan</Text>
          <Text style={[styles.bottomBarPrice, { color: selectedPerk?.color }]}>{selectedPerk?.price}</Text>
        </View>

        <TouchableOpacity onPress={handlePurchase} disabled={loading} activeOpacity={0.88} style={styles.purchaseBtnWrap}>
          <LinearGradient colors={loading ? ['#a5b4fc', '#c4b5fd'] : ['#6366f1', '#7c3aed']} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.purchaseBtn}>
            {loading && <ActivityIndicator color="#ffffff" style={{marginRight: 10}} />}
            <Text style={styles.purchaseBtnText}>
              {selectedTier === 'basic' ? 'Continue with Basic — Free' : `Get ${selectedTier.toUpperCase()}`}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {selectedTier !== 'basic' && (
          <TouchableOpacity onPress={() => finishSelection('basic')} activeOpacity={0.7} style={styles.basicLink}>
            <Text style={styles.basicLinkText}>Continue with Basic — it's free</Text>
          </TouchableOpacity>
        )}
      </View>

      <TagBuyingGuide visible={guideVisible} tier={selectedTier} onDismiss={() => { setGuideVisible(false); router.replace('/(tabs)/my-items'); }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8faff' },
  scrollContent: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 220 },
  
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, alignSelf: 'flex-start' },
  backBtnText: { color: '#6366f1', fontSize: 16, fontWeight: '700', marginLeft: 6 },
  
  eyebrow: { color: '#94a3b8', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 },
  title: { color: '#0f172a', fontSize: 32, fontWeight: '900', letterSpacing: -0.5, marginBottom: 12 },
  subtitle: { color: '#64748b', fontSize: 15, fontWeight: '500', lineHeight: 22, marginBottom: 32 },

  currentPlanBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eef2ff', borderWidth: 1, borderColor: '#c7d2fe', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, marginBottom: 24 },
  currentPlanDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#6366f1', marginRight: 12 },
  currentPlanText: { color: '#6366f1', fontSize: 14, fontWeight: '700' },

  compareCard: { backgroundColor: '#ffffff', borderRadius: 24, padding: 24, marginTop: 24, shadowColor: '#6366f1', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 3, borderWidth: 1, borderColor: '#f1f5f9' },
  compareTitle: { color: '#94a3b8', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 },
  compareRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  compareFeature: { flex: 1, color: '#475569', fontSize: 14, fontWeight: '600' },
  compareValue: { width: 80, textAlign: 'center', fontSize: 12, fontWeight: '800' },

  bottomBar: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20, shadowOffset: { width: 0, height: -10 }, elevation: 20 },
  bottomBarTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  bottomBarTitle: { color: '#0f172a', fontSize: 18, fontWeight: '900', textTransform: 'capitalize' },
  bottomBarPrice: { fontSize: 20, fontWeight: '900' },
  
  purchaseBtnWrap: { borderRadius: 18, overflow: 'hidden', shadowColor: '#6366f1', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4, marginBottom: 12 },
  purchaseBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18 },
  purchaseBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  
  basicLink: { alignItems: 'center', paddingVertical: 8 },
  basicLinkText: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
});

import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { initRevenueCat } from '../lib/revenuecat';
import { useSubscriptionStore } from '../stores/subscriptionStore';
import { startBLEScanning, stopBLEScanning } from '../lib/ble';
import '../../global.css';

export default function RootLayout() {
  const { session, initialized: authInitialized, setSession } = useAuthStore();
  const { refreshTier, initialized: subInitialized, tier } = useSubscriptionStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    initRevenueCat();
    refreshTier();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (subInitialized) {
      if (tier === 'pro' || tier === 'max') {
        startBLEScanning();
      } else {
        stopBLEScanning();
      }
    }
  }, [tier, subInitialized]);

  useEffect(() => {
    if (!authInitialized || !subInitialized) return;

    const inAuthGroup = segments[0] === 'login';
    
    if (!session && !inAuthGroup && segments[0] !== 'item') {
      router.replace('/login');
    } else if (session && inAuthGroup) {
      router.replace('/');
    }
  }, [session, authInitialized, subInitialized, segments]);

  return <Slot />;
}

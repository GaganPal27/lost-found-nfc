import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { useSubscriptionStore } from '../stores/subscriptionStore';
import '../../global.css';

// Safe wrappers for native-only SDKs (no-op on web)
const safeInitRevenueCat = async () => {
  try { const { initRevenueCat } = await import('../lib/revenuecat'); await initRevenueCat(); } catch {}
};
const safeStartBLE = async () => {
  try { const { startBLEScanning } = await import('../lib/ble'); startBLEScanning(); } catch {}
};
const safeStopBLE = async () => {
  try { const { stopBLEScanning } = await import('../lib/ble'); stopBLEScanning(); } catch {}
};

export default function RootLayout() {
  const { session, initialized: authInitialized, setSession } = useAuthStore();
  const { refreshTier, initialized: subInitialized, tier } = useSubscriptionStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    safeInitRevenueCat();
    refreshTier();

    supabase.auth.getSession().then(({ data: { session } }: { data: { session: any } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (subInitialized) {
      if (tier === 'pro' || tier === 'max') {
        safeStartBLE();
      } else {
        safeStopBLE();
      }
    }
  }, [tier, subInitialized]);

  useEffect(() => {
    if (!authInitialized || !subInitialized) return;

    // Routes accessible without authentication
    const publicRoutes = ['login', 'registration', 'forgot-password', 'item'];
    const inPublicRoute = publicRoutes.includes(segments[0] as string);
    const inAuthScreen = publicRoutes.slice(0, 3).includes(segments[0] as string);

    if (!session && !inPublicRoute) {
      router.replace('/login');
    } else if (session && inAuthScreen) {
      router.replace('/');
    }
  }, [session, authInitialized, subInitialized, segments]);

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <Slot />
    </>
  );
}

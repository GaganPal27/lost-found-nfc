import { useEffect, useRef } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar, Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { useSubscriptionStore } from '../stores/subscriptionStore';
import '../../global.css';

const safeRegisterPushToken = async (userId: string) => {
  try {
    const { default: Notifications } = await import('expo-notifications');
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    await supabase.from('push_tokens').upsert(
      { user_id: userId, token, platform: Platform.OS },
      { onConflict: 'user_id,token' }
    );
  } catch (e) {
    console.warn('Push token registration failed:', e);
  }
};

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
  const notifListenerRef = useRef<any>(null);

  useEffect(() => {
    safeInitRevenueCat();

    supabase.auth.getSession().then(async ({ data: { session } }: { data: { session: any } }) => {
      await setSession(session);
      await refreshTier();
      if (session?.user?.id) safeRegisterPushToken(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event: any, session: any) => {
      await setSession(session);
      await refreshTier();
      if (session?.user?.id) safeRegisterPushToken(session.user.id);
    });

    // Navigate to conversation when user taps a push notification
    const setupNotifListener = async () => {
      try {
        const { default: Notifications } = await import('expo-notifications');
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: true,
          }),
        });
        notifListenerRef.current = Notifications.addNotificationResponseReceivedListener((response) => {
          const convId = response.notification.request.content.data?.conversation_id;
          if (convId) router.push(`/conversation/${convId}`);
        });
      } catch {}
    };
    setupNotifListener();

    return () => {
      subscription.unsubscribe();
      if (notifListenerRef.current) notifListenerRef.current.remove();
    };
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
    const publicRoutes = ['login', 'registration', 'forgot-password', 'item', 'terms-of-service', 'finder-connect'];
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

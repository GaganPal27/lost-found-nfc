import { useEffect, useRef, useState } from 'react';
import { Slot, Stack, useRouter, useSegments, usePathname } from 'expo-router';
import { StatusBar, Platform, AppState, AppStateStatus, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { useSubscriptionStore } from '../stores/subscriptionStore';
import { updateUserLocation } from '../lib/location';
import BubbleNotification, { BubbleNotificationData } from '../components/BubbleNotification';
import FloatingTabBar, { TAB_ROUTES } from '../components/FloatingTabBar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import '../../global.css';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  debug: false,
});

const safeRegisterPushToken = async (userId: string) => {
  try {
    const { default: Notifications } = await import('expo-notifications');
    const { default: Device } = await import('expo-device');

    // Physical device required — emulators/simulators cannot receive push notifications
    if (!Device.isDevice) {
      console.log('Push notifications require a physical device.');
      return;
    }

    // Request permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Push notification permission denied.');
      return;
    }

    // Get the Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    // Save token to users table (our 010_push_tokens.sql migration)
    const { error } = await supabase
      .from('users')
      .update({
        expo_push_token: token,
        push_notifications_enabled: true,
        push_token_updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) console.warn('Failed to save push token:', error.message);
    else console.log('Push token saved successfully.');
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

function RootLayout() {
  const { session, initialized: authInitialized, setSession } = useAuthStore();
  const { refreshTier, initialized: subInitialized, tier } = useSubscriptionStore();
  const segments = useSegments();
  const router = useRouter();
  const notifListenerRef = useRef<any>(null);
  
  const pathname = usePathname(); // We need usePathname to determine the active route

  
  // Bubbles state
  const [bubbles, setBubbles] = useState<BubbleNotificationData[]>([]);
  
  // AppState for location
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    safeInitRevenueCat();

    supabase.auth.getSession().then(async ({ data: { session } }: { data: { session: any } }) => {
      await setSession(session);
      await refreshTier();
      if (session?.user?.id) safeRegisterPushToken(session.user.id);
    }).catch(async (err) => {
      console.warn("Auth initialization failed:", err);
      // Force initialization so the app doesn't spin forever
      await setSession(null);
      await refreshTier();
    });

    // Guard: only call setSession when the session actually changes
    let lastSessionId: string | null = null;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event: any, session: any) => {
      const newId = session?.user?.id ?? null;
      if (newId === lastSessionId) return; // Avoid redundant fetches
      lastSessionId = newId;
      await setSession(session);
      await refreshTier();
      if (session?.user?.id) safeRegisterPushToken(session.user.id);
    });

    // ── Android Notification Channel (must exist before any notification arrives) ──
    // This MUST run before setupNotifListener so the channel is ready.
    // channelId 'default' matches what the edge function sends in the push payload.
    const setupAndroidChannel = async () => {
      if (Platform.OS !== 'android') return;
      try {
        const { default: Notifications } = await import('expo-notifications');
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Lost & Found Alerts',
          importance: Notifications.AndroidImportance.MAX,  // Pops over other apps, plays sound
          vibrationPattern: [0, 250, 150, 250],             // Buzz-pause-buzz pattern
          lightColor: '#6366F1',                            // Indigo LED flash (on supported devices)
          sound: 'default',
          enableVibrate: true,
          showBadge: true,
        });
      } catch (e) {
        console.warn('Failed to set Android notification channel:', e);
      }
    };
    setupAndroidChannel();

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
          const data = response.notification.request.content.data ?? {};

          // 1. Chat message → open conversation
          if (data.conversation_id) {
            router.push(`/conversation/${data.conversation_id}`);
            return;
          }

          // 2. Lost item nearby alert → open Community, auto-switch to Lost tab
          //    (edge function sends: { route: '/(tabs)/community', tab: 'lost', item_id: '...' })
          if (data.route === '/(tabs)/community') {
            const validTabs = ['found', 'lost', 'groups'];
            const tab = validTabs.includes(data.tab) ? data.tab : 'lost';
            router.push({ pathname: '/(tabs)/community', params: { tab } });
            return;
          }

          // 3. Group join approved → open the group chat
          if (data.group_id) {
            router.push(`/group/${data.group_id}`);
            return;
          }
        });
      } catch {}
    };
    setupNotifListener();


    // AppState listener for location updates on foreground
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        const currentSession = await supabase.auth.getSession();
        const uid = currentSession.data.session?.user?.id;
        // Fire in background — never await, never block UI
        if (uid) updateUserLocation(uid).catch(() => {});
      }
      appState.current = nextAppState;
    };
    const appStateSub = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.unsubscribe();
      if (notifListenerRef.current) notifListenerRef.current.remove();
      appStateSub.remove();
    };
  }, []);

  // Set up Supabase realtime for in-app bubbles
  useEffect(() => {
    if (!session?.user?.id) return;
    
    const channel = supabase.channel(`notifications_${session.user.id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications', 
        filter: `user_id=eq.${session.user.id}` 
      }, (payload) => {
        const newNotif = payload.new as any;
        setBubbles(prev => {
          // Keep max 3 bubbles on screen
          const filtered = prev.length >= 3 ? prev.slice(1) : prev;
          return [...filtered, {
            id: newNotif.id,
            title: newNotif.title,
            body: newNotif.body,
            data: newNotif.data,
            icon: newNotif.type === 'lost_nearby' ? '📍' : newNotif.type === 'group_approved' ? '✅' : '🔔'
          }];
        });
      })
      .subscribe();
      
    return () => { supabase.removeChannel(channel); };
  }, [session?.user?.id]);

  const dismissBubble = (id: string) => {
    setBubbles(prev => prev.filter(b => b.id !== id));
  };

  useEffect(() => {
    if (subInitialized) {
      if (tier === 'pro' || tier === 'max') {
        safeStartBLE();
      } else {
        safeStopBLE();
      }
    }
  }, [tier, subInitialized]);

  const publicRoutes = ['login', 'registration', 'forgot-password', 'item', 'terms-of-service', 'finder-connect'];
  const inAuthScreen = publicRoutes.slice(0, 3).includes(segments[0] as string);
  const inOnboarding = segments[0] === 'onboarding';

  useEffect(() => {
    if (!authInitialized || !subInitialized) return;

    const inPublicRoute = publicRoutes.includes(segments[0] as string);

    if (!session && !inPublicRoute && !inOnboarding) {
      router.replace('/login');
    } else if (session) {
      AsyncStorage.getItem('hasSeenOnboarding').then((hasSeen) => {
        if (hasSeen !== 'true' && !inOnboarding) {
          router.replace('/onboarding');
        } else if (hasSeen === 'true' && (inAuthScreen || inOnboarding)) {
          router.replace('/');
        }
      });
    }
  }, [session, authInitialized, subInitialized, segments]);

  const hideTabBarPrefixes = [
    '/group',
    '/post',
    '/create-lost-post',
    '/create-community-post',
    '/create-group',
    '/community-claim',
  ];
  const shouldHideTabBar = hideTabBarPrefixes.some((prefix) => pathname?.startsWith(prefix));

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
      
      {/* Render active bubbles over everything */}
      {bubbles.map((b, idx) => (
        <BubbleNotification
          key={b.id}
          notification={b}
          index={idx}
          onDismiss={dismissBubble}
        />
      ))}
      
      {/* Render floating tab bar everywhere except group and post screens */}
      {session && !inAuthScreen && !inOnboarding && !shouldHideTabBar && (
        <FloatingTabBar
          activeRoute={TAB_ROUTES.find(t => pathname && pathname.includes(t.name))?.name ?? 'my-items'}
          onTabPress={(route) => router.push(`/(tabs)/${route}` as any)}
        />
      )}
    </View>
  );
}

export default Sentry.wrap(RootLayout);

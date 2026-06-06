import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, Animated, StyleSheet,
  Modal, Pressable, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';

interface AppHeaderProps {
  shadow?: boolean;
}

export default function AppHeader({ shadow = true }: AppHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuthStore();

  const [menuOpen, setMenuOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const menuSlide = useRef(new Animated.Value(-290)).current;
  const menuOpacity = useRef(new Animated.Value(0)).current;
  const bellWiggle = useRef(new Animated.Value(0)).current;

  // Derive initials & display name
  const email = user?.email ?? '';
  const fullName: string = (useAuthStore.getState().dbUser?.full_name as string) ?? (user?.user_metadata?.full_name as string) ?? '';
  const displayName = fullName
    ? fullName.split(' ')[0]
    : email
        .split('@')[0]
        .replace(/[._-]/g, ' ')
        .split(' ')
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

  const initials = (fullName || displayName)
    .split(' ')
    .slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase() ?? '')
    .join('') || 'U';

  // Fetch unread count
  useEffect(() => {
    if (!user?.id) return;
    const fetchCount = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      setUnread(count ?? 0);
    };
    fetchCount();

    const sub = supabase
      .channel('header-notif-v2')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, fetchCount)
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [user?.id]);

  // Bell wiggle on new unread
  useEffect(() => {
    if (unread > 0) {
      Animated.sequence([
        Animated.timing(bellWiggle, { toValue: 1, duration: 100, useNativeDriver: true }),
        Animated.timing(bellWiggle, { toValue: -1, duration: 100, useNativeDriver: true }),
        Animated.timing(bellWiggle, { toValue: 1, duration: 100, useNativeDriver: true }),
        Animated.timing(bellWiggle, { toValue: -1, duration: 100, useNativeDriver: true }),
        Animated.timing(bellWiggle, { toValue: 0, duration: 100, useNativeDriver: true }),
      ]).start();
    }
  }, [unread]);

  const bellRotate = bellWiggle.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-18deg', '0deg', '18deg'],
  });

  const openMenu = () => {
    setMenuOpen(true);
    Animated.parallel([
      Animated.spring(menuSlide, {
        toValue: 0, useNativeDriver: true,
        bounciness: 3, speed: 16,
      }),
      Animated.timing(menuOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  };

  const closeMenu = () => {
    Animated.parallel([
      Animated.timing(menuSlide, { toValue: -290, duration: 200, useNativeDriver: true }),
      Animated.timing(menuOpacity, { toValue: 0, duration: 160, useNativeDriver: true }),
    ]).start(() => setMenuOpen(false));
  };

  const menuItems = [
    { icon: '👤', label: 'Profile',           route: '/profile'              },
    { icon: '🔔', label: 'Notifications',      route: '/(tabs)/notifications' },
    { icon: '💳', label: 'Subscription',       route: '/subscription'         },
    { icon: '🛡️', label: 'My Items',           route: '/(tabs)/my-items'      },
    { icon: '🗺️', label: 'Community Board',    route: '/(tabs)/community'     },
    { icon: '⚙️', label: 'NFC / BLE Setup',   route: '/nfc-ble-setup'        },
  ];

  return (
    <>
      {/* ─── Header Bar ──────────────────────────────────────────────────── */}
      <View
        style={[
          styles.headerWrap,
          { paddingTop: insets.top + 10 },
          shadow && styles.headerShadow,
        ]}
      >
        {/* ── Left: Avatar + Burger + Greeting ─────────────────────────── */}
        <View style={styles.leftSide}>
          {/* Avatar circle with burger overlay */}
          <View style={styles.avatarWrap}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
            <TouchableOpacity
              style={styles.burgerOverlay}
              onPress={openMenu}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.burgerIcon}>≡</Text>
            </TouchableOpacity>
          </View>

          {/* Greeting + CTA */}
          <View style={styles.greetingWrap}>
            <Text style={styles.greetingText} numberOfLines={1}>
              Hey {displayName}
            </Text>
            <TouchableOpacity
              style={styles.exploreBtn}
              activeOpacity={0.85}
              onPress={() => router.push('/(tabs)/community')}
            >
              <Text style={styles.exploreBtnText}>Explore LostFind &gt;</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Right: Wallet + Bell + People ────────────────────────────── */}
        <View style={styles.rightSide}>
          {/* Wallet widget */}
          <TouchableOpacity
            style={styles.walletBtn}
            activeOpacity={0.85}
            onPress={() => router.push('/subscription')}
          >
            <View style={styles.walletAmountBox}>
              <Text style={styles.walletSymbol}>₹</Text>
              <Text style={styles.walletAmount}>0</Text>
            </View>
            <View style={styles.walletIconBox}>
              <Text style={styles.walletIcon}>👛</Text>
            </View>
          </TouchableOpacity>

          {/* Bell button */}
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/notifications')}
            style={styles.iconBtn}
            activeOpacity={0.8}
          >
            <Animated.View style={{ transform: [{ rotate: bellRotate }] }}>
              <BellIcon size={24} color="#ffffff" />
            </Animated.View>
            {unread > 0 && (
              <View style={styles.bellDot}>
                <Text style={styles.bellDotText}>
                  {unread > 9 ? '9+' : String(unread)}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Connect / People icon */}
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/connect')}
            style={styles.iconBtn}
            activeOpacity={0.8}
          >
            <PeopleIcon size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── Slide-in Drawer ─────────────────────────────────────────────── */}
      {menuOpen && (
        <Modal transparent animationType="none" onRequestClose={closeMenu}>
          <Animated.View style={[styles.backdrop, { opacity: menuOpacity }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeMenu} />
          </Animated.View>

          <Animated.View
            style={[
              styles.drawer,
              { transform: [{ translateX: menuSlide }], paddingTop: insets.top + 24 },
            ]}
          >
            {/* User card */}
            <View style={styles.drawerUserCard}>
              <View style={styles.drawerAvatar}>
                <Text style={styles.drawerAvatarText}>{initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.drawerName}>{displayName}</Text>
                <Text style={styles.drawerEmail} numberOfLines={1}>{email}</Text>
              </View>
            </View>

            <View style={styles.drawerDivider} />

            {menuItems.map(item => (
              <TouchableOpacity
                key={item.route}
                style={styles.drawerItem}
                activeOpacity={0.7}
                onPress={() => {
                  closeMenu();
                  setTimeout(() => router.push(item.route as any), 260);
                }}
              >
                <Text style={styles.drawerItemIcon}>{item.icon}</Text>
                <Text style={styles.drawerItemLabel}>{item.label}</Text>
                <Text style={styles.drawerChevron}>›</Text>
              </TouchableOpacity>
            ))}

            <View style={styles.drawerDivider} />

            <TouchableOpacity
              style={styles.drawerItem}
              activeOpacity={0.7}
              onPress={async () => {
                closeMenu();
                await signOut();
                setTimeout(() => router.replace('/login'), 260);
              }}
            >
              <Text style={[styles.drawerItemIcon, { fontSize: 18 }]}>🚪</Text>
              <Text style={[styles.drawerItemLabel, { color: '#ef4444' }]}>Sign Out</Text>
            </TouchableOpacity>
          </Animated.View>
        </Modal>
      )}
    </>
  );
}

// ─── Bell Icon ───────────────────────────────────────────────────────────────
function BellIcon({ size = 24, color = '#fff' }: { size?: number; color?: string }) {
  const s = size;
  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      {/* Bell dome */}
      <View style={{
        width: s * 0.62, height: s * 0.52,
        borderRadius: s * 0.15,
        borderWidth: 2, borderColor: color,
        backgroundColor: 'transparent',
        marginTop: s * 0.06,
      }} />
      {/* Stem at top */}
      <View style={{
        position: 'absolute', top: s * 0.01,
        width: 2.5, height: s * 0.18,
        backgroundColor: color,
        borderRadius: 2,
      }} />
      {/* Clapper at bottom */}
      <View style={{
        width: s * 0.2, height: s * 0.2,
        borderRadius: s * 0.1,
        borderWidth: 2, borderColor: color,
        backgroundColor: 'transparent',
        marginTop: -2,
      }} />
    </View>
  );
}

// ─── People Icon ─────────────────────────────────────────────────────────────
function PeopleIcon({ size = 24, color = '#fff' }: { size?: number; color?: string }) {
  const s = size;
  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: -s * 0.05 }}>
        {/* Back person */}
        <View style={{ alignItems: 'center', opacity: 0.65, marginRight: -s * 0.08 }}>
          <View style={{
            width: s * 0.25, height: s * 0.25,
            borderRadius: s * 0.125,
            borderWidth: 1.8, borderColor: color,
            backgroundColor: 'transparent',
          }} />
          <View style={{
            width: s * 0.32, height: s * 0.2,
            borderTopLeftRadius: s * 0.08, borderTopRightRadius: s * 0.08,
            borderWidth: 1.8, borderColor: color,
            borderBottomWidth: 0,
            backgroundColor: 'transparent',
            marginTop: 2,
          }} />
        </View>
        {/* Front person */}
        <View style={{ alignItems: 'center' }}>
          <View style={{
            width: s * 0.28, height: s * 0.28,
            borderRadius: s * 0.14,
            borderWidth: 2, borderColor: color,
            backgroundColor: 'transparent',
          }} />
          <View style={{
            width: s * 0.38, height: s * 0.22,
            borderTopLeftRadius: s * 0.1, borderTopRightRadius: s * 0.1,
            borderWidth: 2, borderColor: color,
            borderBottomWidth: 0,
            backgroundColor: 'transparent',
            marginTop: 2,
          }} />
        </View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Header
  headerWrap: {
    backgroundColor: '#E8540A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  headerShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 10,
  },

  // Left
  leftSide: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  avatarWrap: {
    width: 54,
    height: 54,
    position: 'relative',
  },
  avatarCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.8)',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  avatarInitials: {
    color: '#E8540A',
    fontWeight: '900',
    fontSize: 17,
    letterSpacing: 0.5,
  },
  burgerOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(232,84,10,0.15)',
  },
  burgerIcon: {
    color: '#E8540A',
    fontSize: 11,
    fontWeight: '900',
    lineHeight: Platform.OS === 'android' ? 14 : 13,
  },
  greetingWrap: {
    flex: 1,
    gap: 5,
  },
  greetingText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  exploreBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  exploreBtnText: {
    color: '#E8540A',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.1,
  },

  // Right
  rightSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 6,
  },

  // Wallet
  walletBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  walletAmountBox: {
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    gap: 2,
  },
  walletSymbol: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  walletAmount: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  walletIconBox: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    padding: 5,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  walletIcon: {
    fontSize: 14,
  },

  // Icon buttons (bell, people)
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 3,
    right: 3,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    borderWidth: 1.5,
    borderColor: '#E8540A',
  },
  bellDotText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '800',
  },

  // Backdrop
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },

  // Drawer
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 290,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 24,
  },
  drawerUserCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 22,
    paddingBottom: 22,
  },
  drawerAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#E8540A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerAvatarText: {
    color: '#fff',
    fontSize: 19,
    fontWeight: '900',
  },
  drawerName: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  drawerEmail: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '500',
  },
  drawerDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginHorizontal: 22,
    marginVertical: 8,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 14,
    gap: 14,
  },
  drawerItemIcon: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  drawerItemLabel: {
    color: '#1e293b',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  drawerChevron: {
    color: '#cbd5e1',
    fontSize: 22,
    fontWeight: '300',
  },
});

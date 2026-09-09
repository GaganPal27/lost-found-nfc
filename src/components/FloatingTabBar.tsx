import { useRef, useEffect, useState } from 'react';
import {
  View, TouchableOpacity, Animated, StyleSheet, Platform,
  Text, Modal, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

export const TAB_ROUTES = [
  { name: 'community',     iconName: 'home'           as const, label: 'Home' },
  { name: 'messages',      iconName: 'message-circle' as const, label: 'Messages' },
  { name: 'notifications', iconName: 'bell'           as const, label: 'Alerts' },
  { name: 'my-items',      iconName: 'tag'            as const, label: 'Tags' },
];

// Shared helper so any scroll screen can compute exactly how much
// paddingBottom it needs to clear the floating tab bar + system nav pill.
export function useTabBarClearance() {
  const insets = useSafeAreaInsets();
  const gestureNavHeight = Math.max(insets.bottom, 80);
  return gestureNavHeight + 80;
}

interface FloatingTabBarProps {
  activeRoute: string;
  onTabPress: (route: string) => void;
}

export default function FloatingTabBar({ activeRoute, onTabPress }: FloatingTabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();
  const [showPostModal, setShowPostModal] = useState(false);
  const [unreadMessages, setUnreadMessages]     = useState(0);
  const [unreadNotifs,   setUnreadNotifs]       = useState(0);

  const bottomPad = Math.max(insets.bottom + 12, 24);

  // ── Badge counts ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;

    // Count conversations with at least one message, where the current user
    // hasn't dismissed them (simple proxy: total active conversations)
    const fetchBadges = async () => {
      const [convRes, notifRes] = await Promise.all([
        supabase
          .from('conversations')
          .select('id', { count: 'exact', head: true })
          .or(`owner_id.eq.${user.id},finder_user_id.eq.${user.id}`)
          .eq('resolved', false),
        supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_read', false),
      ]);
      setUnreadMessages(convRes.count ?? 0);
      setUnreadNotifs(notifRes.count ?? 0);
    };

    fetchBadges();

    // Realtime updates
    const ch = supabase
      .channel('tab_badges')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, fetchBadges)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, fetchBadges)
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  // Clear messages badge when user opens messages tab
  useEffect(() => {
    if (activeRoute === 'messages') setUnreadMessages(0);
    if (activeRoute === 'notifications') setUnreadNotifs(0);
  }, [activeRoute]);

  return (
    <>
      {/* ── Bottom Nav Bar ─────────────────────────────────────────────────── */}
      <View style={[styles.bar, { paddingBottom: bottomPad }]}>

        {/* Home */}
        <TabItem
          iconName="home"
          label="Home"
          isActive={activeRoute === 'community'}
          onPress={() => onTabPress('community')}
        />

        {/* Messages */}
        <TabItem
          iconName="message-circle"
          label="Messages"
          isActive={activeRoute === 'messages'}
          badge={unreadMessages}
          onPress={() => onTabPress('messages')}
        />

        {/* + Post (center) */}
        <TouchableOpacity
          style={styles.postBtn}
          onPress={() => setShowPostModal(true)}
          activeOpacity={0.85}
        >
          <LinearGradient colors={['#6366f1', '#8b5cf6']} style={styles.postBtnGrad}>
            <Feather name="plus" size={26} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>

        {/* Notifications */}
        <TabItem
          iconName="bell"
          label="Alerts"
          isActive={activeRoute === 'notifications'}
          badge={unreadNotifs}
          onPress={() => onTabPress('notifications')}
        />

        {/* Tags */}
        <TabItem
          iconName="tag"
          label="Tags"
          isActive={activeRoute === 'my-items'}
          onPress={() => onTabPress('my-items')}
        />
      </View>

      {/* ── Post Type Modal ────────────────────────────────────────────────── */}
      <Modal
        visible={showPostModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPostModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowPostModal(false)}>
          <View style={styles.sheetContainer} onStartShouldSetResponder={() => true}>
            <View style={styles.handle} />

            <Text style={styles.sheetTitle}>What do you want to do?</Text>
            <Text style={styles.sheetSubtitle}>Post to the community or scan an NFC tag</Text>

            {/* Found */}
            <TouchableOpacity
              style={[styles.sheetOption, { borderColor: '#bbf7d0' }]}
              onPress={() => { setShowPostModal(false); router.push('/create-community-post'); }}
              activeOpacity={0.8}
            >
              <View style={[styles.sheetOptionIcon, { backgroundColor: '#dcfce7' }]}>
                <Text style={{ fontSize: 26 }}>🟢</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetOptionTitle}>I Found Something</Text>
                <Text style={styles.sheetOptionSub}>Help reunite a lost item with its owner</Text>
              </View>
              <Feather name="chevron-right" size={18} color="#94a3b8" />
            </TouchableOpacity>

            {/* Lost */}
            <TouchableOpacity
              style={[styles.sheetOption, { borderColor: '#fecaca' }]}
              onPress={() => { setShowPostModal(false); router.push('/create-lost-post'); }}
              activeOpacity={0.8}
            >
              <View style={[styles.sheetOptionIcon, { backgroundColor: '#fee2e2' }]}>
                <Text style={{ fontSize: 26 }}>🔴</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetOptionTitle}>I Lost Something</Text>
                <Text style={styles.sheetOptionSub}>Alert the community to help you find it</Text>
              </View>
              <Feather name="chevron-right" size={18} color="#94a3b8" />
            </TouchableOpacity>

            {/* Scan NFC */}
            <TouchableOpacity
              style={[styles.sheetOption, { borderColor: '#c7d2fe' }]}
              onPress={() => { setShowPostModal(false); router.push('/(tabs)/scan'); }}
              activeOpacity={0.8}
            >
              <View style={[styles.sheetOptionIcon, { backgroundColor: '#e0e7ff' }]}>
                <Text style={{ fontSize: 26 }}>📡</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetOptionTitle}>Scan NFC Tag</Text>
                <Text style={styles.sheetOptionSub}>Link or read an NFC tag on your item</Text>
              </View>
              <Feather name="chevron-right" size={18} color="#94a3b8" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowPostModal(false)} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function TabItem({
  iconName, label, isActive, badge, onPress,
}: {
  iconName: keyof typeof Feather.glyphMap;
  label: string;
  isActive: boolean;
  badge?: number;
  onPress: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(isActive ? 1 : 0.88)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: isActive ? 1 : 0.88,
      useNativeDriver: true,
      bounciness: 8, speed: 18,
    }).start();
  }, [isActive]);

  const iconColor = isActive ? '#6366f1' : '#94a3b8';

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.tabItem}>
      <Animated.View style={[styles.tabItemInner, { transform: [{ scale: scaleAnim }] }]}>
        <View style={{ position: 'relative' }}>
          <Feather name={iconName} color={iconColor} size={22} />
          {badge != null && badge > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{label}</Text>
      </Animated.View>
      {isActive && <View style={styles.activeIndicator} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#ffffff',
    borderTopWidth: 1, borderTopColor: '#f1f5f9',
    paddingTop: 8, paddingHorizontal: 4,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 }, elevation: 16,
    zIndex: 999,
  },
  tabItem: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 4, position: 'relative',
  },
  tabItemInner: {
    alignItems: 'center', justifyContent: 'center', gap: 3,
  },
  tabLabel: {
    fontSize: 10, color: '#94a3b8', fontWeight: '600', marginTop: 2,
  },
  tabLabelActive: {
    color: '#6366f1', fontWeight: '700',
  },
  activeIndicator: {
    position: 'absolute', bottom: -4, width: 20, height: 3,
    borderRadius: 2, backgroundColor: '#6366f1',
  },
  badge: {
    position: 'absolute', top: -5, right: -8,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#ef4444',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: '#ffffff',
  },
  badgeText: {
    color: '#ffffff', fontSize: 9, fontWeight: '800',
  },
  postBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
  },
  postBtnGrad: {
    width: 52, height: 52, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#6366f1', shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },

  // ── Bottom Sheet ──
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#e2e8f0',
    alignSelf: 'center', marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 22, fontWeight: '800', color: '#0f172a', marginBottom: 4, letterSpacing: -0.3,
  },
  sheetSubtitle: {
    fontSize: 13, color: '#94a3b8', fontWeight: '500', marginBottom: 20,
  },
  sheetOption: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#fafafa', borderRadius: 18, borderWidth: 1.5,
    padding: 16, marginBottom: 12,
  },
  sheetOptionIcon: {
    width: 52, height: 52, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  sheetOptionTitle: {
    fontSize: 15, fontWeight: '800', color: '#0f172a', marginBottom: 3,
  },
  sheetOptionSub: {
    fontSize: 12, color: '#64748b', fontWeight: '500', lineHeight: 17,
  },
  cancelBtn: {
    alignItems: 'center', paddingVertical: 14, marginTop: 4,
  },
  cancelBtnText: {
    fontSize: 14, color: '#94a3b8', fontWeight: '600',
  },
});

import { useRef, useEffect } from 'react';
import { View, TouchableOpacity, Animated, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

// ─── Minimal line-art icon components ────────────────────────────────────────

// ─── Tab route definitions ────────────────────────────────────────────────────
export const TAB_ROUTES = [
  { name: 'my-items',      Icon: ({color, size}) => <Feather name="home" color={color} size={size*0.9} />,        label: 'Home'    },
  { name: 'scan',          Icon: ({color, size}) => <Feather name="maximize" color={color} size={size*0.9} />,    label: 'Scan'    },
  { name: 'community',     Icon: ({color, size}) => <Feather name="users" color={color} size={size*0.9} />,       label: 'Board'   },
];

// ─── FloatingTabBar ───────────────────────────────────────────────────────────
interface FloatingTabBarProps {
  activeRoute: string;
  onTabPress: (route: string) => void;
}

export default function FloatingTabBar({ activeRoute, onTabPress }: FloatingTabBarProps) {
  const insets = useSafeAreaInsets();
  const barSlide = useRef(new Animated.Value(100)).current;

  useEffect(() => {
    Animated.spring(barSlide, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 9, speed: 11,
    }).start();
  }, []);

  const bottomPad = insets.bottom > 0 ? insets.bottom : Platform.OS === 'android' ? 10 : 0;

  return (
    <Animated.View
      style={[
        styles.barWrapper,
        { bottom: bottomPad + 14, transform: [{ translateY: barSlide }] },
      ]}
    >
      <View style={styles.pill}>
        {TAB_ROUTES.map(tab => (
          <TabItem
            key={tab.name}
            tab={tab}
            isActive={activeRoute === tab.name}
            onPress={() => {
              if (activeRoute !== tab.name) {
                onTabPress(tab.name);
              }
            }}
          />
        ))}
      </View>
    </Animated.View>
  );
}

// ─── Individual Tab Item ──────────────────────────────────────────────────────
function TabItem({
  tab,
  isActive,
  onPress,
}: {
  tab: typeof TAB_ROUTES[0];
  isActive: boolean;
  onPress: () => void;
}) {
  const bgAnim = useRef(new Animated.Value(isActive ? 1 : 0)).current;
  const scaleAnim = useRef(new Animated.Value(isActive ? 1 : 0.9)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(bgAnim, {
        toValue: isActive ? 1 : 0,
        useNativeDriver: false,
        bounciness: 5, speed: 16,
      }),
      Animated.spring(scaleAnim, {
        toValue: isActive ? 1 : 0.88,
        useNativeDriver: true,
        bounciness: 8, speed: 18,
      }),
    ]).start();
  }, [isActive]);

  const bgWidth = bgAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 52] });
  const bgHeight = bgAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 46] });
  const bgOpacity = bgAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.8, 1] });

  const iconColor = isActive ? '#ffffff' : '#8A8FA6';

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.tabItem}>
      {/* Orange/Purple rounded rect highlight */}
      <Animated.View
        style={[
          styles.activeHighlight,
          { width: bgWidth, height: bgHeight, opacity: bgOpacity },
        ]}
      />
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <tab.Icon color={iconColor} size={22} />
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  barWrapper: {
    position: 'absolute', left: 0, right: 0,
    alignItems: 'center', zIndex: 999, pointerEvents: 'box-none',
  } as any,
  pill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0f172a', // Dark theme from mockup
    borderRadius: 44,
    paddingHorizontal: 8, paddingVertical: 8,
    gap: 4,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 }, elevation: 18,
  },
  tabItem: {
    width: 58, height: 52,
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  activeHighlight: {
    position: 'absolute',
    borderRadius: 24,
    backgroundColor: '#4f46e5', // Primary purple to match front page
    shadowColor: '#4f46e5', shadowOpacity: 0.6, shadowRadius: 12, elevation: 8,
  },
});

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

export type BubbleNotificationData = {
  id: string;
  title: string;
  body: string;
  icon?: string;
  data?: any;
};

interface Props {
  notification: BubbleNotificationData;
  onDismiss: (id: string) => void;
  index: number;
}

export default function BubbleNotification({ notification, onDismiss, index }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const slideAnim = useRef(new Animated.Value(-150)).current; // Start above screen
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: insets.top + 8 + (index * 80), // Stack them if multiple
        useNativeDriver: true,
        bounciness: 12,
        speed: 14,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-dismiss after 4 seconds
    const timer = setTimeout(() => {
      dismiss();
    }, 4000);

    return () => clearTimeout(timer);
  }, [index]);

  const dismiss = () => {
    // Exit animation (slide right)
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 500, // Slide out to right
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss(notification.id);
    });
  };

  const handlePress = () => {
    if (notification.data?.route) {
      router.push(notification.data.route);
    }
    dismiss();
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [
            // if it's exiting to the right, we use translateX, but we shared slideAnim for both.
            // Actually, a better approach: entrance is translateY, exit is translateX.
            // Let's keep it simple: entrance uses translateY.
            { translateY: slideAnim }
          ],
          opacity: fadeAnim,
          zIndex: 9999 - index,
        }
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handlePress}
        style={styles.card}
      >
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>{notification.icon || '🔔'}</Text>
        </View>
        
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={1}>{notification.title}</Text>
          <Text style={styles.body} numberOfLines={2}>{notification.body}</Text>
        </View>

        <TouchableOpacity style={styles.closeBtn} onPress={dismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 20,
  },
  content: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  body: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  closeBtn: {
    padding: 6,
  },
  closeText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '700',
  }
});

import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, StatusBar, Animated, FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

const SLIDES = [
  {
    emoji: '🏷️',
    title: 'Tag it.',
    description: 'Attach an NFC or BLE tag to your most valuable items — wallet, keys, bag.',
    gradientColors: ['#6366f1', '#7c3aed'] as const,
    accentBg: 'rgba(255,255,255,0.15)',
  },
  {
    emoji: '📱',
    title: 'Community finds it.',
    description: 'If lost, anyone who finds it can tap the tag with their phone to notify you instantly.',
    gradientColors: ['#0ea5e9', '#6366f1'] as const,
    accentBg: 'rgba(255,255,255,0.15)',
  },
  {
    emoji: '🔐',
    title: "Prove it's yours,\nget it back.",
    description: 'Securely connect with the finder and arrange a safe return — all within the app.',
    gradientColors: ['#7c3aed', '#ec4899'] as const,
    accentBg: 'rgba(255,255,255,0.15)',
  },
];

export default function OnboardingScreen() {
  const router       = useRouter();
  const insets       = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const scrollX      = useRef(new Animated.Value(0)).current;
  const flatListRef  = useRef<FlatList>(null);

  const onViewRef = useRef(({ viewableItems }: any) => {
    if (viewableItems?.length > 0) setIndex(viewableItems[0].index ?? 0);
  }).current;
  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handleNext = async () => {
    if (index < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: index + 1 });
    } else {
      try { await AsyncStorage.setItem('hasSeenOnboarding', 'true'); } catch (_) {}
      router.replace('/(tabs)/my-items');
    }
  };

  const handleSkip = async () => {
    try { await AsyncStorage.setItem('hasSeenOnboarding', 'true'); } catch (_) {}
    router.replace('/login');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Full-screen slides */}
      <Animated.FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onViewableItemsChanged={onViewRef}
        viewabilityConfig={viewConfig}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <LinearGradient
            colors={item.gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.slide, { paddingTop: insets.top + 20 }]}
          >
            {/* Decorative circles */}
            <View style={styles.circle1} />
            <View style={styles.circle2} />
            <View style={styles.circle3} />

            {/* Content */}
            <View style={styles.slideContent}>
              {/* App brand on first slide */}
              {item === SLIDES[0] && (
                <View style={styles.brandRow}>
                  <Text style={styles.brandName}>Keepr</Text>
                  <View style={styles.brandBadge}>
                    <Text style={styles.brandBadgeText}>NFC</Text>
                  </View>
                </View>
              )}

              {/* Emoji icon */}
              <View style={[styles.emojiWrap, { backgroundColor: item.accentBg }]}>
                <Text style={styles.emoji}>{item.emoji}</Text>
              </View>

              <Text style={styles.slideTitle}>{item.title}</Text>
              <Text style={styles.slideDesc}>{item.description}</Text>
            </View>
          </LinearGradient>
        )}
      />

      {/* Bottom controls — white rounded sheet */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 24 }]}>
        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => {
            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
            const dotW = scrollX.interpolate({ inputRange, outputRange: [8, 22, 8], extrapolate: 'clamp' });
            const op   = scrollX.interpolate({ inputRange, outputRange: [0.3, 1, 0.3], extrapolate: 'clamp' });
            return (
              <Animated.View key={i} style={[styles.dot, { width: dotW, opacity: op }]} />
            );
          })}
        </View>

        {/* Next / Get Started button */}
        <TouchableOpacity onPress={handleNext} activeOpacity={0.88} style={{ borderRadius: 18, overflow: 'hidden' }}>
          <LinearGradient
            colors={['#6366f1', '#7c3aed']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.nextBtn}
          >
            <Text style={styles.nextBtnText}>
              {index === SLIDES.length - 1 ? "Let's Go  🚀" : 'Next  →'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Skip / Sign In link */}
        <TouchableOpacity onPress={handleSkip} activeOpacity={0.7} style={styles.skipBtn}>
          <Text style={styles.skipText}>
            {index === SLIDES.length - 1
              ? 'Already have an account?  '
              : 'Skip  '}
            <Text style={styles.skipHighlight}>Sign In</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8faff' },

  /* Slide */
  slide: {
    width, flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  circle1: { position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.08)' },
  circle2: { position: 'absolute', bottom: 60, left: -80, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.06)' },
  circle3: { position: 'absolute', top: 80,   right: 20,  width: 90,  height: 90,  borderRadius: 45,  backgroundColor: 'rgba(255,255,255,0.05)' },

  slideContent: { alignItems: 'center', zIndex: 1 },

  /* Brand row (slide 1 only) */
  brandRow:        { flexDirection: 'row', alignItems: 'center', marginBottom: 40, gap: 10 },
  brandName:       { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: 0.5 },
  brandBadge:      { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 },
  brandBadgeText:  { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },

  /* Emoji */
  emojiWrap: {
    width: 130, height: 130, borderRadius: 65,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 36,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  emoji: { fontSize: 64 },

  slideTitle: { color: '#fff', fontSize: 30, fontWeight: '900', textAlign: 'center', lineHeight: 38, marginBottom: 16, letterSpacing: -0.5 },
  slideDesc:  { color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: '500', textAlign: 'center', lineHeight: 23 },

  /* Bottom sheet */
  bottom: {
    backgroundColor: '#f8faff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -24,
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 24, gap: 6 },
  dot:  { height: 8, borderRadius: 4, backgroundColor: '#6366f1' },

  nextBtn:     { paddingVertical: 17, alignItems: 'center', borderRadius: 18 },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },

  skipBtn:       { alignItems: 'center', paddingTop: 16 },
  skipText:      { color: '#64748b', fontSize: 14, fontWeight: '500' },
  skipHighlight: { color: '#6366f1', fontWeight: '800' },
});

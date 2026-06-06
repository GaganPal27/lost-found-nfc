import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, StatusBar, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    title: 'Tag it.',
    description: 'Attach an NFC or BLE tag to your most valuable items (wallet, keys, bags).',
    emoji: '🏷️',
    bg: '#E0E7FF',
    color: '#4338ca',
  },
  {
    title: 'Community finds it.',
    description: 'If lost, anyone who finds it can scan the tag with their phone to notify you instantly.',
    emoji: '📱',
    bg: '#DCFCE7',
    color: '#15803d',
  },
  {
    title: "Prove it's yours, get it back.",
    description: 'Answer your secret proof question to securely claim your item and arrange a safe return.',
    emoji: '🔐',
    bg: '#F3E8FF',
    color: '#7e22ce',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = React.useRef(new Animated.Value(0)).current;
  const slideRef = React.useRef(null);

  const viewableItemsChanged = React.useRef(({ viewableItems }: any) => {
    if (viewableItems && viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewConfig = React.useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handleNext = async () => {
    if (currentIndex < SLIDES.length - 1) {
      (slideRef.current as any)?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      try {
        await AsyncStorage.setItem('hasSeenOnboarding', 'true');
        router.replace('/(tabs)/my-items');
      } catch (e) {
        console.error('Error saving onboarding flag:', e);
      }
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={{ flex: 3 }}>
        <Animated.FlatList
          data={SLIDES}
          renderItem={({ item }) => (
            <View style={[styles.slide, { width }]}>
              <View style={[styles.emojiContainer, { backgroundColor: item.bg }]}>
                <Text style={styles.emoji}>{item.emoji}</Text>
              </View>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.description}>{item.description}</Text>
            </View>
          )}
          horizontal
          showsHorizontalScrollIndicator={false}
          pagingEnabled
          bounces={false}
          keyExtractor={(item) => item.title}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
            useNativeDriver: false,
          })}
          onViewableItemsChanged={viewableItemsChanged}
          viewabilityConfig={viewConfig}
          scrollEventThrottle={32}
          ref={slideRef}
        />
      </View>

      <View style={styles.bottomContainer}>
        <View style={styles.paginator}>
          {SLIDES.map((_, i) => {
            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [10, 20, 10],
              extrapolate: 'clamp',
            });
            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.3, 1, 0.3],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View
                style={[styles.dot, { width: dotWidth, opacity }]}
                key={i.toString()}
              />
            );
          })}
        </View>

        <TouchableOpacity onPress={handleNext} activeOpacity={0.8}>
          <LinearGradient colors={['#6366f1', '#8b5cf6']} style={styles.btn}>
            <Text style={styles.btnText}>
              {currentIndex === SLIDES.length - 1 ? "Let's Go 🚀" : 'Next'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emojiContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  emoji: {
    fontSize: 70,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
    fontWeight: '500',
  },
  bottomContainer: {
    paddingHorizontal: 24,
    paddingBottom: 60,
    paddingTop: 20,
  },
  paginator: {
    flexDirection: 'row',
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#6366f1',
    marginHorizontal: 8,
  },
  btn: {
    paddingVertical: 18,
    borderRadius: 24,
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  btnText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
});

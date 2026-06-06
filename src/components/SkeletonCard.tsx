import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

export default function SkeletonCard() {
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[styles.card, { opacity: pulseAnim }]}>
      <View style={styles.topRow}>
        <View style={styles.avatar} />
        <View style={styles.textStack}>
          <View style={styles.titleLine} />
          <View style={styles.subtitleLine} />
        </View>
      </View>
      <View style={styles.bodyLine1} />
      <View style={styles.bodyLine2} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    marginRight: 12,
  },
  textStack: {
    flex: 1,
    gap: 8,
  },
  titleLine: {
    height: 14,
    width: '60%',
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
  },
  subtitleLine: {
    height: 10,
    width: '40%',
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
  },
  bodyLine1: {
    height: 12,
    width: '100%',
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    marginBottom: 8,
  },
  bodyLine2: {
    height: 12,
    width: '80%',
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
  }
});

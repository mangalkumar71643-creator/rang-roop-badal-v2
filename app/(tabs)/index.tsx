import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { usePlayer } from '@/context/PlayerContext';

const { width, height } = Dimensions.get('window');

export default function SplashScreen() {
  const { loaded, checkAndUpdateLoginStreak } = usePlayer();
  const scale = useRef(new Animated.Value(0.5)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
      Animated.timing(subtitleOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => {
      const { hasDailyReward } = checkAndUpdateLoginStreak();
      if (hasDailyReward) {
        router.replace('/daily-reward');
      } else {
        router.replace('/menu');
      }
    }, 2400);
    return () => clearTimeout(timer);
  }, [loaded, checkAndUpdateLoginStreak]);

  return (
    <LinearGradient colors={['#070714', '#120830', '#070714']} style={styles.container}>
      {/* Background stars */}
      {Array.from({ length: 30 }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.star,
            {
              left: Math.random() * width,
              top: Math.random() * height,
              width: Math.random() * 3 + 1,
              height: Math.random() * 3 + 1,
              opacity: Math.random() * 0.8 + 0.2,
            },
          ]}
        />
      ))}

      <Animated.View style={[styles.logoContainer, { transform: [{ scale }], opacity }]}>
        <Text style={styles.logoMain}>रंग रूप</Text>
        <Text style={styles.logoBadal}>बदल</Text>
        <Text style={styles.logoSub}>RANG ROOP BADAL</Text>
      </Animated.View>

      <Animated.Text style={[styles.tagline, { opacity: subtitleOpacity }]}>
        Change Color. Change Shape. Pass the Gate.
      </Animated.Text>

      <Animated.View style={[styles.loadingDots, { opacity: subtitleOpacity }]}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.dot, { backgroundColor: ['#FF2D78', '#FFD700', '#00D4FF'][i] }]} />
        ))}
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  star: {
    position: 'absolute',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoMain: {
    fontSize: 48,
    fontFamily: 'Inter_700Bold',
    color: '#FFD700',
    textShadowColor: '#FF2D78',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
    letterSpacing: 2,
  },
  logoBadal: {
    fontSize: 56,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    marginTop: -8,
    letterSpacing: 4,
    textShadowColor: '#00D4FF',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  logoSub: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: '#8888BB',
    letterSpacing: 6,
    marginTop: 8,
  },
  tagline: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: '#8888BB',
    textAlign: 'center',
    paddingHorizontal: 40,
    marginBottom: 40,
  },
  loadingDots: {
    flexDirection: 'row',
    gap: 8,
    position: 'absolute',
    bottom: 60,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

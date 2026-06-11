import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ShapeRenderer } from '@/components/ShapeRenderer';
import { GAME_COLOR_NAMES, GAME_COLORS, GAME_SHAPE_NAMES } from '@/constants/gameConfig';
import { usePlayer } from '@/context/PlayerContext';
import { useColors } from '@/hooks/useColors';

const { width } = Dimensions.get('window');

const MODES = [
  {
    id: 'classic' as const,
    label: 'Classic',
    desc: '3 lives · Speed builds',
    icon: 'game-controller' as const,
    grad: ['#FF6B35', '#FF2D78'] as [string, string],
  },
  {
    id: 'endless' as const,
    label: 'Endless',
    desc: 'Play forever · How far can you go?',
    icon: 'infinite' as const,
    grad: ['#00D4FF', '#5E5CE6'] as [string, string],
  },
  {
    id: 'challenge' as const,
    label: 'Challenge',
    desc: '60 seconds · Max score!',
    icon: 'timer' as const,
    grad: ['#FFD700', '#FF9500'] as [string, string],
  },
];

const SNAKE_SHIFT_MODE = {
  label: 'Snake Shift',
  desc: 'Swipe to steer · Hold to boost',
  icon: 'pulse' as const,
  grad: ['#30D158', '#00D4FF'] as [string, string],
};

export default function MenuScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { playerData } = usePlayer();

  const titleAnim = useRef(new Animated.Value(-50)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const cardsAnim = useRef(new Animated.Value(40)).current;
  const cardsOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(titleAnim, { toValue: 0, friction: 6, tension: 80, useNativeDriver: true }),
      Animated.timing(titleOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();

    Animated.sequence([
      Animated.delay(200),
      Animated.parallel([
        Animated.spring(cardsAnim, { toValue: 0, friction: 6, tension: 60, useNativeDriver: true }),
        Animated.timing(cardsOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const handleModePress = (mode: 'classic' | 'endless' | 'challenge') => {
    router.push({
      pathname: '/game',
      params: { mode, characterId: playerData.selectedCharacter },
    });
  };

  const handleSnakeShift = () => {
    router.push('/snake-shift');
  };

  return (
    <LinearGradient colors={['#070714', '#0D0D28', '#070714']} style={styles.container}>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <View style={styles.currencyRow}>
          <View style={styles.currencyChip}>
            <Ionicons name="logo-usd" size={14} color="#FFD700" />
            <Text style={styles.currencyText}>{playerData.coins}</Text>
          </View>
          <View style={styles.currencyChip}>
            <Ionicons name="star" size={14} color="#00D4FF" />
            <Text style={styles.currencyText}>{playerData.stars}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => router.push('/settings')} style={styles.iconBtn}>
          <Ionicons name="settings-outline" size={22} color="#8888BB" />
        </TouchableOpacity>
      </View>

      {/* Title */}
      <Animated.View
        style={[
          styles.titleBlock,
          { transform: [{ translateY: titleAnim }], opacity: titleOpacity },
        ]}
      >
        <Text style={styles.titleMain}>RANG ROOP</Text>
        <Text style={styles.titleBadal}>BADAL</Text>
        <Text style={styles.titleSub}>CHANGE COLOR · CHANGE SHAPE</Text>
      </Animated.View>

      {/* Floating shapes */}
      <View style={styles.shapesRow}>
        {GAME_SHAPE_NAMES.map((shape, i) => (
          <View key={shape} style={styles.floatShape}>
            <ShapeRenderer
              shape={shape}
              color={GAME_COLORS[GAME_COLOR_NAMES[i * 2]]}
              size={32}
            />
          </View>
        ))}
      </View>

      {/* Mode cards */}
      <Animated.View
        style={[
          styles.modesContainer,
          { transform: [{ translateY: cardsAnim }], opacity: cardsOpacity },
        ]}
      >
        {MODES.map((mode) => (
          <Pressable
            key={mode.id}
            onPress={() => handleModePress(mode.id)}
            style={({ pressed }) => [styles.modeCard, pressed && styles.modeCardPressed]}
          >
            <LinearGradient
              colors={mode.grad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modeGrad}
            >
              <Ionicons name={mode.icon} size={28} color="#FFFFFF" />
              <View style={styles.modeText}>
                <Text style={styles.modeLabel}>{mode.label}</Text>
                <Text style={styles.modeDesc}>{mode.desc}</Text>
              </View>
              {playerData.highScores[mode.id] ? (
                <View style={styles.highScoreBadge}>
                  <Text style={styles.highScoreVal}>{playerData.highScores[mode.id]}</Text>
                </View>
              ) : null}
              <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.6)" />
            </LinearGradient>
          </Pressable>
        ))}

        {/* Snake Shift */}
        <Pressable
          onPress={handleSnakeShift}
          style={({ pressed }) => [styles.modeCard, pressed && styles.modeCardPressed]}
        >
          <LinearGradient
            colors={SNAKE_SHIFT_MODE.grad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.modeGrad}
          >
            <Ionicons name={SNAKE_SHIFT_MODE.icon} size={28} color="#FFFFFF" />
            <View style={styles.modeText}>
              <Text style={styles.modeLabel}>{SNAKE_SHIFT_MODE.label}</Text>
              <Text style={styles.modeDesc}>{SNAKE_SHIFT_MODE.desc}</Text>
            </View>
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>NEW</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.6)" />
          </LinearGradient>
        </Pressable>
      </Animated.View>

      {/* Bottom nav */}
      <View style={[styles.bottomNav, { paddingBottom: insets.bottom + 16 }]}>
        {[
          { icon: 'person-circle-outline' as const, label: 'Character', route: '/character-select' as const },
          { icon: 'cart-outline' as const, label: 'Shop', route: '/shop' as const },
          { icon: 'trophy-outline' as const, label: 'Achievements', route: '/achievements' as const },
          { icon: 'gift-outline' as const, label: 'Daily', route: '/daily-reward' as const },
        ].map((item) => (
          <TouchableOpacity
            key={item.route}
            style={styles.navBtn}
            onPress={() => router.push(item.route)}
          >
            <View style={styles.navIconWrap}>
              <Ionicons name={item.icon} size={24} color="#8888BB" />
            </View>
            <Text style={styles.navLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  currencyRow: { flexDirection: 'row', gap: 8 },
  currencyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  currencyText: { color: '#FFFFFF', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  iconBtn: { padding: 4 },
  titleBlock: { alignItems: 'center', paddingTop: 12, paddingBottom: 8 },
  titleMain: {
    fontSize: 32,
    fontFamily: 'Inter_700Bold',
    color: '#FFD700',
    letterSpacing: 4,
    textShadowColor: '#FF9500',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  titleBadal: {
    fontSize: 44,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    letterSpacing: 6,
    marginTop: -8,
    textShadowColor: '#00D4FF',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  titleSub: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: '#5555AA',
    letterSpacing: 3,
    marginTop: 6,
  },
  shapesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 12,
  },
  floatShape: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modesContainer: { paddingHorizontal: 20, gap: 12 },
  modeCard: { borderRadius: 18, overflow: 'hidden' },
  modeCardPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  modeGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    gap: 14,
  },
  modeText: { flex: 1 },
  modeLabel: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
  modeDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  highScoreBadge: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  highScoreVal: { fontSize: 13, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
  newBadge: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  newBadgeText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: '#FFFFFF', letterSpacing: 1 },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  navBtn: { alignItems: 'center', gap: 4 },
  navIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  navLabel: { fontSize: 10, fontFamily: 'Inter_500Medium', color: '#5555AA' },
});

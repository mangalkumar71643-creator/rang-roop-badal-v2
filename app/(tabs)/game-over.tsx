import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayer } from '@/context/PlayerContext';

export default function GameOverScreen() {
  const params = useLocalSearchParams<{
    score: string; mode: string; gates: string; combo: string; coins: string; stars: string;
  }>();
  const score = parseInt(params.score ?? '0', 10);
  const mode = params.mode ?? 'classic';
  const gates = parseInt(params.gates ?? '0', 10);
  const combo = parseInt(params.combo ?? '0', 10);
  const coinsEarned = parseInt(params.coins ?? '0', 10);
  const starsEarned = parseInt(params.stars ?? '0', 10);

  const insets = useSafeAreaInsets();
  const { playerData } = usePlayer();

  const isNewHigh = score > 0 && score >= (playerData.highScores[mode] ?? 0);

  const fadeIn = useRef(new Animated.Value(0)).current;
  const scaleIn = useRef(new Animated.Value(0.7)).current;
  const rowsAnim = useRef(new Animated.Value(30)).current;
  const rowsOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scaleIn, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
        Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.spring(rowsAnim, { toValue: 0, friction: 6, useNativeDriver: true }),
        Animated.timing(rowsOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const modeLabel = mode === 'classic' ? 'Classic' : mode === 'endless' ? 'Endless' : 'Challenge';

  return (
    <LinearGradient colors={['#0F0020', '#070714', '#0F0020']} style={styles.container}>
      <View style={[styles.inner, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
        {/* Header */}
        <Animated.View style={[styles.header, { transform: [{ scale: scaleIn }], opacity: fadeIn }]}>
          {isNewHigh ? (
            <>
              <Text style={styles.newHigh}>NEW HIGH SCORE!</Text>
              <Ionicons name="trophy" size={56} color="#FFD700" style={styles.icon} />
            </>
          ) : (
            <>
              <Text style={styles.gameOver}>GAME OVER</Text>
              <Ionicons name="skull-outline" size={56} color="#FF2D78" style={styles.icon} />
            </>
          )}
          <Text style={styles.scoreVal}>{score}</Text>
          <Text style={styles.modeLabel}>{modeLabel} Mode</Text>
        </Animated.View>

        {/* Stats */}
        <Animated.View style={[styles.stats, { transform: [{ translateY: rowsAnim }], opacity: rowsOpacity }]}>
          {[
            { label: 'Gates Cleared', value: gates, icon: 'checkmark-circle', color: '#00E87A' },
            { label: 'Max Combo', value: `×${combo}`, icon: 'flame', color: '#FF9500' },
            { label: 'Coins Earned', value: coinsEarned, icon: 'logo-usd', color: '#FFD700' },
            { label: 'Stars Earned', value: starsEarned, icon: 'star', color: '#00D4FF' },
          ].map((stat) => (
            <View key={stat.label} style={styles.statRow}>
              <View style={styles.statLeft}>
                <Ionicons name={stat.icon as any} size={18} color={stat.color} />
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
              <Text style={[styles.statVal, { color: stat.color }]}>{stat.value}</Text>
            </View>
          ))}

          {playerData.highScores[mode] !== undefined && (
            <View style={styles.bestRow}>
              <Text style={styles.bestLabel}>Best in {modeLabel}</Text>
              <Text style={styles.bestVal}>{playerData.highScores[mode]}</Text>
            </View>
          )}
        </Animated.View>

        {/* Buttons */}
        <Animated.View style={[styles.buttons, { opacity: rowsOpacity }]}>
          <Pressable
            style={({ pressed }) => [styles.playAgainBtn, pressed && styles.btnPressed]}
            onPress={() => router.replace({ pathname: '/game', params: { mode, characterId: playerData.selectedCharacter } })}
          >
            <LinearGradient colors={['#FF6B35', '#FF2D78']} style={styles.btnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Ionicons name="refresh" size={20} color="#FFFFFF" />
              <Text style={styles.playAgainText}>PLAY AGAIN</Text>
            </LinearGradient>
          </Pressable>

          <TouchableOpacity
            style={styles.homeBtn}
            onPress={() => router.replace('/menu')}
          >
            <Ionicons name="home-outline" size={20} color="#FFFFFF" />
            <Text style={styles.homeBtnText}>MAIN MENU</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between' },
  header: { alignItems: 'center', paddingTop: 20 },
  newHigh: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#FFD700',
    letterSpacing: 3,
    marginBottom: 8,
  },
  gameOver: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#FF2D78',
    letterSpacing: 3,
    marginBottom: 8,
  },
  icon: { marginVertical: 8 },
  scoreVal: {
    fontSize: 72,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    textShadowColor: '#FFD700',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  modeLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', color: '#5555AA', letterSpacing: 2, marginTop: 4 },
  stats: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statLabel: { fontSize: 14, fontFamily: 'Inter_500Medium', color: '#8888BB' },
  statVal: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  bestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  bestLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', color: '#5555AA' },
  bestVal: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#FFD700' },
  buttons: { gap: 12, paddingTop: 8 },
  playAgainBtn: { borderRadius: 18, overflow: 'hidden' },
  btnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  playAgainText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#FFFFFF', letterSpacing: 1 },
  btnPressed: { opacity: 0.85 },
  homeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  homeBtnText: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', letterSpacing: 1 },
});

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getShapeMergeLevel } from '@/constants/shapeMergeLevels';
import { usePlayer } from '@/context/PlayerContext';

const MIN_LEVELS_SHOWN = 15;
const LEVELS_AHEAD_PREVIEW = 6; // show a few locked levels beyond the frontier

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function ShapeMergeLevelsScreen() {
  const insets = useSafeAreaInsets();
  const { playerData } = usePlayer();
  const unlockedLevel = playerData.shapeMergeUnlockedLevel ?? 1;

  const levels = useMemo(() => {
    const count = Math.max(MIN_LEVELS_SHOWN, unlockedLevel + LEVELS_AHEAD_PREVIEW);
    return Array.from({ length: count }, (_, i) => getShapeMergeLevel(i + 1));
  }, [unlockedLevel]);

  return (
    <LinearGradient colors={['#070714', '#0D0D28', '#070714']} style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>SHAPE MERGE</Text>
          <Text style={styles.subtitle}>CHOOSE A LEVEL</Text>
        </View>
        <View style={styles.unlockedBadge}>
          <Ionicons name="trophy" size={12} color="#FFD700" />
          <Text style={styles.unlockedText}>{unlockedLevel}</Text>
        </View>
      </View>

      <FlatList
        data={levels}
        keyExtractor={(item) => String(item.level)}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        renderItem={({ item }) => {
          const isLocked = item.level > unlockedLevel;
          const isCurrent = item.level === unlockedLevel;
          const best = playerData.highScores[`shapemerge_L${item.level}`] ?? 0;
          const isCompleted = best >= item.target;

          return (
            <Pressable
              disabled={isLocked}
              onPress={() => router.push({ pathname: '/shape-merge', params: { level: String(item.level) } })}
              style={({ pressed }) => [
                styles.card,
                isLocked && styles.cardLocked,
                isCompleted && styles.cardCompleted,
                isCurrent && !isCompleted && styles.cardCurrent,
                pressed && !isLocked && styles.cardPressed,
              ]}
            >
              <View style={[
                styles.levelBadge,
                isCompleted && styles.levelBadgeCompleted,
                isLocked && styles.levelBadgeLocked,
              ]}>
                {isLocked ? (
                  <Ionicons name="lock-closed" size={16} color="#5555AA" />
                ) : isCompleted ? (
                  <Ionicons name="checkmark" size={20} color="#070714" />
                ) : (
                  <Text style={styles.levelBadgeNum}>{item.level}</Text>
                )}
              </View>

              <View style={styles.cardBody}>
                <Text style={[styles.cardTitle, isLocked && styles.textLocked]}>LEVEL {item.level}</Text>
                <View style={styles.cardMetaRow}>
                  <Ionicons name="flag-outline" size={12} color={isLocked ? '#3A3A5A' : '#FFD700'} />
                  <Text style={[styles.cardMeta, isLocked && styles.textLocked]}>{item.target.toLocaleString()}</Text>
                  <Ionicons name="time-outline" size={12} color={isLocked ? '#3A3A5A' : '#00D4FF'} style={{ marginLeft: 10 }} />
                  <Text style={[styles.cardMeta, isLocked && styles.textLocked]}>{formatClock(item.seconds)}</Text>
                </View>
                {best > 0 && (
                  <Text style={styles.bestText}>BEST {best.toLocaleString()}</Text>
                )}
              </View>

              {!isLocked && (
                <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.4)" />
              )}
            </Pressable>
          );
        }}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  title: { fontSize: 17, fontFamily: 'Inter_700Bold', color: '#FFFFFF', letterSpacing: 2 },
  subtitle: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: '#5E5CE6', letterSpacing: 2, marginTop: 2 },
  unlockedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,215,0,0.12)',
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.25)',
  },
  unlockedText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: '#FFD700' },

  list: { padding: 16, gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardLocked: { opacity: 0.5 },
  cardCurrent: { borderColor: 'rgba(94,92,230,0.5)', backgroundColor: 'rgba(94,92,230,0.08)' },
  cardCompleted: { borderColor: 'rgba(255,215,0,0.35)' },
  cardPressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },

  levelBadge: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(94,92,230,0.18)',
    borderWidth: 1, borderColor: 'rgba(94,92,230,0.35)',
  },
  levelBadgeCompleted: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  levelBadgeLocked: { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' },
  levelBadgeNum: { fontSize: 17, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },

  cardBody: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#FFFFFF', letterSpacing: 1 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardMeta: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: 'rgba(255,255,255,0.7)' },
  bestText: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: '#00E87A', letterSpacing: 0.5, marginTop: 1 },
  textLocked: { color: '#5555AA' },
});

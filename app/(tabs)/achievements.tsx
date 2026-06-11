import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ACHIEVEMENTS } from '@/constants/gameConfig';
import { usePlayer } from '@/context/PlayerContext';

const ACHIEVEMENT_ICONS: Record<string, { name: string; color: string }> = {
  first_score:  { name: 'star',              color: '#FFD700' },
  combo_5:      { name: 'flame',             color: '#FF9500' },
  combo_10:     { name: 'thunderstorm',      color: '#FF2D78' },
  score_500:    { name: 'trophy',            color: '#FFD700' },
  score_1000:   { name: 'ribbon',            color: '#BF5AF2' },
  gates_20:     { name: 'speedometer',       color: '#00D4FF' },
  gates_50:     { name: 'shield-checkmark',  color: '#00E87A' },
  streak_3:     { name: 'calendar',          color: '#FF9500' },
  streak_7:     { name: 'calendar-number',   color: '#FF2D78' },
  stars_50:     { name: 'star-half',         color: '#00D4FF' },
};

export default function AchievementsScreen() {
  const insets = useSafeAreaInsets();
  const { playerData } = usePlayer();

  const unlockedCount = ACHIEVEMENTS.filter(
    (a) => playerData.achievements[a.id]?.unlocked
  ).length;

  return (
    <LinearGradient colors={['#070714', '#0D0D28', '#070714']} style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>ACHIEVEMENTS</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{unlockedCount}/{ACHIEVEMENTS.length}</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressSection}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${(unlockedCount / ACHIEVEMENTS.length) * 100}%` },
            ]}
          />
        </View>
        <Text style={styles.progressLabel}>
          {unlockedCount === ACHIEVEMENTS.length
            ? 'All achievements unlocked!'
            : `${ACHIEVEMENTS.length - unlockedCount} remaining`}
        </Text>
      </View>

      <FlatList
        data={ACHIEVEMENTS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 20 }]}
        renderItem={({ item }) => {
          const state = playerData.achievements[item.id];
          const isUnlocked = state?.unlocked ?? false;
          const progress = state?.progress ?? 0;
          const progressPercent = Math.min(progress / item.target, 1);
          const iconInfo = ACHIEVEMENT_ICONS[item.id] ?? { name: 'medal', color: '#FFD700' };

          return (
            <View style={[styles.card, isUnlocked && styles.cardUnlocked]}>
              {isUnlocked && (
                <LinearGradient
                  colors={[iconInfo.color + '18', 'transparent']}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
              )}
              <View style={[styles.iconWrap, { backgroundColor: isUnlocked ? iconInfo.color + '22' : '#2A2A55' }]}>
                <Ionicons
                  name={iconInfo.name as any}
                  size={24}
                  color={isUnlocked ? iconInfo.color : '#444466'}
                />
              </View>
              <View style={styles.cardContent}>
                <View style={styles.cardTop}>
                  <Text style={[styles.achName, isUnlocked && { color: '#FFFFFF' }]}>{item.name}</Text>
                  {isUnlocked && (
                    <Ionicons name="checkmark-circle" size={16} color="#00E87A" />
                  )}
                </View>
                <Text style={styles.achDesc}>{item.description}</Text>

                {/* Progress bar */}
                <View style={styles.achProgress}>
                  <View style={styles.achProgressBar}>
                    <View
                      style={[
                        styles.achProgressFill,
                        {
                          width: `${progressPercent * 100}%`,
                          backgroundColor: isUnlocked ? iconInfo.color : '#5E5CE6',
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.achProgressText}>
                    {Math.min(progress, item.target)}/{item.target}
                  </Text>
                </View>

                {/* Reward */}
                <View style={styles.rewardRow}>
                  {item.rewardCoins > 0 && (
                    <View style={styles.rewardChip}>
                      <Ionicons name="logo-usd" size={11} color="#FFD700" />
                      <Text style={styles.rewardChipText}>{item.rewardCoins}</Text>
                    </View>
                  )}
                  {item.rewardStars > 0 && (
                    <View style={styles.rewardChip}>
                      <Ionicons name="star" size={11} color="#00D4FF" />
                      <Text style={styles.rewardChipText}>{item.rewardStars}</Text>
                    </View>
                  )}
                  {isUnlocked && <Text style={styles.claimedLabel}>REWARD CLAIMED</Text>}
                </View>
              </View>
            </View>
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
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  title: { flex: 1, fontSize: 18, fontFamily: 'Inter_700Bold', color: '#FFFFFF', letterSpacing: 3, textAlign: 'center' },
  countBadge: {
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#FFD700' },
  progressSection: { paddingHorizontal: 20, paddingVertical: 14, gap: 6 },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#FFD700', borderRadius: 3 },
  progressLabel: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#5555AA', textAlign: 'right' },
  list: { padding: 16, gap: 10 },
  card: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 18,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  cardUnlocked: { borderColor: 'rgba(255,215,0,0.2)' },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardContent: { flex: 1, gap: 4 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  achName: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#8888BB' },
  achDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#5555AA' },
  achProgress: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  achProgressBar: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  achProgressFill: { height: '100%', borderRadius: 2 },
  achProgressText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: '#5555AA', minWidth: 40, textAlign: 'right' },
  rewardRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  rewardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  rewardChipText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#FFFFFF' },
  claimedLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#00E87A', letterSpacing: 1, marginLeft: 'auto' },
});

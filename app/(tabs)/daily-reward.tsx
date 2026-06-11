import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayer } from '@/context/PlayerContext';

const REWARDS = [
  { day: 1, coins: 50, stars: 0 },
  { day: 2, coins: 75, stars: 0 },
  { day: 3, coins: 100, stars: 2 },
  { day: 4, coins: 125, stars: 0 },
  { day: 5, coins: 150, stars: 3 },
  { day: 6, coins: 200, stars: 0 },
  { day: 7, coins: 300, stars: 5 },
];

export default function DailyRewardScreen() {
  const insets = useSafeAreaInsets();
  const { playerData, claimDailyReward } = usePlayer();
  const today = new Date().toDateString();
  const alreadyClaimed = playerData.dailyRewardLastClaimed === today;
  const streak = playerData.loginStreak;
  const currentDayIndex = Math.min((streak - 1) % 7, 6);

  const [claimed, setClaimed] = useState(alreadyClaimed);
  const [claimedReward, setClaimedReward] = useState<{ coins: number; stars: number } | null>(null);
  const rewardScale = useRef(new Animated.Value(1)).current;
  const rewardOpacity = useRef(new Animated.Value(0)).current;

  const handleClaim = () => {
    if (claimed) return;
    const reward = claimDailyReward();
    setClaimed(true);
    setClaimedReward(reward);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.sequence([
      Animated.timing(rewardOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(rewardScale, { toValue: 1.15, friction: 4, useNativeDriver: true }),
      Animated.spring(rewardScale, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start();
  };

  return (
    <LinearGradient colors={['#070714', '#0A0820', '#070714']} style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.replace('/menu')} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>DAILY REWARD</Text>
        <View style={styles.streakBadge}>
          <Ionicons name="flame" size={14} color="#FF9500" />
          <Text style={styles.streakText}>{streak}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}>
        {/* Streak info */}
        <View style={styles.streakInfo}>
          <Text style={styles.streakTitle}>{streak}-Day Streak!</Text>
          <Text style={styles.streakSub}>Keep logging in daily to earn bigger rewards</Text>
        </View>

        {/* Reward grid */}
        <View style={styles.rewardGrid}>
          {REWARDS.map((reward, index) => {
            const isPast = index < currentDayIndex;
            const isCurrent = index === currentDayIndex;
            const isFuture = index > currentDayIndex;
            const dayIsClaimed = isPast || (isCurrent && claimed);

            return (
              <View
                key={reward.day}
                style={[
                  styles.rewardCard,
                  dayIsClaimed && styles.rewardCardClaimed,
                  isCurrent && !claimed && styles.rewardCardActive,
                  isFuture && styles.rewardCardFuture,
                ]}
              >
                {isCurrent && !claimed && (
                  <LinearGradient
                    colors={['#FFD70030', '#FF930030']}
                    style={StyleSheet.absoluteFill}
                  />
                )}
                <Text style={[styles.dayLabel, isCurrent && !claimed && styles.dayLabelActive]}>
                  Day {reward.day}
                </Text>
                {dayIsClaimed ? (
                  <Ionicons name="checkmark-circle" size={28} color="#00E87A" />
                ) : (
                  <Ionicons
                    name="gift"
                    size={28}
                    color={isCurrent ? '#FFD700' : '#2A2A55'}
                  />
                )}
                <View style={styles.rewardAmounts}>
                  <View style={styles.rewardItem}>
                    <Ionicons name="logo-usd" size={12} color="#FFD700" />
                    <Text style={styles.rewardAmount}>{reward.coins}</Text>
                  </View>
                  {reward.stars > 0 && (
                    <View style={styles.rewardItem}>
                      <Ionicons name="star" size={12} color="#00D4FF" />
                      <Text style={styles.rewardAmount}>{reward.stars}</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Claimed reward popup */}
        {claimedReward && (
          <Animated.View style={[styles.claimedBox, { transform: [{ scale: rewardScale }], opacity: rewardOpacity }]}>
            <LinearGradient colors={['#FFD700', '#FF9500']} style={styles.claimedGrad}>
              <Ionicons name="gift-outline" size={32} color="#070714" />
              <Text style={styles.claimedTitle}>Reward Claimed!</Text>
              <View style={styles.claimedItems}>
                {claimedReward.coins > 0 && (
                  <View style={styles.claimedItem}>
                    <Ionicons name="logo-usd" size={18} color="#070714" />
                    <Text style={styles.claimedAmount}>+{claimedReward.coins}</Text>
                  </View>
                )}
                {claimedReward.stars > 0 && (
                  <View style={styles.claimedItem}>
                    <Ionicons name="star" size={18} color="#070714" />
                    <Text style={styles.claimedAmount}>+{claimedReward.stars}</Text>
                  </View>
                )}
              </View>
            </LinearGradient>
          </Animated.View>
        )}

        {/* Claim button */}
        <View style={styles.btnContainer}>
          {!claimed ? (
            <Pressable
              style={({ pressed }) => [styles.claimBtn, pressed && styles.claimBtnPressed]}
              onPress={handleClaim}
            >
              <LinearGradient
                colors={['#FFD700', '#FF9500']}
                style={styles.claimBtnGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="gift" size={22} color="#070714" />
                <Text style={styles.claimBtnText}>CLAIM REWARD</Text>
              </LinearGradient>
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.continueBtn, pressed && styles.continueBtnPressed]}
              onPress={() => router.replace('/menu')}
            >
              <Text style={styles.continueBtnText}>CONTINUE</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </Pressable>
          )}
        </View>
      </ScrollView>
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
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,149,0,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  streakText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: '#FF9500' },
  scroll: { padding: 20 },
  streakInfo: { alignItems: 'center', marginBottom: 24 },
  streakTitle: { fontSize: 24, fontFamily: 'Inter_700Bold', color: '#FFFFFF', marginBottom: 4 },
  streakSub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#5555AA', textAlign: 'center' },
  rewardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 24 },
  rewardCard: {
    width: '30%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  rewardCardClaimed: { borderColor: 'rgba(0,232,122,0.25)', backgroundColor: 'rgba(0,232,122,0.05)' },
  rewardCardActive: { borderColor: '#FFD700', backgroundColor: 'rgba(255,215,0,0.05)' },
  rewardCardFuture: { opacity: 0.5 },
  dayLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#5555AA', letterSpacing: 1 },
  dayLabelActive: { color: '#FFD700' },
  rewardAmounts: { flexDirection: 'row', gap: 6 },
  rewardItem: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  rewardAmount: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#FFFFFF' },
  claimedBox: { marginBottom: 20, borderRadius: 20, overflow: 'hidden' },
  claimedGrad: { padding: 24, alignItems: 'center', gap: 8 },
  claimedTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: '#070714' },
  claimedItems: { flexDirection: 'row', gap: 20, marginTop: 4 },
  claimedItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  claimedAmount: { fontSize: 22, fontFamily: 'Inter_700Bold', color: '#070714' },
  btnContainer: { paddingTop: 8 },
  claimBtn: { borderRadius: 18, overflow: 'hidden' },
  claimBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  claimBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#070714', letterSpacing: 1 },
  claimBtnPressed: { opacity: 0.85 },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 18,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  continueBtnText: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', letterSpacing: 1 },
  continueBtnPressed: { opacity: 0.85 },
});

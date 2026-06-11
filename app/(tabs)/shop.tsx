import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ShapeRenderer } from '@/components/ShapeRenderer';
import { CHARACTERS, GAME_COLORS } from '@/constants/gameConfig';
import { useAds } from '@/context/AdContext';
import { usePlayer } from '@/context/PlayerContext';

const TABS = ['Characters', 'Packs'] as const;
type Tab = typeof TABS[number];

const COIN_PACKS = [
  { id: 'coins_100', label: '100 Coins', amount: 100, bonus: '', icon: '💰', color: '#FFD700' },
  { id: 'coins_500', label: '500 Coins', amount: 500, bonus: '+50 BONUS', icon: '💎', color: '#FF9500' },
  { id: 'coins_1000', label: '1000 Coins', amount: 1000, bonus: '+150 BONUS', icon: '👑', color: '#FF2D78' },
];

const STAR_PACKS = [
  { id: 'stars_10', label: '10 Stars', amount: 10, icon: '⭐', color: '#00D4FF' },
  { id: 'stars_50', label: '50 Stars', amount: 50, icon: '🌟', color: '#5E5CE6' },
  { id: 'stars_100', label: '100 Stars', amount: 100, icon: '✨', color: '#BF5AF2' },
];

export default function ShopScreen() {
  const insets = useSafeAreaInsets();
  const { playerData, unlockCharacter, spendCoins, spendStars, addCoins, addStars } = usePlayer();
  const { isRewardedAdLoaded, showRewardedAd } = useAds();
  const [activeTab, setActiveTab] = useState<Tab>('Characters');
  const [loadingAdId, setLoadingAdId] = useState<string | null>(null);

  const handleUnlockCharacter = (charId: string) => {
    const char = CHARACTERS.find((c) => c.id === charId);
    if (!char) return;
    const isUnlocked = playerData.unlockedCharacters.includes(charId);
    if (isUnlocked) { Alert.alert('Already Unlocked', `You already own ${char.name}!`); return; }

    const costStr = char.unlockCurrency === 'coins'
      ? `${char.unlockCost} coins`
      : `${char.unlockCost} stars`;

    Alert.alert(`Unlock ${char.name}?`, `Cost: ${costStr}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unlock',
        onPress: () => {
          const ok = char.unlockCurrency === 'coins'
            ? spendCoins(char.unlockCost)
            : spendStars(char.unlockCost);
          if (ok) {
            unlockCharacter(charId);
            Alert.alert('Unlocked!', `${char.name} is now yours!`);
          } else {
            Alert.alert('Insufficient funds', `You need ${costStr}.`);
          }
        },
      },
    ]);
  };

  const handleWatchAd = (packId: string, type: 'coins' | 'stars', amount: number) => {
    if (!isRewardedAdLoaded) {
      Alert.alert(
        'Ad Not Available',
        'No ad is ready right now. Play a game and come back — ads reload automatically.',
        [{ text: 'OK' }],
      );
      return;
    }

    setLoadingAdId(packId);

    showRewardedAd((earned) => {
      setLoadingAdId(null);
      if (earned) {
        if (type === 'coins') {
          addCoins(amount);
          Alert.alert(
            '💰 Reward Earned!',
            `You earned ${amount} coins! Your new balance: ${playerData.coins + amount} coins.`,
            [{ text: 'Great!' }],
          );
        } else {
          addStars(amount);
          Alert.alert(
            '⭐ Reward Earned!',
            `You earned ${amount} stars! Your new balance: ${playerData.stars + amount} stars.`,
            [{ text: 'Great!' }],
          );
        }
      } else {
        Alert.alert(
          'No Reward',
          'Watch the full ad to earn your reward.',
          [{ text: 'OK' }],
        );
      }
    });
  };

  return (
    <LinearGradient colors={['#070714', '#0D0D28', '#070714']} style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>SHOP</Text>
        <View style={styles.balance}>
          <Ionicons name="logo-usd" size={14} color="#FFD700" />
          <Text style={styles.balanceText}>{playerData.coins}</Text>
          <Ionicons name="star" size={14} color="#00D4FF" style={{ marginLeft: 6 }} />
          <Text style={styles.balanceText}>{playerData.stars}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {activeTab === 'Characters' && (
          <View style={styles.charGrid}>
            {CHARACTERS.filter((c) => c.unlockCurrency !== 'free').map((char) => {
              const isUnlocked = playerData.unlockedCharacters.includes(char.id);
              const colorHex = GAME_COLORS[char.defaultColor];
              return (
                <Pressable
                  key={char.id}
                  style={({ pressed }) => [styles.charCard, isUnlocked && styles.charCardOwned, pressed && styles.cardPressed]}
                  onPress={() => handleUnlockCharacter(char.id)}
                >
                  <View style={styles.charShape}>
                    <ShapeRenderer
                      shape={char.defaultShape}
                      color={isUnlocked ? colorHex : '#444466'}
                      size={50}
                    />
                    {isUnlocked && (
                      <View style={styles.ownedBadge}>
                        <Ionicons name="checkmark" size={10} color="#070714" />
                      </View>
                    )}
                  </View>
                  <Text style={[styles.charName, { color: isUnlocked ? colorHex : '#FFFFFF' }]}>{char.name}</Text>
                  <Text style={styles.charDesc}>{char.description}</Text>
                  {isUnlocked ? (
                    <Text style={styles.ownedText}>OWNED</Text>
                  ) : (
                    <View style={styles.priceRow}>
                      <Ionicons
                        name={char.unlockCurrency === 'coins' ? 'logo-usd' : 'star'}
                        size={12}
                        color={char.unlockCurrency === 'coins' ? '#FFD700' : '#00D4FF'}
                      />
                      <Text style={[styles.priceText, { color: char.unlockCurrency === 'coins' ? '#FFD700' : '#00D4FF' }]}>
                        {char.unlockCost}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}

        {activeTab === 'Packs' && (
          <View style={styles.packsContainer}>
            <Text style={styles.packSection}>COIN PACKS</Text>
            {COIN_PACKS.map((pack) => {
              const isLoading = loadingAdId === pack.id;
              return (
                <Pressable
                  key={pack.id}
                  style={({ pressed }) => [styles.packCard, pressed && styles.cardPressed, isLoading && styles.packCardLoading]}
                  onPress={() => handleWatchAd(pack.id, 'coins', pack.amount)}
                  disabled={isLoading}
                >
                  <View style={[styles.packIcon, { backgroundColor: pack.color + '22' }]}>
                    <Text style={styles.packEmoji}>{pack.icon}</Text>
                  </View>
                  <View style={styles.packInfo}>
                    <Text style={styles.packLabel}>{pack.label}</Text>
                    {pack.bonus ? <Text style={styles.packBonus}>{pack.bonus}</Text> : null}
                  </View>
                  <View style={styles.packAction}>
                    <Ionicons
                      name={isLoading ? 'hourglass-outline' : isRewardedAdLoaded ? 'play-circle' : 'play-circle-outline'}
                      size={20}
                      color={isRewardedAdLoaded ? pack.color : '#444466'}
                    />
                    <Text style={[styles.packActionText, { color: isRewardedAdLoaded ? pack.color : '#444466' }]}>
                      {isLoading ? 'Loading…' : 'Watch Ad'}
                    </Text>
                  </View>
                </Pressable>
              );
            })}

            <Text style={[styles.packSection, { marginTop: 24 }]}>STAR PACKS</Text>
            {STAR_PACKS.map((pack) => {
              const isLoading = loadingAdId === pack.id;
              return (
                <Pressable
                  key={pack.id}
                  style={({ pressed }) => [styles.packCard, pressed && styles.cardPressed, isLoading && styles.packCardLoading]}
                  onPress={() => handleWatchAd(pack.id, 'stars', pack.amount)}
                  disabled={isLoading}
                >
                  <View style={[styles.packIcon, { backgroundColor: pack.color + '22' }]}>
                    <Text style={styles.packEmoji}>{pack.icon}</Text>
                  </View>
                  <View style={styles.packInfo}>
                    <Text style={styles.packLabel}>{pack.label}</Text>
                  </View>
                  <View style={styles.packAction}>
                    <Ionicons
                      name={isLoading ? 'hourglass-outline' : isRewardedAdLoaded ? 'play-circle' : 'play-circle-outline'}
                      size={20}
                      color={isRewardedAdLoaded ? pack.color : '#444466'}
                    />
                    <Text style={[styles.packActionText, { color: isRewardedAdLoaded ? pack.color : '#444466' }]}>
                      {isLoading ? 'Loading…' : 'Watch Ad'}
                    </Text>
                  </View>
                </Pressable>
              );
            })}

            <View style={styles.adNote}>
              <Ionicons name="information-circle-outline" size={16} color="#5555AA" />
              <Text style={styles.adNoteText}>
                {isRewardedAdLoaded ? 'Ads are ready — tap Watch Ad to earn rewards.' : 'Ads are loading… play a game and check back.'}
              </Text>
            </View>
          </View>
        )}
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
  balance: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  balanceText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#FFFFFF' },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 4,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: '#FFD700' },
  tabText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#5555AA' },
  tabTextActive: { color: '#070714' },
  scroll: { padding: 16, paddingBottom: 40 },
  charGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  charCard: {
    width: '47%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  charCardOwned: { borderColor: 'rgba(255,215,0,0.2)' },
  cardPressed: { opacity: 0.8, transform: [{ scale: 0.96 }] },
  charShape: { position: 'relative' },
  ownedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#00E87A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  charName: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  charDesc: { fontSize: 11, fontFamily: 'Inter_400Regular', color: '#5555AA', textAlign: 'center' },
  ownedText: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: '#00E87A', letterSpacing: 1 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  priceText: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  packsContainer: { gap: 10 },
  packSection: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#5555AA', letterSpacing: 2, marginBottom: 4 },
  packCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  packCardLoading: { opacity: 0.6 },
  packIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  packEmoji: { fontSize: 22 },
  packInfo: { flex: 1 },
  packLabel: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#FFFFFF' },
  packBonus: { fontSize: 11, fontFamily: 'Inter_700Bold', color: '#00E87A', marginTop: 2 },
  packAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  packActionText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  adNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingTop: 20,
    paddingHorizontal: 4,
  },
  adNoteText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', color: '#5555AA', lineHeight: 18 },
});

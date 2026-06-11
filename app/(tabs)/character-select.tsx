import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ShapeRenderer } from '@/components/ShapeRenderer';
import { CHARACTERS, GAME_COLORS } from '@/constants/gameConfig';
import { usePlayer } from '@/context/PlayerContext';

export default function CharacterSelectScreen() {
  const insets = useSafeAreaInsets();
  const { playerData, selectCharacter, unlockCharacter, spendCoins, spendStars } = usePlayer();
  const [selected, setSelected] = useState(playerData.selectedCharacter);

  const handleSelect = (charId: string) => {
    const isUnlocked = playerData.unlockedCharacters.includes(charId);
    if (!isUnlocked) return;
    setSelected(charId);
    selectCharacter(charId);
  };

  const handleUnlock = (charId: string) => {
    const char = CHARACTERS.find((c) => c.id === charId);
    if (!char) return;

    const costStr = char.unlockCurrency === 'coins'
      ? `${char.unlockCost} coins`
      : `${char.unlockCost} stars`;

    Alert.alert(
      `Unlock ${char.name}?`,
      `This will cost ${costStr}.\n\nYour balance: ${char.unlockCurrency === 'coins' ? playerData.coins : playerData.stars} ${char.unlockCurrency}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlock',
          style: 'default',
          onPress: () => {
            const success = char.unlockCurrency === 'coins'
              ? spendCoins(char.unlockCost)
              : spendStars(char.unlockCost);
            if (success) {
              unlockCharacter(charId);
              Alert.alert('Unlocked!', `${char.name} is now yours!`);
            } else {
              Alert.alert(
                'Not enough!',
                `You need ${costStr} to unlock ${char.name}.`,
              );
            }
          },
        },
      ]
    );
  };

  return (
    <LinearGradient colors={['#070714', '#0D0D28', '#070714']} style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>CHARACTERS</Text>
        <View style={styles.balance}>
          <Ionicons name="logo-usd" size={14} color="#FFD700" />
          <Text style={styles.balanceText}>{playerData.coins}</Text>
          <Ionicons name="star" size={14} color="#00D4FF" style={{ marginLeft: 8 }} />
          <Text style={styles.balanceText}>{playerData.stars}</Text>
        </View>
      </View>

      <FlatList
        data={CHARACTERS}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => {
          const isUnlocked = playerData.unlockedCharacters.includes(item.id);
          const isSelected = selected === item.id;
          const colorHex = GAME_COLORS[item.defaultColor];

          return (
            <Pressable
              style={({ pressed }) => [
                styles.card,
                isSelected && styles.cardSelected,
                !isUnlocked && styles.cardLocked,
                pressed && styles.cardPressed,
              ]}
              onPress={() => isUnlocked ? handleSelect(item.id) : handleUnlock(item.id)}
            >
              {isSelected && (
                <LinearGradient
                  colors={[colorHex + '40', colorHex + '10']}
                  style={StyleSheet.absoluteFill}
                />
              )}

              <View style={[styles.shapeContainer, isSelected && { borderColor: colorHex }]}>
                <ShapeRenderer
                  shape={item.defaultShape}
                  color={isUnlocked ? colorHex : '#444466'}
                  size={52}
                />
                {!isUnlocked && (
                  <View style={styles.lockOverlay}>
                    <Ionicons name="lock-closed" size={20} color="#FFFFFF" />
                  </View>
                )}
              </View>

              <Text style={[styles.charName, isSelected && { color: colorHex }]}>{item.name}</Text>
              <Text style={styles.charDesc}>{item.description}</Text>

              {isUnlocked ? (
                isSelected ? (
                  <View style={[styles.badge, { backgroundColor: colorHex }]}>
                    <Ionicons name="checkmark" size={12} color="#070714" />
                    <Text style={styles.badgeText}>SELECTED</Text>
                  </View>
                ) : (
                  <Text style={styles.selectText}>TAP TO SELECT</Text>
                )
              ) : (
                <View style={styles.costRow}>
                  <Ionicons
                    name={item.unlockCurrency === 'coins' ? 'logo-usd' : 'star'}
                    size={12}
                    color={item.unlockCurrency === 'coins' ? '#FFD700' : '#00D4FF'}
                  />
                  <Text style={[
                    styles.costText,
                    { color: item.unlockCurrency === 'coins' ? '#FFD700' : '#00D4FF' }
                  ]}>
                    {item.unlockCost}
                  </Text>
                </View>
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
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  title: {
    flex: 1,
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    letterSpacing: 3,
    textAlign: 'center',
  },
  balance: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  balanceText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#FFFFFF' },
  grid: { padding: 12, gap: 12 },
  row: { gap: 12 },
  card: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  cardSelected: {
    borderColor: 'transparent',
  },
  cardLocked: { opacity: 0.85 },
  cardPressed: { opacity: 0.8, transform: [{ scale: 0.96 }] },
  shapeContainer: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  lockOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(7,7,20,0.6)',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  charName: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
  charDesc: { fontSize: 11, fontFamily: 'Inter_400Regular', color: '#5555AA', textAlign: 'center' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#070714', letterSpacing: 1 },
  selectText: { fontSize: 10, fontFamily: 'Inter_500Medium', color: '#5555AA', letterSpacing: 1 },
  costRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  costText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
});

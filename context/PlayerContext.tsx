import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { ACHIEVEMENTS, Achievement, GameMode } from '@/constants/gameConfig';

const STORAGE_KEY = 'rangRoopBadal_playerData_v1';

interface AchievementState {
  progress: number;
  unlocked: boolean;
}

interface PlayerSettings {
  music: boolean;
  sfx: boolean;
  vibration: boolean;
}

interface PlayerData {
  coins: number;
  stars: number;
  totalStarsEarned: number;
  unlockedCharacters: string[];
  selectedCharacter: string;
  highScores: Record<string, number>;
  achievements: Record<string, AchievementState>;
  settings: PlayerSettings;
  loginStreak: number;
  lastLoginDate: string;
  dailyRewardClaimed: boolean;
  dailyRewardLastClaimed: string;
  totalGamesPlayed: number;
  snakeWinStreak: number;
  shapeMergeUnlockedLevel: number;
}

const DEFAULT_DATA: PlayerData = {
  coins: 100,
  stars: 0,
  totalStarsEarned: 0,
  unlockedCharacters: ['default'],
  selectedCharacter: 'default',
  highScores: {},
  achievements: {},
  settings: { music: true, sfx: true, vibration: true },
  loginStreak: 0,
  lastLoginDate: '',
  dailyRewardClaimed: false,
  dailyRewardLastClaimed: '',
  totalGamesPlayed: 0,
  snakeWinStreak: 0,
  shapeMergeUnlockedLevel: 1,
};

interface PlayerContextValue {
  playerData: PlayerData;
  loaded: boolean;
  addCoins: (amount: number) => void;
  spendCoins: (amount: number) => boolean;
  addStars: (amount: number) => void;
  spendStars: (amount: number) => boolean;
  unlockCharacter: (characterId: string) => void;
  selectCharacter: (characterId: string) => void;
  updateHighScore: (mode: GameMode | string, score: number) => void;
  updateAchievementProgress: (achievementId: string, progress: number) => void;
  claimDailyReward: () => { coins: number; stars: number };
  checkAndUpdateLoginStreak: () => { isNew: boolean; streak: number; hasDailyReward: boolean };
  updateSettings: (settings: Partial<PlayerSettings>) => void;
  resetData: () => void;
  incrementGamesPlayed: () => void;
  updateSnakeWinStreak: (won: boolean) => number;
  unlockShapeMergeLevel: (level: number) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [playerData, setPlayerData] = useState<PlayerData>(DEFAULT_DATA);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((json) => {
      if (json) {
        try {
          const saved = JSON.parse(json) as PlayerData;
          setPlayerData({ ...DEFAULT_DATA, ...saved });
        } catch {
          setPlayerData(DEFAULT_DATA);
        }
      }
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(playerData));
  }, [playerData, loaded]);

  const addCoins = useCallback((amount: number) => {
    setPlayerData((prev) => ({ ...prev, coins: prev.coins + amount }));
  }, []);

  const spendCoins = useCallback((amount: number): boolean => {
    let success = false;
    setPlayerData((prev) => {
      if (prev.coins >= amount) {
        success = true;
        return { ...prev, coins: prev.coins - amount };
      }
      return prev;
    });
    return success;
  }, []);

  const updateAchievementProgress = useCallback((achievementId: string, progress: number) => {
    setPlayerData((prev) => {
      const achievement = ACHIEVEMENTS.find((a) => a.id === achievementId);
      if (!achievement) return prev;

      const existing = prev.achievements[achievementId];
      if (existing?.unlocked) return prev;

      const newProgress = Math.max(existing?.progress ?? 0, progress);
      const shouldUnlock = newProgress >= achievement.target;

      const updated: PlayerData = {
        ...prev,
        achievements: {
          ...prev.achievements,
          [achievementId]: { progress: newProgress, unlocked: shouldUnlock },
        },
      };

      if (shouldUnlock && !existing?.unlocked) {
        updated.coins += achievement.rewardCoins;
        updated.stars += achievement.rewardStars;
        updated.totalStarsEarned += achievement.rewardStars;
      }

      return updated;
    });
  }, []);

  const addStars = useCallback((amount: number) => {
    let newTotalStarsEarned = 0;
    setPlayerData((prev) => {
      newTotalStarsEarned = prev.totalStarsEarned + amount;
      return {
        ...prev,
        stars: prev.stars + amount,
        totalStarsEarned: newTotalStarsEarned,
      };
    });
    updateAchievementProgress('stars_50', newTotalStarsEarned);
  }, [updateAchievementProgress]);

  const spendStars = useCallback((amount: number): boolean => {
    let success = false;
    setPlayerData((prev) => {
      if (prev.stars >= amount) {
        success = true;
        return { ...prev, stars: prev.stars - amount };
      }
      return prev;
    });
    return success;
  }, []);

  const unlockCharacter = useCallback((characterId: string) => {
    setPlayerData((prev) => {
      if (prev.unlockedCharacters.includes(characterId)) return prev;
      return { ...prev, unlockedCharacters: [...prev.unlockedCharacters, characterId] };
    });
  }, []);

  const selectCharacter = useCallback((characterId: string) => {
    setPlayerData((prev) => ({ ...prev, selectedCharacter: characterId }));
  }, []);

  const updateHighScore = useCallback((mode: GameMode | string, score: number) => {
    setPlayerData((prev) => {
      const currentBest = prev.highScores[mode] ?? 0;
      if (score <= currentBest) return prev;
      return { ...prev, highScores: { ...prev.highScores, [mode]: score } };
    });
  }, []);

  const claimDailyReward = useCallback((): { coins: number; stars: number } => {
    let reward = { coins: 0, stars: 0 };
    let newTotalStarsEarned = 0;
    setPlayerData((prev) => {
      const today = new Date().toDateString();
      if (prev.dailyRewardLastClaimed === today) return prev;

      const dayIndex = Math.min((prev.loginStreak - 1) % 7, 6);
      const { coins: c, stars: s } = [
        { coins: 50, stars: 0 },
        { coins: 75, stars: 0 },
        { coins: 100, stars: 2 },
        { coins: 125, stars: 0 },
        { coins: 150, stars: 3 },
        { coins: 200, stars: 0 },
        { coins: 300, stars: 5 },
      ][dayIndex];

      reward = { coins: c, stars: s };
      newTotalStarsEarned = prev.totalStarsEarned + s;
      return {
        ...prev,
        coins: prev.coins + c,
        stars: prev.stars + s,
        totalStarsEarned: newTotalStarsEarned,
        dailyRewardClaimed: true,
        dailyRewardLastClaimed: today,
      };
    });
    if (reward.stars > 0) updateAchievementProgress('stars_50', newTotalStarsEarned);
    return reward;
  }, [updateAchievementProgress]);

  const checkAndUpdateLoginStreak = useCallback((): {
    isNew: boolean;
    streak: number;
    hasDailyReward: boolean;
  } => {
    let result = { isNew: false, streak: 0, hasDailyReward: false };
    setPlayerData((prev) => {
      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();

      if (prev.lastLoginDate === today) {
        result = {
          isNew: false,
          streak: prev.loginStreak,
          hasDailyReward: prev.dailyRewardLastClaimed !== today,
        };
        return prev;
      }

      const newStreak =
        prev.lastLoginDate === yesterday ? prev.loginStreak + 1 : 1;

      result = {
        isNew: true,
        streak: newStreak,
        hasDailyReward: prev.dailyRewardLastClaimed !== today,
      };

      return { ...prev, lastLoginDate: today, loginStreak: newStreak };
    });
    if (result.isNew) {
      updateAchievementProgress('streak_3', result.streak);
      updateAchievementProgress('streak_7', result.streak);
    }
    return result;
  }, [updateAchievementProgress]);

  const updateSettings = useCallback((settings: Partial<PlayerSettings>) => {
    setPlayerData((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...settings },
    }));
  }, []);

  const resetData = useCallback(() => {
    setPlayerData(DEFAULT_DATA);
  }, []);

  const incrementGamesPlayed = useCallback(() => {
    setPlayerData((prev) => ({
      ...prev,
      totalGamesPlayed: prev.totalGamesPlayed + 1,
    }));
  }, []);

  const updateSnakeWinStreak = useCallback((won: boolean): number => {
    let newStreak = 0;
    setPlayerData((prev) => {
      newStreak = won ? prev.snakeWinStreak + 1 : 0;
      // Milestone coin bonuses: 3-streak=+15, 5-streak=+30, 10-streak=+75
      let bonus = 0;
      if (won) {
        if (newStreak === 3)  bonus = 15;
        if (newStreak === 5)  bonus = 30;
        if (newStreak === 10) bonus = 75;
      }
      return { ...prev, snakeWinStreak: newStreak, coins: prev.coins + bonus };
    });
    return newStreak;
  }, []);

  const unlockShapeMergeLevel = useCallback((level: number) => {
    setPlayerData((prev) => ({
      ...prev,
      shapeMergeUnlockedLevel: Math.max(prev.shapeMergeUnlockedLevel, level),
    }));
  }, []);

  return (
    <PlayerContext.Provider
      value={{
        playerData,
        loaded,
        addCoins,
        spendCoins,
        addStars,
        spendStars,
        unlockCharacter,
        selectCharacter,
        updateHighScore,
        updateAchievementProgress,
        claimDailyReward,
        checkAndUpdateLoginStreak,
        updateSettings,
        resetData,
        incrementGamesPlayed,
        updateSnakeWinStreak,
        unlockShapeMergeLevel,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}

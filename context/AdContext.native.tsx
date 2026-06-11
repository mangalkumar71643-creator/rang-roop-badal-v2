import React, { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import MobileAds, { useInterstitialAd, useRewardedAd } from 'react-native-google-mobile-ads';
import { AD_IDS, INTERSTITIAL_GAMES_MAX, INTERSTITIAL_GAMES_MIN } from '@/constants/adConfig';

interface AdContextValue {
  isRewardedAdLoaded: boolean;
  showRewardedAd: (onResult: (earned: boolean) => void) => void;
  onGameCompleted: () => void;
}

const AdContext = createContext<AdContextValue | null>(null);

const isNative = Platform.OS === 'android' || Platform.OS === 'ios';

function AdProviderNative({ children }: { children: React.ReactNode }) {
  const {
    isLoaded: isRewardedLoaded,
    isClosed: isRewardedClosed,
    load: loadRewarded,
    show: showRewarded,
    reward,
  } = useRewardedAd(AD_IDS.REWARDED);

  const {
    isLoaded: isIntLoaded,
    isClosed: isIntClosed,
    load: loadInt,
    show: showInt,
  } = useInterstitialAd(AD_IDS.INTERSTITIAL);

  const pendingCallbackRef = useRef<((earned: boolean) => void) | null>(null);
  const gameCounterRef = useRef(0);
  const targetRef = useRef(
    INTERSTITIAL_GAMES_MIN + Math.floor(Math.random() * (INTERSTITIAL_GAMES_MAX - INTERSTITIAL_GAMES_MIN + 1)),
  );

  useEffect(() => {
    MobileAds()
      .initialize()
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadRewarded();
  }, []);

  useEffect(() => {
    loadInt();
  }, []);

  useEffect(() => {
    if (!isRewardedClosed) return;
    const earned = !!reward;
    pendingCallbackRef.current?.(earned);
    pendingCallbackRef.current = null;
    loadRewarded();
  }, [isRewardedClosed]);

  useEffect(() => {
    if (!isIntClosed) return;
    loadInt();
  }, [isIntClosed]);

  const showRewardedAd = useCallback(
    (onResult: (earned: boolean) => void) => {
      if (!isRewardedLoaded) {
        onResult(false);
        return;
      }
      pendingCallbackRef.current = onResult;
      try {
        showRewarded();
      } catch {
        pendingCallbackRef.current = null;
        onResult(false);
      }
    },
    [isRewardedLoaded, showRewarded],
  );

  const onGameCompleted = useCallback(() => {
    gameCounterRef.current++;
    if (gameCounterRef.current >= targetRef.current) {
      gameCounterRef.current = 0;
      targetRef.current =
        INTERSTITIAL_GAMES_MIN +
        Math.floor(Math.random() * (INTERSTITIAL_GAMES_MAX - INTERSTITIAL_GAMES_MIN + 1));
      if (isIntLoaded) {
        try {
          showInt();
        } catch {
        }
      }
    }
  }, [isIntLoaded, showInt]);

  return (
    <AdContext.Provider value={{ isRewardedAdLoaded: isRewardedLoaded, showRewardedAd, onGameCompleted }}>
      {children}
    </AdContext.Provider>
  );
}

function AdProviderWeb({ children }: { children: React.ReactNode }) {
  const showRewardedAd = useCallback((onResult: (earned: boolean) => void) => {
    onResult(false);
  }, []);
  const onGameCompleted = useCallback(() => {}, []);
  return (
    <AdContext.Provider value={{ isRewardedAdLoaded: false, showRewardedAd, onGameCompleted }}>
      {children}
    </AdContext.Provider>
  );
}

export function AdProvider({ children }: { children: React.ReactNode }) {
  if (!isNative) return <AdProviderWeb>{children}</AdProviderWeb>;
  return <AdProviderNative>{children}</AdProviderNative>;
}

export function useAds(): AdContextValue {
  const ctx = useContext(AdContext);
  if (!ctx) throw new Error('useAds must be used within AdProvider');
  return ctx;
}

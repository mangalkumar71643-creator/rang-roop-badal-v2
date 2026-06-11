import React, { createContext, useCallback, useContext } from 'react';

interface AdContextValue {
  isRewardedAdLoaded: boolean;
  showRewardedAd: (onResult: (earned: boolean) => void) => void;
  onGameCompleted: () => void;
}

const AdContext = createContext<AdContextValue | null>(null);

export function AdProvider({ children }: { children: React.ReactNode }) {
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

export function useAds(): AdContextValue {
  const ctx = useContext(AdContext);
  if (!ctx) throw new Error('useAds must be used within AdProvider');
  return ctx;
}

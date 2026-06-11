// ─────────────────────────────────────────────────────────────────────────────
// AdMob Configuration
//
// BEFORE PUBLISHING TO PLAY STORE:
//   1. Replace ANDROID_APP_ID with your real AdMob App ID
//   2. Replace REWARDED with your real Rewarded Ad Unit ID
//   3. Replace INTERSTITIAL with your real Interstitial Ad Unit ID
//   4. Update androidAppId in app.json plugins section to match
//   5. Run EAS Build again to apply the new IDs
//
// Get your IDs at: https://apps.admob.com
// ─────────────────────────────────────────────────────────────────────────────

// ⚠️  CURRENTLY USING GOOGLE TEST IDs — REPLACE BEFORE PUBLISHING  ⚠️
export const AD_IDS = {
  ANDROID_APP_ID: 'ca-app-pub-3940256099942544~3347511713', // ← REPLACE WITH YOUR APP ID
  REWARDED:       'ca-app-pub-3940256099942544/5224354917',  // ← REPLACE WITH YOUR REWARDED UNIT ID
  INTERSTITIAL:   'ca-app-pub-3940256099942544/1033173712',  // ← REPLACE WITH YOUR INTERSTITIAL UNIT ID
};

// Number of completed games between interstitial ads (randomly picks 4 or 5)
export const INTERSTITIAL_GAMES_MIN = 4;
export const INTERSTITIAL_GAMES_MAX = 5;

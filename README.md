# Rang Roop Badal (रंग रूप बदल)

  A color + shape matching casual mobile game built with **React Native + Expo SDK 54**.

  ## Features
  - 3 game modes: Classic, Endless, Challenge
  - 6 playable characters to unlock
  - Daily rewards & achievements
  - Google AdMob rewarded ads (Shop) + interstitial ads (every 4–5 games)
  - Haptic feedback, combo multipliers, danger mode

  ## Stack
  - Expo SDK 54 / React Native 0.81.5
  - expo-router v6 (file-based navigation)
  - react-native-google-mobile-ads
  - react-native-reanimated, react-native-svg
  - EAS Build (Android APK + AAB)

  ## Build
  ```bash
  pnpm install
  pnpm exec eas build -p android --profile preview   # APK
  pnpm exec eas build -p android --profile production # AAB
  ```
  
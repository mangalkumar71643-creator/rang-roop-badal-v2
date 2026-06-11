import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayer } from '@/context/PlayerContext';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { playerData, updateSettings, resetData } = usePlayer();
  const { settings } = playerData;

  const handleReset = () => {
    Alert.alert(
      'Reset All Data?',
      'This will permanently delete your progress, coins, stars, and unlocked characters. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            resetData();
            router.replace('/');
          },
        },
      ]
    );
  };

  return (
    <LinearGradient colors={['#070714', '#0D0D28', '#070714']} style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>SETTINGS</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}>
        {/* Audio section */}
        <Text style={styles.sectionTitle}>AUDIO</Text>
        <View style={styles.section}>
          {[
            { key: 'music' as const, label: 'Music', desc: 'Background music', icon: 'musical-notes' as const },
            { key: 'sfx' as const, label: 'Sound Effects', desc: 'Game sounds & feedback', icon: 'volume-high' as const },
          ].map((item) => (
            <View key={item.key} style={styles.row}>
              <View style={[styles.rowIcon, { backgroundColor: 'rgba(255,215,0,0.15)' }]}>
                <Ionicons name={item.icon} size={18} color="#FFD700" />
              </View>
              <View style={styles.rowInfo}>
                <Text style={styles.rowLabel}>{item.label}</Text>
                <Text style={styles.rowDesc}>{item.desc}</Text>
              </View>
              <Switch
                value={settings[item.key]}
                onValueChange={(val) => updateSettings({ [item.key]: val })}
                trackColor={{ false: '#2A2A55', true: '#FFD700' }}
                thumbColor={settings[item.key] ? '#070714' : '#5555AA'}
              />
            </View>
          ))}

          <View style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: 'rgba(0,232,122,0.15)' }]}>
              <Ionicons name="phone-portrait" size={18} color="#00E87A" />
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowLabel}>Vibration</Text>
              <Text style={styles.rowDesc}>Haptic feedback on actions</Text>
            </View>
            <Switch
              value={settings.vibration}
              onValueChange={(val) => updateSettings({ vibration: val })}
              trackColor={{ false: '#2A2A55', true: '#00E87A' }}
              thumbColor={settings.vibration ? '#070714' : '#5555AA'}
            />
          </View>
        </View>

        {/* Stats section */}
        <Text style={styles.sectionTitle}>STATS</Text>
        <View style={styles.section}>
          {[
            { label: 'Total Games', value: playerData.totalGamesPlayed, color: '#00D4FF' },
            { label: 'Coins Collected', value: playerData.coins, color: '#FFD700' },
            { label: 'Stars Earned', value: playerData.totalStarsEarned, color: '#00D4FF' },
            { label: 'Login Streak', value: `${playerData.loginStreak} days`, color: '#FF9500' },
          ].map((stat) => (
            <View key={stat.label} style={styles.statRow}>
              <Text style={styles.statLabel}>{stat.label}</Text>
              <Text style={[styles.statVal, { color: stat.color }]}>{stat.value}</Text>
            </View>
          ))}
        </View>

        {/* High scores */}
        <Text style={styles.sectionTitle}>HIGH SCORES</Text>
        <View style={styles.section}>
          {['classic', 'endless', 'challenge'].map((mode) => (
            <View key={mode} style={styles.statRow}>
              <Text style={styles.statLabel}>{mode.charAt(0).toUpperCase() + mode.slice(1)}</Text>
              <Text style={styles.statVal}>{playerData.highScores[mode] ?? '—'}</Text>
            </View>
          ))}
        </View>

        {/* About */}
        <Text style={styles.sectionTitle}>ABOUT</Text>
        <View style={styles.section}>
          <View style={styles.aboutCard}>
            <Text style={styles.aboutTitle}>Rang Roop Badal</Text>
            <Text style={styles.aboutDesc}>रंग रूप बदल • Change Color, Change Shape</Text>
            <Text style={styles.aboutVersion}>Version 1.0.0</Text>
          </View>
          <View style={styles.howToCard}>
            <Text style={styles.howToTitle}>HOW TO PLAY</Text>
            <Text style={styles.howToLine}>• Gates fall from the top</Text>
            <Text style={styles.howToLine}>• Match the gate's COLOR and SHAPE</Text>
            <Text style={styles.howToLine}>• Single tap = Change Color</Text>
            <Text style={styles.howToLine}>• Double tap = Change Shape</Text>
            <Text style={styles.howToLine}>• Build combos for bigger scores!</Text>
          </View>
        </View>

        {/* Danger zone */}
        <Text style={styles.sectionTitle}>DANGER ZONE</Text>
        <View style={styles.section}>
          <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
            <Ionicons name="trash-outline" size={18} color="#FF4444" />
            <Text style={styles.resetBtnText}>Reset All Data</Text>
          </TouchableOpacity>
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
  scroll: { padding: 20, gap: 8 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: '#5555AA',
    letterSpacing: 2,
    marginTop: 12,
    marginBottom: 6,
    marginLeft: 4,
  },
  section: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  rowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowInfo: { flex: 1 },
  rowLabel: { fontSize: 15, fontFamily: 'Inter_500Medium', color: '#FFFFFF' },
  rowDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#5555AA', marginTop: 1 },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  statLabel: { fontSize: 14, fontFamily: 'Inter_500Medium', color: '#8888BB' },
  statVal: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
  aboutCard: { padding: 20, alignItems: 'center', gap: 4 },
  aboutTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#FFD700' },
  aboutDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#5555AA' },
  aboutVersion: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#3A3A66', marginTop: 4 },
  howToCard: { padding: 20, gap: 6, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)' },
  howToTitle: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#5555AA', letterSpacing: 2, marginBottom: 4 },
  howToLine: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#8888BB' },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
  },
  resetBtnText: { fontSize: 15, fontFamily: 'Inter_500Medium', color: '#FF4444' },
});

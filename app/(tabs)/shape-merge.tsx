/**
 * Shape Merge
 * Drop shapes into columns. Two of the same shape stacked together merge
 * into the next shape in the chain: Circle -> Hexagon -> Square -> Triangle
 * -> Star -> MEGA burst (Star + Star clears and pays out a big bonus).
 * Chains can cascade multiple times in a single drop for combo bonuses.
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ShapeRenderer } from '@/components/ShapeRenderer';
import { GameShape } from '@/constants/gameConfig';
import { usePlayer } from '@/context/PlayerContext';

const { width: SW } = Dimensions.get('window');

const HIGH_SCORE_KEY = 'shapemerge';

// ─── Grid ────────────────────────────────────────────────────────────────────
const COLS = 5;
const ROWS = 7;
const GRID_PAD = 16;
const CELL_GAP = 6;
const CELL = (SW - GRID_PAD * 2 - CELL_GAP * (COLS - 1)) / COLS;
const GRID_W = CELL * COLS + CELL_GAP * (COLS - 1);
const GRID_H = CELL * ROWS + CELL_GAP * (ROWS - 1);
const EMPTY = -1;

// ─── Merge chain: Circle -> Hexagon -> Square -> Triangle -> Star -> MEGA ──
interface Tier { shape: GameShape; color: string }
const TIERS: Tier[] = [
  { shape: 'Circle',   color: '#30D158' },
  { shape: 'Hexagon',  color: '#00D4FF' },
  { shape: 'Square',   color: '#5E5CE6' },
  { shape: 'Triangle', color: '#FF9500' },
  { shape: 'Star',     color: '#FFD700' },
];
const MAX_TIER = TIERS.length - 1;

const MEGA_SCORE = 500;
const MEGA_COINS = 10;
const MEGA_STARS = 1;

function makeEmptyGrid(): number[][] {
  return Array.from({ length: COLS }, () => Array(ROWS).fill(EMPTY));
}

function colHeight(col: number[]): number {
  let h = 0;
  while (h < ROWS && col[h] !== EMPTY) h++;
  return h;
}

function tierScore(tier: number): number {
  return 20 * Math.pow(2, tier - 1);
}

function randomSpawnTier(): number {
  return Math.random() < 0.15 ? 1 : 0;
}

function isBoardFull(grid: number[][]): boolean {
  return grid.every((col) => colHeight(col) >= ROWS);
}

interface MergeEvent { row: number; resultTier: number | 'mega' }
interface DropResult {
  grid: number[][];
  landRow: number;
  events: MergeEvent[];
  scoreGained: number;
  mega: boolean;
}

// Landed piece merges with the one below it if it matches; the result can
// itself match the piece below THAT, cascading the chain further down —
// this is what produces "isse aage jo hota hai" automatically.
function resolveDrop(grid: number[][], colIdx: number, spawnTier: number): DropResult | null {
  const col = [...grid[colIdx]];
  const height = colHeight(col);
  if (height >= ROWS) return null;

  let curRow = height;
  col[curRow] = spawnTier;
  const events: MergeEvent[] = [];
  let scoreGained = 0;
  let mega = false;

  while (curRow > 0 && col[curRow] !== EMPTY && col[curRow - 1] === col[curRow]) {
    const tier = col[curRow];
    col[curRow] = EMPTY;
    if (tier + 1 > MAX_TIER) {
      col[curRow - 1] = EMPTY;
      events.push({ row: curRow - 1, resultTier: 'mega' });
      scoreGained += MEGA_SCORE;
      mega = true;
      break;
    }
    col[curRow - 1] = tier + 1;
    events.push({ row: curRow - 1, resultTier: tier + 1 });
    scoreGained += tierScore(tier + 1);
    curRow -= 1;
  }

  const newGrid = grid.slice();
  newGrid[colIdx] = col;
  return { grid: newGrid, landRow: height, events, scoreGained, mega };
}

type GStatus = 'playing' | 'gameover';

export default function ShapeMergeScreen() {
  const insets = useSafeAreaInsets();
  const { playerData, updateHighScore, addCoins, addStars, incrementGamesPlayed } = usePlayer();

  const [grid, setGrid] = useState<number[][]>(() => makeEmptyGrid());
  const [status, setStatus] = useState<GStatus>('playing');
  const [score, setScore] = useState(0);
  const [bestChain, setBestChain] = useState(0);
  const [nextTier, setNextTier] = useState<number>(() => randomSpawnTier());
  const [dropCol, setDropCol] = useState<number | null>(null);
  const [dropTier, setDropTier] = useState(0);
  const [pulseCells, setPulseCells] = useState<Set<string>>(new Set());
  const [comboLabel, setComboLabel] = useState<{ text: string; key: number } | null>(null);

  const isDroppingRef = useRef(false);
  const fallAnim = useRef(new Animated.Value(0)).current;
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const comboKeyRef = useRef(0);

  const endGame = useCallback((finalScore: number, chain: number) => {
    setStatus('gameover');
    incrementGamesPlayed();
    updateHighScore(HIGH_SCORE_KEY, finalScore);
    const coinsEarned = Math.floor(finalScore / 15);
    const starsEarned = chain >= 2 ? Math.min(chain - 1, 3) : 0;
    if (coinsEarned > 0) addCoins(coinsEarned);
    if (starsEarned > 0) addStars(starsEarned);
  }, [incrementGamesPlayed, updateHighScore, addCoins, addStars]);

  const handleColumnPress = useCallback((colIdx: number) => {
    if (status !== 'playing' || isDroppingRef.current) return;
    const height = colHeight(grid[colIdx]);
    if (height >= ROWS) {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    isDroppingRef.current = true;
    setDropTier(nextTier);
    setDropCol(colIdx);
    fallAnim.setValue(0);

    const targetY = (ROWS - 1 - height) * (CELL + CELL_GAP);

    Animated.timing(fallAnim, {
      toValue: targetY,
      duration: 160 + height * 14,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      const spawnTier = nextTier;
      const result = resolveDrop(grid, colIdx, spawnTier);
      isDroppingRef.current = false;
      setDropCol(null);
      if (!result) return;

      setGrid(result.grid);
      setScore((s) => s + result.scoreGained);
      setNextTier(randomSpawnTier());

      if (result.events.length > 0) {
        const chain = result.events.length;
        setBestChain((b) => Math.max(b, chain));

        const keys = new Set(
          result.events.filter((e) => e.resultTier !== 'mega').map((e) => `${colIdx}-${e.row}`)
        );
        setPulseCells(keys);
        setTimeout(() => setPulseCells(new Set()), 320);

        comboKeyRef.current += 1;
        setComboLabel({
          text: result.mega ? 'MEGA BURST!' : chain > 1 ? `COMBO x${chain}` : 'MERGE!',
          key: comboKeyRef.current,
        });
        setTimeout(() => setComboLabel(null), 700);

        if (Platform.OS !== 'web') {
          if (result.mega) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          else if (chain >= 3) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          else if (chain === 2) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }

        if (result.mega) {
          addCoins(MEGA_COINS);
          addStars(MEGA_STARS);
          flashOpacity.setValue(0.85);
          Animated.timing(flashOpacity, { toValue: 0, duration: 400, useNativeDriver: true }).start();
        }
      }

      if (isBoardFull(result.grid)) {
        endGame(score + result.scoreGained, Math.max(bestChain, result.events.length));
      }
    });
  }, [grid, nextTier, status, score, bestChain, addCoins, addStars, fallAnim, flashOpacity, endGame]);

  const restart = useCallback(() => {
    isDroppingRef.current = false;
    setGrid(makeEmptyGrid());
    setScore(0);
    setBestChain(0);
    setNextTier(randomSpawnTier());
    setStatus('playing');
    setDropCol(null);
    setComboLabel(null);
    setPulseCells(new Set());
  }, []);

  const goHome = useCallback(() => router.replace('/menu'), []);

  const bestScore = playerData.highScores[HIGH_SCORE_KEY] ?? 0;

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#070714', '#0D0D28', '#070714']} style={StyleSheet.absoluteFill} />

      {/* Mega burst flash */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: '#FFD700', opacity: flashOpacity }]}
        pointerEvents="none"
      />

      {/* HUD */}
      <View style={[styles.hud, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity style={styles.hudBtn} onPress={goHome} hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}>
          <Ionicons name="home-outline" size={16} color="rgba(255,255,255,0.55)" />
        </TouchableOpacity>
        <View style={styles.hudCenter}>
          <Text style={styles.modeLabel}>SHAPE MERGE</Text>
          <Text style={styles.scoreNum}>{score}</Text>
        </View>
        <View style={styles.nextBadge}>
          <Text style={styles.nextLabel}>NEXT</Text>
          <ShapeRenderer shape={TIERS[nextTier].shape} color={TIERS[nextTier].color} size={20} />
        </View>
      </View>

      {bestScore > 0 && (
        <Text style={styles.bestLine}>BEST {bestScore}</Text>
      )}

      {/* Combo label */}
      {comboLabel && (
        <View style={styles.comboWrap} pointerEvents="none">
          <Text style={styles.comboText}>{comboLabel.text}</Text>
        </View>
      )}

      {/* Grid */}
      <View style={styles.playArea}>
        <View style={{ width: GRID_W, height: GRID_H }}>
          <View style={styles.gridFrame} />

          {/* Landed shapes */}
          {grid.map((col, c) => (
            <View
              key={c}
              style={{ position: 'absolute', left: c * (CELL + CELL_GAP), top: 0, width: CELL, height: GRID_H, zIndex: 1 }}
            >
              {Array.from({ length: ROWS }, (_, r) => {
                const tier = col[r];
                const top = (ROWS - 1 - r) * (CELL + CELL_GAP);
                const pulsing = pulseCells.has(`${c}-${r}`);
                return (
                  <View
                    key={r}
                    style={{ position: 'absolute', left: 0, top, width: CELL, height: CELL, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <View style={styles.cellBg} />
                    {tier !== EMPTY && (
                      <View style={[styles.cellShapeWrap, pulsing && styles.cellShapePulse]}>
                        <ShapeRenderer shape={TIERS[tier].shape} color={TIERS[tier].color} size={CELL * 0.76} />
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ))}

          {/* Falling piece */}
          {dropCol !== null && (
            <Animated.View
              style={{
                position: 'absolute',
                left: dropCol * (CELL + CELL_GAP),
                top: 0,
                width: CELL,
                height: CELL,
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 5,
                transform: [{ translateY: fallAnim }],
              }}
            >
              <ShapeRenderer shape={TIERS[dropTier].shape} color={TIERS[dropTier].color} size={CELL * 0.76} />
            </Animated.View>
          )}

          {/* Column tap targets */}
          {Array.from({ length: COLS }, (_, c) => (
            <Pressable
              key={`tap${c}`}
              onPress={() => handleColumnPress(c)}
              style={{ position: 'absolute', left: c * (CELL + CELL_GAP), top: 0, width: CELL, height: GRID_H, zIndex: 10 }}
            />
          ))}
        </View>
      </View>

      <Text style={styles.hint}>TAP A COLUMN TO DROP · MATCH SHAPES TO MERGE</Text>

      {/* Game over overlay */}
      {status === 'gameover' && (
        <View style={[StyleSheet.absoluteFill, styles.dimOverlay]}>
          <Text style={styles.overlayTitle}>BOARD FULL!</Text>
          <Text style={styles.finalScore}>{score}</Text>
          {bestScore > 0 && <Text style={styles.bestScoreText}>BEST {Math.max(bestScore, score)}</Text>}
          <TouchableOpacity style={styles.primaryBtn} onPress={restart}>
            <Ionicons name="refresh" size={20} color="#070714" />
            <Text style={styles.primaryBtnText}>TRY AGAIN</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={goHome}>
            <Ionicons name="home-outline" size={18} color="#FFFFFF" />
            <Text style={styles.secondaryBtnText}>MAIN MENU</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#070714' },

  hud: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 20,
  },
  hudBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  hudCenter: { flex: 1, alignItems: 'center' },
  modeLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#5E5CE6', letterSpacing: 3 },
  scoreNum: { fontSize: 26, fontFamily: 'Inter_700Bold', color: '#FFFFFF', marginTop: 2 },
  nextBadge: {
    alignItems: 'center', gap: 2,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  nextLabel: { fontSize: 8, fontFamily: 'Inter_600SemiBold', color: '#5555AA', letterSpacing: 1 },
  bestLine: {
    textAlign: 'center', fontSize: 11, fontFamily: 'Inter_500Medium',
    color: '#5555AA', letterSpacing: 1, marginBottom: 4,
  },

  comboWrap: {
    position: 'absolute', top: '30%', left: 0, right: 0,
    alignItems: 'center', zIndex: 15,
  },
  comboText: {
    fontSize: 22, fontFamily: 'Inter_700Bold', color: '#FFD700',
    letterSpacing: 2,
    textShadowColor: '#FF9500', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 14,
  },

  playArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  gridFrame: {
    position: 'absolute', inset: 0,
    borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(94,92,230,0.25)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  cellBg: {
    position: 'absolute', width: CELL - 4, height: CELL - 4, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  cellShapeWrap: { alignItems: 'center', justifyContent: 'center' },
  cellShapePulse: { transform: [{ scale: 1.18 }] },

  hint: {
    textAlign: 'center', fontSize: 10, fontFamily: 'Inter_500Medium',
    color: 'rgba(255,255,255,0.25)', letterSpacing: 1, marginBottom: 18,
  },

  dimOverlay: {
    backgroundColor: 'rgba(5,5,18,0.93)', alignItems: 'center', justifyContent: 'center',
    gap: 14, zIndex: 50,
  },
  overlayTitle: { fontSize: 28, fontFamily: 'Inter_700Bold', color: '#FFFFFF', letterSpacing: 3 },
  finalScore: {
    fontSize: 56, fontFamily: 'Inter_700Bold', color: '#FFD700',
    textShadowColor: '#FF9500', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 18,
  },
  bestScoreText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#5555AA', letterSpacing: 1, marginBottom: 4 },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFD700', borderRadius: 16,
    paddingHorizontal: 36, paddingVertical: 14,
  },
  primaryBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#070714', letterSpacing: 1 },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16,
    paddingHorizontal: 36, paddingVertical: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  secondaryBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', letterSpacing: 0.5 },
});

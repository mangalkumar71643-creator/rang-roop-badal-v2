/**
 * Shape Merge
 * Physics-based drop game (Suika/watermelon-style) — no grid, no fixed
 * cells. Shapes fall freely under gravity and pile up naturally; two
 * touching shapes of the same tier merge into the next one in the chain:
 * Circle -> Hexagon -> Square -> Triangle -> Star -> MEGA -> burst bonus.
 * Merges can cascade in the same tick for combo bonuses.
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { ShapeRenderer } from '@/components/ShapeRenderer';
import { GameShape } from '@/constants/gameConfig';
import { usePlayer } from '@/context/PlayerContext';

const { width: SW, height: SH } = Dimensions.get('window');

const HIGH_SCORE_KEY = 'shapemerge';

// ─── Merge chain: Circle -> Hexagon -> Square -> Triangle -> Star -> MEGA ──
// Star + Star forms a MEGA piece (still a real shape on the board) instead
// of vanishing; only MEGA + MEGA is the true terminal burst.
//
// `radius` drives physics (position, gravity, collision) — never changes.
// `visualScale` only enlarges the drawn shape around that same center point.
// Triangle/Star/Hexagon are "pointier" than their bounding circle (a
// triangle's apex and a star's inner notches sit well inside the circle
// two touching pieces collide at), so without this two physically-touching
// shapes can render with a visible gap between them, looking like one is
// floating. Scaling the artwork up compensates without changing gameplay.
interface Tier { shape: GameShape; color: string; radius: number; visualScale?: number }
const TIERS: Tier[] = [
  { shape: 'Circle',   color: '#30D158', radius: 20 },
  { shape: 'Hexagon',  color: '#00D4FF', radius: 26, visualScale: 1.10 },
  { shape: 'Square',   color: '#5E5CE6', radius: 33 },
  { shape: 'Triangle', color: '#FF9500', radius: 41, visualScale: 1.35 },
  { shape: 'Star',     color: '#FFD700', radius: 50, visualScale: 1.28 },
  { shape: 'Star',     color: '#FF3DF2', radius: 60, visualScale: 1.28 }, // MEGA — bigger, distinct glow
];
const MAX_TIER = TIERS.length - 1;

// Small bonus the instant a MEGA piece is formed (Star + Star).
const MEGA_MILESTONE_COINS = 5;
const MEGA_MILESTONE_STARS = 1;
// Big payout when two MEGA pieces collide and the chain finally terminates.
const TERMINAL_BURST_SCORE = 800;
const TERMINAL_BURST_COINS = 15;
const TERMINAL_BURST_STARS = 2;

// ─── Physics ────────────────────────────────────────────────────────────────
const TICK_MS = 16;
const GRAVITY = 0.55;
const MAX_FALL_SPEED = 16;
const WALL_BOUNCE = 0.3;
const FLOOR_BOUNCE = 0.15;
const H_DRAG = 0.90;
const DROP_COOLDOWN_TICKS = 26;
const DANGER_TICKS = 75; // ~1.2s sustained near the top ends the game

// Shapes drop on their own every ~5s, like a real falling-object game —
// dragging just repositions where the next one lands before it falls.
const AUTO_DROP_TICKS = 313; // ~5.0s @ 16ms/tick

const PAD = 14;
const PLAY_W = SW - PAD * 2;

function tierScore(tier: number): number {
  return 20 * Math.pow(2, tier - 1);
}

// Circle and Hexagon spawn most often; Square shows up sometimes too —
// higher tiers still mainly come from merging, not spawning.
function randomSpawnTier(): number {
  const r = Math.random();
  if (r < 0.62) return 0; // Circle
  if (r < 0.90) return 1; // Hexagon
  return 2; // Square
}

function randomAutoDropTicks(): number {
  return AUTO_DROP_TICKS;
}

interface PieceState { id: number; tier: number; x: number; y: number; vx: number; vy: number }
type GStatus = 'playing' | 'gameover';

interface World {
  status: GStatus;
  pieces: PieceState[];
  pendingTier: number;
  pendingX: number;
  nextTier: number;
  score: number;
  bestChain: number;
  dangerTimer: number;
  dropCooldown: number;
  autoDropTimer: number;
  autoDropTotal: number;
}

function freshWorld(playW: number): World {
  const autoDropTotal = randomAutoDropTicks();
  return {
    status: 'playing',
    pieces: [],
    pendingTier: randomSpawnTier(),
    pendingX: playW / 2,
    nextTier: randomSpawnTier(),
    score: 0,
    bestChain: 0,
    dangerTimer: 0,
    dropCooldown: 0,
    autoDropTimer: autoDropTotal,
    autoDropTotal,
  };
}

// Spawns the pending piece into the jar and lines up the next one. Shared by
// the manual drag-release drop and the automatic timer-driven drop.
function performDrop(w: World, idRef: { current: number }) {
  w.pieces.push({
    id: idRef.current++,
    tier: w.pendingTier,
    x: w.pendingX,
    y: TIERS[w.pendingTier].radius + 2,
    vx: 0,
    vy: 0,
  });
  w.pendingTier = w.nextTier;
  w.nextTier = randomSpawnTier();
  w.dropCooldown = DROP_COOLDOWN_TICKS;
  w.autoDropTotal = randomAutoDropTicks();
  w.autoDropTimer = w.autoDropTotal;
}

export default function ShapeMergeScreen() {
  const insets = useSafeAreaInsets();
  const { playerData, updateHighScore, addCoins, addStars, incrementGamesPlayed } = usePlayer();

  // Geometry computed once from safe-area insets (stable after first render).
  const geom = useMemo(() => {
    const playTop = insets.top + 100;
    const playBottom = SH - insets.bottom - 50;
    const playH = Math.max(320, playBottom - playTop);
    return { playLeft: PAD, playTop, playH };
  }, [insets.top, insets.bottom]);

  const [tick, setTick] = useState(0);
  const forceRender = useCallback(() => setTick((t) => t + 1), []);

  const worldRef = useRef<World>(freshWorld(PLAY_W));
  const idRef = useRef(1);
  const gameLoopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const comboKeyRef = useRef(0);
  const [comboLabel, setComboLabel] = useState<{ text: string; key: number } | null>(null);

  const stopLoop = useCallback(() => {
    if (gameLoopRef.current) { clearInterval(gameLoopRef.current); gameLoopRef.current = null; }
  }, []);

  const endGame = useCallback(() => {
    const w = worldRef.current;
    w.status = 'gameover';
    stopLoop();
    incrementGamesPlayed();
    updateHighScore(HIGH_SCORE_KEY, w.score);
    const coinsEarned = Math.floor(w.score / 15);
    const starsEarned = w.bestChain >= 2 ? Math.min(w.bestChain - 1, 3) : 0;
    if (coinsEarned > 0) addCoins(coinsEarned);
    if (starsEarned > 0) addStars(starsEarned);
    forceRender();
  }, [stopLoop, incrementGamesPlayed, updateHighScore, addCoins, addStars, forceRender]);

  // ─── Physics tick ──────────────────────────────────────────────────────────
  const tickFnRef = useRef<() => void>(() => {});
  tickFnRef.current = () => {
    const w = worldRef.current;
    if (w.status !== 'playing') return;
    const { playH } = geom;
    const pieces = w.pieces;

    if (w.dropCooldown > 0) w.dropCooldown--;

    // Auto-drop: the pending shape falls on its own every 2-3s, just like
    // a real falling-object game — dragging only aims where it lands.
    w.autoDropTimer--;
    if (w.autoDropTimer <= 0) {
      performDrop(w, idRef);
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    // Integrate gravity + motion
    for (const p of pieces) {
      p.vy = Math.min(p.vy + GRAVITY, MAX_FALL_SPEED);
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= H_DRAG;
    }

    // Walls + floor
    for (const p of pieces) {
      const r = TIERS[p.tier].radius;
      if (p.x - r < 0) { p.x = r; p.vx = Math.abs(p.vx) * WALL_BOUNCE; }
      if (p.x + r > PLAY_W) { p.x = PLAY_W - r; p.vx = -Math.abs(p.vx) * WALL_BOUNCE; }
      if (p.y + r > playH) {
        p.y = playH - r;
        p.vy = p.vy > 2 ? -p.vy * FLOOR_BOUNCE : 0;
      }
    }

    // Pairwise collisions + merge detection
    const mergePairs: [number, number][] = [];
    const merging = new Set<number>();
    for (let i = 0; i < pieces.length; i++) {
      for (let j = i + 1; j < pieces.length; j++) {
        const a = pieces[i], b = pieces[j];
        const ra = TIERS[a.tier].radius, rb = TIERS[b.tier].radius;
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.0001;
        const minDist = ra + rb;
        if (dist >= minDist) continue;

        if (a.tier === b.tier && !merging.has(i) && !merging.has(j)) {
          mergePairs.push([i, j]);
          merging.add(i); merging.add(j);
          continue;
        }

        const overlap = minDist - dist;
        const nx = dx / dist, ny = dy / dist;
        const totalR = ra + rb;
        const pushA = overlap * (rb / totalR);
        const pushB = overlap * (ra / totalR);
        a.x -= nx * pushA; a.y -= ny * pushA;
        b.x += nx * pushB; b.y += ny * pushB;

        const relVx = b.vx - a.vx, relVy = b.vy - a.vy;
        const relDot = relVx * nx + relVy * ny;
        if (relDot < 0) {
          const impulse = -relDot * 0.5;
          a.vx -= nx * impulse * (rb / totalR);
          a.vy -= ny * impulse * (rb / totalR);
          b.vx += nx * impulse * (ra / totalR);
          b.vy += ny * impulse * (ra / totalR);
        }
      }
    }

    // Resolve merges
    if (mergePairs.length > 0) {
      const removeIdx = new Set<number>();
      const additions: PieceState[] = [];
      let scoreGained = 0;
      let terminalBurst = false;
      let megaFormed = false;

      for (const [i, j] of mergePairs) {
        const a = pieces[i], b = pieces[j];
        removeIdx.add(i); removeIdx.add(j);
        const tier = a.tier;
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        if (tier + 1 > MAX_TIER) {
          // Only MEGA + MEGA reaches here — the true end of the chain.
          terminalBurst = true;
          scoreGained += TERMINAL_BURST_SCORE;
        } else {
          if (tier + 1 === MAX_TIER) megaFormed = true; // Star + Star -> MEGA
          additions.push({
            id: idRef.current++,
            tier: tier + 1,
            x: mx, y: my,
            vx: (a.vx + b.vx) / 2,
            vy: Math.min(a.vy, b.vy),
          });
          scoreGained += tierScore(tier + 1);
        }
      }

      w.pieces = pieces.filter((_, idx) => !removeIdx.has(idx)).concat(additions);
      w.score += scoreGained;
      w.bestChain = Math.max(w.bestChain, mergePairs.length);

      comboKeyRef.current += 1;
      setComboLabel({
        text: terminalBurst ? 'MEGA BURST!' : megaFormed ? 'MEGA FORMED!' : mergePairs.length > 1 ? `COMBO x${mergePairs.length}` : 'MERGE!',
        key: comboKeyRef.current,
      });
      setTimeout(() => setComboLabel(null), 650);

      if (Platform.OS !== 'web') {
        if (terminalBurst || megaFormed) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        else if (mergePairs.length >= 2) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      if (terminalBurst) {
        addCoins(TERMINAL_BURST_COINS);
        addStars(TERMINAL_BURST_STARS);
        flashOpacity.setValue(0.85);
        Animated.timing(flashOpacity, { toValue: 0, duration: 400, useNativeDriver: true }).start();
      } else if (megaFormed) {
        addCoins(MEGA_MILESTONE_COINS);
        addStars(MEGA_MILESTONE_STARS);
        flashOpacity.setValue(0.5);
        Animated.timing(flashOpacity, { toValue: 0, duration: 350, useNativeDriver: true }).start();
      }
    }

    // Danger line: sustained settled piece near the top ends the game
    const dangerY = playH * 0.16;
    const inDanger = w.pieces.some((p) => {
      const r = TIERS[p.tier].radius;
      return p.y - r < dangerY && Math.abs(p.vy) < 0.6 && Math.abs(p.vx) < 0.6;
    });
    if (inDanger) {
      w.dangerTimer++;
      if (w.dangerTimer > DANGER_TICKS) { endGame(); return; }
    } else {
      w.dangerTimer = 0;
    }

    forceRender();
  };

  useEffect(() => {
    gameLoopRef.current = setInterval(() => tickFnRef.current(), TICK_MS);
    return () => stopLoop();
  }, [stopLoop]);

  // ─── Touch control: drag to aim, release to drop ───────────────────────────
  const updatePendingX = useCallback((pageX: number) => {
    const w = worldRef.current;
    if (w.status !== 'playing' || w.dropCooldown > 0) return;
    const r = TIERS[w.pendingTier].radius;
    const localX = pageX - geom.playLeft;
    w.pendingX = Math.max(r, Math.min(PLAY_W - r, localX));
    forceRender();
  }, [geom.playLeft, forceRender]);

  const dropPending = useCallback(() => {
    const w = worldRef.current;
    if (w.status !== 'playing' || w.dropCooldown > 0) return;
    performDrop(w, idRef);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    forceRender();
  }, [forceRender]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => worldRef.current.status === 'playing' && worldRef.current.dropCooldown <= 0,
    onMoveShouldSetPanResponder: () => worldRef.current.status === 'playing' && worldRef.current.dropCooldown <= 0,
    onPanResponderGrant: (evt) => updatePendingX(evt.nativeEvent.pageX),
    onPanResponderMove: (evt) => updatePendingX(evt.nativeEvent.pageX),
    onPanResponderRelease: () => dropPending(),
    onPanResponderTerminate: () => dropPending(),
  }), [updatePendingX, dropPending]);

  const restart = useCallback(() => {
    stopLoop();
    worldRef.current = freshWorld(PLAY_W);
    gameLoopRef.current = setInterval(() => tickFnRef.current(), TICK_MS);
    forceRender();
  }, [stopLoop, forceRender]);

  const goHome = useCallback(() => { stopLoop(); router.replace('/menu'); }, [stopLoop]);

  const w = worldRef.current;
  const bestScore = playerData.highScores[HIGH_SCORE_KEY] ?? 0;
  const pendingR = TIERS[w.pendingTier].radius;
  const pendingVisR = pendingR * (TIERS[w.pendingTier].visualScale ?? 1);
  const pendingY = geom.playTop - pendingR - 10;

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#070714', '#0D0D28', '#070714']} style={StyleSheet.absoluteFill} />

      {/* Full-screen gesture layer */}
      <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers} />

      {/* Mega burst flash */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: '#FFD700', opacity: flashOpacity }]}
        pointerEvents="none"
      />

      {/* HUD */}
      <View style={[styles.hud, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
        <TouchableOpacity style={styles.hudBtn} onPress={goHome} hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}>
          <Ionicons name="home-outline" size={16} color="rgba(255,255,255,0.55)" />
        </TouchableOpacity>
        <View style={styles.hudCenter}>
          <Text style={styles.modeLabel}>SHAPE MERGE</Text>
          <Text style={styles.scoreNum}>{w.score}</Text>
        </View>
        <View style={styles.nextBadge}>
          <Text style={styles.nextLabel}>NEXT</Text>
          <ShapeRenderer shape={TIERS[w.nextTier].shape} color={TIERS[w.nextTier].color} size={20} />
        </View>
      </View>

      {bestScore > 0 && (
        <Text style={styles.bestLine} pointerEvents="none">BEST {bestScore}</Text>
      )}

      {/* Combo label */}
      {comboLabel && (
        <View style={styles.comboWrap} pointerEvents="none">
          <Text style={styles.comboText}>{comboLabel.text}</Text>
        </View>
      )}

      {/* Open jar (no grid, no cells) */}
      <View
        style={[styles.jar, { left: geom.playLeft, top: geom.playTop, width: PLAY_W, height: geom.playH }]}
        pointerEvents="none"
      >
        <View style={styles.dangerLine} />
      </View>

      {/* Aim guide */}
      <View
        style={[styles.aimLine, {
          left: geom.playLeft + w.pendingX,
          top: pendingY + pendingR,
          height: Math.max(0, geom.playTop - (pendingY + pendingR)),
        }]}
        pointerEvents="none"
      />

      {/* Auto-drop countdown ring */}
      {(() => {
        const ringR = pendingR + 7;
        const circumference = 2 * Math.PI * ringR;
        const progress = Math.max(0, Math.min(1, w.autoDropTimer / w.autoDropTotal));
        return (
          <Svg
            width={ringR * 2 + 6}
            height={ringR * 2 + 6}
            style={{
              position: 'absolute',
              left: geom.playLeft + w.pendingX - ringR - 3,
              top: pendingY - ringR - 3,
              transform: [{ rotate: '-90deg' }],
            }}
            pointerEvents="none"
          >
            <Circle
              cx={ringR + 3} cy={ringR + 3} r={ringR}
              stroke={progress < 0.25 ? '#FF2D78' : 'rgba(255,255,255,0.30)'}
              strokeWidth={3}
              fill="none"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={circumference * (1 - progress)}
              strokeLinecap="round"
            />
          </Svg>
        );
      })()}

      {/* Pending piece */}
      <View
        style={{
          position: 'absolute',
          left: geom.playLeft + w.pendingX - pendingVisR,
          top: pendingY - pendingVisR,
          width: pendingVisR * 2,
          height: pendingVisR * 2,
        }}
        pointerEvents="none"
      >
        <ShapeRenderer shape={TIERS[w.pendingTier].shape} color={TIERS[w.pendingTier].color} size={pendingVisR * 2} />
      </View>

      {/* Falling / settled pieces */}
      {w.pieces.map((p) => {
        const r = TIERS[p.tier].radius;
        const visR = r * (TIERS[p.tier].visualScale ?? 1);
        const isMega = p.tier === MAX_TIER;
        return (
          <View
            key={p.id}
            style={{
              position: 'absolute',
              left: geom.playLeft + p.x - visR,
              top: geom.playTop + p.y - visR,
              width: visR * 2,
              height: visR * 2,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            pointerEvents="none"
          >
            {isMega && (
              <View style={{
                position: 'absolute',
                width: r * 2.6, height: r * 2.6, borderRadius: r * 1.3,
                backgroundColor: TIERS[p.tier].color, opacity: 0.22,
              }} />
            )}
            <ShapeRenderer shape={TIERS[p.tier].shape} color={TIERS[p.tier].color} size={visR * 2} />
          </View>
        );
      })}

      <Text style={[styles.hint, { top: geom.playTop + geom.playH + 10 }]} pointerEvents="none">
        DRAG TO AIM · RELEASE TO DROP
      </Text>

      {/* Game over overlay */}
      {w.status === 'gameover' && (
        <View style={[StyleSheet.absoluteFill, styles.dimOverlay]}>
          <Text style={styles.overlayTitle}>JAR FULL!</Text>
          <Text style={styles.finalScore}>{w.score}</Text>
          {bestScore > 0 && <Text style={styles.bestScoreText}>BEST {Math.max(bestScore, w.score)}</Text>}
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
    color: '#5555AA', letterSpacing: 1, marginTop: -4,
  },

  comboWrap: {
    position: 'absolute', top: '32%', left: 0, right: 0,
    alignItems: 'center', zIndex: 15,
  },
  comboText: {
    fontSize: 22, fontFamily: 'Inter_700Bold', color: '#FFD700',
    letterSpacing: 2,
    textShadowColor: '#FF9500', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 14,
  },

  jar: {
    position: 'absolute',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(94,92,230,0.28)',
    backgroundColor: 'rgba(255,255,255,0.015)',
    overflow: 'hidden',
  },
  dangerLine: {
    position: 'absolute',
    left: 0, right: 0, top: '16%',
    height: 1.5,
    backgroundColor: 'rgba(255,45,120,0.35)',
    borderStyle: 'dashed',
  },
  aimLine: {
    position: 'absolute',
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },

  hint: {
    position: 'absolute', left: 0, right: 0,
    textAlign: 'center', fontSize: 10, fontFamily: 'Inter_500Medium',
    color: 'rgba(255,255,255,0.25)', letterSpacing: 1,
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

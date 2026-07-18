/**
 * Bubble Shooter
 * Classic hex-grid bubble shooter using the app's 5 shapes instead of
 * colors. Aim and fire a shape up into the grid; land it against 2+ of
 * the same shape and the whole connected group blasts. Any bubbles left
 * floating (no path back to the ceiling) fall and pop too. Clear the
 * whole grid to win; let the ceiling descend onto the cannon and it's
 * game over.
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

import { ShapeRenderer } from '@/components/ShapeRenderer';
import { GAME_SHAPE_NAMES, GameShape } from '@/constants/gameConfig';
import { usePlayer } from '@/context/PlayerContext';

const { width: SW } = Dimensions.get('window');

const HIGH_SCORE_KEY = 'bubbleshooter';

const SHAPE_COLORS: Record<GameShape, string> = {
  Circle:   '#30D158',
  Hexagon:  '#00D4FF',
  Square:   '#5E5CE6',
  Triangle: '#FF9500',
  Star:     '#FFD700',
};

// ─── Grid ────────────────────────────────────────────────────────────────────
const PAD = 14;
const PLAY_W = SW - PAD * 2;
const COLS = 8;
const CELL_W = PLAY_W / COLS;
const ROW_H = CELL_W * 0.87;
const BUBBLE_R = CELL_W / 2 - 2;
const ROWS = 12;
const DANGER_ROW = 9;
const INITIAL_FILL_ROWS = 5;
const MIN_MATCH = 3;
const SHOTS_PER_DESCENT = 5;

// ─── Physics ────────────────────────────────────────────────────────────────
const TICK_MS = 16;
const FIRE_SPEED = 9;

// ─── Scoring ────────────────────────────────────────────────────────────────
const POP_SCORE = 15;
const DROP_BONUS = 25;
const WIN_BONUS_COINS = 40;
const WIN_BONUS_STARS = 4;

function colsInRow(row: number): number {
  return row % 2 === 0 ? COLS : COLS - 1;
}

function cellPos(row: number, col: number): { x: number; y: number } {
  const xOffset = row % 2 === 1 ? CELL_W / 2 : 0;
  return { x: xOffset + col * CELL_W + CELL_W / 2, y: row * ROW_H + CELL_W / 2 };
}

function neighborsOf(row: number, col: number): [number, number][] {
  if (row % 2 === 0) {
    return [[row, col - 1], [row, col + 1], [row - 1, col - 1], [row - 1, col], [row + 1, col - 1], [row + 1, col]];
  }
  return [[row, col - 1], [row, col + 1], [row - 1, col], [row - 1, col + 1], [row + 1, col], [row + 1, col + 1]];
}

function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < ROWS && col >= 0 && col < colsInRow(row);
}

function randomShape(): GameShape {
  return GAME_SHAPE_NAMES[Math.floor(Math.random() * GAME_SHAPE_NAMES.length)];
}

type Grid = (GameShape | null)[][];

function makeEmptyGrid(): Grid {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function fillInitialRows(grid: Grid) {
  for (let r = 0; r < INITIAL_FILL_ROWS; r++) {
    for (let c = 0; c < colsInRow(r); c++) grid[r][c] = randomShape();
  }
}

interface Flying { id: number; shape: GameShape; x: number; y: number; vx: number; vy: number }
// 'aiming' covers the whole active game, including while a shot is
// mid-flight — aiming the next shot is never blocked, only actually
// firing is (gated on world.flying being null). This keeps the cannon
// and aim guide always responsive instead of freezing during flight.
type GStatus = 'aiming' | 'win' | 'gameover';

interface World {
  status: GStatus;
  grid: Grid;
  flying: Flying | null;
  currentShape: GameShape;
  nextShape: GameShape;
  aimAngle: number;
  score: number;
  shotsFired: number;
}

function freshWorld(): World {
  const grid = makeEmptyGrid();
  fillInitialRows(grid);
  return {
    status: 'aiming',
    grid,
    flying: null,
    currentShape: randomShape(),
    nextShape: randomShape(),
    aimAngle: -Math.PI / 2,
    score: 0,
    shotsFired: 0,
  };
}

function findSnapCell(grid: Grid, x: number, y: number): { row: number; col: number } | null {
  let best: { row: number; col: number } | null = null;
  let bestDist = Infinity;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < colsInRow(r); c++) {
      if (grid[r][c] !== null) continue;
      const isCeiling = r === 0;
      const hasOccupiedNeighbor = neighborsOf(r, c).some(
        ([nr, nc]) => inBounds(nr, nc) && grid[nr][nc] !== null
      );
      if (!isCeiling && !hasOccupiedNeighbor) continue;
      const p = cellPos(r, c);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestDist) { bestDist = d; best = { row: r, col: c }; }
    }
  }
  return best;
}

function floodSameShape(grid: Grid, row: number, col: number): [number, number][] {
  const shape = grid[row][col];
  if (!shape) return [];
  const visited = new Set<string>();
  const stack: [number, number][] = [[row, col]];
  const result: [number, number][] = [];
  while (stack.length > 0) {
    const [r, c] = stack.pop()!;
    const key = `${r},${c}`;
    if (visited.has(key)) continue;
    visited.add(key);
    if (grid[r][c] !== shape) continue;
    result.push([r, c]);
    for (const [nr, nc] of neighborsOf(r, c)) {
      if (inBounds(nr, nc) && !visited.has(`${nr},${nc}`) && grid[nr][nc] === shape) stack.push([nr, nc]);
    }
  }
  return result;
}

function findFloating(grid: Grid): [number, number][] {
  const anchored = new Set<string>();
  const queue: [number, number][] = [];
  for (let c = 0; c < colsInRow(0); c++) {
    if (grid[0][c]) { anchored.add(`0,${c}`); queue.push([0, c]); }
  }
  while (queue.length > 0) {
    const [r, c] = queue.shift()!;
    for (const [nr, nc] of neighborsOf(r, c)) {
      if (inBounds(nr, nc) && grid[nr][nc] && !anchored.has(`${nr},${nc}`)) {
        anchored.add(`${nr},${nc}`);
        queue.push([nr, nc]);
      }
    }
  }
  const floating: [number, number][] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < colsInRow(r); c++) {
      if (grid[r][c] && !anchored.has(`${r},${c}`)) floating.push([r, c]);
    }
  }
  return floating;
}

function isGridEmpty(grid: Grid): boolean {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < colsInRow(r); c++) if (grid[r][c]) return false;
  }
  return true;
}

// Traces the aim trajectory (in local play-area coordinates) including
// wall bounces, up to maxLen or the ceiling — used to draw an accurate
// dotted aim guide instead of a short fixed-length stub.
function traceAimPath(startX: number, startY: number, angle: number, maxLen: number): { x: number; y: number }[] {
  let x = startX, y = startY;
  let vx = Math.cos(angle), vy = Math.sin(angle);
  const points = [{ x, y }];
  let remaining = maxLen;
  let bounces = 0;
  while (remaining > 0 && bounces < 4) {
    const tWallX = vx < 0 ? (BUBBLE_R - x) / vx : vx > 0 ? (PLAY_W - BUBBLE_R - x) / vx : Infinity;
    const tCeil = vy < 0 ? (0 - y) / vy : Infinity;
    const t = Math.min(tWallX, tCeil, remaining);
    if (!Number.isFinite(t) || t <= 0) break;
    x += vx * t;
    y += vy * t;
    points.push({ x, y });
    remaining -= t;
    if (t === tCeil || remaining <= 0.01) break;
    vx = -vx;
    bounces++;
  }
  return points;
}

function sampleDots(points: { x: number; y: number }[], spacing: number): { x: number; y: number }[] {
  const dots: { x: number; y: number }[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    if (segLen < 0.01) continue;
    const steps = Math.floor(segLen / spacing);
    for (let s = 1; s <= steps; s++) {
      const t = (s * spacing) / segLen;
      dots.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return dots;
}

// Shifts every row down one and inserts a fresh row at the top. Returns
// true if that pushed any bubble into the danger zone (game over).
function performDescent(grid: Grid): boolean {
  for (let r = ROWS - 1; r >= 1; r--) grid[r] = grid[r - 1];
  grid[0] = Array.from({ length: COLS }, () => randomShape());
  for (let r = DANGER_ROW; r < ROWS; r++) {
    for (let c = 0; c < colsInRow(r); c++) if (grid[r][c]) return true;
  }
  return false;
}

const MIN_AIM_ANGLE = -Math.PI + 0.18;
const MAX_AIM_ANGLE = -0.18;

function clampAim(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  if (a > 0) a = a > Math.PI / 2 ? MIN_AIM_ANGLE : MAX_AIM_ANGLE;
  return Math.max(MIN_AIM_ANGLE, Math.min(MAX_AIM_ANGLE, a));
}

export default function BubbleShooterScreen() {
  const insets = useSafeAreaInsets();
  const { playerData, updateHighScore, addCoins, addStars, incrementGamesPlayed } = usePlayer();

  const geom = useMemo(() => {
    const playTop = insets.top + 100;
    const gridH = ROWS * ROW_H;
    const cannonY = gridH + 44;
    return { playLeft: PAD, playTop, gridH, cannonY };
  }, [insets.top]);

  const [tick, setTick] = useState(0);
  const forceRender = useCallback(() => setTick((t) => t + 1), []);

  const worldRef = useRef<World>(freshWorld());
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
    if (coinsEarned > 0) addCoins(coinsEarned);
    forceRender();
  }, [stopLoop, incrementGamesPlayed, updateHighScore, addCoins, forceRender]);

  const winGame = useCallback(() => {
    const w = worldRef.current;
    w.status = 'win';
    stopLoop();
    incrementGamesPlayed();
    updateHighScore(HIGH_SCORE_KEY, w.score);
    addCoins(Math.floor(w.score / 15) + WIN_BONUS_COINS);
    addStars(WIN_BONUS_STARS);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    forceRender();
  }, [stopLoop, incrementGamesPlayed, updateHighScore, addCoins, addStars, forceRender]);

  const resolveShot = useCallback((row: number, col: number, shape: GameShape) => {
    const w = worldRef.current;
    w.grid[row][col] = shape;

    const match = floodSameShape(w.grid, row, col);
    let scoreGained = 0;
    let popped = 0;

    if (match.length >= MIN_MATCH) {
      for (const [r, c] of match) w.grid[r][c] = null;
      scoreGained += match.length * POP_SCORE;
      popped += match.length;

      const floating = findFloating(w.grid);
      for (const [r, c] of floating) w.grid[r][c] = null;
      scoreGained += floating.length * DROP_BONUS;
      popped += floating.length;

      comboKeyRef.current += 1;
      setComboLabel({
        text: floating.length > 0 ? `+${match.length + floating.length} POP!` : `${match.length}x MATCH!`,
        key: comboKeyRef.current,
      });
      setTimeout(() => setComboLabel(null), 650);

      if (Platform.OS !== 'web') {
        Haptics.impactAsync(popped >= 6 ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium);
      }
      flashOpacity.setValue(0.35);
      Animated.timing(flashOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    } else if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    w.score += scoreGained;

    if (isGridEmpty(w.grid)) { winGame(); return; }

    w.shotsFired += 1;
    if (w.shotsFired % SHOTS_PER_DESCENT === 0) {
      const overflowed = performDescent(w.grid);
      if (overflowed) { endGame(); return; }
    }

    w.flying = null;
  }, [winGame, endGame, flashOpacity]);

  const tickFnRef = useRef<() => void>(() => {});
  tickFnRef.current = () => {
    const w = worldRef.current;
    if (w.status !== 'aiming' || !w.flying) return;
    const f = w.flying;

    f.x += f.vx;
    f.y += f.vy;

    if (f.x - BUBBLE_R < 0) { f.x = BUBBLE_R; f.vx = -f.vx; }
    if (f.x + BUBBLE_R > PLAY_W) { f.x = PLAY_W - BUBBLE_R; f.vx = -f.vx; }

    let shouldSnap = f.y - BUBBLE_R <= 0;
    if (!shouldSnap) {
      for (let r = 0; r < ROWS && !shouldSnap; r++) {
        for (let c = 0; c < colsInRow(r); c++) {
          if (!w.grid[r][c]) continue;
          const p = cellPos(r, c);
          if (Math.hypot(p.x - f.x, p.y - f.y) < BUBBLE_R * 1.9) { shouldSnap = true; break; }
        }
      }
    }

    if (shouldSnap) {
      const cell = findSnapCell(w.grid, f.x, Math.max(f.y, 0));
      if (cell) {
        resolveShot(cell.row, cell.col, f.shape);
      } else {
        // No free cell found (grid full) — treat as an overflow loss.
        endGame();
      }
      return;
    }

    forceRender();
  };

  useEffect(() => {
    gameLoopRef.current = setInterval(() => tickFnRef.current(), TICK_MS);
    return () => stopLoop();
  }, [stopLoop]);

  // ─── Touch control: drag to aim, release to fire ───────────────────────────
  const updateAim = useCallback((pageX: number, pageY: number) => {
    const w = worldRef.current;
    if (w.status !== 'aiming') return;
    const cx = geom.playLeft + PLAY_W / 2;
    const cy = geom.playTop + geom.cannonY;
    w.aimAngle = clampAim(Math.atan2(pageY - cy, pageX - cx));
    forceRender();
  }, [geom.playLeft, geom.playTop, geom.cannonY, forceRender]);

  const fire = useCallback(() => {
    const w = worldRef.current;
    // Aiming stays live during flight; only block launching a second
    // shot while one is already in the air.
    if (w.status !== 'aiming' || w.flying) return;
    w.flying = {
      id: idRef.current++,
      shape: w.currentShape,
      x: PLAY_W / 2,
      y: geom.cannonY,
      vx: Math.cos(w.aimAngle) * FIRE_SPEED,
      vy: Math.sin(w.aimAngle) * FIRE_SPEED,
    };
    // Load the next shape into the cannon immediately, not after the
    // shot lands — so the player is never aiming with a stale shape.
    w.currentShape = w.nextShape;
    w.nextShape = randomShape();
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    forceRender();
  }, [geom.cannonY, forceRender]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => worldRef.current.status === 'aiming',
    onMoveShouldSetPanResponder: () => worldRef.current.status === 'aiming',
    onPanResponderGrant: (evt) => updateAim(evt.nativeEvent.pageX, evt.nativeEvent.pageY),
    onPanResponderMove: (evt) => updateAim(evt.nativeEvent.pageX, evt.nativeEvent.pageY),
    onPanResponderRelease: () => fire(),
    onPanResponderTerminate: () => fire(),
  }), [updateAim, fire]);

  const restart = useCallback(() => {
    stopLoop();
    worldRef.current = freshWorld();
    gameLoopRef.current = setInterval(() => tickFnRef.current(), TICK_MS);
    forceRender();
  }, [stopLoop, forceRender]);

  const goHome = useCallback(() => { stopLoop(); router.replace('/menu'); }, [stopLoop]);

  const w = worldRef.current;
  const bestScore = playerData.highScores[HIGH_SCORE_KEY] ?? 0;
  const cannonX = geom.playLeft + PLAY_W / 2;
  const cannonY = geom.playTop + geom.cannonY;
  const aimDots = w.status === 'aiming'
    ? sampleDots(traceAimPath(PLAY_W / 2, geom.cannonY, w.aimAngle, 480), 16)
    : [];

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#070714', '#0D0D28', '#070714']} style={StyleSheet.absoluteFill} />

      <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers} />

      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: '#00D4FF', opacity: flashOpacity }]}
        pointerEvents="none"
      />

      {/* HUD */}
      <View style={[styles.hud, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
        <TouchableOpacity style={styles.hudBtn} onPress={goHome} hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}>
          <Ionicons name="home-outline" size={16} color="rgba(255,255,255,0.55)" />
        </TouchableOpacity>
        <View style={styles.hudCenter}>
          <Text style={styles.modeLabel}>BUBBLE SHOOTER</Text>
          <Text style={styles.scoreNum}>{w.score}</Text>
        </View>
        <View style={styles.nextBadge}>
          <Text style={styles.nextLabel}>NEXT</Text>
          <ShapeRenderer shape={w.nextShape} color={SHAPE_COLORS[w.nextShape]} size={20} />
        </View>
      </View>

      {bestScore > 0 && (
        <Text style={[styles.bestLine, { top: insets.top + 58 }]} pointerEvents="none">BEST {bestScore}</Text>
      )}

      {comboLabel && (
        <View style={styles.comboWrap} pointerEvents="none">
          <Text style={styles.comboText}>{comboLabel.text}</Text>
        </View>
      )}

      {/* Aim guide — dotted trajectory with wall-bounce preview */}
      {aimDots.map((d, i) => (
        <View
          key={`aim${i}`}
          style={[styles.aimDot, {
            left: geom.playLeft + d.x - 2,
            top: geom.playTop + d.y - 2,
            opacity: Math.max(0.15, 0.6 - i * 0.02),
          }]}
          pointerEvents="none"
        />
      ))}

      {/* Grid area */}
      <View
        style={[styles.gridArea, { left: geom.playLeft, top: geom.playTop, width: PLAY_W, height: geom.gridH }]}
        pointerEvents="none"
      >
        <View style={[styles.dangerLine, { top: DANGER_ROW * ROW_H }]} />
        {w.grid.map((rowArr, r) =>
          rowArr.map((shape, c) => {
            if (!shape || !inBounds(r, c)) return null;
            const p = cellPos(r, c);
            return (
              <View
                key={`${r}-${c}`}
                style={{ position: 'absolute', left: p.x - BUBBLE_R, top: p.y - BUBBLE_R, width: BUBBLE_R * 2, height: BUBBLE_R * 2 }}
              >
                <ShapeRenderer shape={shape} color={SHAPE_COLORS[shape]} size={BUBBLE_R * 2} />
              </View>
            );
          })
        )}
      </View>

      {/* Flying bubble */}
      {w.flying && (
        <View
          style={{
            position: 'absolute',
            left: geom.playLeft + w.flying.x - BUBBLE_R,
            top: geom.playTop + w.flying.y - BUBBLE_R,
            width: BUBBLE_R * 2,
            height: BUBBLE_R * 2,
          }}
          pointerEvents="none"
        >
          <ShapeRenderer shape={w.flying.shape} color={SHAPE_COLORS[w.flying.shape]} size={BUBBLE_R * 2} />
        </View>
      )}

      {/* Cannon */}
      <View style={[styles.cannonWrap, { left: cannonX - BUBBLE_R, top: cannonY - BUBBLE_R }]} pointerEvents="none">
        <ShapeRenderer shape={w.currentShape} color={SHAPE_COLORS[w.currentShape]} size={BUBBLE_R * 2} />
      </View>
      <View style={[styles.cannonBase, { left: cannonX - 26, top: cannonY + BUBBLE_R + 4 }]} pointerEvents="none" />

      <Text style={[styles.hint, { top: geom.playTop + geom.cannonY + 42 }]} pointerEvents="none">
        DRAG TO AIM · RELEASE TO FIRE
      </Text>

      {/* Win overlay */}
      {w.status === 'win' && (
        <View style={[StyleSheet.absoluteFill, styles.dimOverlay]}>
          <Text style={[styles.overlayTitle, styles.winTitle]}>CLEARED!</Text>
          <Text style={[styles.finalScore, styles.winScore]}>{w.score}</Text>
          <Text style={styles.bestScoreText}>+{WIN_BONUS_COINS} 🪙  +{WIN_BONUS_STARS} ⭐ BONUS</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={restart}>
            <Ionicons name="refresh" size={20} color="#070714" />
            <Text style={styles.primaryBtnText}>PLAY AGAIN</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={goHome}>
            <Ionicons name="home-outline" size={18} color="#FFFFFF" />
            <Text style={styles.secondaryBtnText}>MAIN MENU</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Game over overlay */}
      {w.status === 'gameover' && (
        <View style={[StyleSheet.absoluteFill, styles.dimOverlay]}>
          <Text style={styles.overlayTitle}>GRID OVERFLOW!</Text>
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
  modeLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#5E5CE6', letterSpacing: 2 },
  scoreNum: { fontSize: 26, fontFamily: 'Inter_700Bold', color: '#FFFFFF', marginTop: 2 },
  nextBadge: {
    alignItems: 'center', gap: 2,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  nextLabel: { fontSize: 8, fontFamily: 'Inter_600SemiBold', color: '#5555AA', letterSpacing: 1 },
  bestLine: {
    position: 'absolute', left: 0, right: 0,
    textAlign: 'center', fontSize: 11, fontFamily: 'Inter_500Medium',
    color: '#5555AA', letterSpacing: 1,
  },

  comboWrap: {
    position: 'absolute', top: '28%', left: 0, right: 0,
    alignItems: 'center', zIndex: 15,
  },
  comboText: {
    fontSize: 20, fontFamily: 'Inter_700Bold', color: '#00D4FF',
    letterSpacing: 1,
    textShadowColor: '#5E5CE6', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 14,
  },

  gridArea: {
    position: 'absolute',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(94,92,230,0.22)',
    backgroundColor: 'rgba(255,255,255,0.015)',
    overflow: 'hidden',
  },
  dangerLine: {
    position: 'absolute', left: 0, right: 0, height: 1.5,
    backgroundColor: 'rgba(255,45,120,0.4)',
  },

  aimDot: {
    position: 'absolute', width: 4, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },

  cannonWrap: { position: 'absolute' },
  cannonBase: {
    position: 'absolute', width: 52, height: 8, borderRadius: 4,
    backgroundColor: 'rgba(94,92,230,0.25)',
    borderWidth: 1, borderColor: 'rgba(94,92,230,0.4)',
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
  winTitle: {
    color: '#00D4FF',
    textShadowColor: '#00D4FF', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 20,
  },
  finalScore: {
    fontSize: 56, fontFamily: 'Inter_700Bold', color: '#FFD700',
    textShadowColor: '#FF9500', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 18,
  },
  winScore: { color: '#00E87A', textShadowColor: '#00E87A' },
  bestScoreText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#5555AA', letterSpacing: 1, marginBottom: 4 },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#00D4FF', borderRadius: 16,
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

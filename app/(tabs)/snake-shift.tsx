/**
 * Snake Shift – Phase 2
 * Preserves all Phase 1 visuals (arena, camera, boost trail).
 * Adds: Bot AI · Shape Collection · Scoring · Player-Bot Collision.
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line as SvgLine, Polygon as SvgPolygon } from 'react-native-svg';

import { CHARACTERS, GAME_COLORS, GAME_SHAPE_NAMES } from '@/constants/gameConfig';
import type { GameShape } from '@/constants/gameConfig';
import { usePlayer } from '@/context/PlayerContext';

const { width: SW, height: SH } = Dimensions.get('window');

// ─── Arena ──────────────────────────────────────────────────────────────────
const ARENA_W = 4000;
const ARENA_H = 4000;

// ─── Snake geometry ──────────────────────────────────────────────────────────
const HEAD_R         = 15;
const BODY_R         = 11;
const SEG_GAP        = 22;   // px between body-segment centres
const BASE_SEGS      = 10;   // starting body length
const SEGS_PER_TYPE  = 2;    // body grows this much per new unique shape type
const MAX_SEGS       = BASE_SEGS + 5 * SEGS_PER_TYPE; // 5 shape types max
const TRAIL_SEGS     = 7;

// ─── Speed ───────────────────────────────────────────────────────────────────
const NORMAL_SPEED = 2.0;   // slightly slower — easier to control
const BOOST_SPEED  = 7.5;   // 3.75× normal, hold-only
const SPEED_LERP   = 0.18;  // smooth speed transitions

// ─── Steering ────────────────────────────────────────────────────────────────
const MAX_TURN_RATE = 0.14;  // radians / tick — responsive smooth arcs

// ─── Camera ──────────────────────────────────────────────────────────────────
const CAM_LERP       = 0.08;  // tighter follow, no floatiness
const CAM_AHEAD      = 28;    // modest look-ahead during normal movement
const CAM_AHEAD_NONE = 0;     // no look-ahead during boost — camera stays on player

// ─── Grid ────────────────────────────────────────────────────────────────────
const GRID_SPACING = 100;
const TICK_MS      = 16;     // ~60 fps

// ─── Game rules ──────────────────────────────────────────────────────────────
const TOTAL_MATCH_SHAPES = 48;  // shapes to collect in match (bot starts at 1 bonus)
const SHAPES_ON_FIELD    = 15;  // maintained on screen until pool runs out
const INITIAL_BOT_SCORE  = 1;
const SHAPE_R            = 16;  // visual radius of field items
const COLLECT_R          = 28;  // pickup trigger radius
const COLLISION_DIST     = HEAD_R + BODY_R + 4;  // ~30 px

// ─── Bot AI ──────────────────────────────────────────────────────────────────
const BOT_START_X        = 2680;
const BOT_START_Y        = 2680;
const BOT_INIT_ANGLE     = -(Math.PI * 0.75);  // heading up-left
const BOT_AI_RETICK           = 45;
const BOT_BOOST_DURATION_MIN  = 120;  // game ticks (~2 s at 60 fps)
const BOT_BOOST_DURATION_MAX  = 180;  // game ticks (~3 s at 60 fps)
const BOT_BOOST_COOLDOWN_MIN  = 600;  // game ticks (~10 s)
const BOT_BOOST_COOLDOWN_MAX  = 720;  // game ticks (~12 s)
const BOT_WALL_MARGIN         = 260;
const BOT_COLOR          = '#FF375F';

// ─── Shape visuals ───────────────────────────────────────────────────────────
const SHAPE_FIELD_COLORS = [
  '#FFD60A', '#00D4FF', '#34C759', '#BF5AF2', '#FF9500', '#5E5CE6', '#FF4444',
];
const SHAPE_SYMBOLS: Record<GameShape, string> = {
  Circle:   '●',
  Square:   '■',
  Triangle: '▲',
  Star:     '★',
  Hexagon:  '⬡',
};

// ─── Types ───────────────────────────────────────────────────────────────────
interface Vec2       { x: number; y: number }
type   GameStatus  = 'countdown' | 'playing' | 'paused' | 'dead' | 'gameover';

interface CollectedSeg {
  shape: GameShape;
  count: number;
  color: string; // color of the first item of this type collected
}

interface SnakeCore {
  angle:         number;
  targetAngle:   number;
  path:          Vec2[];   // [0] = head tip (most recent)
  speed:         number;
  isBoost:       boolean;
  score:         number;
  numSegs:       number;
  collectedSegs: CollectedSeg[];
}

interface BotExtra {
  aiTimer:       number;  // ticks until next AI decision
  boostTimer:    number;  // remaining ticks of current boost
  boostCooldown: number;  // ticks to wait before next boost is allowed
}

interface ShapeItem {
  id:    string;
  x:     number;
  y:     number;
  shape: GameShape;
  color: string;
}

interface World {
  status:        GameStatus;
  player:        SnakeCore;
  bot:           SnakeCore & BotExtra;
  shapes:        ShapeItem[];
  shapesSpawned: number;  // total ever placed (max = TOTAL_MATCH_SHAPES)
  camX:          number;
  camY:          number;
  wallDeath:     boolean;
}

// ─── Math helpers ────────────────────────────────────────────────────────────
function angleDiff(from: number, to: number): number {
  let d = to - from;
  while (d >  Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}
function isReversal(cur: number, req: number): boolean {
  return Math.abs(angleDiff(cur, req)) > Math.PI * 0.75;
}
function dist2(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// ─── Path builder ────────────────────────────────────────────────────────────
function buildPath(sx: number, sy: number, angle: number, numSegs: number): Vec2[] {
  const count = (numSegs + 4) * Math.ceil(SEG_GAP / NORMAL_SPEED) + 80;
  return Array.from({ length: count }, (_, i) => ({
    x: sx - Math.cos(angle) * i * NORMAL_SPEED,
    y: sy - Math.sin(angle) * i * NORMAL_SPEED,
  }));
}

// ─── Body positions (sampled from path) ──────────────────────────────────────
function getBodyPositions(snake: SnakeCore): Vec2[] {
  const step = Math.max(1, Math.round(SEG_GAP / Math.max(snake.speed, NORMAL_SPEED)));
  const out: Vec2[] = [];
  for (let i = 0; i < snake.numSegs; i++) {
    const idx = i === 0 ? 0 : i * step;
    const pos = snake.path[Math.min(idx, snake.path.length - 1)];
    if (pos) out.push(pos);
  }
  return out;
}

// ─── Shape spawning ──────────────────────────────────────────────────────────
let _shapeSeq = 0;
function spawnShape(existing: ShapeItem[]): ShapeItem {
  const M = 300;
  let x = M, y = M;
  for (let t = 0; t < 20; t++) {
    const nx = M + Math.random() * (ARENA_W - M * 2);
    const ny = M + Math.random() * (ARENA_H - M * 2);
    if (!existing.some(s => dist2({ x: nx, y: ny }, s) < 220)) { x = nx; y = ny; break; }
  }
  return {
    id:    `sh${_shapeSeq++}`,
    x, y,
    shape: GAME_SHAPE_NAMES[Math.floor(Math.random() * GAME_SHAPE_NAMES.length)],
    color: SHAPE_FIELD_COLORS[Math.floor(Math.random() * SHAPE_FIELD_COLORS.length)],
  };
}

function makeInitialShapes(): ShapeItem[] {
  const arr: ShapeItem[] = [];
  for (let i = 0; i < SHAPES_ON_FIELD; i++) arr.push(spawnShape(arr));
  return arr;
}

// ─── Collect a shape into a snake ────────────────────────────────────────────
function collectShape(snake: SnakeCore, item: ShapeItem): void {
  snake.score += 1;
  const existing = snake.collectedSegs.find(s => s.shape === item.shape);
  if (existing) {
    existing.count += 1;
    // Same type → no new body segment; just increment counter
  } else {
    snake.collectedSegs.push({ shape: item.shape, count: 1, color: item.color });
    snake.numSegs = Math.min(MAX_SEGS, snake.numSegs + SEGS_PER_TYPE);
  }
}

// ─── Bot AI ──────────────────────────────────────────────────────────────────
function botWallAvoid(bot: SnakeCore & BotExtra): void {
  const h = bot.path[0];
  let ax = 0, ay = 0;
  if (h.x < BOT_WALL_MARGIN)            ax += 1;
  if (h.x > ARENA_W - BOT_WALL_MARGIN)  ax -= 1;
  if (h.y < BOT_WALL_MARGIN)            ay += 1;
  if (h.y > ARENA_H - BOT_WALL_MARGIN)  ay -= 1;
  if (ax !== 0 || ay !== 0) {
    const safe = Math.atan2(ay, ax);
    if (!isReversal(bot.angle, safe)) bot.targetAngle = safe;
  }
}

function runBotAI(world: World): void {
  const bot    = world.bot;
  const player = world.player;
  const head   = bot.path[0];

  // ── Wall avoidance (every tick, highest priority) ──
  botWallAvoid(bot);

  // ── Boost management (every game tick — correct timing) ──
  if (bot.boostTimer > 0) {
    bot.boostTimer--;
    bot.isBoost = bot.boostTimer > 0;
    if (bot.boostTimer === 0) {
      // Boost just ended → arm the cooldown before next boost
      bot.boostCooldown = BOT_BOOST_COOLDOWN_MIN +
        Math.floor(Math.random() * (BOT_BOOST_COOLDOWN_MAX - BOT_BOOST_COOLDOWN_MIN));
    }
  } else if (bot.boostCooldown > 0) {
    bot.boostCooldown--;
  } else {
    // Cooldown expired → activate a short burst
    bot.boostTimer = BOT_BOOST_DURATION_MIN +
      Math.floor(Math.random() * (BOT_BOOST_DURATION_MAX - BOT_BOOST_DURATION_MIN));
    bot.isBoost = true;
  }

  // ── AI decision (every BOT_AI_RETICK ticks) ──
  bot.aiTimer--;
  if (bot.aiTimer > 0) return;
  bot.aiTimer = BOT_AI_RETICK + Math.floor(Math.random() * 25);

  // Choose target based on score gap
  const scoreDiff = bot.score - player.score;
  let target: Vec2;

  const nearestShape = world.shapes.reduce<ShapeItem | null>((best, s) =>
    (!best || dist2(head, s) < dist2(head, best)) ? s : best, null);

  if (scoreDiff <= 0) {
    // Bot is behind or tied → aggressively collect nearest shape
    target = nearestShape ?? player.path[0];
  } else if (scoreDiff === 1) {
    // Exactly 1 ahead → mostly collect, sometimes pressure
    target = Math.random() < 0.25 ? player.path[0] : (nearestShape ?? player.path[0]);
  } else {
    // 2+ ahead → can afford to chase/block player more
    target = Math.random() < 0.45 ? player.path[0] : (nearestShape ?? player.path[0]);
  }

  const angleToTarget = Math.atan2(target.y - head.y, target.x - head.x);
  if (!isReversal(bot.angle, angleToTarget)) bot.targetAngle = angleToTarget;
}

// ─── World factory ───────────────────────────────────────────────────────────
function freshWorld(): World {
  const pAngle = -Math.PI / 2; // player starts heading up
  return {
    status: 'countdown',
    player: {
      angle:         pAngle,
      targetAngle:   pAngle,
      path:          buildPath(ARENA_W / 2, ARENA_H / 2, pAngle, BASE_SEGS),
      speed:         NORMAL_SPEED,
      isBoost:       false,
      score:         0,
      numSegs:       BASE_SEGS,
      collectedSegs: [],
    },
    bot: {
      angle:         BOT_INIT_ANGLE,
      targetAngle:   BOT_INIT_ANGLE,
      path:          buildPath(BOT_START_X, BOT_START_Y, BOT_INIT_ANGLE, BASE_SEGS),
      speed:         NORMAL_SPEED,
      isBoost:       false,
      score:         INITIAL_BOT_SCORE,
      numSegs:       BASE_SEGS,
      collectedSegs: [],
      aiTimer:       BOT_AI_RETICK,
      boostTimer:    0,
      boostCooldown: 300,  // 5 s head-start before the first bot boost
    },
    shapes:        makeInitialShapes(),
    shapesSpawned: SHAPES_ON_FIELD,
    camX:          ARENA_W / 2,
    camY:          ARENA_H / 2 - CAM_AHEAD,
    wallDeath:     false,
  };
}

// ─── Static arena decorations (Phase 1, unchanged) ───────────────────────────
interface LightPool { x: number; y: number; r: number; color: string; opacity: number }
interface ZoneRing  { x: number; y: number; r: number }

const LIGHT_POOLS: LightPool[] = (() => {
  const cols = ['#5E5CE6','#00D4FF','#34C759','#FF375F','#FFD700','#BF5AF2'];
  const pts: [number,number][] = [
    [500,500],[1400,350],[2000,700],[2800,300],[3500,600],
    [700,1300],[1600,1100],[2500,900],[3400,1300],
    [350,2000],[1200,2500],[2000,2000],[3000,2300],[3600,1800],
    [550,2900],[1800,3100],[2600,2800],[3400,3100],
    [400,3500],[1500,3700],[2200,3400],[3100,3600],[3600,3300],
  ];
  return pts.map(([x,y],i)=>({x,y,r:200+(i%5)*60,color:cols[i%cols.length],opacity:0.035+(i%4)*0.015}));
})();

const ZONE_RINGS: ZoneRing[] = [
  {x:1000,y:1000,r:280},{x:3000,y:1000,r:240},{x:2000,y:2000,r:380},
  {x:1000,y:3000,r:260},{x:3000,y:3000,r:300},{x:500,y:2000,r:180},
  {x:3500,y:2000,r:200},{x:2000,y:500,r:220},{x:2000,y:3500,r:220},
];

// ─── Component ───────────────────────────────────────────────────────────────
export default function SnakeShiftScreen() {
  const insets     = useSafeAreaInsets();
  const { playerData } = usePlayer();
  const character  = CHARACTERS.find(c => c.id === playerData.selectedCharacter) ?? CHARACTERS[0];
  const snakeColor = GAME_COLORS[character.defaultColor];

  const [tick,      setTick]      = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [isPaused,  setIsPaused]  = useState(false);

  const worldRef      = useRef<World>(freshWorld());
  const gameLoopRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  // Cooldown prevents the collision haptic from firing at 60 Hz; counts down in ticks
  const collisionHapticCooldownRef = useRef(0);
  const isPressingRef = useRef(false);
  const isSteering    = useRef(false);   // true once finger has moved enough to steer
  const holdTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks last known pointer position so we derive angle from incremental movement,
  // not total displacement — prevents spinning in small circles
  const lastTouchRef  = useRef<{ x: number; y: number } | null>(null);

  const forceRender = useCallback(() => setTick(t => t + 1), []);

  const stopLoop = useCallback(() => {
    if (gameLoopRef.current) { clearInterval(gameLoopRef.current); gameLoopRef.current = null; }
  }, []);

  // ─── Game tick (ref pattern keeps it always fresh, no stale closures) ──────
  const tickFnRef = useRef<() => void>(() => {});
  tickFnRef.current = () => {
    const w = worldRef.current;
    if (w.status !== 'playing') return;

    const p = w.player;
    const b = w.bot;

    // ── Player ──────────────────────────────────────────────────────────────
    p.speed += ((p.isBoost ? BOOST_SPEED : NORMAL_SPEED) - p.speed) * SPEED_LERP;
    const pd = angleDiff(p.angle, p.targetAngle);
    p.angle += Math.min(Math.abs(pd), MAX_TURN_RATE) * Math.sign(pd);
    const pcA = Math.cos(p.angle), psA = Math.sin(p.angle);
    const pOld = p.path[0];
    const pNew: Vec2 = { x: pOld.x + pcA * p.speed, y: pOld.y + psA * p.speed };

    // Wall death for player
    if (pNew.x < HEAD_R || pNew.x > ARENA_W - HEAD_R ||
        pNew.y < HEAD_R || pNew.y > ARENA_H - HEAD_R) {
      w.status = 'dead'; w.wallDeath = true;
      stopLoop(); forceRender(); return;
    }

    p.path.unshift(pNew);
    // Always trim using NORMAL_SPEED step so boost never discards history needed by getBodyPositions
    const pNormalStep = Math.max(1, Math.round(SEG_GAP / NORMAL_SPEED));
    const pNeeded  = (p.numSegs + 4) * pNormalStep + 30;
    if (p.path.length > pNeeded) p.path.length = pNeeded;

    // ── Bot ─────────────────────────────────────────────────────────────────
    b.speed += ((b.isBoost ? BOOST_SPEED : NORMAL_SPEED) - b.speed) * SPEED_LERP;
    const bd = angleDiff(b.angle, b.targetAngle);
    b.angle += Math.min(Math.abs(bd), MAX_TURN_RATE) * Math.sign(bd);
    const bcA = Math.cos(b.angle), bsA = Math.sin(b.angle);
    const bOld = b.path[0];
    const bRaw: Vec2 = { x: bOld.x + bcA * b.speed, y: bOld.y + bsA * b.speed };
    // Bot clamps instead of dying (wall avoidance via AI keeps it from walls)
    const bNew: Vec2 = {
      x: Math.max(HEAD_R, Math.min(ARENA_W - HEAD_R, bRaw.x)),
      y: Math.max(HEAD_R, Math.min(ARENA_H - HEAD_R, bRaw.y)),
    };

    b.path.unshift(bNew);
    // Always trim using NORMAL_SPEED step so boost never discards history needed by getBodyPositions
    const bNormalStep = Math.max(1, Math.round(SEG_GAP / NORMAL_SPEED));
    const bNeeded = (b.numSegs + 4) * bNormalStep + 30;
    if (b.path.length > bNeeded) b.path.length = bNeeded;

    // ── Bot AI (every tick: wall avoidance; every N ticks: target decision) ─
    runBotAI(w);

    // ── Collision: player head vs bot body segments ──────────────────────────
    // Score is NEVER reduced on bot collision. Player is pushed away (slide/block).
    const bBodyPos = getBodyPositions(b);
    if (collisionHapticCooldownRef.current > 0) collisionHapticCooldownRef.current--;
    let closestBotSeg: Vec2 | null = null;
    let closestDist = Infinity;
    for (const seg of bBodyPos) {
      const d = dist2(pNew, seg);
      if (d < COLLISION_DIST && d < closestDist) { closestDist = d; closestBotSeg = seg; }
    }
    if (closestBotSeg !== null) {
      // Push player head to exactly COLLISION_DIST away from the colliding segment
      const dx = pNew.x - closestBotSeg.x;
      const dy = pNew.y - closestBotSeg.y;
      const mag = Math.sqrt(dx * dx + dy * dy) || 1;
      pNew.x = closestBotSeg.x + (dx / mag) * COLLISION_DIST;
      pNew.y = closestBotSeg.y + (dy / mag) * COLLISION_DIST;
      // Light haptic feedback — no score change
      if (Platform.OS !== 'web' && !p.isBoost && collisionHapticCooldownRef.current === 0) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        collisionHapticCooldownRef.current = 25; // ~400 ms at 60 fps
      }
    }

    // ── Shape collection ────────────────────────────────────────────────────
    const remove = new Set<string>();
    for (const s of w.shapes) {
      if (!remove.has(s.id) && dist2(pNew, s) < COLLECT_R) {
        collectShape(p, s); remove.add(s.id);
      } else if (!remove.has(s.id) && dist2(bNew, s) < COLLECT_R) {
        collectShape(b, s); remove.add(s.id);
      }
    }
    if (remove.size > 0) {
      w.shapes = w.shapes.filter(s => !remove.has(s.id));
      // Respawn until pool exhausted
      const toSpawn = Math.min(remove.size, TOTAL_MATCH_SHAPES - w.shapesSpawned);
      for (let i = 0; i < toSpawn; i++) {
        w.shapes.push(spawnShape(w.shapes));
        w.shapesSpawned++;
      }
    }

    // ── Game over: all shapes collected ─────────────────────────────────────
    if (w.shapes.length === 0 && w.shapesSpawned >= TOTAL_MATCH_SHAPES) {
      w.status = 'gameover';
      stopLoop(); forceRender(); return;
    }

    // ── Camera — no look-ahead during boost so camera doesn't rush forward ──
    const camLookAhead = p.isBoost ? CAM_AHEAD_NONE : CAM_AHEAD;
    w.camX += (pNew.x + pcA * camLookAhead - w.camX) * CAM_LERP;
    w.camY += (pNew.y + psA * camLookAhead - w.camY) * CAM_LERP;

    forceRender();
  };

  // ─── Start game ──────────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    worldRef.current.status = 'playing';
    gameLoopRef.current = setInterval(() => tickFnRef.current(), TICK_MS);
  }, []);

  // ─── Steer player ────────────────────────────────────────────────────────
  const steer = useCallback((newAngle: number) => {
    const p = worldRef.current.player;
    if (worldRef.current.status !== 'playing') return;
    if (isReversal(p.angle, newAngle)) return;
    p.targetAngle = newAngle;
  }, []);

  // ─── Pan responder ───────────────────────────────────────────────────────
  // Worms-Zone-style controls:
  //   • Angle is computed from the INCREMENTAL movement between each event
  //     (not total displacement) — eliminates spinning in small circles.
  //   • A 4 px minimum per-frame delta filters micro-jitter noise.
  //   • Boost = hold finger still for 120 ms without moving.
  //   • Any finger movement cancels boost immediately.
  const panResponder = React.useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => worldRef.current.status === 'playing',
    onMoveShouldSetPanResponder:  () => worldRef.current.status === 'playing',

    onPanResponderGrant: (evt) => {
      isPressingRef.current = true;
      isSteering.current    = false;
      lastTouchRef.current  = { x: evt.nativeEvent.pageX, y: evt.nativeEvent.pageY };
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      holdTimerRef.current = setTimeout(() => {
        if (!isSteering.current && isPressingRef.current) {
          worldRef.current.player.isBoost = true;
          forceRender();
        }
      }, 120);
    },

    onPanResponderMove: (evt) => {
      const cx = evt.nativeEvent.pageX;
      const cy = evt.nativeEvent.pageY;
      const last = lastTouchRef.current;
      if (!last) { lastTouchRef.current = { x: cx, y: cy }; return; }
      const ddx = cx - last.x;
      const ddy = cy - last.y;
      const moveDist = Math.sqrt(ddx * ddx + ddy * ddy);
      if (moveDist > 4) {
        if (!isSteering.current) {
          isSteering.current = true;
          if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
          worldRef.current.player.isBoost = false;
        }
        steer(Math.atan2(ddy, ddx));
        lastTouchRef.current = { x: cx, y: cy };
      }
    },

    onPanResponderRelease: () => {
      isPressingRef.current = false;
      isSteering.current    = false;
      lastTouchRef.current  = null;
      worldRef.current.player.isBoost = false;
      if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
    },

    onPanResponderTerminate: () => {
      isPressingRef.current = false;
      isSteering.current    = false;
      lastTouchRef.current  = null;
      worldRef.current.player.isBoost = false;
      if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
    },
  }), [steer, forceRender]);

  // ─── Countdown ───────────────────────────────────────────────────────────
  useEffect(() => {
    let count = 3;
    setCountdown(count);
    countdownRef.current = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(countdownRef.current!);
        setCountdown(0);
        startGame();
      } else {
        setCountdown(count);
      }
    }, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      stopLoop();
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, []);

  // ─── Pause / resume ──────────────────────────────────────────────────────
  const togglePause = useCallback(() => {
    const w = worldRef.current;
    if (w.status === 'playing') {
      w.status = 'paused'; stopLoop(); setIsPaused(true);
    } else if (w.status === 'paused') {
      w.status = 'playing';
      gameLoopRef.current = setInterval(() => tickFnRef.current(), TICK_MS);
      setIsPaused(false);
    }
  }, [stopLoop]);

  // ─── Restart ─────────────────────────────────────────────────────────────
  const restart = useCallback(() => {
    stopLoop();
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    _shapeSeq    = 0;
    worldRef.current = freshWorld();
    setIsPaused(false);
    let count = 3;
    setCountdown(count);
    countdownRef.current = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(countdownRef.current!);
        setCountdown(0);
        startGame();
      } else {
        setCountdown(count);
      }
    }, 1000);
  }, [stopLoop, startGame]);

  const goHome = useCallback(() => { stopLoop(); router.replace('/menu'); }, [stopLoop]);

  // ─── Render ──────────────────────────────────────────────────────────────
  const w          = worldRef.current;
  const p          = w.player;
  const b          = w.bot;
  const isBoost    = p.isBoost;
  const headGlow   = isBoost ? '#FFD700' : snakeColor;
  const translateX = SW / 2 - w.camX;
  const translateY = SH / 2 - w.camY;

  // Viewport culling bounds
  const vL = w.camX - SW / 2 - GRID_SPACING * 2;
  const vT = w.camY - SH / 2 - GRID_SPACING * 2;
  const vR = w.camX + SW / 2 + GRID_SPACING * 2;
  const vB = w.camY + SH / 2 + GRID_SPACING * 2;

  // Body positions
  const pSegs = getBodyPositions(p);
  const bSegs = getBodyPositions(b);

  // Dot grid (viewport-culled)
  const gSX = Math.max(0, Math.floor(vL / GRID_SPACING)) * GRID_SPACING;
  const gSY = Math.max(0, Math.floor(vT / GRID_SPACING)) * GRID_SPACING;
  const gridDots: Vec2[] = [];
  for (let gx = gSX; gx <= Math.min(ARENA_W, vR); gx += GRID_SPACING)
    for (let gy = gSY; gy <= Math.min(ARENA_H, vB); gy += GRID_SPACING)
      gridDots.push({ x: gx, y: gy });

  // Decorations (viewport-culled)
  const visPools = LIGHT_POOLS.filter(q => q.x+q.r>vL && q.x-q.r<vR && q.y+q.r>vT && q.y-q.r<vB);
  const visRings = ZONE_RINGS.filter(r  => r.x+r.r>vL && r.x-r.r<vR && r.y+r.r>vT && r.y-r.r<vB);
  const visShapes = w.shapes.filter(s   => s.x+SHAPE_R>vL && s.x-SHAPE_R<vR && s.y+SHAPE_R>vT && s.y-SHAPE_R<vB);

  const isDead     = w.status === 'dead';
  const isGameOver = w.status === 'gameover';
  const playerWins = p.score > b.score;
  const totalEarned = p.score + b.score; // bot's 1 + collected = dynamic

  return (
    <View style={styles.root}>
      {/* Background */}
      <LinearGradient colors={['#050512','#06061A','#050512']} style={StyleSheet.absoluteFill} />

      {/* Full-screen gesture layer */}
      <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers} />

      {/* ── Arena ── */}
      <View style={[styles.arena, { transform: [{ translateX }, { translateY }], pointerEvents: 'none' }]}>

        {/* Ambient light pools */}
        {visPools.map((pool, i) => (
          <View key={`lp${i}`} style={{
            position:'absolute', left:pool.x-pool.r, top:pool.y-pool.r,
            width:pool.r*2, height:pool.r*2, borderRadius:pool.r,
            backgroundColor:pool.color, opacity:pool.opacity,
          }} />
        ))}

        {/* Zone rings */}
        {visRings.map((ring, i) => (
          <View key={`zr${i}`} style={{
            position:'absolute', left:ring.x-ring.r, top:ring.y-ring.r,
            width:ring.r*2, height:ring.r*2, borderRadius:ring.r,
            borderWidth:1, borderColor:'rgba(94,92,230,0.09)', backgroundColor:'transparent',
          }} />
        ))}

        {/* Dot grid */}
        {gridDots.map((dot, i) => (
          <View key={`g${i}`} style={{
            position:'absolute', left:dot.x-1, top:dot.y-1,
            width:2, height:2, borderRadius:1, backgroundColor:'rgba(94,92,230,0.16)',
          }} />
        ))}

        {/* Arena border */}
        <View style={styles.arenaBorderOuter} />
        <View style={styles.arenaBorderInner} />
        <View style={[styles.corner,{top:20,left:20}]} />
        <View style={[styles.corner,{top:20,right:20}]} />
        <View style={[styles.corner,{bottom:20,left:20}]} />
        <View style={[styles.corner,{bottom:20,right:20}]} />

        {/* ── Shape items on field ── */}
        {visShapes.map(shape => (
          <View key={shape.id} style={{
            position:'absolute', left:shape.x-SHAPE_R, top:shape.y-SHAPE_R,
            width:SHAPE_R*2, height:SHAPE_R*2, borderRadius:SHAPE_R,
            backgroundColor:shape.color, alignItems:'center', justifyContent:'center',
            borderWidth:2, borderColor:'rgba(255,255,255,0.30)',
            boxShadow:`0 0 8px ${shape.color}`, elevation:6,
          }}>
            <Text style={{ fontSize:10, color:'#FFFFFF', fontWeight:'bold', lineHeight:12 }}>
              {SHAPE_SYMBOLS[shape.shape]}
            </Text>
          </View>
        ))}

        {/* ═══════════════════════════════════════════════
            BOT SNAKE
        ═══════════════════════════════════════════════ */}

        {/* Bot boost trail */}
        {b.isBoost && bSegs.slice(1, TRAIL_SEGS + 1).map((seg, i) => {
          const r = BODY_R * (2.0 - i * 0.20);
          return (
            <View key={`btr${i}`} style={{
              position:'absolute', left:seg.x-r, top:seg.y-r, width:r*2, height:r*2,
              borderRadius:r, backgroundColor:BOT_COLOR, opacity:Math.max(0, 0.18 - i*0.022),
            }} />
          );
        })}

        {/* Bot body — geometric blocks (tail → head) */}
        {Array.from({ length: b.numSegs - 1 }, (_, i) => {
          const si  = b.numSegs - 1 - i;
          const seg = bSegs[si]; if (!seg) return null;
          const t   = si / Math.max(1, b.numSegs - 1);
          const sz  = Math.max(12, BODY_R * 2.5 * (1 - t * 0.48));
          const shape = GAME_SHAPE_NAMES[si % GAME_SHAPE_NAMES.length];
          return (
            <View key={`bb${si}`} style={{
              position:'absolute', left:seg.x-sz/2, top:seg.y-sz/2,
              width:sz, height:sz, borderRadius:sz*0.28,
              backgroundColor:`${BOT_COLOR}18`,
              borderWidth:1.5, borderColor:`${BOT_COLOR}80`,
              alignItems:'center', justifyContent:'center',
              boxShadow:`0 0 ${Math.max(4, 10*(1-t))}px ${BOT_COLOR}`,
              opacity: b.isBoost ? 0.7 : 1,
            }}>
              <Text style={{
                fontSize:sz*0.46, color:BOT_COLOR,
                textShadowColor:BOT_COLOR, textShadowOffset:{width:0,height:0},
                textShadowRadius:6, lineHeight:sz*0.56,
              }}>{SHAPE_SYMBOLS[shape]}</Text>
            </View>
          );
        })}

        {/* Bot connectors */}
        {Array.from({ length: Math.min(b.numSegs - 1, bSegs.length - 1) }, (_, i) => {
          const segA = bSegs[i], segB = bSegs[i + 1];
          if (!segA || !segB) return null;
          const t  = i / Math.max(1, b.numSegs - 1);
          const cr = Math.max(4, BODY_R * 0.55 * (1 - t * 0.5));
          return (
            <View key={`bc${i}`} style={{
              position:'absolute',
              left:(segA.x+segB.x)/2-cr, top:(segA.y+segB.y)/2-cr,
              width:cr*2, height:cr*2,
              backgroundColor:`${BOT_COLOR}28`,
              borderWidth:1, borderColor:`${BOT_COLOR}60`,
              transform:[{ rotate:'45deg' }],
            }} />
          );
        })}

        {/* Bot head — geometric hexagon wireframe */}
        {bSegs[0] && (() => {
          const h = bSegs[0];
          const hR = HEAD_R * 1.6;
          const svgS = hR * 2.6;
          const scx = svgS / 2, scy = svgS / 2;
          const rotateDeg = b.angle * 180 / Math.PI;
          const outerPts = Array.from({length:6},(_,qi)=>{const a=qi*Math.PI/3;return `${scx+hR*Math.cos(a)},${scy+hR*Math.sin(a)}`;}).join(' ');
          const innerPts = Array.from({length:6},(_,qi)=>{const a=qi*Math.PI/3+Math.PI/6;return `${scx+hR*0.42*Math.cos(a)},${scy+hR*0.42*Math.sin(a)}`;}).join(' ');
          const outerV  = Array.from({length:6},(_,qi)=>({x:scx+hR*Math.cos(qi*Math.PI/3),y:scy+hR*Math.sin(qi*Math.PI/3)}));
          const innerV  = Array.from({length:6},(_,qi)=>({x:scx+hR*0.42*Math.cos(qi*Math.PI/3+Math.PI/6),y:scy+hR*0.42*Math.sin(qi*Math.PI/3+Math.PI/6)}));
          const fc=Math.cos(b.angle),fs=Math.sin(b.angle),pc2=-Math.sin(b.angle),ps2=Math.cos(b.angle);
          const eDist=hR*0.45, eSep=hR*0.28;
          return (
            <>
              <View style={{position:'absolute',left:h.x-hR*1.9,top:h.y-hR*1.9,width:hR*3.8,height:hR*3.8,borderRadius:hR*1.9,backgroundColor:BOT_COLOR,opacity:b.isBoost?0.18:0.08}}/>
              <View style={{position:'absolute',left:h.x-svgS/2,top:h.y-svgS/2,width:svgS,height:svgS,transform:[{rotate:`${rotateDeg}deg`}]}}>
                <Svg width={svgS} height={svgS}>
                  <SvgPolygon points={outerPts} fill={`${BOT_COLOR}18`} stroke={BOT_COLOR} strokeWidth={2} strokeLinejoin="round"/>
                  <SvgPolygon points={innerPts} fill={`${BOT_COLOR}10`} stroke={BOT_COLOR} strokeWidth={1} opacity={0.7}/>
                  {outerV.map((ov,qi)=><SvgLine key={qi} x1={ov.x} y1={ov.y} x2={innerV[qi].x} y2={innerV[qi].y} stroke={BOT_COLOR} strokeWidth={0.8} opacity={0.5}/>)}
                </Svg>
              </View>
              <View style={{position:'absolute',left:h.x+fc*eDist+pc2*eSep-3.5,top:h.y+fs*eDist+ps2*eSep-3.5,width:7,height:7,borderRadius:3.5,backgroundColor:'#FFFFFF',boxShadow:'0 0 4px #FFFFFF'}}/>
              <View style={{position:'absolute',left:h.x+fc*eDist-pc2*eSep-3.5,top:h.y+fs*eDist-ps2*eSep-3.5,width:7,height:7,borderRadius:3.5,backgroundColor:'#FFFFFF',boxShadow:'0 0 4px #FFFFFF'}}/>
            </>
          );
        })()}

        {/* ═══════════════════════════════════════════════
            PLAYER SNAKE
        ═══════════════════════════════════════════════ */}

        {/* Player boost trail */}
        {isBoost && pSegs.slice(1, TRAIL_SEGS + 1).map((seg, i) => {
          const r = BODY_R * (2.2 - i * 0.22);
          return (
            <View key={`ptr${i}`} style={{
              position:'absolute', left:seg.x-r, top:seg.y-r, width:r*2, height:r*2,
              borderRadius:r, backgroundColor:'#FFD700', opacity:Math.max(0, 0.22 - i*0.028),
            }} />
          );
        })}

        {/* Player body — geometric blocks (tail → head) */}
        {Array.from({ length: p.numSegs - 1 }, (_, i) => {
          const si    = p.numSegs - 1 - i;
          const seg   = pSegs[si]; if (!seg) return null;
          const t     = si / Math.max(1, p.numSegs - 1);
          const sz    = Math.max(12, BODY_R * 2.6 * (1 - t * 0.46));
          const badge = p.collectedSegs[si - 1];
          const shape = badge?.shape ?? GAME_SHAPE_NAMES[si % GAME_SHAPE_NAMES.length];
          const shapeColor = badge?.color ?? snakeColor;
          return (
            <View key={`pb${si}`} style={{
              position:'absolute', left:seg.x-sz/2, top:seg.y-sz/2,
              width:sz, height:sz, borderRadius:sz*0.28,
              backgroundColor:badge ? `${badge.color}18` : `${snakeColor}18`,
              borderWidth:1.5, borderColor:badge ? `${badge.color}88` : `${snakeColor}70`,
              alignItems:'center', justifyContent:'center',
              boxShadow:`0 0 ${Math.max(5, 13*(1-t))}px ${shapeColor}`,
              opacity: isBoost ? 0.75 : 1,
            }}>
              <Text style={{
                fontSize:sz*0.47, color:shapeColor,
                textShadowColor:shapeColor, textShadowOffset:{width:0,height:0},
                textShadowRadius:badge ? 9 : 5, lineHeight:sz*0.56,
              }}>{SHAPE_SYMBOLS[shape]}</Text>
            </View>
          );
        })}

        {/* Player connectors */}
        {Array.from({ length: Math.min(p.numSegs - 1, pSegs.length - 1) }, (_, i) => {
          const segA = pSegs[i], segB = pSegs[i + 1];
          if (!segA || !segB) return null;
          const t  = i / Math.max(1, p.numSegs - 1);
          const cr = Math.max(4, BODY_R * 0.58 * (1 - t * 0.5));
          return (
            <View key={`pc${i}`} style={{
              position:'absolute',
              left:(segA.x+segB.x)/2-cr, top:(segA.y+segB.y)/2-cr,
              width:cr*2, height:cr*2,
              backgroundColor:`${snakeColor}25`,
              borderWidth:1, borderColor:`${snakeColor}60`,
              transform:[{ rotate:'45deg' }],
            }} />
          );
        })}

        {/* Player head — geometric hexagon wireframe */}
        {pSegs[0] && (() => {
          const h = pSegs[0];
          const hR = HEAD_R * 1.75;
          const svgS = hR * 2.6;
          const scx = svgS / 2, scy = svgS / 2;
          const rotateDeg = p.angle * 180 / Math.PI;
          const outerPts = Array.from({length:6},(_,qi)=>{const a=qi*Math.PI/3;return `${scx+hR*Math.cos(a)},${scy+hR*Math.sin(a)}`;}).join(' ');
          const innerPts = Array.from({length:6},(_,qi)=>{const a=qi*Math.PI/3+Math.PI/6;return `${scx+hR*0.42*Math.cos(a)},${scy+hR*0.42*Math.sin(a)}`;}).join(' ');
          const outerV  = Array.from({length:6},(_,qi)=>({x:scx+hR*Math.cos(qi*Math.PI/3),y:scy+hR*Math.sin(qi*Math.PI/3)}));
          const innerV  = Array.from({length:6},(_,qi)=>({x:scx+hR*0.42*Math.cos(qi*Math.PI/3+Math.PI/6),y:scy+hR*0.42*Math.sin(qi*Math.PI/3+Math.PI/6)}));
          const fc=Math.cos(p.angle),fs=Math.sin(p.angle),pc2=-Math.sin(p.angle),ps2=Math.cos(p.angle);
          const eDist=hR*0.48, eSep=hR*0.30;
          return (
            <>
              <View style={{position:'absolute',left:h.x-hR*2.0,top:h.y-hR*2.0,width:hR*4.0,height:hR*4.0,borderRadius:hR*2,backgroundColor:headGlow,opacity:isBoost?0.22:0.10}}/>
              <View style={{position:'absolute',left:h.x-svgS/2,top:h.y-svgS/2,width:svgS,height:svgS,transform:[{rotate:`${rotateDeg}deg`}]}}>
                <Svg width={svgS} height={svgS}>
                  <SvgPolygon points={outerPts} fill={`${headGlow}22`} stroke={headGlow} strokeWidth={2.5} strokeLinejoin="round"/>
                  <SvgPolygon points={innerPts} fill={`${headGlow}12`} stroke={headGlow} strokeWidth={1.2} opacity={0.8}/>
                  {outerV.map((ov,qi)=><SvgLine key={qi} x1={ov.x} y1={ov.y} x2={innerV[qi].x} y2={innerV[qi].y} stroke={headGlow} strokeWidth={1.0} opacity={0.55}/>)}
                </Svg>
              </View>
              <View style={{position:'absolute',left:h.x+fc*eDist+pc2*eSep-3.5,top:h.y+fs*eDist+ps2*eSep-3.5,width:7,height:7,borderRadius:3.5,backgroundColor:'#FFFFFF',boxShadow:'0 0 6px #FFFFFF'}}/>
              <View style={{position:'absolute',left:h.x+fc*eDist-pc2*eSep-3.5,top:h.y+fs*eDist-ps2*eSep-3.5,width:7,height:7,borderRadius:3.5,backgroundColor:'#FFFFFF',boxShadow:'0 0 6px #FFFFFF'}}/>
            </>
          );
        })()}
      </View>

      {/* ── HUD ── */}
      <View style={[styles.hud, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity style={styles.hudBtn} onPress={togglePause}
          hitSlop={{ top:10, left:10, right:10, bottom:10 }}>
          <Ionicons name={isPaused ? 'play' : 'pause'} size={16} color="rgba(255,255,255,0.55)" />
        </TouchableOpacity>

        <View style={styles.hudCenter}>
          <Text style={styles.modeLabel}>SNAKE SHIFT</Text>
          {w.status !== 'countdown' && (
            <View style={styles.scoreRow}>
              <View style={styles.scoreBox}>
                <Text style={styles.scoreLabel}>YOU</Text>
                <Text style={[styles.scoreNum, { color: snakeColor }]}>{p.score}</Text>
              </View>
              <Text style={styles.scoreDivider}>:</Text>
              <View style={styles.scoreBox}>
                <Text style={styles.scoreLabel}>BOT</Text>
                <Text style={[styles.scoreNum, { color: BOT_COLOR }]}>{b.score}</Text>
              </View>
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.hudBtn} onPress={goHome}
          hitSlop={{ top:10, left:10, right:10, bottom:10 }}>
          <Ionicons name="home-outline" size={16} color="rgba(255,255,255,0.55)" />
        </TouchableOpacity>
      </View>

      {/* Boost badge */}
      {isBoost && (
        <View style={[styles.boostBadge, { bottom: insets.bottom + 52 }]}>
          <Text style={styles.boostText}>⚡ BOOST</Text>
        </View>
      )}

      {/* Hint */}
      {w.status === 'playing' && p.score === 0 && b.score <= INITIAL_BOT_SCORE && !isBoost && (
        <View style={[styles.hintWrap, { bottom: insets.bottom + 52 }]}>
          <Text style={styles.hintText}>SWIPE TO STEER  ·  HOLD FOR BOOST  ·  COLLECT SHAPES</Text>
        </View>
      )}

      {/* Countdown */}
      {countdown > 0 && (
        <View style={[styles.overlay, { pointerEvents: 'none' }]}>
          <Text style={styles.countdownNum}>{countdown}</Text>
          <Text style={styles.countdownSub}>GET READY</Text>
        </View>
      )}

      {/* Pause overlay */}
      {isPaused && (
        <View style={[StyleSheet.absoluteFill, styles.dimOverlay]}>
          <Text style={styles.overlayTitle}>PAUSED</Text>
          <View style={styles.midScores}>
            <Text style={[styles.midScore, { color: snakeColor }]}>YOU  {p.score}</Text>
            <Text style={styles.midScoreSep}>·</Text>
            <Text style={[styles.midScore, { color: BOT_COLOR }]}>BOT  {b.score}</Text>
          </View>
          <TouchableOpacity style={styles.primaryBtn} onPress={togglePause}>
            <Ionicons name="play" size={20} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>RESUME</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={goHome}>
            <Ionicons name="home-outline" size={18} color="#FFFFFF" />
            <Text style={styles.secondaryBtnText}>MAIN MENU</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Wall-death overlay */}
      {isDead && (
        <View style={[StyleSheet.absoluteFill, styles.dimOverlay]}>
          <Text style={[styles.overlayTitle, styles.deadTitle]}>CRASHED!</Text>
          <Text style={styles.deadSub}>You hit the arena wall</Text>
          <View style={styles.finalScoreRow}>
            <View style={styles.finalScoreBox}>
              <Text style={styles.finalScoreLabel}>YOU</Text>
              <Text style={[styles.finalScoreNum, { color: snakeColor }]}>{p.score}</Text>
            </View>
            <View style={styles.finalScoreBox}>
              <Text style={styles.finalScoreLabel}>BOT</Text>
              <Text style={[styles.finalScoreNum, { color: BOT_COLOR }]}>{b.score}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.primaryBtn} onPress={restart}>
            <Ionicons name="refresh" size={20} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>TRY AGAIN</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={goHome}>
            <Ionicons name="home-outline" size={18} color="#FFFFFF" />
            <Text style={styles.secondaryBtnText}>MAIN MENU</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Match-complete overlay */}
      {isGameOver && (
        <View style={[StyleSheet.absoluteFill, styles.dimOverlay]}>
          <Text style={styles.overlayTitle}>
            {playerWins ? 'YOU WIN!' : p.score === b.score ? 'DRAW!' : 'BOT WINS!'}
          </Text>
          <View style={styles.finalScoreRow}>
            <View style={styles.finalScoreBox}>
              <Text style={styles.finalScoreLabel}>YOU</Text>
              <Text style={[styles.finalScoreNum, { color: snakeColor }]}>{p.score}</Text>
            </View>
            <View style={styles.finalScoreBox}>
              <Text style={styles.finalScoreLabel}>BOT</Text>
              <Text style={[styles.finalScoreNum, { color: BOT_COLOR }]}>{b.score}</Text>
            </View>
          </View>
          <Text style={styles.totalLabel}>Total collected: {totalEarned} / 49</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={restart}>
            <Ionicons name="refresh" size={20} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>PLAY AGAIN</Text>
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

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex:1, backgroundColor:'#050512', overflow:'hidden' },

  // Arena
  arena: { position:'absolute', width:ARENA_W, height:ARENA_H, left:0, top:0, backgroundColor:'#06061C' },
  arenaBorderOuter: { position:'absolute', inset:0, borderWidth:8, borderColor:'rgba(94,92,230,0.06)', borderRadius:2 },
  arenaBorderInner: { position:'absolute', inset:5, borderWidth:1.5, borderColor:'rgba(94,92,230,0.22)', borderRadius:2 },
  corner: { position:'absolute', width:22, height:22, borderWidth:2.5, borderColor:'rgba(94,92,230,0.50)', borderRadius:4 },

  // Head
  head: { position:'absolute', borderWidth:2, elevation:16 },

  // HUD
  hud: { position:'absolute', top:0, left:0, right:0, flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingBottom:10, zIndex:20 },
  hudBtn: { width:36, height:36, borderRadius:10, backgroundColor:'rgba(255,255,255,0.07)', alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:'rgba(255,255,255,0.08)' },
  hudCenter: { flex:1, alignItems:'center' },
  modeLabel: { fontSize:10, fontFamily:'Inter_700Bold', color:'#5E5CE6', letterSpacing:3 },

  // Score display
  scoreRow: { flexDirection:'row', alignItems:'center', gap:10, marginTop:2 },
  scoreBox: { alignItems:'center' },
  scoreLabel: { fontSize:9, fontFamily:'Inter_500Medium', color:'rgba(255,255,255,0.45)', letterSpacing:1 },
  scoreNum: { fontSize:22, fontFamily:'Inter_700Bold', lineHeight:24 },
  scoreDivider: { fontSize:18, color:'rgba(255,255,255,0.25)', fontFamily:'Inter_700Bold' },

  // Boost
  boostBadge: { position:'absolute', alignSelf:'center', backgroundColor:'rgba(255,215,0,0.10)', borderRadius:24, paddingHorizontal:22, paddingVertical:8, borderWidth:1, borderColor:'rgba(255,215,0,0.32)', zIndex:20 },
  boostText: { fontSize:13, fontFamily:'Inter_700Bold', color:'#FFD700', letterSpacing:2 },

  // Hint
  hintWrap: { position:'absolute', alignSelf:'center', zIndex:20 },
  hintText: { fontSize:9, fontFamily:'Inter_500Medium', color:'rgba(255,255,255,0.22)', letterSpacing:1.4 },

  // Overlays
  overlay: { ...StyleSheet.absoluteFillObject, alignItems:'center', justifyContent:'center', backgroundColor:'rgba(5,5,18,0.72)', zIndex:30 },
  dimOverlay: { backgroundColor:'rgba(5,5,18,0.93)', alignItems:'center', justifyContent:'center', gap:14, zIndex:50 },
  countdownNum: { fontSize:96, fontFamily:'Inter_700Bold', color:'#FFFFFF', textShadowColor:'#5E5CE6', textShadowOffset:{width:0,height:0}, textShadowRadius:32 },
  countdownSub: { fontSize:14, fontFamily:'Inter_500Medium', color:'#5555AA', letterSpacing:4, marginTop:8 },
  overlayTitle: { fontSize:32, fontFamily:'Inter_700Bold', color:'#FFFFFF', letterSpacing:4, marginBottom:4 },
  deadTitle: { color:'#FF2D78' },
  deadSub: { fontSize:14, fontFamily:'Inter_400Regular', color:'rgba(255,255,255,0.45)', marginBottom:4 },
  totalLabel: { fontSize:12, fontFamily:'Inter_500Medium', color:'rgba(255,255,255,0.40)', letterSpacing:1, marginBottom:4 },

  // Mid-game scores (pause)
  midScores: { flexDirection:'row', alignItems:'center', gap:16, marginBottom:6 },
  midScore:  { fontSize:20, fontFamily:'Inter_700Bold' },
  midScoreSep: { fontSize:16, color:'rgba(255,255,255,0.30)', fontFamily:'Inter_700Bold' },

  // Final scores
  finalScoreRow: { flexDirection:'row', gap:32, marginVertical:8 },
  finalScoreBox: { alignItems:'center', gap:4 },
  finalScoreLabel: { fontSize:11, fontFamily:'Inter_500Medium', color:'rgba(255,255,255,0.45)', letterSpacing:2 },
  finalScoreNum:   { fontSize:48, fontFamily:'Inter_700Bold' },

  // Buttons
  primaryBtn: { flexDirection:'row', alignItems:'center', gap:10, backgroundColor:'#5E5CE6', borderRadius:16, paddingHorizontal:36, paddingVertical:14 },
  primaryBtnText: { fontSize:16, fontFamily:'Inter_700Bold', color:'#FFFFFF', letterSpacing:1 },
  secondaryBtn: { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:'rgba(255,255,255,0.08)', borderRadius:16, paddingHorizontal:36, paddingVertical:14, borderWidth:1, borderColor:'rgba(255,255,255,0.12)' },
  secondaryBtnText: { fontSize:15, fontFamily:'Inter_600SemiBold', color:'#FFFFFF', letterSpacing:0.5 },
});

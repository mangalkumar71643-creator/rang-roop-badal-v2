import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ShapeRenderer } from '@/components/ShapeRenderer';
import {
  CHARACTERS,
  GAME_COLOR_NAMES,
  GAME_COLORS,
  GAME_CONFIG,
  GAME_SHAPE_NAMES,
  GameColor,
  GameMode,
  GameShape,
} from '@/constants/gameConfig';
import { useAds } from '@/context/AdContext';
import { usePlayer } from '@/context/PlayerContext';

const { width: SW, height: SH } = Dimensions.get('window');
const GATE_H = 88;
const CHAR_SIZE = 72;
const GATE_SHAPE_SIZE = 52;

type GameStatus = 'countdown' | 'playing' | 'paused' | 'gameover';

interface GateData {
  id: string;
  color: GameColor;
  shape: GameShape;
}

interface Engine {
  status: GameStatus;
  gateY: number;
  collisionChecked: boolean;
  speed: number;
  lives: number;
  score: number;
  combo: number;
  maxCombo: number;
  gatesCleared: number;
  playerColor: GameColor;
  playerShape: GameShape;
  currentGate: GateData | null;
  nextGate: GateData | null;
  timeLeft: number;
}

const MINI_H = 80;
const MINI_W = 36;
const DOT = 8;

function MinimapPanel({
  gateY,
  gateColor,
  playerColor,
  characterY,
  screenH,
  top,
}: {
  gateY: number;
  gateColor: string | null;
  playerColor: string;
  characterY: number;
  screenH: number;
  top: number;
}) {
  const gateFrac = Math.max(0, Math.min(1, gateY / screenH));
  const playerFrac = Math.max(0, Math.min(1, characterY / screenH));
  const gateDotTop = Math.round(gateFrac * (MINI_H - DOT));
  const playerDotTop = Math.round(playerFrac * (MINI_H - DOT));
  const dotLeft = Math.round(MINI_W / 2 - DOT / 2);

  return (
    <View style={[mmStyles.container, { top, right: 14, pointerEvents: 'none' }]}>
      <Text style={mmStyles.label}>MAP</Text>
      <View style={mmStyles.track} />
      {gateColor && (
        <View
          style={[
            mmStyles.dot,
            {
              top: 18 + gateDotTop,
              left: dotLeft,
              backgroundColor: gateColor,
              borderColor: gateColor,
            },
          ]}
        />
      )}
      <View
        style={[
          mmStyles.dot,
          mmStyles.playerDot,
          {
            top: 18 + playerDotTop,
            left: dotLeft,
            backgroundColor: playerColor,
            borderColor: '#FFFFFF',
          },
        ]}
      />
    </View>
  );
}

const mmStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: MINI_W,
    height: MINI_H + 22,
    backgroundColor: 'rgba(10,10,30,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 8,
    zIndex: 20,
    overflow: 'hidden',
  },
  label: {
    fontSize: 7,
    fontFamily: 'Inter_700Bold',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1,
    textAlign: 'center',
    paddingTop: 4,
    paddingBottom: 2,
  },
  track: {
    position: 'absolute',
    top: 18,
    bottom: 4,
    left: MINI_W / 2 - 0.5,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  dot: {
    position: 'absolute',
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 1.5,
  },
  playerDot: {
    borderWidth: 2,
  },
});

function randomGate(): GateData {
  const color = GAME_COLOR_NAMES[Math.floor(Math.random() * GAME_COLOR_NAMES.length)];
  const shape = GAME_SHAPE_NAMES[Math.floor(Math.random() * GAME_SHAPE_NAMES.length)];
  return { id: `${Date.now()}${Math.random()}`, color, shape };
}

export default function GameScreen() {
  const params = useLocalSearchParams<{ mode: string; characterId: string }>();
  const mode = (params.mode ?? 'classic') as GameMode;
  const characterId = params.characterId ?? 'default';
  const character = CHARACTERS.find((c) => c.id === characterId) ?? CHARACTERS[0];

  const insets = useSafeAreaInsets();
  const { addCoins, addStars, updateHighScore, updateAchievementProgress, incrementGamesPlayed } = usePlayer();
  const { onGameCompleted } = useAds();

  const SHAPE_BAR_HEIGHT = mode === 'classic' ? 130 : 0;
  const CHARACTER_Y = SH - insets.bottom - 190 - SHAPE_BAR_HEIGHT;
  const COLLISION_Y = CHARACTER_Y - GATE_H / 2;

  // Classic mode starts ~49% slower so players have more reaction time, but
  // ramps up noticeably faster than the base curve — otherwise it stays
  // near its starting speed for ~70 gates and never feels like it's building.
  const CLASSIC_SPEED_FACTOR = mode === 'classic' ? 0.508 : 1;
  const CLASSIC_RAMP_BOOST = mode === 'classic' ? 2.5 : 1;
  const effectiveInitialSpeed = GAME_CONFIG.INITIAL_SPEED * CLASSIC_SPEED_FACTOR;
  const effectiveMaxSpeed = GAME_CONFIG.MAX_SPEED * CLASSIC_SPEED_FACTOR;
  const effectiveSpeedIncrement = GAME_CONFIG.SPEED_INCREMENT * CLASSIC_SPEED_FACTOR * CLASSIC_RAMP_BOOST;
  const effectiveDangerSpeed = GAME_CONFIG.DANGER_SPEED * CLASSIC_SPEED_FACTOR;

  const eng = useRef<Engine>({
    status: 'countdown',
    gateY: -GATE_H - 60,
    collisionChecked: false,
    speed: effectiveInitialSpeed,
    lives: GAME_CONFIG.INITIAL_LIVES,
    score: 0,
    combo: 0,
    maxCombo: 0,
    gatesCleared: 0,
    playerColor: character.defaultColor,
    playerShape: character.defaultShape,
    currentGate: null,
    nextGate: randomGate(),
    timeLeft: GAME_CONFIG.CHALLENGE_TIME,
  });

  const [tick, setTick] = useState(0);
  const [feedback, setFeedback] = useState<'none' | 'correct' | 'wrong' | 'star'>('none');
  const [countdown, setCountdown] = useState(3);
  const [isPaused, setIsPaused] = useState(false);

  const gameLoopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fbTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const charScale = useSharedValue(1);
  const charRotate = useSharedValue(0);
  const shapeTransformScale = useSharedValue(1);
  const charAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: charScale.value * shapeTransformScale.value },
      { rotate: `${charRotate.value}deg` },
    ],
  }));

  const forceRender = useCallback(() => setTick((t) => t + 1), []);

  const stopLoop = useCallback(() => {
    if (gameLoopRef.current) { clearInterval(gameLoopRef.current); gameLoopRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const endGame = useCallback(() => {
    const e = eng.current;
    e.status = 'gameover';
    stopLoop();
    incrementGamesPlayed();
    updateHighScore(mode, e.score);
    const coinsEarned = Math.floor(e.score / 10) + e.gatesCleared;
    const starsEarned = e.maxCombo >= 5 ? Math.floor(e.maxCombo / 5) : 0;
    addCoins(coinsEarned);
    if (starsEarned > 0) addStars(starsEarned);
    updateAchievementProgress('first_score', e.score);
    updateAchievementProgress('score_500', e.score);
    updateAchievementProgress('score_1000', e.score);
    updateAchievementProgress('combo_5', e.maxCombo);
    updateAchievementProgress('combo_10', e.maxCombo);
    updateAchievementProgress('gates_20', e.gatesCleared);
    updateAchievementProgress('gates_50', e.gatesCleared);

    onGameCompleted();

    setTimeout(() => {
      router.replace({
        pathname: '/game-over',
        params: {
          score: String(e.score),
          mode,
          gates: String(e.gatesCleared),
          combo: String(e.maxCombo),
          coins: String(coinsEarned),
          stars: String(starsEarned),
        },
      });
    }, 400);
  }, [mode, stopLoop, incrementGamesPlayed, updateHighScore, addCoins, addStars, updateAchievementProgress, onGameCompleted]);

  const handleCollision = useCallback(() => {
    const e = eng.current;
    if (!e.currentGate) return;
    const match = e.playerColor === e.currentGate.color && e.playerShape === e.currentGate.shape;

    if (match) {
      const mult = Math.min(1 + e.combo * GAME_CONFIG.COMBO_MULTIPLIER_INCREMENT, GAME_CONFIG.MAX_COMBO_MULTIPLIER);
      const pts = Math.floor(GAME_CONFIG.BASE_SCORE * mult * (e.speed >= GAME_CONFIG.DANGER_SPEED ? 1.5 : 1));
      e.score += pts;
      e.combo++;
      e.maxCombo = Math.max(e.maxCombo, e.combo);
      e.gatesCleared++;
      e.speed = Math.min(effectiveMaxSpeed, effectiveInitialSpeed + e.gatesCleared * effectiveSpeedIncrement);

      const isStar = Math.random() < GAME_CONFIG.STAR_SHOWER_CHANCE;
      if (isStar) { e.score += GAME_CONFIG.STAR_SHOWER_BONUS; addStars(1); }

      charScale.value = withSequence(withSpring(1.35, { damping: 5 }), withSpring(1, { damping: 8 }));
      if (fbTimerRef.current) clearTimeout(fbTimerRef.current);
      setFeedback(isStar ? 'star' : 'correct');
      fbTimerRef.current = setTimeout(() => setFeedback('none'), 500);
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      e.lives--;
      e.combo = 0;
      charRotate.value = withSequence(
        withTiming(-18, { duration: 70 }), withTiming(18, { duration: 70 }),
        withTiming(-10, { duration: 55 }), withTiming(10, { duration: 55 }),
        withTiming(0, { duration: 55 })
      );
      if (fbTimerRef.current) clearTimeout(fbTimerRef.current);
      setFeedback('wrong');
      fbTimerRef.current = setTimeout(() => setFeedback('none'), 500);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (e.lives <= 0) { endGame(); return; }
    }
    forceRender();
  }, [charScale, charRotate, addStars, endGame, forceRender]);

  const spawnGate = useCallback(() => {
    const e = eng.current;
    e.currentGate = e.nextGate ?? randomGate();
    e.nextGate = randomGate();
    e.gateY = -GATE_H - 60;
    e.collisionChecked = false;
  }, []);

  const gameTick = useCallback(() => {
    const e = eng.current;
    if (e.status !== 'playing') return;
    e.gateY += e.speed;
    if (e.gateY >= COLLISION_Y && !e.collisionChecked) {
      e.collisionChecked = true;
      handleCollision();
    }
    if (e.gateY > SH + 60) spawnGate();
    forceRender();
  }, [COLLISION_Y, handleCollision, spawnGate, forceRender]);

  useEffect(() => {
    let count = 3;
    setCountdown(count);
    countdownRef.current = setInterval(() => {
      count--;
      setCountdown(count);
      if (count <= 0) {
        clearInterval(countdownRef.current!);
        eng.current.status = 'playing';
        spawnGate();
        gameLoopRef.current = setInterval(gameTick, 16);
        if (mode === 'challenge') {
          timerRef.current = setInterval(() => {
            eng.current.timeLeft--;
            forceRender();
            if (eng.current.timeLeft <= 0) endGame();
          }, 1000);
        }
      }
    }, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      stopLoop();
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      if (fbTimerRef.current) clearTimeout(fbTimerRef.current);
    };
  }, []);

  const handleScreenPress = useCallback(() => {
    const e = eng.current;
    if (e.status !== 'playing') return;

    if (mode === 'classic') {
      // Classic mode: tap only changes color; shape is controlled by shape bar
      const idx = GAME_COLOR_NAMES.indexOf(e.playerColor);
      e.playerColor = GAME_COLOR_NAMES[(idx + 1) % GAME_COLOR_NAMES.length];
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      forceRender();
    } else {
      // Other modes: single tap = color, double tap = shape
      tapCountRef.current++;
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      tapTimerRef.current = setTimeout(() => {
        const count = tapCountRef.current;
        tapCountRef.current = 0;
        if (count === 1) {
          const idx = GAME_COLOR_NAMES.indexOf(e.playerColor);
          e.playerColor = GAME_COLOR_NAMES[(idx + 1) % GAME_COLOR_NAMES.length];
          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } else {
          const idx = GAME_SHAPE_NAMES.indexOf(e.playerShape);
          e.playerShape = GAME_SHAPE_NAMES[(idx + 1) % GAME_SHAPE_NAMES.length];
          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        forceRender();
      }, 260);
    }
  }, [mode, forceRender]);

  const handleShapeSelect = useCallback((shape: GameShape) => {
    const e = eng.current;
    if (e.status !== 'playing') return;
    if (e.playerShape === shape) return;
    e.playerShape = shape;
    shapeTransformScale.value = withSequence(
      withTiming(0.72, { duration: 80 }),
      withTiming(1.15, { duration: 80 }),
      withTiming(1.0, { duration: 60 }),
    );
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    forceRender();
  }, [shapeTransformScale, forceRender]);

  const handlePause = useCallback(() => {
    const e = eng.current;
    if (e.status === 'playing') {
      e.status = 'paused';
      stopLoop();
      setIsPaused(true);
    } else if (e.status === 'paused') {
      e.status = 'playing';
      setIsPaused(false);
      gameLoopRef.current = setInterval(gameTick, 16);
      if (mode === 'challenge' && e.timeLeft > 0) {
        timerRef.current = setInterval(() => {
          eng.current.timeLeft--;
          forceRender();
          if (eng.current.timeLeft <= 0) endGame();
        }, 1000);
      }
    }
  }, [gameTick, stopLoop, forceRender, endGame, mode]);

  const handleHome = () => {
    stopLoop();
    router.replace('/menu');
  };

  const e = eng.current;
  const gateColor = e.currentGate ? GAME_COLORS[e.currentGate.color] : '#FFFFFF';
  const isDanger = e.speed >= effectiveDangerSpeed;
  const bgColors: [string, string, string] = isDanger
    ? ['#1A0010', '#2A0020', '#1A0010']
    : ['#070714', '#0D0D28', '#070714'];
  const playerColorHex = GAME_COLORS[e.playerColor];

  return (
    <View style={styles.root}>
      <LinearGradient colors={bgColors} style={StyleSheet.absoluteFill} />

      {/* Feedback overlay */}
      {feedback === 'correct' && <View style={[StyleSheet.absoluteFill, styles.fbCorrect]} pointerEvents="none" />}
      {feedback === 'wrong' && <View style={[StyleSheet.absoluteFill, styles.fbWrong]} pointerEvents="none" />}
      {feedback === 'star' && <View style={[StyleSheet.absoluteFill, styles.fbStar]} pointerEvents="none" />}

      {/* Danger pulse */}
      {isDanger && <View style={[StyleSheet.absoluteFill, styles.dangerBorder]} pointerEvents="none" />}

      {/* HUD */}
      <View style={[styles.hud, { paddingTop: insets.top + 6 }]}>
        <View style={styles.lives}>
          {Array.from({ length: GAME_CONFIG.INITIAL_LIVES }).map((_, i) => (
            <Ionicons
              key={i}
              name={i < e.lives ? 'heart' : 'heart-outline'}
              size={22}
              color={i < e.lives ? '#FF2D78' : '#444466'}
            />
          ))}
        </View>
        <View style={styles.scoreBlock}>
          <Text style={styles.scoreNum}>{e.score}</Text>
          {e.combo > 1 && (
            <Text style={[styles.comboText, isDanger && styles.comboTextDanger]}>
              ×{e.combo}
            </Text>
          )}
        </View>
        {mode === 'challenge' && (
          <Text style={[styles.timer, e.timeLeft <= 10 && styles.timerUrgent]}>{e.timeLeft}s</Text>
        )}
        {isDanger && <Text style={styles.dangerTag}>DANGER</Text>}
      </View>

      {/* Pause button */}
      {e.status === 'playing' && (
        <TouchableOpacity
          style={[styles.pauseBtn, { top: insets.top + 10 }]}
          onPress={handlePause}
          hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
        >
          <Ionicons name="pause" size={18} color="rgba(255,255,255,0.5)" />
        </TouchableOpacity>
      )}

      {/* Next gate preview — shows currentGate so it always matches the approaching obstacle */}
      {e.currentGate && e.status === 'playing' && (
        <View style={[styles.nextPreview, { top: insets.top + 52 }]}>
          <Text style={styles.nextLabel}>NEXT</Text>
          <ShapeRenderer
            shape={e.currentGate.shape}
            color={GAME_COLORS[e.currentGate.color]}
            size={20}
          />
        </View>
      )}

      {/* Tap area */}
      <Pressable style={StyleSheet.absoluteFill} onPress={handleScreenPress} />

      {/* Gate */}
      {e.currentGate && (
        <View
          style={[
            styles.gate,
            {
              top: e.gateY,
              backgroundColor: gateColor + '28',
              borderColor: gateColor,
            },
          ]}
          pointerEvents="none"
        >
          <View style={[styles.gateWall, { backgroundColor: gateColor + '55' }]} />
          <View style={styles.gateCenter}>
            <ShapeRenderer
              shape={e.currentGate.shape}
              color={gateColor}
              size={GATE_SHAPE_SIZE}
              strokeColor="rgba(255,255,255,0.3)"
              strokeWidth={2}
            />
            <Text style={[styles.gateColorName, { color: gateColor }]}>{e.currentGate.color}</Text>
            <Text style={styles.gateShapeName}>{e.currentGate.shape}</Text>
          </View>
          <View style={[styles.gateWall, { backgroundColor: gateColor + '55' }]} />
        </View>
      )}

      {/* Character */}
      <Animated.View
        style={[styles.character, { top: CHARACTER_Y - CHAR_SIZE / 2 }, charAnimStyle]}
        pointerEvents="none"
      >
        <View style={[styles.charGlow, { shadowColor: playerColorHex }]}>
          <ShapeRenderer
            shape={e.playerShape}
            color={playerColorHex}
            size={CHAR_SIZE}
          />
        </View>
      </Animated.View>

      {/* Classic mode: shape selection bar */}
      {mode === 'classic' ? (
        <View
          style={[styles.shapeBar, { bottom: insets.bottom + 6 }]}
          pointerEvents="box-none"
        >
          <View style={styles.shapeButtonRow} pointerEvents="box-none">
            {GAME_SHAPE_NAMES.map((shape) => {
              const isSelected = e.playerShape === shape;
              return (
                <TouchableOpacity
                  key={shape}
                  style={[
                    styles.shapeBtn,
                    isSelected && {
                      borderColor: playerColorHex,
                      backgroundColor: playerColorHex + '22',
                      shadowColor: playerColorHex,
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.9,
                      shadowRadius: 12,
                      elevation: 10,
                    },
                  ]}
                  onPress={() => handleShapeSelect(shape)}
                  activeOpacity={0.75}
                >
                  <ShapeRenderer
                    shape={shape}
                    color={isSelected ? playerColorHex : 'rgba(180,180,200,0.55)'}
                    size={34}
                  />
                  <Text
                    style={[
                      styles.shapeBtnLabel,
                      isSelected && { color: playerColorHex },
                    ]}
                  >
                    {shape.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.shapeBarHint}>
            TAP SCREEN = Color Badlo{'  '}|{'  '}Shape Button = Shape Badlo
          </Text>
        </View>
      ) : (
        /* Non-classic modes: original controls bar */
        <View
          style={[styles.controls, { bottom: insets.bottom + 8 }]}
          pointerEvents="none"
        >
          <View style={styles.controlItem}>
            <View style={[styles.colorSwatch, { backgroundColor: playerColorHex }]} />
            <Text style={styles.controlName}>{e.playerColor}</Text>
            <Text style={styles.controlHint}>TAP</Text>
          </View>
          <View style={styles.controlDivider} />
          <View style={styles.controlItem}>
            <ShapeRenderer shape={e.playerShape} color="#FFFFFF" size={22} />
            <Text style={styles.controlName}>{e.playerShape}</Text>
            <Text style={styles.controlHint}>DOUBLE TAP</Text>
          </View>
        </View>
      )}

      {/* Minimap — rendered last so it's always on top */}
      {(e.status === 'playing' || e.status === 'countdown') && (
        <MinimapPanel
          gateY={e.gateY}
          gateColor={e.currentGate ? GAME_COLORS[e.currentGate.color] : null}
          playerColor={playerColorHex}
          characterY={CHARACTER_Y}
          screenH={SH}
          top={insets.top + 90}
        />
      )}

      {/* Countdown overlay */}
      {countdown > 0 && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={styles.countdownOverlay}>
            <Text style={styles.countdownNum}>{countdown}</Text>
            <Text style={styles.countdownSub}>GET READY</Text>
          </View>
        </View>
      )}

      {/* Pause overlay */}
      {isPaused && (
        <View style={[StyleSheet.absoluteFill, styles.pauseOverlay]}>
          <Text style={styles.pauseTitle}>PAUSED</Text>
          <TouchableOpacity style={styles.resumeBtn} onPress={handlePause}>
            <Ionicons name="play" size={20} color="#070714" />
            <Text style={styles.resumeBtnText}>RESUME</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.homeBtn} onPress={handleHome}>
            <Ionicons name="home-outline" size={20} color="#FFFFFF" />
            <Text style={styles.homeBtnText}>MAIN MENU</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#070714' },
  hud: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
    zIndex: 10,
  },
  lives: { flexDirection: 'row', gap: 4, flex: 1 },
  scoreBlock: { alignItems: 'center' },
  scoreNum: { fontSize: 28, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
  comboText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#FFD700' },
  comboTextDanger: { color: '#FF2D78' },
  timer: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#00D4FF', flex: 1, textAlign: 'right' },
  timerUrgent: { color: '#FF2D78' },
  dangerTag: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: '#FF2D78',
    letterSpacing: 2,
    marginLeft: 8,
  },
  pauseBtn: {
    position: 'absolute',
    right: 16,
    zIndex: 20,
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextPreview: {
    position: 'absolute',
    right: 16,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  nextLabel: { fontSize: 9, fontFamily: 'Inter_600SemiBold', color: '#5555AA', letterSpacing: 1 },
  gate: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: GATE_H,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 2,
    borderBottomWidth: 2,
    overflow: 'hidden',
  },
  gateWall: { width: 40, alignSelf: 'stretch' },
  gateCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  gateColorName: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
  },
  gateShapeName: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: 'rgba(255,255,255,0.6)',
  },
  character: {
    position: 'absolute',
    left: SW / 2 - CHAR_SIZE / 2,
    zIndex: 5,
  },
  charGlow: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 10,
  },
  // Classic mode shape bar
  shapeBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  shapeButtonRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  shapeBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 6,
    minWidth: 0,
  },
  shapeBtnLabel: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    color: 'rgba(180,180,200,0.55)',
    letterSpacing: 0.5,
  },
  shapeBarHint: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(120,120,160,0.7)',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  // Non-classic controls bar
  controls: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  controlItem: { alignItems: 'center', gap: 4 },
  colorSwatch: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  controlName: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#FFFFFF' },
  controlHint: { fontSize: 9, fontFamily: 'Inter_400Regular', color: '#5555AA', letterSpacing: 1 },
  controlDivider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.1)' },
  fbCorrect: { backgroundColor: 'rgba(0,232,122,0.12)' },
  fbWrong: { backgroundColor: 'rgba(255,68,68,0.15)' },
  fbStar: { backgroundColor: 'rgba(255,215,0,0.15)' },
  dangerBorder: {
    borderWidth: 3,
    borderColor: '#FF2D78',
    borderRadius: 0,
    opacity: 0.4,
  },
  countdownOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(7,7,20,0.7)',
  },
  countdownNum: {
    fontSize: 96,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    textShadowColor: '#FFD700',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 30,
  },
  countdownSub: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    color: '#5555AA',
    letterSpacing: 4,
    marginTop: 8,
  },
  pauseOverlay: {
    backgroundColor: 'rgba(7,7,20,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    zIndex: 50,
  },
  pauseTitle: { fontSize: 36, fontFamily: 'Inter_700Bold', color: '#FFFFFF', letterSpacing: 6, marginBottom: 8 },
  resumeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFD700',
    borderRadius: 16,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  resumeBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#070714', letterSpacing: 1 },
  homeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  homeBtnText: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', letterSpacing: 1 },
});

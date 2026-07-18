// Shape Merge level progression.
// Level 1 is a short, easy intro. Level 2 onward ramps by +1 minute and
// +1000 points per level; past level 10 the point step doubles to +2000
// per level (while the time step stays +1 minute) to keep pace tough.
export interface ShapeMergeLevelConfig {
  level: number;
  minutes: number;
  seconds: number;
  target: number;
}

const LEVEL_1: ShapeMergeLevelConfig = { level: 1, minutes: 2, seconds: 120, target: 4000 };
const LEVEL_2_MINUTES = 5;
const LEVEL_2_TARGET = 10000;

export function getShapeMergeLevel(level: number): ShapeMergeLevelConfig {
  const n = Math.max(1, Math.floor(level));
  if (n === 1) return LEVEL_1;

  if (n <= 10) {
    const steps = n - 2;
    const minutes = LEVEL_2_MINUTES + steps;
    return { level: n, minutes, seconds: minutes * 60, target: LEVEL_2_TARGET + steps * 1000 };
  }

  const stepsTo10 = 10 - 2;
  const minutesAt10 = LEVEL_2_MINUTES + stepsTo10;
  const targetAt10 = LEVEL_2_TARGET + stepsTo10 * 1000;
  const extra = n - 10;
  const minutes = minutesAt10 + extra;
  return { level: n, minutes, seconds: minutes * 60, target: targetAt10 + extra * 2000 };
}

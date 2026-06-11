export type GameColor =
  | 'Red' | 'Blue' | 'Green' | 'Yellow' | 'Orange'
  | 'Purple' | 'Pink' | 'White' | 'Black' | 'Violet';

export type GameShape = 'Circle' | 'Square' | 'Triangle' | 'Star' | 'Hexagon';

export type GameMode = 'classic' | 'endless' | 'challenge';

export const GAME_COLORS: Record<GameColor, string> = {
  Red: '#FF3B30',
  Blue: '#007AFF',
  Green: '#30D158',
  Yellow: '#FFD60A',
  Orange: '#FF9500',
  Purple: '#BF5AF2',
  Pink: '#FF375F',
  White: '#EBEBF5',
  Black: '#48484A',
  Violet: '#5E5CE6',
};

export const GAME_COLOR_NAMES: GameColor[] = [
  'Red', 'Blue', 'Green', 'Yellow', 'Orange',
  'Purple', 'Pink', 'White', 'Black', 'Violet',
];

export const GAME_SHAPE_NAMES: GameShape[] = [
  'Circle', 'Square', 'Triangle', 'Star', 'Hexagon',
];

export interface Character {
  id: string;
  name: string;
  unlockCost: number;
  unlockCurrency: 'coins' | 'stars' | 'free';
  defaultColor: GameColor;
  defaultShape: GameShape;
  description: string;
}

export const CHARACTERS: Character[] = [
  { id: 'default', name: 'Rango', unlockCost: 0, unlockCurrency: 'free', defaultColor: 'Green', defaultShape: 'Circle', description: 'The original shape-shifter!' },
  { id: 'blaze', name: 'Blaze', unlockCost: 500, unlockCurrency: 'coins', defaultColor: 'Red', defaultShape: 'Star', description: 'Hot and fiery!' },
  { id: 'azure', name: 'Azure', unlockCost: 500, unlockCurrency: 'coins', defaultColor: 'Blue', defaultShape: 'Hexagon', description: 'Cool as the deep ocean!' },
  { id: 'sunny', name: 'Sunny', unlockCost: 750, unlockCurrency: 'coins', defaultColor: 'Yellow', defaultShape: 'Square', description: 'Bright and cheerful!' },
  { id: 'vixy', name: 'Vixy', unlockCost: 750, unlockCurrency: 'coins', defaultColor: 'Violet', defaultShape: 'Triangle', description: 'Mysterious and elegant!' },
  { id: 'pinky', name: 'Pinky', unlockCost: 30, unlockCurrency: 'stars', defaultColor: 'Pink', defaultShape: 'Circle', description: 'Sweet and lovable!' },
  { id: 'shadow', name: 'Shadow', unlockCost: 50, unlockCurrency: 'stars', defaultColor: 'Black', defaultShape: 'Square', description: 'Dark and powerful!' },
  { id: 'frost', name: 'Frost', unlockCost: 1000, unlockCurrency: 'coins', defaultColor: 'White', defaultShape: 'Hexagon', description: 'Pure and pristine!' },
  { id: 'grove', name: 'Grove', unlockCost: 1500, unlockCurrency: 'coins', defaultColor: 'Orange', defaultShape: 'Star', description: 'Wild and energetic!' },
  { id: 'royale', name: 'Royale', unlockCost: 100, unlockCurrency: 'stars', defaultColor: 'Purple', defaultShape: 'Star', description: 'The ultimate champion!' },
];

export interface Achievement {
  id: string;
  name: string;
  description: string;
  target: number;
  rewardCoins: number;
  rewardStars: number;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_score', name: 'First Blood', description: 'Score 100 points in one run', target: 100, rewardCoins: 50, rewardStars: 0 },
  { id: 'combo_5', name: 'Combo Starter', description: 'Reach a 5x combo', target: 5, rewardCoins: 100, rewardStars: 0 },
  { id: 'combo_10', name: 'Combo King', description: 'Reach a 10x combo', target: 10, rewardCoins: 200, rewardStars: 5 },
  { id: 'score_500', name: 'High Scorer', description: 'Score 500 points in one run', target: 500, rewardCoins: 150, rewardStars: 5 },
  { id: 'score_1000', name: 'Master', description: 'Score 1000 points in one run', target: 1000, rewardCoins: 300, rewardStars: 10 },
  { id: 'gates_20', name: 'Speed Run', description: 'Pass 20 gates in one run', target: 20, rewardCoins: 100, rewardStars: 0 },
  { id: 'gates_50', name: 'Gate Crusher', description: 'Pass 50 gates in one run', target: 50, rewardCoins: 200, rewardStars: 5 },
  { id: 'streak_3', name: 'Devoted', description: 'Log in 3 days in a row', target: 3, rewardCoins: 100, rewardStars: 5 },
  { id: 'streak_7', name: 'Daily Devotee', description: 'Log in 7 days in a row', target: 7, rewardCoins: 300, rewardStars: 15 },
  { id: 'stars_50', name: 'Star Collector', description: 'Collect 50 stars total', target: 50, rewardCoins: 200, rewardStars: 0 },
];

export const DAILY_REWARDS = [
  { day: 1, coins: 50, stars: 0 },
  { day: 2, coins: 75, stars: 0 },
  { day: 3, coins: 100, stars: 2 },
  { day: 4, coins: 125, stars: 0 },
  { day: 5, coins: 150, stars: 3 },
  { day: 6, coins: 200, stars: 0 },
  { day: 7, coins: 300, stars: 5 },
];

export const GAME_CONFIG = {
  INITIAL_LIVES: 3,
  INITIAL_SPEED: 2.5,
  MAX_SPEED: 8.0,
  SPEED_INCREMENT: 0.08,
  COMBO_MULTIPLIER_INCREMENT: 0.5,
  MAX_COMBO_MULTIPLIER: 5,
  BASE_SCORE: 10,
  STAR_SHOWER_CHANCE: 0.05,
  STAR_SHOWER_BONUS: 50,
  DANGER_SPEED: 6.0,
  CHALLENGE_TIME: 60,
};

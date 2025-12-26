
export enum GameMode {
  TIME = 'TIME',
  SURVIVAL = 'SURVIVAL',
  DODGE = 'DODGE',
  TEST_HANDS = 'TEST_HANDS',
}

export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
}

export enum ItemType {
  FRUIT = 'FRUIT',
  BOMB = 'BOMB',
  ICE = 'ICE',
  BASKET = 'BASKET',
  POISON = 'POISON',
}

export interface Entity {
  id: number;
  type: ItemType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  scale: number;
  emoji: string;
  color: string;
  isSliced: boolean;
  scoreValue: number;
  isPoisoned?: boolean;
  isHalf?: 'left' | 'right';
  slicedAt?: number;
}

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  size: number;
}

export interface HandPoint {
  x: number;
  y: number;
}

export interface GameConfig {
  mode: GameMode;
  duration?: number;
}

export interface LeaderboardEntry {
  id: string;
  name?: string;
  score: number | string;
  mode: GameMode;
  photo: string;
  date: number;
}

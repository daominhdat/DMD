export const GRAVITY = 0.28; 
export const FRUIT_SPAWN_RATE_INITIAL = 60; 
export const BLADE_LENGTH = 12; 
export const BLADE_WIDTH = 10;

// Colors for the two specific hands
export const HAND_COLORS = ['#00ffff', '#ff00ff']; 

export const FRUIT_TYPES = [
  { emoji: '🍉', color: '#ff5555', score: 1 },
  { emoji: '🍌', color: '#ffff55', score: 1 },
  { emoji: '🍊', color: '#ffaa00', score: 1 },
  { emoji: '🍓', color: '#ff0055', score: 2 },
  { emoji: '🍋', color: '#ffff00', score: 1 },
  { emoji: '🥥', color: '#ffffff', score: 3 }, 
];

export const SPECIAL_ITEMS = {
  BOMB: { emoji: '💣', color: '#000000', score: -5 },
  ICE: { emoji: '❄️', color: '#00ffff', score: 0 },
  BASKET: { emoji: '🧺', color: '#d2b48c', score: 0 },
  POISON: { emoji: '🧪', color: '#00ff00', score: -2 },
};
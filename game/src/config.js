// Lumen: tuning, palette and field. One place for every number the game balances on,
// so a tweak here is a tweak everywhere.
export const FIELD = { width: 960, height: 540 };
export const STEP = 1 / 60;
export const BEST_KEY = 'lumen-best-v1';
export const LIVES = 3;

// The firefly itself.
export const PLAYER = {
  radius: 10,
  accel: 1500,
  maxSpeed: 320,
  dashSpeed: 660,
  dashTime: 0.22,
  dashCost: 8,
  dashCooldown: 0.9,
  invulnAfterHit: 1.0,
  invulnAfterDeath: 2.0,
  magnetRadius: 78,
};

// Light is life and score fuel: it drains, motes refill it, hits burn it.
export const LIGHT = {
  start: 70,
  max: 100,
  drain: 1.1,
  mote: 9,
  hit: 22,
  deathRefill: 55,
};

// Combo: a mote within the window raises the multiplier, up to x8.
export const COMBO = { window: 2.5, max: 8, moteScore: 10 };

// Waves: every WAVE_DURATION seconds the dark gets faster and thicker.
export const WAVE = { duration: 22, bannerTime: 2.0 };

// Spawning, in seconds (enemy interval shrinks with the wave).
export const SPAWN = {
  moteInterval: 0.85,
  moteCluster: 4,
  enemyBase: 1.5,
  enemyPerWave: 0.09,
  enemyMin: 0.55,
  powerInterval: 38,
  moteTtl: 7,
  powerTtl: 10,
};

// The palette: deep indigo night, warm gold light, cold dark enemies.
export const COLORS = {
  bgTop: '#0b1026',
  bgBottom: '#182052',
  star: '#cdd7ff',
  gold: '#ffd166',
  goldSoft: '#ffe9a8',
  goldDeep: '#f4a259',
  cyan: '#7fe7dc',
  wisp: '#2a2140',
  wispRim: '#7b5cff',
  darter: '#3a1f3d',
  darterRim: '#ff5c8a',
  eater: '#1d3327',
  eaterRim: '#5cff8a',
  danger: '#ff5c5c',
  ink: '#0b1026',
  panel: 'rgba(11, 16, 38, 0.82)',
  panelEdge: 'rgba(255, 209, 102, 0.55)',
  text: '#f6f1de',
  textDim: '#aab3d6',
};

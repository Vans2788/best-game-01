// Neon Salvage — tuning, palette and upgrade catalogue.
// One job: every number the game balances on lives here, so tuning
// never means hunting through the simulation code.

export const WORLD = { w: 960, h: 600 };

export const PALETTE = {
  bg: '#070b16',
  grid: '#111a30',
  arenaEdge: '#1e2c52',
  player: '#22d3ee',
  playerCore: '#e0f7ff',
  bullet: '#7ef0ff',
  orb: '#c084fc',
  shard: '#fbbf24',
  repair: '#34d399',
  text: '#e6edf7',
  dim: '#8b9bbf',
  danger: '#fb7185',
  card: '#0f1830',
  cardEdge: '#2b3f6e',
};

export const PLAYER = {
  radius: 14,
  speed: 250,
  hp: 100,
  fireInterval: 0.16,
  bulletSpeed: 560,
  bulletDamage: 22,
  bulletRadius: 4,
  dashSpeed: 720,
  dashTime: 0.13,
  dashCooldown: 2.4,
  invulnTime: 0.9,
  pickupRadius: 90,
};

export const ENEMIES = {
  drifter:  { radius: 11, hp: 30,  speed: 120, damage: 8,  score: 50,  cost: 1, color: '#f472b6' },
  splitter: { radius: 16, hp: 55,  speed: 85,  damage: 10, score: 80,  cost: 2, color: '#a3e635' },
  spitter:  { radius: 13, hp: 40,  speed: 70,  damage: 10, score: 120, cost: 3, color: '#c084fc' },
  bulwark:  { radius: 23, hp: 170, speed: 48,  damage: 16, score: 200, cost: 4, color: '#fb923c' },
};

export const WAVES = {
  // Spawn budget per wave in cost points; the mix widens as waves climb.
  budget: (n) => 6 + n * 4,
  maxAlive: (n) => Math.min(6 + n, 16),
  spawnGap: (n) => Math.max(0.45, 1.05 - n * 0.06),
  // Enemy kind unlocked by wave number.
  unlockAt: { drifter: 1, splitter: 2, spitter: 3, bulwark: 4 },
};

export const UPGRADES = [
  { id: 'rapid',   name: 'Rapid Cycler',   desc: '+22% fire rate',          apply: (p) => { p.fireInterval *= 0.78; } },
  { id: 'heavy',   name: 'Heavy Rounds',   desc: '+35% bullet damage',      apply: (p) => { p.bulletDamage *= 1.35; } },
  { id: 'twin',    name: 'Twin Barrels',   desc: '+1 projectile per shot',  apply: (p) => { p.shots += 1; } },
  { id: 'pierce',  name: 'Piercing Rounds',desc: 'Bullets pierce +1 enemy', apply: (p) => { p.pierce += 1; } },
  { id: 'swift',   name: 'Swift Thrusters',desc: '+15% move speed',         apply: (p) => { p.speed *= 1.15; } },
  { id: 'plating', name: 'Ablative Plating',desc: '+25 max HP, heal 25',    apply: (p) => { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 25); } },
  { id: 'magnet',  name: 'Salvage Magnet', desc: '+80% pickup radius',      apply: (p) => { p.pickupRadius *= 1.8; } },
  { id: 'dash',    name: 'Dash Capacitor', desc: '-35% dash cooldown',      apply: (p) => { p.dashCooldown *= 0.65; } },
];

export const COMBO_WINDOW = 2.5; // seconds between kills to keep the chain alive
export const COMBO_MAX = 5;

// Neon Salvage — the game itself: state machine, waves, collisions,
// scoring, combos and upgrades. Drawing lives in render.js; motion
// lives in entities.js. This file decides what happens when things meet.

import { WORLD, ENEMIES, WAVES, UPGRADES, COMBO_WINDOW, COMBO_MAX } from './config.js';
import { makePlayer, spawnEnemy, burst, addFloat, updatePlayer, updateEnemies, updateBullets, updateParticles, updatePickups, updateFloats } from './entities.js';
import { pickDistinct, range, clamp, dist2 } from './random.js';
import { sfx } from './audio.js';

export const BEST_KEY = 'neon-salvage-best';

export function loadBest() {
  try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch (_) { return 0; }
}

export function saveBest(v) {
  try { localStorage.setItem(BEST_KEY, String(v)); } catch (_) {}
}

// Card layout in screen pixels; render.js draws them, this file clicks them.
export function upgradeCardRects(viewW, viewH) {
  const cw = 250, ch = 290, gap = 26;
  const total = cw * 3 + gap * 2;
  const y = Math.round((viewH - ch) / 2) + 10;
  return [0, 1, 2].map((i) => ({
    x: Math.round((viewW - total) / 2 + i * (cw + gap)),
    y, w: cw, h: ch,
  }));
}

export function createWorld(rng) {
  return {
    rng,
    w: WORLD.w, h: WORLD.h,
    view: { x: 0, y: 0, scale: 1, w: 960, h: 600 },
    mode: 'title', // title | playing | upgrade | paused | over
    time: 0,
    player: makePlayer(WORLD.w / 2, WORLD.h / 2),
    bullets: [], enemies: [], particles: [], pickups: [], floats: [],
    score: 0, best: loadBest(), wave: 0, kills: 0,
    combo: 0, comboLeft: 0,
    spawnQueue: [], spawnTimer: 0,
    banner: '', bannerLeft: 0,
    upgradeChoices: [],
    shake: 0,
    overStats: null,
  };
}

export function startGame(state) {
  state.player = makePlayer(state.w / 2, state.h / 2);
  state.bullets = [];
  state.enemies = [];
  state.particles = [];
  state.pickups = [];
  state.floats = [];
  state.score = 0;
  state.wave = 0;
  state.kills = 0;
  state.combo = 0;
  state.comboLeft = 0;
  state.shake = 0;
  state.overStats = null;
  state.mode = 'playing';
  startWave(state);
  sfx.wave();
}

function startWave(state) {
  state.wave += 1;
  const n = state.wave;
  const budget = WAVES.budget(n);
  const kinds = Object.keys(ENEMIES).filter((k) => WAVES.unlockAt[k] <= n);
  const queue = [];
  let spent = 0;
  while (spent < budget) {
    const kind = kinds[Math.floor(state.rng() * kinds.length)];
    const cost = ENEMIES[kind].cost;
    if (spent + cost > budget + 2) break;
    queue.push(kind);
    spent += cost;
  }
  // Shuffle so the wave never arrives in kind order.
  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(state.rng() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
  state.spawnQueue = queue;
  state.spawnTimer = 0.8;
  state.banner = `WAVE ${n}`;
  state.bannerLeft = 2.0;
}

function edgeSpawn(state) {
  const m = 30;
  const side = Math.floor(state.rng() * 4);
  if (side === 0) return { x: range(state.rng, m, state.w - m), y: m };
  if (side === 1) return { x: range(state.rng, m, state.w - m), y: state.h - m };
  if (side === 2) return { x: m, y: range(state.rng, m, state.h - m) };
  return { x: state.w - m, y: range(state.rng, m, state.h - m) };
}

function killEnemy(state, e, awardScore) {
  const idx = state.enemies.indexOf(e);
  if (idx >= 0) state.enemies.splice(idx, 1);
  burst(state, e.x, e.y, e.color, e.kind === 'bulwark' ? 26 : 14, 200);
  state.shake = Math.min(state.shake + (e.kind === 'bulwark' ? 7 : 3), 10);
  sfx.explode();
  state.kills += 1;

  if (awardScore) {
    state.combo = Math.min(state.combo + 1, COMBO_MAX);
    state.comboLeft = COMBO_WINDOW;
    const mult = 1 + (state.combo - 1) * 0.5;
    const pts = Math.round(e.score * mult);
    state.score += pts;
    addFloat(state, e.x, e.y - 10, `+${pts}`, '#fde68a');
  }

  // Splitter births two drifters where it died.
  if (e.kind === 'splitter') {
    for (let i = 0; i < 2; i++) {
      const d = spawnEnemy('drifter', e.x + (i === 0 ? -14 : 14), e.y);
      d.telegraph = 0.25;
      state.enemies.push(d);
    }
  }

  // Drops: 1-3 salvage shards, sometimes a repair kit.
  const shards = 1 + Math.floor(state.rng() * 3);
  for (let i = 0; i < shards; i++) {
    state.pickups.push({
      kind: 'shard', x: e.x + range(state.rng, -16, 16), y: e.y + range(state.rng, -16, 16),
      life: 9, bob: state.rng() * 6, value: 10,
    });
  }
  if (state.rng() < 0.08 && state.player.hp < state.player.maxHp) {
    state.pickups.push({ kind: 'repair', x: e.x, y: e.y, life: 9, bob: 0, value: 18 });
  }
}

function hurtPlayer(state, dmg, x, y) {
  const p = state.player;
  if (!p.alive || p.invulnLeft > 0) return;
  p.hp -= dmg;
  p.invulnLeft = 0.9;
  state.shake = Math.min(state.shake + 6, 12);
  burst(state, p.x, p.y, '#fb7185', 10, 160);
  sfx.hurt();
  if (p.hp <= 0) {
    p.hp = 0;
    p.alive = false;
    burst(state, p.x, p.y, '#22d3ee', 40, 320);
    burst(state, p.x, p.y, '#f472b6', 24, 240);
    state.shake = 14;
    sfx.over();
    state.overStats = { score: state.score, wave: state.wave, kills: state.kills };
    if (state.score > state.best) {
      state.best = state.score;
      saveBest(state.best);
    }
    state.mode = 'over';
  }
}

function collide(state) {
  const p = state.player;

  // Friendly bullets against enemies.
  for (const b of state.bullets) {
    if (!b.friendly || b.dead) continue;
    for (const e of state.enemies) {
      if (e.telegraph > 0) continue;
      const rr = e.radius + b.radius;
      if (dist2(b.x, b.y, e.x, e.y) < rr * rr) {
        e.hp -= b.damage;
        e.flash = 0.09;
        burst(state, b.x, b.y, e.color, 4, 120);
        sfx.hit();
        if (e.hp <= 0) killEnemy(state, e, true);
        if (b.pierce > 0) { b.pierce -= 1; } else { b.dead = true; }
        break; // one enemy per bullet per frame
      }
    }
  }
  state.bullets = state.bullets.filter((b) => !b.dead);

  // Enemy orbs against the player.
  for (const b of state.bullets) {
    if (b.friendly || b.dead) continue;
    if (p.alive) {
      const rr = p.radius + b.radius;
      if (dist2(b.x, b.y, p.x, p.y) < rr * rr) {
        b.dead = true;
        hurtPlayer(state, b.damage, b.x, b.y);
      }
    }
  }
  state.bullets = state.bullets.filter((b) => !b.dead);

  // Contact with an enemy.
  if (p.alive) {
    for (const e of state.enemies) {
      if (e.telegraph > 0) continue;
      const rr = p.radius + e.radius;
      if (dist2(p.x, p.y, e.x, e.y) < rr * rr) {
        hurtPlayer(state, e.damage, e.x, e.y);
        // Shove the enemy back so one touch is not a chain of hits.
        const d = Math.hypot(p.x - e.x, p.y - e.y) || 1;
        e.x -= ((p.x - e.x) / d) * 26;
        e.y -= ((p.y - e.y) / d) * 26;
        break;
      }
    }
  }

  // Pickups.
  if (p.alive) {
    for (const pk of state.pickups) {
      const rr = p.radius + 12;
      if (dist2(pk.x, pk.y, p.x, p.y) < rr * rr) {
        pk.life = 0;
        if (pk.kind === 'shard') {
          state.score += pk.value;
          addFloat(state, pk.x, pk.y - 8, `+${pk.value}`, '#fbbf24');
          sfx.pickup();
        } else {
          p.hp = Math.min(p.maxHp, p.hp + pk.value);
          addFloat(state, pk.x, pk.y - 8, `+${pk.value} HP`, '#34d399');
          sfx.repair();
        }
      }
    }
    state.pickups = state.pickups.filter((pk) => pk.life > 0);
  }
}

function openUpgrades(state) {
  state.upgradeChoices = pickDistinct(state.rng, UPGRADES, 3);
  state.mode = 'upgrade';
  sfx.upgrade();
}

function applyUpgrade(state, idx) {
  const up = state.upgradeChoices[idx];
  if (!up) return;
  up.apply(state.player);
  addFloat(state, state.player.x, state.player.y - 24, up.name, '#7ef0ff');
  state.upgradeChoices = [];
  startWave(state);
  state.mode = 'playing';
}

export function update(state, input, dt) {
  state.time += dt;
  if (state.bannerLeft > 0) state.bannerLeft -= dt;
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 22);
  if (state.comboLeft > 0) {
    state.comboLeft -= dt;
    if (state.comboLeft <= 0) state.combo = 0;
  }
  updateParticles(state, dt);
  updateFloats(state, dt);

  if (input.wasPressed('m')) sfx.toggleMute();

  if (state.mode === 'title') {
    if (input.wasPressed('enter') || input.wasPressed(' ') || input.mouse.down) {
      sfx.unlock();
      startGame(state);
    }
    return;
  }

  if (state.mode === 'over') {
    if (input.wasPressed('r') || input.wasPressed('enter') || input.mouse.down) {
      startGame(state);
    }
    return;
  }

  if (state.mode === 'upgrade') {
    if (input.wasPressed('1')) return applyUpgrade(state, 0);
    if (input.wasPressed('2')) return applyUpgrade(state, 1);
    if (input.wasPressed('3')) return applyUpgrade(state, 2);
    if (input.mouse.down) {
      const rects = upgradeCardRects(state.view.w, state.view.h);
      const m = input.mouse;
      for (let i = 0; i < 3; i++) {
        const r = rects[i];
        if (m.x >= r.x && m.x <= r.x + r.w && m.y >= r.y && m.y <= r.y + r.h) {
          return applyUpgrade(state, i);
        }
      }
    }
    return;
  }

  if (state.mode === 'paused') {
    if (input.wasPressed('p') || input.wasPressed('escape') || input.wasPressed('enter')) {
      state.mode = 'playing';
    }
    return;
  }

  // Playing.
  if (input.wasPressed('p') || input.wasPressed('escape')) {
    state.mode = 'paused';
    return;
  }

  const ev = updatePlayer(state, input, dt, state);
  if (ev && ev.fired) sfx.shoot();
  if (ev && ev.dashed) sfx.dash();
  updateEnemies(state, dt);
  updateBullets(state, dt);
  updatePickups(state, dt);
  collide(state);
  if (state.mode !== 'playing') return; // hurtPlayer may have ended the game

  // Spawning.
  if (state.spawnQueue.length > 0) {
    state.spawnTimer -= dt;
    const alive = state.enemies.length;
    if (state.spawnTimer <= 0 && alive < WAVES.maxAlive(state.wave)) {
      state.spawnTimer = WAVES.spawnGap(state.wave);
      const kind = state.spawnQueue.shift();
      const at = edgeSpawn(state);
      const enemy = spawnEnemy(kind, at.x, at.y);
      // Later waves arrive faster: +3% speed per wave, capped at +30%.
      enemy.speed *= Math.min(1.3, 1 + 0.03 * (state.wave - 1));
      state.enemies.push(enemy);
    }
  } else if (state.enemies.length === 0) {
    // Wave cleared: bonus, then the upgrade choice.
    const bonus = 100 * state.wave;
    state.score += bonus;
    addFloat(state, state.player.x, state.player.y - 30, `WAVE CLEAR +${bonus}`, '#7ef0ff');
    openUpgrades(state);
  }
}

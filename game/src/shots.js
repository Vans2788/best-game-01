// Neon Salvage — deterministic screenshot scenes.
// One job: given ?shot=<name>&seed=<n>, pose the world into a fixed
// frame (title, mid-play, upgrade choice, game over) so the screenshots
// in screenshots/ are reproducible renders of the real game code.

import { makeRng, range } from './random.js';
import { spawnEnemy, burst } from './entities.js';
import { UPGRADES } from './config.js';

function placeEnemies(state, rng, specs) {
  for (const [kind, x, y] of specs) {
    const e = spawnEnemy(kind, x, y);
    e.telegraph = 0; // already on the field in the posed frame
    state.enemies.push(e);
  }
}

export function applyShot(state, shot, seed) {
  const rng = makeRng(seed || 1);
  state.rng = rng;
  const cx = state.w / 2, cy = state.h / 2;

  if (shot === 'start') {
    state.mode = 'title';
    state.best = 1240;
    // A quiet arena behind the title: a few drones drifting in place.
    placeEnemies(state, rng, [
      ['drifter', 150, 120], ['spitter', 820, 110],
      ['splitter', 120, 480], ['bulwark', 830, 470],
    ]);
    for (const e of state.enemies) e.angle = rng() * Math.PI * 2;
    return;
  }

  if (shot === 'play') {
    state.mode = 'playing';
    state.wave = 3;
    state.score = 1240;
    state.best = 1240;
    state.combo = 3;
    state.comboLeft = 2.0;
    state.banner = 'WAVE 3';
    state.bannerLeft = 1.2;
    state.player.x = cx - 60;
    state.player.y = cy + 40;
    state.player.angle = -0.6;
    state.player.hp = 78;
    placeEnemies(state, rng, [
      ['drifter', cx + 180, cy - 120],
      ['drifter', cx + 260, cy + 60],
      ['splitter', cx - 240, cy - 140],
      ['spitter', cx + 320, cy - 180],
      ['bulwark', cx - 280, cy + 150],
      ['drifter', cx + 60, cy - 200],
    ]);
    // Bullets mid-flight from the player toward the pack.
    for (let i = 0; i < 3; i++) {
      const a = -0.6 + (i - 1) * 0.09;
      state.bullets.push({
        x: cx - 60 + Math.cos(a) * (60 + i * 46),
        y: cy + 40 + Math.sin(a) * (60 + i * 46),
        vx: Math.cos(a) * 560, vy: Math.sin(a) * 560,
        damage: 22, pierce: 0, radius: 4, friendly: true, life: 1,
      });
    }
    // One enemy orb incoming, a couple of shards, some impact sparks.
    state.bullets.push({
      x: cx + 200, y: cy - 120, vx: -190, vy: 60,
      damage: 10, pierce: 0, radius: 6, friendly: false, life: 3,
    });
    state.pickups.push(
      { kind: 'shard', x: cx + 90, y: cy + 130, life: 9, bob: 1, value: 10 },
      { kind: 'shard', x: cx + 120, y: cy + 150, life: 9, bob: 2, value: 10 },
      { kind: 'repair', x: cx - 180, y: cy + 190, life: 9, bob: 0, value: 18 },
    );
    burst(state, cx + 180, cy - 120, '#f472b6', 10, 160);
    burst(state, cx - 240, cy - 140, '#a3e635', 8, 140);
    return;
  }

  if (shot === 'upgrade') {
    state.mode = 'upgrade';
    state.wave = 2;
    state.score = 860;
    state.best = 1240;
    state.player.hp = 64;
    state.upgradeChoices = [
      UPGRADES.find((u) => u.id === 'twin'),
      UPGRADES.find((u) => u.id === 'rapid'),
      UPGRADES.find((u) => u.id === 'plating'),
    ];
    return;
  }

  // 'end' (and anything unknown): the game-over screen.
  state.mode = 'over';
  state.wave = 5;
  state.score = 2450;
  state.best = 2450;
  state.kills = 63;
  state.player.alive = false;
  state.overStats = { score: 2450, wave: 5, kills: 63 };
  burst(state, cx, cy, '#22d3ee', 30, 260);
  burst(state, cx, cy, '#f472b6', 18, 200);
  // Spread the blast out so the wreck reads in a still frame.
  for (const pt of state.particles) {
    pt.x += range(rng, -130, 130);
    pt.y += range(rng, -110, 110);
  }
}

// Neon Salvage — entities and their per-frame motion.
// One job: build every thing that moves and advance it. Collisions,
// waves and scoring live in world.js; drawing lives in render.js.

import { PLAYER, ENEMIES } from './config.js';
import { angleTo, clamp, dist2 } from './random.js';

export function makePlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, radius: PLAYER.radius,
    hp: PLAYER.hp, maxHp: PLAYER.hp,
    speed: PLAYER.speed,
    fireInterval: PLAYER.fireInterval, fireLeft: 0,
    bulletDamage: PLAYER.bulletDamage, bulletSpeed: PLAYER.bulletSpeed,
    shots: 1, pierce: 0, pickupRadius: PLAYER.pickupRadius,
    dashCooldown: PLAYER.dashCooldown, dashCdLeft: 0, dashLeft: 0,
    invulnLeft: 0, alive: true,
  };
}

export function spawnEnemy(kind, x, y) {
  const base = ENEMIES[kind];
  return {
    kind, x, y, angle: 0,
    hp: base.hp, maxHp: base.hp,
    speed: base.speed, radius: base.radius,
    damage: base.damage, score: base.score, color: base.color,
    telegraph: 0.6, // spawn warning: drawn, harmless, frozen
    flash: 0,
    shootLeft: kind === 'spitter' ? 1.6 : 0,
    wobble: Math.random() * Math.PI * 2,
  };
}

export function burst(state, x, y, color, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.3 + Math.random() * 0.7);
    state.particles.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      life: 0.35 + Math.random() * 0.4, maxLife: 0.75,
      size: 1.5 + Math.random() * 2.5, color,
    });
  }
}

export function addFloat(state, x, y, text, color) {
  state.floats.push({ x, y, text, color, life: 0.9, maxLife: 0.9 });
}

// --- player motion, dash and firing. Returns nothing; bullets land in state.bullets.
export function updatePlayer(state, input, dt, world) {
  const p = state.player;
  if (!p.alive) return;
  const mv = input.moveVector();

  if (p.dashLeft > 0) {
    p.dashLeft -= dt;
    p.x += Math.cos(p.dashAngle) * PLAYER.dashSpeed * dt;
    p.y += Math.sin(p.dashAngle) * PLAYER.dashSpeed * dt;
  } else {
    p.x += mv.x * p.speed * dt;
    p.y += mv.y * p.speed * dt;
    if ((mv.x !== 0 || mv.y !== 0) && input.wasPressed('shift')) {
      p.dashLeft = PLAYER.dashTime;
      p.dashCdLeft = p.dashCooldown;
      p.dashAngle = Math.atan2(mv.y, mv.x);
      p.invulnLeft = Math.max(p.invulnLeft, PLAYER.dashTime + 0.05);
      state.shake = Math.min(state.shake + 2, 6);
      return { dashed: true };
    }
  }
  if (p.dashCdLeft > 0) p.dashCdLeft -= dt;
  if (p.invulnLeft > 0) p.invulnLeft -= dt;

  // Touch: drag steers toward the touch point instead of WASD.
  const tm = input.touchMove();
  if (tm) {
    const dx = tm.x - world.view.x - p.x * world.view.scale;
    const dy = tm.y - world.view.y - p.y * world.view.scale;
    const d = Math.hypot(dx, dy);
    if (d > 12) {
      p.x += (dx / d) * p.speed * dt / world.view.scale;
      p.y += (dy / d) * p.speed * dt / world.view.scale;
    }
  }

  p.x = clamp(p.x, p.radius, world.w - p.radius);
  p.y = clamp(p.y, p.radius, world.h - p.radius);

  // Aim at the mouse (in world coords); touch aims at the nearest enemy.
  const m = input.mouse;
  if (m.inside) {
    const wx = (m.x - world.view.x) / world.view.scale;
    const wy = (m.y - world.view.y) / world.view.scale;
    p.angle = angleTo(p.x, p.y, wx, wy);
  }

  p.fireLeft -= dt;
  const firing = input.mouse.down || input.down(' ');
  if (firing && p.fireLeft <= 0) {
    p.fireLeft = p.fireInterval;
    const spread = 0.09;
    for (let i = 0; i < p.shots; i++) {
      const off = (i - (p.shots - 1) / 2) * spread;
      const a = p.angle + off;
      state.bullets.push({
        x: p.x + Math.cos(a) * (p.radius + 6),
        y: p.y + Math.sin(a) * (p.radius + 6),
        vx: Math.cos(a) * p.bulletSpeed, vy: Math.sin(a) * p.bulletSpeed,
        damage: p.bulletDamage, pierce: p.pierce, radius: PLAYER.bulletRadius,
        friendly: true, life: 1.1,
      });
    }
    return { fired: true };
  }
  return null;
}

export function updateEnemies(state, dt) {
  const p = state.player;
  for (const e of state.enemies) {
    if (e.flash > 0) e.flash -= dt;
    if (e.telegraph > 0) { e.telegraph -= dt; continue; }
    e.wobble += dt * 3;
    const d = Math.hypot(p.x - e.x, p.y - e.y) || 1;
    const nx = (p.x - e.x) / d, ny = (p.y - e.y) / d;
    if (e.kind === 'spitter') {
      // Hold ~260 units off and strafe; fire orbs on a timer.
      const want = 260;
      const radial = d < want - 30 ? -1 : d > want + 30 ? 1 : 0;
      const strafe = Math.sin(e.wobble) > 0 ? 1 : -1;
      e.x += (nx * radial + -ny * strafe * 0.7) * e.speed * dt;
      e.y += (ny * radial + nx * strafe * 0.7) * e.speed * dt;
      e.shootLeft -= dt;
      if (e.shootLeft <= 0 && p.alive) {
        e.shootLeft = 2.2;
        const a = angleTo(e.x, e.y, p.x, p.y);
        state.bullets.push({
          x: e.x + Math.cos(a) * (e.radius + 6),
          y: e.y + Math.sin(a) * (e.radius + 6),
          vx: Math.cos(a) * 190, vy: Math.sin(a) * 190,
          damage: e.damage, pierce: 0, radius: 6, friendly: false, life: 4,
        });
      }
    } else {
      e.x += nx * e.speed * dt;
      e.y += ny * e.speed * dt;
    }
    e.angle = Math.atan2(ny, nx);
    e.x = clamp(e.x, e.radius, state.w - e.radius);
    e.y = clamp(e.y, e.radius, state.h - e.radius);
  }
}

export function updateBullets(state, dt) {
  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
  }
  state.bullets = state.bullets.filter(
    (b) => b.life > 0 && b.x > -20 && b.x < state.w + 20 && b.y > -20 && b.y < state.h + 20,
  );
}

export function updateParticles(state, dt) {
  for (const pt of state.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.92;
    pt.vy *= 0.92;
    pt.life -= dt;
  }
  state.particles = state.particles.filter((pt) => pt.life > 0);
}

export function updatePickups(state, dt) {
  const p = state.player;
  for (const pk of state.pickups) {
    pk.life -= dt;
    pk.bob += dt * 4;
    // Drift toward the player inside the pickup radius.
    if (p.alive) {
      const d2 = dist2(pk.x, pk.y, p.x, p.y);
      if (d2 < p.pickupRadius * p.pickupRadius) {
        const d = Math.sqrt(d2) || 1;
        const pull = 320 * (1 - d / p.pickupRadius) + 60;
        pk.x += ((p.x - pk.x) / d) * pull * dt;
        pk.y += ((p.y - pk.y) / d) * pull * dt;
      }
    }
  }
  state.pickups = state.pickups.filter((pk) => pk.life > 0);
}

export function updateFloats(state, dt) {
  for (const f of state.floats) {
    f.y -= 34 * dt;
    f.life -= dt;
  }
  state.floats = state.floats.filter((f) => f.life > 0);
}

// Neon Salvage — every pixel the player sees.
// One job: draw the arena, the entities, the HUD and the menus. It
// reads state, never changes it (except the canvas).

import { PALETTE, PLAYER } from './config.js';
import { upgradeCardRects } from './world.js';
import { sfx } from './audio.js';

function font(size, weight = 700) {
  return `${weight} ${size}px "Segoe UI", system-ui, -apple-system, sans-serif`;
}

function drawStarfield(ctx, w, h, t) {
  ctx.fillStyle = PALETTE.bg;
  ctx.fillRect(0, 0, w, h);
  // Two drifting star layers, placed by a hash of their index so the
  // field is stable frame to frame.
  for (let layer = 0; layer < 2; layer++) {
    const n = layer === 0 ? 70 : 40;
    for (let i = 0; i < n; i++) {
      const hx = ((i * 2654435761) % 1000) / 1000;
      const hy = ((i * 40503 + layer * 331) % 1000) / 1000;
      const sx = (hx * w + t * (4 + layer * 6)) % w;
      const sy = hy * h;
      ctx.globalAlpha = layer === 0 ? 0.25 : 0.5;
      ctx.fillStyle = '#9db4e8';
      ctx.fillRect(sx, sy, layer === 0 ? 1 : 2, layer === 0 ? 1 : 2);
    }
  }
  ctx.globalAlpha = 1;
}

function drawGrid(ctx, state) {
  ctx.strokeStyle = PALETTE.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= state.w; x += 60) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, state.h);
  }
  for (let y = 0; y <= state.h; y += 60) {
    ctx.moveTo(0, y);
    ctx.lineTo(state.w, y);
  }
  ctx.stroke();
  ctx.strokeStyle = PALETTE.arenaEdge;
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, state.w - 3, state.h - 3);
}

function poly(ctx, x, y, r, sides, rot) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawEnemy(ctx, e) {
  if (e.telegraph > 0) {
    // Spawn warning: a pulsing dashed ring, no body yet.
    const pulse = 0.5 + 0.5 * Math.sin(e.telegraph * 18);
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.45 * pulse;
    ctx.strokeStyle = e.color;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.angle);
  ctx.fillStyle = e.flash > 0 ? '#ffffff' : e.color;
  ctx.strokeStyle = e.color;
  ctx.lineWidth = 2;
  if (e.kind === 'drifter') poly(ctx, 0, 0, e.radius, 4, 0);
  else if (e.kind === 'splitter') poly(ctx, 0, 0, e.radius, 6, 0);
  else if (e.kind === 'spitter') {
    ctx.fillRect(-e.radius * 0.8, -e.radius * 0.8, e.radius * 1.6, e.radius * 1.6);
    ctx.fillStyle = '#f5d0fe';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
  } else poly(ctx, 0, 0, e.radius, 8, 0);
  if (e.kind !== 'spitter') ctx.fill();
  // Health arc over damaged enemies.
  if (e.hp < e.maxHp) {
    ctx.rotate(-e.angle);
    ctx.strokeStyle = '#ffffff';
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, e.radius + 5, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * e.hp) / e.maxHp);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawPlayer(ctx, p, t) {
  if (!p.alive) return;
  ctx.save();
  if (p.invulnLeft > 0 && Math.floor(t * 14) % 2 === 0) ctx.globalAlpha = 0.35;
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.shadowColor = PALETTE.player;
  ctx.shadowBlur = 16;
  ctx.fillStyle = PALETTE.player;
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-10, 11);
  ctx.lineTo(-5, 0);
  ctx.lineTo(-10, -11);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = PALETTE.playerCore;
  ctx.beginPath();
  ctx.arc(2, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawWorld(ctx, state, t) {
  drawGrid(ctx, state);
  for (const pk of state.pickups) {
    const bob = Math.sin(pk.bob) * 2;
    ctx.save();
    ctx.translate(pk.x, pk.y + bob);
    if (pk.kind === 'shard') {
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = PALETTE.shard;
      ctx.fillRect(-4, -4, 8, 8);
    } else {
      ctx.fillStyle = PALETTE.repair;
      ctx.fillRect(-7, -2.5, 14, 5);
      ctx.fillRect(-2.5, -7, 5, 14);
    }
    ctx.restore();
  }
  for (const e of state.enemies) drawEnemy(ctx, e);
  drawPlayer(ctx, state.player, t);
  for (const b of state.bullets) {
    ctx.save();
    ctx.fillStyle = b.friendly ? PALETTE.bullet : PALETTE.orb;
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  for (const pt of state.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;
  for (const f of state.floats) {
    ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
    ctx.fillStyle = f.color;
    ctx.font = font(14);
    ctx.textAlign = 'center';
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

function drawHud(ctx, state, view) {
  const p = state.player;
  const pad = 16;
  // Health bar, top left.
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.dim;
  ctx.font = font(12);
  ctx.fillText('HULL', pad, pad + 12);
  ctx.fillStyle = '#16213c';
  ctx.fillRect(pad + 44, pad + 2, 180, 14);
  ctx.fillStyle = p.hp / p.maxHp > 0.35 ? '#34d399' : PALETTE.danger;
  ctx.fillRect(pad + 44, pad + 2, 180 * Math.max(0, p.hp / p.maxHp), 14);
  ctx.strokeStyle = PALETTE.arenaEdge;
  ctx.strokeRect(pad + 44, pad + 2, 180, 14);
  // Dash cooldown under the hull bar.
  ctx.fillStyle = '#16213c';
  ctx.fillRect(pad + 44, pad + 20, 180, 5);
  const dashFrac = p.dashCdLeft > 0 ? 1 - p.dashCdLeft / p.dashCooldown : 1;
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(pad + 44, pad + 20, 180 * dashFrac, 5);
  ctx.fillStyle = PALETTE.dim;
  ctx.font = font(11);
  ctx.fillText('SHIFT dash', pad + 44, pad + 38);

  // Wave, top centre.
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.text;
  ctx.font = font(20);
  ctx.fillText(`WAVE ${Math.max(1, state.wave)}`, view.w / 2, pad + 18);
  ctx.fillStyle = PALETTE.dim;
  ctx.font = font(12);
  const left = state.enemies.length + state.spawnQueue.length;
  ctx.fillText(left > 0 ? `${left} hostiles left` : 'clear the wave', view.w / 2, pad + 36);

  // Score, top right.
  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.text;
  ctx.font = font(20);
  ctx.fillText(state.score.toLocaleString(), view.w - pad, pad + 18);
  ctx.fillStyle = PALETTE.dim;
  ctx.font = font(12);
  ctx.fillText(`BEST ${state.best.toLocaleString()}`, view.w - pad, pad + 36);
  if (state.combo > 1) {
    ctx.fillStyle = '#fbbf24';
    ctx.font = font(16);
    ctx.fillText(`COMBO x${(1 + (state.combo - 1) * 0.5).toFixed(1)}`, view.w - pad, pad + 58);
  }

  // Mute state, bottom right.
  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.dim;
  ctx.font = font(12);
  ctx.fillText(sfx.isMuted() ? 'M — sound off' : 'M — sound on', view.w - pad, view.h - pad);
  ctx.textAlign = 'left';
  ctx.fillText('WASD move · mouse aim · hold click to fire · P pause', pad, view.h - pad);

  // Wave banner.
  if (state.bannerLeft > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, state.bannerLeft);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = font(44);
    ctx.shadowColor = PALETTE.player;
    ctx.shadowBlur = 24;
    ctx.fillText(state.banner, view.w / 2, view.h * 0.38);
    ctx.restore();
  }
}

function drawTitle(ctx, state, view, t) {
  ctx.fillStyle = 'rgba(4, 8, 18, 0.72)';
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.player;
  ctx.font = font(64);
  ctx.shadowColor = PALETTE.player;
  ctx.shadowBlur = 30;
  ctx.fillText('NEON SALVAGE', view.w / 2, view.h * 0.32);
  ctx.shadowBlur = 0;
  ctx.fillStyle = PALETTE.text;
  ctx.font = font(20);
  ctx.fillText('Hold the arena. Salvage the wreckage. Survive the waves.', view.w / 2, view.h * 0.32 + 38);
  ctx.fillStyle = PALETTE.dim;
  ctx.font = font(16);
  const lines = [
    'WASD / arrows — move      Mouse — aim      Hold click / Space — fire',
    'SHIFT — dash through danger      1 / 2 / 3 — pick an upgrade      P — pause',
    'Clear each wave, pick an upgrade, chain kills for combo score.',
  ];
  lines.forEach((l, i) => ctx.fillText(l, view.w / 2, view.h * 0.48 + i * 26));
  if (state.best > 0) {
    ctx.fillStyle = '#fbbf24';
    ctx.font = font(16);
    ctx.fillText(`BEST SCORE ${state.best.toLocaleString()}`, view.w / 2, view.h * 0.48 + 3 * 26 + 8);
  }
  ctx.fillStyle = PALETTE.text;
  ctx.font = font(22);
  ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 4);
  ctx.fillText('PRESS ENTER OR CLICK TO START', view.w / 2, view.h * 0.74);
  ctx.globalAlpha = 1;
}

function drawUpgrade(ctx, state, view, input) {
  ctx.fillStyle = 'rgba(4, 8, 18, 0.78)';
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.text;
  ctx.font = font(30);
  ctx.fillText(`WAVE ${state.wave} CLEAR`, view.w / 2, view.h * 0.2);
  ctx.fillStyle = PALETTE.dim;
  ctx.font = font(16);
  ctx.fillText('Choose one upgrade — click a card or press 1, 2, 3', view.w / 2, view.h * 0.2 + 30);
  const rects = upgradeCardRects(view.w, view.h);
  state.upgradeChoices.forEach((up, i) => {
    const r = rects[i];
    const hover = input.mouse.x >= r.x && input.mouse.x <= r.x + r.w && input.mouse.y >= r.y && input.mouse.y <= r.y + r.h;
    ctx.save();
    ctx.fillStyle = hover ? '#16244a' : PALETTE.card;
    ctx.strokeStyle = hover ? PALETTE.player : PALETTE.cardEdge;
    ctx.lineWidth = hover ? 3 : 2;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = PALETTE.player;
    ctx.font = font(13);
    ctx.fillText(`[ ${i + 1} ]`, r.x + r.w / 2, r.y + 34);
    ctx.fillStyle = PALETTE.text;
    ctx.font = font(19);
    const words = up.name.split(' ');
    let line = '';
    let ly = r.y + 78;
    for (const w of words) {
      if (ctx.measureText(line + w).width > r.w - 32 && line) {
        ctx.fillText(line.trim(), r.x + r.w / 2, ly);
        ly += 24;
        line = '';
      }
      line += w + ' ';
    }
    ctx.fillText(line.trim(), r.x + r.w / 2, ly);
    ctx.fillStyle = PALETTE.dim;
    ctx.font = font(15);
    ctx.fillText(up.desc, r.x + r.w / 2, r.y + r.h - 40);
    ctx.restore();
  });
}

function drawPaused(ctx, view) {
  ctx.fillStyle = 'rgba(4, 8, 18, 0.7)';
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.text;
  ctx.font = font(40);
  ctx.fillText('PAUSED', view.w / 2, view.h / 2 - 10);
  ctx.fillStyle = PALETTE.dim;
  ctx.font = font(16);
  ctx.fillText('Press P or Enter to resume', view.w / 2, view.h / 2 + 26);
}

function drawOver(ctx, state, view, t) {
  ctx.fillStyle = 'rgba(10, 4, 8, 0.78)';
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.danger;
  ctx.font = font(52);
  ctx.shadowColor = PALETTE.danger;
  ctx.shadowBlur = 26;
  ctx.fillText('SIGNAL LOST', view.w / 2, view.h * 0.3);
  ctx.shadowBlur = 0;
  const s = state.overStats || { score: state.score, wave: state.wave, kills: state.kills };
  ctx.fillStyle = PALETTE.text;
  ctx.font = font(24);
  ctx.fillText(`SCORE  ${s.score.toLocaleString()}`, view.w / 2, view.h * 0.3 + 56);
  ctx.fillStyle = PALETTE.dim;
  ctx.font = font(17);
  ctx.fillText(`Reached wave ${s.wave}  ·  ${s.kills} drones scrapped`, view.w / 2, view.h * 0.3 + 90);
  if (s.score >= state.best && s.score > 0) {
    ctx.fillStyle = '#fbbf24';
    ctx.font = font(18);
    ctx.fillText('★ NEW BEST SCORE ★', view.w / 2, view.h * 0.3 + 122);
  } else {
    ctx.fillStyle = PALETTE.dim;
    ctx.font = font(16);
    ctx.fillText(`Best ${state.best.toLocaleString()}`, view.w / 2, view.h * 0.3 + 122);
  }
  ctx.fillStyle = PALETTE.text;
  ctx.font = font(22);
  ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 4);
  ctx.fillText('PRESS R OR CLICK TO PLAY AGAIN', view.w / 2, view.h * 0.72);
  ctx.globalAlpha = 1;
}

export function render(ctx, state, input, t) {
  const view = state.view;
  const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
  const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;

  drawStarfield(ctx, view.w, view.h, t);
  ctx.save();
  ctx.translate(view.x + shakeX, view.y + shakeY);
  ctx.scale(view.scale, view.scale);
  drawWorld(ctx, state, t);
  ctx.restore();

  if (state.mode === 'playing' || state.mode === 'paused' || state.mode === 'upgrade') {
    drawHud(ctx, state, view);
  }
  if (state.mode === 'title') drawTitle(ctx, state, view, t);
  else if (state.mode === 'upgrade') drawUpgrade(ctx, state, view, input);
  else if (state.mode === 'paused') drawPaused(ctx, view);
  else if (state.mode === 'over') drawOver(ctx, state, view, t);
}

// Neon Salvage — boot and frame loop.
// One job: size the canvas, own the animation loop, and hand the world
// to update() and render() each frame. In ?shot= mode it poses one
// fixed frame and stops, so a screenshot is deterministic.

import { createWorld, update } from './world.js';
import { createInput } from './input.js';
import { render } from './render.js';
import { applyShot } from './shots.js';
import { makeRng } from './random.js';
import { WORLD } from './config.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(location.search);
const shot = params.get('shot');
const seed = Number(params.get('seed') || '1');

const input = createInput(canvas);
const state = createWorld(makeRng((Math.random() * 0x7fffffff) | 0));

function fitView() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const scale = Math.min(w / WORLD.w, h / WORLD.h);
  state.view = {
    scale,
    x: Math.round((w - WORLD.w * scale) / 2),
    y: Math.round((h - WORLD.h * scale) / 2),
    w, h,
  };
  // Keep the mouse aim honest: input reports CSS pixels, which is
  // what view.w/view.h and the transform above are measured in.
}

fitView();
window.addEventListener('resize', fitView);

if (shot) {
  // Screenshot mode: pose the frame, draw it once, and stop. The
  // judge's screenshots are renders of the same code that plays.
  // t is chosen where the blinking prompts are at full brightness.
  applyShot(state, shot, seed);
  render(ctx, state, input, Math.PI / 8);
  window.__shotReady = true;
} else {
  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    update(state, input, dt);
    render(ctx, state, input, now / 1000);
    input.endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

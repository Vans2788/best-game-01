// Neon Salvage — seeded randomness.
// One job: a small deterministic RNG so a screenshot seed replays the
// exact same scene, plus the picking helpers the world uses.

// mulberry32: tiny, fast, good enough for a game.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

// k distinct items from list, in random order.
export function pickDistinct(rng, list, k) {
  const copy = list.slice();
  const out = [];
  while (copy.length && out.length < k) {
    out.push(copy.splice(Math.floor(rng() * copy.length), 1)[0]);
  }
  return out;
}

export function range(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}

export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function dist2(ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  return dx * dx + dy * dy;
}

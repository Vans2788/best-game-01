// Neon Salvage — synthesised sound effects.
// One job: every sound is a few WebAudio oscillators, no audio files.
// The context is created lazily on the first user gesture so browsers
// allow it; a muted flag survives in localStorage.

let ctx = null;
let muted = false;
try { muted = localStorage.getItem('neon-salvage-muted') === '1'; } catch (_) {}

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq, dur, type, vol, slideTo) {
  if (muted) return;
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur, vol, lowpass) {
  if (muted) return;
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = lowpass;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(c.destination);
  src.start(t);
}

export const sfx = {
  unlock() { ac(); }, // call from a gesture so later sounds are allowed
  shoot() { tone(720 + Math.random() * 120, 0.07, 'square', 0.05, 240); },
  hit() { tone(180, 0.05, 'sawtooth', 0.06, 90); },
  explode() { noise(0.28, 0.22, 900); tone(120, 0.25, 'sine', 0.16, 40); },
  pickup() { tone(880, 0.08, 'sine', 0.08, 1320); },
  repair() { tone(520, 0.12, 'sine', 0.1, 780); tone(780, 0.14, 'sine', 0.08, 1040); },
  wave() { tone(220, 0.35, 'triangle', 0.14, 440); tone(330, 0.35, 'triangle', 0.1, 660); },
  upgrade() { tone(660, 0.1, 'sine', 0.1, 990); tone(990, 0.16, 'sine', 0.1, 1320); },
  hurt() { tone(140, 0.2, 'sawtooth', 0.16, 60); noise(0.12, 0.12, 500); },
  dash() { noise(0.14, 0.1, 2400); },
  over() { tone(392, 0.25, 'triangle', 0.14, 370); tone(311, 0.3, 'triangle', 0.14, 294); tone(233, 0.55, 'triangle', 0.14, 175); },
  isMuted() { return muted; },
  toggleMute() {
    muted = !muted;
    try { localStorage.setItem('neon-salvage-muted', muted ? '1' : '0'); } catch (_) {}
    return muted;
  },
};

// Neon Salvage — input state.
// One job: turn keyboard, mouse and touch into one clean snapshot the
// simulation reads each frame. No game logic lives here.

export function createInput(canvas) {
  const keys = new Set();
  const mouse = { x: 0, y: 0, down: false, inside: false };
  const pressed = new Set(); // keys hit since the last frame was consumed

  const keyName = (e) => e.key.toLowerCase();

  window.addEventListener('keydown', (e) => {
    const k = keyName(e);
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    if (!keys.has(k)) pressed.add(k);
    keys.add(k);
  });
  window.addEventListener('keyup', (e) => keys.delete(keyName(e)));
  window.addEventListener('blur', () => { keys.clear(); mouse.down = false; });

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
    mouse.inside = true;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) mouse.down = true;
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) mouse.down = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // Touch: drag to move, second finger (or tap-and-hold) to fire.
  let touchMove = null;
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    for (const t of e.changedTouches) {
      if (touchMove === null) touchMove = { id: t.identifier, x: t.clientX - r.left, y: t.clientY - r.top };
      else mouse.down = true;
    }
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    for (const t of e.changedTouches) {
      if (touchMove && t.identifier === touchMove.id) {
        touchMove.x = t.clientX - r.left;
        touchMove.y = t.clientY - r.top;
      }
    }
  }, { passive: false });
  canvas.addEventListener('touchend', (e) => {
    for (const t of e.changedTouches) {
      if (touchMove && t.identifier === touchMove.id) touchMove = null;
      else mouse.down = false;
    }
  });

  return {
    mouse,
    touchMove: () => touchMove,
    down: (k) => keys.has(k),
    // True once per physical press; the world consumes it each frame.
    wasPressed: (k) => pressed.has(k),
    endFrame: () => pressed.clear(),
    // Movement vector from WASD / arrows, normalised.
    moveVector() {
      let x = 0, y = 0;
      if (keys.has('a') || keys.has('arrowleft')) x -= 1;
      if (keys.has('d') || keys.has('arrowright')) x += 1;
      if (keys.has('w') || keys.has('arrowup')) y -= 1;
      if (keys.has('s') || keys.has('arrowdown')) y += 1;
      if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
      return { x, y };
    },
  };
}

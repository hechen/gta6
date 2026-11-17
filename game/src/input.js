// Keyboard and mouse: a held-key set, edge-triggered actions, and a drag-orbit camera.
// The camera is steered by dragging (no pointer lock), so it works in every browser and
// in a screenshot: click-drag orbits, the wheel zooms, and the view settles behind the player.

export const ACTION_ENTER_CAR = 1 << 0;
export const ACTION_SHOOT = 1 << 1;
export const ACTION_RELOAD = 1 << 2;
export const ACTION_JUMP = 1 << 3;
export const ACTION_HORN = 1 << 4;
export const ACTION_PAUSE = 1 << 5;
export const ACTION_CONFIRM = 1 << 6;
export const ACTION_CAMERA = 1 << 7;
export const ACTION_MUTE = 1 << 8;

const KEY_ACTIONS = {
  KeyE: ACTION_ENTER_CAR,
  KeyR: ACTION_RELOAD,
  Space: ACTION_JUMP,
  KeyH: ACTION_HORN,
  KeyP: ACTION_PAUSE,
  Escape: ACTION_PAUSE,
  Enter: ACTION_CONFIRM,
  KeyC: ACTION_CAMERA,
  KeyM: ACTION_MUTE,
};

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseDown = false;
  let lastX = 0;
  let lastY = 0;
  /** Accumulated orbit deltas since the last read, in pixels. */
  let orbitX = 0;
  let orbitY = 0;
  let wheel = 0;

  function onKeyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    const action = KEY_ACTIONS[event.code];
    if (action) {
      actions |= action;
      event.preventDefault();
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
  }
  function onKeyUp(event) {
    keys.delete(event.code);
  }
  function onMouseDown(event) {
    mouseDown = true;
    lastX = event.clientX;
    lastY = event.clientY;
    actions |= ACTION_SHOOT;
  }
  function onMouseUp() {
    mouseDown = false;
  }
  function onMouseMove(event) {
    if (!mouseDown) return;
    orbitX += event.clientX - lastX;
    orbitY += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
  }
  function onWheel(event) {
    wheel += event.deltaY;
    event.preventDefault();
  }
  function onBlur() {
    keys.clear();
    mouseDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('blur', onBlur);

  return {
    /** -1/0/1 forward (W/S or arrows) and -1/0/1 strafe (A/D). */
    move() {
      const f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      const s = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      return { forward: f, strafe: s, sprint: keys.has('ShiftLeft') || keys.has('ShiftRight') };
    },
    /** Edge-triggered actions since the last call; shooting also holds while the mouse is down. */
    takeActions() {
      const out = actions;
      actions = 0;
      if (mouseDown) return out | ACTION_SHOOT;
      return out;
    },
    /** Orbit deltas in pixels since the last call, and the wheel delta. */
    takeOrbit() {
      const out = { x: orbitX, y: orbitY, wheel };
      orbitX = 0;
      orbitY = 0;
      wheel = 0;
      return out;
    },
    isDown(code) {
      return keys.has(code);
    },
  };
}

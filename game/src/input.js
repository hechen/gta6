// Keyboard and mouse input. Tracks held keys, pressed-this-frame edges, and a
// drag-to-orbit camera. Pointer lock is optional; dragging works everywhere.

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  const mouse = { dx: 0, dy: 0, down: false, x: 0, y: 0, wheel: 0 };
  let locked = false;

  function onKeyDown(e) {
    if (e.repeat) return;
    keys.add(e.code);
    pressed.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  }
  function onKeyUp(e) { keys.delete(e.code); }
  function onMouseDown(e) {
    mouse.down = true; mouse.x = e.clientX; mouse.y = e.clientY;
    if (e.target === canvas && !locked) canvas.requestPointerLock?.();
  }
  function onMouseUp() { mouse.down = false; }
  function onMouseMove(e) {
    if (document.pointerLockElement === canvas) {
      mouse.dx += e.movementX; mouse.dy += e.movementY; locked = true;
    } else if (mouse.down) {
      mouse.dx += e.clientX - mouse.x; mouse.dy += e.clientY - mouse.y;
      mouse.x = e.clientX; mouse.y = e.clientY;
    }
  }
  function onWheel(e) { mouse.wheel += e.deltaY; }
  function onLockChange() { locked = document.pointerLockElement === canvas; }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('wheel', onWheel, { passive: true });
  document.addEventListener('pointerlockchange', onLockChange);

  return {
    // Held keys.
    down(code) { return keys.has(code); },
    // True only on the frame the key went down.
    wasPressed(code) { return pressed.has(code); },
    // Movement axes: -1..1. WASD plus arrows.
    axisX() { return (this.down('KeyD') || this.down('ArrowRight') ? 1 : 0) - (this.down('KeyA') || this.down('ArrowLeft') ? 1 : 0); },
    axisY() { return (this.down('KeyW') || this.down('ArrowUp') ? 1 : 0) - (this.down('KeyS') || this.down('ArrowDown') ? 1 : 0); },
    // Mouse deltas since last frame, then cleared.
    mouseDelta() { const d = { x: mouse.dx, y: mouse.dy }; mouse.dx = 0; mouse.dy = 0; return d; },
    wheelDelta() { const w = mouse.wheel; mouse.wheel = 0; return w; },
    mouseDown: () => mouse.down,
    // Call at the end of each frame.
    endFrame() { pressed.clear(); },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('wheel', onWheel);
      document.removeEventListener('pointerlockchange', onLockChange);
    },
  };
}

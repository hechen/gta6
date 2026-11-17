// Procedural textures, all drawn on canvases at boot: no image files, nothing fetched.
// Building facades get lit windows, roads get lane markings, and the ground gets grass,
// sand and a plaza pattern. Each texture is made once and shared by every mesh that uses it.

function canvasTexture(width, height, draw, repeatX = 1, repeatY = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 4;
  return texture;
}

/** A building facade: concrete base, a grid of windows, some lit warm, some dark. */
export function buildingTexture(base, litRatio, rng) {
  return canvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    // Subtle vertical shading so big faces are not flat.
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0.18)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.06)');
    grad.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    const cols = 6;
    const rows = 12;
    const cw = w / cols;
    const ch = h / rows;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const lit = rng.next() < litRatio;
        ctx.fillStyle = lit ? '#ffd98a' : '#20283a';
        ctx.fillRect(x * cw + 3, y * ch + 4, cw - 6, ch - 8);
        if (lit && rng.next() < 0.4) {
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.fillRect(x * cw + 3, y * ch + 4, cw - 6, 3);
        }
      }
    }
    // Ground floor: shops and doors.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, h - 18, w, 18);
  });
}

/** Asphalt with a centre line and edge lines, tiled along the road. */
export function roadTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#3a3f46';
    ctx.fillRect(0, 0, w, h);
    // Speckle so the asphalt reads as a surface, not a flat colour.
    for (let i = 0; i < 500; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.02 + Math.random() * 0.04})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
    }
    ctx.fillStyle = '#e8c33c';
    ctx.fillRect(w / 2 - 2, 0, 4, 44);
    ctx.fillRect(w / 2 - 2, 84, 4, 44);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(4, 0, 3, h);
    ctx.fillRect(w - 7, 0, 3, h);
  });
}

/** A sidewalk slab with a faint grid of paving joints. */
export function sidewalkTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#9aa0a3';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo((i * w) / 4, 0);
      ctx.lineTo((i * w) / 4, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, (i * h) / 4);
      ctx.lineTo(w, (i * h) / 4);
      ctx.stroke();
    }
  });
}

/** Grass with a few darker tufts. */
export function grassTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#6fae56';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = `rgba(0,60,0,${0.05 + Math.random() * 0.1})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 4);
    }
  });
}

/** Sand with soft ripples. */
export function sandTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#e8d29a';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(160,120,60,0.25)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 14; i++) {
      ctx.beginPath();
      const y = (i * h) / 14 + Math.random() * 4;
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(w * 0.3, y + 5, w * 0.6, y - 5, w, y);
      ctx.stroke();
    }
  });
}

/** Water: deep blue with pale moving-looking streaks (static, the waves are faked by the mesh). */
export function waterTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#2e7f9e';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 22; i++) {
      const y = Math.random() * h;
      ctx.beginPath();
      ctx.moveTo(Math.random() * w, y);
      ctx.lineTo(Math.random() * w + 30, y);
      ctx.stroke();
    }
  });
}

/** A plaza: warm stone tiles in a checker of two tones. */
export function plazaTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    const tones = ['#c9b18a', '#bfa67e'];
    const n = 4;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        ctx.fillStyle = tones[(x + y) % 2];
        ctx.fillRect((x * w) / n, (y * h) / n, w / n, h / n);
      }
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= n; i++) {
      ctx.beginPath();
      ctx.moveTo((i * w) / n, 0);
      ctx.lineTo((i * w) / n, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, (i * h) / n);
      ctx.lineTo(w, (i * h) / n);
      ctx.stroke();
    }
  });
}

/** Make every texture the game needs, once, from one seeded generator. */
export function createTextures(rng) {
  return {
    road: roadTexture(),
    sidewalk: sidewalkTexture(),
    grass: grassTexture(),
    sand: sandTexture(),
    water: waterTexture(),
    plaza: plazaTexture(),
    // Three facade variants, so neighbouring towers do not match.
    facades: [
      buildingTexture('#7d8590', 0.28, rng),
      buildingTexture('#a08a6a', 0.34, rng),
      buildingTexture('#5f7086', 0.22, rng),
    ],
  };
}

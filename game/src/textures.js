// Procedural canvas textures. Everything the city shows is drawn here — no image
// files, no network. Each texture is a small canvas turned into a THREE texture.

import * as THREE from 'three';

export function makeCanvasTexture(w, h, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

// A building facade: lit windows on a coloured wall, with a darker ground floor.
export function facadeTexture(base, lit) {
  return makeCanvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    // Ground floor: darker band with a door.
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, h - 34, w, 34);
    ctx.fillStyle = '#2b2b2b'; ctx.fillRect(w / 2 - 10, h - 30, 20, 30);
    const cols = 4, rows = 8;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = 8 + c * ((w - 16) / cols);
        const y = 10 + r * ((h - 50) / rows);
        const on = ((r * 7 + c * 3) % 5) < 2;
        ctx.fillStyle = on ? lit : 'rgba(20,26,34,0.9)';
        ctx.fillRect(x, y, (w - 16) / cols - 8, (h - 50) / rows - 8);
      }
    }
  });
}

// Asphalt with a dashed centre line (tiled along the road).
export function roadTexture() {
  return makeCanvasTexture(64, 64, (ctx, w, h) => {
    ctx.fillStyle = '#33363b'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let i = 0; i < 40; i++) ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    ctx.fillStyle = '#d8d8d8'; ctx.fillRect(w / 2 - 2, 4, 4, 22);
  });
}

// Pale pavement for sidewalks and plazas.
export function pavementTexture() {
  return makeCanvasTexture(64, 64, (ctx, w, h) => {
    ctx.fillStyle = '#9a938a'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2;
    for (let i = 0; i <= 2; i++) {
      ctx.beginPath(); ctx.moveTo(0, i * 32); ctx.lineTo(w, i * 32); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i * 32, 0); ctx.lineTo(i * 32, h); ctx.stroke();
    }
  });
}

// Sand with a soft speckle.
export function sandTexture() {
  return makeCanvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#cbb27e'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 300; i++) {
      ctx.fillStyle = Math.random() < 0.5 ? 'rgba(160,130,80,0.5)' : 'rgba(230,205,150,0.5)';
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
}

// Grass for the residential blocks.
export function grassTexture() {
  return makeCanvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#6f9e5a'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = Math.random() < 0.5 ? 'rgba(40,90,40,0.5)' : 'rgba(160,200,110,0.5)';
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 3);
    }
  });
}

// A flat sun-bleached rooftop.
export function roofTexture() {
  return makeCanvasTexture(64, 64, (ctx, w, h) => {
    ctx.fillStyle = '#7d7468'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(6, 6, w - 12, h - 12);
    ctx.fillStyle = '#5d564c'; ctx.fillRect(10, 10, 14, 10);
  });
}

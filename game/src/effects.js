// Short-lived effects: pooled particles (smoke, sparks, muzzle flash, explosion fire),
// skid marks left by hard driving, and floating score text. Nothing allocates per frame
// after boot: the pool is fixed and reused.

const POOL = 240;

export function createEffects(scene) {
  const geo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const mesh = new THREE.InstancedMesh(geo, mat, POOL);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  scene.add(mesh);
  const parts = [];
  for (let i = 0; i < POOL; i++) {
    parts.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 1, r: 1, g: 1, b: 1 });
  }
  let cursor = 0;
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  // Skid marks: dark quads laid flat on the road, fading over a minute.
  const skidGeo = new THREE.PlaneGeometry(0.35, 1.4);
  const skidMat = new THREE.MeshBasicMaterial({ color: 0x14161a, transparent: true, opacity: 0.55, depthWrite: false });
  const skids = [];
  for (let i = 0; i < 120; i++) {
    const s = new THREE.Mesh(skidGeo, skidMat.clone());
    s.rotation.x = -Math.PI / 2;
    s.visible = false;
    scene.add(s);
    skids.push({ mesh: s, life: 0 });
  }
  let skidCursor = 0;

  // Floating text: a few canvas sprites reused for "+$60" and similar.
  const floats = [];
  for (let i = 0; i < 8; i++) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthTest: false }));
    sprite.scale.set(6, 1.5, 1);
    sprite.visible = false;
    scene.add(sprite);
    floats.push({ sprite, canvas, life: 0 });
  }
  let floatCursor = 0;

  function spawn(x, y, z, vx, vy, vz, life, size, r, g, b) {
    const p = parts[cursor];
    cursor = (cursor + 1) % POOL;
    p.alive = true;
    p.x = x;
    p.y = y;
    p.z = z;
    p.vx = vx;
    p.vy = vy;
    p.vz = vz;
    p.life = life;
    p.max = life;
    p.size = size;
    p.r = r;
    p.g = g;
    p.b = b;
  }

  return {
    burst(x, y, z, n, colorHex, speed, life, size) {
      color.setHex(colorHex);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const up = Math.random() * 0.8 + 0.2;
        const s = speed * (0.4 + Math.random() * 0.8);
        spawn(x, y, z, Math.cos(a) * s, up * s, Math.sin(a) * s, life * (0.5 + Math.random() * 0.7), size, color.r, color.g, color.b);
      }
    },
    muzzle(x, y, z, angle) {
      this.burst(x, y, z, 6, 0xffd24a, 6, 0.12, 0.9);
      spawn(x + Math.sin(angle) * 0.5, y, z + Math.cos(angle) * 0.5, Math.sin(angle) * 10, 0.5, Math.cos(angle) * 10, 0.1, 1.4, 1, 0.85, 0.3);
    },
    smoke(x, y, z) {
      spawn(x, y, z, (Math.random() - 0.5) * 0.6, 1.2 + Math.random(), (Math.random() - 0.5) * 0.6, 1.6, 1.6, 0.35, 0.35, 0.38);
    },
    explosion(x, y, z) {
      this.burst(x, y + 0.5, z, 26, 0xff7a1a, 9, 0.7, 1.6);
      this.burst(x, y + 0.5, z, 14, 0xffd24a, 12, 0.4, 1.2);
      this.burst(x, y + 0.5, z, 10, 0x333333, 3, 1.8, 2.2);
    },
    skid(x, z, angle) {
      const s = skids[skidCursor];
      skidCursor = (skidCursor + 1) % skids.length;
      s.mesh.visible = true;
      s.mesh.position.set(x, 0.06, z);
      s.mesh.rotation.z = -angle;
      s.mesh.material.opacity = 0.55;
      s.life = 60;
    },
    floatText(text, x, y, z, cssColor) {
      const f = floats[floatCursor];
      floatCursor = (floatCursor + 1) % floats.length;
      const ctx = f.canvas.getContext('2d');
      ctx.clearRect(0, 0, 256, 64);
      ctx.font = 'bold 34px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText(text, 128, 32);
      ctx.fillStyle = cssColor;
      ctx.fillText(text, 128, 32);
      f.sprite.material.map.needsUpdate = true;
      f.sprite.position.set(x, y, z);
      f.sprite.visible = true;
      f.life = 1.4;
    },
    update(dt) {
      for (let i = 0; i < POOL; i++) {
        const p = parts[i];
        if (!p.alive) {
          dummy.position.set(0, -100, 0);
          dummy.scale.setScalar(0.001);
        } else {
          p.life -= dt;
          if (p.life <= 0) {
            p.alive = false;
            dummy.position.set(0, -100, 0);
            dummy.scale.setScalar(0.001);
          } else {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.z += p.vz * dt;
            p.vy -= 2.5 * dt;
            const k = p.life / p.max;
            dummy.position.set(p.x, p.y, p.z);
            dummy.scale.setScalar(p.size * (0.5 + k * 0.5));
            color.setRGB(p.r, p.g, p.b);
            dummy.updateMatrix();
            mesh.setColorAt(i, color);
            mesh.setMatrixAt(i, dummy.matrix);
            continue;
          }
        }
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      for (const s of skids) {
        if (!s.mesh.visible) continue;
        s.life -= dt;
        if (s.life <= 0) s.mesh.visible = false;
        else s.mesh.material.opacity = 0.55 * (s.life / 60);
      }
      for (const f of floats) {
        if (!f.sprite.visible) continue;
        f.life -= dt;
        if (f.life <= 0) f.sprite.visible = false;
        else {
          f.sprite.position.y += dt * 1.5;
          f.sprite.material.opacity = Math.min(1, f.life);
        }
      }
    },
  };
}

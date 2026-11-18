// Solara Bay itself: a 9x9 grid coastal city with five districts, a beach and the
// sea. Builds the 3D scene and returns the data the rest of the game drives on:
// building colliders, the road network traffic follows, and the key locations
// (garage, spray shop, gun shop, bank, safehouse).

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { facadeTexture, roadTexture, pavementTexture, sandTexture, grassTexture, roofTexture } from './textures.js';

const PITCH = CONFIG.blockSize + CONFIG.roadWidth; // 56
const SPAN = CONFIG.gridBlocks * PITCH;            // 504
const HALF = SPAN / 2;                             // 252

// City-local (0..SPAN) to world (-HALF..HALF).
function toWorld(v) { return v - HALF; }
// Centre of block (col,row) in world coords.
function blockCenter(col, row) {
  return { x: toWorld(col * PITCH + CONFIG.blockSize / 2), z: toWorld(row * PITCH + CONFIG.blockSize / 2) };
}
// Centre of a road line: line i runs at local i*PITCH - roadWidth/2.
function roadLine(i) { return toWorld(i * PITCH - CONFIG.roadWidth / 2); }

export function buildCity(scene, rng) {
  const colliders = [];   // {minX,maxX,minZ,maxZ}
  const buildings = [];
  const group = new THREE.Group();
  scene.add(group);

  const facadeMats = {};
  function facadeMat(base, lit) {
    const key = base + lit;
    if (!facadeMats[key]) {
      facadeMats[key] = new THREE.MeshLambertMaterial({ map: facadeTexture(base, lit) });
    }
    return facadeMats[key];
  }
  const roofMat = new THREE.MeshLambertMaterial({ map: roofTexture() });
  // Roads run 504 units; the texture must tile along them, not stretch.
  const roadTexH = roadTexture();
  roadTexH.repeat.set(63, 1);
  const roadTexV = roadTexture();
  roadTexV.repeat.set(1, 63);
  const roadMatH = new THREE.MeshLambertMaterial({ map: roadTexH });
  const roadMatV = new THREE.MeshLambertMaterial({ map: roadTexV });
  // Block bases tile their texture 4x4 across a 44-unit block.
  const paveTex = pavementTexture(); paveTex.repeat.set(4, 4);
  const sandTex = sandTexture(); sandTex.repeat.set(4, 4);
  const grassTex = grassTexture(); grassTex.repeat.set(4, 4);
  const paveMat = new THREE.MeshLambertMaterial({ map: paveTex });
  const sandMat = new THREE.MeshLambertMaterial({ map: sandTex });
  const grassMat = new THREE.MeshLambertMaterial({ map: grassTex });
  const waterMat = new THREE.MeshLambertMaterial({ color: 0x1e6f8e, transparent: true, opacity: 0.85 });
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x4a5240 });

  // --- Ground slab under the whole city.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(SPAN + 220, SPAN + 220), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 0);
  group.add(ground);

  // --- Sea: east of the city and south along the beach.
  const seaEast = new THREE.Mesh(new THREE.PlaneGeometry(CONFIG.seaEast + 260, SPAN + 320), waterMat);
  seaEast.rotation.x = -Math.PI / 2;
  seaEast.position.set(HALF + CONFIG.seaEast / 2 + 130, 0.1, 0);
  group.add(seaEast);
  const seaSouth = new THREE.Mesh(new THREE.PlaneGeometry(SPAN + 320, CONFIG.seaSouth + 200), waterMat);
  seaSouth.rotation.x = -Math.PI / 2;
  seaSouth.position.set(0, 0.1, HALF + CONFIG.seaSouth / 2 + 100);
  group.add(seaSouth);

  // --- Beach: sand strip along the south edge.
  const beachTex = sandTexture(); beachTex.repeat.set(10, 1);
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(SPAN, CONFIG.beachDepth), new THREE.MeshLambertMaterial({ map: beachTex }));
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(0, 0.02, HALF - CONFIG.beachDepth / 2);
  group.add(beach);

  // --- Roads: dark strips along every grid line, both directions.
  const roadGeoH = new THREE.PlaneGeometry(SPAN, CONFIG.roadWidth);
  const roadGeoV = new THREE.PlaneGeometry(CONFIG.roadWidth, SPAN);
  for (let i = 0; i <= CONFIG.gridBlocks; i++) {
    const c = roadLine(i);
    const h = new THREE.Mesh(roadGeoH, roadMatH);
    h.rotation.x = -Math.PI / 2; h.position.set(0, 0.03, c);
    group.add(h);
    const v = new THREE.Mesh(roadGeoV, roadMatV);
    v.rotation.x = -Math.PI / 2; v.position.set(c, 0.03, 0);
    group.add(v);
  }

  // --- Blocks: pavement, grass or sand base, then buildings.
  const districtPalette = ['#5a6b8a', '#3f7d74', '#c9a86a', '#7fae72', '#6e6a78'];
  const litWindows = ['#ffd98a', '#ffe9b0', '#ffb36b'];
  for (let row = 0; row < CONFIG.gridBlocks; row++) {
    for (let col = 0; col < CONFIG.gridBlocks; col++) {
      const dIdx = CONFIG.districtMap[row * CONFIG.gridBlocks + col];
      const d = CONFIG.districts[dIdx];
      const c = blockCenter(col, row);
      // Block base: pavement in town, grass in residential, sand on the beach.
      const baseMat = dIdx === 2 ? sandMat : dIdx === 3 ? grassMat : paveMat;
      const base = new THREE.Mesh(new THREE.PlaneGeometry(CONFIG.blockSize, CONFIG.blockSize), baseMat);
      base.rotation.x = -Math.PI / 2;
      base.position.set(c.x, 0.01, c.z);
      group.add(base);

      if (rng.next() > d.density) continue; // empty lot / park
      const n = rng.int(1, 3);
      for (let b = 0; b < n; b++) {
        const w = rng.range(12, 24);
        const dep = rng.range(12, 24);
        const hgt = rng.range(d.minH, d.maxH);
        const ox = rng.range(-8, 8);
        const oz = rng.range(-8, 8);
        const bx = c.x + ox, bz = c.z + oz;
        const mat = facadeMat(districtPalette[dIdx], rng.pick(litWindows));
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, dep), [mat, mat, roofMat, roofMat, mat, mat]);
        mesh.position.set(bx, hgt / 2, bz);
        group.add(mesh);
        colliders.push({ minX: bx - w / 2, maxX: bx + w / 2, minZ: bz - dep / 2, maxZ: bz + dep / 2 });
        buildings.push({ x: bx, z: bz, w, d: dep, h: hgt, district: d.name });
        // Rooftop AC box on tall towers.
        if (hgt > 40) {
          const ac = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 4), new THREE.MeshLambertMaterial({ color: 0x555555 }));
          ac.position.set(bx + w / 4, hgt + 1, bz);
          group.add(ac);
        }
      }
    }
  }

  // --- Street lamps along the roads.
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x2c2c2c });
  const lampGlow = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let i = 0; i <= CONFIG.gridBlocks; i += 2) {
    for (let j = 0; j <= CONFIG.gridBlocks; j += 2) {
      const x = roadLine(i) + 5, z = roadLine(j) + 5;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 7, 6), lampMat);
      pole.position.set(x, 3.5, z);
      group.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), lampGlow);
      bulb.position.set(x, 7, z);
      group.add(bulb);
    }
  }

  // --- Palm trees on the beach.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e8b57 });
  for (let i = 0; i < 14; i++) {
    const x = rng.range(-HALF + 20, HALF - 20);
    const z = HALF - rng.range(4, CONFIG.beachDepth - 4);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 6, 6), trunkMat);
    trunk.position.set(x, 3, z);
    trunk.rotation.z = rng.range(-0.12, 0.12);
    group.add(trunk);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(2.6, 2.4, 7), leafMat);
    crown.position.set(x, 6.8, z);
    group.add(crown);
  }

  // --- Shipping containers at the docks (north-east blocks).
  const contColors = [0xb03030, 0x2a6db0, 0x3a8a3a, 0xd08020];
  for (let i = 0; i < 10; i++) {
    const col = rng.int(6, 8), row = rng.int(0, 1);
    const c = blockCenter(col, row);
    const w = 12, dep = 3, hgt = 3;
    const x = c.x + rng.range(-10, 10), z = c.z + rng.range(-10, 10);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, dep), new THREE.MeshLambertMaterial({ color: rng.pick(contColors) }));
    m.position.set(x, hgt / 2, z);
    m.rotation.y = rng.pick([0, Math.PI / 2]);
    group.add(m);
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - dep / 2, maxZ: z + dep / 2 });
  }

  // --- Key locations (fixed, so missions and shops are findable).
  const garage = blockCenter(7, 3);      // Marina Row garage
  const spray = blockCenter(2, 5);       // Spray shop, west side
  const gunshop = blockCenter(5, 1);     // Gun shop, downtown north
  const bank = blockCenter(4, 2);        // Solara Bank, downtown
  const safehouse = blockCenter(1, 6);   // Safehouse, residential west
  const taxiStand = blockCenter(4, 4);   // Central taxi stand

  function marker(x, z, color, label) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(3, 3.8, 24),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.08, z);
    group.add(ring);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 14, 8, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false }),
    );
    beam.position.set(x, 7, z);
    group.add(beam);
    return { x, z, ring, beam, label };
  }

  const markers = {
    garage: marker(garage.x, garage.z, 0x2fd6a3, 'Garage'),
    spray: marker(spray.x, spray.z, 0x33ccff, 'Spray Shop'),
    gunshop: marker(gunshop.x, gunshop.z, 0xffaa22, 'Gun Shop'),
    bank: marker(bank.x, bank.z, 0xffdd33, 'Solara Bank'),
    safehouse: marker(safehouse.x, safehouse.z, 0xaa66ff, 'Safehouse'),
    taxi: marker(taxiStand.x, taxiStand.z, 0xffcc00, 'Taxi Stand'),
  };

  // Road network: cars drive on the road lines. Each line is an axis plus a
  // constant coordinate; intersections sit where a horizontal and vertical line cross.
  const roadLines = [];
  for (let i = 0; i <= CONFIG.gridBlocks; i++) roadLines.push(roadLine(i));

  return {
    group, colliders, buildings, markers, roadLines,
    bounds: { minX: -HALF, maxX: HALF + CONFIG.seaEast, minZ: -HALF, maxZ: HALF + CONFIG.seaSouth },
    blockCenter, roadLine,
    // A point on a road, for spawning cars and pedestrians.
    randomRoadPoint() {
      const horizontal = rng.chance(0.5);
      const line = rng.pick(roadLines);
      const along = rng.range(-HALF + 10, HALF - 10);
      return horizontal ? { x: along, z: line } : { x: line, z: along };
    },
    // A point on a sidewalk (just off a road).
    randomSidewalkPoint() {
      const p = this.randomRoadPoint();
      return { x: p.x + rng.range(-8, 8), z: p.z + rng.range(-8, 8) };
    },
    // Clamp a position inside the drivable/walkable city (not into the sea).
    clampToCity(p, margin = 4) {
      p.x = Math.max(-HALF + margin, Math.min(HALF - margin, p.x));
      p.z = Math.max(-HALF + margin, Math.min(HALF - margin, p.z));
      return p;
    },
  };
}

// Resolve an AABB collision: push a circle (x,z,r) out of a collider. Returns
// true if a push happened.
export function resolveCollider(p, r, colliders) {
  let pushed = false;
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(p.x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(p.z, c.maxZ));
    const dx = p.x - nx, dz = p.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        p.x = nx + (dx / d) * r;
        p.z = nz + (dz / d) * r;
      } else {
        // Inside the box: push out along the smallest penetration axis.
        const pl = p.x - c.minX, pr = c.maxX - p.x, pt = p.z - c.minZ, pb = c.maxZ - p.z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) p.x = c.minX - r;
        else if (m === pr) p.x = c.maxX + r;
        else if (m === pt) p.z = c.minZ - r;
        else p.z = c.maxZ + r;
      }
      pushed = true;
    }
  }
  return pushed;
}

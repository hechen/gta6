// Solara Bay: a 9x9 grid city on a sun-soaked coast. It builds the three.js meshes (roads,
// sidewalks, buildings, palms, streetlights, beach and water), the road graph traffic drives
// on, the building colliders, and the named places missions use. One seed builds one city.
import { CITY, DISTRICTS, PALETTE } from './config.js';

// Intersection coordinates, one per grid line, in metres.
const LINES = [-200, -150, -100, -50, 0, 50, 100, 150, 200];

function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.minX && x < d.maxX && z >= d.minZ && z < d.maxZ) return d;
  }
  return DISTRICTS[0];
}

function makeBox(w, h, d, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createCity(rng, textures) {
  const group = new THREE.Group();
  const colliders = [];
  const nodes = [];
  const edges = [];
  const nodeIndex = new Map();
  const key = (x, z) => `${x},${z}`;

  // --- Road graph: one node per intersection, one edge per street segment. ---
  for (const z of LINES) {
    for (const x of LINES) {
      nodeIndex.set(key(x, z), nodes.length);
      nodes.push({ x, z });
    }
  }
  for (let j = 0; j < LINES.length; j++) {
    for (let i = 0; i < LINES.length; i++) {
      const a = nodeIndex.get(key(LINES[i], LINES[j]));
      if (i + 1 < LINES.length) edges.push({ a, b: nodeIndex.get(key(LINES[i + 1], LINES[j])) });
      if (j + 1 < LINES.length) edges.push({ a, b: nodeIndex.get(key(LINES[i], LINES[j + 1])) });
    }
  }

  // --- Materials (shared). ---
  const roadMat = new THREE.MeshStandardMaterial({ map: textures.road, roughness: 0.95 });
  const walkMat = new THREE.MeshStandardMaterial({ map: textures.sidewalk, roughness: 0.9 });
  const grassMat = new THREE.MeshStandardMaterial({ map: textures.grass, roughness: 1 });
  const sandMat = new THREE.MeshStandardMaterial({ map: textures.sand, roughness: 1 });
  const waterMat = new THREE.MeshStandardMaterial({ map: textures.water, roughness: 0.35, metalness: 0.1 });
  const plazaMat = new THREE.MeshStandardMaterial({ map: textures.plaza, roughness: 0.9 });
  const facadeMats = textures.facades.map(
    (t) => new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 }),
  );
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a4f55, roughness: 0.95 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 1 });
  const palmMat = new THREE.MeshStandardMaterial({ color: 0x3f9e4d, roughness: 1 });
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2c3138, roughness: 0.6, metalness: 0.5 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffedb0, emissiveIntensity: 0.6 });

  // --- Ground: one sidewalk slab under the whole city, then roads on top of it. ---
  const base = new THREE.Mesh(new THREE.PlaneGeometry(440, 440), walkMat);
  base.rotation.x = -Math.PI / 2;
  base.position.set(0, 0, 0);
  base.receiveShadow = true;
  group.add(base);

  const roadGeoX = new THREE.PlaneGeometry(440, CITY.streetWidth);
  const roadGeoZ = new THREE.PlaneGeometry(CITY.streetWidth, 440);
  for (const z of LINES) {
    const road = new THREE.Mesh(roadGeoX, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.02, z);
    road.receiveShadow = true;
    group.add(road);
  }
  for (const x of LINES) {
    const road = new THREE.Mesh(roadGeoZ, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(x, 0.02, 0);
    road.receiveShadow = true;
    group.add(road);
  }

  // --- Beach and water on the south edge (z beyond 200). ---
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(440, 56), sandMat);
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.03, 228);
  sand.receiveShadow = true;
  group.add(sand);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(900, 300), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.01, 400);
  group.add(water);
  // The sea stops everything: no driving or walking into it.
  colliders.push({ minX: -450, maxX: 450, minZ: 252, maxZ: 560 });
  // The map edge stops everything too.
  colliders.push({ minX: -450, maxX: 450, minZ: -560, maxZ: -216 });
  colliders.push({ minX: -450, maxX: -216, minZ: -216, maxZ: 252 });
  colliders.push({ minX: 216, maxX: 450, minZ: -216, maxZ: 252 });

  // --- Named places: picked blocks that missions and shops use. ---
  const locations = {
    garage: { x: -175, z: 25, label: "Mara's Garage" },
    docks: { x: 175, z: 175, label: 'Marina Docks' },
    dealership: { x: 175, z: -175, label: 'Solara Motors' },
    bank: { x: -25, z: -175, label: 'Bay National Bank' },
    safehouse: { x: 175, z: -25, label: 'Safehouse' },
    spray: { x: 25, z: 75, label: 'Spray Shop' },
    gunshop: { x: 125, z: -75, label: 'Iron & Lead' },
    hospital: { x: -125, z: 75, label: 'St. Coral Hospital' },
    police: { x: -75, z: -125, label: 'Police HQ' },
    plaza: { x: 0, z: 0, label: 'Plaza del Sol' },
    beach: { x: -100, z: 225, label: 'Coral Beach' },
  };
  const locationBlocks = new Set(
    Object.values(locations).map((l) => `${Math.round((l.x + 200) / 50)},${Math.round((l.z + 200) / 50)}`),
  );

  // --- Blocks: one building, park, lot or plaza each. ---
  const palmGeo = new THREE.CylinderGeometry(0.18, 0.28, 5, 6);
  const palmTopGeo = new THREE.ConeGeometry(2.2, 3.2, 6);
  const lightPoleGeo = new THREE.CylinderGeometry(0.09, 0.12, 6, 6);
  const lightHeadGeo = new THREE.SphereGeometry(0.28, 8, 6);
  const parks = new Set();
  for (let n = 0; n < 7; n++) {
    parks.add(`${rng.int(0, 8)},${rng.int(0, 8)}`);
  }

  for (let j = 0; j < 9; j++) {
    for (let i = 0; i < 9; i++) {
      const cx = -200 + i * 50;
      const cz = -200 + j * 50;
      const blockKey = `${i},${j}`;
      if (blockKey === '4,4') {
        // Plaza del Sol: stone tiles, benches, palms.
        const plaza = new THREE.Mesh(new THREE.PlaneGeometry(36, 36), plazaMat);
        plaza.rotation.x = -Math.PI / 2;
        plaza.position.set(cx, 0.04, cz);
        plaza.receiveShadow = true;
        group.add(plaza);
        for (let p = 0; p < 4; p++) {
          const palm = new THREE.Group();
          const trunk = new THREE.Mesh(palmGeo, trunkMat);
          trunk.position.y = 2.5;
          const top = new THREE.Mesh(palmTopGeo, palmMat);
          top.position.y = 6;
          palm.add(trunk, top);
          palm.position.set(cx + (p % 2 === 0 ? -12 : 12), 0, cz + (p < 2 ? -12 : 12));
          group.add(palm);
        }
        continue;
      }
      if (parks.has(blockKey) && !locationBlocks.has(blockKey)) {
        const lawn = new THREE.Mesh(new THREE.PlaneGeometry(36, 36), grassMat);
        lawn.rotation.x = -Math.PI / 2;
        lawn.position.set(cx, 0.04, cz);
        lawn.receiveShadow = true;
        group.add(lawn);
        for (let p = 0; p < 5; p++) {
          const palm = new THREE.Group();
          const trunk = new THREE.Mesh(palmGeo, trunkMat);
          trunk.position.y = 2.5;
          const top = new THREE.Mesh(palmTopGeo, palmMat);
          top.position.y = 6;
          palm.add(trunk, top);
          palm.position.set(cx + rng.range(-14, 14), 0, cz + rng.range(-14, 14));
          group.add(palm);
        }
        continue;
      }
      // A building: footprint and height by district, taller downtown.
      const district = districtAt(cx, cz);
      const tall = district.tall;
      const w = rng.range(20, 30);
      const d = rng.range(20, 30);
      const h = tall ? rng.range(22, 58) : rng.range(6, 16);
      const mat = facadeMats[rng.int(0, facadeMats.length - 1)];
      const building = makeBox(w, h, d, mat);
      building.position.set(cx, h / 2, cz);
      group.add(building);
      const roof = makeBox(w + 0.6, 0.5, d + 0.6, roofMat);
      roof.position.set(cx, h + 0.25, cz);
      group.add(roof);
      colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
      // A coloured awning marks the named places.
      if (locationBlocks.has(blockKey)) {
        const awning = makeBox(8, 0.4, 3, new THREE.MeshStandardMaterial({ color: 0xff7a3c, roughness: 0.8 }));
        awning.position.set(cx, 3.4, cz - d / 2 - 1.2);
        group.add(awning);
      }
    }
  }

  // --- Streetlights at every other intersection, palms along the beach road. ---
  for (const node of nodes) {
    if ((node.x + node.z) % 100 !== 0) continue;
    const pole = new THREE.Mesh(lightPoleGeo, poleMat);
    pole.position.set(node.x + 8, 3, node.z + 8);
    const head = new THREE.Mesh(lightHeadGeo, lampMat);
    head.position.set(node.x + 8, 6.1, node.z + 8);
    group.add(pole, head);
  }
  for (let x = -190; x <= 190; x += 20) {
    const palm = new THREE.Group();
    const trunk = new THREE.Mesh(palmGeo, trunkMat);
    trunk.position.y = 2.5;
    const top = new THREE.Mesh(palmTopGeo, palmMat);
    top.position.y = 6;
    palm.add(trunk, top);
    palm.position.set(x, 0, 208);
    group.add(palm);
  }

  // --- Helpers the other systems use. ---
  function pointOnEdge(edge, t, laneSide) {
    const a = nodes[edge.a];
    const b = nodes[edge.b];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    const nx = -dz / len;
    const nz = dx / len;
    return {
      x: a.x + dx * t + nx * 3.5 * laneSide,
      z: a.z + dz * t + nz * 3.5 * laneSide,
      angle: Math.atan2(dx, dz),
    };
  }
  function nearestNode(x, z) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < nodes.length; i++) {
      const d = (nodes[i].x - x) ** 2 + (nodes[i].z - z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }
  function randomRoadPoint() {
    const edge = edges[rng.int(0, edges.length - 1)];
    return pointOnEdge(edge, rng.next(), rng.chance(0.5) ? 1 : -1);
  }
  function randomSidewalkPoint() {
    // A point on the pavement ring of a random block.
    const i = rng.int(0, 8);
    const j = rng.int(0, 8);
    const cx = -200 + i * 50;
    const cz = -200 + j * 50;
    const side = rng.int(0, 3);
    const along = rng.range(-15, 15);
    if (side === 0) return { x: cx + along, z: cz - 19 };
    if (side === 1) return { x: cx + along, z: cz + 19 };
    if (side === 2) return { x: cx - 19, z: cz + along };
    return { x: cx + 19, z: cz + along };
  }
  /** Push a circle (x, z, radius) out of every building collider it overlaps. */
  function resolveCircle(pos, radius) {
    for (const c of colliders) {
      const nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
      const nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
      const dx = pos.x - nx;
      const dz = pos.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          pos.x = nx + (dx / d) * radius;
          pos.z = nz + (dz / d) * radius;
        } else {
          // Dead centre of a collider: push out along the smallest penetration.
          const pl = pos.x - c.minX;
          const pr = c.maxX - pos.x;
          const pt = pos.z - c.minZ;
          const pb = c.maxZ - pos.z;
          const m = Math.min(pl, pr, pt, pb);
          if (m === pl) pos.x = c.minX - radius;
          else if (m === pr) pos.x = c.maxX + radius;
          else if (m === pt) pos.z = c.minZ - radius;
          else pos.z = c.maxZ + radius;
        }
      }
    }
  }

  return {
    group,
    colliders,
    nodes,
    edges,
    locations,
    water,
    bounds: { minX: -210, maxX: 210, minZ: -210, maxZ: 250 },
    pointOnEdge,
    nearestNode,
    randomRoadPoint,
    randomSidewalkPoint,
    resolveCircle,
    update(dt, time) {
      // The sea breathes: a slow swell on the water plane.
      water.position.y = 0.01 + Math.sin(time * 0.7) * 0.15;
    },
  };
}

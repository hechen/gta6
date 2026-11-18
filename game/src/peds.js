// Pedestrians: simple people who walk the sidewalks, chat, and flee when the
// player gets violent or the wanted level climbs.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { resolveCollider } from './city.js';

const SHIRT_COLORS = [0xd94f3d, 0x3d7dd9, 0x3dd97a, 0xd9b23d, 0x9e5ad9, 0xd97ab0, 0xeeeeee, 0x333333];
const PANTS_COLORS = [0x2b3a4a, 0x4a2b2b, 0x2b4a2b, 0x555555, 0x7a6a4a];

function buildPedMesh(shirt, pants, skin) {
  const g = new THREE.Group();
  const legMat = new THREE.MeshLambertMaterial({ color: pants });
  const bodyMat = new THREE.MeshLambertMaterial({ color: shirt });
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.22), legMat);
  legL.position.set(-0.14, 0.4, 0);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.22), legMat);
  legR.position.set(0.14, 0.4, 0);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.75, 0.34), bodyMat);
  torso.position.y = 1.18;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), skinMat);
  head.position.y = 1.75;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.16), bodyMat);
  armL.position.set(-0.4, 1.2, 0);
  const armR = armL.clone();
  armR.position.x = 0.4;
  g.add(legL, legR, torso, head, armL, armR);
  g.userData.legs = [legL, legR];
  g.userData.arms = [armL, armR];
  return g;
}

export function createPeds(world) {
  const { scene, rng, city } = world;
  const list = [];

  for (let i = 0; i < CONFIG.pedestrians; i++) {
    const p = city.randomSidewalkPoint();
    const mesh = buildPedMesh(rng.pick(SHIRT_COLORS), rng.pick(PANTS_COLORS), rng.pick([0xe8b98a, 0xc98d5f, 0x8a5a3a, 0xf0c8a0]));
    mesh.position.set(p.x, 0, p.z);
    scene.add(mesh);
    list.push({
      mesh, x: p.x, z: p.z,
      heading: rng.range(0, Math.PI * 2),
      speed: rng.range(1.2, 2.4),
      target: null,
      fleeing: false,
      walkPhase: rng.range(0, Math.PI * 2),
      dead: false,
    });
  }

  function pickTarget(ped) {
    const p = city.randomSidewalkPoint();
    ped.target = p;
  }

  return {
    list,
    update(dt) {
      const player = world.player;
      const threat = player.wanted > 0 || world.combat.firing;
      for (const ped of list) {
        if (ped.dead) continue;
        // Flee from the player when there is trouble.
        const dPlayer = Math.hypot(ped.x - player.x, ped.z - player.z);
        if (threat && dPlayer < 18) {
          ped.fleeing = true;
          const away = Math.atan2(ped.x - player.x, ped.z - player.z);
          ped.heading = away;
          ped.speed = 5;
        } else if (ped.fleeing && dPlayer > 30) {
          ped.fleeing = false;
          ped.speed = 1.8;
        }
        if (!ped.target || Math.hypot(ped.target.x - ped.x, ped.target.z - ped.z) < 2) {
          if (ped.fleeing) {
            ped.target = { x: ped.x + Math.sin(ped.heading) * 20, z: ped.z + Math.cos(ped.heading) * 20 };
          } else {
            pickTarget(ped);
          }
        }
        const dx = ped.target.x - ped.x, dz = ped.target.z - ped.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.1) {
          ped.heading = Math.atan2(dx, dz);
          const step = Math.min(ped.speed * dt, dist);
          const nx = ped.x + (dx / dist) * step;
          const nz = ped.z + (dz / dist) * step;
          const p = { x: nx, z: nz };
          resolveCollider(p, 0.5, city.colliders);
          ped.x = p.x; ped.z = p.z;
        }
        city.clampToCity(ped);
        // Walk cycle: swing legs and arms.
        ped.walkPhase += dt * ped.speed * 3;
        const swing = Math.sin(ped.walkPhase) * 0.5;
        ped.mesh.userData.legs[0].rotation.x = swing;
        ped.mesh.userData.legs[1].rotation.x = -swing;
        ped.mesh.userData.arms[0].rotation.x = -swing * 0.7;
        ped.mesh.userData.arms[1].rotation.x = swing * 0.7;
        ped.mesh.position.set(ped.x, 0, ped.z);
        ped.mesh.rotation.y = ped.heading;
      }
    },
    // A pedestrian is knocked down (used by combat / car hits).
    knockDown(ped) {
      ped.dead = true;
      ped.mesh.rotation.x = -Math.PI / 2;
      ped.mesh.position.y = 0.3;
    },
    nearest(x, z, radius = 3) {
      let best = null, bd = radius;
      for (const ped of list) {
        if (ped.dead) continue;
        const d = Math.hypot(ped.x - x, ped.z - z);
        if (d < bd) { bd = d; best = ped; }
      }
      return best;
    },
  };
}

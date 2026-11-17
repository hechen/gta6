// Pedestrians: simple figures in varied shirts who wander the sidewalks, queue at taxi
// stands, and run from gunfire, explosions and cars that come at them. A few carry the
// yellow taxi flag: pick them up for a fare.

import { PEDS } from './config.js';

const SHIRTS = [0xc23b2e, 0x2e6fc2, 0x3aa655, 0xe8b93c, 0x8a5fc2, 0xd8d8d8, 0x4fc3c2, 0xff7a3c];
const SKINS = [0xd9a066, 0xb97a4e, 0x8a5a34, 0xe8b98a];

function makeFigure(shirt, skin) {
  const group = new THREE.Group();
  const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.66, 0.3), mat(shirt));
  torso.position.y = 1.02;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.3), mat(skin));
  head.position.y = 1.56;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.68, 0.24), mat(0x2c3138));
  legL.position.set(-0.15, 0.34, 0);
  const legR = legL.clone();
  legR.position.x = 0.15;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.56, 0.2), mat(shirt));
  armL.position.set(-0.38, 1.02, 0);
  const armR = armL.clone();
  armR.position.x = 0.38;
  group.add(torso, head, legL, legR, armL, armR);
  group.traverse((m) => {
    if (m.isMesh) m.castShadow = true;
  });
  return { group, legL, legR, armL, armR };
}

export function createPeds(city, scene, rng) {
  const peds = [];

  function spawnPed(x, z, taxiFlag) {
    const { group, legL, legR, armL, armR } = makeFigure(
      SHIRTS[rng.int(0, SHIRTS.length - 1)],
      SKINS[rng.int(0, SKINS.length - 1)],
    );
    group.position.set(x, 0, z);
    scene.add(group);
    const ped = {
      mesh: group,
      legL,
      legR,
      armL,
      armR,
      x,
      z,
      heading: rng.angle(),
      speed: PEDS.walkSpeed * rng.range(0.8, 1.2),
      target: null,
      state: 'walk', // 'walk' | 'flee' | 'wait' | 'dead'
      fleeTimer: 0,
      taxi: !!taxiFlag,
      phase: rng.next() * 6,
      dead: false,
    };
    ped.target = city.randomSidewalkPoint();
    peds.push(ped);
    return ped;
  }

  function spawnInitial(count) {
    for (let i = 0; i < count; i++) {
      const p = city.randomSidewalkPoint();
      spawnPed(p.x, p.z, i < 3);
    }
  }

  /** Scare every ped within `radius` of (x, z): they run away from it. */
  function scare(x, z, radius) {
    for (const ped of peds) {
      if (ped.dead || ped.state === 'flee') continue;
      const d = Math.hypot(ped.x - x, ped.z - z);
      if (d < radius) {
        ped.state = 'flee';
        ped.fleeTimer = 2.5 + Math.random() * 2;
        ped.heading = Math.atan2(ped.x - x, ped.z - z);
      }
    }
  }

  function update(dt, world) {
    const player = world.player;
    for (const ped of peds) {
      if (ped.dead) continue;
      if (ped.state === 'flee') {
        ped.fleeTimer -= dt;
        const speed = 5.2;
        ped.x += Math.sin(ped.heading) * speed * dt;
        ped.z += Math.cos(ped.heading) * speed * dt;
        ped.phase += dt * speed * 1.8;
        if (ped.fleeTimer <= 0) {
          ped.state = 'walk';
          ped.target = city.randomSidewalkPoint();
        }
      } else if (ped.state === 'walk') {
        const dx = ped.target.x - ped.x;
        const dz = ped.target.z - ped.z;
        const d = Math.hypot(dx, dz);
        if (d < 1.2) {
          ped.target = city.randomSidewalkPoint();
        } else {
          const targetHeading = Math.atan2(dx, dz);
          let diff = targetHeading - ped.heading;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          ped.heading += diff * Math.min(1, dt * 6);
          ped.x += Math.sin(ped.heading) * ped.speed * dt;
          ped.z += Math.cos(ped.heading) * ped.speed * dt;
          ped.phase += dt * ped.speed * 1.8;
        }
      }
      // A car that hits a ped at speed knocks them down; the law notices.
      for (const car of world.vehicles.cars) {
        if (car.dead || Math.abs(car.speed) < 4) continue;
        if (Math.hypot(car.x - ped.x, car.z - ped.z) < 2.4) {
          ped.dead = true;
          ped.mesh.visible = false;
          world.effects.burst(ped.x, 1, ped.z, 8, 0xcc2222, 3, 0.6, 0.8);
          world.events.push({ type: 'pedDown', x: ped.x, z: ped.z });
          scare(ped.x, ped.z, 25);
          break;
        }
      }
      // A ped far from the player is recycled onto a sidewalk near them.
      if (Math.hypot(ped.x - player.x, ped.z - player.z) > 200) {
        const p = city.randomSidewalkPoint();
        ped.x = p.x;
        ped.z = p.z;
        ped.target = city.randomSidewalkPoint();
        ped.state = 'walk';
        ped.dead = false;
        ped.mesh.visible = true;
      }
      const pos = { x: ped.x, z: ped.z };
      city.resolveCircle(pos, 0.5);
      ped.x = pos.x;
      ped.z = pos.z;
      const swing = ped.state === 'flee' ? Math.sin(ped.phase) * 0.9 : Math.sin(ped.phase) * 0.55;
      ped.legL.rotation.x = swing;
      ped.legR.rotation.x = -swing;
      ped.armL.rotation.x = -swing * 0.7;
      ped.armR.rotation.x = swing * 0.7;
      ped.mesh.position.set(ped.x, 0, ped.z);
      ped.mesh.rotation.y = ped.heading;
    }
  }

  return { peds, spawnPed, spawnInitial, scare, update };
}

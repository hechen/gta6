// Combat: fists, pistol and SMG, hitscan shots with a tracer and muzzle flash, rival gang
// members who shoot back, and pickups for health, armour and ammo. Shooting near the law,
// or at all, is what brings the stars.

import { WEAPONS } from './config.js';

const GANG_SHIRTS = [0x7a1f1f, 0x4a1f7a, 0x1f4a2a];

export function createCombat(scene, rng) {
  const enemies = [];
  const pickups = [];
  const tracers = [];
  const tracerGeo = new THREE.BoxGeometry(0.06, 0.06, 1);
  const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9 });

  function makeEnemy(x, z) {
    const group = new THREE.Group();
    const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 });
    const shirt = GANG_SHIRTS[rng.int(0, GANG_SHIRTS.length - 1)];
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.32), mat(shirt));
    torso.position.y = 1.06;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.35, 0.31), mat(0xd9a066));
    head.position.y = 1.62;
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.7, 0.25), mat(0x22262c));
    legL.position.set(-0.16, 0.35, 0);
    const legR = legL.clone();
    legR.position.x = 0.16;
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.6, 0.21), mat(shirt));
    armL.position.set(-0.4, 1.06, 0);
    const armR = armL.clone();
    armR.position.x = 0.4;
    // The gun: a dark box held forward.
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.55), mat(0x14161a));
    gun.position.set(0.42, 1.15, 0.35);
    group.add(torso, head, legL, legR, armL, armR, gun);
    group.traverse((m) => {
      if (m.isMesh) m.castShadow = true;
    });
    group.position.set(x, 0, z);
    scene.add(group);
    const enemy = {
      mesh: group,
      legL,
      legR,
      x,
      z,
      heading: 0,
      health: 60,
      shootTimer: 1 + Math.random(),
      phase: 0,
      dead: false,
    };
    enemies.push(enemy);
    return enemy;
  }

  function spawnPickup(kind, x, z) {
    const colors = { health: 0x3aa655, armor: 0x2e6fc2, ammo: 0xe8b93c, cash: 0x2fae5a };
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.7, 0.7),
      new THREE.MeshStandardMaterial({ color: colors[kind] || 0xffffff, emissive: colors[kind] || 0xffffff, emissiveIntensity: 0.5, roughness: 0.4 }),
    );
    mesh.position.set(x, 0.8, z);
    mesh.castShadow = true;
    scene.add(mesh);
    const pickup = { mesh, kind, x, z, bob: Math.random() * 6 };
    pickups.push(pickup);
    return pickup;
  }

  function fireTracer(from, to) {
    const mesh = new THREE.Mesh(tracerGeo, tracerMat.clone());
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2, z: (from.z + to.z) / 2 };
    const len = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
    mesh.position.set(mid.x, mid.y, mid.z);
    mesh.scale.set(1, 1, len);
    mesh.lookAt(to.x, to.y, to.z);
    mesh.rotateX(Math.PI / 2);
    scene.add(mesh);
    tracers.push({ mesh, life: 0.09 });
  }

  /** Raycast against building colliders: the distance a shot travels before hitting a wall. */
  function wallDistance(x, z, dx, dz, maxDist, city) {
    let t = 0;
    const step = 0.5;
    while (t < maxDist) {
      t += step;
      const px = x + dx * t;
      const pz = z + dz * t;
      for (const c of city.colliders) {
        if (px > c.minX && px < c.maxX && pz > c.minZ && pz < c.maxZ) return t;
      }
    }
    return maxDist;
  }

  /** The player fires the current weapon toward the camera aim. Returns nothing; events carry the rest. */
  function playerShoot(world) {
    const player = world.player;
    const weapon = WEAPONS[player.weapon];
    if (!weapon || player.weapon === 'fists') return;
    if (player.ammo[player.weapon] <= 0) {
      world.audio.click();
      world.events.push({ type: 'message', text: 'Out of ammo — press R to reload', tone: 'bad' });
      return;
    }
    player.ammo[player.weapon] -= 1;
    const yaw = world.renderer.cam.yaw;
    const dx = -Math.sin(yaw) + (Math.random() - 0.5) * weapon.spread;
    const dz = -Math.cos(yaw) + (Math.random() - 0.5) * weapon.spread;
    const ox = player.car ? player.car.x : player.x;
    const oz = player.car ? player.car.z : player.z;
    const oy = player.car ? 1.4 : 1.5;
    const maxDist = wallDistance(ox, oz, dx, dz, weapon.range, world.city);
    let hitAt = maxDist;
    // Enemies, peds and cars in the line of fire, nearest first.
    let hitEnemy = null;
    let hitCar = null;
    for (const e of enemies) {
      if (e.dead) continue;
      const ex = e.x - ox;
      const ez = e.z - oz;
      const along = ex * dx + ez * dz;
      if (along < 0 || along > maxDist) continue;
      const perp = Math.abs(ex * dz - ez * dx);
      if (perp < 0.9 && along < hitAt) {
        hitAt = along;
        hitEnemy = e;
        hitCar = null;
      }
    }
    for (const car of world.vehicles.cars) {
      if (car.dead || car === player.car) continue;
      const ex = car.x - ox;
      const ez = car.z - oz;
      const along = ex * dx + ez * dz;
      if (along < 0 || along > maxDist) continue;
      const perp = Math.abs(ex * dz - ez * dx);
      if (perp < 1.6 && along < hitAt) {
        hitAt = along;
        hitCar = car;
        hitEnemy = null;
      }
    }
    const to = { x: ox + dx * hitAt, y: oy, z: oz + dz * hitAt };
    fireTracer({ x: ox, y: oy, z: oz }, to);
    world.effects.muzzle(ox + dx * 0.8, oy, oz + dz * 0.8, Math.atan2(dx, dz));
    world.audio.shot();
    world.renderer.addShake(0.12);
    if (hitEnemy) {
      hitEnemy.health -= weapon.damage;
      world.effects.burst(to.x, 1.2, to.z, 6, 0xcc2222, 3, 0.5, 0.7);
      if (hitEnemy.health <= 0) {
        hitEnemy.dead = true;
        hitEnemy.mesh.visible = false;
        world.events.push({ type: 'enemyDown', x: hitEnemy.x, z: hitEnemy.z });
      }
    } else if (hitCar) {
      hitCar.health -= weapon.damage;
      world.effects.burst(to.x, 1, to.z, 6, 0xffd24a, 4, 0.4, 0.7);
      if (hitCar.health <= 0) world.events.push({ type: 'carShot', car: hitCar });
    }
    world.peds.scare(ox, oz, 30);
    world.events.push({ type: 'shotFired', x: ox, z: oz });
  }

  function update(dt, world) {
    const player = world.player;
    // Enemy AI: face the player, strafe a little, and shoot with poor aim.
    for (const e of enemies) {
      if (e.dead) continue;
      const dx = player.x - e.x;
      const dz = player.z - e.z;
      const dist = Math.hypot(dx, dz);
      e.heading = Math.atan2(dx, dz);
      e.shootTimer -= dt;
      if (dist < 40 && e.shootTimer <= 0) {
        e.shootTimer = 0.9 + Math.random() * 0.8;
        const spread = 0.12;
        const sx = dx / dist + (Math.random() - 0.5) * spread;
        const sz = dz / dist + (Math.random() - 0.5) * spread;
        fireTracer({ x: e.x, y: 1.3, z: e.z }, { x: player.x, y: 1.2, z: player.z });
        world.effects.muzzle(e.x + sx, 1.3, e.z + sz, e.heading);
        world.audio.enemyShot();
        // One in three enemy shots lands.
        if (Math.random() < 0.34 && !player.car) {
          world.playerApi.hurt(9, world);
        } else if (Math.random() < 0.2 && player.car) {
          player.car.health -= 4;
        }
      }
      if (dist > 26) {
        e.x += Math.sin(e.heading) * 2.4 * dt;
        e.z += Math.cos(e.heading) * 2.4 * dt;
        e.phase += dt * 4;
      }
      const swing = Math.sin(e.phase) * 0.5;
      e.legL.rotation.x = swing;
      e.legR.rotation.x = -swing;
      e.mesh.position.set(e.x, 0, e.z);
      e.mesh.rotation.y = e.heading;
    }
    // Pickups bob, spin, and are collected on touch.
    for (const p of pickups) {
      p.bob += dt * 2;
      p.mesh.position.y = 0.8 + Math.sin(p.bob) * 0.15;
      p.mesh.rotation.y += dt * 1.5;
      const d = Math.hypot(p.x - player.x, p.z - player.z);
      if (d < 1.6 && !player.car) {
        world.events.push({ type: 'pickup', kind: p.kind, x: p.x, z: p.z });
        scene.remove(p.mesh);
        pickups.splice(pickups.indexOf(p), 1);
      }
    }
    for (const t of tracers) {
      t.life -= dt;
      if (t.life <= 0) {
        scene.remove(t.mesh);
        tracers.splice(tracers.indexOf(t), 1);
      }
    }
  }

  function clearEnemies() {
    for (const e of enemies) scene.remove(e.mesh);
    enemies.length = 0;
  }

  return { enemies, pickups, makeEnemy, spawnPickup, playerShoot, update, clearEnemies };
}

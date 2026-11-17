// The wanted system: stars from 0 to 5, police cars that chase and ram, foot cops that
// run the player down and bust them, and a cooldown that fades stars when the player stays
// unseen. Crimes are reported by the other systems as events; this one owns the response.

import { WANTED } from './config.js';

export function createPolice(city, scene, rng, vehicles) {
  const cops = []; // foot police {mesh, x, z, heading, state, bustTimer}
  let stars = 0;
  let unseenTimer = 0;
  let sirenTimer = 0;

  function setStars(n, world) {
    const next = Math.max(0, Math.min(WANTED.maxStars, n));
    if (next !== stars) {
      stars = next;
      unseenTimer = 0;
      world.events.push({ type: 'wanted', stars });
      if (stars > 0) world.audio.siren();
    }
  }
  function addStars(n, world) {
    setStars(stars + n, world);
  }

  function spawnFootCop(x, z) {
    const group = new THREE.Group();
    const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.32), mat(0x1c2f55));
    torso.position.y = 1.06;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.35, 0.31), mat(0xd9a066));
    head.position.y = 1.62;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.33), mat(0x10151c));
    cap.position.y = 1.84;
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.7, 0.25), mat(0x1c2f55));
    legL.position.set(-0.16, 0.35, 0);
    const legR = legL.clone();
    legR.position.x = 0.16;
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.6, 0.21), mat(0x1c2f55));
    armL.position.set(-0.4, 1.06, 0);
    const armR = armL.clone();
    armR.position.x = 0.4;
    group.add(torso, head, cap, legL, legR, armL, armR);
    group.traverse((m) => {
      if (m.isMesh) m.castShadow = true;
    });
    group.position.set(x, 0, z);
    scene.add(group);
    const cop = { mesh: group, legL, legR, x, z, heading: 0, state: 'chase', bustTimer: 0, phase: 0 };
    cops.push(cop);
    return cop;
  }

  function removeCop(cop) {
    scene.remove(cop.mesh);
    const i = cops.indexOf(cop);
    if (i >= 0) cops.splice(i, 1);
  }

  function policeCars() {
    return vehicles.cars.filter((c) => c.kind === 'police' && !c.dead);
  }

  /** Keep the right number of police cars on the road for the current stars. */
  function ensureCars(world) {
    const want = WANTED.carsPerStar[stars] || 0;
    const have = policeCars().length;
    for (let i = have; i < want; i++) {
      // Spawn on a road behind the player, out of direct sight.
      const p = city.randomRoadPoint();
      const car = vehicles.spawnCar('police', 0xf2f2f2, p.x, p.z, p.angle, 'police');
      car.speed = 10;
    }
    for (let i = have; i > want; i--) {
      const car = policeCars()[0];
      if (car) vehicles.removeCar(car);
    }
    const wantCops = WANTED.footCopsPerStar[stars] || 0;
    for (let i = cops.length; i < wantCops; i++) {
      const a = rng.angle();
      spawnFootCop(world.player.x + Math.sin(a) * 30, world.player.z + Math.cos(a) * 30);
    }
    for (let i = cops.length; i > wantCops; i--) removeCop(cops[0]);
  }

  function update(dt, world) {
    const player = world.player;
    // Stars fade after the player stays out of every cop's sight for a while.
    if (stars > 0) {
      let seen = false;
      for (const car of policeCars()) {
        if (Math.hypot(car.x - player.x, car.z - player.z) < 55) {
          seen = true;
          break;
        }
      }
      if (!seen) {
        for (const cop of cops) {
          if (Math.hypot(cop.x - player.x, cop.z - player.z) < 35) {
            seen = true;
            break;
          }
        }
      }
      if (seen) unseenTimer = 0;
      else {
        unseenTimer += dt;
        if (unseenTimer > WANTED.fadeDelay + (WANTED.maxStars - stars) * 0) {
          setStars(stars - 1, world);
          unseenTimer = WANTED.fadeDelay - WANTED.fadeStep;
          if (stars === 0) unseenTimer = 0;
        }
      }
    }
    ensureCars(world);

    // Police cars: steer toward the player, ram the player's car, and flash their lights.
    sirenTimer += dt;
    const flash = Math.floor(sirenTimer * 6) % 2 === 0;
    for (const car of policeCars()) {
      const dx = player.x - car.x;
      const dz = player.z - car.z;
      const dist = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(dx, dz);
      let diff = wantHeading - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, diff));
      const targetSpeed = dist > 8 ? 24 + stars * 2 : 8;
      car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.2);
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      if (car.lightBar) {
        car.lightBar.userData.red.material.emissiveIntensity = flash ? 2.5 : 0.2;
        car.lightBar.userData.blue.material.emissiveIntensity = flash ? 0.2 : 2.5;
      }
      // Ramming the player's car damages it; ramming the player on foot hurts them.
      if (player.car === car) continue;
      if (dist < 3.2 && Math.abs(car.speed) > 5) {
        if (player.car) {
          player.car.health -= 6;
          world.renderer.addShake(0.3);
          world.audio.crash();
        } else if (player.invulnerable <= 0) {
          world.playerApi.hurt(12, world);
          world.audio.crash();
        }
        car.speed *= 0.4;
      }
      if (dist > 260) {
        const p = city.randomRoadPoint();
        car.x = p.x;
        car.z = p.z;
      }
    }

    // Foot cops: run at the player, and bust them if they stay close.
    for (const cop of cops) {
      const dx = player.x - cop.x;
      const dz = player.z - cop.z;
      const dist = Math.hypot(dx, dz);
      if (player.car) {
        // On foot cops cannot catch a car: they hold position and watch.
        cop.bustTimer = 0;
      } else if (dist < WANTED.bustDistance) {
        cop.bustTimer += dt;
        if (cop.bustTimer > WANTED.bustTime) {
          world.events.push({ type: 'busted' });
          cop.bustTimer = 0;
        }
      } else {
        cop.bustTimer = 0;
        const wantHeading = Math.atan2(dx, dz);
        let diff = wantHeading - cop.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        cop.heading += diff * Math.min(1, dt * 8);
        const speed = 6.4;
        cop.x += Math.sin(cop.heading) * speed * dt;
        cop.z += Math.cos(cop.heading) * speed * dt;
        cop.phase += dt * speed * 1.8;
      }
      const swing = Math.sin(cop.phase) * 0.6;
      cop.legL.rotation.x = swing;
      cop.legR.rotation.x = -swing;
      const pos = { x: cop.x, z: cop.z };
      city.resolveCircle(pos, 0.5);
      cop.x = pos.x;
      cop.z = pos.z;
      cop.mesh.position.set(cop.x, 0, cop.z);
      cop.mesh.rotation.y = cop.heading;
    }
  }

  return {
    get stars() {
      return stars;
    },
    setStars,
    addStars,
    update,
    cops,
  };
}

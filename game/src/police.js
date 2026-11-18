// The wanted level and the Solara Bay police. Stars rise with crime; police
// cars spawn at the city edge, chase and ram the player, and a long touch on
// foot means busted. The spray shop wipes the heat for cash.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { buildCarMesh } from './vehicles.js';

export function createPolice(world) {
  const { scene, rng, city } = world;
  const police = {
    stars: 0,
    heat: 0,   // fractional heat; stars are whole numbers derived from it
    list: [],
    bustTimer: 0,
    heatTimer: 0,
  };

  function spawnPoliceCar() {
    // Spawn at a road point near the city edge, away from the player.
    let x = 0, z = 0;
    for (let tries = 0; tries < 12; tries++) {
      const p = city.randomRoadPoint();
      x = p.x; z = p.z;
      if (Math.hypot(p.x - world.player.x, p.z - world.player.z) > 60) break;
    }
    const mesh = buildCarMesh(0xf2f2f2, 'sedan');
    // Police livery: a black band and a light bar.
    const band = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.2, 4.25), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    band.position.y = 0.62;
    mesh.add(band);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    bar.position.set(0, 1.42, -0.2);
    mesh.add(bar);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    const car = { mesh, bar, x, z, heading: 0, speed: 0, targetSpeed: 26 + police.stars * 2 };
    police.list.push(car);
    return car;
  }

  function removePoliceCar(car) {
    scene.remove(car.mesh);
    const i = police.list.indexOf(car);
    if (i >= 0) police.list.splice(i, 1);
  }

  police.setStars = function (n) {
    // A direct set (missions, spray shop): heat and stars together.
    police.heat = Math.max(0, Math.min(CONFIG.maxStars, n));
    police.stars = Math.round(police.heat);
    world.player.wanted = police.stars;
    world.audio.siren(police.stars > 0);
    if (police.stars > 0) world.hud.message(`Wanted level ${police.stars} — lose them!`, 'bad');
  };

  police.addHeat = function (n) {
    // Fractional heat accumulates; a whole star tips only when heat crosses it.
    police.heat = Math.max(0, Math.min(CONFIG.maxStars, police.heat + n));
    const s = Math.floor(police.heat);
    if (s !== police.stars) {
      police.stars = s;
      world.player.wanted = s;
      world.audio.siren(s > 0);
      if (s > 0) world.hud.message(`Wanted level ${s} — lose them!`, 'bad');
    }
  };
  police.clearHeat = function () { police.setStars(0); };

  police.update = function (dt) {
    const player = world.player;
    // Keep the right number of police cars on the road.
    const want = police.stars === 0 ? 0 : Math.min(2 + police.stars, CONFIG.policeCars);
    while (police.list.length < want) spawnPoliceCar();
    while (police.list.length > want) removePoliceCar(police.list[police.list.length - 1]);

    // Heat decays when the player stays out of sight (no police near).
    if (police.stars > 0) {
      const nearest = police.list.reduce((m, c) => Math.min(m, Math.hypot(c.x - player.x, c.z - player.z)), Infinity);
      if (nearest > 70) {
        police.heatTimer += dt;
        if (police.heatTimer > 14) {
          police.heatTimer = 0;
          police.heat = Math.max(0, police.heat - 1);
          police.stars = Math.floor(police.heat);
          world.player.wanted = police.stars;
          world.audio.siren(police.stars > 0);
        }
      } else {
        police.heatTimer = 0;
      }
    }

    for (const car of police.list) {
      // Chase the player: steer toward them, ram at close range.
      const dx = player.x - car.x, dz = player.z - car.z;
      const dist = Math.hypot(dx, dz);
      const targetHeading = Math.atan2(dx, dz);
      let dh = targetHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      car.heading += Math.max(-2.2 * dt, Math.min(2.2 * dt, dh));
      car.speed = Math.min(car.targetSpeed, car.speed + 18 * dt);
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      city.clampToCity(car);
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      // Ram: damage the player or their car on contact.
      if (dist < 3.2) {
        if (player.car) {
          player.car.speed *= 0.6;
          if (Math.abs(player.car.speed) < 4) player.car.speed = -6;
          world.effects.sparks({ x: player.x, y: 1, z: player.z }, 6, 0xffcc33);
          world.audio.crash();
        } else {
          player.damage(80 * dt);
          // Busted: a police car touching the player on foot for a while.
          police.bustTimer += dt;
          if (police.bustTimer > CONFIG.bustTime) {
            police.bustTimer = 0;
            world.onBusted();
            return;
          }
        }
      } else {
        police.bustTimer = Math.max(0, police.bustTimer - dt);
      }
      // A police car that gets lost repositions near the player.
      if (dist > 200) {
        const p = city.randomRoadPoint();
        car.x = p.x; car.z = p.z;
      }
    }
    // Flashing light bar.
    const t = Math.floor(performance.now() / 300) % 2 === 0;
    for (const car of police.list) {
      car.bar.material.color.setHex(t ? 0xff2222 : 0x2244ff);
    }
  };

  return police;
}

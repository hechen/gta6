// The player: Leo, a driver-for-hire new to Solara Bay. On foot he walks and
// runs with a third-person camera; in a car he drives it. E steals and exits.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { resolveCollider } from './city.js';

export function createPlayer(world) {
  const { scene } = world;

  // Leo: dark jacket, jeans, cap.
  const group = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x2b3a4a });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x3a5a7a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b98a });
  const cap = new THREE.MeshLambertMaterial({ color: 0xc23b2e });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.85, 0.24), jeans);
  legL.position.set(-0.15, 0.42, 0);
  const legR = legL.clone(); legR.position.x = 0.15;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.8, 0.36), jacket);
  torso.position.y = 1.25;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), skin);
  head.position.y = 1.85;
  const capMesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.4), cap);
  capMesh.position.y = 2.06;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.72, 0.17), jacket);
  armL.position.set(-0.42, 1.25, 0);
  const armR = armL.clone(); armR.position.x = 0.42;
  group.add(legL, legR, torso, head, capMesh, armL, armR);
  group.userData.legs = [legL, legR];
  group.userData.arms = [armL, armR];
  scene.add(group);

  const start = world.city.blockCenter(4, 4);
  const player = {
    mesh: group,
    name: 'Leo',
    x: start.x, z: start.z,
    heading: 0,
    camYaw: Math.PI,
    camPitch: 0.35,
    camDist: 9,
    health: CONFIG.playerHealth,
    armor: CONFIG.playerArmor,
    money: CONFIG.startMoney,
    weapon: 'fists',
    ammo: { pistol: 0, smg: 0 },
    owned: { pistol: false, smg: false },
    car: null,
    dead: false,
    walkPhase: 0,
    wanted: 0,
  };

  function updateOnFoot(dt, input) {
    const run = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = run ? CONFIG.runSpeed : CONFIG.walkSpeed;
    const ax = input.axisX();
    const ay = input.axisY();
    // Movement is relative to the camera yaw.
    const sin = Math.sin(player.camYaw), cos = Math.cos(player.camYaw);
    let mx = (ax * cos - ay * sin);
    let mz = (ax * sin + ay * cos);
    const len = Math.hypot(mx, mz);
    if (len > 0.01) {
      mx /= len; mz /= len;
      const nx = player.x + mx * speed * dt;
      const nz = player.z + mz * speed * dt;
      const p = { x: nx, z: nz };
      resolveCollider(p, 0.5, world.city.colliders);
      player.x = p.x; player.z = p.z;
      player.heading = Math.atan2(mx, mz);
      player.walkPhase += dt * speed * 1.6;
    } else {
      player.walkPhase *= 0.9;
    }
    world.city.clampToCity(player);
    const swing = Math.sin(player.walkPhase) * 0.55;
    group.userData.legs[0].rotation.x = swing;
    group.userData.legs[1].rotation.x = -swing;
    group.userData.arms[0].rotation.x = -swing * 0.6;
    group.userData.arms[1].rotation.x = swing * 0.6;
    group.position.set(player.x, 0, player.z);
    group.rotation.y = player.heading;
    group.visible = true;
  }

  function updateCamera(dt, input) {
    const md = input.mouseDelta();
    player.camYaw -= md.x * 0.004;
    player.camPitch = Math.max(0.08, Math.min(1.1, player.camPitch + md.y * 0.003));
    player.camDist = Math.max(5, Math.min(16, player.camDist + input.wheelDelta() * 0.01));
    const cam = world.camera;
    let tx, tz, ty;
    if (player.car) {
      // Chase cam behind the car.
      const h = player.car.heading;
      tx = player.car.x - Math.sin(h) * 11;
      tz = player.car.z - Math.cos(h) * 11;
      ty = 5;
      cam.position.lerp(new THREE.Vector3(tx, ty, tz), 1 - Math.pow(0.001, dt));
      cam.lookAt(player.car.x, 1.5, player.car.z);
    } else {
      tx = player.x - Math.sin(player.camYaw) * Math.cos(player.camPitch) * player.camDist;
      tz = player.z - Math.cos(player.camYaw) * Math.cos(player.camPitch) * player.camDist;
      ty = 1.6 + Math.sin(player.camPitch) * player.camDist;
      cam.position.lerp(new THREE.Vector3(tx, ty, tz), 1 - Math.pow(0.0001, dt));
      cam.lookAt(player.x, 1.6, player.z);
    }
  }

  player.pos = function () { return new THREE.Vector3(player.x, 0, player.z); };

  player.update = function (dt, input) {
    if (player.dead) return;
    if (!player.car) updateOnFoot(dt, input);
    updateCamera(dt, input);
    if (player.health <= 0 && !player.dead) {
      player.dead = true;
      world.onWasted();
    }
  };

  // E: steal the nearest car, or get out of the current one.
  player.tryEnterExitCar = function () {
    if (player.car) {
      const car = player.car;
      player.car = null;
      player.x = car.x + Math.sin(car.heading + Math.PI / 2) * 2.5;
      player.z = car.z + Math.cos(car.heading + Math.PI / 2) * 2.5;
      player.heading = car.heading;
      group.position.set(player.x, 0, player.z);
      group.visible = true;
      return { action: 'exit', car };
    }
    const car = world.vehicles.nearestStealable(player.x, player.z, 5);
    if (car) {
      player.car = car;
      car.role = 'player';
      group.visible = false;
      world.audio.click();
      return { action: 'enter', car };
    }
    return null;
  };

  player.damage = function (amount) {
    let rest = amount;
    if (player.armor > 0) {
      const absorbed = Math.min(player.armor, rest * 0.6);
      player.armor -= absorbed;
      rest -= absorbed;
    }
    player.health -= rest;
    if (player.health <= 0) player.health = 0;
  };

  player.heal = function (amount) {
    player.health = Math.min(CONFIG.playerHealth, player.health + amount);
  };

  player.addMoney = function (n) {
    player.money += n;
    world.audio.cash();
  };

  return player;
}

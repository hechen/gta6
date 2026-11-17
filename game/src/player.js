// Leo Voss on foot: a simple articulated figure (torso, head, swinging arms and legs)
// that walks, sprints and jumps camera-relative, enters cars, and takes damage. The figure
// is built from boxes so it reads at a glance in the third-person camera and the minimap.

import { PLAYER } from './config.js';

const SKIN = 0xd9a066;
const SHIRT = 0x2e6fc2;
const PANTS = 0x2c3138;
const SHOES = 0x14161a;

export function createPlayerMesh() {
  const group = new THREE.Group();
  const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), mat(SHIRT));
  torso.position.y = 1.08;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.32), mat(SKIN));
  head.position.y = 1.66;
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.34), mat(0x1a1a1a));
  hair.position.y = 1.88;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.26), mat(PANTS));
  legL.position.set(-0.17, 0.36, 0);
  const legR = legL.clone();
  legR.position.x = 0.17;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.22), mat(SHIRT));
  armL.position.set(-0.42, 1.1, 0);
  const armR = armL.clone();
  armR.position.x = 0.42;
  group.add(torso, head, hair, legL, legR, armL, armR);
  group.traverse((m) => {
    if (m.isMesh) m.castShadow = true;
  });
  return { group, legL, legR, armL, armR, torso };
}

export function createPlayer(scene) {
  const { group, legL, legR, armL, armR } = createPlayerMesh();
  scene.add(group);
  const player = {
    mesh: group,
    x: 0,
    z: 0,
    y: 0,
    vy: 0,
    heading: Math.PI,
    speed: 0,
    health: PLAYER.maxHealth,
    armor: 0,
    money: 250,
    weapon: 'fists',
    ammo: { pistol: 0, smg: 0 },
    reserve: { pistol: 0, smg: 0 },
    car: null,
    onGround: true,
    invulnerable: 0,
    walkPhase: 0,
    dead: false,
  };

  function update(dt, world) {
    if (player.dead || player.car) return;
    const input = world.input;
    const move = input.move();
    const camYaw = world.renderer.cam.yaw;
    // Camera-relative movement: W walks away from the camera.
    let mx = 0;
    let mz = 0;
    if (move.forward !== 0 || move.strafe !== 0) {
      const fx = -Math.sin(camYaw);
      const fz = -Math.cos(camYaw);
      const rx = Math.cos(camYaw);
      const rz = -Math.sin(camYaw);
      mx = fx * move.forward + rx * move.strafe;
      mz = fz * move.forward + rz * move.strafe;
      const len = Math.hypot(mx, mz);
      mx /= len;
      mz /= len;
    }
    const speed = move.sprint ? PLAYER.sprintSpeed : move.forward !== 0 || move.strafe !== 0 ? PLAYER.runSpeed : 0;
    player.speed = speed;
    player.x += mx * speed * dt;
    player.z += mz * speed * dt;
    if (speed > 0) {
      const target = Math.atan2(mx, mz);
      let diff = target - player.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      player.heading += diff * Math.min(1, dt * PLAYER.turnSpeed);
      player.walkPhase += dt * speed * 1.6;
    }
    // Gravity and jumping.
    if (player.onGround && world.actions & 8) {
      player.vy = PLAYER.jumpSpeed;
      player.onGround = false;
    }
    player.vy -= 18 * dt;
    player.y += player.vy * dt;
    if (player.y <= 0) {
      player.y = 0;
      player.vy = 0;
      player.onGround = true;
    }
    // Stay out of the buildings and the sea.
    const pos = { x: player.x, z: player.z };
    world.city.resolveCircle(pos, PLAYER.radius);
    player.x = pos.x;
    player.z = pos.z;
    if (player.invulnerable > 0) player.invulnerable -= dt;
    // Walk cycle: legs and arms swing opposite, faster when sprinting.
    const swing = speed > 0 ? Math.sin(player.walkPhase) * 0.7 : 0;
    legL.rotation.x = swing;
    legR.rotation.x = -swing;
    armL.rotation.x = -swing * 0.8;
    armR.rotation.x = swing * 0.8;
    group.position.set(player.x, player.y, player.z);
    group.rotation.y = player.heading;
    group.visible = true;
  }

  function hurt(amount, world) {
    if (player.invulnerable > 0 || player.dead) return;
    let left = amount;
    if (player.armor > 0) {
      const absorbed = Math.min(player.armor, left);
      player.armor -= absorbed;
      left -= absorbed;
    }
    player.health -= left;
    player.invulnerable = 0.4;
    world.renderer.addShake(0.35);
    if (player.health <= 0) {
      player.health = 0;
      player.dead = true;
      world.events.push({ type: 'wasted' });
    }
  }

  function heal(amount) {
    player.health = Math.min(PLAYER.maxHealth, player.health + amount);
  }

  return { player, update, hurt, heal };
}

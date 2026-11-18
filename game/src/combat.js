// Combat: fists, the P9 pistol and the Vex SMG, plus the rivals who shoot back
// and the gun shop that sells them. Shooting is a raycast from the camera.

import * as THREE from 'three';
import { CONFIG, WEAPONS } from './config.js';

export function createCombat(world) {
  const { scene, rng } = world;
  const combat = {
    enemies: [],
    firing: false,
    lastShot: 0,
    shopOpen: false,
  };

  const raycaster = new THREE.Raycaster();

  function buildEnemyMesh() {
    const g = new THREE.Group();
    const jacket = new THREE.MeshLambertMaterial({ color: 0x8a2a2a });
    const pants = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const skin = new THREE.MeshLambertMaterial({ color: 0xc98d5f });
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.85, 0.24), pants);
    legL.position.set(-0.15, 0.42, 0);
    const legR = legL.clone(); legR.position.x = 0.15;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.8, 0.36), jacket);
    torso.position.y = 1.25;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), skin);
    head.position.y = 1.85;
    // A visible gun in the hands.
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.5), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    gun.position.set(0.3, 1.3, 0.35);
    g.add(legL, legR, torso, head, gun);
    g.userData.legs = [legL, legR];
    return g;
  }

  combat.spawnEnemy = function (x, z) {
    const mesh = buildEnemyMesh();
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    const e = {
      mesh, x, z, heading: 0,
      health: CONFIG.enemyHealth,
      dead: false,
      shootTimer: rng.range(1, 2),
      walkPhase: 0,
    };
    combat.enemies.push(e);
    return e;
  };

  function killEnemy(e) {
    e.dead = true;
    e.mesh.rotation.x = -Math.PI / 2;
    e.mesh.position.y = 0.3;
    world.effects.sparks({ x: e.x, y: 1, z: e.z }, 14, 0xff4444);
    world.audio.crash();
    world.police.addHeat(1);
  }

  // Shoot from the camera through the screen centre.
  combat.shoot = function () {
    const player = world.player;
    const w = WEAPONS[player.weapon];
    const now = performance.now() / 1000;
    if (now - combat.lastShot < w.rate) return;
    combat.lastShot = now;
    combat.firing = true;
    world.audio.gunshot();
    // Muzzle flash at the camera.
    const cam = world.camera;
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    const origin = cam.position.clone();
    world.effects.muzzle(origin.clone().addScaledVector(dir, 1.2), dir);
    if (player.weapon === 'fists') {
      // A short punch: hurt the nearest ped or enemy in front.
      const target = world.peds.nearest(player.x, player.z, 3) || combat.enemies.find((e) => !e.dead && Math.hypot(e.x - player.x, e.z - player.z) < 3);
      if (target) {
        world.audio.punch();
        if (target.health !== undefined) {
          target.health -= w.damage;
          if (target.health <= 0) killEnemy(target);
        } else {
          world.peds.knockDown(target);
          world.police.addHeat(1);
        }
      }
      return;
    }
    // Ranged: consume ammo, raycast against enemies and pedestrians.
    if (player.ammo[player.weapon] <= 0) {
      world.hud.message('Out of ammo — visit the gun shop', 'bad');
      return;
    }
    player.ammo[player.weapon]--;
    raycaster.set(origin, dir);
    raycaster.far = w.range;
    const targets = [];
    for (const e of combat.enemies) if (!e.dead) targets.push(e.mesh);
    for (const p of world.peds.list) if (!p.dead) targets.push(p.mesh);
    const hits = raycaster.intersectObjects(targets, true);
    if (hits.length > 0) {
      const hit = hits[0];
      let obj = hit.object;
      while (obj.parent && obj.parent !== scene) obj = obj.parent;
      const enemy = combat.enemies.find((e) => e.mesh === obj);
      const ped = world.peds.list.find((p) => p.mesh === obj);
      world.effects.sparks(hit.point, 8, 0xffcc33);
      if (enemy) {
        enemy.health -= w.damage;
        if (enemy.health <= 0) killEnemy(enemy);
      } else if (ped) {
        world.peds.knockDown(ped);
        world.police.addHeat(1);
      }
    }
    // Shooting in public draws heat.
    world.police.addHeat(0.5);
  };

  combat.update = function (dt) {
    combat.firing = false;
    const player = world.player;
    for (const e of combat.enemies) {
      if (e.dead) continue;
      const dx = player.x - e.x, dz = player.z - e.z;
      const dist = Math.hypot(dx, dz);
      e.heading = Math.atan2(dx, dz);
      // Close in to shooting range, then stand and fire.
      if (dist > 14) {
        const step = 4.5 * dt;
        e.x += (dx / dist) * step;
        e.z += (dz / dist) * step;
        e.walkPhase += dt * 8;
        const swing = Math.sin(e.walkPhase) * 0.5;
        e.mesh.userData.legs[0].rotation.x = swing;
        e.mesh.userData.legs[1].rotation.x = -swing;
      } else {
        e.shootTimer -= dt;
        if (e.shootTimer <= 0) {
          e.shootTimer = rng.range(0.9, 1.6);
          world.audio.gunshot();
          world.effects.muzzle(new THREE.Vector3(e.x, 1.4, e.z), new THREE.Vector3(dx / dist, 0, dz / dist));
          // Enemies are bad shots: they hit sometimes.
          if (Math.random() < 0.35) {
            player.damage(7);
            world.hud.flashDamage();
          }
        }
      }
      e.mesh.position.set(e.x, 0, e.z);
      e.mesh.rotation.y = e.heading;
    }
  };

  // The gun shop: press E near the marker to buy.
  combat.tryShop = function () {
    const s = world.city.markers.gunshop;
    const player = world.player;
    if (Math.hypot(s.x - player.x, s.z - player.z) > 7) return false;
    combat.shopOpen = !combat.shopOpen;
    if (combat.shopOpen) world.hud.showShop();
    else world.hud.hideShop();
    return true;
  };

  combat.buy = function (item) {
    const player = world.player;
    if (item === 'pistol' || item === 'smg') {
      const price = CONFIG.gunPrices[item];
      if (player.owned[item]) { world.hud.message('You already own that', 'info'); return; }
      if (player.money < price) { world.hud.message('Not enough cash', 'bad'); return; }
      player.money -= price;
      player.owned[item] = true;
      player.ammo[item] = WEAPONS[item].ammo;
      player.weapon = item;
      world.hud.message(`Bought the ${WEAPONS[item].name} — $${price}`, 'good');
      world.audio.cash();
    } else if (item === 'ammo') {
      const w = player.weapon;
      if (w === 'fists') { world.hud.message('Buy a gun first', 'info'); return; }
      if (player.money < CONFIG.ammoPrice) { world.hud.message('Not enough cash', 'bad'); return; }
      player.money -= CONFIG.ammoPrice;
      player.ammo[w] += WEAPONS[w].ammo;
      world.hud.message(`Ammo restocked — $${CONFIG.ammoPrice}`, 'good');
      world.audio.cash();
    } else if (item === 'armor') {
      if (player.money < 100) { world.hud.message('Not enough cash', 'bad'); return; }
      player.money -= 100;
      player.armor = CONFIG.playerArmor;
      world.hud.message('Armor restored — $100', 'good');
      world.audio.cash();
    }
  };

  combat.switchWeapon = function () {
    const player = world.player;
    const order = ['fists', 'pistol', 'smg'].filter((w) => w === 'fists' || player.owned[w]);
    const i = order.indexOf(player.weapon);
    player.weapon = order[(i + 1) % order.length];
    world.hud.message(`Weapon: ${WEAPONS[player.weapon].name}`, 'info');
  };

  return combat;
}

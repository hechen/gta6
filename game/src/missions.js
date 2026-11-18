// The story: six missions, plus the free-roam activities (taxi fares and hidden
// packages) that keep paying between jobs. A mission is a small state machine;
// the HUD shows its objective and the world shows its target marker.

import * as THREE from 'three';
import { CONFIG, MISSIONS } from './config.js';

export function createMissions(world) {
  const { scene, rng, city } = world;

  // A floating target marker: a ring on the ground and a light beam.
  function makeTargetMarker(color) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.6, 3.4, 24),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }),
    );
    ring.rotation.x = -Math.PI / 2;
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, 16, 8, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
    );
    ring.visible = false; beam.visible = false;
    scene.add(ring, beam);
    return {
      ring, beam,
      set(x, z) {
        ring.visible = true; beam.visible = true;
        ring.position.set(x, 0.09, z);
        beam.position.set(x, 8, z);
      },
      hide() { ring.visible = false; beam.visible = false; },
    };
  }

  const marker = makeTargetMarker(0x2fd6a3);

  // Hidden packages: ten glowing cases stashed around the city.
  const packages = [];
  {
    const geo = new THREE.BoxGeometry(0.9, 0.6, 0.9);
    const mat = new THREE.MeshBasicMaterial({ color: 0x2fd6a3 });
    for (let i = 0; i < CONFIG.packageCount; i++) {
      const p = city.randomSidewalkPoint();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(p.x, 0.5, p.z);
      scene.add(mesh);
      packages.push({ mesh, x: p.x, z: p.z, taken: false });
    }
  }

  const missions = {
    index: 0,            // next mission to start
    active: null,        // current mission definition + progress
    completed: 0,
    packagesTaken: 0,
    faresDone: 0,
    // Taxi fare state.
    fare: null,
    fareCooldown: 0,
  };

  function startMission(i) {
    const def = MISSIONS[i];
    if (!def) return;
    missions.active = { def, progress: 0, stage: 0, timer: 0, target: null, enemies: [] };
    world.hud.showBriefing(def.title, def.brief);
    world.hud.setObjective(def.objective);
    world.audio.mission();
    if (def.type === 'steal') marker.set(city.markers.garage.x, city.markers.garage.z);
    if (def.type === 'shootout') spawnRivals();
    if (def.type === 'heat') { world.police.setStars(3); }
    if (def.type === 'heist') marker.set(city.markers.bank.x, city.markers.bank.z);
    if (def.type === 'taxi') startFare();
  }

  function spawnRivals() {
    const docks = city.blockCenter(7, 0);
    const spots = [
      { x: docks.x - 8, z: docks.z + 6 },
      { x: docks.x + 6, z: docks.z - 4 },
      { x: docks.x + 2, z: docks.z + 12 },
    ];
    for (const s of spots) {
      const e = world.combat.spawnEnemy(s.x, s.z);
      missions.active.enemies.push(e);
    }
    marker.set(docks.x, docks.z);
  }

  function completeMission() {
    const m = missions.active;
    const reward = CONFIG.missionReward[m.def.id] || 500;
    world.player.addMoney(reward);
    world.hud.message(`Mission complete: ${m.def.title} — $${reward}`, 'good');
    world.audio.mission();
    missions.completed++;
    missions.index++;
    missions.active = null;
    marker.hide();
    if (missions.index < MISSIONS.length) {
      setTimeout(() => startMission(missions.index), 2500);
    } else {
      world.hud.showBriefing('Solara Bay is yours', 'Every job is done. The city is yours now, Leo — free roam, earn, and enjoy the sun.');
      world.hud.setObjective('Free roam — the city is yours');
    }
  }

  // --- Taxi fares.
  function startFare() {
    const p = city.randomRoadPoint();
    missions.fare = { stage: 'pickup', x: p.x, z: p.z, dest: null };
    marker.set(p.x, p.z);
    world.hud.message('Taxi fare: pick up the passenger', 'info');
  }

  function fareDestination() {
    const p = city.randomRoadPoint();
    missions.fare.stage = 'dropoff';
    missions.fare.dest = p;
    marker.set(p.x, p.z);
    world.hud.message('Taxi fare: take them to the destination', 'info');
  }

  function finishFare() {
    world.player.addMoney(CONFIG.taxiFare);
    world.hud.message(`Fare complete — $${CONFIG.taxiFare}`, 'good');
    missions.faresDone++;
    missions.fare = null;
    marker.hide();
    if (missions.active && missions.active.def.type === 'taxi') {
      missions.active.progress = missions.faresDone;
      if (missions.faresDone >= 3) { missions.faresDone = 0; completeMission(); }
      else startFare();
    } else {
      missions.fareCooldown = 8;
    }
  }

  missions.startMission = startMission;
  missions.completeMission = completeMission;

  missions.update = function (dt) {
    const player = world.player;
    // Hidden packages: collect by proximity.
    for (const pk of packages) {
      if (pk.taken) continue;
      if (Math.hypot(pk.x - player.x, pk.z - player.z) < 3) {
        pk.taken = true;
        pk.mesh.visible = false;
        missions.packagesTaken++;
        world.player.addMoney(CONFIG.packageReward);
        world.audio.pickup();
        world.hud.message(`Hidden package found (${missions.packagesTaken}/${CONFIG.packageCount}) — $${CONFIG.packageReward}`, 'good');
        world.effects.sparks({ x: pk.x, y: 1, z: pk.z }, 10, 0x2fd6a3);
      }
    }
    // Taxi fare progress.
    if (missions.fare) {
      const f = missions.fare;
      const tx = f.stage === 'pickup' ? f.x : f.dest.x;
      const tz = f.stage === 'pickup' ? f.z : f.dest.z;
      if (Math.hypot(tx - player.x, tz - player.z) < (f.stage === 'pickup' ? 4 : 6)) {
        if (f.stage === 'pickup') fareDestination();
        else finishFare();
      }
    } else if (!missions.active || missions.active.def.type !== 'taxi') {
      // Free-roam fares appear when the player is driving.
      missions.fareCooldown -= dt;
      if (player.car && missions.fareCooldown <= 0) startFare();
    }

    const m = missions.active;
    if (!m) return;
    const d = (x, z) => Math.hypot(x - player.x, z - player.z);
    if (m.def.type === 'steal') {
      if (player.car && d(city.markers.garage.x, city.markers.garage.z) < 7) completeMission();
    } else if (m.def.type === 'shootout') {
      const alive = m.enemies.filter((e) => !e.dead).length;
      if (alive === 0 && m.stage === 0) {
        m.stage = 1;
        const docks = city.blockCenter(7, 0);
        marker.set(docks.x + 4, docks.z + 2);
        world.hud.message('Rivals down — grab the briefcase', 'info');
        m.target = { x: docks.x + 4, z: docks.z + 2 };
      }
      if (m.stage === 1 && m.target && d(m.target.x, m.target.z) < 3) completeMission();
    } else if (m.def.type === 'packages') {
      if (missions.packagesTaken >= 5) completeMission();
    } else if (m.def.type === 'heat') {
      if (world.police.stars === 0) completeMission();
    } else if (m.def.type === 'heist') {
      if (m.stage === 0) {
        if (d(city.markers.bank.x, city.markers.bank.z) < 7) {
          m.stage = 1;
          world.police.setStars(4);
          world.hud.message('Vault cracked — $2,000! Lose the tail and reach the safehouse', 'bad');
          marker.set(city.markers.safehouse.x, city.markers.safehouse.z);
        }
      } else if (d(city.markers.safehouse.x, city.markers.safehouse.z) < 7) {
        world.player.addMoney(2000);
        completeMission();
      }
    }
  };

  // Animate the target marker (pulse).
  missions.animateMarker = function (t) {
    if (marker.ring.visible) {
      const s = 1 + Math.sin(t * 4) * 0.12;
      marker.ring.scale.setScalar(s);
    }
    for (const pk of packages) {
      if (!pk.taken) {
        pk.mesh.rotation.y += 0.02;
        pk.mesh.position.y = 0.5 + Math.sin(t * 2 + pk.x) * 0.15;
      }
    }
  };

  return missions;
}

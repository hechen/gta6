// The story of Leo Voss and the jobs Mara Quinn sends him on: six missions with steps
// (steal, drive, survive, shoot, grab, deliver), plus taxi fares and ten hidden packages
// for money between jobs. A mission is a list of steps; finishing one pays out, saves the
// game, and unlocks the next. Failing a timed step restarts that mission.

import { MONEY } from './config.js';

const REWARDS = [300, 500, 700, 800, 1200, 2000];

function step(kind, x, z, label, extra = {}) {
  return { kind, x, z, label, radius: 6, ...extra };
}

export function createMissions(city, scene, rng, combat) {
  const L = city.locations;
  const missions = [
    {
      name: 'Wheels Up',
      brief: "Mara Quinn needs a wheelman. Steal a car — any car — and bring it to her garage.",
      steps: [
        step('steal', 0, 0, 'Steal a car'),
        step('goto', L.garage.x, L.garage.z, "Drive to Mara's Garage"),
      ],
    },
    {
      name: 'The Pickup',
      brief: 'A package is waiting at the Marina docks. Collect it, then run it to the safehouse — fast.',
      steps: [
        step('goto', L.docks.x, L.docks.z, 'Collect the package at the docks'),
        step('goto', L.safehouse.x, L.safehouse.z, 'Deliver to the safehouse', { time: 100 }),
      ],
    },
    {
      name: 'Repo Man',
      brief: 'A sports car at Solara Motors has a missed payment. Take it. The law will notice.',
      steps: [
        step('stealStyle', L.dealership.x, L.dealership.z, 'Steal the target sports car', { style: 'sports', wanted: 2 }),
        step('goto', L.garage.x, L.garage.z, "Bring it to Mara's Garage"),
      ],
    },
    {
      name: 'Hot Pursuit',
      brief: 'Three stars and the whole department behind you. Stay free for a minute, then lose them at the spray shop.',
      steps: [
        step('survive', 0, 0, 'Survive the pursuit', { seconds: 60, wanted: 3 }),
        step('goto', L.spray.x, L.spray.z, 'Lose the heat at the spray shop'),
      ],
    },
    {
      name: 'Dockside',
      brief: 'The Vipers took the docks. Clear them out, grab the briefcase, and bring it home.',
      steps: [
        step('kill', L.docks.x, L.docks.z, 'Clear the docks', { count: 4, spawn: true }),
        step('grab', L.docks.x, L.docks.z, 'Grab the briefcase', { seconds: 3 }),
        step('goto', L.garage.x, L.garage.z, "Deliver the briefcase to Mara's Garage"),
      ],
    },
    {
      name: 'The Big One',
      brief: 'Bay National Bank, noon, one bag. Grab the cash and get to the safehouse — the city will be looking.',
      steps: [
        step('goto', L.bank.x, L.bank.z, 'Reach the bank'),
        step('grab', L.bank.x, L.bank.z, 'Grab the cash', { seconds: 5, wanted: 4 }),
        step('goto', L.safehouse.x, L.safehouse.z, 'Escape to the safehouse'),
      ],
    },
  ];

  // The objective beacon: a pillar of light and a floating diamond over the target.
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.25, depthWrite: false });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 60, 12, 1, true), beaconMat);
  beacon.position.y = 30;
  beacon.visible = false;
  scene.add(beacon);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.9),
    new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.95 }),
  );
  diamond.visible = false;
  scene.add(diamond);

  // Ten hidden packages across the city, worth $150 each.
  const packages = [];
  for (let i = 0; i < 10; i++) {
    const p = city.randomSidewalkPoint();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.7, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x2fae5a, emissive: 0x2fae5a, emissiveIntensity: 0.6, roughness: 0.4 }),
    );
    mesh.position.set(p.x, 0.8, p.z);
    mesh.castShadow = true;
    scene.add(mesh);
    packages.push({ mesh, x: p.x, z: p.z, found: false, bob: Math.random() * 6 });
  }

  const state = {
    index: 0, // the mission the player is on; -1 when the story is done
    stepIndex: 0,
    active: false,
    timer: 0,
    surviveLeft: 0,
    killCount: 0,
    grabProgress: 0,
    targetCar: null,
    taxi: null, // {ped, destX, destZ, timer, fare}
    taxiCooldown: 0,
    packagesFound: 0,
  };

  function currentMission() {
    return state.index >= 0 && state.index < missions.length ? missions[state.index] : null;
  }
  function currentStep() {
    const m = currentMission();
    return m ? m.steps[state.stepIndex] : null;
  }

  function say(world, text, tone = 'info') {
    world.events.push({ type: 'message', text, tone });
  }

  function startMission(index, world) {
    state.index = index;
    state.stepIndex = 0;
    state.active = true;
    state.timer = 0;
    state.surviveLeft = 0;
    state.killCount = 0;
    state.grabProgress = 0;
    state.targetCar = null;
    const m = missions[index];
    say(world, `Mission: ${m.name} — ${m.brief}`, 'mission');
    world.audio.mission();
    beginStep(world);
  }

  function beginStep(world) {
    const s = currentStep();
    if (!s) {
      completeMission(world);
      return;
    }
    if (s.kind === 'stealStyle') {
      state.targetCar = world.vehicles.spawnCar(s.style, 0xc23b2e, s.x, s.z, 0, 'mission');
      state.targetCar.health = 100;
    }
    if (s.kind === 'kill' && s.spawn) {
      for (let i = 0; i < s.count; i++) {
        const a = (i / s.count) * Math.PI * 2;
        combat.makeEnemy(s.x + Math.sin(a) * 8, s.z + Math.cos(a) * 8);
      }
    }
    if (s.kind === 'survive') {
      state.surviveLeft = s.seconds;
      world.police.setStars(s.wanted || 3, world);
    }
    if (s.kind === 'grab' && s.wanted) {
      world.police.setStars(s.wanted, world);
    }
    if (s.kind === 'stealStyle' && s.wanted) {
      // The stars come when the car is actually taken, not before.
    }
    state.timer = s.time || 0;
    state.grabProgress = 0;
    updateBeacon();
  }

  function updateBeacon() {
    const s = currentStep();
    const tx = state.taxi;
    if (tx) {
      beacon.visible = true;
      diamond.visible = true;
      beacon.position.x = tx.destX;
      beacon.position.z = tx.destZ;
      diamond.position.set(tx.destX, 6, tx.destZ);
      return;
    }
    if (!state.active || !s || s.kind === 'steal' || s.kind === 'survive') {
      beacon.visible = false;
      diamond.visible = false;
      return;
    }
    const x = s.kind === 'stealStyle' && state.targetCar ? state.targetCar.x : s.x;
    const z = s.kind === 'stealStyle' && state.targetCar ? state.targetCar.z : s.z;
    beacon.visible = true;
    diamond.visible = true;
    beacon.position.x = x;
    beacon.position.z = z;
    diamond.position.set(x, 6, z);
  }

  function advance(world) {
    state.stepIndex += 1;
    world.audio.objective();
    beginStep(world);
  }

  function completeMission(world) {
    const m = missions[state.index];
    const reward = REWARDS[state.index] || 500;
    world.player.money += reward;
    world.stats.missionsDone += 1;
    say(world, `${m.name} complete — +$${reward}`, 'good');
    world.audio.win();
    world.effects.floatText(`+$${reward}`, world.player.x, 3, world.player.z, '#7dff8a');
    state.active = false;
    beacon.visible = false;
    diamond.visible = false;
    world.events.push({ type: 'missionComplete', index: state.index });
    if (state.index + 1 < missions.length) {
      state.index += 1;
      state.stepIndex = 0;
    } else {
      state.index = -1;
      say(world, 'Story complete — you are the King of Solara Bay. Free roam is yours.', 'good');
      world.events.push({ type: 'storyComplete' });
    }
  }

  function failMission(world, reason) {
    say(world, `Mission failed: ${reason}. Starting ${missions[state.index].name} over.`, 'bad');
    world.audio.fail();
    if (state.targetCar) {
      world.vehicles.removeCar(state.targetCar);
      state.targetCar = null;
    }
    combat.clearEnemies();
    startMission(state.index, world);
  }

  function onEvent(ev, world) {
    if (!state.active) return;
    const s = currentStep();
    if (!s) return;
    if (ev.type === 'carStolen') {
      if (s.kind === 'steal') advance(world);
      else if (s.kind === 'stealStyle' && ev.car === state.targetCar) {
        if (s.wanted) world.police.setStars(s.wanted, world);
        advance(world);
      }
    }
    if (ev.type === 'enemyDown' && s.kind === 'kill') {
      state.killCount += 1;
      if (state.killCount >= s.count) advance(world);
    }
  }

  function update(dt, world) {
    const player = world.player;
    // The beacon's diamond bobs.
    if (diamond.visible) {
      diamond.position.y = 6 + Math.sin(world.time * 2.4) * 0.6;
      diamond.rotation.y += dt * 1.5;
    }
    // Hidden packages bob and are collected on foot.
    for (const p of packages) {
      if (p.found) continue;
      p.bob += dt * 2;
      p.mesh.position.y = 0.8 + Math.sin(p.bob) * 0.15;
      p.mesh.rotation.y += dt;
      if (!player.car && Math.hypot(p.x - player.x, p.z - player.z) < 1.8) {
        p.found = true;
        p.mesh.visible = false;
        state.packagesFound += 1;
        player.money += MONEY.packageValue;
        say(world, `Hidden package found (${state.packagesFound}/10) — +$${MONEY.packageValue}`, 'good');
        world.audio.pickup();
        world.effects.floatText(`+$${MONEY.packageValue}`, p.x, 2.5, p.z, '#7dff8a');
      }
    }
    // Taxi fares: a flagged ped near a slow car becomes a passenger.
    state.taxiCooldown = Math.max(0, state.taxiCooldown - dt);
    if (!state.taxi && state.taxiCooldown <= 0 && player.car) {
      for (const ped of world.peds.peds) {
        if (!ped.taxi || ped.dead) continue;
        if (Math.hypot(ped.x - player.x, ped.z - player.z) < 8 && Math.abs(player.car.speed) < 3) {
          const dest = city.randomRoadPoint();
          state.taxi = { ped, destX: dest.x, destZ: dest.z, timer: 75, fare: 60 + rng.int(0, 4) * 10 };
          ped.state = 'wait';
          say(world, `Taxi fare: take them to the marker — $${state.taxi.fare} if you're quick`, 'mission');
          updateBeacon();
          break;
        }
      }
    }
    if (state.taxi) {
      const tx = state.taxi;
      tx.timer -= dt;
      const d = Math.hypot(tx.destX - player.x, tx.destZ - player.z);
      if (d < 7) {
        player.money += tx.fare;
        world.stats.fares += 1;
        say(world, `Fare complete — +$${tx.fare}`, 'good');
        world.audio.win();
        tx.ped.state = 'walk';
        tx.ped.target = city.randomSidewalkPoint();
        state.taxi = null;
        state.taxiCooldown = 20;
        updateBeacon();
      } else if (tx.timer <= 0) {
        say(world, 'The passenger gave up and walked away.', 'bad');
        tx.ped.state = 'walk';
        state.taxi = null;
        state.taxiCooldown = 20;
        updateBeacon();
      }
    }
    if (!state.active) return;
    const s = currentStep();
    if (!s) return;
    if (s.time) {
      state.timer -= dt;
      if (state.timer <= 0) {
        failMission(world, 'out of time');
        return;
      }
    }
    if (s.kind === 'goto' || s.kind === 'deliver') {
      const d = Math.hypot(s.x - player.x, s.z - player.z);
      if (d < s.radius) advance(world);
    } else if (s.kind === 'survive') {
      state.surviveLeft -= dt;
      if (state.surviveLeft <= 0) advance(world);
    } else if (s.kind === 'grab') {
      const d = Math.hypot(s.x - player.x, s.z - player.z);
      if (d < s.radius && !player.car) {
        state.grabProgress += dt;
        if (state.grabProgress >= s.seconds) advance(world);
      } else {
        state.grabProgress = Math.max(0, state.grabProgress - dt * 2);
      }
    }
    updateBeacon();
  }

  return {
    missions,
    state,
    currentMission,
    currentStep,
    startMission,
    onEvent,
    update,
    get objective() {
      const s = currentStep();
      if (state.taxi) return { label: 'Drop off the passenger', x: state.taxi.destX, z: state.taxi.destZ, timer: state.taxi.timer };
      if (!state.active || !s) return null;
      const x = s.kind === 'stealStyle' && state.targetCar ? state.targetCar.x : s.x;
      const z = s.kind === 'stealStyle' && state.targetCar ? state.targetCar.z : s.z;
      const timer = s.time ? state.timer : s.kind === 'survive' ? state.surviveLeft : s.kind === 'grab' ? Math.max(0, s.seconds - state.grabProgress) : 0;
      return { label: s.label, x, z, timer, progress: s.kind === 'grab' ? state.grabProgress / s.seconds : 0 };
    },
  };
}

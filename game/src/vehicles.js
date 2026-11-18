// Cars: a box-built car mesh, traffic that follows the road network, parked cars,
// and the arcade driving model the player uses.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { resolveCollider } from './city.js';

const CAR_COLORS = [0xc23b2e, 0x2a6db0, 0xe8b93c, 0x3a8a3a, 0xf2f2f2, 0x222831, 0x8a5a9e, 0xd08020, 0x4a90a4];
const CAR_NAMES = ['Comet', 'Stallion', 'Bison', 'Futo', 'Sultan', 'Prairie', 'Vapid', 'Declasse'];

// Build a car from boxes: body, cabin, wheels, lights. Returns a Group with
// userData.wheels for steering/spin.
export function buildCarMesh(color, kind = 'sedan') {
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1a1d22 });
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fc4d8 });
  const bodyLen = kind === 'sports' ? 4.6 : kind === 'truck' ? 5.2 : 4.2;
  const bodyW = 2.0;
  const body = new THREE.Mesh(new THREE.BoxGeometry(bodyW, 0.62, bodyLen), paint);
  body.position.y = 0.55;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.85, 0.55, bodyLen * 0.45), glass);
  cabin.position.set(0, 1.1, kind === 'truck' ? 0.9 : -0.2);
  g.add(cabin);
  if (kind === 'truck') {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.9, 0.4, bodyLen * 0.4), dark);
    bed.position.set(0, 0.95, -1.2);
    g.add(bed);
  }
  // Headlights and taillights.
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  for (const sx of [-0.7, 0.7]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.1), lightMat);
    h.position.set(sx, 0.6, bodyLen / 2);
    g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.1), tailMat);
    t.position.set(sx, 0.6, -bodyLen / 2);
    g.add(t);
  }
  // Wheels.
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  for (const [wx, wz] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.36, wz);
    g.add(w);
    wheels.push(w);
  }
  g.userData.wheels = wheels;
  g.userData.bodyLen = bodyLen;
  return g;
}

export function createVehicles(world) {
  const { scene, rng, city } = world;
  const list = [];   // every car
  const traffic = []; // AI traffic
  const parked = [];  // parked cars (stealable)

  function addCar(x, z, heading, color, kind, role) {
    const mesh = buildCarMesh(color, kind);
    // Police livery for staged and spawned cruisers.
    if (role === 'police') {
      const band = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.2, 4.25), new THREE.MeshLambertMaterial({ color: 0x111111 }));
      band.position.y = 0.62;
      mesh.add(band);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
      bar.position.set(0, 1.42, -0.2);
      mesh.add(bar);
      mesh.userData.lightBar = bar;
    }
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    scene.add(mesh);
    const car = {
      mesh, kind, role,
      name: rng.pick(CAR_NAMES),
      color,
      x, z, heading,
      speed: 0,
      // Traffic state.
      axis: 'x', line: z, dir: 1, targetSpeed: CONFIG.trafficSpeed,
      // Player driving state.
      steer: 0, stuck: 0,
    };
    list.push(car);
    return car;
  }

  // Spawn the traffic fleet on the road lines.
  for (let i = 0; i < CONFIG.trafficCars; i++) {
    const p = city.randomRoadPoint();
    const horizontal = Math.abs(p.z - Math.round(p.z)) < 1 && rng.chance(0.5);
    const car = addCar(p.x, p.z, rng.chance(0.5) ? 0 : Math.PI, rng.pick(CAR_COLORS), rng.pick(['sedan', 'sedan', 'sports', 'truck']), 'traffic');
    car.axis = horizontal ? 'x' : 'z';
    car.dir = rng.chance(0.5) ? 1 : -1;
    car.heading = car.axis === 'x' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
    car.speed = car.targetSpeed;
    traffic.push(car);
  }
  // Parked cars along the roads, ready to steal.
  for (let i = 0; i < CONFIG.parkedCars; i++) {
    const p = city.randomRoadPoint();
    const car = addCar(p.x + rng.range(-3, 3), p.z + rng.range(-3, 3), rng.range(0, Math.PI * 2), rng.pick(CAR_COLORS), rng.pick(['sedan', 'sports']), 'parked');
    parked.push(car);
  }

  function syncMesh(car) {
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    const spin = car.speed * 0.016 / 0.36;
    for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
  }

  // Traffic: drive along a road line; at an intersection, sometimes turn.
  function updateTraffic(dt) {
    for (const car of traffic) {
      const lines = city.roadLines;
      // Move along the current axis.
      if (car.axis === 'x') car.x += car.dir * car.speed * dt;
      else car.z += car.dir * car.speed * dt;
      // At an intersection (near a crossing line), maybe turn.
      const near = lines.find((l) => Math.abs((car.axis === 'x' ? car.z : car.x) - l) < 0.6 || Math.abs((car.axis === 'x' ? car.x : car.z) - l) < 2);
      if (near !== undefined && rng.chance(dt * 0.25)) {
        const other = rng.pick(lines);
        if (car.axis === 'x') { car.axis = 'z'; car.z = near; car.x = other; car.dir = rng.chance(0.5) ? 1 : -1; }
        else { car.axis = 'x'; car.x = near; car.z = other; car.dir = rng.chance(0.5) ? 1 : -1; }
      }
      // Keep inside the city; turn around at the edge.
      const B = city.bounds;
      if (car.x < -240 || car.x > 240) { car.dir *= -1; car.x = Math.max(-240, Math.min(240, car.x)); }
      if (car.z < -240 || car.z > 240) { car.dir *= -1; car.z = Math.max(-240, Math.min(240, car.z)); }
      car.heading = car.axis === 'x' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
      // Avoid the player's car: slow down if close ahead.
      const pc = world.player.car;
      if (pc && Math.hypot(car.x - pc.x, car.z - pc.z) < 10) car.speed = Math.max(2, car.speed - 20 * dt);
      else car.speed = Math.min(car.targetSpeed, car.speed + 6 * dt);
      syncMesh(car);
    }
  }

  // Arcade driving for the player's car.
  function drivePlayerCar(car, dt, input) {
    const fwd = input.axisY();
    const steer = input.axisX();
    const maxF = CONFIG.carMaxSpeed;
    const maxR = CONFIG.carMaxReverse;
    if (fwd > 0) car.speed = Math.min(maxF, car.speed + CONFIG.carAccel * dt);
    else if (fwd < 0) car.speed = Math.max(-maxR, car.speed - CONFIG.carBrake * dt);
    else if (!world.shotMode) car.speed *= Math.max(0, 1 - 1.6 * dt);
    // In screenshot mode the staged speed is held, so the chase reads as a chase.
    const s = Math.sign(car.speed);
    car.heading += steer * CONFIG.carSteer * dt * s * Math.min(1, Math.abs(car.speed) / 8);
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    const p = { x: nx, z: nz };
    const hit = resolveCollider(p, 1.6, city.colliders);
    // Bounce off buildings.
    if (hit) {
      if (Math.abs(car.speed) > 6) { world.effects.sparks(p, 8, 0xffcc33); world.audio.crash(); }
      car.speed *= -0.25;
    }
    car.x = p.x; car.z = p.z;
    city.clampToCity(car);
    // Skid marks at speed with steering.
    if (Math.abs(car.speed) > 14 && steer !== 0 && Math.random() < 0.5) {
      world.effects.skid({ x: car.x, z: car.z }, car.heading);
    }
    // Front wheels steer.
    const wheels = car.mesh.userData.wheels;
    wheels[0].rotation.y = steer * 0.35;
    wheels[1].rotation.y = steer * 0.35;
    syncMesh(car);
    return car.speed;
  }

  return {
    list, traffic, parked,
    addCar,
    spawnCar(kind, color, x, z, heading, role) {
      const car = addCar(x, z, heading, color, kind, role);
      return car;
    },
    // Nearest stealable car to a point (parked or traffic, within radius).
    nearestStealable(x, z, radius = 5) {
      let best = null, bd = radius;
      for (const car of list) {
        if (car === world.player.car) continue;
        const d = Math.hypot(car.x - x, car.z - z);
        if (d < bd) { bd = d; best = car; }
      }
      return best;
    },
    update(dt, input) {
      updateTraffic(dt);
      if (world.player.car) drivePlayerCar(world.player.car, dt, input);
    },
  };
}

// Cars: box-built models in a few body styles, arcade driving physics for the player,
// and traffic that follows the road graph in the right-hand lane. A car is a circle of
// radius 2.2 m for collisions; buildings stop it, other cars shove it.

import { CAR } from './config.js';
import { ACTION_HORN } from './input.js';

const BODY_COLORS = [0xc23b2e, 0x2e6fc2, 0xe8b93c, 0x3aa655, 0x8a5fc2, 0xd8d8d8, 0x22262c, 0xc2702e, 0x4fc3c2];
const TAXI_COLOR = 0xf2c230;

function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.55 }),
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

/** Build the mesh for a car of `style` in `color`. Returns the group and its wheels. */
export function createCarMesh(style, color) {
  const group = new THREE.Group();
  const isTruck = style === 'truck';
  const bodyLen = isTruck ? 5.6 : 4.4;
  const bodyW = 2.0;
  const bodyH = isTruck ? 1.5 : 0.75;
  const body = box(bodyW, bodyH, bodyLen, color, 0, 0.75, 0);
  group.add(body);
  if (isTruck) {
    const cab = box(1.9, 1.1, 1.4, color, 0, 1.9, 1.6);
    group.add(cab);
    const bed = box(1.9, 0.9, 3.2, 0x5a5f66, 0, 1.6, -1);
    group.add(bed);
  } else {
    const cabin = box(1.7, 0.65, 2.2, 0x18202a, 0, 1.35, -0.2);
    cabin.material = new THREE.MeshStandardMaterial({ color: 0x18202a, roughness: 0.15, metalness: 0.7 });
    group.add(cabin);
  }
  // Headlights and taillights.
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xfff6c8, emissive: 0xfff2a0, emissiveIntensity: 0.7 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xcc2222, emissive: 0xaa1111, emissiveIntensity: 0.8 });
  for (const s of [-1, 1]) {
    const head = box(0.35, 0.18, 0.1, 0xffffff, s * 0.65, 0.75, bodyLen / 2);
    head.material = lightMat;
    group.add(head);
    const tail = box(0.35, 0.18, 0.1, 0xffffff, s * 0.65, 0.75, -bodyLen / 2);
    tail.material = tailMat;
    group.add(tail);
  }
  // Wheels: cylinders spun to face sideways.
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.9 });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.38, wz);
    wheel.castShadow = true;
    group.add(wheel);
    wheels.push(wheel);
  }
  let lightBar = null;
  if (style === 'police') {
    lightBar = new THREE.Group();
    const red = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.18, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xcc2222, emissive: 0xcc2222, emissiveIntensity: 1 }),
    );
    red.position.x = -0.4;
    const blue = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.18, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x2244cc, emissive: 0x2244cc, emissiveIntensity: 1 }),
    );
    blue.position.x = 0.4;
    lightBar.add(red, blue);
    lightBar.position.set(0, 1.85, -0.2);
    lightBar.userData = { red, blue };
    group.add(lightBar);
  }
  if (style === 'taxi') {
    const sign = box(0.9, 0.25, 0.5, TAXI_COLOR, 0, 1.85, -0.2);
    group.add(sign);
  }
  group.traverse((m) => {
    if (m.isMesh) m.castShadow = true;
  });
  return { group, wheels, lightBar, bodyLen };
}

export function createVehicles(city, scene, rng) {
  const cars = [];
  const styles = ['sedan', 'sedan', 'coupe', 'sedan', 'taxi', 'truck', 'coupe'];

  function spawnCar(style, color, x, z, heading, kind) {
    const tune = CAR[style] || CAR.sedan;
    const { group, wheels, lightBar } = createCarMesh(style, color);
    group.position.set(x, 0, z);
    group.rotation.y = heading;
    scene.add(group);
    const car = {
      mesh: group,
      wheels,
      lightBar,
      style,
      color,
      x,
      z,
      heading,
      speed: 0,
      steer: 0,
      vx: 0,
      vz: 0,
      health: 100,
      kind, // 'traffic' | 'police' | 'parked' | 'player' | 'mission'
      driver: kind === 'traffic' || kind === 'police',
      edge: -1,
      edgeT: 0,
      edgeDir: 1,
      laneSide: 1,
      stopped: 0,
      smokeTimer: 0,
      dead: false,
    };
    cars.push(car);
    return car;
  }

  function spawnTraffic(count) {
    for (let i = 0; i < count; i++) {
      const edge = city.edges[rng.int(0, city.edges.length - 1)];
      const dir = rng.chance(0.5) ? 1 : -1;
      const p = city.pointOnEdge(edge, rng.next(), dir > 0 ? 1 : -1);
      const style = styles[rng.int(0, styles.length - 1)];
      const car = spawnCar(style, BODY_COLORS[rng.int(0, BODY_COLORS.length - 1)], p.x, p.z, p.angle, 'traffic');
      car.edge = city.edges.indexOf(edge);
      car.edgeT = rng.next();
      car.edgeDir = dir;
      car.laneSide = dir > 0 ? 1 : -1;
      car.speed = 8 + rng.range(0, 4);
    }
  }

  function spawnParked(count) {
    for (let i = 0; i < count; i++) {
      const edge = city.edges[rng.int(0, city.edges.length - 1)];
      const dir = rng.chance(0.5) ? 1 : -1;
      const p = city.pointOnEdge(edge, rng.next(), dir > 0 ? 1 : -1);
      // Parked at the kerb: push a little further out.
      const style = styles[rng.int(0, styles.length - 1)];
      const car = spawnCar(style, BODY_COLORS[rng.int(0, BODY_COLORS.length - 1)], p.x, p.z, p.angle, 'parked');
      car.speed = 0;
    }
  }

  function removeCar(car) {
    scene.remove(car.mesh);
    const i = cars.indexOf(car);
    if (i >= 0) cars.splice(i, 1);
  }

  /** The nearest car to (x, z) within `maxDist`, or null. */
  function nearestCar(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of cars) {
      if (car.dead) continue;
      const d = Math.hypot(car.x - x, car.z - z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  /** Arcade drive step for the player's car. Returns events as flags on `out`. */
  function drivePlayer(car, input, dt, world) {
    const tune = CAR[car.style] || CAR.sedan;
    const move = input.move();
    const handbrake = input.isDown('Space');
    // Throttle: W accelerates, S brakes then reverses.
    if (move.forward > 0) car.speed += tune.accel * dt;
    else if (move.forward < 0) {
      if (car.speed > 0.5) car.speed -= tune.brake * dt;
      else car.speed -= tune.reverse * dt;
    } else {
      // Coast down.
      car.speed -= Math.sign(car.speed) * 6 * dt;
      if (Math.abs(car.speed) < 0.2) car.speed = 0;
    }
    if (handbrake) car.speed -= Math.sign(car.speed) * 18 * dt;
    car.speed = Math.max(-tune.reverse * 1.4, Math.min(tune.topSpeed, car.speed));
    // Steering: sharper slow, gentler fast; reversed when reversing.
    const speedFactor = Math.min(1, Math.abs(car.speed) / 12);
    const targetSteer = move.strafe * tune.steer * (0.35 + 0.65 * (1 - speedFactor * 0.6));
    car.steer += (targetSteer - car.steer) * Math.min(1, dt * 8);
    car.heading += car.steer * (car.speed / 8) * dt * (car.speed >= 0 ? 1 : -1);
    // Velocity: mostly along the heading, with a lateral slide that grip removes.
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    const grip = handbrake ? 1.6 : tune.grip;
    const targetVx = fx * car.speed;
    const targetVz = fz * car.speed;
    car.vx += (targetVx - car.vx) * Math.min(1, dt * grip);
    car.vz += (targetVz - car.vz) * Math.min(1, dt * grip);
    car.x += car.vx * dt;
    car.z += car.vz * dt;
    // Skid marks and smoke when sliding hard.
    const slide = Math.abs(car.vx * Math.cos(car.heading) - car.vz * Math.sin(car.heading));
    if ((handbrake || slide > 6) && Math.abs(car.speed) > 6) {
      world.effects.skid(car.x - fx * 1.4, car.z - fz * 1.4, car.heading);
      if (Math.random() < 0.3) world.effects.smoke(car.x, 0.4, car.z);
    }
    if (world.actions & ACTION_HORN) world.audio.horn();
  }

  /** One traffic car follows its edge; at the end it picks a new edge at the same node. */
  function driveTraffic(car, dt, world) {
    if (car.stopped > 0) {
      car.stopped -= dt;
      car.speed = Math.max(0, car.speed - 20 * dt);
    } else {
      car.speed += (11 - car.speed) * Math.min(1, dt * 1.5);
    }
    const edge = city.edges[car.edge];
    if (!edge) return;
    const a = city.nodes[car.edgeDir > 0 ? edge.a : edge.b];
    const b = city.nodes[car.edgeDir > 0 ? edge.b : edge.a];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    car.edgeT += (car.speed * dt) / len;
    if (car.edgeT >= 1) {
      // Pick a new edge out of node b (not the one we came on).
      const nodeId = car.edgeDir > 0 ? edge.b : edge.a;
      const options = [];
      city.edges.forEach((e, i) => {
        if (i === car.edge) return;
        if (e.a === nodeId) options.push({ edge: i, dir: 1 });
        else if (e.b === nodeId) options.push({ edge: i, dir: -1 });
      });
      if (options.length === 0) {
        car.edgeDir *= -1;
        car.edgeT = 0;
      } else {
        const next = options[Math.floor(Math.random() * options.length)];
        car.edge = next.edge;
        car.edgeDir = next.dir;
        car.edgeT = 0;
      }
      return;
    }
    const p = city.pointOnEdge(city.edges[car.edge], car.edgeT, car.laneSide);
    car.x = p.x;
    car.z = p.z;
    car.heading = p.angle + (car.edgeDir > 0 ? 0 : Math.PI);
  }

  function update(dt, world) {
    const player = world.player;
    for (const car of cars) {
      if (car.dead) continue;
      if (car === player.car) {
        drivePlayer(car, world.input, dt, world);
      } else if (car.kind === 'traffic') {
        driveTraffic(car, dt, world);
      } else if (car.kind === 'police') {
        // Police movement is owned by the police system; it only sets speed/heading.
      }
      // Keep every car out of the buildings and inside the map.
      const pos = { x: car.x, z: car.z };
      city.resolveCircle(pos, 2.2);
      car.x = pos.x;
      car.z = pos.z;
      // Car-car shove: circles of radius 2.2.
      for (const other of cars) {
        if (other === car || other.dead) continue;
        const dx = other.x - car.x;
        const dz = other.z - car.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.01 && d < 4.4) {
          const push = (4.4 - d) / 2;
          const nx = dx / d;
          const nz = dz / d;
          car.x -= nx * push;
          car.z -= nz * push;
          other.x += nx * push;
          other.z += nz * push;
          if (car === player.car || other === player.car) {
            const hit = Math.abs(car.speed - other.speed);
            if (hit > 4) world.events.push({ type: 'crash', hard: hit > 10 });
            car.speed *= 0.6;
            other.speed *= 0.6;
          }
        }
      }
      // Damage smoke, and a wrecked car burns out.
      if (car.health < 45 && car.health > 0) {
        car.smokeTimer -= dt;
        if (car.smokeTimer <= 0) {
          car.smokeTimer = 0.12;
          world.effects.smoke(car.x, 1.2, car.z);
        }
      }
      if (car.health <= 0 && !car.dead) {
        car.dead = true;
        world.effects.explosion(car.x, 0.5, car.z);
        world.audio.explosion();
        world.events.push({ type: 'carWrecked', car });
        if (car === player.car) player.car = null;
      }
      // Wheels spin with speed; fronts steer.
      const spin = car.speed * dt * 2.2;
      car.wheels.forEach((w, i) => {
        w.rotation.x += spin;
        if (i < 2) w.rotation.y = car.steer * 0.5;
      });
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
    }
    // Traffic far from the player is recycled onto a road near them.
    for (const car of cars) {
      if (car.kind !== 'traffic' || car.dead) continue;
      const d = Math.hypot(car.x - player.x, car.z - player.z);
      if (d > 220) {
        const p = city.randomRoadPoint();
        car.x = p.x;
        car.z = p.z;
        car.heading = p.angle;
        const edge = city.edges.reduce((best, e, i) => {
          const a = city.nodes[e.a];
          const d2 = (a.x - p.x) ** 2 + (a.z - p.z) ** 2;
          return d2 < best.d ? { i, d: d2 } : best;
        }, { i: 0, d: Infinity });
        car.edge = edge.i;
        car.edgeT = 0.5;
      }
    }
  }

  return { cars, spawnCar, spawnTraffic, spawnParked, removeCar, nearestCar, update };
}

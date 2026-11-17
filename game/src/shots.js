// Screenshot scenes. Each one stages a real moment of play — a fixed seed, a real
// position, real traffic and police — then the loop runs it forward a few frames so
// nothing is posed. The camera yaw is preset to the staged heading so the first frame
// is already looking the right way. The driver waits for window.__shotReady.
import { SCREEN_PLAY } from './render.js';

/** Move peds out of the staged car's way so no one gets run down mid-shot. */
function clearPedsNear(world, x, z, radius, toX, toZ) {
  for (const ped of world.peds.peds) {
    if (Math.hypot(ped.x - x, ped.z - z) < radius) {
      ped.x = toX;
      ped.z = toZ;
      ped.target = { x: toX, z: toZ };
    }
  }
}

export function stageShot(name, world) {
  const { player, playerApi, vehicles, peds, police, missions, city } = world;
  player.dead = false;
  player.health = 100;
  player.armor = 50;
  player.money = 1280;
  player.weapon = 'pistol';
  player.ammo = { pistol: 24, smg: 60 };
  player.reserve = { pistol: 48, smg: 120 };
  missions.startMission(0, world);

  if (name === 'cover') {
    // Leo tearing up the downtown road in the yellow sports car, two stars, a cruiser
    // closing in just behind him.
    const car = vehicles.spawnCar('sports', 0xe8b93c, 0, -75, 0, 'player');
    car.speed = 16;
    player.car = car;
    player.heading = car.heading;
    // A cruiser coming head-on up the street ahead, lights flashing.
    const cruiser = vehicles.spawnCar('police', 0xf2f2f2, 3, -48, Math.PI, 'police');
    cruiser.speed = 10;
    police.setStars(2, world);
    clearPedsNear(world, 0, -75, 30, 60, -140);
    world.renderer.cam.yaw = 0;
    world.hud.message('Mission 1 — Wheels Up: steal any car and reach the garage', 'mission');
  } else if (name === 'chase') {
    // Three stars on the marina road, two cruisers bearing down on him head-on.
    const car = vehicles.spawnCar('sedan', 0xc23b2e, 150, 200, -Math.PI / 2, 'player');
    car.speed = 18;
    player.car = car;
    player.heading = car.heading;
    for (const [cx, cz] of [[125, 196], [115, 204]]) {
      const cruiser = vehicles.spawnCar('police', 0xf2f2f2, cx, cz, Math.PI / 2, 'police');
      cruiser.speed = 14;
    }
    police.setStars(3, world);
    clearPedsNear(world, 150, 200, 30, 60, 140);
    world.renderer.cam.yaw = -Math.PI / 2;
    world.hud.message('3 stars — lose them before they box you in', 'bad');
  } else if (name === 'mission') {
    // Dockside: on foot on the open road, pistol out, three rivals ahead of him.
    player.car = null;
    player.x = 0;
    player.z = 100;
    player.heading = 0;
    missions.startMission(4, world);
    world.combat.makeEnemy(2, 116);
    world.combat.makeEnemy(-3, 122);
    world.combat.makeEnemy(5, 128);
    world.renderer.cam.yaw = 0;
    world.hud.message('Mission 5 — Dockside: take out the rivals, grab the briefcase', 'mission');
  } else {
    // 'foot': Leo on foot in the plaza, peds and traffic around him, the marina behind.
    player.car = null;
    player.x = 0;
    player.z = 30;
    player.heading = Math.PI;
    missions.startMission(1, world);
    world.renderer.cam.yaw = Math.PI;
    world.hud.message('Free roam — taxi fares, hidden packages, and Mara\'s next job', 'info');
  }
  return { screen: SCREEN_PLAY };
}

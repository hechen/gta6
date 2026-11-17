// Screenshot scenes. Each one stages a real moment of play — a fixed seed, a real
// position, real traffic and police — then the loop runs it forward a few frames so
// nothing is posed. The driver waits for window.__shotReady.
import { SCREEN_PLAY } from './render.js';
import { createCar, createPoliceCar } from './vehicles.js';

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
    // Leo tearing downtown in the yellow sports car, two stars, a cruiser on his tail.
    const car = createCar('sports', 'sports');
    vehicles.addCar(car, -25, -75);
    car.heading = Math.PI / 2;
    car.speed = 16;
    player.car = car;
    car.kind = 'player';
    player.heading = car.heading;
    const cruiser = createPoliceCar();
    vehicles.addCar(cruiser, -25, -52);
    cruiser.heading = Math.PI / 2;
    cruiser.speed = 14;
    police.setStars(2, world);
    world.hud.message('Mission 1 — Wheels Up: steal any car and reach the garage', 'mission');
  } else if (name === 'chase') {
    // Three stars on the marina road, two cruisers closing in from behind.
    const car = createCar('sedan', 'sedan');
    vehicles.addCar(car, 175, 200);
    car.heading = -Math.PI / 2;
    car.speed = 18;
    player.car = car;
    car.kind = 'player';
    player.heading = car.heading;
    for (const dz of [26, 44]) {
      const cruiser = createPoliceCar();
      vehicles.addCar(cruiser, 175, 200 + dz);
      cruiser.heading = -Math.PI / 2;
      cruiser.speed = 16;
    }
    police.setStars(3, world);
    world.hud.message('3 stars — lose them before they box you in', 'bad');
  } else if (name === 'mission') {
    // Dockside: on foot at the docks, pistol out, a rival ahead of the objective marker.
    player.car = null;
    player.x = 150;
    player.z = 60;
    player.heading = Math.PI / 2;
    playerApi.placeAt(150, 0, 60);
    missions.startMission(4, world);
    world.hud.message('Mission 5 — Dockside: take out the rivals, grab the briefcase', 'mission');
  } else {
    // 'foot': Leo on foot in the plaza, peds and traffic around him, the marina behind.
    player.car = null;
    player.x = 0;
    player.z = 30;
    player.heading = Math.PI;
    playerApi.placeAt(0, 0, 30);
    missions.startMission(1, world);
    world.hud.message('Free roam — taxi fares, hidden packages, and Mara\'s next job', 'info');
  }
  return { screen: SCREEN_PLAY };
}

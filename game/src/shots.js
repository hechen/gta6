// Screenshot staging: ?shot=cover|chase|mission|foot puts the game into a real
// moment of play — a fixed position on a road, real traffic and police — then
// the loop runs it forward a few frames so nothing is posed.
// window.__shotReady tells the screenshot driver the frame is ready.
// Road lines sit at -252 + i*56 - 6 (i = 0..9): -258, -202, -146, -90, -34,
// 22, 78, 134, 190, 246. Cars and players are staged ON those lines.

export function stageShot(name, world) {
  const { player, vehicles, peds, police, missions } = world;
  player.dead = false;
  player.health = 100;
  player.armor = 50;
  player.money = 1280;
  player.weapon = 'pistol';
  player.ammo.pistol = 24;
  player.owned.pistol = true;
  missions.startMission(0, world);

  function clearPeds(x, z, radius, toX, toZ) {
    for (const ped of peds.list) {
      if (Math.hypot(ped.x - x, ped.z - z) < radius) {
        ped.x = toX; ped.z = toZ;
        ped.target = { x: toX, z: toZ };
      }
    }
  }

  if (name === 'cover') {
    // Leo tearing up a downtown road in the yellow sports car, two stars, a
    // cruiser closing in just behind him. Road z=-34, heading +x (east).
    const car = vehicles.spawnCar('sports', 0xe8b93c, 0, -34, Math.PI / 2, 'player');
    car.speed = 16;
    player.car = car;
    player.heading = car.heading;
    const cruiser = vehicles.spawnCar('sedan', 0xf2f2f2, -28, -34, Math.PI / 2, 'police');
    cruiser.speed = 12;
    police.setStars(2, world);
    clearPeds(0, -34, 30, 60, -140);
    world.hud.message('Mission 1 — Wheels Up: steal any car and reach the garage', 'mission');
  } else if (name === 'chase') {
    // Three stars on the marina road (x=190), two cruisers bearing down head-on.
    missions.startMission(4, world);
    const car = vehicles.spawnCar('sedan', 0xc23b2e, 190, 100, 0, 'player');
    car.speed = 18;
    player.car = car;
    player.heading = car.heading;
    for (const [cx, cz] of [[190, 168], [186, 188]]) {
      const cruiser = vehicles.spawnCar('sedan', 0xf2f2f2, cx, cz, Math.PI, 'police');
      cruiser.speed = 14;
    }
    police.setStars(3, world);
    clearPeds(190, 100, 30, 60, 140);
    world.hud.message('3 stars — lose them before they box you in', 'bad');
  } else if (name === 'mission') {
    // A street shootout downtown: on foot on the road, pistol out, three
    // rivals ahead of him. Road z=-34, facing +z (south) down the street.
    // The player stands just off the road's centre line.
    player.car = null;
    player.x = 0; player.z = -31;
    player.heading = 0;
    missions.startMission(2, world);
    world.combat.spawnEnemy(2, -18);
    world.combat.spawnEnemy(-3, -12);
    world.combat.spawnEnemy(5, -8);
    player.camYaw = 0;
    world.hud.message('Mission 3 — Dockside: take out the rivals, grab the briefcase', 'mission');
  } else {
    // 'foot': Leo on foot on a downtown street, peds and traffic around him.
    // (Not on the taxi stand — its marker would swallow the shot.)
    player.car = null;
    player.x = 40; player.z = -34;
    player.heading = Math.PI / 2;
    missions.startMission(1, world);
    player.camYaw = Math.PI / 2;
    world.hud.message('Free roam — taxi fares, hidden packages, and Mara\'s next job', 'info');
  }
  return true;
}

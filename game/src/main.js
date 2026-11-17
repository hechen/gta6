// Solara Bay — boot and the one loop. The world is one object every system shares; the loop
// reads input once a frame, advances the world in fixed 1/60 s steps, drains the events the
// systems raised, and paints. Screens: title, play, paused, busted, game over.
//
// ?seed=N fixes the city. ?shot=cover|chase|mission|foot stages that scene instead of the
// title screen, runs it forward a little, and sets window.__shotReady for a screenshot.
import { STEP, MONEY, WEAPONS, PLAYER } from './config.js';
import { createRandom } from './rng.js';
import { createTextures } from './textures.js';
import { createCity } from './city.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_OVER, SCREEN_BUSTED } from './render.js';
import { createInput, ACTION_ENTER_CAR, ACTION_SHOOT, ACTION_RELOAD, ACTION_PAUSE, ACTION_CONFIRM, ACTION_CAMERA, ACTION_MUTE, ACTION_JUMP } from './input.js';
import { createVehicles } from './vehicles.js';
import { createPlayer } from './player.js';
import { createPeds } from './peds.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createEffects } from './effects.js';
import { saveGame, loadGame } from './save.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261117;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const rng = createRandom(seed);
const textures = createTextures(rng);
const renderer = createRenderer(canvas);
const city = createCity(rng, textures);
renderer.scene.add(city.group);
const effects = createEffects(renderer.scene);
const audio = createAudio();
const input = createInput(canvas);
const vehicles = createVehicles(city, renderer.scene, rng);
const playerApi = createPlayer(renderer.scene);
const player = playerApi.player;
const peds = createPeds(city, renderer.scene, rng);
const police = createPolice(city, renderer.scene, rng, vehicles);
const combat = createCombat(renderer.scene, rng);
const missions = createMissions(city, renderer.scene, rng, combat);
const hud = createHud(city);

const world = {
  time: 0,
  city,
  renderer,
  effects,
  audio,
  input,
  vehicles,
  player,
  playerApi,
  peds,
  police,
  combat,
  missions,
  hud,
  events: [],
  actions: 0,
  stats: { missionsDone: 0, fares: 0, kills: 0 },
  screen: SCREEN_TITLE,
};

// --- Spawning the living city. ---
player.x = city.locations.plaza.x;
player.z = city.locations.plaza.z + 10;
player.heading = Math.PI;
vehicles.spawnTraffic(14);
vehicles.spawnParked(10);
peds.spawnInitial(22);
// A few health and ammo pickups around town.
combat.spawnPickup('health', -170, 30);
combat.spawnPickup('armor', 120, -170);
combat.spawnPickup('ammo', 30, 170);
combat.spawnPickup('health', 170, -30);

function announce(message) {
  status.textContent = message;
}

function showScreen(name) {
  world.screen = name;
  for (const id of ['screen-title', 'screen-pause', 'screen-over', 'screen-busted']) {
    document.getElementById(id).classList.toggle('screen-show', `screen-${name}` === id);
  }
  document.getElementById('hud').classList.toggle('hud-hidden', name === SCREEN_TITLE);
}

function startGame(fresh) {
  if (fresh) {
    player.money = MONEY.start;
    player.health = PLAYER.maxHealth;
    player.armor = 0;
    player.weapon = 'pistol';
    player.ammo = { pistol: 12, smg: 0 };
    player.reserve = { pistol: 24, smg: 0 };
    player.x = city.locations.plaza.x;
    player.z = city.locations.plaza.z + 10;
    player.dead = false;
    world.stats = { missionsDone: 0, fares: 0, kills: 0 };
    missions.startMission(0, world);
  } else {
    const save = loadGame();
    if (save) {
      player.money = save.money;
      player.health = PLAYER.maxHealth;
      player.armor = 0;
      player.weapon = save.weapon || 'pistol';
      player.ammo = save.ammo || { pistol: 12, smg: 0 };
      player.reserve = save.reserve || { pistol: 24, smg: 0 };
      player.x = save.x ?? city.locations.plaza.x;
      player.z = save.z ?? city.locations.plaza.z + 10;
      world.stats.missionsDone = save.missionsDone || 0;
      world.stats.fares = save.fares || 0;
      world.stats.kills = save.kills || 0;
      missions.state.packagesFound = save.packagesFound || 0;
      if ((save.missionsDone || 0) >= 6) {
        missions.state.index = -1;
        missions.state.active = false;
      } else {
        missions.startMission(save.missionsDone || 0, world);
      }
    }
  }
  showScreen(SCREEN_PLAY);
  announce('Playing Solara Bay.');
  audio.unlock();
}

function respawn(atPolice) {
  const place = atPolice ? city.locations.police : city.locations.hospital;
  player.x = place.x;
  player.z = place.z + 8;
  player.health = PLAYER.maxHealth;
  player.armor = 0;
  player.dead = false;
  player.car = null;
  police.setStars(0, world);
  showScreen(SCREEN_PLAY);
}

/** E near a shop does the shop's thing; otherwise it enters or leaves a car. */
function interact() {
  const L = city.locations;
  if (!player.car) {
    if (Math.hypot(player.x - L.gunshop.x, player.z - L.gunshop.z) < 8) {
      if (player.weapon !== 'smg' && player.money >= WEAPONS.smg.price) {
        player.money -= WEAPONS.smg.price;
        player.weapon = 'smg';
        player.ammo.smg = WEAPONS.smg.ammo;
        player.reserve.smg = 64;
        hud.message('Bought the Vex SMG — press 3 to use it', 'good');
        audio.pickup();
      } else if (player.weapon === 'smg' || player.ammo.smg > 0) {
        if (player.money >= 50) {
          player.money -= 50;
          player.reserve.smg += 32;
          player.reserve.pistol += 12;
          hud.message('Ammo restocked — $50', 'good');
          audio.pickup();
        } else hud.message('Not enough cash for ammo', 'bad');
      } else hud.message('Vex SMG — $900. You need the cash first.', 'info');
      return;
    }
    if (Math.hypot(player.x - L.garage.x, player.z - L.garage.z) < 8) {
      if (saveGame(world)) hud.message('Game saved at the garage', 'good');
      return;
    }
  } else if (Math.hypot(player.x - L.spray.x, player.z - L.spray.z) < 8) {
    if (police.stars > 0 && player.money >= MONEY.sprayCost) {
      player.money -= MONEY.sprayCost;
      police.setStars(0, world);
      hud.message('New paint, clean record — wanted level cleared', 'good');
      audio.pickup();
    } else if (police.stars > 0) hud.message('A respray costs $150 — you are short', 'bad');
    return;
  }
  // Enter or leave a car.
  if (player.car) {
    const car = player.car;
    player.car = null;
    player.x = car.x + Math.sin(car.heading + Math.PI / 2) * 2.5;
    player.z = car.z + Math.cos(car.heading + Math.PI / 2) * 2.5;
    player.y = 0;
    player.heading = car.heading;
    audio.click();
    return;
  }
  const car = vehicles.nearestCar(player.x, player.z, 4.5);
  if (!car) return;
  const wasParked = car.kind === 'parked' || car.kind === 'mission';
  const wasTraffic = car.kind === 'traffic';
  player.car = car;
  car.kind = 'player';
  car.driver = false;
  player.heading = car.heading;
  audio.unlock();
  if (wasTraffic) {
    // The driver bails and runs.
    const ped = peds.spawnPed(car.x + 2, car.z + 2, false);
    ped.state = 'flee';
    ped.heading = Math.atan2(ped.x - player.x, ped.z - player.z);
    ped.fleeTimer = 3;
  }
  if (wasParked || wasTraffic || car.kind === 'mission') {
    // Seen stealing? A ped or a cop nearby calls it in.
    let seen = false;
    for (const ped of peds.peds) {
      if (!ped.dead && Math.hypot(ped.x - player.x, ped.z - player.z) < 30) {
        seen = true;
        break;
      }
    }
    if (!seen) {
      for (const cop of police.cops) {
        if (Math.hypot(cop.x - player.x, cop.z - player.z) < 60) {
          seen = true;
          break;
        }
      }
    }
    if (seen) {
      police.addStars(1, world);
      hud.message('Someone saw you steal that car!', 'bad');
    }
    world.events.push({ type: 'carStolen', car });
  }
}

function switchWeapon(n) {
  if (n === 1) player.weapon = 'fists';
  else if (n === 2 && player.ammo.pistol + player.reserve.pistol > 0) player.weapon = 'pistol';
  else if (n === 3 && (player.ammo.smg > 0 || player.reserve.smg > 0)) player.weapon = 'smg';
  else return;
  audio.click();
}

let lastShotAt = 0;
let lastWantedShotAt = -10;

function handleActions() {
  const actions = world.actions;
  if (actions & ACTION_PAUSE) {
    if (world.screen === SCREEN_PLAY) {
      showScreen(SCREEN_PAUSED);
      announce('Paused.');
    } else if (world.screen === SCREEN_PAUSED) {
      showScreen(SCREEN_PLAY);
      announce('Playing.');
    }
  }
  if (world.screen === SCREEN_TITLE) {
    if (actions & ACTION_CONFIRM) startGame(true);
    return;
  }
  if (world.screen === SCREEN_OVER || world.screen === SCREEN_BUSTED) {
    if (actions & ACTION_CONFIRM) respawn(world.screen === SCREEN_BUSTED);
    return;
  }
  if (world.screen !== SCREEN_PLAY) return;
  if (actions & ACTION_ENTER_CAR) interact();
  if (actions & ACTION_RELOAD) {
    const w = WEAPONS[player.weapon];
    if (w && player.weapon !== 'fists') {
      const need = w.ammo - player.ammo[player.weapon];
      const take = Math.min(need, player.reserve[player.weapon]);
      if (take > 0) {
        player.ammo[player.weapon] += take;
        player.reserve[player.weapon] -= take;
        audio.click();
      }
    }
  }
  if (actions & ACTION_MUTE) {
    const muted = audio.toggleMute();
    hud.message(muted ? 'Sound off' : 'Sound on', 'info');
  }
  if (actions & ACTION_CAMERA) {
    renderer.cam.targetDistance = renderer.cam.targetDistance > 9 ? 7 : 12;
  }
  if (input.isDown('Digit1')) switchWeapon(1);
  if (input.isDown('Digit2')) switchWeapon(2);
  if (input.isDown('Digit3')) switchWeapon(3);
  // Shooting: held mouse, paced by the weapon's rate.
  if ((actions & ACTION_SHOOT) && player.weapon !== 'fists' && !player.car) {
    const w = WEAPONS[player.weapon];
    if (world.time - lastShotAt >= w.rate) {
      lastShotAt = world.time;
      combat.playerShoot(world);
    }
  }
}

/** One drained event at a time; the systems only raise them, this is where they land. */
function handleEvent(ev) {
  switch (ev.type) {
    case 'message':
      hud.message(ev.text, ev.tone);
      break;
    case 'wanted':
      hud.message(ev.stars > 0 ? `Wanted level ${ev.stars} — lose the cops!` : 'You lost the cops.', ev.stars > 0 ? 'bad' : 'good');
      break;
    case 'crash':
      audio.crash();
      renderer.addShake(ev.hard ? 0.5 : 0.2);
      if (player.car) player.car.health -= ev.hard ? 12 : 5;
      break;
    case 'pedDown':
      world.stats.kills += 1;
      police.addStars(1, world);
      hud.message('You ran someone down — the law noticed', 'bad');
      break;
    case 'shotFired':
      if (world.time - lastWantedShotAt > 5) {
        for (const cop of police.cops) {
          if (Math.hypot(cop.x - player.x, cop.z - player.z) < 60) {
            police.addStars(1, world);
            lastWantedShotAt = world.time;
            break;
          }
        }
        if (world.time - lastWantedShotAt > 5) {
          for (const car of vehicles.cars) {
            if (car.kind === 'police' && Math.hypot(car.x - player.x, car.z - player.z) < 60) {
              police.addStars(1, world);
              lastWantedShotAt = world.time;
              break;
            }
          }
        }
      }
      break;
    case 'carStolen':
      missions.onEvent(ev, world);
      break;
    case 'enemyDown':
      world.stats.kills += 1;
      missions.onEvent(ev, world);
      break;
    case 'pickup': {
      if (ev.kind === 'health') {
        playerApi.heal(40);
        hud.message('Health +40', 'good');
      } else if (ev.kind === 'armor') {
        player.armor = Math.min(100, player.armor + 50);
        hud.message('Armour +50', 'good');
      } else if (ev.kind === 'ammo') {
        player.reserve.pistol += 12;
        player.reserve.smg += 32;
        hud.message('Ammo restocked', 'good');
      } else if (ev.kind === 'cash') {
        player.money += 50;
        hud.message('Found $50', 'good');
      }
      audio.pickup();
      break;
    }
    case 'carWrecked':
      if (ev.car && ev.car.style) hud.message('A car blew up', 'bad');
      break;
    case 'missionComplete':
      saveGame(world);
      break;
    case 'storyComplete':
      hud.banner('King of Solara Bay', 'Every job done. The city is yours — free roam, no more orders.');
      break;
    case 'busted': {
      const fine = Math.min(player.money, MONEY.bustedFine);
      player.money -= fine;
      document.getElementById('busted-title').textContent = 'Busted!';
      document.getElementById('busted-text').textContent = `The Solara Bay PD took $${fine} in fines. Mara will not be pleased.`;
      showScreen(SCREEN_BUSTED);
      audio.fail();
      break;
    }
    case 'wasted': {
      const fine = Math.min(player.money, MONEY.wastedFine);
      player.money -= fine;
      document.getElementById('over-title').textContent = 'Wasted';
      document.getElementById('over-text').textContent = `You woke up at St. Coral Hospital, $${fine} lighter.`;
      showScreen(SCREEN_OVER);
      audio.fail();
      break;
    }
    default:
      break;
  }
}

function step() {
  const dt = STEP;
  world.time += dt;
  world.actions = input.takeActions();
  handleActions();
  if (world.screen === SCREEN_PLAY) {
    const orbit = input.takeOrbit();
    renderer.orbit(orbit.x, orbit.y, orbit.wheel);
    city.update(dt, world.time);
    playerApi.update(dt, world);
    vehicles.update(dt, world);
    peds.update(dt, world);
    police.update(dt, world);
    combat.update(dt, world);
    missions.update(dt, world);
    effects.update(dt);
    audio.update(dt, world);
    while (world.events.length) handleEvent(world.events.shift());
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, MAX_FRAME);
  last = now;
  if (world.screen === SCREEN_TITLE) {
    // Attract mode: a slow orbit over the plaza while the menu is up.
    world.time += dt;
    renderer.cam.yaw += dt * 0.05;
    city.update(dt, world.time);
    peds.update(dt, world);
    effects.update(dt);
    const target = { x: 0, y: 0, z: 0 };
    renderer.follow(target, renderer.cam.yaw + Math.PI, dt, false);
  } else {
    accumulator += dt;
    while (accumulator >= STEP) {
      step();
      accumulator -= STEP;
    }
    const target = player.car
      ? { x: player.car.x, y: 1.2, z: player.car.z }
      : { x: player.x, y: 1.2, z: player.z };
    const heading = player.car ? player.car.heading : player.heading;
    renderer.follow(target, heading, dt, !!player.car);
  }
  renderer.render();
  hud.update(dt, world);
}

// Title screen buttons.
document.getElementById('btn-start').addEventListener('click', () => startGame(true));
const continueBtn = document.getElementById('btn-continue');
if (loadGame()) {
  continueBtn.style.display = 'inline-block';
  continueBtn.addEventListener('click', () => startGame(false));
}
document.getElementById('btn-resume').addEventListener('click', () => showScreen(SCREEN_PLAY));
document.getElementById('btn-restart').addEventListener('click', () => respawn(false));
document.getElementById('btn-restart-busted').addEventListener('click', () => respawn(true));
document.getElementById('btn-title').addEventListener('click', () => showScreen(SCREEN_TITLE));

let accumulator = 0;
let last = performance.now();
showScreen(SCREEN_TITLE);
announce('Solara Bay. Press Enter or click Start to play.');

if (shot) {
  // A staged scene for a screenshot: set the world up, run it forward, then signal ready.
  const scene = stageShot(shot, world);
  showScreen(scene.screen);
  let painted = 0;
  function paint() {
    accumulator += 1 / 30;
    while (accumulator >= STEP) {
      step();
      accumulator -= STEP;
    }
    const target = player.car
      ? { x: player.car.x, y: 1.2, z: player.car.z }
      : { x: player.x, y: 1.2, z: player.z };
    const heading = player.car ? player.car.heading : player.heading;
    renderer.follow(target, heading, 1 / 30, !!player.car);
    renderer.render();
    hud.update(1 / 30, world);
    painted += 1;
    if (painted < 6) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
} else {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && world.screen === SCREEN_PLAY) showScreen(SCREEN_PAUSED);
  });
  requestAnimationFrame(frame);
}

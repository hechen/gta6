// Solara Bay — bootstrap and game loop. Builds the world, wires the systems,
// runs the state machine (title / playing / paused / busted / wasted) and the
// screenshot staging used by the maker.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { makeRng } from './rng.js';
import { createRenderer } from './render.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createEffects } from './effects.js';
import { buildCity } from './city.js';
import { createVehicles } from './vehicles.js';
import { createPeds } from './peds.js';
import { createPlayer } from './player.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createCombat } from './combat.js';
import { createHud } from './hud.js';
import { saveGame, loadGame, applySave, hasSave } from './save.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const seed = parseInt(params.get('seed') || '20261117', 10);

const renderer = createRenderer(canvas);
const world = {
  rng: makeRng(seed),
  scene: renderer.scene,
  camera: renderer.camera,
  config: CONFIG,
  state: 'title',
  time: 0,
  shotMode: !!shotName,
  shotFrames: 0,
};
world.input = createInput(canvas);
world.audio = createAudio();
world.effects = createEffects(world.scene);
world.city = buildCity(world.scene, world.rng);
world.player = createPlayer(world);
world.vehicles = createVehicles(world);
world.peds = createPeds(world);
world.police = createPolice(world);
world.missions = createMissions(world);
world.combat = createCombat(world);
world.hud = createHud(world);

// Busted: the police take you in. Lose $200, wake up at the station, heat gone.
world.onBusted = function () {
  world.state = 'busted';
  world.audio.busted();
  world.audio.siren(false);
  world.player.money = Math.max(0, world.player.money - 200);
  world.police.clearHeat();
  world.hud.showBusted();
  saveGame(world);
};
// Wasted: you are down. Lose $100, wake up at the hospital, heat gone.
world.onWasted = function () {
  world.state = 'wasted';
  world.audio.busted();
  world.audio.siren(false);
  world.player.money = Math.max(0, world.player.money - 100);
  world.police.clearHeat();
  world.hud.showWasted();
  saveGame(world);
};

function respawn() {
  const p = world.player;
  p.dead = false;
  p.health = CONFIG.playerHealth;
  p.armor = 0;
  p.car = null;
  p.mesh.visible = true;
  const home = world.city.blockCenter(1, 6);
  p.x = home.x; p.z = home.z;
  p.mesh.position.set(p.x, 0, p.z);
  world.state = 'playing';
  world.hud.hideScreens();
  world.hud.message('You wake up and dust yourself off.', 'info');
}

function startGame(continueSave) {
  world.audio.ensure();
  if (continueSave) {
    const data = loadGame();
    if (data) applySave(world, data);
  }
  world.state = 'playing';
  world.hud.hideScreens();
  world.hud.setObjective('Free roam — find work, or start the story');
  if (world.missions.index < 6 && !world.missions.active) {
    world.missions.startMission(world.missions.index);
  }
  world.hud.message('Solara Bay — WASD to move, E to steal a car, click to shoot', 'info');
}

// Buttons.
document.getElementById('btn-start').addEventListener('click', () => startGame(false));
document.getElementById('btn-continue').addEventListener('click', () => startGame(true));
document.getElementById('btn-resume').addEventListener('click', () => {
  world.state = 'playing';
  world.hud.hideScreens();
});
document.getElementById('btn-restart').addEventListener('click', () => {
  localStorage.clear();
  location.reload();
});
document.getElementById('btn-busted-ok').addEventListener('click', respawn);
document.getElementById('btn-wasted-ok').addEventListener('click', respawn);
document.querySelectorAll('#shop button[data-buy]').forEach((btn) => {
  btn.addEventListener('click', () => world.combat.buy(btn.dataset.buy));
});
document.getElementById('btn-shop-close').addEventListener('click', () => {
  world.combat.shopOpen = false;
  world.hud.hideShop();
});

// Spray shop: pay $150 to wipe the wanted level.
function trySprayShop() {
  const s = world.city.markers.spray;
  const p = world.player;
  if (world.police.stars === 0) return false;
  if (Math.hypot(s.x - p.x, s.z - p.z) > 8) return false;
  if (p.money < CONFIG.sprayCost) {
    world.hud.message(`Spray shop needs $${CONFIG.sprayCost} — you have $${p.money}`, 'bad');
    return true;
  }
  p.money -= CONFIG.sprayCost;
  world.police.clearHeat();
  world.hud.message(`Spray shop: new paint, clean slate — $${CONFIG.sprayCost}`, 'good');
  world.audio.cash();
  return true;
}

function handleInteract() {
  // E is context sensitive: gun shop, then spray shop, then car.
  if (world.combat.tryShop()) return;
  if (trySprayShop()) return;
  const result = world.player.tryEnterExitCar();
  if (result && result.action === 'enter') {
    world.police.addHeat(1);
    world.hud.message(`Stole a ${result.car.name} — the law noticed`, 'bad');
  }
}

// Screenshot mode: skip the title, stage the scene, run it forward, then flag ready.
if (world.shotMode) {
  world.hud.hideScreens();
  world.state = 'playing';
  stageShot(shotName, world);
  world.hud.update();
} else {
  world.hud.showTitle(hasSave());
}

let last = performance.now();
let saveTimer = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  world.time += dt;
  const input = world.input;

  if (world.state === 'playing') {
    // Pause.
    if (input.wasPressed('Escape')) {
      world.state = 'paused';
      world.hud.showPause();
    }
    // Interact.
    if (input.wasPressed('KeyE')) handleInteract();
    // Weapons.
    if (input.wasPressed('KeyQ')) world.combat.switchWeapon();
    if (input.wasPressed('Digit1')) world.player.weapon = 'fists';
    if (input.wasPressed('Digit2') && world.player.owned.pistol) world.player.weapon = 'pistol';
    if (input.wasPressed('Digit3') && world.player.owned.smg) world.player.weapon = 'smg';
    // Shooting: hold mouse to fire (auto weapons) or click.
    if (input.mouseDown()) world.combat.shoot();

    world.player.update(dt, input);
    world.vehicles.update(dt, input);
    world.peds.update(dt);
    world.police.update(dt);
    world.missions.update(dt);
    world.combat.update(dt);
    world.effects.update(dt);
    world.missions.animateMarker(world.time);
    // Engine hum follows the player's car.
    const speed = world.player.car ? Math.abs(world.player.car.speed) / CONFIG.carMaxSpeed : 0;
    world.audio.engine(speed);
    // Autosave.
    saveTimer += dt;
    if (saveTimer > 15) { saveTimer = 0; saveGame(world); }
    world.hud.update();
  }

  renderer.render();

  // In screenshot mode, flag ready after the scene has run a few frames.
  if (world.shotMode) {
    world.shotFrames++;
    if (world.shotFrames === 45) {
      window.__shotReady = true;
    }
  }
  input.endFrame();
}

requestAnimationFrame(frame);

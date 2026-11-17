// Saving: the whole campaign state in one localStorage key — money, missions done,
// packages found, fares, kills, and where the player stands. The game auto-saves on
// mission completion and when the player uses the garage; loading puts them back there.

import { SAVE_KEY } from './config.js';

export function saveGame(world) {
  try {
    const data = {
      money: Math.floor(world.player.money),
      missionsDone: world.stats.missionsDone,
      packagesFound: world.missions.state.packagesFound,
      fares: world.stats.fares,
      kills: world.stats.kills,
      x: world.player.x,
      z: world.player.z,
      weapon: world.player.weapon,
      ammo: world.player.ammo,
      reserve: world.player.reserve,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.money !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage can be off; nothing to clear then.
  }
}

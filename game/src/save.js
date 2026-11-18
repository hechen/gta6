// Save and load: Leo's money, missions, packages, weapons and position live in
// localStorage, so Continue picks up where the last session left off.

const KEY = 'solara-bay-save-v1';

export function saveGame(world) {
  const p = world.player;
  const data = {
    money: p.money,
    health: p.health,
    armor: p.armor,
    weapon: p.weapon,
    ammo: p.ammo,
    owned: p.owned,
    x: p.x, z: p.z,
    missionIndex: world.missions.index,
    missionsCompleted: world.missions.completed,
    packagesTaken: world.missions.packagesTaken,
    savedAt: Date.now(),
  };
  try { localStorage.setItem(KEY, JSON.stringify(data)); return true; }
  catch (e) { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}

export function hasSave() {
  try { return localStorage.getItem(KEY) !== null; }
  catch (e) { return false; }
}

export function applySave(world, data) {
  const p = world.player;
  p.money = data.money ?? p.money;
  p.health = data.health ?? p.health;
  p.armor = data.armor ?? p.armor;
  p.weapon = data.weapon ?? 'fists';
  p.ammo = data.ammo ?? p.ammo;
  p.owned = data.owned ?? p.owned;
  p.x = data.x ?? p.x;
  p.z = data.z ?? p.z;
  world.missions.index = data.missionIndex ?? 0;
  world.missions.completed = data.missionsCompleted ?? 0;
  world.missions.packagesTaken = data.packagesTaken ?? 0;
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}

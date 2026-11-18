// The HUD: health and armor bars, money, weapon and ammo, wanted stars, the
// mission line, and a live canvas minimap. Also the title, pause, busted and
// wasted screens, the briefing card and the gun-shop panel.

export function createHud(world) {
  const root = document.getElementById('hud');
  const el = {};
  for (const id of ['health-fill', 'armor-fill', 'money', 'weapon', 'ammo', 'stars', 'objective', 'message', 'speed', 'damage-flash']) {
    el[id] = document.getElementById(id);
  }
  const minimap = document.getElementById('minimap');
  const mm = minimap.getContext('2d');
  const screens = {
    title: document.getElementById('screen-title'),
    pause: document.getElementById('screen-pause'),
    busted: document.getElementById('screen-busted'),
    wasted: document.getElementById('screen-wasted'),
  };
  const briefing = document.getElementById('briefing');
  const briefingTitle = document.getElementById('briefing-title');
  const briefingText = document.getElementById('briefing-text');
  const shop = document.getElementById('shop');

  let messageTimer = null;

  function showScreen(name) {
    for (const [k, s] of Object.entries(screens)) s.style.display = k === name ? 'flex' : 'none';
    root.style.display = name ? 'none' : 'block';
  }

  const hud = {
    message(text, kind = 'info') {
      el.message.textContent = text;
      el.message.className = `show ${kind}`;
      clearTimeout(messageTimer);
      messageTimer = setTimeout(() => { el.message.className = ''; }, 4000);
    },
    setObjective(text) { el.objective.textContent = text; },
    showBriefing(title, text) {
      briefingTitle.textContent = title;
      briefingText.textContent = text;
      briefing.style.display = 'block';
      setTimeout(() => { briefing.style.display = 'none'; }, 7000);
    },
    showShop() { shop.style.display = 'block'; },
    hideShop() { shop.style.display = 'none'; },
    flashDamage() {
      el['damage-flash'].style.opacity = '0.45';
      setTimeout(() => { el['damage-flash'].style.opacity = '0'; }, 120);
    },
    showTitle(canContinue) {
      document.getElementById('btn-continue').style.display = canContinue ? 'block' : 'none';
      showScreen('title');
    },
    showPause() { showScreen('pause'); },
    showBusted() { showScreen('busted'); },
    showWasted() { showScreen('wasted'); },
    hideScreens() { showScreen(null); },
    // Refresh the bars and readouts from the player state.
    update() {
      const p = world.player;
      el['health-fill'].style.width = `${Math.max(0, p.health)}%`;
      el['armor-fill'].style.width = `${Math.max(0, p.armor)}%`;
      el.money.textContent = `$${p.money.toLocaleString()}`;
      const w = { fists: 'Fists', pistol: 'P9 Pistol', smg: 'Vex SMG' }[p.weapon];
      el.weapon.textContent = w;
      el.ammo.textContent = p.weapon === 'fists' ? '—' : `${p.ammo[p.weapon]}`;
      const stars = Math.floor(world.police.stars);
      el.stars.textContent = '★'.repeat(stars) + '☆'.repeat(5 - stars);
      el.stars.style.color = stars > 0 ? '#ff4444' : '#888888';
      el.speed.textContent = p.car ? `${Math.round(Math.abs(p.car.speed) * 3.6)} km/h` : '';
      this.drawMinimap();
    },
    // Top-down minimap: roads, sea, markers, cars, police and the player.
    drawMinimap() {
      const S = 150;
      const B = world.city.bounds;
      const spanX = B.maxX - B.minX, spanZ = B.maxZ - B.minZ;
      const px = (x) => ((x - B.minX) / spanX) * S;
      const pz = (z) => ((z - B.minZ) / spanZ) * S;
      mm.clearRect(0, 0, S, S);
      mm.fillStyle = '#1c2733';
      mm.fillRect(0, 0, S, S);
      // Sea.
      mm.fillStyle = '#1e6f8e';
      mm.fillRect(px(252), 0, S - px(252), S);
      mm.fillRect(0, pz(252), S, S - pz(252));
      // Roads.
      mm.strokeStyle = '#4a4f55';
      mm.lineWidth = 2;
      for (const l of world.city.roadLines) {
        mm.beginPath(); mm.moveTo(px(l), 0); mm.lineTo(px(l), S); mm.stroke();
        mm.beginPath(); mm.moveTo(0, pz(l)); mm.lineTo(S, pz(l)); mm.stroke();
      }
      // Mission markers.
      mm.fillStyle = '#2fd6a3';
      for (const m of Object.values(world.city.markers)) {
        mm.beginPath(); mm.arc(px(m.x), pz(m.z), 3, 0, Math.PI * 2); mm.fill();
      }
      // Traffic (grey), police (red/blue), player (white triangle).
      mm.fillStyle = '#aaaaaa';
      for (const c of world.vehicles.traffic) mm.fillRect(px(c.x) - 1.5, pz(c.z) - 1.5, 3, 3);
      for (const c of world.police.list) {
        mm.fillStyle = '#ff4444';
        mm.beginPath(); mm.arc(px(c.x), pz(c.z), 3, 0, Math.PI * 2); mm.fill();
      }
      const p = world.player;
      mm.fillStyle = '#ffffff';
      mm.beginPath();
      mm.moveTo(px(p.x), pz(p.z) - 5);
      mm.lineTo(px(p.x) - 4, pz(p.z) + 4);
      mm.lineTo(px(p.x) + 4, pz(p.z) + 4);
      mm.closePath(); mm.fill();
    },
  };
  return hud;
}

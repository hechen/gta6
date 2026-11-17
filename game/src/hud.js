// The HUD: DOM panels for health, money, wanted stars, weapon and speed, a 2D canvas
// minimap drawn from the road graph with blips for the player, cars, police and the
// objective, plus the message feed and the mission banner. All of it is real DOM and canvas,
// so it shows in screenshots exactly as a player sees it.

export function createHud(city) {
  const el = (id) => document.getElementById(id);
  const healthBar = el('health-fill');
  const healthText = el('health-text');
  const armorBar = el('armor-fill');
  const moneyEl = el('money');
  const starsEl = el('stars');
  const weaponEl = el('weapon');
  const ammoEl = el('ammo');
  const speedEl = el('speed');
  const objectiveEl = el('objective');
  const objectiveTimer = el('objective-timer');
  const bannerEl = el('banner');
  const bannerTitle = el('banner-title');
  const bannerText = el('banner-text');
  const feedEl = el('feed');
  const minimap = el('minimap');
  const mapCtx = minimap.getContext('2d');
  const vignette = el('vignette');
  const crosshair = el('crosshair');
  let bannerTimer = 0;
  let lastStars = -1;

  const MAP_SIZE = 200;
  const SCALE = MAP_SIZE / 460; // the city plus a margin, in pixels per metre
  function mapX(x) {
    return MAP_SIZE / 2 + x * SCALE;
  }
  function mapZ(z) {
    return MAP_SIZE / 2 + z * SCALE;
  }

  function drawMinimap(world) {
    const ctx = mapCtx;
    ctx.clearRect(0, 0, MAP_SIZE, MAP_SIZE);
    ctx.fillStyle = '#1a2027';
    ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
    // Water at the south edge.
    ctx.fillStyle = '#2e7f9e';
    ctx.fillRect(0, mapZ(250), MAP_SIZE, MAP_SIZE - mapZ(250));
    // Blocks.
    ctx.fillStyle = '#3a4148';
    for (let j = 0; j < 9; j++) {
      for (let i = 0; i < 9; i++) {
        ctx.fillRect(mapX(-200 + i * 50 - 18), mapZ(-200 + j * 50 - 18), 36 * SCALE, 36 * SCALE);
      }
    }
    // Roads.
    ctx.strokeStyle = '#6a7076';
    ctx.lineWidth = 14 * SCALE;
    for (const e of city.edges) {
      const a = city.nodes[e.a];
      const b = city.nodes[e.b];
      ctx.beginPath();
      ctx.moveTo(mapX(a.x), mapZ(a.z));
      ctx.lineTo(mapX(b.x), mapZ(b.z));
      ctx.stroke();
    }
    const blip = (x, z, color, size) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(mapX(x), mapZ(z), size, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
    };
    // Objective marker first (under the player arrow).
    const obj = world.missions.objective;
    if (obj) {
      const pulse = 5 + Math.sin(world.time * 5) * 1.5;
      blip(obj.x, obj.z, '#ffd24a', pulse);
    }
    // Shops: garage, spray, gun shop, hospital.
    for (const key of ['garage', 'spray', 'gunshop', 'hospital']) {
      const l = city.locations[key];
      blip(l.x, l.z, '#7ec8ff', 3);
    }
    // Police cars in red-blue, traffic in grey.
    for (const car of world.vehicles.cars) {
      if (car.dead) continue;
      if (car.kind === 'police') blip(car.x, car.z, '#ff4d4d', 3.5);
      else if (car.kind === 'traffic') blip(car.x, car.z, '#9aa0a3', 2);
    }
    // The player: a white arrow that turns with them.
    const p = world.player;
    ctx.save();
    ctx.translate(mapX(p.x), mapZ(p.z));
    ctx.rotate(Math.atan2(Math.sin(p.heading), Math.cos(p.heading)) + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // North marker.
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', MAP_SIZE / 2, 12);
  }

  function message(text, tone) {
    const div = document.createElement('div');
    div.className = `feed-line feed-${tone || 'info'}`;
    div.textContent = text;
    feedEl.prepend(div);
    while (feedEl.children.length > 5) feedEl.removeChild(feedEl.lastChild);
    setTimeout(() => {
      if (div.parentNode) div.classList.add('feed-fade');
    }, 4200);
  }

  function banner(title, text, ms = 3600) {
    bannerTitle.textContent = title;
    bannerText.textContent = text;
    bannerEl.classList.add('banner-show');
    bannerTimer = ms / 1000;
  }

  function update(dt, world) {
    const p = world.player;
    healthBar.style.width = `${Math.max(0, p.health)}%`;
    healthText.textContent = `${Math.ceil(p.health)}`;
    armorBar.style.width = `${Math.max(0, p.armor)}%`;
    moneyEl.textContent = `$${Math.floor(p.money).toLocaleString('en-US')}`;
    const stars = world.police.stars;
    if (stars !== lastStars) {
      lastStars = stars;
      starsEl.textContent = '★'.repeat(stars) + '☆'.repeat(5 - stars);
      starsEl.classList.toggle('stars-hot', stars > 0);
    }
    const weaponNames = { fists: 'Fists', pistol: 'P9 Pistol', smg: 'Vex SMG' };
    weaponEl.textContent = weaponNames[p.weapon] || p.weapon;
    ammoEl.textContent = p.weapon === 'fists' ? '—' : `${p.ammo[p.weapon]} / ${p.reserve[p.weapon]}`;
    speedEl.textContent = p.car ? `${Math.round(Math.abs(p.car.speed) * 3.6)} km/h` : '';
    const obj = world.missions.objective;
    if (obj) {
      objectiveEl.textContent = obj.label;
      objectiveTimer.textContent = obj.timer > 0 ? `${Math.ceil(obj.timer)}s` : '';
      objectiveEl.parentElement.style.display = 'block';
    } else {
      objectiveEl.parentElement.style.display = 'none';
    }
    if (bannerTimer > 0) {
      bannerTimer -= dt;
      if (bannerTimer <= 0) bannerEl.classList.remove('banner-show');
    }
    vignette.style.opacity = p.health < 35 ? String(0.55 - p.health / 100) : '0';
    crosshair.style.display = p.weapon !== 'fists' && !p.car ? 'block' : 'none';
    drawMinimap(world);
  }

  return { update, message, banner };
}

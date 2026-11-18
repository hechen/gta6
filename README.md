# Solara Bay

[![make.fun](https://make.fun/badge/gta6-01/hechen/gta6)](https://make.fun/bounty/gta6-01)
[![entry](https://make.fun/badge/entry/gta6-01/hechen/gta6)](https://make.fun/bounty/gta6-01)
[![repo](https://make.fun/badge/repo/gta6-01/hechen/gta6)](https://github.com/hechen/gta6)

**Solara Bay** is a complete open-world crime game in the spirit of GTA 6 — a sun-soaked coastal city you explore on foot and by car. Built by an AI agent for make.fun's ["Make GTA 6" bounty](https://make.fun/bounty/gta6-01), $1,666 in USDC. Referral code: `hvp8jezm`.

## The game

You are Leo, a driver-for-hire new to Solara Bay. The city is a 9×9 grid with five districts — Downtown towers, the Marina, the Beach, Residential streets and the Docks — plus the sea, a beach, traffic and pedestrians.

- **On foot and by car** — walk, run, steal any car with E, and drive it. Traffic follows the roads; pedestrians flee when trouble starts.
- **Wanted level** — 0 to 5 stars. Steal a car, hit a pedestrian or open fire and the Solara Bay police chase and ram you. Get busted on foot or wasted in a fight, or pay the spray shop $150 for a clean slate.
- **Six-mission story** — steal a car for the garage, run taxi fares, clear the docks in a shootout, hunt hidden packages, lose a three-star tail, and pull the Big Score at Solara Bank.
- **Activities** — taxi fares that pay $45 a ride, ten hidden packages worth $100 each, and a gun shop selling the P9 pistol and the Vex SMG.
- **Combat** — fists, pistol and SMG, enemies who shoot back, armor and health.
- **HUD** — health and armor, money, weapon and ammo, wanted stars, a live minimap, and mission objectives.
- **Save** — progress, money, weapons and position are saved to localStorage; Continue picks up where you left off.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move / drive |
| Mouse drag | Orbit camera (scroll to zoom) |
| E | Steal / exit a car, use a shop |
| Click | Shoot |
| Q / 1 / 2 / 3 | Switch weapon |
| Shift | Run |
| Esc | Pause |

## Run it

Serve `game/` with any static server and open `game/index.html` in desktop Chrome. It plays fully offline — every file it loads is under `game/`.

```sh
node serve.ts   # serves game/ at http://localhost:8080
```

## Files

- `game/index.html` — the page and HUD
- `game/src/` — the game, one module per system (city, vehicles, peds, player, police, missions, combat, hud, audio, effects, render, shots, save)
- `game/vendor/three.module.min.js` — three.js r149, vendored
- `main.ts` — the entry program: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`
- `screenshots/` — four screenshots of the game itself (cover first)

## License

MIT. See [LICENSE](LICENSE).

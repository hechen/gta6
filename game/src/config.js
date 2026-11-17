// Solara Bay — every tuning number and colour in one place. The city is a 9x9 grid of
// blocks (block 36 m, street 14 m, pitch 50 m), about 450 m across, centred on the origin.
// Streets run along X (avenues) and Z (streets); the Marina and its beach sit on the south edge.

export const STEP = 1 / 60;

export const CITY = {
  blocks: 9,
  blockSize: 36,
  streetWidth: 14,
  pitch: 50,
  // Half the city span, in metres: the outermost road centre sits at +-halfSpan.
  halfSpan: 200,
};

export const DISTRICTS = [
  { name: 'Downtown', minX: -200, maxX: 0, minZ: -200, maxZ: -50, tall: true, hue: 0x8a93a6 },
  { name: 'Marina', minX: -200, maxX: 200, minZ: 100, maxZ: 200, tall: false, hue: 0x3f8f7a },
  { name: 'Old Town', minX: 0, maxX: 200, minZ: -200, maxZ: 0, tall: false, hue: 0xc9a06a },
  { name: 'Hills', minX: -200, maxX: 0, minZ: 0, maxZ: 100, tall: false, hue: 0x7a9a5a },
  { name: 'Industrial', minX: 0, maxX: 200, minZ: 0, maxZ: 100, tall: false, hue: 0x9a8a7a },
];

export const PLAYER = {
  radius: 0.55,
  walkSpeed: 4.2,
  runSpeed: 6.2,
  sprintSpeed: 9.0,
  jumpSpeed: 6.5,
  turnSpeed: 10,
  maxHealth: 100,
};

export const CAR = {
  // Arcade handling, per body style.
  sedan: { accel: 14, brake: 26, reverse: 8, topSpeed: 26, steer: 0.55, grip: 6.5, mass: 1 },
  coupe: { accel: 18, brake: 30, reverse: 9, topSpeed: 32, steer: 0.62, grip: 7.5, mass: 0.9 },
  sports: { accel: 24, brake: 34, reverse: 10, topSpeed: 40, steer: 0.7, grip: 8.5, mass: 0.85 },
  truck: { accel: 10, brake: 22, reverse: 7, topSpeed: 20, steer: 0.45, grip: 5.5, mass: 1.6 },
  taxi: { accel: 15, brake: 28, reverse: 8, topSpeed: 28, steer: 0.58, grip: 7, mass: 1 },
  police: { accel: 22, brake: 32, reverse: 9, topSpeed: 36, steer: 0.66, grip: 8, mass: 1 },
};

export const TRAFFIC = { cars: 14, maxSpeed: 12, keepDistance: 9 };
export const PEDS = { count: 22, walkSpeed: 1.6 };

export const WANTED = {
  maxStars: 5,
  // Seconds unseen before one star fades; a star fades every fadeStep seconds after that.
  fadeDelay: 18,
  fadeStep: 12,
  bustDistance: 1.6,
  bustTime: 2.0,
  // Police cars on the road per star level.
  carsPerStar: [0, 2, 3, 4, 5, 6],
  footCopsPerStar: [0, 1, 2, 3, 4, 5],
};

export const WEAPONS = {
  fists: { name: 'Fists', damage: 12, rate: 0.45, range: 2.2, auto: false, ammo: Infinity, spread: 0 },
  pistol: { name: 'P9 Pistol', damage: 22, rate: 0.28, range: 60, auto: false, ammo: 12, spread: 0.02, price: 300 },
  smg: { name: 'Vex SMG', damage: 14, rate: 0.09, range: 45, auto: true, ammo: 32, spread: 0.06, price: 900 },
};

export const MONEY = {
  start: 250,
  bustedFine: 100,
  wastedFine: 100,
  taxiFare: 60,
  packageValue: 150,
  sprayCost: 150,
};

export const PALETTE = {
  sky: 0x9fd4ef,
  horizon: 0xffd9a0,
  sun: 0xffe3b3,
  fog: 0xf7c98b,
  asphalt: 0x3a3f46,
  sidewalk: 0x9aa0a3,
  grass: 0x6fae56,
  sand: 0xe8d29a,
  water: 0x2e7f9e,
  buildingGlass: 0x5a7a9a,
  policeBlue: 0x2244cc,
  policeRed: 0xcc2222,
};

export const SAVE_KEY = 'solara-bay.save.v1';
export const BEST_KEY = 'solara-bay.best.v1';

/** Seconds a mission timer shows, and the names the HUD prints for the districts. */
export const MISSION_NAMES = [
  'Wheels Up',
  'The Pickup',
  'Repo Man',
  'Hot Pursuit',
  'Dockside',
  'The Big One',
];

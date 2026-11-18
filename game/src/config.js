// Solara Bay — tuning constants, districts and mission definitions.
// All numbers are game units (1 unit = 1 metre) unless noted.

export const CONFIG = {
  // City layout: a 9x9 grid of blocks. Each block is 44 units, roads are 12 wide.
  gridBlocks: 9,
  blockSize: 44,
  roadWidth: 12,
  get citySpan() { return this.gridBlocks * (this.blockSize + this.roadWidth); },

  // Districts by grid cell (col, row), 0..8. Each cell belongs to one district.
  // Downtown: tall towers in the centre-north. Marina: east edge by the water.
  // Beach: south edge. Residential: west. Docks: north-east industrial.
  districts: [
    { name: 'Downtown', color: 0x3d5a80, minH: 26, maxH: 70, density: 0.9 },
    { name: 'Marina', color: 0x2a9d8f, minH: 10, maxH: 26, density: 0.7 },
    { name: 'Beach', color: 0xe9c46a, minH: 6, maxH: 14, density: 0.4 },
    { name: 'Residential', color: 0x8ab17d, minH: 8, maxH: 18, density: 0.8 },
    { name: 'Docks', color: 0x6d6875, minH: 8, maxH: 22, density: 0.6 },
  ],
  // Which district each grid cell is (index into districts), row-major, 9x9.
  districtMap: [
    4, 4, 0, 0, 0, 0, 0, 1, 1,
    4, 4, 0, 0, 0, 0, 0, 1, 1,
    3, 3, 0, 0, 0, 0, 0, 1, 1,
    3, 3, 3, 0, 0, 0, 1, 1, 1,
    3, 3, 3, 3, 0, 1, 1, 1, 1,
    3, 3, 3, 3, 2, 2, 1, 1, 1,
    3, 3, 3, 2, 2, 2, 2, 1, 1,
    2, 2, 2, 2, 2, 2, 2, 2, 1,
    2, 2, 2, 2, 2, 2, 2, 2, 2,
  ],

  // Water: the sea sits east of the city and along the south beach.
  seaEast: 30,        // metres of sea east of the last road
  seaSouth: 46,       // metres of sea south of the last road
  beachDepth: 26,     // sand strip along the south edge

  // Player
  walkSpeed: 7,
  runSpeed: 11,
  playerHealth: 100,
  playerArmor: 50,

  // Driving
  carAccel: 26,
  carBrake: 40,
  carMaxSpeed: 42,
  carMaxReverse: 12,
  carSteer: 1.9,
  carGrip: 4.5,

  // Traffic and pedestrians
  trafficCars: 14,
  parkedCars: 10,
  pedestrians: 22,
  trafficSpeed: 9,

  // Wanted / police
  maxStars: 5,
  policeCars: 6,
  sprayCost: 150,
  bustDistance: 6,
  bustTime: 2.5,

  // Economy
  startMoney: 250,
  taxiFare: 45,
  packageReward: 100,
  missionReward: [400, 500, 700, 600, 800, 1500],
  gunPrices: { pistol: 200, smg: 800 },
  ammoPrice: 60,

  // Combat
  pistolDamage: 34,
  smgDamage: 16,
  fistDamage: 12,
  enemyHealth: 60,

  // Hidden packages
  packageCount: 10,

  // Screenshots
  shotSize: { w: 1280, h: 800 },
};

// The six story missions. Each has a title, a briefing, an objective type and a
// target the mission code resolves (garage, fares, rivals, packages, heat, bank).
export const MISSIONS = [
  {
    id: 0, title: 'Wheels Up',
    brief: "Mara needs wheels. Steal any car on the street and bring it to the garage on Marina Row.",
    objective: 'Steal a car and reach the garage',
    type: 'steal',
  },
  {
    id: 1, title: 'Taxi Rush',
    brief: 'The cab company is short a driver. Run three fares around Solara Bay and keep the meter running.',
    objective: 'Complete 3 taxi fares',
    type: 'taxi',
  },
  {
    id: 2, title: 'Dockside',
    brief: 'Rivals are moving product through the docks. Take them out, grab the briefcase, and get clear.',
    objective: 'Eliminate the rivals and take the briefcase',
    type: 'shootout',
  },
  {
    id: 3, title: 'Package Run',
    brief: 'Mara stashed ten packages across the city before the heat came down. Find five of them.',
    objective: 'Collect 5 hidden packages',
    type: 'packages',
  },
  {
    id: 4, title: 'Heat',
    brief: 'The whole department is on you. Lose a three-star wanted level — outrun them or pay the spray shop.',
    objective: 'Reach 3 stars, then lose the heat',
    type: 'heat',
  },
  {
    id: 5, title: 'The Big Score',
    brief: 'One last job. Hit the Solara Bank vault, grab the cash, and lose a four-star tail to the safehouse.',
    objective: 'Rob the bank and reach the safehouse',
    type: 'heist',
  },
];

export const WEAPONS = {
  fists: { name: 'Fists', damage: 12, range: 2.4, rate: 0.45, auto: false, ammo: Infinity },
  pistol: { name: 'P9 Pistol', damage: 34, range: 60, rate: 0.32, auto: false, ammo: 24 },
  smg: { name: 'Vex SMG', damage: 16, range: 45, rate: 0.09, auto: true, ammo: 60 },
};

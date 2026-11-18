// Seeded RNG (mulberry32) plus helpers, so the city and the staged screenshots
// are deterministic: the same seed always builds the same Solara Bay.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    // Float in [min, max).
    range(min, max) { return min + next() * (max - min); },
    // Integer in [min, max].
    int(min, max) { return Math.floor(this.range(min, max + 1)); },
    // Pick one item from an array.
    pick(arr) { return arr[Math.floor(next() * arr.length)]; },
    // Chance roll: true with probability p.
    chance(p) { return next() < p; },
    // A stable random unit vector in the XZ plane.
    dir2() { const a = next() * Math.PI * 2; return { x: Math.cos(a), z: Math.sin(a) }; },
  };
}

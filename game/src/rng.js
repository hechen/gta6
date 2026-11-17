// A small seeded random generator (mulberry32) and the helpers the city, traffic and
// missions use, so one seed always builds the same Solara Bay.

export function createRandom(seed) {
  let a = seed >>> 0;
  function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    /** A float in [min, max). */
    range(min, max) {
      return min + next() * (max - min);
    },
    /** An integer in [min, max] inclusive. */
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    /** One element of an array. */
    pick(items) {
      return items[Math.floor(next() * items.length)];
    },
    /** True with the given probability. */
    chance(p) {
      return next() < p;
    },
    /** A random angle in radians. */
    angle() {
      return next() * Math.PI * 2;
    },
  };
}

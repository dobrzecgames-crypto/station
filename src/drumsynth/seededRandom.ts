export type RandomSource = () => number

/**
 * Deterministic PRNG (mulberry32): the same seed always produces the same
 * sequence, so a saved DUST render is reproducible while live preview can
 * still pick a fresh seed on every trigger. No `Math.random()` involved once
 * a seed is chosen.
 */
export function createSeededRandom(seed: number): RandomSource {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Only the seed's own selection is non-deterministic - the generator it feeds is not. */
export function createRandomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff)
}

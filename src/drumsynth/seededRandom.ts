import type { DrumKickPatch } from './drumSynthTypes'

export type RandomSource = () => number

/**
 * Deterministic PRNG (mulberry32): the same seed always produces the same
 * sequence. No `Math.random()` is involved once a seed is chosen.
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

/** Stable per-patch seed: repeated KICK previews and ADD TO PAD use identical noise. */
export function createKickSeed(patch: DrumKickPatch): number {
  const values = [patch.tune, patch.punch, patch.body, patch.click, patch.decay, patch.tone, patch.drive, patch.dust]
  let hash = 0x811c9dc5
  for (const value of values) {
    const text = Number.isFinite(value) ? value.toString() : '0'
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index)
      hash = Math.imul(hash, 0x01000193)
    }
    hash ^= 0xff
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

export interface TapeParameters {
  amount: number
  saturationMix: number
  drive: number
  lowpassHz: number
  headBumpDb: number
  outputGain: number
  pitchWear: number
  noiseGain: number
  levelIrregularity: number
}

export interface TapePitchLfo {
  frequencyHz: number
  maximumCents: number
  delayDepthSeconds: number
}

export interface TapePitchProfile {
  lfos: readonly [TapePitchLfo, TapePitchLfo, TapePitchLfo, TapePitchLfo]
  baseDelaySeconds: number
  maximumCents: number
}

const centsPerUnitRate = 1200 / Math.LN2

export function clampTapeAmount(value: unknown, fallback = 0.32): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(1, Math.max(0, value))
}

/**
 * TAPE is a macro, not a dry/wet control. Every process has its own onset and
 * curve so the first fifth stays subtle while wear becomes apparent later.
 */
export function mapTapeParameters(value: unknown): TapeParameters {
  const amount = clampTapeAmount(value, 0)
  if (amount === 0) {
    return {
      amount: 0,
      saturationMix: 0,
      drive: 1,
      lowpassHz: 20000,
      headBumpDb: 0,
      outputGain: 1,
      pitchWear: 0,
      noiseGain: 0,
      levelIrregularity: 0,
    }
  }

  const saturationMix = 0.58 * amount ** 0.88
  const drive = 1 + 1.7 * amount ** 1.25
  const lowpassWear = amount ** 1.7
  const lowpassHz = 20000 * (6200 / 20000) ** lowpassWear
  const headBumpDb = 0.25 * amount + Math.sin(Math.PI * amount) ** 1.25
  const pitchWear = smoothstep(0.18, 1, amount) ** 1.35
  const noiseGain = 0.006 * smoothstep(0.28, 1, amount) ** 1.55
  const levelIrregularity = 0.025 * smoothstep(0.68, 1, amount) ** 1.4
  // Saturation already rounds peaks. This small, always-non-positive trim
  // offsets the head bump without making TAPE win comparisons by loudness.
  const compensationDb = -(0.18 * saturationMix + 0.08 * headBumpDb + 0.08 * amount ** 2)
  const outputGain = 10 ** (compensationDb / 20)

  return { amount, saturationMix, drive, lowpassHz, headBumpDb, outputGain, pitchWear, noiseGain, levelIrregularity }
}

export function isTapeBypassed(enabled: boolean, amount: unknown): boolean {
  return !enabled || clampTapeAmount(amount, 0) === 0
}

/** A gentle, derivative-at-zero-unity transfer used by the fixed WaveShaper. */
export function createTapeSaturationCurve(length = 2048): Float32Array<ArrayBuffer> {
  const safeLength = Math.max(32, Math.min(65536, Math.floor(length)))
  const curve = new Float32Array(new ArrayBuffer(safeLength * Float32Array.BYTES_PER_ELEMENT))
  const softness = 0.78
  for (let index = 0; index < safeLength; index += 1) {
    const x = (index / (safeLength - 1)) * 2 - 1
    curve[index] = Math.tanh(softness * x) / softness
  }
  return curve
}

/**
 * Four incommensurate components avoid ideal periodic vibrato. Their summed
 * worst-case rate change is two cents at maximum wear. Frequencies vary by a
 * stable slot-derived seed, so separate racks do not move in lockstep.
 */
export function createTapePitchProfile(seed: string): TapePitchProfile {
  const random = createSeededRandom(hashSeed(seed))
  const definitions = [
    { frequencyHz: 0.18, maximumCents: 0.75 },
    { frequencyHz: 0.29, maximumCents: 0.35 },
    { frequencyHz: 4.7, maximumCents: 0.3 },
    { frequencyHz: 0.047, maximumCents: 0.6 },
  ] as const
  const lfos = definitions.map(({ frequencyHz, maximumCents }) => {
    const variedFrequency = frequencyHz * (0.96 + random() * 0.08)
    const delayDepthSeconds = maximumCents / (centsPerUnitRate * 2 * Math.PI * variedFrequency)
    return { frequencyHz: variedFrequency, maximumCents, delayDepthSeconds }
  }) as unknown as TapePitchProfile['lfos']
  const baseDelaySeconds = lfos.reduce((sum, lfo) => sum + lfo.delayDepthSeconds, 0)
  return { lfos, baseDelaySeconds, maximumCents: lfos.reduce((sum, lfo) => sum + lfo.maximumCents, 0) }
}

/** Precomputed, softly correlated hiss; no random work happens in the audio loop. */
export function createTapeNoiseData(sampleRate: number, durationSeconds: number, seed: string, channelCount: 1 | 2): Float32Array<ArrayBuffer>[] {
  const safeRate = Math.round(Math.min(192000, Math.max(8000, Number.isFinite(sampleRate) ? sampleRate : 48000)))
  const safeDuration = Math.min(10, Math.max(0.1, Number.isFinite(durationSeconds) ? durationSeconds : 4.096))
  const length = Math.max(1, Math.round(safeRate * safeDuration))
  return Array.from({ length: channelCount }, (_, channelIndex) => {
    const output = new Float32Array(new ArrayBuffer(length * Float32Array.BYTES_PER_ELEMENT))
    const random = createSeededRandom(hashSeed(`${seed}:${channelIndex}`))
    let slow = 0
    for (let index = 0; index < length; index += 1) {
      const white = random() * 2 - 1
      slow = slow * 0.985 + white * 0.015
      output[index] = white * 0.72 + slow * 0.28
    }
    return output
  })
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const x = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)))
  return x * x * (3 - 2 * x)
}

function hashSeed(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0 || 1
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x100000000
  }
}

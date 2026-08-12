export const polyWavetableFrameCount = 16
export const polyWavetableSize = 512
export const polyWavetableMipHarmonics = [1, 2, 4, 8, 16, 32, 64, 128] as const

export interface PolyWavetableDefinition {
  id: string
  name: string
  family: 'BASIC' | 'SOFT' | 'DIGITAL' | 'HARMONIC' | 'GLASS' | 'HOLLOW' | 'AGGRESSIVE' | 'TEXTURE' | 'MOTION'
  slope: number
  odd: number
  even: number
  formant: number
  phase: number
  motion: number
  seed: number
}

const table = (family: PolyWavetableDefinition['family'], id: string, name: string, slope: number, odd: number, even: number, formant: number, phase: number, motion: number, seed: number): PolyWavetableDefinition => ({ family, id, name, slope, odd, even, formant, phase, motion, seed })

export const polyWavetableBank: readonly PolyWavetableDefinition[] = [
  table('BASIC', 'basic-sine', 'SINE', 8, 1, 0, 1, 0, 0, 1),
  table('BASIC', 'basic-triangle', 'TRIANGLE', 2, 1, 0, 1, 1, .08, 2),
  table('BASIC', 'basic-saw', 'SAW', 1, 1, 1, 1, .12, .12, 3),
  table('BASIC', 'basic-square', 'SQUARE', 1, 1, 0, 1, .08, .18, 4),
  table('BASIC', 'basic-pulse', 'PULSE', .95, 1, .35, 1, .2, .75, 5),
  table('SOFT', 'soft-cotton', 'COTTON', 2.35, 1, .55, .7, .15, .3, 11),
  table('SOFT', 'soft-velvet', 'VELVET', 2.65, 1, .35, 1.4, .2, .45, 12),
  table('SOFT', 'soft-bloom', 'BLOOM', 2.05, 1, .8, 2.1, .3, .7, 13),
  table('SOFT', 'soft-haze', 'HAZE', 2.8, 1, .6, 3.2, .55, .8, 14),
  table('DIGITAL', 'digital-code', 'CODE', 1.2, .65, 1, 3.8, .75, .7, 21),
  table('DIGITAL', 'digital-grid', 'GRID', 1.05, 1, .5, 5.2, .95, .8, 22),
  table('DIGITAL', 'digital-byte', 'BYTE', .9, .45, 1, 7.5, 1.2, .9, 23),
  table('DIGITAL', 'digital-fold', 'FOLD', .85, 1, .75, 9, 1.5, 1, 24),
  table('DIGITAL', 'digital-prism', 'PRISM', 1.35, .7, 1, 11, 1.8, .65, 25),
  table('HARMONIC', 'harmonic-thirds', 'THIRDS', 1.45, 1, .3, 3, .35, .55, 31),
  table('HARMONIC', 'harmonic-fifths', 'FIFTHS', 1.4, .45, 1, 5, .45, .6, 32),
  table('HARMONIC', 'harmonic-organ', 'ORGAN', 1.75, 1, .6, 6, .15, .35, 33),
  table('HARMONIC', 'harmonic-choir', 'CHOIR', 2.1, 1, .7, 8, .5, .75, 34),
  table('GLASS', 'glass-clear', 'CLEAR GLASS', 1.55, .35, 1, 9, 1.4, .7, 41),
  table('GLASS', 'glass-bell', 'BELL', 1.15, .3, 1, 13, 1.9, .8, 42),
  table('GLASS', 'glass-ice', 'ICE', 1.05, .55, 1, 17, 2.2, .9, 43),
  table('GLASS', 'glass-crystal', 'CRYSTAL', .95, .25, 1, 21, 2.5, 1, 44),
  table('HOLLOW', 'hollow-tube', 'TUBE', 1.5, 1, .18, 4.5, .6, .55, 51),
  table('HOLLOW', 'hollow-wood', 'WOOD', 1.85, 1, .25, 7, .45, .6, 52),
  table('HOLLOW', 'hollow-vowel', 'VOWEL', 1.6, .8, .35, 12, .8, 1, 53),
  table('HOLLOW', 'hollow-cave', 'CAVE', 2.05, 1, .12, 18, 1.1, .85, 54),
  table('AGGRESSIVE', 'aggressive-edge', 'EDGE', .82, 1, .9, 6, 1.2, .7, 61),
  table('AGGRESSIVE', 'aggressive-razor', 'RAZOR', .72, .65, 1, 10, 1.7, .85, 62),
  table('AGGRESSIVE', 'aggressive-tear', 'TEAR', .68, 1, .55, 15, 2.1, 1, 63),
  table('AGGRESSIVE', 'aggressive-iron', 'IRON', .76, .4, 1, 23, 2.6, .9, 64),
  table('TEXTURE', 'texture-grain', 'GRAIN', 1.7, .8, .8, 4, 2.4, 1, 71),
  table('TEXTURE', 'texture-dust', 'DUST', 1.95, 1, .65, 8, 2.8, .95, 72),
  table('TEXTURE', 'texture-wire', 'WIRE', 1.35, .5, 1, 14, 3.1, .85, 73),
  table('TEXTURE', 'texture-cloud', 'CLOUD', 2.25, 1, .75, 20, 2.5, 1, 74),
  table('MOTION', 'motion-orbit', 'ORBIT', 1.55, .75, 1, 5, 1.1, 1.4, 81),
  table('MOTION', 'motion-tide', 'TIDE', 2, 1, .55, 9, .8, 1.6, 82),
  table('MOTION', 'motion-vector', 'VECTOR', 1.25, .55, 1, 14, 1.8, 1.8, 83),
  table('MOTION', 'motion-scan', 'SCAN', 1.05, 1, .45, 19, 2.2, 2, 84),
  table('MOTION', 'motion-aurora', 'AURORA', 1.85, .7, 1, 25, 2.7, 2.2, 85),
  table('MOTION', 'motion-pulsefield', 'PULSE FIELD', 1.1, 1, .3, 31, 3, 2.4, 86),
]

export interface GeneratedPolyWavetable {
  definition: PolyWavetableDefinition
  levels: readonly { harmonicLimit: number; frames: readonly Float32Array[] }[]
}

const generated = new Map<string, GeneratedPolyWavetable>()

export function getPolyWavetableDefinition(id: string): PolyWavetableDefinition {
  return polyWavetableBank.find((candidate) => candidate.id === id) ?? polyWavetableBank[0]
}

export function generatePolyWavetable(id: string): GeneratedPolyWavetable {
  const definition = getPolyWavetableDefinition(id)
  const cached = generated.get(definition.id)
  if (cached) return cached
  const levels = polyWavetableMipHarmonics.map((harmonicLimit) => ({
    harmonicLimit,
    frames: Array.from({ length: polyWavetableFrameCount }, (_, frame) => generateFrame(definition, frame, harmonicLimit)),
  }))
  const result = { definition, levels }
  generated.set(definition.id, result)
  return result
}

export function interpolateWavetablePosition(frames: readonly Float32Array[], position: number, sampleIndex: number): number {
  if (frames.length === 0) return 0
  const bounded = clamp(position, 0, 1) * (frames.length - 1)
  const first = Math.floor(bounded)
  const second = Math.min(frames.length - 1, first + 1)
  const mix = bounded - first
  return frames[first][sampleIndex] + (frames[second][sampleIndex] - frames[first][sampleIndex]) * mix
}

export function interpolateWavetableSample(frame: Float32Array, phase: number): number {
  if (frame.length === 0) return 0
  const index = ((phase % 1) + 1) % 1 * frame.length
  const first = Math.floor(index) % frame.length
  const second = (first + 1) % frame.length
  const mix = index - Math.floor(index)
  return frame[first] + (frame[second] - frame[first]) * mix
}

function generateFrame(definition: PolyWavetableDefinition, frameIndex: number, harmonicLimit: number): Float32Array {
  const frame = new Float32Array(polyWavetableSize)
  const morph = frameIndex / (polyWavetableFrameCount - 1)
  for (let harmonic = 1; harmonic <= harmonicLimit; harmonic += 1) {
    const amplitude = harmonicAmplitude(definition, harmonic, morph)
    if (Math.abs(amplitude) < 1e-7) continue
    const phase = harmonicPhase(definition, harmonic, morph)
    for (let sample = 0; sample < frame.length; sample += 1) frame[sample] += amplitude * Math.sin(Math.PI * 2 * harmonic * sample / frame.length + phase)
  }
  let peak = 0
  for (const sample of frame) peak = Math.max(peak, Math.abs(sample))
  const scale = peak > 0 ? .92 / peak : 1
  for (let sample = 0; sample < frame.length; sample += 1) frame[sample] *= scale
  return frame
}

function harmonicAmplitude(definition: PolyWavetableDefinition, harmonic: number, morph: number): number {
  if (definition.id === 'basic-sine') return harmonic === 1 ? 1 : 0
  if (definition.id === 'basic-triangle') return harmonic % 2 === 1 ? ((harmonic - 1) / 2 % 2 === 0 ? 1 : -1) / harmonic ** 2 : 0
  if (definition.id === 'basic-saw') return (harmonic % 2 ? 1 : -1) / harmonic * (1 - morph * .22 * harmonic / 128)
  if (definition.id === 'basic-square') return harmonic % 2 === 1 ? 1 / harmonic : 0
  if (definition.id === 'basic-pulse') {
    const duty = .5 - morph * .4
    return 2 * Math.sin(Math.PI * harmonic * duty) / (Math.PI * harmonic)
  }
  const parity = harmonic % 2 === 1 ? definition.odd : definition.even
  const center = 1 + definition.formant * (.35 + .65 * morph)
  const formant = .38 + .62 * Math.exp(-Math.pow(Math.log2(Math.max(1, harmonic) / center), 2) / .7)
  const ripple = .68 + .32 * Math.sin(harmonic * (.47 + definition.seed * .013) + morph * Math.PI * 2 * definition.motion)
  const movingNotch = 1 - .72 * Math.exp(-Math.pow(harmonic - (2 + morph * definition.formant), 2) / Math.max(2, definition.formant * .45))
  return parity * formant * ripple * movingNotch / harmonic ** definition.slope
}

function harmonicPhase(definition: PolyWavetableDefinition, harmonic: number, morph: number): number {
  const random = hash01(definition.seed * 131 + harmonic * 17)
  return (random - .5) * definition.phase + morph * definition.motion * Math.sin(harmonic * .37 + definition.seed)
}

function hash01(value: number): number {
  const x = Math.sin(value * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

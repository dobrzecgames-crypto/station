import type { CorrectionFrame } from './correctionPlan.ts'

export type TuneGravityShifter = 'tdPsola' | 'granular'

export interface PitchShiftOptions {
  frameSize: number
  hopSize: number
  boundaryFadeMs: number
}

const defaultPitchShiftOptions: PitchShiftOptions = {
  frameSize: 2048,
  hopSize: 256,
  boundaryFadeMs: 12,
}

/**
 * Time-domain PSOLA prototype for monophonic voiced regions. Repositioning
 * pitch-synchronous waveform periods changes F0 without resampling the whole
 * region, so its short-time spectral envelope (and therefore formants) stays
 * substantially more stable for modest corrections than in a grain resampler.
 */
export function shiftPitchTdPsola(
  input: Float32Array,
  sampleRate: number,
  plan: readonly CorrectionFrame[],
  overrides: Partial<PitchShiftOptions> = {},
): Float32Array {
  const options = { ...defaultPitchShiftOptions, ...overrides }
  const output = new Float32Array(input)
  const accumulation = new Float64Array(input.length)
  const weights = new Float64Array(input.length)
  const coverage = new Float32Array(input.length)
  const regions = findVoicedRegions(plan, input.length, options.hopSize)

  for (const region of regions) {
    const marks = createPitchMarks(input, plan, region.startSample, region.endSample)
    if (marks.length < 3) continue
    let synthesisMark = marks[0]!
    let sourceMarkIndex = 0
    while (synthesisMark <= marks[marks.length - 1]!) {
      while (sourceMarkIndex + 1 < marks.length && Math.abs(marks[sourceMarkIndex + 1]! - synthesisMark) < Math.abs(marks[sourceMarkIndex]! - synthesisMark)) sourceMarkIndex += 1
      const sourceMark = marks[sourceMarkIndex]!
      const sourcePeriod = localPeriod(marks, sourceMarkIndex)
      const frame = interpolatePlan(plan, synthesisMark)
      const ratio = clamp(frame?.pitchRatio ?? 1, 0.75, 1.334)
      addPsolaGrain(input, accumulation, weights, coverage, sourceMark, synthesisMark, sourcePeriod)
      synthesisMark += Math.max(2, sourcePeriod / ratio)
    }
    applyAccumulation(output, input, accumulation, weights, coverage, region, sampleRate, options.boundaryFadeMs)
  }
  return output
}

/**
 * Deliberately simpler comparison path. Every fixed grain is locally
 * resampled, which preserves duration but moves formants with pitch. It is
 * useful as a baseline and is not the recommended production algorithm.
 */
export function shiftPitchGranular(
  input: Float32Array,
  sampleRate: number,
  plan: readonly CorrectionFrame[],
  overrides: Partial<PitchShiftOptions> = {},
): Float32Array {
  const options = { ...defaultPitchShiftOptions, ...overrides }
  const output = new Float32Array(input)
  const accumulation = new Float64Array(input.length)
  const weights = new Float64Array(input.length)
  const coverage = new Float32Array(input.length)
  const regions = findVoicedRegions(plan, input.length, options.hopSize)
  const halfWindow = Math.floor(options.frameSize / 2)
  const grainHop = Math.max(options.hopSize, halfWindow)

  for (const region of regions) {
    for (let center = region.startSample; center <= region.endSample; center += grainHop) {
      const frame = interpolatePlan(plan, center)
      const ratio = clamp(frame?.pitchRatio ?? 1, 0.75, 1.334)
      for (let offset = -halfWindow; offset <= halfWindow; offset += 1) {
        const outputIndex = center + offset
        if (outputIndex < region.startSample || outputIndex > region.endSample || outputIndex < 0 || outputIndex >= input.length) continue
        const normalized = offset / halfWindow
        const window = 0.5 + 0.5 * Math.cos(Math.PI * normalized)
        const sourcePosition = center + offset * ratio
        accumulation[outputIndex] += interpolateSample(input, sourcePosition) * window
        weights[outputIndex] += window
        coverage[outputIndex] = 1
      }
    }
    applyAccumulation(output, input, accumulation, weights, coverage, region, sampleRate, options.boundaryFadeMs)
  }
  return output
}

interface VoicedRegion {
  startSample: number
  endSample: number
}

function findVoicedRegions(plan: readonly CorrectionFrame[], sampleCount: number, hopSize: number): VoicedRegion[] {
  const regions: VoicedRegion[] = []
  let firstFrame = -1
  for (let index = 0; index <= plan.length; index += 1) {
    const frame = plan[index]
    const correctable = frame?.voiced === true && frame.frequencyHz !== null && Math.abs(frame.correctionCents) > 0.05
    if (correctable && firstFrame < 0) firstFrame = index
    if ((!correctable || index === plan.length) && firstFrame >= 0) {
      const lastFrame = index - 1
      regions.push({
        startSample: Math.max(0, plan[firstFrame]!.centerSample - hopSize),
        endSample: Math.min(sampleCount - 1, plan[lastFrame]!.centerSample + hopSize),
      })
      firstFrame = -1
    }
  }
  return regions.filter((region) => region.endSample - region.startSample >= hopSize * 2)
}

function createPitchMarks(input: Float32Array, plan: readonly CorrectionFrame[], startSample: number, endSample: number): number[] {
  const seedFrame = interpolatePlan(plan, startSample)
  if (!seedFrame?.frequencyHz) return []
  const seedPeriod = seedFrame.frequencyHz > 0 ? inputSampleRate(plan) / seedFrame.frequencyHz : 0
  if (!Number.isFinite(seedPeriod) || seedPeriod < 2) return []
  const seed = refinePitchMark(input, startSample + seedPeriod, Math.max(2, Math.floor(seedPeriod * 0.3)), startSample, endSample)
  const forward = [seed]
  let current = seed
  while (current < endSample) {
    const frequency = interpolatePlan(plan, current)?.frequencyHz
    if (!frequency) break
    const period = inputSampleRate(plan) / frequency
    const next = refinePitchMark(input, current + period, Math.max(2, Math.floor(period * 0.25)), current + 2, endSample)
    if (next <= current + 1 || next > endSample) break
    forward.push(next)
    current = next
  }
  const backward: number[] = []
  current = seed
  while (current > startSample) {
    const frequency = interpolatePlan(plan, current)?.frequencyHz
    if (!frequency) break
    const period = inputSampleRate(plan) / frequency
    const previous = refinePitchMark(input, current - period, Math.max(2, Math.floor(period * 0.25)), startSample, current - 2)
    if (previous >= current - 1 || previous < startSample) break
    backward.push(previous)
    current = previous
  }
  backward.reverse()
  return [...backward, ...forward]
}

/** PitchFrame time and centerSample encode the analysis sample rate exactly. */
function inputSampleRate(plan: readonly CorrectionFrame[]): number {
  for (const frame of plan) if (frame.timeSeconds > 0) return frame.centerSample / frame.timeSeconds
  return 48000
}

function refinePitchMark(input: Float32Array, predicted: number, radius: number, minimum: number, maximum: number): number {
  const start = Math.max(Math.ceil(minimum), Math.floor(predicted - radius), 0)
  const end = Math.min(Math.floor(maximum), Math.ceil(predicted + radius), input.length - 1)
  let bestIndex = clamp(Math.round(predicted), start, end)
  let bestValue = Number.NEGATIVE_INFINITY
  for (let index = start; index <= end; index += 1) {
    if (input[index]! > bestValue) {
      bestValue = input[index]!
      bestIndex = index
    }
  }
  return bestIndex
}

function localPeriod(marks: readonly number[], index: number): number {
  if (index > 0 && index + 1 < marks.length) return Math.max(2, (marks[index + 1]! - marks[index - 1]!) / 2)
  if (index + 1 < marks.length) return Math.max(2, marks[index + 1]! - marks[index]!)
  return Math.max(2, marks[index]! - marks[index - 1]!)
}

function addPsolaGrain(
  input: Float32Array,
  accumulation: Float64Array,
  weights: Float64Array,
  coverage: Float32Array,
  sourceMark: number,
  synthesisMark: number,
  period: number,
): void {
  const radius = Math.max(2, Math.round(period))
  for (let offset = -radius; offset <= radius; offset += 1) {
    const outputIndex = Math.round(synthesisMark) + offset
    const inputIndex = sourceMark + offset
    if (outputIndex < 0 || outputIndex >= input.length || inputIndex < 0 || inputIndex >= input.length) continue
    const window = 0.5 + 0.5 * Math.cos(Math.PI * offset / radius)
    accumulation[outputIndex] += input[inputIndex]! * window
    weights[outputIndex] += window
    coverage[outputIndex] = 1
  }
}

function applyAccumulation(
  output: Float32Array,
  input: Float32Array,
  accumulation: Float64Array,
  weights: Float64Array,
  coverage: Float32Array,
  region: VoicedRegion,
  sampleRate: number,
  boundaryFadeMs: number,
): void {
  const fadeSamples = Math.max(1, Math.round(sampleRate * boundaryFadeMs / 1000))
  for (let index = region.startSample; index <= region.endSample; index += 1) {
    if (!coverage[index] || weights[index]! < 1e-6) continue
    const processed = accumulation[index]! / weights[index]!
    const edgeDistance = Math.min(index - region.startSample, region.endSample - index)
    const blend = smoothstep(0, fadeSamples, edgeDistance)
    output[index] = input[index]! + (processed - input[index]!) * blend
  }
}

function interpolatePlan(plan: readonly CorrectionFrame[], sample: number): CorrectionFrame | null {
  if (plan.length === 0) return null
  let low = 0
  let high = plan.length - 1
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (plan[middle]!.centerSample < sample) low = middle + 1
    else high = middle
  }
  if (low === 0) return plan[0]!
  const before = plan[low - 1]!
  const after = plan[low]!
  return Math.abs(before.centerSample - sample) <= Math.abs(after.centerSample - sample) ? before : after
}

function interpolateSample(input: Float32Array, position: number): number {
  const first = Math.floor(position)
  const second = first + 1
  const fraction = position - first
  const firstValue = input[first] ?? 0
  const secondValue = input[second] ?? firstValue
  return firstValue + (secondValue - firstValue) * fraction
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const normalized = clamp((value - edge0) / Math.max(1e-9, edge1 - edge0), 0, 1)
  return normalized * normalized * (3 - 2 * normalized)
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

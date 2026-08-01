export type PitchDetectorKind = 'yin' | 'mpm'

export interface PitchDetectorOptions {
  detector: PitchDetectorKind
  frameSize: number
  hopSize: number
  minimumFrequencyHz: number
  maximumFrequencyHz: number
  confidenceThreshold: number
  rmsThreshold: number
  yinThreshold: number
}

export interface PitchFrame {
  frameIndex: number
  centerSample: number
  timeSeconds: number
  frequencyHz: number | null
  confidence: number
  rms: number
  voiced: boolean
}

export const defaultPitchDetectorOptions: PitchDetectorOptions = {
  detector: 'yin',
  frameSize: 2048,
  hopSize: 256,
  minimumFrequencyHz: 65,
  maximumFrequencyHz: 1000,
  confidenceThreshold: 0.72,
  rmsThreshold: 0.006,
  yinThreshold: 0.14,
}

/**
 * Analyses a mono signal without touching browser or React state. The same
 * pure function can run in an offline quality spike and, after profiling, be
 * moved behind an AudioWorklet boundary without changing the pitch model.
 */
export function analyzePitch(
  input: Float32Array,
  sampleRate: number,
  overrides: Partial<PitchDetectorOptions> = {},
): PitchFrame[] {
  const options = resolvePitchDetectorOptions(sampleRate, overrides)
  if (input.length === 0) return []

  const frameCount = Math.max(1, Math.ceil(Math.max(0, input.length - options.frameSize) / options.hopSize) + 1)
  const frames: PitchFrame[] = []
  const frame = new Float32Array(options.frameSize)

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const start = frameIndex * options.hopSize
    copyFrameWithDcRemoval(input, start, frame)
    const rms = rootMeanSquare(frame)
    const estimate = rms >= options.rmsThreshold
      ? options.detector === 'yin'
        ? estimateYin(frame, sampleRate, options)
        : estimateMpm(frame, sampleRate, options)
      : null
    const confidence = estimate?.confidence ?? 0
    const voiced = estimate !== null && confidence >= options.confidenceThreshold
    const centerSample = Math.min(input.length - 1, start + Math.floor(options.frameSize / 2))
    frames.push({
      frameIndex,
      centerSample,
      timeSeconds: centerSample / sampleRate,
      frequencyHz: voiced ? estimate.frequencyHz : null,
      confidence,
      rms,
      voiced,
    })
  }
  return frames
}

export function resolvePitchDetectorOptions(sampleRate: number, overrides: Partial<PitchDetectorOptions>): PitchDetectorOptions {
  const options = { ...defaultPitchDetectorOptions, ...overrides }
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) throw new Error('Tune Gravity requires a positive sample rate.')
  if (!Number.isInteger(options.frameSize) || options.frameSize < 256) throw new Error('Tune Gravity frameSize must be an integer of at least 256 samples.')
  if (!Number.isInteger(options.hopSize) || options.hopSize < 1 || options.hopSize > options.frameSize) throw new Error('Tune Gravity hopSize must fit inside frameSize.')
  if (options.minimumFrequencyHz <= 0 || options.maximumFrequencyHz <= options.minimumFrequencyHz) throw new Error('Tune Gravity pitch range is invalid.')
  if (Math.ceil(sampleRate / options.minimumFrequencyHz) >= options.frameSize) throw new Error('Tune Gravity frameSize is too short for the requested minimum frequency.')
  return options
}

function copyFrameWithDcRemoval(input: Float32Array, start: number, output: Float32Array): void {
  let mean = 0
  for (let index = 0; index < output.length; index += 1) mean += input[start + index] ?? 0
  mean /= output.length
  for (let index = 0; index < output.length; index += 1) output[index] = (input[start + index] ?? 0) - mean
}

function rootMeanSquare(frame: Float32Array): number {
  let energy = 0
  for (const sample of frame) energy += sample * sample
  return Math.sqrt(energy / frame.length)
}

function estimateYin(
  frame: Float32Array,
  sampleRate: number,
  options: PitchDetectorOptions,
): { frequencyHz: number; confidence: number } | null {
  const minimumLag = Math.max(2, Math.floor(sampleRate / options.maximumFrequencyHz))
  const maximumLag = Math.min(frame.length - 2, Math.ceil(sampleRate / options.minimumFrequencyHz))
  const comparisonLength = frame.length - maximumLag
  const difference = new Float64Array(maximumLag + 1)
  const cumulative = new Float64Array(maximumLag + 1)

  for (let lag = 1; lag <= maximumLag; lag += 1) {
    let sum = 0
    for (let index = 0; index < comparisonLength; index += 1) {
      const delta = frame[index]! - frame[index + lag]!
      sum += delta * delta
    }
    difference[lag] = sum
  }

  cumulative[0] = 1
  let runningSum = 0
  for (let lag = 1; lag <= maximumLag; lag += 1) {
    runningSum += difference[lag]!
    cumulative[lag] = runningSum > 0 ? difference[lag]! * lag / runningSum : 1
  }

  let selectedLag = -1
  for (let lag = minimumLag; lag < maximumLag; lag += 1) {
    if (cumulative[lag]! >= options.yinThreshold) continue
    while (lag + 1 <= maximumLag && cumulative[lag + 1]! < cumulative[lag]!) lag += 1
    selectedLag = lag
    break
  }
  if (selectedLag < 0) {
    let bestValue = Number.POSITIVE_INFINITY
    for (let lag = minimumLag; lag <= maximumLag; lag += 1) {
      if (cumulative[lag]! < bestValue) {
        bestValue = cumulative[lag]!
        selectedLag = lag
      }
    }
  }
  if (selectedLag < 0) return null
  const refinedLag = parabolicMinimum(cumulative, selectedLag)
  const confidence = clamp01(1 - cumulative[selectedLag]!)
  const frequencyHz = sampleRate / refinedLag
  return Number.isFinite(frequencyHz) ? { frequencyHz, confidence } : null
}

/** McLeod Pitch Method core: normalized square difference peak selection. */
function estimateMpm(
  frame: Float32Array,
  sampleRate: number,
  options: PitchDetectorOptions,
): { frequencyHz: number; confidence: number } | null {
  const minimumLag = Math.max(2, Math.floor(sampleRate / options.maximumFrequencyHz))
  const maximumLag = Math.min(frame.length - 2, Math.ceil(sampleRate / options.minimumFrequencyHz))
  const comparisonLength = frame.length - maximumLag
  const nsdf = new Float64Array(maximumLag + 1)

  for (let lag = minimumLag; lag <= maximumLag; lag += 1) {
    let correlation = 0
    let energy = 0
    for (let index = 0; index < comparisonLength; index += 1) {
      const first = frame[index]!
      const second = frame[index + lag]!
      correlation += first * second
      energy += first * first + second * second
    }
    nsdf[lag] = energy > 0 ? 2 * correlation / energy : 0
  }

  const peaks: number[] = []
  for (let lag = minimumLag + 1; lag < maximumLag; lag += 1) {
    if (nsdf[lag]! > nsdf[lag - 1]! && nsdf[lag]! >= nsdf[lag + 1]!) peaks.push(lag)
  }
  if (peaks.length === 0) return null
  let highest = 0
  for (const lag of peaks) highest = Math.max(highest, nsdf[lag]!)
  const cutoff = Math.max(options.confidenceThreshold, highest * 0.93)
  const selectedLag = peaks.find((lag) => nsdf[lag]! >= cutoff) ?? peaks.reduce((best, lag) => nsdf[lag]! > nsdf[best]! ? lag : best)
  const refinedLag = parabolicMaximum(nsdf, selectedLag)
  const frequencyHz = sampleRate / refinedLag
  return Number.isFinite(frequencyHz) ? { frequencyHz, confidence: clamp01(nsdf[selectedLag]!) } : null
}

function parabolicMinimum(values: Float64Array, index: number): number {
  return parabolicExtremum(values, index)
}

function parabolicMaximum(values: Float64Array, index: number): number {
  return parabolicExtremum(values, index)
}

function parabolicExtremum(values: Float64Array, index: number): number {
  if (index <= 0 || index >= values.length - 1) return index
  const left = values[index - 1]!
  const center = values[index]!
  const right = values[index + 1]!
  const denominator = left - 2 * center + right
  if (Math.abs(denominator) < 1e-12) return index
  return index + clamp((left - right) / (2 * denominator), -1, 1)
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

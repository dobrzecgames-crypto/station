export interface SliceRegion {
  startSeconds: number
  endSeconds: number
}

export interface TransientCandidate {
  timeSeconds: number
  strength: number
}

const minimumGapSeconds = 0.06
/** How far above the clip's own noise floor a bucket's level must sit before
    a rise there can count as a real transient - a fraction of the floor-to-peak
    range, not a fixed absolute number, so a quiet melodic take and a hot drum
    loop are each judged against their own dynamic range instead of one shared
    number tuned for neither. */
const levelFloorFraction = 0.1
/** Nudges an accepted cut to the nearest zero-crossing (or, failing that, the
    quietest nearby sample) within this many seconds either side - small enough
    to never be felt as a moved cut, large enough to reliably find one. */
const snapWindowSeconds = 0.008
/** Shared by manual ADD SLICE, EQUAL and SMART alike - CHOP no longer assumes
    a slice needs a pad waiting for it (see docs/DECISIONS.md); only the first
    padCount (16) slices ever reach the live pad grid, the rest stay list-only. */
export const maxChopSliceCount = 32

export function equalSliceRegions(durationSeconds: number, count: number): SliceRegion[] {
  const sliceCount = Math.max(1, Math.min(maxChopSliceCount, Math.round(count)))
  return Array.from({ length: sliceCount }, (_, index) => ({
    startSeconds: durationSeconds * index / sliceCount,
    endSeconds: durationSeconds * (index + 1) / sliceCount,
  }))
}

/**
 * `envelope` is a real-buffer RMS scan (see AudioEngine.getAnalysisEnvelope),
 * far finer than the old UI waveform cache this used to run on. `rawChannel`/
 * `sampleRate` are the decoded source's own samples, used only for the final
 * zero-crossing snap - kept as plain typed-array/number rather than an
 * AudioBuffer so this module stays free of any Web Audio dependency.
 */
export function detectTransientCandidates(envelope: readonly number[], durationSeconds: number, rawChannel: Float32Array, sampleRate: number): TransientCandidate[] {
  if (envelope.length < 3 || durationSeconds <= 0) return []
  const secondsPerBucket = durationSeconds / envelope.length
  const rises = envelope.map((level, index) => (index === 0 ? 0 : level - envelope[index - 1]))
  const levelFloor = adaptiveLevelFloor(envelope)

  const localPeaks: TransientCandidate[] = []
  for (let index = 1; index < rises.length - 1; index += 1) {
    if (rises[index] <= 0 || envelope[index] < levelFloor) continue
    if (rises[index] < rises[index - 1] || rises[index] < rises[index + 1]) continue
    localPeaks.push({ timeSeconds: index * secondsPerBucket, strength: rises[index] })
  }

  const debounced: TransientCandidate[] = []
  for (const candidate of localPeaks) {
    const previous = debounced[debounced.length - 1]
    if (previous && candidate.timeSeconds - previous.timeSeconds < minimumGapSeconds) {
      if (candidate.strength > previous.strength) debounced[debounced.length - 1] = candidate
      continue
    }
    debounced.push(candidate)
  }

  return debounced.map((candidate) => ({ ...candidate, timeSeconds: snapToSafePoint(rawChannel, sampleRate, candidate.timeSeconds) }))
}

/**
 * A floor relative to this clip's own quiet-to-loud range instead of one fixed
 * number: the 10th percentile stands in for "noise floor", and a rise only
 * counts once its bucket clears a small fraction of the distance from there up
 * to the clip's peak. A near-silent recording (all buckets close together)
 * falls back to the peak itself, so a flat, pulse-less clip yields no
 * candidates rather than firing on its own noise floor.
 */
function adaptiveLevelFloor(envelope: readonly number[]): number {
  const sorted = [...envelope].sort((left, right) => left - right)
  const noiseFloor = sorted[Math.floor(sorted.length * 0.1)] ?? 0
  const peak = sorted[sorted.length - 1] ?? 0
  return peak > noiseFloor ? noiseFloor + (peak - noiseFloor) * levelFloorFraction : peak
}

/**
 * Prefers the nearest true zero-crossing within the window (a sign change
 * between consecutive samples); falls back to the quietest single sample in
 * the window when the audio never actually crosses zero there (e.g. a fully
 * DC-offset or one-sided waveform). Either way the cut lands where the
 * waveform is momentarily at or near silence instead of mid-cycle, which is
 * what actually causes an audible click.
 */
function snapToSafePoint(rawChannel: Float32Array, sampleRate: number, approxSeconds: number, windowSeconds: number = snapWindowSeconds): number {
  const centerIndex = Math.round(approxSeconds * sampleRate)
  const halfWindow = Math.max(1, Math.round(windowSeconds * sampleRate))
  const lowIndex = Math.max(1, centerIndex - halfWindow)
  const highIndex = Math.min(rawChannel.length - 1, centerIndex + halfWindow)

  let bestIndex = -1
  let bestDistance = Infinity
  for (let index = lowIndex; index <= highIndex; index += 1) {
    if ((rawChannel[index - 1] <= 0) === (rawChannel[index] <= 0)) continue
    const distance = Math.abs(index - centerIndex)
    if (distance < bestDistance) { bestDistance = distance; bestIndex = index }
  }
  if (bestIndex >= 0) return bestIndex / sampleRate

  let quietestIndex = centerIndex
  let quietestMagnitude = Math.abs(rawChannel[centerIndex] ?? 0)
  for (let index = lowIndex; index <= highIndex; index += 1) {
    const magnitude = Math.abs(rawChannel[index])
    if (magnitude < quietestMagnitude) { quietestMagnitude = magnitude; quietestIndex = index }
  }
  return quietestIndex / sampleRate
}

export function maxSmartSliceCount(candidateCount: number): number {
  return Math.max(1, Math.min(maxChopSliceCount, candidateCount + 1))
}

export function smartSliceRegions(candidates: readonly TransientCandidate[], count: number, durationSeconds: number): SliceRegion[] {
  const sliceCount = Math.max(1, Math.min(maxSmartSliceCount(candidates.length), Math.round(count)))
  const cutCount = sliceCount - 1
  const cutTimes = [...candidates]
    .sort((a, b) => b.strength - a.strength)
    .slice(0, cutCount)
    .map((candidate) => candidate.timeSeconds)
    .sort((a, b) => a - b)
  const boundaries = [0, ...cutTimes, durationSeconds]
  return boundaries.slice(0, -1).map((startSeconds, index) => ({ startSeconds, endSeconds: boundaries[index + 1] }))
}

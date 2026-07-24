export interface SliceRegion {
  startSeconds: number
  endSeconds: number
}

export interface TransientCandidate {
  timeSeconds: number
  strength: number
}

const minimumGapSeconds = 0.06
const minimumAmplitude = 0.02
export const maxAutoSliceCount = 16

export function equalSliceRegions(durationSeconds: number, count: number): SliceRegion[] {
  const sliceCount = Math.max(1, Math.min(maxAutoSliceCount, Math.round(count)))
  return Array.from({ length: sliceCount }, (_, index) => ({
    startSeconds: durationSeconds * index / sliceCount,
    endSeconds: durationSeconds * (index + 1) / sliceCount,
  }))
}

export function detectTransientCandidates(peaks: readonly number[], durationSeconds: number): TransientCandidate[] {
  if (peaks.length < 3 || durationSeconds <= 0) return []
  const secondsPerBucket = durationSeconds / peaks.length
  const rises = peaks.map((peak, index) => (index === 0 ? 0 : peak - peaks[index - 1]))

  const localPeaks: TransientCandidate[] = []
  for (let index = 1; index < rises.length - 1; index += 1) {
    if (rises[index] <= 0 || peaks[index] < minimumAmplitude) continue
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
  return debounced
}

export function maxSmartSliceCount(candidateCount: number): number {
  return Math.max(1, Math.min(maxAutoSliceCount, candidateCount + 1))
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

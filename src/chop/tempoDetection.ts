import type { TransientCandidate } from './autoChopOperations'

export type TempoConfidence = 'certain' | 'probable' | 'uncertain'

export interface TempoDetectionResult {
  /** null when there isn't enough of a pulse to show a number as anything
      more than a guess - the UI must not present that as a real BPM. */
  bpm: number | null
  confidence: TempoConfidence
}

/** Matches the project's own BPM range (see TempoPanel.tsx's slider bounds) -
    a detected tempo outside this is folded to an in-range octave instead of
    being reported as-is, since a groovebox never runs the transport at 35 or
    280 BPM anyway. */
const minimumBpm = 60
const maximumBpm = 200
const binWidthBpm = 2
/** How many bars a plausible loop might be - used only to raise confidence
    when the source's own length agrees with the onset-derived tempo, never
    to produce the headline number itself. */
const plausibleBarCounts = [1, 2, 4, 8, 16]
const durationAgreementTolerance = 0.03

/** Halves/doubles into [minimumBpm, maximumBpm] rather than clamping, so 70
    and 140 both fold to themselves (already in range) and can each gather
    their own votes below - a half-time/double-time pair is two real, distinct
    readings of the same pulse, not one to be merged or clipped away. */
function foldIntoRange(bpm: number): number {
  let folded = bpm
  let iterations = 0
  while (folded < minimumBpm && iterations < 32) { folded *= 2; iterations += 1 }
  while (folded > maximumBpm && iterations < 32) { folded /= 2; iterations += 1 }
  return folded
}

/**
 * Tempo from how far apart real onsets are, not from the source's duration.
 * Standard inter-onset-interval histogram: every pair of onsets implies a
 * candidate tempo (folded into range), weighted by how strong both onsets
 * were, and the tallest bin wins. Pairwise rather than adjacent-only so one
 * missed or spurious onset can't derail the estimate - a real pulse still
 * shows up in plenty of the other pairings.
 *
 * Duration-implied bar counts are consulted only afterward, only to raise
 * confidence on close agreement - never to compute the number and never to
 * lower confidence when they disagree (a loop is not obligated to be a round
 * number of bars for an onset-based reading of it to be correct).
 */
export function detectTempo(candidates: readonly TransientCandidate[], durationSeconds: number): TempoDetectionResult {
  if (candidates.length < 2 || durationSeconds <= 0) return { bpm: null, confidence: 'uncertain' }

  const bins = new Map<number, { weight: number; weightedBpmSum: number }>()
  let totalWeight = 0
  for (let firstIndex = 0; firstIndex < candidates.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < candidates.length; secondIndex += 1) {
      const intervalSeconds = candidates[secondIndex].timeSeconds - candidates[firstIndex].timeSeconds
      if (intervalSeconds <= 0) continue
      const foldedBpm = foldIntoRange(60 / intervalSeconds)
      const weight = candidates[firstIndex].strength * candidates[secondIndex].strength
      if (weight <= 0) continue
      const bin = Math.round(foldedBpm / binWidthBpm)
      const entry = bins.get(bin) ?? { weight: 0, weightedBpmSum: 0 }
      entry.weight += weight
      entry.weightedBpmSum += foldedBpm * weight
      bins.set(bin, entry)
      totalWeight += weight
    }
  }
  if (totalWeight <= 0 || bins.size === 0) return { bpm: null, confidence: 'uncertain' }

  const [, winner] = [...bins.entries()].sort((left, right) => right[1].weight - left[1].weight)[0]
  const bpm = Math.round(foldIntoRange(winner.weightedBpmSum / winner.weight))
  const concentration = winner.weight / totalWeight

  const durationAgrees = plausibleBarCounts
    .map((bars) => foldIntoRange(bars * 4 * 60 / durationSeconds))
    .some((guess) => Math.abs(guess - bpm) / bpm < durationAgreementTolerance)

  let confidence: TempoConfidence =
    candidates.length >= 8 && concentration >= 0.5 ? 'certain' :
    candidates.length >= 4 && concentration >= 0.3 ? 'probable' :
    'uncertain'
  if (durationAgrees && confidence === 'probable') confidence = 'certain'
  if (durationAgrees && confidence === 'uncertain') confidence = 'probable'

  return { bpm, confidence }
}

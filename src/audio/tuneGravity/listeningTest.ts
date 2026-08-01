import type { ProjectKey } from '../../music/scales.ts'

export const tuneGravityListeningTestFormatVersion = 1 as const

export const tuneGravityComparisonVariantIds = ['original', 'yin-td-psola', 'yin-granular', 'mpm-td-psola'] as const
export type TuneGravityComparisonVariantId = typeof tuneGravityComparisonVariantIds[number]
export type TuneGravityBlindLabel = 'A' | 'B' | 'C' | 'D'

export const tuneGravityRatingKeys = [
  'intonationImprovement',
  'timbreNaturalness',
  'pitchStability',
  'vibratoPreservation',
  'consonantQuality',
  'freedomFromGrainAndMetal',
  'voiceIdentityPreservation',
  'beatReadiness',
] as const
export type TuneGravityRatingKey = typeof tuneGravityRatingKeys[number]

export const tuneGravityProblemFlags = [
  'octave-error',
  'note-chatter',
  'formant-shift',
  'damaged-consonant',
  'damaged-breath',
  'click',
  'graininess',
  'metallic',
  'unstable-pitch',
  'identity-change',
  'other',
] as const
export type TuneGravityListeningProblemFlag = typeof tuneGravityProblemFlags[number]

export type TuneGravityRatings = Record<TuneGravityRatingKey, number>

export interface TuneGravityBlindEvaluation {
  ratings: TuneGravityRatings
  flags: TuneGravityListeningProblemFlag[]
  notes: string
  savedAt: string
}

export interface TuneGravityListeningSettings {
  projectKey: ProjectKey
  gravity: number
  speed: number
  humanize: number
}

export interface TuneGravityBlindSession {
  format: 'station-tune-gravity-listening-test'
  version: typeof tuneGravityListeningTestFormatVersion
  anonymousSourceId: string
  seed: number
  createdAt: string
  completedAt: string | null
  labels: TuneGravityBlindLabel[]
  settings: TuneGravityListeningSettings
  mapping: Record<TuneGravityBlindLabel, TuneGravityComparisonVariantId>
  evaluations: Partial<Record<TuneGravityBlindLabel, TuneGravityBlindEvaluation>>
}

export interface TuneGravityListeningTestExport {
  format: TuneGravityBlindSession['format']
  version: TuneGravityBlindSession['version']
  anonymousSourceId: string
  seed: number
  createdAt: string
  completedAt: string | null
  settings: TuneGravityListeningSettings
  labels: TuneGravityBlindLabel[]
  evaluations: TuneGravityBlindSession['evaluations']
  mapping: Record<TuneGravityBlindLabel, TuneGravityComparisonVariantId> | null
}

export function createTuneGravityBlindSession(
  anonymousSourceId: string,
  settings: TuneGravityListeningSettings,
  seed: number,
  variants: readonly TuneGravityComparisonVariantId[] = tuneGravityComparisonVariantIds,
  createdAt = new Date().toISOString(),
): TuneGravityBlindSession {
  if (variants.length < 2 || variants.length > 4) throw new Error('A Tune Gravity blind test requires two to four variants.')
  if (new Set(variants).size !== variants.length) throw new Error('Tune Gravity blind variants must be unique.')
  const shuffled = deterministicShuffle(variants, seed)
  const labels = ['A', 'B', 'C', 'D'].slice(0, shuffled.length) as TuneGravityBlindLabel[]
  const mapping = Object.fromEntries(labels.map((label, index) => [label, shuffled[index]!])) as Record<TuneGravityBlindLabel, TuneGravityComparisonVariantId>
  return {
    format: 'station-tune-gravity-listening-test',
    version: tuneGravityListeningTestFormatVersion,
    anonymousSourceId,
    seed: seed >>> 0,
    createdAt,
    completedAt: null,
    labels,
    settings: { ...settings, projectKey: { ...settings.projectKey } },
    mapping,
    evaluations: {},
  }
}

export function saveTuneGravityBlindEvaluation(
  session: TuneGravityBlindSession,
  label: TuneGravityBlindLabel,
  evaluation: Omit<TuneGravityBlindEvaluation, 'savedAt'>,
  savedAt = new Date().toISOString(),
): TuneGravityBlindSession {
  if (session.completedAt !== null) throw new Error('A completed Tune Gravity blind test cannot be edited.')
  if (!session.labels.includes(label)) throw new Error(`Blind label ${label} is not part of this test.`)
  validateRatings(evaluation.ratings)
  const flags = [...new Set(evaluation.flags)]
  if (flags.some((flag) => !tuneGravityProblemFlags.includes(flag))) throw new Error('The listening test contains an unknown problem flag.')
  return {
    ...session,
    evaluations: {
      ...session.evaluations,
      [label]: { ratings: { ...evaluation.ratings }, flags, notes: evaluation.notes.trim(), savedAt },
    },
  }
}

export function completeTuneGravityBlindSession(
  session: TuneGravityBlindSession,
  completedAt = new Date().toISOString(),
): TuneGravityBlindSession {
  if (!session.labels.every((label) => session.evaluations[label] !== undefined)) throw new Error('Rate every blind variant before revealing the mapping.')
  return { ...session, completedAt }
}

export function revealTuneGravityBlindMapping(
  session: TuneGravityBlindSession,
): Record<TuneGravityBlindLabel, TuneGravityComparisonVariantId> | null {
  return session.completedAt === null ? null : { ...session.mapping }
}

export function exportTuneGravityListeningTest(session: TuneGravityBlindSession): TuneGravityListeningTestExport {
  return {
    format: session.format,
    version: session.version,
    anonymousSourceId: session.anonymousSourceId,
    seed: session.seed,
    createdAt: session.createdAt,
    completedAt: session.completedAt,
    settings: { ...session.settings, projectKey: { ...session.settings.projectKey } },
    labels: [...session.labels],
    evaluations: structuredCloneEvaluations(session.evaluations),
    mapping: revealTuneGravityBlindMapping(session),
  }
}

export function comparisonVariantForBlindLabel(
  session: TuneGravityBlindSession,
  label: TuneGravityBlindLabel,
): TuneGravityComparisonVariantId {
  if (!session.labels.includes(label)) throw new Error(`Blind label ${label} is not part of this test.`)
  return session.mapping[label]
}

export function createOriginalComparisonAudio(samples: Float32Array): Float32Array {
  return new Float32Array(samples)
}

export function createDefaultTuneGravityRatings(value = 3): TuneGravityRatings {
  const rating = clampRating(value)
  return Object.fromEntries(tuneGravityRatingKeys.map((key) => [key, rating])) as unknown as TuneGravityRatings
}

function deterministicShuffle<T>(values: readonly T[], seed: number): T[] {
  const output = [...values]
  let state = (seed >>> 0) || 0x6d2b79f5
  const random = () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 0x100000000
  }
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    const value = output[index]!
    output[index] = output[swapIndex]!
    output[swapIndex] = value
  }
  return output
}

function validateRatings(ratings: TuneGravityRatings): void {
  for (const key of tuneGravityRatingKeys) {
    const value = ratings[key]
    if (!Number.isInteger(value) || value < 1 || value > 5) throw new Error(`Listening rating ${key} must be an integer from 1 to 5.`)
  }
}

function clampRating(value: number): number {
  return Math.max(1, Math.min(5, Math.round(value)))
}

function structuredCloneEvaluations(
  evaluations: TuneGravityBlindSession['evaluations'],
): TuneGravityBlindSession['evaluations'] {
  return Object.fromEntries(Object.entries(evaluations).map(([label, evaluation]) => [label, evaluation === undefined ? undefined : {
    ratings: { ...evaluation.ratings }, flags: [...evaluation.flags], notes: evaluation.notes, savedAt: evaluation.savedAt,
  }]))
}

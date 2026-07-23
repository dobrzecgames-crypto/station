import type { PatternVariantName } from '../patterns/patternTypes'

export type TransportMode = 'pattern' | 'song'

export interface PatternClip {
  id: string
  patternGroupId: string
  variant: PatternVariantName
  startSlot: number
}

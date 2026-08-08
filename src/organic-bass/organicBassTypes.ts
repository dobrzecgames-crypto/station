export type OrganicBassPatchId = string

/**
 * The public surface deliberately stays at nine sound controls. Base note and
 * sequencer gate remain part of the serializable patch because Station maps a
 * shared source across pads and schedules note lengths in the audio layer.
 */
export interface OrganicBassPatch {
  id: OrganicBassPatchId
  name: string
  baseMidiNote: number
  shape: number
  weight: number
  cutoff: number
  resonance: number
  contour: number
  attackSeconds: number
  decay: number
  drive: number
  glide: number
  gate: number
}

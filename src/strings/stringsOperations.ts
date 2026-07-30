import type { PadState } from '../pads/types'
import type { PatternGroup } from '../patterns/patternTypes'
import { maximumSynthMidiNote, minimumSynthMidiNote } from '../synth/synthOperations'
import type { StringsPatch, StringsPatchId } from './stringsTypes'

export const maximumStringsVoices = 8
export const minimumStringsMidiNote = minimumSynthMidiNote
export const maximumStringsMidiNote = maximumSynthMidiNote

export function createDefaultStringsPatch(id: StringsPatchId, name = 'STRINGS'): StringsPatch {
  return {
    id,
    name,
    baseMidiNote: 48,
    detuneCents: 9,
    brightness: 0.5,
    ensemble: 0.55,
    vibrato: 0.18,
    level: 0.75,
    gate: 0.92,
    ampEnvelope: { attackSeconds: 0.3, decaySeconds: 0.4, sustain: 0.88, releaseSeconds: 0.8 },
  }
}

export function cloneStringsPatch(patch: StringsPatch): StringsPatch {
  return { ...patch, ampEnvelope: { ...patch.ampEnvelope } }
}

export function assignStringsSource(pad: PadState, stringsPatchId: StringsPatchId, chordIntervals: readonly number[] = [0]): PadState {
  return {
    ...pad,
    assetId: null,
    fileName: null,
    durationSeconds: null,
    region: { startSeconds: 0, endSeconds: 0 },
    slices: [],
    chopSessionId: null,
    synthPatchId: null,
    stringsPatchId,
    chordIntervals: [...chordIntervals],
  }
}

export function removeUnreferencedStringsPatches(group: PatternGroup): PatternGroup {
  const referenced = new Set(group.bank.pads.flatMap((pad) => pad.stringsPatchId ? [pad.stringsPatchId] : []))
  return { ...group, stringsPatches: group.stringsPatches.filter((patch) => referenced.has(patch.id)).map(cloneStringsPatch) }
}

export function getStringsPatch(group: PatternGroup, patchId: StringsPatchId | null): StringsPatch | undefined {
  return patchId ? group.stringsPatches.find((patch) => patch.id === patchId) : undefined
}

export function resolveStringsPadMidiNotes(patch: StringsPatch, pad: Pick<PadState, 'pitchSemitones' | 'chordIntervals'>): number[] {
  return pad.chordIntervals.map((interval) => patch.baseMidiNote + pad.pitchSemitones + interval)
}

/** Musical log taper: BRIGHTNESS reads as a tone knob, not a raw Hz slider. */
export function stringsBrightnessToHz(brightness: number): number {
  const clamped = Math.min(1, Math.max(0, brightness))
  const minimumHz = 200
  const maximumHz = 8000
  return minimumHz * (maximumHz / minimumHz) ** clamped
}

export const stringsPresetNames = ['WARM STRINGS', 'SLOW ORCHESTRA', 'DISCO STRINGS', 'DARK PAD', 'SYNTH BRASS', 'SOFT CHOIR'] as const
export type StringsPresetName = typeof stringsPresetNames[number]

type StringsPresetValues = Omit<StringsPatch, 'id'>

const stringsPresetValues: Record<StringsPresetName, StringsPresetValues> = {
  'WARM STRINGS': { name: 'WARM STRINGS', baseMidiNote: 48, detuneCents: 9, brightness: 0.46, ensemble: 0.65, vibrato: 0.18, level: 0.75, gate: 0.92, ampEnvelope: { attackSeconds: 0.3, decaySeconds: 0.4, sustain: 0.88, releaseSeconds: 0.8 } },
  'SLOW ORCHESTRA': { name: 'SLOW ORCHESTRA', baseMidiNote: 48, detuneCents: 10, brightness: 0.5, ensemble: 0.85, vibrato: 0.15, level: 0.72, gate: 0.95, ampEnvelope: { attackSeconds: 1.8, decaySeconds: 0.5, sustain: 0.9, releaseSeconds: 1.8 } },
  'DISCO STRINGS': { name: 'DISCO STRINGS', baseMidiNote: 55, detuneCents: 8, brightness: 0.78, ensemble: 0.6, vibrato: 0.12, level: 0.78, gate: 0.85, ampEnvelope: { attackSeconds: 0.06, decaySeconds: 0.25, sustain: 0.85, releaseSeconds: 0.5 } },
  'DARK PAD': { name: 'DARK PAD', baseMidiNote: 43, detuneCents: 7, brightness: 0.26, ensemble: 0.4, vibrato: 0.1, level: 0.7, gate: 0.95, ampEnvelope: { attackSeconds: 1.2, decaySeconds: 0.6, sustain: 0.85, releaseSeconds: 1.5 } },
  'SYNTH BRASS': { name: 'SYNTH BRASS', baseMidiNote: 55, detuneCents: 6, brightness: 0.68, ensemble: 0.28, vibrato: 0.05, level: 0.78, gate: 0.8, ampEnvelope: { attackSeconds: 0.04, decaySeconds: 0.2, sustain: 0.8, releaseSeconds: 0.3 } },
  'SOFT CHOIR': { name: 'SOFT CHOIR', baseMidiNote: 48, detuneCents: 8, brightness: 0.35, ensemble: 0.55, vibrato: 0.25, level: 0.7, gate: 0.92, ampEnvelope: { attackSeconds: 0.7, decaySeconds: 0.45, sustain: 0.85, releaseSeconds: 1.2 } },
}

/** Applies a preset's sound, keeping the patch's `id` so existing pad references stay valid. */
export function applyStringsPreset(patch: StringsPatch, presetName: StringsPresetName): StringsPatch {
  const values = stringsPresetValues[presetName]
  return { ...patch, ...values, ampEnvelope: { ...values.ampEnvelope } }
}

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


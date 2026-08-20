import type { PadState } from '../pads/types'
import type { PatternGroup } from '../patterns/patternTypes'
import type { SynthLfoDivision, SynthPatch, SynthPatchId } from './synthTypes'

export const minimumSynthMidiNote = 12
export const maximumSynthMidiNote = 108
export const minimumChordInterval = -24
export const maximumChordInterval = 24
export const maximumSynthVoices = 5

export function createDefaultSynthPatch(id: SynthPatchId, name = 'BASSIC'): SynthPatch {
  return {
    id,
    name,
    mode: 'mono',
    baseMidiNote: 36,
    oscillator1: { waveform: 'sawtooth', octave: 0, detuneCents: 0, level: 0.62 },
    oscillator2: { waveform: 'triangle', octave: 0, detuneCents: 0, level: 0.38 },
    sub: { waveform: 'sine', octave: -1, level: 0.28 },
    ampEnvelope: { attackSeconds: 0.008, decaySeconds: 0.22, sustain: 0.72, releaseSeconds: 0.18 },
    filter: {
      cutoffHz: 1450,
      resonance: 2.5,
      envelopeAttackSeconds: 0.006,
      envelopeDecaySeconds: 0.32,
      envelopeAmountSemitones: 22,
    },
    lfo: { waveform: 'sine', division: '1/8', depthSemitones: 0 },
    drive: 0.18,
    glideSeconds: 0.06,
    gate: 0.82,
  }
}

export function cloneSynthPatch(patch: SynthPatch): SynthPatch {
  return {
    ...patch,
    oscillator1: { ...patch.oscillator1 },
    oscillator2: { ...patch.oscillator2 },
    sub: { ...patch.sub },
    ampEnvelope: { ...patch.ampEnvelope },
    filter: { ...patch.filter },
    lfo: { ...patch.lfo },
  }
}

export function assignSynthSource(pad: PadState, synthPatchId: SynthPatchId, chordIntervals: readonly number[] = [0]): PadState {
  return {
    ...pad,
    assetId: null,
    fileName: null,
    durationSeconds: null,
    region: { startSeconds: 0, endSeconds: 0 },
    reversed: false,
    slices: [],
    chopSessionId: null,
    synthPatchId,
    organicBassPatchId: null,
    polyPatchId: null,
    chordIntervals: [...chordIntervals],
  }
}

export function clearPadSource(pad: PadState): PadState {
  return {
    ...pad,
    assetId: null,
    fileName: null,
    durationSeconds: null,
    region: { startSeconds: 0, endSeconds: 0 },
    reversed: false,
    slices: [],
    chopSessionId: null,
    synthPatchId: null,
    organicBassPatchId: null,
    polyPatchId: null,
    chordIntervals: [0],
  }
}

export function removeUnreferencedSynthPatches(group: PatternGroup): PatternGroup {
  const referenced = new Set(group.bank.pads.flatMap((pad) => pad.synthPatchId ? [pad.synthPatchId] : []))
  return { ...group, synthPatches: group.synthPatches.filter((patch) => referenced.has(patch.id)).map(cloneSynthPatch) }
}

export function getSynthPatch(group: PatternGroup, patchId: SynthPatchId | null): SynthPatch | undefined {
  return patchId ? group.synthPatches.find((patch) => patch.id === patchId) : undefined
}

export function resolveSynthPadMidiNotes(patch: SynthPatch, pad: Pick<PadState, 'pitchSemitones' | 'chordIntervals'>): number[] {
  return pad.chordIntervals.map((interval) => patch.baseMidiNote + pad.pitchSemitones + interval)
}

export function formatMidiNote(midiNote: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const rounded = Math.round(midiNote)
  return `${names[((rounded % 12) + 12) % 12]}${Math.floor(rounded / 12) - 1}`
}

export function lfoDivisionBeats(division: SynthLfoDivision): number {
  const straight = division.endsWith('T') ? division.slice(0, -1) : division
  const beats = straight === '1/2' ? 2 : straight === '1/4' ? 1 : straight === '1/8' ? 0.5 : 0.25
  return division.endsWith('T') ? beats * 2 / 3 : beats
}

export function lfoFrequencyHz(division: SynthLfoDivision, bpm: number): number {
  return 1 / (60 / bpm * lfoDivisionBeats(division))
}

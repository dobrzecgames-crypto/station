import type { PadState } from '../pads/types'
import type { PatternGroup } from '../patterns/patternTypes'
import type { PolyEnvelopeState, PolyLfoDivision, PolyModDestination, PolyModRoute, PolyPatch, PolyPatchId } from './polyTypes'

export const maximumPolyVoices = 8
export const minimumPolyMidiNote = 12
export const maximumPolyMidiNote = 108

export function createDefaultPolyPatch(id: PolyPatchId, name = 'CLEAN MODERN'): PolyPatch {
  return {
    id, name, baseMidiNote: 48,
    oscillator1: { tableId: 'soft-bloom', position: .28, octave: 0, semitone: 0, fineCents: -4, level: .72, unison: 4, detuneCents: 11, width: .72 },
    oscillator2: { tableId: 'digital-prism', position: .18, octave: 0, semitone: 0, fineCents: 5, level: .5, unison: 2, detuneCents: 7, width: .55 },
    oscillatorMix: .42,
    fmAmount: 0,
    filter: { mode: 'LP24', cutoffHz: 4800, resonance: 1.1, drive: .12, envelopeAmountSemitones: 9, keytrack: .32 },
    ampEnvelope: envelope(.018, .42, .78, .72),
    filterEnvelope: envelope(.012, .5, .15, .55),
    modEnvelope: envelope(.35, 1.4, .3, 1.2),
    lfo1: { shape: 'sine', mode: 'sync', division: '1/4', rateHz: 1, phase: 0, retrigger: true, fadeInSeconds: .25 },
    lfo2: { shape: 'triangle', mode: 'sync', division: '1/1', rateHz: .25, phase: .25, retrigger: false, fadeInSeconds: .8 },
    modulation: [
      { source: 'lfo1', destination: 'osc1Position', amount: .18 },
      { source: 'lfo2', destination: 'osc2Position', amount: .24 },
      { source: 'velocity', destination: 'filterCutoff', amount: .2 },
    ],
    level: .72,
    pan: 0,
    gate: .9,
  }
}

export function clonePolyPatch(patch: PolyPatch): PolyPatch {
  return {
    ...patch,
    oscillator1: { ...patch.oscillator1 }, oscillator2: { ...patch.oscillator2 }, filter: { ...patch.filter },
    ampEnvelope: { ...patch.ampEnvelope }, filterEnvelope: { ...patch.filterEnvelope }, modEnvelope: { ...patch.modEnvelope },
    lfo1: { ...patch.lfo1 }, lfo2: { ...patch.lfo2 }, modulation: patch.modulation.map((route) => ({ ...route })),
  }
}

export function assignPolySource(pad: PadState, polyPatchId: PolyPatchId, chordIntervals: readonly number[] = [0]): PadState {
  return { ...pad, assetId: null, fileName: null, durationSeconds: null, region: { startSeconds: 0, endSeconds: 0 }, reversed: false, slices: [], chopSessionId: null, synthPatchId: null, stringsPatchId: null, organicBassPatchId: null, polyPatchId, chordIntervals: [...chordIntervals] }
}

export function removeUnreferencedPolyPatches(group: PatternGroup): PatternGroup {
  const referenced = new Set(group.bank.pads.flatMap((pad) => pad.polyPatchId ? [pad.polyPatchId] : []))
  return { ...group, polyPatches: group.polyPatches.filter((patch) => referenced.has(patch.id)).map(clonePolyPatch) }
}

export function getPolyPatch(group: PatternGroup, patchId: PolyPatchId | null): PolyPatch | undefined {
  return patchId ? group.polyPatches.find((patch) => patch.id === patchId) : undefined
}

export function resolvePolyPadMidiNotes(patch: PolyPatch, pad: Pick<PadState, 'pitchSemitones' | 'chordIntervals'>): number[] {
  return pad.chordIntervals.slice(0, maximumPolyVoices).map((interval) => clamp(patch.baseMidiNote + pad.pitchSemitones + interval, minimumPolyMidiNote, maximumPolyMidiNote))
}

export function clampModulationAmount(amount: number): number { return clamp(Number.isFinite(amount) ? amount : 0, -1, 1) }

export const polyModulationDestinationDepth: Readonly<Record<PolyModDestination, number>> = {
  osc1Position: 1, osc2Position: 1, osc1Pitch: 2400, osc2Pitch: 2400, osc1Fine: 100, osc2Fine: 100,
  oscMix: 1, fmAmount: 1, filterCutoff: 60, filterResonance: 18, filterDrive: 1,
  filterEnvAmount: 48, ampLevel: 1, pan: 1, unisonDetune: 50, width: 1, lfo1Rate: 4,
}

export function mapPolyModulation(destination: PolyModDestination, routes: readonly PolyModRoute[], sourceValues: Partial<Record<PolyModRoute['source'], number>>): number {
  const normalized = routes.filter((route) => route.destination === destination).reduce((sum, route) => sum + clampModulationAmount(route.amount) * clamp(sourceValues[route.source] ?? 0, -1, 1), 0)
  return clamp(normalized, -1, 1) * polyModulationDestinationDepth[destination]
}

export function polyLfoFrequencyHz(division: PolyLfoDivision, bpm: number): number {
  const beats: Record<PolyLfoDivision, number> = { '1/1': 4, '1/2': 2, '1/4': 1, '1/8': .5, '1/16': .25, '1/32': .125 }
  return 1 / (60 / clamp(bpm, 20, 400) * beats[division])
}

export interface PolyVoiceCandidate { startsAt: number; serial: number; stopAt?: number; cleanedUp?: boolean; stolen?: boolean }

export function choosePolyVoiceToSteal<T extends PolyVoiceCandidate>(voices: readonly T[], when: number): T | undefined {
  const sounding = voices.filter((voice) => !voice.cleanedUp && !voice.stolen && (voice.stopAt === undefined || voice.stopAt > when))
  if (sounding.length < maximumPolyVoices) return undefined
  const releasing = sounding.filter((voice) => voice.stopAt !== undefined)
  return [...(releasing.length > 0 ? releasing : sounding)].sort((a, b) => a.startsAt - b.startsAt || a.serial - b.serial)[0]
}

export function clampPolyPatch(patch: PolyPatch): PolyPatch {
  const cloned = clonePolyPatch(patch)
  cloned.baseMidiNote = Math.round(clamp(cloned.baseMidiNote, minimumPolyMidiNote, maximumPolyMidiNote))
  for (const oscillator of [cloned.oscillator1, cloned.oscillator2]) {
    oscillator.position = clamp(oscillator.position, 0, 1); oscillator.octave = Math.round(clamp(oscillator.octave, -2, 2)); oscillator.semitone = Math.round(clamp(oscillator.semitone, -12, 12)); oscillator.fineCents = clamp(oscillator.fineCents, -100, 100); oscillator.level = clamp(oscillator.level, 0, 1); oscillator.detuneCents = clamp(oscillator.detuneCents, 0, 50); oscillator.width = clamp(oscillator.width, 0, 1)
  }
  cloned.oscillatorMix = clamp(cloned.oscillatorMix, 0, 1); cloned.fmAmount = clamp(cloned.fmAmount, 0, 1)
  cloned.filter.cutoffHz = clamp(cloned.filter.cutoffHz, 20, 20000); cloned.filter.resonance = clamp(cloned.filter.resonance, .5, 20); cloned.filter.drive = clamp(cloned.filter.drive, 0, 1); cloned.filter.envelopeAmountSemitones = clamp(cloned.filter.envelopeAmountSemitones, -60, 60); cloned.filter.keytrack = clamp(cloned.filter.keytrack, 0, 1)
  cloned.ampEnvelope = clampEnvelope(cloned.ampEnvelope); cloned.filterEnvelope = clampEnvelope(cloned.filterEnvelope); cloned.modEnvelope = clampEnvelope(cloned.modEnvelope)
  cloned.modulation = cloned.modulation.map((route) => ({ ...route, amount: clampModulationAmount(route.amount) }))
  cloned.level = clamp(cloned.level, 0, 1); cloned.pan = clamp(cloned.pan, -1, 1); cloned.gate = clamp(cloned.gate, .05, 2)
  return cloned
}

function envelope(attackSeconds: number, decaySeconds: number, sustain: number, releaseSeconds: number): PolyEnvelopeState { return { attackSeconds, decaySeconds, sustain, releaseSeconds } }
function clampEnvelope(value: PolyEnvelopeState): PolyEnvelopeState { return { attackSeconds: clamp(value.attackSeconds, 0, 10), decaySeconds: clamp(value.decaySeconds, 0, 10), sustain: clamp(value.sustain, 0, 1), releaseSeconds: clamp(value.releaseSeconds, .005, 15) } }
function clamp(value: number, minimum: number, maximum: number): number { return Math.min(maximum, Math.max(minimum, value)) }

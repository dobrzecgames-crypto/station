import { clonePolyPatch, createDefaultPolyPatch } from './polyOperations'
import type { PolyPatch } from './polyTypes'

const preset = (name: string, changes: (patch: PolyPatch) => void): PolyPatch => { const patch = createDefaultPolyPatch(`factory-${name.toLowerCase().replace(/\s+/g, '-')}`, name); changes(patch); return patch }

export const polyFactoryPatches: readonly PolyPatch[] = [
  createDefaultPolyPatch('factory-clean-modern', 'CLEAN MODERN'),
  preset('WIDE VECTOR', (p) => { p.oscillator1.tableId = 'motion-vector'; p.oscillator1.position = .44; p.oscillator1.unison = 8; p.oscillator1.detuneCents = 16; p.oscillator2.tableId = 'glass-clear'; p.oscillator2.unison = 4; p.filter.cutoffHz = 6200; p.modulation.push({ source: 'lfo2', destination: 'width', amount: .2 }) }),
  preset('DARK PLUCK', (p) => { p.oscillator1.tableId = 'hollow-wood'; p.oscillator2.level = .22; p.ampEnvelope = { attackSeconds: .002, decaySeconds: .22, sustain: .08, releaseSeconds: .16 }; p.filter.cutoffHz = 820; p.filter.envelopeAmountSemitones = 38; p.filterEnvelope = { attackSeconds: .001, decaySeconds: .18, sustain: 0, releaseSeconds: .12 } }),
  preset('GLASS KEYS', (p) => { p.oscillator1.tableId = 'glass-crystal'; p.oscillator2.tableId = 'glass-bell'; p.fmAmount = .28; p.filter.mode = 'HP12'; p.filter.cutoffHz = 190; p.ampEnvelope.releaseSeconds = .9; p.modulation = [{ source: 'velocity', destination: 'fmAmount', amount: .35 }, { source: 'velocity', destination: 'filterCutoff', amount: .18 }] }),
  preset('HOLLOW KEYS', (p) => { p.oscillator1.tableId = 'hollow-tube'; p.oscillator2.tableId = 'hollow-vowel'; p.oscillatorMix = .58; p.filter.cutoffHz = 2600; p.ampEnvelope = { attackSeconds: .008, decaySeconds: .6, sustain: .52, releaseSeconds: .45 } }),
  preset('EVOLVING PAD', (p) => { p.oscillator1.tableId = 'motion-aurora'; p.oscillator2.tableId = 'texture-cloud'; p.oscillator1.unison = 8; p.oscillator2.unison = 4; p.ampEnvelope = { attackSeconds: 1.2, decaySeconds: 1.8, sustain: .78, releaseSeconds: 3.5 }; p.filter.cutoffHz = 3300; p.modulation = [{ source: 'lfo1', destination: 'osc1Position', amount: .65 }, { source: 'lfo2', destination: 'osc2Position', amount: .52 }, { source: 'modEnv', destination: 'filterCutoff', amount: .22 }] }),
  preset('SOFT ATMOSPHERE', (p) => { p.oscillator1.tableId = 'soft-haze'; p.oscillator2.tableId = 'soft-cotton'; p.oscillator1.unison = 4; p.ampEnvelope = { attackSeconds: 1.8, decaySeconds: 2, sustain: .85, releaseSeconds: 4.2 }; p.filter.cutoffHz = 2100; p.level = .62 }),
  preset('MODERN STAB', (p) => { p.oscillator1.tableId = 'digital-code'; p.oscillator2.tableId = 'harmonic-fifths'; p.ampEnvelope = { attackSeconds: .002, decaySeconds: .16, sustain: .18, releaseSeconds: .18 }; p.filter.cutoffHz = 1700; p.filter.drive = .28; p.filter.envelopeAmountSemitones = 30 }),
  preset('METAL KEYS', (p) => { p.oscillator1.tableId = 'glass-bell'; p.oscillator2.tableId = 'digital-fold'; p.fmAmount = .46; p.oscillator2.semitone = 7; p.ampEnvelope = { attackSeconds: .003, decaySeconds: 1.1, sustain: .2, releaseSeconds: 1.6 }; p.filter.mode = 'BP12'; p.filter.cutoffHz = 4200 }),
  preset('DIGITAL PRESSURE', (p) => { p.oscillator1.tableId = 'aggressive-iron'; p.oscillator2.tableId = 'aggressive-tear'; p.oscillator1.unison = 4; p.oscillator2.unison = 4; p.fmAmount = .2; p.filter.cutoffHz = 5200; p.filter.drive = .48; p.level = .58 }),
]

export function applyPolyFactoryPatch(current: PolyPatch, factoryId: string): PolyPatch {
  const factory = polyFactoryPatches.find((candidate) => candidate.id === factoryId) ?? polyFactoryPatches[0]
  return { ...clonePolyPatch(factory), id: current.id }
}

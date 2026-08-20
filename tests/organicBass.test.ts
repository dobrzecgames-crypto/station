import assert from 'node:assert/strict'
import test from 'node:test'
import { StepSequencer } from '../src/audio/StepSequencer.ts'
import type { SequencerTicker, StepSequencerConfig, StepSequencerTrack } from '../src/audio/StepSequencer.ts'
import {
  assignOrganicBassSource,
  createDefaultOrganicBassPatch,
  organicBassCutoffHz,
  organicBassDecaySeconds,
  organicBassEnvelopeShape,
  organicBassGlideSeconds,
  organicBassReleaseCurve,
  organicBassVelocityResponse,
  organicBassWaveCoefficients,
  organicBassWeightMacro,
} from '../src/organic-bass/organicBassOperations.ts'
import { clonePadBank, createPadBank, createPadBankState } from '../src/pads/padBank.ts'

test('default MONOGORG opens in the useful dark, short-bass range', () => {
  const patch = createDefaultOrganicBassPatch('bass-1')
  assert.equal(patch.baseMidiNote, 36)
  assert.ok(organicBassCutoffHz(patch.cutoff) > 380 && organicBassCutoffHz(patch.cutoff) < 460)
  assert.ok(organicBassDecaySeconds(patch.decay) > 0.28 && organicBassDecaySeconds(patch.decay) < 0.42)
  assert.equal(organicBassGlideSeconds(patch.glide), 0)
})

test('DECAY reserves most control travel for 60-900 ms and still reaches long notes', () => {
  assert.ok(Math.abs(organicBassDecaySeconds(0) - 0.06) < 1e-9)
  assert.ok(Math.abs(organicBassDecaySeconds(0.72) - 0.9) < 1e-9)
  assert.ok(Math.abs(organicBassDecaySeconds(1) - 4) < 1e-9)
  const shortHit = organicBassEnvelopeShape(0.3)
  const smoothBass = organicBassEnvelopeShape(0.82)
  assert.ok(shortHit.decaySeconds < smoothBass.decaySeconds)
  assert.ok(shortHit.sustain < smoothBass.sustain)
  assert.ok(shortHit.releaseSeconds >= 0.035)
})

test('GLIDE is nonlinear and concentrates resolution below 150 ms', () => {
  assert.equal(organicBassGlideSeconds(0), 0)
  assert.ok(organicBassGlideSeconds(0.5) < 0.15)
  assert.ok(Math.abs(organicBassGlideSeconds(1) - 0.55) < 1e-9)
})

test('release curve reaches exact silence monotonically with flat endpoints', () => {
  const curve = organicBassReleaseCurve()
  assert.equal(curve[0], 1)
  assert.equal(curve.at(-1), 0)
  assert.equal(curve.every((value, index) => index === 0 || value <= curve[index - 1]), true)
  assert.ok(Math.abs(curve[0] - curve[1]) < 0.001)
  assert.ok(Math.abs(curve.at(-2) ?? 0) < 0.001)
})

test('WEIGHT increases sub/body/filter pressure without becoming a volume control', () => {
  const low = organicBassWeightMacro(0)
  const high = organicBassWeightMacro(1)
  assert.ok(high.subGain > low.subGain)
  assert.ok(high.bodyGain > low.bodyGain)
  assert.ok(high.inputDrive > low.inputDrive)
  assert.ok(Math.abs(low.mainGain + low.bodyGain + low.subGain - 0.92) < 1e-9)
  assert.ok(Math.abs(high.mainGain + high.bodyGain + high.subGain - 0.92) < 1e-9)
})

test('SHAPE creates finite harmonic morphs with a brighter upper end', () => {
  const soft = organicBassWaveCoefficients(0)
  const bright = organicBassWaveCoefficients(1)
  assert.equal([...soft.real, ...soft.imag, ...bright.real, ...bright.imag].every(Number.isFinite), true)
  const upperEnergy = (wave: Float32Array) => wave.slice(2).reduce((sum, value) => sum + Math.abs(value), 0)
  assert.ok(upperEnergy(bright.imag) > upperEnergy(soft.imag))
  assert.equal(soft.imag[2], 0)
})

test('velocity subtly raises level, cutoff and saturation pressure', () => {
  const low = organicBassVelocityResponse(0.2)
  const high = organicBassVelocityResponse(1)
  assert.ok(high.amplitude > low.amplitude)
  assert.ok(high.cutoffSemitones > low.cutoffSemitones)
  assert.ok(high.inputDrive > low.inputDrive)
  assert.ok(low.amplitude >= 0.56 && high.amplitude <= 1)
})

test('MONOGORG assignment remains mutually exclusive with every older source', () => {
  const pad = { ...createPadBank()[0], assetId: 'sample', synthPatchId: 'mono' }
  const assigned = assignOrganicBassSource(pad, 'bass-1')
  assert.equal(assigned.assetId, null)
  assert.equal(assigned.synthPatchId, null)
  assert.equal(assigned.organicBassPatchId, 'bass-1')
  assert.deepEqual(assigned.chordIntervals, [0])
})

test('v19-shaped pad banks normalize with null MONOGORG references', () => {
  const bank = createPadBankState()
  const legacyPad = bank.pads[0] as typeof bank.pads[0] & { organicBassPatchId?: unknown }
  delete legacyPad.organicBassPatchId
  const normalized = clonePadBank(bank)
  assert.equal(normalized.pads[0].organicBassPatchId, null)
})

test('sequencer schedules short and extended MONOGORG gates through the shared audio clock', () => {
  const ticker = new ManualTicker()
  const engine = new FakeOrganicBassEngine()
  const sequencer = new StepSequencer(engine as never, ticker, 0.1)
  const patch = createDefaultOrganicBassPatch('bass-1')
  const track: StepSequencerTrack = {
    source: 'organicBass',
    groupId: 'group-1',
    channelId: 'pad-01',
    patch,
    midiNote: 36,
    steps: [0.4, ...Array(15).fill(0)],
    shifts: Array(16).fill(0),
    lengths: [4, ...Array(15).fill(0)],
  }
  const config: StepSequencerConfig = { bpm: 120, swing: 0, metronomeEnabled: false, mode: 'pattern', loopSong: false, lastSongSlot: null, getTracksForSlot: () => [track] }
  sequencer.start(() => config)
  assert.equal(engine.scheduled.length, 1)
  assert.equal(engine.scheduled[0].midiNote, 36)
  assert.equal(engine.scheduled[0].velocity, 0.4)
  assert.ok(Math.abs(engine.scheduled[0].off - 0.45) < 1e-9)
})

class ManualTicker implements SequencerTicker {
  wake(): void {}
  cancel(): void {}
}

class FakeOrganicBassEngine {
  scheduled: Array<{ midiNote: number; when: number; off: number; velocity: number }> = []
  getCurrentTime(): number { return 0 }
  scheduleOrganicBassPad(_groupId: string, _channelId: string, _patch: unknown, midiNote: number, when: number, off: number, velocity: number): void { this.scheduled.push({ midiNote, when, off, velocity }) }
  scheduleSynthChord(): void {}
  scheduleSynthPad(): void {}
  scheduleSample(): void {}
  releaseSequencerChordAt(): void {}
  stopSequencerChokeGroupAt(): void {}
  scheduleMetronome(): void {}
}

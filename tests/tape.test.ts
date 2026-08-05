import assert from 'node:assert/strict'
import test from 'node:test'
import { createDefaultMasterEffectRack, createEffectSlotState, createEmptyEffectRack, isEffectRackState, normalizeEffectRackState } from '../src/audio/effects.ts'
import { clampTapeAmount, createTapeNoiseData, createTapePitchProfile, createTapeSaturationCurve, isTapeBypassed, mapTapeParameters } from '../src/audio/tape.ts'

test('TAPE 0 is a true bypass and maps every process to neutral', () => {
  assert.equal(isTapeBypassed(true, 0), true)
  assert.equal(isTapeBypassed(false, 1), true)
  assert.deepEqual(mapTapeParameters(0), {
    amount: 0,
    saturationMix: 0,
    drive: 1,
    lowpassHz: 20000,
    headBumpDb: 0,
    outputGain: 1,
    pitchWear: 0,
    noiseGain: 0,
    levelIrregularity: 0,
  })
})

test('TAPE amount clamps malformed and out-of-range values', () => {
  assert.equal(clampTapeAmount(-1), 0)
  assert.equal(clampTapeAmount(2), 1)
  assert.equal(clampTapeAmount(Number.NaN), 0.32)
  assert.equal(clampTapeAmount(Number.POSITIVE_INFINITY), 0.32)
})

test('macro mappings are finite, bounded and continuous across the full range', () => {
  let previous = mapTapeParameters(0)
  for (let index = 1; index <= 1000; index += 1) {
    const current = mapTapeParameters(index / 1000)
    for (const value of Object.values(current)) assert.equal(Number.isFinite(value), true)
    assert.ok(current.saturationMix >= previous.saturationMix)
    assert.ok(current.drive >= previous.drive)
    assert.ok(current.lowpassHz <= previous.lowpassHz)
    assert.ok(current.pitchWear >= previous.pitchWear)
    assert.ok(current.noiseGain >= previous.noiseGain)
    assert.ok(current.levelIrregularity >= previous.levelIrregularity)
    assert.ok(Math.abs(current.saturationMix - previous.saturationMix) < 0.002)
    assert.ok(Math.abs(current.lowpassHz - previous.lowpassHz) < 50)
    assert.ok(current.outputGain > 0 && current.outputGain <= 1)
    previous = current
  }
  assert.equal(mapTapeParameters(0.2).noiseGain, 0)
  assert.equal(mapTapeParameters(0.5).levelIrregularity, 0)
  assert.ok(mapTapeParameters(1).noiseGain <= 0.006)
})

test('saturation transfer is finite, symmetric and peak-bounded', () => {
  const curve = createTapeSaturationCurve(4096)
  let peak = 0
  for (const sample of curve) {
    assert.equal(Number.isFinite(sample), true)
    peak = Math.max(peak, Math.abs(sample))
  }
  assert.ok(peak < 0.9)
  assert.ok(Math.abs(curve[0] + curve[curve.length - 1]) < 1e-6)
})

test('seeded pitch movement is repeatable, irregular and capped at two cents', () => {
  const first = createTapePitchProfile('group-1:fx-slot-1')
  const repeated = createTapePitchProfile('group-1:fx-slot-1')
  const other = createTapePitchProfile('group-2:fx-slot-1')
  assert.deepEqual(first, repeated)
  assert.notDeepEqual(first, other)
  assert.ok(Math.abs(first.maximumCents - 2) < 1e-9)
  assert.equal(new Set(first.lfos.map((lfo) => lfo.frequencyHz.toFixed(6))).size, 4)
  for (const lfo of first.lfos) assert.ok(Number.isFinite(lfo.delayDepthSeconds) && lfo.delayDepthSeconds > 0)
})

test('seeded hiss is deterministic, finite and supports mono and stereo data', () => {
  const mono = createTapeNoiseData(48000, 0.1, 'render-seed', 1)
  const monoRepeated = createTapeNoiseData(48000, 0.1, 'render-seed', 1)
  const stereo = createTapeNoiseData(48000, 0.1, 'render-seed', 2)
  assert.equal(mono.length, 1)
  assert.equal(stereo.length, 2)
  assert.deepEqual(mono[0], monoRepeated[0])
  assert.deepEqual(mono[0], stereo[0])
  assert.notDeepEqual(stereo[0], stereo[1])
  for (const channel of stereo) for (const sample of channel) {
    assert.equal(Number.isFinite(sample), true)
    assert.ok(Math.abs(sample) <= 1)
  }
})

test('new group and master racks expose four stable serial slots', () => {
  const group = createEmptyEffectRack('pattern-group-1')
  const master = createDefaultMasterEffectRack()
  assert.deepEqual(group.slots.map((slot) => slot.id), [
    'pattern-group-1:fx-slot-1',
    'pattern-group-1:fx-slot-2',
    'pattern-group-1:fx-slot-3',
    'pattern-group-1:fx-slot-4',
  ])
  assert.deepEqual(master.slots.map((slot) => slot.type), ['delay', 'compressor', 'none', 'none'])
  assert.equal(isEffectRackState(group, 'pattern-group-1'), true)
  assert.equal(isEffectRackState(master, 'master'), true)
})

test('two-slot project racks migrate without losing their existing effects', () => {
  const legacyRack = {
    slots: [
      createEffectSlotState('pattern-group-1:fx-slot-1', 'tape', true),
      createEffectSlotState('pattern-group-1:fx-slot-2', 'delay', true),
    ],
  }
  legacyRack.slots[0].tape.amount = 0.73
  legacyRack.slots[1].delay.feedback = 0.42
  const migrated = normalizeEffectRackState(legacyRack, 'pattern-group-1')
  assert.deepEqual(migrated.slots.map((slot) => slot.type), ['tape', 'delay', 'none', 'none'])
  assert.equal(migrated.slots[0].tape.amount, 0.73)
  assert.equal(migrated.slots[1].delay.feedback, 0.42)
  assert.equal(isEffectRackState(migrated, 'pattern-group-1'), true)
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzePitch, completeTuneGravityBlindSession, createDefaultTuneGravityRatings, createOriginalComparisonAudio, createTuneGravityBenchmarkDocument, createTuneGravityBlindSession, createTuneGravityDiagnosticDocument, createCorrectionPlan, detectTuneGravityProblems, exportTuneGravityListeningTest, midiToFrequency, processTuneGravityOffline, revealTuneGravityBlindMapping, saveTuneGravityBlindEvaluation, tuneGravityBenchmarkFormatVersion, tuneGravityDiagnosticFormatVersion } from '../src/audio/tuneGravity/index.ts'
import type { PitchFrame, TuneGravityDiagnosticFrame } from '../src/audio/tuneGravity/index.ts'

const sampleRate = 48000

test('YIN and MPM track low and high harmonic vocal proxies', () => {
  for (const detector of ['yin', 'mpm'] as const) {
    for (const frequencyHz of [110, 330]) {
      const input = createVowelProxy(0.7, () => frequencyHz)
      const frames = analyzePitch(input, sampleRate, { detector })
      const detected = frames.filter((frame) => frame.voiced && frame.frequencyHz !== null).map((frame) => frame.frequencyHz!)
      assert.ok(detected.length > frames.length * 0.7, `${detector} should mark the harmonic signal as voiced`)
      assert.ok(Math.abs(median(detected) - frequencyHz) / frequencyHz < 0.02, `${detector} should resolve ${frequencyHz} Hz`)
    }
  }
})

test('confidence gating rejects silence and seeded broadband noise', () => {
  const silence = new Float32Array(sampleRate / 2)
  const noise = createNoise(sampleRate / 2, 0.12)
  for (const detector of ['yin', 'mpm'] as const) {
    assert.equal(analyzePitch(silence, sampleRate, { detector }).some((frame) => frame.voiced), false)
    const noiseFrames = analyzePitch(noise, sampleRate, { detector })
    assert.ok(noiseFrames.filter((frame) => frame.voiced).length <= Math.ceil(noiseFrames.length * 0.08))
  }
})

test('A minor scale mapping uses target hysteresis instead of block-by-block note flips', () => {
  const frames = Array.from({ length: 48 }, (_, index) => pitchFrame(index, index % 2 === 0 ? 69.98 : 70.02))
  const plan = createCorrectionPlan(frames, { root: 'A', scale: 'naturalMinor' }, sampleRate, 256, {
    gravity: 1,
    speed: 1,
    humanize: 0,
    minimumTargetHoldMs: 45,
  })
  const targets = plan.map((frame) => frame.targetMidi).filter((target): target is number => target !== null)
  const changes = targets.slice(1).filter((target, index) => target !== targets[index]).length
  assert.equal(targets[0], 69)
  assert.equal(changes, 0)
})

test('HUMANIZE corrects a stable note center while preserving its vibrato movement', () => {
  const frames = Array.from({ length: 120 }, (_, index) => pitchFrame(index, 69.25 + Math.sin(index * 0.45) * 0.18))
  const natural = createCorrectionPlan(frames, { root: 'A', scale: 'naturalMinor' }, sampleRate, 256, { gravity: 0.75, speed: 1, humanize: 1 })
  const flattened = createCorrectionPlan(frames, { root: 'A', scale: 'naturalMinor' }, sampleRate, 256, { gravity: 0.75, speed: 1, humanize: 0 })
  const settledNatural = natural.slice(70).map((frame) => frame.correctionCents)
  const settledFlattened = flattened.slice(70).map((frame) => frame.correctionCents)
  assert.ok(standardDeviation(settledNatural) < standardDeviation(settledFlattened) * 0.55)
  assert.ok(Math.abs(mean(settledNatural)) > 8, 'the note center should still be corrected')
})

test('GRAVITY 0 is a bit-neutral bypass', () => {
  const input = createVowelProxy(0.35, () => 220)
  const result = processTuneGravityOffline(input, sampleRate, {
    projectKey: { root: 'A', scale: 'naturalMinor' },
    parameters: { gravity: 0 },
  })
  assert.deepEqual(result.output, input)
  assert.equal(result.output.length, input.length)
})

test('both prototype shifters preserve duration and move a detuned voiced signal toward scale', () => {
  const sourceMidi = 57.42
  const sourceFrequency = midiToFrequency(sourceMidi)
  const input = createVowelProxy(0.9, () => sourceFrequency)
  for (const shifter of ['tdPsola', 'granular'] as const) {
    const result = processTuneGravityOffline(input, sampleRate, {
      projectKey: { root: 'A', scale: 'naturalMinor' },
      shifter,
      parameters: { gravity: 1, speed: 1, humanize: 0 },
    })
    assert.equal(result.output.length, input.length)
    const outputFrames = analyzePitch(result.output, sampleRate)
    const outputFrequency = median(outputFrames.slice(12, -8).filter((frame) => frame.frequencyHz !== null).map((frame) => frame.frequencyHz!))
    assert.ok(outputFrequency < sourceFrequency, `${shifter} should shift this note down`)
    assert.ok(Math.abs(outputFrequency - 220) / 220 < 0.06, `${shifter} should approach A3 without changing duration`)
  }
})

test('unvoiced middle region is passed without pitch correction', () => {
  const voiced = createVowelProxy(0.3, () => 226)
  const breath = createNoise(Math.round(sampleRate * 0.18), 0.035)
  const input = concatenate(voiced, breath, voiced)
  const result = processTuneGravityOffline(input, sampleRate, {
    projectKey: { root: 'A', scale: 'naturalMinor' },
    parameters: { gravity: 1, speed: 1, humanize: 0 },
  })
  const middleStart = voiced.length
  const middleEnd = voiced.length + breath.length
  const middleFrames = result.correctionPlan.filter((frame) => frame.centerSample >= middleStart && frame.centerSample < middleEnd)
  assert.ok(middleFrames.filter((frame) => frame.pitchRatio === 1).length > middleFrames.length * 0.7)
  assert.ok(rmsDifference(input.subarray(middleStart + 1024, middleEnd - 1024), result.output.subarray(middleStart + 1024, middleEnd - 1024)) < 0.005)
})

test('diagnostic JSON is versioned, time-aligned and exports the resolved analysis settings', () => {
  const input = createVowelProxy(0.45, () => 226)
  const result = processTuneGravityOffline(input, sampleRate, {
    projectKey: { root: 'D', scale: 'dorian' },
    detector: 'mpm',
    shifter: 'granular',
    parameters: { gravity: 0.64, speed: 0.37, humanize: 0.82 },
  })
  const report = createTuneGravityDiagnosticDocument(result, {
    anonymousSourceId: 'tg-test',
    sampleRate,
    sourceChannelCount: 2,
    durationSeconds: input.length / sampleRate,
    sampleCount: input.length,
    createdAt: '2026-08-01T00:00:00.000Z',
  })
  assert.equal(report.version, tuneGravityDiagnosticFormatVersion)
  assert.equal(report.frames.length, result.pitchFrames.length)
  assert.equal(report.frames.length, result.correctionPlan.length)
  assert.equal(report.frames.every((frame, index) => frame.frameIndex === index && frame.timestampSeconds === result.pitchFrames[index]!.timeSeconds), true)
  assert.deepEqual(report.source, { anonymousId: 'tg-test', sampleRate, sourceChannelCount: 2, durationSeconds: input.length / sampleRate, sampleCount: input.length })
  assert.equal(report.analysis.detector, 'mpm')
  assert.equal(report.analysis.shifter, 'granular')
  assert.equal(report.analysis.projectKey, 'D')
  assert.equal(report.analysis.projectScale, 'dorian')
  assert.equal(report.analysis.gravity, 0.64)
  assert.equal(report.analysis.speed, 0.37)
  assert.equal(report.analysis.humanize, 0.82)
  assert.equal(report.analysis.frameSize, 2048)
  assert.equal(report.analysis.hopSize, 256)
})

test('diagnostic JSON preserves voiced and unvoiced decisions and skip reasons', () => {
  const voiced = createVowelProxy(0.3, () => 226)
  const silence = new Float32Array(Math.round(sampleRate * 0.2))
  const input = concatenate(voiced, silence, voiced)
  const result = processTuneGravityOffline(input, sampleRate, { projectKey: { root: 'A', scale: 'naturalMinor' } })
  const report = createTuneGravityDiagnosticDocument(result, {
    anonymousSourceId: 'tg-voicing', sampleRate, sourceChannelCount: 1, durationSeconds: input.length / sampleRate, sampleCount: input.length,
  })
  assert.ok(report.frames.some((frame) => frame.voiced && !frame.correctionSkipped))
  assert.ok(report.frames.some((frame) => !frame.voiced && frame.correctionSkipped && frame.skipReason === 'low-rms'))
  assert.ok(report.regions.some((region) => region.kind === 'unvoiced'))
  assert.ok(report.regions.some((region) => region.kind === 'voiced' || region.kind === 'stable-note'))
})

test('diagnostics flag a short synthetic octave error', () => {
  const frames = Array.from({ length: 9 }, (_, index) => diagnosticFrame(index, index === 4 ? 72 : 60, 60))
  const problems = detectTuneGravityProblems(frames)
  assert.ok(problems.some((problem) => problem.kind === 'possible-octave-error' && problem.frameIndex === 4))
})

test('diagnostics flag synthetic target-note chatter', () => {
  const targets = [60, 61, 60, 61, 60, 61, 60, 61, 60, 61, 60, 61]
  const problems = detectTuneGravityProblems(targets.map((target, index) => diagnosticFrame(index, 60 + Math.sin(index) * 0.1, target)))
  assert.ok(problems.some((problem) => problem.kind === 'note-chatter'))
})

test('blind shuffle is deterministic for a supplied seed and remains hidden before completion', () => {
  const settings = { projectKey: { root: 'A', scale: 'naturalMinor' } as const, gravity: 0.7, speed: 0.6, humanize: 0.5 }
  const first = createTuneGravityBlindSession('tg-blind', settings, 12345, undefined, '2026-08-01T00:00:00.000Z')
  const second = createTuneGravityBlindSession('tg-blind', settings, 12345, undefined, '2026-08-01T00:00:00.000Z')
  assert.deepEqual(first.mapping, second.mapping)
  assert.equal(revealTuneGravityBlindMapping(first), null)
  assert.equal(exportTuneGravityListeningTest(first).mapping, null)
})

test('blind ratings and flags export with mapping only after every variant is saved', () => {
  let session = createTuneGravityBlindSession(
    'tg-ratings',
    { projectKey: { root: 'C', scale: 'major' }, gravity: 0.8, speed: 0.9, humanize: 0.2 },
    77,
    ['original', 'yin-td-psola', 'yin-granular'],
    '2026-08-01T00:00:00.000Z',
  )
  for (const [index, label] of session.labels.entries()) {
    const ratings = createDefaultTuneGravityRatings(index + 2)
    session = saveTuneGravityBlindEvaluation(session, label, {
      ratings,
      flags: index === 1 ? ['metallic', 'graininess'] : [],
      notes: `variant ${label}`,
    }, `2026-08-01T00:00:0${index + 1}.000Z`)
  }
  session = completeTuneGravityBlindSession(session, '2026-08-01T00:01:00.000Z')
  const exported = exportTuneGravityListeningTest(session)
  assert.deepEqual(exported.mapping, session.mapping)
  assert.equal(exported.evaluations.B?.ratings.intonationImprovement, 3)
  assert.deepEqual(exported.evaluations.B?.flags, ['metallic', 'graininess'])
  assert.equal('audio' in exported, false)
})

test('ORIGINAL comparison audio is a bit-neutral independent copy', () => {
  const input = createVowelProxy(0.2, () => 220)
  const original = createOriginalComparisonAudio(input)
  assert.deepEqual(original, input)
  assert.notEqual(original.buffer, input.buffer)
})

test('QUALITY benchmark export is versioned and reports processing ratio and lifecycle', () => {
  const report = createTuneGravityBenchmarkDocument({
    anonymousSourceId: 'tg-benchmark',
    sampleRate: 48000,
    durationSeconds: 2,
    sampleCount: 96000,
    projectKey: { root: 'G', scale: 'mixolydian' },
    parameters: { gravity: 0.7, speed: 0.4, humanize: 0.6 },
    timings: { yinMs: 400, mpmMs: 500, tdPsolaMs: 200, granularMs: 180, totalMs: 1400 },
    browserLabel: 'Test Browser',
    userAgent: 'station-test-agent',
    backgroundedDuringRun: true,
    measuredHeapBeforeBytes: 1000,
    measuredHeapAfterBytes: 2000,
    createdAt: '2026-08-01T00:00:00.000Z',
  })
  assert.equal(report.version, tuneGravityBenchmarkFormatVersion)
  assert.equal(report.processingToAudioRatio, 0.7)
  assert.equal(report.lifecycle.backgroundedDuringRun, true)
  assert.equal(report.lifecycle.interrupted, false)
  assert.equal(report.memory.measuredHeapAfterBytes, 2000)
  assert.ok(report.memory.estimatedWorkingSetBytes > 0)
})

function pitchFrame(index: number, midi: number): PitchFrame {
  const centerSample = 1024 + index * 256
  return {
    frameIndex: index,
    centerSample,
    timeSeconds: centerSample / sampleRate,
    frequencyHz: midiToFrequency(midi),
    confidence: 0.98,
    rms: 0.2,
    voiced: true,
  }
}

function diagnosticFrame(index: number, detectedMidi: number, targetMidi: number): TuneGravityDiagnosticFrame {
  return {
    frameIndex: index,
    timestampSeconds: index * 256 / sampleRate,
    centerSample: index * 256,
    rms: 0.2,
    detectedFrequencyHz: midiToFrequency(detectedMidi),
    confidence: 0.96,
    voiced: true,
    detectedMidi,
    detectedCents: (detectedMidi - Math.round(detectedMidi)) * 100,
    targetMidi,
    targetNote: null,
    targetFrequencyHz: midiToFrequency(targetMidi),
    correctionCents: (targetMidi - detectedMidi) * 100,
    correctionRatio: 2 ** ((targetMidi - detectedMidi) / 12),
    correctionSkipped: false,
    skipReason: null,
    hysteresisState: 'stable',
    pendingTargetMidi: null,
    targetHoldMs: index * 256 / sampleRate * 1000,
  }
}

function createVowelProxy(durationSeconds: number, frequencyAt: (seconds: number) => number): Float32Array {
  const sampleCount = Math.round(durationSeconds * sampleRate)
  const output = new Float32Array(sampleCount)
  let phase = 0
  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / sampleRate
    const fundamental = frequencyAt(time)
    phase += 2 * Math.PI * fundamental / sampleRate
    let sample = 0
    let amplitudeSum = 0
    for (let harmonic = 1; harmonic <= 18; harmonic += 1) {
      const frequency = fundamental * harmonic
      const formantEnvelope = 0.12
        + gaussian(frequency, 700, 150)
        + gaussian(frequency, 1200, 220) * 0.7
        + gaussian(frequency, 2500, 350) * 0.35
      const amplitude = formantEnvelope / harmonic
      sample += Math.sin(phase * harmonic) * amplitude
      amplitudeSum += amplitude
    }
    const edgeEnvelope = Math.min(1, index / 480, (sampleCount - 1 - index) / 480)
    output[index] = sample / Math.max(1, amplitudeSum) * 0.7 * Math.max(0, edgeEnvelope)
  }
  return output
}

function createNoise(length: number, amplitude: number): Float32Array {
  const output = new Float32Array(length)
  let state = 0x12345678
  for (let index = 0; index < length; index += 1) {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    output[index] = ((state >>> 0) / 0xffffffff * 2 - 1) * amplitude
  }
  return output
}

function concatenate(...parts: Float32Array[]): Float32Array {
  const output = new Float32Array(parts.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.length
  }
  return output
}

function gaussian(value: number, center: number, width: number): number {
  return Math.exp(-0.5 * ((value - center) / width) ** 2)
}

function median(values: number[]): number {
  assert.ok(values.length > 0)
  const sorted = [...values].sort((first, second) => first - second)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function standardDeviation(values: number[]): number {
  const average = mean(values)
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)))
}

function rmsDifference(first: Float32Array, second: Float32Array): number {
  let energy = 0
  for (let index = 0; index < first.length; index += 1) energy += (first[index]! - second[index]!) ** 2
  return Math.sqrt(energy / first.length)
}

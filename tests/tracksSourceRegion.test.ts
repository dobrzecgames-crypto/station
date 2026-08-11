import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveClipSourceRegion } from '../src/tracks/clipSourceRegion.ts'
import type { AudioClip } from '../src/tracks/tracksTypes.ts'

function sourceClip(loop = false): AudioClip {
  return {
    id: 'clip-1', assetId: 'asset-1', fileName: 'vinyl.wav', assetDurationSeconds: 300,
    startBeat: 8, lengthBeats: 600, sourceOffsetSeconds: 0, sourceEndSeconds: 300,
    gain: 1, fadeInSeconds: 0, fadeOutSeconds: 0, loop, reversed: false, pitchSemitones: 0, tempoMatch: false,
  }
}

test('source waveform selection keeps a normal clip anchored and follows the selected duration', () => {
  const clip = resolveClipSourceRegion(sourceClip(), 120, 150, 300, 120)

  assert.equal(clip.startBeat, 8)
  assert.equal(clip.sourceOffsetSeconds, 120)
  assert.equal(clip.sourceEndSeconds, 150)
  assert.equal(clip.lengthBeats, 60)
})

test('source waveform selection preserves a looped clip timeline footprint', () => {
  const original = sourceClip(true)
  const clip = resolveClipSourceRegion(original, 12, 42, 300, 120)

  assert.equal(clip.lengthBeats, original.lengthBeats)
  assert.equal(clip.sourceOffsetSeconds, 12)
  assert.equal(clip.sourceEndSeconds, 42)
})

test('source waveform selection clamps to a valid region inside the asset', () => {
  const clip = resolveClipSourceRegion(sourceClip(), 299.999, 400, 300, 120)

  assert.equal(clip.sourceOffsetSeconds, 299.99)
  assert.equal(clip.sourceEndSeconds, 300)
  assert.ok(clip.lengthBeats > 0)
})

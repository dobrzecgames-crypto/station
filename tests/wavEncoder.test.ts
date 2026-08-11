import assert from 'node:assert/strict'
import test from 'node:test'
import { encodeWav } from '../src/audio/wavEncoder.ts'
import { getClipExportRegion } from '../src/tracks/clipExport.ts'
import type { AudioClip } from '../src/tracks/tracksTypes.ts'

function fakeAudioBuffer(channels: number[][], sampleRate = 48000): AudioBuffer {
  return {
    numberOfChannels: channels.length,
    length: channels[0]?.length ?? 0,
    sampleRate,
    getChannelData: (index: number) => Float32Array.from(channels[index]),
  } as AudioBuffer
}

function clip(changes: Partial<AudioClip> = {}): AudioClip {
  return {
    id: 'clip-1',
    assetId: 'asset-1',
    fileName: 'vinyl-side.wav',
    assetDurationSeconds: 5,
    startBeat: 0,
    lengthBeats: 2,
    sourceOffsetSeconds: 1.25,
    sourceEndSeconds: 2.75,
    gain: 1,
    fadeInSeconds: 0,
    fadeOutSeconds: 0,
    loop: false,
    reversed: false,
    pitchSemitones: 0,
    tempoMatch: false,
    ...changes,
  }
}

test('encodeWav writes only the requested source frame range', async () => {
  const blob = encodeWav(fakeAudioBuffer([[-1, -0.5, 0, 0.5, 1]], 5), { startFrame: 1, endFrame: 4 })
  const view = new DataView(await blob.arrayBuffer())

  assert.equal(blob.size, 44 + 3 * 2)
  assert.equal(view.getUint32(40, true), 3 * 2)
  assert.equal(view.getInt16(44, true), -16384)
  assert.equal(view.getInt16(46, true), 0)
  assert.equal(view.getInt16(48, true), 16384)
})

test('getClipExportRegion converts the non-destructive clip region to frames', () => {
  assert.deepEqual(getClipExportRegion(clip(), 100, 500), {
    startFrame: 125,
    endFrame: 275,
    filename: 'vinyl-side-CUT.wav',
  })
})

test('getClipExportRegion clamps an edge selection to the decoded buffer', () => {
  assert.deepEqual(getClipExportRegion(clip({ fileName: '  ', sourceOffsetSeconds: 4.999, sourceEndSeconds: 8 }), 100, 500), {
    startFrame: 499,
    endFrame: 500,
    filename: 'SAMPLE-CUT.wav',
  })
})

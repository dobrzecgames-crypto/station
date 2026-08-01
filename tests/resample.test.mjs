import assert from 'node:assert/strict'
import test from 'node:test'
import { StepSequencer } from '../src/audio/StepSequencer.ts'
import { encodeWav } from '../src/audio/wavEncoder.ts'

test('a control-only track fires PUMP without scheduling audible sample playback', () => {
  const calls = []
  const engine = {
    getCurrentTime: () => 0,
    schedulePumpControl: (channelId, when) => calls.push(['pump', channelId, when]),
    scheduleSample: () => calls.push(['sample']),
  }
  const ticker = { wake: () => undefined, cancel: () => undefined }
  const sequencer = new StepSequencer(engine, ticker, 0.1)
  const track = {
    source: 'sample',
    groupId: 'group-1',
    channelId: 'group-1:pad-01',
    controlOnly: true,
    assetId: 'asset-1',
    steps: [1, ...Array(15).fill(0)],
    shifts: Array(16).fill(0),
    lengths: Array(16).fill(0),
    options: {},
  }

  sequencer.start(() => ({
    bpm: 120,
    swing: 0,
    metronomeEnabled: false,
    mode: 'pattern',
    loopSong: false,
    lastSongSlot: null,
    getTracksForSlot: () => [track],
  }))
  sequencer.stop()

  assert.deepEqual(calls, [['pump', 'group-1:pad-01', 0]])
})

test('WAV encoding trims to the requested range and fades its last frame to zero', async () => {
  const samples = new Float32Array([0.25, 0.5, 1, 1, 1, 1])
  const buffer = {
    numberOfChannels: 1,
    length: samples.length,
    sampleRate: 4,
    getChannelData: () => samples,
  }

  const wav = encodeWav(buffer, { startFrame: 1, endFrame: 5, fadeOutSeconds: 0.5 })
  const view = new DataView(await wav.arrayBuffer())

  assert.equal(view.getUint32(40, true), 8)
  assert.equal(view.byteLength, 52)
  assert.equal(view.getInt16(44, true), 16384)
  assert.equal(view.getInt16(50, true), 0)
})

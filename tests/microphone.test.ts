import assert from 'node:assert/strict'
import test from 'node:test'
import { chooseMicrophoneMimeType, createMicrophoneFilename, maximumMicrophoneRecordingSeconds } from '../src/audio/MicrophoneRecorder.ts'

test('microphone capture prefers Opus WebM and falls back to the first supported mobile format', () => {
  assert.equal(chooseMicrophoneMimeType(() => true), 'audio/webm;codecs=opus')
  assert.equal(chooseMicrophoneMimeType((type) => type === 'audio/mp4'), 'audio/mp4')
  assert.equal(chooseMicrophoneMimeType(() => false), undefined)
})

test('microphone recordings get stable local WAV filenames', () => {
  assert.equal(createMicrophoneFilename(new Date(2026, 7, 1, 9, 5, 7)), 'MIC-20260801-090507.wav')
})

test('microphone capture is intentionally bounded for mobile memory', () => {
  assert.equal(maximumMicrophoneRecordingSeconds, 120)
})

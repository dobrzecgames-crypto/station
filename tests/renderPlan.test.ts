import assert from 'node:assert/strict'
import test from 'node:test'
import { createEffectSlotState, createEmptyEffectRack } from '../src/audio/effects.ts'
import { createRenderTimelinePlan, getEffectRackTailSeconds } from '../src/project/renderPlan.ts'
import type { AudioClip, AudioTrack } from '../src/tracks/tracksTypes.ts'

test('render timeline includes TRACKS starts before the SONG boundary and excludes later material', () => {
  const plan = createRenderTimelinePlan([track([
    clip('inside', 1, 1),
    clip('crossing', 3.5, 2),
    clip('at-boundary', 4, 1),
    clip('after', 6, 1),
  ])], 120, 1)

  assert.equal(plan.songEndBeats, 4)
  assert.equal(plan.songEndSeconds, 2)
  assert.deepEqual(plan.clips.map((item) => item.clipId), ['inside', 'crossing'])
  assert.equal(plan.clips[1].lengthBeats, 2)
  assert.equal(plan.clips[1].gain, 0.75)
  assert.equal(plan.clips[1].fadeOutSeconds, 0.2)
  assert.equal(plan.clips[1].reversed, true)
  assert.equal(plan.clips[1].pitchSemitones, -3)
})

test('render tail planning includes delay and TIGHT ROOM racks', () => {
  const delayRack = createEmptyEffectRack('delay')
  delayRack.slots[0] = createEffectSlotState('delay:1', 'delay', true)
  delayRack.slots[0].delay = { ...delayRack.slots[0].delay, enabled: true, sync: false, timeSeconds: 0.25, feedback: 0.5 }
  const roomRack = createEmptyEffectRack('room')
  roomRack.slots[0] = createEffectSlotState('room:1', 'tightRoom', true)
  roomRack.slots[0].tightRoom = { ...roomRack.slots[0].tightRoom, enabled: true, amount: 1, preDelaySeconds: 0.045, decaySeconds: 1.5 }

  assert.equal(getEffectRackTailSeconds(roomRack, 120), 1.545)
  assert.equal(getEffectRackTailSeconds(delayRack, 120), 2.5)

  delayRack.slots[1] = roomRack.slots[0]
  assert.equal(getEffectRackTailSeconds(delayRack, 120), 4.045)
})

function track(clips: AudioClip[]): AudioTrack {
  return { id: 'track-1', name: 'TRACK 1', order: 0, muted: false, solo: false, gain: 0.8, effects: createEmptyEffectRack('track-1'), clips }
}

function clip(id: string, startBeat: number, lengthBeats: number): AudioClip {
  return {
    id,
    assetId: `asset-${id}`,
    fileName: `${id}.wav`,
    assetDurationSeconds: 8,
    startBeat,
    lengthBeats,
    sourceOffsetSeconds: 0.25,
    sourceEndSeconds: 4,
    gain: 0.75,
    fadeInSeconds: 0.1,
    fadeOutSeconds: 0.2,
    loop: false,
    reversed: true,
    pitchSemitones: -3,
    tempoMatch: false,
  }
}

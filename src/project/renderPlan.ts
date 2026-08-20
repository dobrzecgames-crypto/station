import { getDelayTimeSeconds } from '../audio/effects.ts'
import type { EffectRackState } from '../audio/effects'
import type { TimelineSchedulerClip } from '../audio/TimelineScheduler'
import { toTimelineSchedulerClips } from '../tracks/tracksScheduling.ts'
import type { AudioTrack } from '../tracks/tracksTypes'

export interface RenderTimelinePlan {
  songEndBeats: number
  songEndSeconds: number
  clips: TimelineSchedulerClip[]
}

/** One Pattern Clip slot is one 16-step bar, or four quarter-note beats. */
export function createRenderTimelinePlan(audioTracks: readonly AudioTrack[], bpm: number, lastSongSlot: number): RenderTimelinePlan {
  const songEndBeats = Math.max(0, lastSongSlot) * 4
  return {
    songEndBeats,
    songEndSeconds: songEndBeats * (60 / bpm),
    // Tempo-match has no detected-source-BPM cache wired in live App state yet,
    // so both live and render deliberately resolve it against the same empty map.
    clips: toTimelineSchedulerClips(audioTracks, {}, bpm).filter((clip) => clip.startBeat < songEndBeats),
  }
}

export function getEffectRackTailSeconds(rack: EffectRackState, bpm: number): number {
  let total = 0
  for (const slot of rack.slots) {
    if (!slot.enabled) continue
    if (slot.type === 'delay' && slot.delay.enabled) {
      const feedback = Math.min(0.999, Math.max(0, slot.delay.feedback))
      const repeats = feedback <= 0 ? 1 : Math.ceil(Math.log(0.001) / Math.log(feedback))
      total += getDelayTimeSeconds(slot.delay, bpm) * repeats
    }
    if (slot.type === 'tightRoom' && slot.tightRoom.enabled && slot.tightRoom.amount > 0) {
      total += slot.tightRoom.preDelaySeconds + slot.tightRoom.decaySeconds
    }
  }
  return total
}

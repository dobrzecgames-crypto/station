import type { AudioEngine } from '../audio/AudioEngine'
import { getDelayTimeSeconds } from '../audio/effects'
import type { EffectRackState } from '../audio/effects'
import { getLastOccupiedSlot } from '../song/songOperations'
import { getSongTracksForSlot } from '../song/songTracks'
import { renderOffline } from './offlineRender'
import type { OfflineRenderResult } from './offlineRender'
import type { ProjectState } from './ProjectState'

export interface RenderSongOptions {
  state: ProjectState
  /** Supplies the decoded material and the sample rate the render matches. */
  liveEngine: AudioEngine
  onProgress?: (renderedFraction: number) => void
  signal?: AbortSignal
}

export type RenderSongResult = OfflineRenderResult

const maximumTailSeconds = 12
const tailSafetySeconds = 0.25
const maximumRenderSeconds = 10 * 60

/**
 * Renders the SONG playlist to an audio buffer, faster than real time.
 *
 * The render is a second `AudioEngine` over an `OfflineAudioContext`, driven by
 * the same `StepSequencer` live playback uses. The sequencer wakes on the
 * render clock instead of a timer, so the context clock genuinely advances
 * between scheduling passes and swing, SHIFT, choke groups, Pump and the effect
 * racks keep the behaviour they have on the live path. Live playback is
 * untouched: it keeps its own context and its own engine instance.
 */
export async function renderSongToBuffer({ state, liveEngine, onProgress, signal }: RenderSongOptions): Promise<RenderSongResult> {
  const lastSlot = getLastOccupiedSlot(state.playlist)
  if (lastSlot === null) throw new Error('Add at least one Pattern Clip before rendering.')

  const totalSeconds = getRenderSeconds(state, lastSlot)
  if (totalSeconds > maximumRenderSeconds) {
    throw new Error(`This song renders to ${Math.ceil(totalSeconds / 60)} minutes, past the ${maximumRenderSeconds / 60}-minute render limit.`)
  }

  return renderOffline({
    state,
    liveEngine,
    totalSeconds,
    onProgress,
    signal,
    createSequencerConfig: (engine) => ({
      bpm: state.bpm,
      swing: state.swing,
      metronomeEnabled: false,
      mode: 'song',
      loopSong: false,
      lastSongSlot: lastSlot,
      getTracksForSlot: (slot) => getSongTracksForSlot(state.patternGroups, state.playlist, slot, (assetId) => engine.hasSampleAsset(assetId)),
    }),
  })
}

/**
 * The render length is known before a note is scheduled, so the tail is
 * measured rather than guessed: the longest sample that actually plays, the
 * time a delay needs to decay by sixty decibels, and a small safety margin.
 */
function getRenderSeconds(state: ProjectState, lastSlot: number): number {
  const stepSeconds = 60 / state.bpm / 4
  const songSeconds = lastSlot * 16 * stepSeconds
  const latestStartSeconds = stepSeconds * (0.5 + Math.max(0, state.swing) * 0.5)
  const tailSeconds = Math.min(maximumTailSeconds, Math.max(getSampleTailSeconds(state), getSynthTailSeconds(state), getStringsTailSeconds(state), getDelayTailSeconds(state)))
  return songSeconds + latestStartSeconds + tailSeconds + tailSafetySeconds
}

function getSampleTailSeconds(state: ProjectState): number {
  let longest = 0
  for (const clip of state.playlist) {
    const group = state.patternGroups.find((candidate) => candidate.id === clip.patternGroupId)
    const steps = group?.variants[clip.variant]
    if (!group || !steps) continue
    for (const pad of group.bank.pads) {
      if (!pad.assetId || !steps[pad.id]?.some((velocity) => velocity > 0)) continue
      const playbackRate = 2 ** (pad.pitchSemitones / 12)
      longest = Math.max(longest, (pad.region.endSeconds - pad.region.startSeconds) / playbackRate)
    }
  }
  return longest
}

function getSynthTailSeconds(state: ProjectState): number {
  const stepSeconds = 60 / state.bpm / 4
  let longest = 0
  for (const clip of state.playlist) {
    const group = state.patternGroups.find((candidate) => candidate.id === clip.patternGroupId)
    const steps = group?.variants[clip.variant]
    if (!group || !steps) continue
    for (const pad of group.bank.pads) {
      if (!pad.synthPatchId || !steps[pad.id]?.some((velocity) => velocity > 0)) continue
      const patch = group.synthPatches.find((candidate) => candidate.id === pad.synthPatchId)
      if (patch) longest = Math.max(longest, patch.gate * stepSeconds + patch.ampEnvelope.releaseSeconds)
    }
  }
  return longest
}

function getStringsTailSeconds(state: ProjectState): number {
  const stepSeconds = 60 / state.bpm / 4
  let longest = 0
  for (const clip of state.playlist) {
    const group = state.patternGroups.find((candidate) => candidate.id === clip.patternGroupId)
    const steps = group?.variants[clip.variant]
    if (!group || !steps) continue
    for (const pad of group.bank.pads) {
      if (!pad.stringsPatchId || !steps[pad.id]?.some((velocity) => velocity > 0)) continue
      const patch = group.stringsPatches.find((candidate) => candidate.id === pad.stringsPatchId)
      if (patch) longest = Math.max(longest, patch.gate * stepSeconds + patch.ampEnvelope.releaseSeconds)
    }
  }
  return longest
}

function getDelayTailSeconds(state: ProjectState): number {
  const played = new Set(state.playlist.map((clip) => clip.patternGroupId))
  const racks = [state.masterEffects, ...state.patternGroups.filter((group) => played.has(group.id)).map((group) => group.effects)]
  let longest = 0
  for (const rack of racks) longest = Math.max(longest, getRackDelayTailSeconds(rack, state.bpm))
  return longest
}

function getRackDelayTailSeconds(rack: EffectRackState, bpm: number): number {
  let longest = 0
  for (const slot of rack.slots) {
    if (slot.type !== 'delay' || !slot.enabled || !slot.delay.enabled) continue
    const feedback = Math.min(0.999, Math.max(0, slot.delay.feedback))
    const repeats = feedback <= 0 ? 1 : Math.ceil(Math.log(0.001) / Math.log(feedback))
    longest = Math.max(longest, getDelayTimeSeconds(slot.delay, bpm) * repeats)
  }
  return longest
}

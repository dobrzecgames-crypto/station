import type { AudioEngine } from '../audio/AudioEngine'
import { createChannelId } from '../audio/channelIdentity'
import { getDelayTimeSeconds } from '../audio/effects'
import type { EffectRackState } from '../audio/effects'
import type { StepSequencerTrack } from '../audio/StepSequencer'
import type { PadState } from '../pads/types'
import type { PatternVariantName } from '../patterns/patternTypes'
import { getPatternTracks } from '../song/songTracks'
import { renderOffline } from './offlineRender'
import type { OfflineRenderResult } from './offlineRender'
import type { ProjectState } from './ProjectState'

export const resampleLoopCounts = [1, 2, 4] as const
export type ResampleLoopCount = typeof resampleLoopCounts[number]
export type ResampleSource = 'master' | 'selectedPad'

export interface RenderPatternOptions {
  state: ProjectState
  liveEngine: AudioEngine
  groupId: string
  variant: PatternVariantName
  source: ResampleSource
  selectedPadId: string
  loopCount: ResampleLoopCount
  captureTail: boolean
  onProgress?: (renderedFraction: number) => void
  signal?: AbortSignal
}

export interface RenderPatternResult extends OfflineRenderResult {
  /** Exclusive frame used when the WAV is encoded. */
  endFrame: number
  durationSeconds: number
  tailSeconds: number
}

const maximumTailSeconds = 4
const renderSafetySeconds = 0.06

/** Renders one current Pattern Group variant, repeated continuously 1/2/4 times. */
export async function renderPatternToBuffer(options: RenderPatternOptions): Promise<RenderPatternResult> {
  const { state, liveEngine, groupId, variant, source, selectedPadId, loopCount, captureTail, onProgress, signal } = options
  if (!resampleLoopCounts.includes(loopCount)) throw new Error('Choose 1, 2 or 4 loops.')
  const group = state.patternGroups.find((candidate) => candidate.id === groupId)
  if (!group?.variants[variant]) throw new Error('The selected pattern is unavailable.')

  const tracks = getPatternTracks(state.patternGroups, groupId, variant, (assetId) => liveEngine.hasSampleAsset(assetId))
  const selectedChannelId = createChannelId({ patternGroupId: groupId, padId: selectedPadId })
  const audibleTracks = source === 'master' ? tracks : tracks.filter((track) => track.channelId === selectedChannelId)
  if (!audibleTracks.some(hasEvents)) {
    throw new Error(source === 'master' ? 'The current pattern has no events to resample.' : 'The selected pad has no events in the current pattern.')
  }

  const loopSeconds = 16 * (60 / state.bpm / 4)
  const musicSeconds = loopSeconds * loopCount
  const tailSeconds = captureTail ? getTailSeconds(state, groupId, audibleTracks) : 0
  const durationSeconds = musicSeconds + tailSeconds
  const totalSeconds = durationSeconds + renderSafetySeconds
  const selectedPad = source === 'selectedPad' ? { groupId, padId: selectedPadId } : undefined

  const result = await renderOffline({
    state,
    liveEngine,
    totalSeconds,
    measuredSeconds: durationSeconds,
    selectedPad,
    onProgress,
    signal,
    createSequencerConfig: (engine) => ({
      bpm: state.bpm,
      swing: state.swing,
      metronomeEnabled: false,
      // Song mode supplies a finite count of 16-step slots. The track source
      // stays the current pattern, so this is repetition, not Playlist render.
      mode: 'song',
      loopSong: false,
      lastSongSlot: loopCount,
      getTracksForSlot: () => {
        const current = getPatternTracks(state.patternGroups, groupId, variant, (assetId) => engine.hasSampleAsset(assetId))
        if (source === 'master') return current
        return current.map((track) => track.channelId === selectedChannelId ? track : { ...track, controlOnly: true })
      },
    }),
  })

  return {
    ...result,
    durationSeconds,
    tailSeconds,
    endFrame: Math.min(result.buffer.length, result.startFrame + Math.round(durationSeconds * result.buffer.sampleRate)),
  }
}

function hasEvents(track: StepSequencerTrack): boolean {
  return track.steps.some((velocity) => velocity > 0)
}

function getTailSeconds(state: ProjectState, groupId: string, tracks: readonly StepSequencerTrack[]): number {
  const group = state.patternGroups.find((candidate) => candidate.id === groupId)
  if (!group) return 0
  const padsByChannel = new Map(group.bank.pads.map((pad) => [createChannelId({ patternGroupId: group.id, padId: pad.id }), pad]))
  let sourceTail = 0
  for (const track of tracks) {
    if (!hasEvents(track)) continue
    const pad = padsByChannel.get(track.channelId)
    if (!pad) continue
    sourceTail = Math.max(sourceTail, getPadTailSeconds(pad, track, state.bpm))
  }
  const effectTail = Math.max(getRackTailSeconds(group.effects, state.bpm), getRackTailSeconds(state.masterEffects, state.bpm))
  const pumpTail = state.pumpRoutes
    .filter((route) => route.targetGroupId === groupId)
    .reduce((longest, route) => Math.max(longest, 60 / state.bpm * route.lengthBeats), 0)
  return Math.min(maximumTailSeconds, Math.max(sourceTail, effectTail, pumpTail))
}

function getPadTailSeconds(pad: PadState, track: StepSequencerTrack, bpm: number): number {
  if (track.source === 'sample') {
    const playbackRate = 2 ** (pad.pitchSemitones / 12)
    return Math.max(0, pad.region.endSeconds - pad.region.startSeconds) / playbackRate
  }
  const stepSeconds = 60 / bpm / 4
  if (track.source === 'synth') return track.patch.gate * stepSeconds + track.patch.ampEnvelope.releaseSeconds
  return track.patch.gate * stepSeconds + track.patch.ampEnvelope.releaseSeconds
}

function getRackTailSeconds(rack: EffectRackState, bpm: number): number {
  let longest = 0
  for (const slot of rack.slots) {
    if (!slot.enabled) continue
    if (slot.type === 'delay' && slot.delay.enabled) {
      const feedback = Math.min(0.999, Math.max(0, slot.delay.feedback))
      const repeats = feedback <= 0 ? 1 : Math.ceil(Math.log(0.001) / Math.log(feedback))
      longest = Math.max(longest, getDelayTimeSeconds(slot.delay, bpm) * repeats)
    }
    if (slot.type === 'tightRoom' && slot.tightRoom.enabled) {
      longest = Math.max(longest, slot.tightRoom.preDelaySeconds + slot.tightRoom.decaySeconds * 2.5)
    }
  }
  return longest
}

import { AudioEngine } from '../audio/AudioEngine'
import { createChannelId } from '../audio/channelIdentity'
import { StepSequencer } from '../audio/StepSequencer'
import type { SequencerTicker, StepSequencerConfig } from '../audio/StepSequencer'
import { TimelineScheduler } from '../audio/TimelineScheduler'
import type { TimelineSchedulerConfig } from '../audio/TimelineScheduler'
import { getLastOccupiedSlot } from '../song/songOperations'
import { getSongTracksForSlot } from '../song/songTracks'
import { organicBassEnvelopeShape } from '../organic-bass/organicBassOperations'
import type { ProjectState } from './ProjectState'
import { getStepEventRange } from '../patterns/stepEvents.ts'
import { createRenderTimelinePlan, getEffectRackTailSeconds } from './renderPlan'

export interface RenderSongOptions {
  state: ProjectState
  /** Supplies the decoded material and the sample rate the render matches. */
  liveEngine: AudioEngine
  onProgress?: (renderedFraction: number) => void
  signal?: AbortSignal
}

export interface RenderSongResult {
  buffer: AudioBuffer
  /** Where the music starts. Earlier frames are silent processing latency. */
  startFrame: number
  /** Linear peak of the render. Above one means the file will clip. */
  peak: number
  clippedSampleCount: number
}

const renderChannelCount = 2
const renderLookAheadSeconds = 0.1
const renderStepSeconds = 0.05
const renderQuantumFrames = 128
const maximumTailSeconds = 12
const tailSafetySeconds = 0.25
const maximumRenderSeconds = 10 * 60
const maximumPrerollSeconds = 0.05

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

  const sampleRate = liveEngine.getSampleRate()
  if (!sampleRate) throw new Error('Start audio before rendering.')
  const missingAsset = state.assets.find((asset) => !liveEngine.getDecodedSampleAsset(asset.id))
  if (missingAsset) throw new Error(`Cannot render because ${missingAsset.filename} is not loaded.`)

  const timelinePlan = createRenderTimelinePlan(state.audioTracks, state.bpm, lastSlot)
  const totalSeconds = getRenderSeconds(state, lastSlot)
  if (totalSeconds > maximumRenderSeconds) {
    throw new Error(`This song renders to ${Math.ceil(totalSeconds / 60)} minutes, past the ${maximumRenderSeconds / 60}-minute render limit.`)
  }

  const context = new OfflineAudioContext(renderChannelCount, Math.ceil(totalSeconds * sampleRate), sampleRate)
  const engine = new AudioEngine()
  await engine.initializeForRender(context)
  applyRenderState(engine, liveEngine, state)
  if (getPolyTailSeconds(state) > 0 && engine.getDiagnostics().optionalInstruments.zolaX.status !== 'ready') {
    engine.dispose()
    throw new Error('ZOLA-X could not be loaded for offline rendering. Core audio remains available; retry the render, or use this browser without ZOLA-X export.')
  }

  const ticker = new RenderTicker(context, totalSeconds, onProgress)
  const sequencer = new StepSequencer(engine, ticker, renderLookAheadSeconds)
  // All TRACKS starts inside the bounded SONG interval are cheap enough to
  // schedule at time zero (eight tracks maximum). This still uses the live
  // TimelineScheduler/AudioEngine path while avoiding two clients competing
  // for OfflineAudioContext.suspend() at the same render quantum.
  const timelineScheduler = new TimelineScheduler(engine, passiveRenderTicker, timelinePlan.songEndSeconds + renderLookAheadSeconds)
  const timelineConfig: TimelineSchedulerConfig = { bpm: state.bpm, getClips: () => timelinePlan.clips }
  const config: StepSequencerConfig = {
    bpm: state.bpm,
    swing: state.swing,
    // A render is the song, never the click.
    metronomeEnabled: false,
    // LOOP SONG is a monitoring preference, so the file is one pass of the
    // playlist regardless of how the transport is set.
    mode: 'song',
    loopSong: false,
    lastSongSlot: lastSlot,
    getTracksForSlot: (slot) => getSongTracksForSlot(state.patternGroups, state.playlist, slot, (assetId) => engine.hasSampleAsset(assetId), state.projectKey),
  }

  const cancelled = new Promise<never>((_resolve, reject) => {
    if (!signal) return
    const abort = () => {
      // Abandoning leaves the render thread suspended instead of resuming it,
      // so a cancelled render stops doing work immediately.
      ticker.abandon()
      reject(new DOMException('Render cancelled.', 'AbortError'))
    }
    if (signal.aborted) abort()
    else signal.addEventListener('abort', abort, { once: true })
  })

  const suspendedAtStart = context.suspend(0)
  const rendering = context.startRendering()

  try {
    await suspendedAtStart
    timelineScheduler.start(() => timelineConfig, 0, 0)
    timelineScheduler.stopAt(timelinePlan.songEndSeconds)
    sequencer.start(() => config)
    const buffer = await Promise.race([rendering, cancelled])
    onProgress?.(1)
    return { buffer, ...measureRender(buffer) }
  } finally {
    sequencer.stop()
    timelineScheduler.stop()
    engine.dispose()
  }
}

/**
 * Drives the sequencer from the render clock. Each pass suspends the render,
 * lets the sequencer write the next window of events, and resumes.
 */
class RenderTicker implements SequencerTicker {
  private stopped = false

  constructor(
    private readonly context: OfflineAudioContext,
    private readonly totalSeconds: number,
    private readonly onProgress?: (renderedFraction: number) => void,
  ) {}

  wake(callback: () => void): void {
    if (this.stopped) return
    this.onProgress?.(Math.min(1, this.context.currentTime / this.totalSeconds))
    const next = this.quantize(this.context.currentTime + renderStepSeconds)
    if (next >= this.totalSeconds) {
      this.release()
      return
    }
    void this.context.suspend(next).then(() => {
      if (!this.stopped) callback()
    }, () => undefined)
    this.release()
  }

  cancel(): void {
    if (this.stopped) return
    this.stopped = true
    this.release()
  }

  /** Stops without resuming, so a cancelled render leaves the thread parked. */
  abandon(): void {
    this.stopped = true
  }

  /** Scheduling is finished for now; the audio is not. Let the render run on. */
  private release(): void {
    void this.context.resume().catch(() => undefined)
  }

  /** A render can only be suspended on a render-quantum boundary. */
  private quantize(seconds: number): number {
    const quantum = renderQuantumFrames / this.context.sampleRate
    return Math.ceil(seconds / quantum) * quantum
  }
}

/**
 * One pass over the finished render for everything the UI needs to know: how
 * hot it is, whether quantising to PCM will clip, and where the music starts.
 *
 * A render opens with bit-exact silence while the master rack's compressor
 * lookahead fills, which would otherwise land the file a few milliseconds late
 * against a grid. Skipping exact zeros fixes that without hard-coding any
 * particular browser's latency.
 */
function measureRender(buffer: AudioBuffer): Omit<RenderSongResult, 'buffer'> {
  const channels = Array.from({ length: buffer.numberOfChannels }, (_unused, index) => buffer.getChannelData(index))
  const prerollLimit = Math.min(buffer.length, Math.round(maximumPrerollSeconds * buffer.sampleRate))
  let startFrame = 0
  while (startFrame < prerollLimit && channels.every((channel) => channel[startFrame] === 0)) startFrame += 1

  let peak = 0
  let clippedSampleCount = 0
  for (const channel of channels) {
    for (let frame = startFrame; frame < channel.length; frame += 1) {
      const magnitude = Math.abs(channel[frame])
      if (magnitude > peak) peak = magnitude
      if (magnitude > 1) clippedSampleCount += 1
    }
  }

  return { startFrame, peak, clippedSampleCount }
}

function applyRenderState(engine: AudioEngine, liveEngine: AudioEngine, state: ProjectState): void {
  engine.syncSynthPatches(state.patternGroups.flatMap((group) => group.synthPatches.map((patch) => ({ groupId: group.id, patch }))))
  engine.syncOrganicBassPatches(state.patternGroups.flatMap((group) => group.organicBassPatches.map((patch) => ({ groupId: group.id, patch }))))
  engine.syncPolyPatches(state.patternGroups.flatMap((group) => group.polyPatches.map((patch) => ({ groupId: group.id, patch }))))
  for (const asset of state.assets) {
    engine.setDecodedSampleAsset(asset.id, liveEngine.getDecodedSampleAsset(asset.id)!)
  }
  for (const group of state.patternGroups) {
    for (const pad of group.bank.pads) {
      const channelId = createChannelId({ patternGroupId: group.id, padId: pad.id })
      engine.setChannelVolume(group.id, channelId, pad.volume)
      engine.setChannelMuted(group.id, channelId, pad.muted)
      engine.setChannelSolo(group.id, channelId, pad.solo)
    }
  }
  for (const group of state.patternGroups) {
    engine.setGroupVolume(group.id, group.bus!.volume)
    engine.setGroupMuted(group.id, group.bus!.muted)
    engine.setGroupSolo(group.id, group.bus!.solo)
  }
  for (const track of state.audioTracks) {
    engine.setGroupVolume(track.id, track.gain)
    engine.setGroupMuted(track.id, track.muted)
    engine.setGroupSolo(track.id, track.solo)
    engine.setGroupEffects(track.id, track.effects)
  }
  engine.setMasterVolume(state.master.volume)
  engine.setMasterMuted(state.master.muted)
  engine.setBpm(state.bpm)
  engine.setMasterEffects(state.masterEffects)
  for (const group of state.patternGroups) engine.setGroupEffects(group.id, group.effects)
  engine.setPumpRoutes(state.pumpRoutes.map((route) => ({
    id: route.id,
    sourceChannelId: createChannelId(route.source),
    targetGroupId: route.targetGroupId,
    depth: route.depth,
    lengthSeconds: 60 / state.bpm * route.lengthBeats,
    curve: route.curve,
  })))
  engine.applyMixerStateImmediately()
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
  const tailSeconds = Math.min(maximumTailSeconds, Math.max(getSampleTailSeconds(state), getSynthTailSeconds(state), getOrganicBassTailSeconds(state), getPolyTailSeconds(state), getEffectTailSeconds(state, lastSlot)))
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
      if (patch) longest = Math.max(longest, longestEventSpan(steps[pad.id], group.lengths[clip.variant]?.[pad.id]) * patch.gate * stepSeconds + patch.ampEnvelope.releaseSeconds)
    }
  }
  return longest
}

function getOrganicBassTailSeconds(state: ProjectState): number {
  const stepSeconds = 60 / state.bpm / 4
  let longest = 0
  for (const clip of state.playlist) {
    const group = state.patternGroups.find((candidate) => candidate.id === clip.patternGroupId)
    const steps = group?.variants[clip.variant]
    if (!group || !steps) continue
    for (const pad of group.bank.pads) {
      if (!pad.organicBassPatchId || !steps[pad.id]?.some((velocity) => velocity > 0)) continue
      const patch = group.organicBassPatches.find((candidate) => candidate.id === pad.organicBassPatchId)
      if (patch) longest = Math.max(longest, longestEventSpan(steps[pad.id], group.lengths[clip.variant]?.[pad.id]) * patch.gate * stepSeconds + organicBassEnvelopeShape(patch.decay).releaseSeconds)
    }
  }
  return longest
}

function getPolyTailSeconds(state: ProjectState): number {
  const stepSeconds = 60 / state.bpm / 4
  let longest = 0
  for (const clip of state.playlist) {
    const group = state.patternGroups.find((candidate) => candidate.id === clip.patternGroupId)
    const steps = group?.variants[clip.variant]
    if (!group || !steps) continue
    for (const pad of group.bank.pads) {
      if (!pad.polyPatchId || !steps[pad.id]?.some((velocity) => velocity > 0)) continue
      const patch = group.polyPatches.find((candidate) => candidate.id === pad.polyPatchId)
      if (patch) longest = Math.max(longest, longestEventSpan(steps[pad.id], group.lengths[clip.variant]?.[pad.id]) * patch.gate * stepSeconds + patch.ampEnvelope.releaseSeconds)
    }
  }
  return longest
}

function longestEventSpan(steps: readonly number[], lengths: readonly number[] | undefined): number {
  let longest = 1
  const eventLengths = lengths ?? Array(steps.length).fill(1)
  for (let stepIndex = 0; stepIndex < steps.length; stepIndex += 1) {
    const event = getStepEventRange(steps, eventLengths, stepIndex)
    if (event?.headIndex === stepIndex) longest = Math.max(longest, event.length)
  }
  return longest
}

function getEffectTailSeconds(state: ProjectState, lastSlot: number): number {
  const played = new Set(state.playlist.map((clip) => clip.patternGroupId))
  const songEndBeats = lastSlot * 4
  const playedTracks = state.audioTracks.filter((track) => track.clips.some((clip) => clip.startBeat < songEndBeats))
  const upstreamRacks = [
    ...state.patternGroups.filter((group) => played.has(group.id)).map((group) => group.effects),
    ...playedTracks.map((track) => track.effects),
  ]
  const upstreamTail = upstreamRacks.reduce((longest, rack) => Math.max(longest, getEffectRackTailSeconds(rack, state.bpm)), 0)
  return upstreamTail + getEffectRackTailSeconds(state.masterEffects, state.bpm)
}

const passiveRenderTicker: SequencerTicker = { wake: () => undefined, cancel: () => undefined }

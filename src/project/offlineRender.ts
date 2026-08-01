import { AudioEngine } from '../audio/AudioEngine'
import { createChannelId } from '../audio/channelIdentity'
import { StepSequencer } from '../audio/StepSequencer'
import type { SequencerTicker, StepSequencerConfig } from '../audio/StepSequencer'
import type { ProjectState } from './ProjectState'

export interface OfflineRenderResult {
  buffer: AudioBuffer
  /** Where the music starts. Earlier frames are silent processing latency. */
  startFrame: number
  /** Linear peak of the measured render range. Above one means PCM will clip. */
  peak: number
  clippedSampleCount: number
}

export interface OfflineRenderOptions {
  state: ProjectState
  /** Supplies decoded sample material and the sample rate the render matches. */
  liveEngine: AudioEngine
  totalSeconds: number
  createSequencerConfig: (renderEngine: AudioEngine) => StepSequencerConfig
  /** Isolates one pad while retaining every track's PUMP control events. */
  selectedPad?: { groupId: string; padId: string }
  /** Limits peak/clipping measurement without changing the rendered buffer. */
  measuredSeconds?: number
  onProgress?: (renderedFraction: number) => void
  signal?: AbortSignal
}

const renderChannelCount = 2
const renderLookAheadSeconds = 0.1
const renderStepSeconds = 0.05
const renderQuantumFrames = 128
const maximumPrerollSeconds = 0.05

/**
 * Shared offline engine used by SONG export and resampling. It deliberately
 * owns no arrangement policy: callers decide which tracks the common
 * StepSequencer receives and how long the context runs.
 */
export async function renderOffline({ state, liveEngine, totalSeconds, createSequencerConfig, selectedPad, measuredSeconds, onProgress, signal }: OfflineRenderOptions): Promise<OfflineRenderResult> {
  const sampleRate = liveEngine.getSampleRate()
  if (!sampleRate) throw new Error('Start audio before rendering.')

  const context = new OfflineAudioContext(renderChannelCount, Math.ceil(totalSeconds * sampleRate), sampleRate)
  const engine = new AudioEngine()
  engine.initializeForRender(context)
  applyRenderState(engine, liveEngine, state, selectedPad)

  const ticker = new RenderTicker(context, totalSeconds, onProgress)
  const sequencer = new StepSequencer(engine, ticker, renderLookAheadSeconds)
  const config = createSequencerConfig(engine)
  let abortListener: (() => void) | undefined
  const cancelled = new Promise<never>((_resolve, reject) => {
    if (!signal) return
    abortListener = () => {
      // Leave the render thread parked so cancellation stops work immediately.
      ticker.abandon()
      reject(new DOMException('Render cancelled.', 'AbortError'))
    }
    if (signal.aborted) abortListener()
    else signal.addEventListener('abort', abortListener, { once: true })
  })

  const suspendedAtStart = context.suspend(0)
  const rendering = context.startRendering()
  await suspendedAtStart
  sequencer.start(() => config)

  try {
    const buffer = await Promise.race([rendering, cancelled])
    onProgress?.(1)
    return { buffer, ...measureRender(buffer, measuredSeconds) }
  } finally {
    if (signal && abortListener) signal.removeEventListener('abort', abortListener)
    sequencer.stop()
    engine.dispose()
  }
}

/** Drives the sequencer from the render clock rather than a wall-clock timer. */
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

  abandon(): void {
    this.stopped = true
  }

  private release(): void {
    void this.context.resume().catch(() => undefined)
  }

  private quantize(seconds: number): number {
    const quantum = renderQuantumFrames / this.context.sampleRate
    return Math.ceil(seconds / quantum) * quantum
  }
}

function measureRender(buffer: AudioBuffer, measuredSeconds?: number): Omit<OfflineRenderResult, 'buffer'> {
  const channels = Array.from({ length: buffer.numberOfChannels }, (_unused, index) => buffer.getChannelData(index))
  const prerollLimit = Math.min(buffer.length, Math.round(maximumPrerollSeconds * buffer.sampleRate))
  let startFrame = 0
  while (startFrame < prerollLimit && channels.every((channel) => channel[startFrame] === 0)) startFrame += 1

  const measuredFrames = measuredSeconds === undefined ? buffer.length - startFrame : Math.round(measuredSeconds * buffer.sampleRate)
  const endFrame = Math.min(buffer.length, startFrame + measuredFrames)
  let peak = 0
  let clippedSampleCount = 0
  for (const channel of channels) {
    for (let frame = startFrame; frame < endFrame; frame += 1) {
      const magnitude = Math.abs(channel[frame])
      if (magnitude > peak) peak = magnitude
      if (magnitude > 1) clippedSampleCount += 1
    }
  }

  return { startFrame, peak, clippedSampleCount }
}

function applyRenderState(engine: AudioEngine, liveEngine: AudioEngine, state: ProjectState, selectedPad?: OfflineRenderOptions['selectedPad']): void {
  engine.syncSynthPatches(state.patternGroups.flatMap((group) => group.synthPatches.map((patch) => ({ groupId: group.id, patch }))))
  engine.syncStringsPatches(state.patternGroups.flatMap((group) => group.stringsPatches.map((patch) => ({ groupId: group.id, patch }))))
  for (const group of state.patternGroups) {
    for (const pad of group.bank.pads) {
      const buffer = pad.assetId ? liveEngine.getDecodedSampleAsset(pad.assetId) : undefined
      if (pad.assetId && buffer) engine.setDecodedSampleAsset(pad.assetId, buffer)
      const channelId = createChannelId({ patternGroupId: group.id, padId: pad.id })
      const isSelected = selectedPad?.groupId === group.id && selectedPad.padId === pad.id
      engine.setChannelVolume(group.id, channelId, pad.volume)
      engine.setChannelMuted(group.id, channelId, selectedPad ? (!isSelected || pad.muted) : pad.muted)
      // Explicit isolation wins over unrelated latched solos. Mute on the
      // selected channel is still respected above.
      engine.setChannelSolo(group.id, channelId, selectedPad ? false : pad.solo)
    }
  }
  for (const group of state.patternGroups) {
    const isSelectedGroup = selectedPad?.groupId === group.id
    engine.setGroupVolume(group.id, group.bus!.volume)
    engine.setGroupMuted(group.id, selectedPad ? (!isSelectedGroup || group.bus!.muted) : group.bus!.muted)
    engine.setGroupSolo(group.id, selectedPad ? false : group.bus!.solo)
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

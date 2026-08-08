import { createDefaultMasterEffectRack, createEmptyEffectRack, defaultCompressorConfig, defaultDelayConfig, getDelayTimeSeconds, normalizeEffectRackState } from './effects'
import type { EffectRackState, EffectSlotState, EffectType, TightRoomMode } from './effects'
import type { DrumPatch, DrumVoiceHandle } from '../drumsynth/drumSynthTypes'
import { playKickVoice } from '../drumsynth/kickVoice'
import { playSnareVoice } from '../drumsynth/snareVoice'
import { createRandomSeed } from '../drumsynth/seededRandom'
import { cloneSynthPatch, lfoFrequencyHz, maximumSynthVoices } from '../synth/synthOperations'
import type { SynthPatch } from '../synth/synthTypes'
import {
  cloneStringsPatch,
  maximumStringsVoices,
  stringsBodyToBrightnessBias,
  stringsBodyToOscillatorBGain,
  stringsBowToGain,
  stringsBrightnessToHz,
  stringsCharacterBias,
  stringsMotionFilterDepthHz,
  stringsMotionPanDepth,
  stringsOctaveLayerMixToGain,
  stringsSpaceFeedback,
  stringsSpaceWet,
  stringsWarmthWetGain,
  stringsWidthToPan,
} from '../strings/stringsOperations'
import type { StringsPatch } from '../strings/stringsTypes'
import {
  cloneOrganicBassPatch,
  organicBassContourSemitones,
  organicBassCutoffHz,
  organicBassEnvelopeShape,
  organicBassGlideSeconds,
  organicBassResonanceQ,
  organicBassVelocityResponse,
  organicBassWaveCoefficients,
  organicBassWeightMacro,
} from '../organic-bass/organicBassOperations'
import type { OrganicBassPatch } from '../organic-bass/organicBassTypes'

export type SampleId = string
export type SampleAssetId = string
export type ChannelId = string
export type GroupId = string

export type AudioEngineStatus = 'inactive' | 'starting' | 'ready' | 'suspended' | 'interrupted' | 'error'

export interface LoadedSampleInfo {
  filename: string
  durationSeconds: number
}

export interface RuntimeSampleAsset {
  filename: string
  blob: Blob
}

export interface TriggerSampleOptions {
  gain?: number
  pitchSemitones?: number
  startSeconds?: number
  endSeconds?: number
  attackMs?: number
  releaseMs?: number
  /** Runtime-only sequencer key used to choke previous CHOP slices. */
  chokeGroupId?: string
  /** Runtime-only sequencer step length. Shorter than the region's natural duration, it cuts the voice early through the same release fade as a normal envelope. */
  maxDurationSeconds?: number
  /** Plays the region back to front, from a lazily-cached time-reversed copy
      of the whole asset rather than a per-region copy - see reversedSamples. */
  reversed?: boolean
}

/**
 * Options for scheduleClip (TRACKS). Distinct from TriggerSampleOptions
 * because a clip's fades are seconds (musical-length, up to several seconds)
 * rather than a pad's short millisecond attack/release, and because a clip
 * always has a hard timeline-slot duration to truncate at - see
 * tracks/tracksTypes.ts's AudioClip docs for why.
 */
export interface ScheduleClipOptions {
  sourceOffsetSeconds: number
  sourceEndSeconds: number
  /** Hard timeline-slot duration in seconds. Playback is always truncated
      here regardless of loop/pitch/tempo rate, so a clip never bleeds past
      its own slot into the next one. */
  lengthSeconds: number
  gain?: number
  pitchSemitones?: number
  /** Extra multiplier from tracks/tracksOperations.ts's resolveTempoMatchRate,
      stacked with the semitone-derived rate. 1 (or omitted) when tempo match
      is off. */
  tempoRate?: number
  fadeInSeconds?: number
  fadeOutSeconds?: number
  loop?: boolean
  /** Plays this clip's region back to front, from the same lazily-cached
      whole-asset reversed buffer a reversed Pad or CHOP slice already uses. */
  reversed?: boolean
}

export type PumpCurve = 'snap' | 'smooth' | 'swell'

/**
 * One independent sidechain link: a single pad trigger ducks one whole
 * Pattern Group bus. Several routes can be active together, each with its own
 * depth/length/shape, so a kick and a snare can each pump a different group.
 * If a route's source pad happens to live inside its own target group, that
 * pad also gets ducked - the target's bus gain sums every pad in the group
 * before Pump is applied, so a single pad cannot be excluded from it.
 */
export interface PumpRoute {
  id: string
  sourceChannelId: ChannelId
  targetGroupId: GroupId
  depth: number
  lengthSeconds: number
  curve: PumpCurve
}

/** A presentation-only reading of one channel's post-fader signal. */
export interface ChannelMeterReading {
  /** Peak level in dBFS. `-Infinity` means that no measurable signal is present. */
  dbfs: number
}

interface ActiveVoice {
  source: AudioScheduledSourceNode
  gain: GainNode
  cleanedUp: boolean
  origin: 'manual' | 'sequencer' | 'preview' | 'timeline'
  isSample: boolean
  startsAt: number
  /** CHOP slices share this key so their sequenced triggers can be monophonic. */
  chokeGroupId?: string
  stopAt?: number
  onEnded?: () => void
}

export interface SynthPatchRegistration {
  groupId: GroupId
  patch: SynthPatch
}

interface ActiveSynthVoice {
  oscillators: [OscillatorNode, OscillatorNode, OscillatorNode]
  oscillatorGains: [GainNode, GainNode, GainNode]
  filters: [BiquadFilterNode, BiquadFilterNode]
  drive: WaveShaperNode
  amp: GainNode
  origin: 'manual' | 'sequencer'
  groupId: GroupId
  patchKey: string
  channelId: ChannelId
  midiNote: number
  startsAt: number
  serial: number
  manualToken?: string
  stopAt?: number
  stolen?: boolean
  cleanedUp: boolean
}

interface HeldMonoNote {
  token: string
  groupId: GroupId
  channelId: ChannelId
  midiNote: number
  velocity: number
}

interface SynthPatchRuntime {
  groupId: GroupId
  patch: SynthPatch
  lfo?: OscillatorNode
  lfoDepth?: GainNode
  voices: Set<ActiveSynthVoice>
  heldMonoNotes: HeldMonoNote[]
  currentMonoVoice?: ActiveSynthVoice
  lastMidiNote?: number
}

export interface OrganicBassPatchRegistration {
  groupId: GroupId
  patch: OrganicBassPatch
}

interface ActiveOrganicBassVoice {
  oscillators: [OscillatorNode, OscillatorNode, OscillatorNode]
  oscillatorGains: [GainNode, GainNode, GainNode]
  preDrive: GainNode
  saturation: WaveShaperNode
  filters: [BiquadFilterNode, BiquadFilterNode]
  outputTrim: GainNode
  amp: GainNode
  routes: Map<ChannelId, GainNode>
  origin: 'manual' | 'sequencer'
  groupId: GroupId
  patchKey: string
  channelId: ChannelId
  midiNote: number
  velocity: number
  startsAt: number
  serial: number
  stopAt?: number
  cleanedUp: boolean
}

interface HeldOrganicBassNote {
  token: string
  groupId: GroupId
  channelId: ChannelId
  midiNote: number
  velocity: number
}

interface OrganicBassPatchRuntime {
  groupId: GroupId
  patch: OrganicBassPatch
  voices: Set<ActiveOrganicBassVoice>
  heldNotes: HeldOrganicBassNote[]
  currentVoice?: ActiveOrganicBassVoice
  driftLfoA?: OscillatorNode
  driftLfoB?: OscillatorNode
  driftDepthA?: GainNode
  driftDepthB?: GainNode
}

export interface StringsPatchRegistration {
  groupId: GroupId
  patch: StringsPatch
}

interface ActiveStringsVoiceLayer {
  oscillator: OscillatorNode
  gain: GainNode
}

interface ActiveStringsVoice {
  oscillators: [OscillatorNode, OscillatorNode]
  /** BODY balance sits here, between each oscillator and the shared filter - oscillatorA's is always unity, oscillatorB's tracks stringsBodyToOscillatorBGain. */
  oscillatorGains: [GainNode, GainNode]
  filter: BiquadFilterNode
  amp: GainNode
  /** Fades the shared vibrato signal in after note-on rather than gating the LFO itself, so the LFO stays phase-continuous across every voice. */
  vibratoOnset: GainNode
  /** Present only when the voice was built with OCTAVE LAYER active - a layer cannot be added to an already-playing voice, only at its own note-on. */
  layer?: ActiveStringsVoiceLayer
  /** BOW's shared-buffer noise layer. Always present (unlike `layer`) since BOW must update smoothly on an already-sounding voice; its fade-out rides the same shared `amp` envelope as the oscillators rather than having one of its own. */
  bow: { source: AudioBufferSourceNode; gain: GainNode }
  origin: 'manual' | 'sequencer'
  groupId: GroupId
  patchKey: string
  channelId: ChannelId
  midiNote: number
  startsAt: number
  serial: number
  manualToken?: string
  stopAt?: number
  stolen?: boolean
  cleanedUp: boolean
}

/**
 * A signal-path insert, so it must be keyed per channel, not just per patch: a
 * patch shared across several pads (Scale Map) needs an independent ensemble
 * per pad, or their voices would sum into whichever channel built the
 * ensemble first and silently break that pad's own volume/mute/solo/Pump.
 */
interface RuntimeStringsEnsemble {
  input: GainNode
  dryGain: GainNode
  delayA: DelayNode
  delayB: DelayNode
  pannerA: StereoPannerNode
  pannerB: StereoPannerNode
  wetGainA: GainNode
  wetGainB: GainNode
  delayModDepthA: GainNode
  delayModDepthB: GainNode
  /** MOTION's pan drift, fed from the same shared LFO into both panners with opposite sign - the stereo image breathes in width around a fixed center rather than sliding like autopan. */
  motionPanDepthA: GainNode
  motionPanDepthB: GainNode
  output: GainNode
  /** WARMTH: one fixed saturation curve, created once and never regenerated (a WaveShaper's `.curve` cannot be ramped, so changing it live would click) - only the dry/wet balance below moves. */
  warmthShaper: WaveShaperNode
  warmthDry: GainNode
  warmthWet: GainNode
  /** SPACE: a small damped feedback delay, independent of ENSEMBLE - see docs. */
  spaceDelay: DelayNode
  spaceDamping: BiquadFilterNode
  spaceFeedback: GainNode
  spaceWet: GainNode
}

interface StringsPatchRuntime {
  groupId: GroupId
  patch: StringsPatch
  voices: Set<ActiveStringsVoice>
  ensembles: Map<ChannelId, RuntimeStringsEnsemble>
  vibratoDepth?: GainNode
  /** MOTION's filter-cutoff drift, fanned into every active voice's filter.frequency at creation - one shared depth gain per runtime, not per voice. */
  motionFilterDepth?: GainNode
}

interface Channel {
  groupId: GroupId
  volume: number
  muted: boolean
  solo: boolean
  gain?: GainNode
  meter?: AnalyserNode
  meterSamples?: Float32Array<ArrayBuffer>
}

/** `pumpGain` sits after `gain` so Pump ducking applies to the whole bus without disturbing the group's own volume/mute/solo automation. */
interface GroupBus { volume: number; muted: boolean; solo: boolean; gain?: GainNode; pumpGain?: GainNode }

interface RuntimeEffect {
  input: AudioNode
  output: AudioNode
  applyConfig(config: EffectSlotState, immediately: boolean): void
  dispose(): void
}

interface RuntimeEffectSlot {
  input: GainNode
  output: GainNode
  type: EffectType
  effect?: RuntimeEffect
}

interface RuntimeEffectRack {
  input: GainNode
  output: GainNode
  slots: [RuntimeEffectSlot, RuntimeEffectSlot]
}

interface TightRoomModeBias {
  lowCutHz: number
  dampingMultiplier: number
  tightBias: number
  toneBias: number
}

/** ROOM is neutral; DRUM and VOCAL only nudge these four coefficients - all three modes share one DSP graph, never a separate algorithm. */
const tightRoomModeBiases: Record<TightRoomMode, TightRoomModeBias> = {
  room: { lowCutHz: 170, dampingMultiplier: 1, tightBias: 0, toneBias: 0 },
  drum: { lowCutHz: 220, dampingMultiplier: 0.92, tightBias: 0.12, toneBias: -0.05 },
  vocal: { lowCutHz: 150, dampingMultiplier: 0.85, tightBias: -0.1, toneBias: -0.12 },
}

function tightRoomModeBias(mode: TightRoomMode): TightRoomModeBias {
  return tightRoomModeBiases[mode] ?? tightRoomModeBiases.room
}

/** One damped feedback comb inside a TIGHT ROOM channel. `ratio` is a fixed construction-time constant; delay time is recomputed from the live SIZE parameter on every applyConfig call. `modDepthGain` scales a shared, slow, free-running LFO onto the delay time - without it a handful of static combs beat as discrete metallic pitches instead of a diffuse tail. */
interface TightRoomComb {
  ratio: number
  delayTime: AudioParam
  feedbackGain: AudioParam
  dampingFrequency: AudioParam
  modDepthGain: AudioParam
  dispose: () => void
}

interface TightRoomChannel {
  combs: TightRoomComb[]
  output: AudioNode
  dispose: () => void
}

export class AudioEngine {
  /**
   * The graph is built against `BaseAudioContext` so one engine class covers
   * both live playback and an offline render. Only the live path owns a
   * context it can resume, suspend or close, and that one is `liveContext`.
   */
  private context: BaseAudioContext | undefined
  private liveContext: AudioContext | undefined
  private masterEffects: RuntimeEffectRack | undefined
  private masterGain: GainNode | undefined
  private readonly channels = new Map<ChannelId, Channel>()
  private readonly groupBuses = new Map<GroupId, GroupBus>()
  private readonly groupEffects = new Map<GroupId, RuntimeEffectRack>()
  private readonly groupEffectStates = new Map<GroupId, EffectRackState>()
  private masterVolume = 1
  private masterMuted = false
  private masterEffectState: EffectRackState
  private bpm = 120
  private pumpRoutes: readonly PumpRoute[] = []
  private samples = new Map<SampleId, AudioBuffer>()
  private waveforms = new Map<SampleId, number[]>()
  /** One lazily-built time-reversed copy per asset, shared by every reversed
      slice/pad that plays any part of it - never one copy per slice. Built on
      first use, not at load time, since most assets never play in reverse. */
  private reversedSamples = new Map<SampleId, AudioBuffer>()
  private runtimeAssets = new Map<SampleAssetId, RuntimeSampleAsset>()
  private activeVoices = new Set<ActiveVoice>()
  private previewVoices = new Set<ActiveVoice>()
  private readonly synthPatches = new Map<string, SynthPatchRegistration>()
  private readonly synthRuntimes = new Map<string, SynthPatchRuntime>()
  private activeSynthVoices = new Set<ActiveSynthVoice>()
  private synthVoiceSerial = 0
  private readonly organicBassPatches = new Map<string, OrganicBassPatchRegistration>()
  private readonly organicBassRuntimes = new Map<string, OrganicBassPatchRuntime>()
  private activeOrganicBassVoices = new Set<ActiveOrganicBassVoice>()
  private organicBassVoiceSerial = 0
  private organicBassSaturationCurve?: Float32Array<ArrayBuffer>
  private readonly stringsPatches = new Map<string, StringsPatchRegistration>()
  private readonly stringsRuntimes = new Map<string, StringsPatchRuntime>()
  private activeStringsVoices = new Set<ActiveStringsVoice>()
  private stringsVoiceSerial = 0
  /** Free-running, engine-wide - shared by every STRINGS patch for CPU cost, never tempo-synced. Only the depth downstream of them is per-patch/per-channel. */
  private stringsVibratoLfo?: OscillatorNode
  private stringsEnsembleLfoA?: OscillatorNode
  private stringsEnsembleLfoB?: OscillatorNode
  /** MOTION's shared LFO - one more free-running oscillator at an incommensurate rate, feeding a per-runtime filter depth and a per-channel pan depth. */
  private stringsMotionLfo?: OscillatorNode
  /** BOW's noise source data, generated once and reused by every voice's own cheap AudioBufferSourceNode - the expensive part (the buffer) is shared, not the lightweight per-voice player. */
  private stringsNoiseBuffer?: AudioBuffer
  /** WARMTH's saturation curve - fixed and generated once, ever. A WaveShaper's `.curve` cannot be smoothly ramped, so WARMTH moves a dry/wet blend instead of regenerating this. */
  private stringsWarmthCurve?: Float32Array<ArrayBuffer>
  /** DRUM SYNTH preview voices only, any instrument - a rendered-to-pad kick or snare plays back as an ordinary sample through `scheduleSample`/`activeVoices`, never through this set. See docs/DECISIONS.md DEC-024/DEC-025. */
  private readonly drumPreviewVoices = new Set<DrumVoiceHandle>()
  private status: AudioEngineStatus = 'inactive'
  private readonly statusListeners = new Set<(status: AudioEngineStatus) => void>()
  private lifecycleRecoveryInstalled = false
  private readonly handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') this.requestLiveContextResume()
  }
  private readonly handleResumeGesture = () => {
    if (document.visibilityState === 'visible') this.requestLiveContextResume()
  }

  constructor(channelIds: readonly ChannelId[] = []) {
    this.masterEffectState = createDefaultMasterEffectRack()
    for (const channelId of channelIds) {
      this.channels.set(channelId, { groupId: '', volume: 1, muted: false, solo: false })
    }
  }

  getStatus(): AudioEngineStatus {
    return this.status
  }

  subscribeToStatus(listener: (status: AudioEngineStatus) => void): () => void {
    this.statusListeners.add(listener)
    return () => this.statusListeners.delete(listener)
  }

  async initialize(): Promise<void> {
    if (this.liveContext?.state === 'running') {
      this.setStatus('ready')
      return
    }

    this.setStatus('starting')

    try {
      const AudioContextConstructor = window.AudioContext
      this.liveContext ??= new AudioContextConstructor()
      this.context = this.liveContext
      this.liveContext.onstatechange = () => this.syncContextStatus()
      this.installLifecycleRecovery()
      this.createMasterOutput(this.liveContext)
      this.createChannelNodes()
      this.ensureAllSynthRuntimes()
      this.ensureAllOrganicBassRuntimes()
      this.ensureAllStringsRuntimes()
      await this.liveContext.resume()

      if (this.liveContext.state !== 'running') {
        throw new Error('Audio is still suspended. Try START AUDIO again.')
      }

      this.setStatus('ready')
    } catch (error) {
      this.setStatus('error')
      throw this.toError(error, 'Unable to start Web Audio.')
    }
  }

  /**
   * Binds this engine to a render context instead of a live output. The graph,
   * the scheduling entry points and the mixer setters are the ones live
   * playback uses, so a render cannot quietly grow its own audio behaviour.
   */
  initializeForRender(context: OfflineAudioContext): void {
    this.context = context
    this.createMasterOutput(context)
    this.createChannelNodes()
    this.ensureAllSynthRuntimes()
    this.ensureAllOrganicBassRuntimes()
    this.ensureAllStringsRuntimes()
    this.setStatus('ready')
  }

  getSampleRate(): number {
    return this.context?.sampleRate ?? 0
  }

  getDecodedSampleAsset(assetId: SampleAssetId): AudioBuffer | undefined {
    return this.samples.get(assetId)
  }

  /**
   * Hands an already decoded buffer to a render engine. An `AudioBuffer` is not
   * owned by the context that decoded it, so a render at the live sample rate
   * reuses the exact material that was played, with no second decode.
   */
  setDecodedSampleAsset(assetId: SampleAssetId, buffer: AudioBuffer): void {
    this.samples.set(assetId, buffer)
  }

  /**
   * Drops the ten-millisecond smoothing ramps the setters use, so a render
   * starts at the mixer state instead of sliding into it over its first step.
   */
  applyMixerStateImmediately(): void {
    this.applyAllChannelGains(true)
    this.applyAllGroupGains(true)
    this.applyMasterGain(true)
    this.applyRuntimeEffectRack(this.masterEffects, this.masterEffectState, true)
    for (const [groupId, state] of this.groupEffectStates) this.applyRuntimeEffectRack(this.groupEffects.get(groupId), state, true)
  }

  async loadSample(assetId: SampleAssetId, file: File): Promise<LoadedSampleInfo> {
    return this.loadSampleBlob(assetId, file, file.name)
  }

  async loadSampleBlob(assetId: SampleAssetId, blob: Blob, filename: string): Promise<LoadedSampleInfo> {
    if (this.status !== 'ready' || !this.context) {
      throw new Error('Start audio before loading a sample.')
    }

    if (!this.isWavAsset(blob, filename)) {
      throw new Error('Select a WAV file.')
    }

    try {
      const audioData = await blob.arrayBuffer()
      const decodedBuffer = await this.context.decodeAudioData(audioData)

      this.samples.set(assetId, decodedBuffer)
      this.waveforms.set(assetId, this.createWaveform(decodedBuffer))
      this.runtimeAssets.set(assetId, { filename, blob })
      // Defensive: a reload under the same id (rare, but not impossible) must
      // not leave a reversed copy of the previous audio behind.
      this.reversedSamples.delete(assetId)
      return {
        filename,
        durationSeconds: decodedBuffer.duration,
      }
    } catch (error) {
      throw this.toError(error, `Could not decode "${filename}" as WAV audio.`)
    }
  }

  hasSampleAsset(assetId: SampleAssetId): boolean {
    return this.samples.has(assetId)
  }

  removeSampleAsset(assetId: SampleAssetId): boolean {
    this.waveforms.delete(assetId)
    this.runtimeAssets.delete(assetId)
    this.reversedSamples.delete(assetId)
    return this.samples.delete(assetId)
  }

  getRuntimeSampleAsset(assetId: SampleAssetId): RuntimeSampleAsset | undefined {
    const asset = this.runtimeAssets.get(assetId)
    return asset ? { ...asset } : undefined
  }

  getSampleAssetIds(): SampleAssetId[] {
    return [...this.samples.keys()]
  }

  getWaveformPeaks(assetId: SampleAssetId): number[] | undefined {
    return this.waveforms.get(assetId)?.slice()
  }

  /**
   * A finer, RMS-based sibling of `getWaveformPeaks` for CHOP's own transient
   * and tempo analysis, not for drawing. `getWaveformPeaks`'s cache is capped
   * at 512 buckets total for the waveform canvas - fine for a picture, far too
   * coarse (20-50ms/bucket on a 20-25s source) to place cuts precisely on. This
   * reads the real decoded buffer on demand instead, at a target resolution
   * that stays cheap (one linear pass, no caching - CHOP analyzes one loaded
   * source at a time) while being 8-10x finer than the drawing cache.
   */
  getAnalysisEnvelope(assetId: SampleAssetId, targetBucketSeconds = 0.005): number[] | undefined {
    const sampleBuffer = this.samples.get(assetId)
    if (!sampleBuffer) return undefined
    const maxAnalysisBucketCount = 6000
    const bucketCount = Math.min(maxAnalysisBucketCount, Math.max(1, Math.round(sampleBuffer.duration / targetBucketSeconds)))
    const bucketSize = Math.ceil(sampleBuffer.length / bucketCount)
    const envelope: number[] = []

    for (let bucketIndex = 0; bucketIndex < bucketCount; bucketIndex += 1) {
      const start = bucketIndex * bucketSize
      const end = Math.min(sampleBuffer.length, start + bucketSize)
      let sumOfSquares = 0
      let sampleCount = 0

      for (let channelIndex = 0; channelIndex < sampleBuffer.numberOfChannels; channelIndex += 1) {
        const channelData = sampleBuffer.getChannelData(channelIndex)
        for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
          sumOfSquares += channelData[sampleIndex] * channelData[sampleIndex]
          sampleCount += 1
        }
      }
      envelope.push(sampleCount > 0 ? Math.sqrt(sumOfSquares / sampleCount) : 0)
    }

    return envelope
  }

  /**
   * Reads the real channel signal after its volume and mute/solo, but before
   * its group bus - so this does not reflect Pump ducking, which is applied
   * at the group bus stage. This is deliberately a pull API: UI refresh
   * cadence never participates in audio scheduling or transport timing.
   */
  getChannelMeterReading(channelId: ChannelId): ChannelMeterReading {
    const channel = this.channels.get(channelId)
    if (this.status !== 'ready' || !channel?.meter || !channel.meterSamples) return { dbfs: -Infinity }

    channel.meter.getFloatTimeDomainData(channel.meterSamples)
    let peak = 0
    for (const sample of channel.meterSamples) peak = Math.max(peak, Math.abs(sample))
    return { dbfs: peak > 0 ? 20 * Math.log10(peak) : -Infinity }
  }

  setChannelVolume(groupId: GroupId, channelId: ChannelId, volume: number): void {
    const channel = this.ensureChannel(groupId, channelId)
    channel.volume = this.toGain(volume)
    this.applyChannelGain(channel)
  }

  setChannelMuted(groupId: GroupId, channelId: ChannelId, muted: boolean): void {
    const channel = this.ensureChannel(groupId, channelId)
    channel.muted = muted
    this.applyAllChannelGains()
  }

  setChannelSolo(groupId: GroupId, channelId: ChannelId, solo: boolean): void {
    const channel = this.ensureChannel(groupId, channelId)
    channel.solo = solo
    this.applyAllChannelGains()
  }

  setPumpRoutes(routes: readonly PumpRoute[]): void {
    this.pumpRoutes = routes
  }

  setGroupVolume(groupId: GroupId, volume: number): void { const bus = this.ensureGroupBus(groupId); bus.volume = this.toGain(volume); this.applyAllGroupGains() }
  setGroupMuted(groupId: GroupId, muted: boolean): void { const bus = this.ensureGroupBus(groupId); bus.muted = muted; this.applyAllGroupGains() }
  setGroupSolo(groupId: GroupId, solo: boolean): void { const bus = this.ensureGroupBus(groupId); bus.solo = solo; this.applyAllGroupGains() }
  setMasterVolume(volume: number): void { this.masterVolume = this.toGain(volume); this.applyMasterGain() }
  setMasterMuted(muted: boolean): void { this.masterMuted = muted; this.applyMasterGain() }
  setMasterEffects(config: EffectRackState): void {
    this.masterEffectState = normalizeEffectRackState(config, 'master', createDefaultMasterEffectRack())
    this.applyRuntimeEffectRack(this.masterEffects, this.masterEffectState)
  }
  setGroupEffects(groupId: GroupId, config: EffectRackState): void {
    const state = normalizeEffectRackState(config, groupId)
    this.groupEffectStates.set(groupId, state)
    this.applyRuntimeEffectRack(this.groupEffects.get(groupId), state)
  }
  setBpm(bpm: number): void {
    const nextBpm = this.toBoundedNumber(bpm, 60, 200, 120)
    if (this.bpm === nextBpm) return
    this.bpm = nextBpm
    this.applySynchronizedDelayTimes()
    for (const runtime of this.synthRuntimes.values()) this.applySynthLfo(runtime)
  }

  syncSynthPatches(registrations: readonly SynthPatchRegistration[]): void {
    const nextKeys = new Set<string>()
    for (const registration of registrations) {
      const key = this.synthPatchKey(registration.groupId, registration.patch.id)
      nextKeys.add(key)
      this.synthPatches.set(key, { groupId: registration.groupId, patch: cloneSynthPatch(registration.patch) })
      const runtime = this.synthRuntimes.get(key)
      if (runtime) this.updateSynthRuntime(runtime, registration.patch)
      else if (this.context && this.masterEffects) this.ensureSynthRuntime(registration.groupId, registration.patch)
    }
    for (const key of [...this.synthPatches.keys()]) {
      if (nextKeys.has(key)) continue
      this.synthPatches.delete(key)
      const runtime = this.synthRuntimes.get(key)
      if (runtime) this.disposeSynthRuntime(key, runtime)
    }
  }

  syncOrganicBassPatches(registrations: readonly OrganicBassPatchRegistration[]): void {
    const nextKeys = new Set<string>()
    for (const registration of registrations) {
      const key = this.organicBassPatchKey(registration.groupId, registration.patch.id)
      nextKeys.add(key)
      this.organicBassPatches.set(key, { groupId: registration.groupId, patch: cloneOrganicBassPatch(registration.patch) })
      const runtime = this.organicBassRuntimes.get(key)
      if (runtime) this.updateOrganicBassRuntime(runtime, registration.patch)
      else if (this.context) this.ensureOrganicBassRuntime(registration.groupId, registration.patch)
    }
    for (const key of [...this.organicBassPatches.keys()]) {
      if (nextKeys.has(key)) continue
      this.organicBassPatches.delete(key)
      const runtime = this.organicBassRuntimes.get(key)
      if (runtime) this.disposeOrganicBassRuntime(key, runtime)
    }
  }

  syncStringsPatches(registrations: readonly StringsPatchRegistration[]): void {
    const nextKeys = new Set<string>()
    for (const registration of registrations) {
      const key = this.stringsPatchKey(registration.groupId, registration.patch.id)
      nextKeys.add(key)
      this.stringsPatches.set(key, { groupId: registration.groupId, patch: cloneStringsPatch(registration.patch) })
      const runtime = this.stringsRuntimes.get(key)
      if (runtime) this.updateStringsRuntime(runtime, registration.patch)
      else if (this.context) this.ensureStringsRuntime(registration.groupId, registration.patch)
    }
    for (const key of [...this.stringsPatches.keys()]) {
      if (nextKeys.has(key)) continue
      this.stringsPatches.delete(key)
      const runtime = this.stringsRuntimes.get(key)
      if (runtime) this.disposeStringsRuntime(key, runtime)
    }
  }

  triggerSample(groupId: GroupId, channelId: ChannelId, assetId: SampleAssetId, options: TriggerSampleOptions = {}): void {
    if (!this.context) {
      return
    }

    this.scheduleSample(groupId, channelId, assetId, this.context.currentTime, options)
  }

  triggerSynthPad(groupId: GroupId, channelId: ChannelId, patch: SynthPatch, midiNotes: readonly number[], velocity = 1, manualToken = channelId): void {
    if (this.status !== 'ready' || !this.context) return
    const runtime = this.ensureSynthRuntime(groupId, patch)
    const when = this.context.currentTime
    this.triggerPumpRoutesForChannel(channelId, when)
    if (patch.mode === 'mono') {
      const midiNote = midiNotes[0]
      if (!Number.isFinite(midiNote)) return
      runtime.heldMonoNotes = runtime.heldMonoNotes.filter((held) => held.token !== manualToken)
      runtime.heldMonoNotes.push({ token: manualToken, groupId, channelId, midiNote, velocity: this.toGain(velocity) })
      this.startMonoSynthVoice(runtime, groupId, channelId, midiNote, velocity, when, 'manual', manualToken)
      return
    }
    this.releaseSynthPad(manualToken)
    for (const midiNote of midiNotes.slice(0, maximumSynthVoices)) {
      if (Number.isFinite(midiNote)) this.startSynthVoice(runtime, groupId, channelId, midiNote, velocity, when, 'manual', manualToken)
    }
  }

  /** SMART CHORDS treats the Pattern Group as the monophonic unit while the
      notes inside its active chord remain polyphonic. */
  triggerSynthChord(groupId: GroupId, channelId: ChannelId, patch: SynthPatch, midiNotes: readonly number[], velocity = 1, manualToken = channelId): void {
    if (this.status !== 'ready' || !this.context) return
    const runtime = this.ensureSynthRuntime(groupId, patch)
    const when = this.context.currentTime
    this.triggerPumpRoutesForChannel(channelId, when)
    this.releaseSynthPad(manualToken)
    for (const midiNote of midiNotes.slice(0, maximumSynthVoices)) {
      if (Number.isFinite(midiNote)) this.startSynthVoice(runtime, groupId, channelId, midiNote, velocity * 0.42, when, 'manual', manualToken)
    }
  }

  releaseSynthPad(manualToken: string): void {
    if (!this.context) return
    const when = this.context.currentTime
    for (const runtime of this.synthRuntimes.values()) {
      const wasLastHeld = runtime.heldMonoNotes.at(-1)?.token === manualToken
      runtime.heldMonoNotes = runtime.heldMonoNotes.filter((held) => held.token !== manualToken)
      for (const voice of runtime.voices) if (voice.origin === 'manual' && voice.manualToken === manualToken) this.releaseSynthVoice(runtime, voice, when)
      if (runtime.patch.mode !== 'mono' || !wasLastHeld) continue
      const fallback = runtime.heldMonoNotes.at(-1)
      if (fallback) this.startMonoSynthVoice(runtime, fallback.groupId, fallback.channelId, fallback.midiNote, fallback.velocity, when, 'manual', fallback.token)
    }
  }

  scheduleSynthPad(groupId: GroupId, channelId: ChannelId, patch: SynthPatch, midiNotes: readonly number[], when: number, noteOffWhen: number, velocity: number): void {
    if (this.status !== 'ready' || !this.context) return
    const runtime = this.ensureSynthRuntime(groupId, patch)
    const scheduledWhen = Math.max(this.context.currentTime, when)
    const scheduledOff = Math.max(scheduledWhen + 0.005, noteOffWhen)
    this.triggerPumpRoutesForChannel(channelId, scheduledWhen)
    if (patch.mode === 'mono') {
      const midiNote = midiNotes[0]
      if (!Number.isFinite(midiNote)) return
      const voice = this.startMonoSynthVoice(runtime, groupId, channelId, midiNote, velocity, scheduledWhen, 'sequencer')
      if (voice) this.releaseSynthVoice(runtime, voice, scheduledOff)
      return
    }
    for (const midiNote of midiNotes.slice(0, maximumSynthVoices)) {
      if (!Number.isFinite(midiNote)) continue
      const voice = this.startSynthVoice(runtime, groupId, channelId, midiNote, velocity, scheduledWhen, 'sequencer')
      if (voice) this.releaseSynthVoice(runtime, voice, scheduledOff)
    }
  }

  scheduleSynthChord(groupId: GroupId, channelId: ChannelId, patch: SynthPatch, midiNotes: readonly number[], when: number, noteOffWhen: number, velocity: number): void {
    if (this.status !== 'ready' || !this.context) return
    const runtime = this.ensureSynthRuntime(groupId, patch)
    const scheduledWhen = Math.max(this.context.currentTime, when)
    const scheduledOff = Math.max(scheduledWhen + 0.005, noteOffWhen)
    this.triggerPumpRoutesForChannel(channelId, scheduledWhen)
    for (const midiNote of midiNotes.slice(0, maximumSynthVoices)) {
      if (!Number.isFinite(midiNote)) continue
      const voice = this.startSynthVoice(runtime, groupId, channelId, midiNote, velocity * 0.42, scheduledWhen, 'sequencer')
      if (voice) this.releaseSynthVoice(runtime, voice, scheduledOff)
    }
  }

  triggerOrganicBassPad(groupId: GroupId, channelId: ChannelId, patch: OrganicBassPatch, midiNote: number, velocity = 1, manualToken = channelId): void {
    if (this.status !== 'ready' || !this.context || !Number.isFinite(midiNote)) return
    const runtime = this.ensureOrganicBassRuntime(groupId, patch)
    const when = this.context.currentTime
    const boundedVelocity = this.toGain(velocity)
    this.triggerPumpRoutesForChannel(channelId, when)
    runtime.heldNotes = runtime.heldNotes.filter((held) => held.token !== manualToken)
    const canLegato = runtime.currentVoice?.origin === 'manual' && runtime.currentVoice.stopAt === undefined && !runtime.currentVoice.cleanedUp && runtime.heldNotes.length > 0
    runtime.heldNotes.push({ token: manualToken, groupId, channelId, midiNote, velocity: boundedVelocity })
    if (canLegato && runtime.currentVoice) {
      this.glideOrganicBassVoice(runtime, runtime.currentVoice, channelId, midiNote, boundedVelocity, when)
      return
    }
    if (runtime.currentVoice && !runtime.currentVoice.cleanedUp) this.releaseOrganicBassVoice(runtime, runtime.currentVoice, when, 0.008)
    runtime.currentVoice = this.startOrganicBassVoice(runtime, groupId, channelId, midiNote, boundedVelocity, when, 'manual')
  }

  releaseOrganicBassPad(manualToken: string): void {
    if (!this.context) return
    const when = this.context.currentTime
    for (const runtime of this.organicBassRuntimes.values()) {
      const wasCurrent = runtime.heldNotes.at(-1)?.token === manualToken
      runtime.heldNotes = runtime.heldNotes.filter((held) => held.token !== manualToken)
      if (!wasCurrent || !runtime.currentVoice || runtime.currentVoice.cleanedUp) continue
      const fallback = runtime.heldNotes.at(-1)
      if (fallback) this.glideOrganicBassVoice(runtime, runtime.currentVoice, fallback.channelId, fallback.midiNote, fallback.velocity, when)
      else this.releaseOrganicBassVoice(runtime, runtime.currentVoice, when)
    }
  }

  scheduleOrganicBassPad(groupId: GroupId, channelId: ChannelId, patch: OrganicBassPatch, midiNote: number, when: number, noteOffWhen: number, velocity: number): void {
    if (this.status !== 'ready' || !this.context || !Number.isFinite(midiNote)) return
    const runtime = this.ensureOrganicBassRuntime(groupId, patch)
    const scheduledWhen = Math.max(this.context.currentTime, when)
    const scheduledOff = Math.max(scheduledWhen + 0.005, noteOffWhen)
    this.triggerPumpRoutesForChannel(channelId, scheduledWhen)
    if (runtime.currentVoice && !runtime.currentVoice.cleanedUp) this.releaseOrganicBassVoice(runtime, runtime.currentVoice, scheduledWhen, 0.008)
    const voice = this.startOrganicBassVoice(runtime, groupId, channelId, midiNote, velocity, scheduledWhen, 'sequencer')
    runtime.currentVoice = voice
    if (voice) this.releaseOrganicBassVoice(runtime, voice, scheduledOff)
  }

  /** Always polyphonic - unlike MONOPOLY there is no MONO mode, so every call takes the same chord path. */
  triggerStringsPad(groupId: GroupId, channelId: ChannelId, patch: StringsPatch, midiNotes: readonly number[], velocity = 1, manualToken = channelId): void {
    if (this.status !== 'ready' || !this.context) return
    const runtime = this.ensureStringsRuntime(groupId, patch)
    const when = this.context.currentTime
    this.triggerPumpRoutesForChannel(channelId, when)
    this.releaseStringsPad(manualToken)
    for (const midiNote of midiNotes.slice(0, maximumStringsVoices)) {
      if (Number.isFinite(midiNote)) this.startStringsVoice(runtime, channelId, midiNote, velocity, when, 'manual', manualToken)
    }
  }

  releaseStringsPad(manualToken: string): void {
    if (!this.context) return
    const when = this.context.currentTime
    for (const runtime of this.stringsRuntimes.values()) {
      for (const voice of runtime.voices) if (voice.origin === 'manual' && voice.manualToken === manualToken) this.releaseStringsVoice(runtime, voice, when)
    }
  }

  scheduleStringsPad(groupId: GroupId, channelId: ChannelId, patch: StringsPatch, midiNotes: readonly number[], when: number, noteOffWhen: number, velocity: number): void {
    if (this.status !== 'ready' || !this.context) return
    const runtime = this.ensureStringsRuntime(groupId, patch)
    const scheduledWhen = Math.max(this.context.currentTime, when)
    const scheduledOff = Math.max(scheduledWhen + 0.005, noteOffWhen)
    this.triggerPumpRoutesForChannel(channelId, scheduledWhen)
    for (const midiNote of midiNotes.slice(0, maximumStringsVoices)) {
      if (!Number.isFinite(midiNote)) continue
      const voice = this.startStringsVoice(runtime, channelId, midiNote, velocity, scheduledWhen, 'sequencer')
      if (voice) this.releaseStringsVoice(runtime, voice, scheduledOff)
    }
  }

  /** Cut only the preceding sequenced SMART CHORDS voice in this Pattern
      Group; a stale note-off cannot silence the newer chord. */
  releaseSequencerChordAt(groupId: GroupId, when: number): void {
    if (!this.context) return
    const releaseAt = Math.max(this.context.currentTime, when)
    for (const runtime of this.synthRuntimes.values()) {
      for (const voice of runtime.voices) if (voice.origin === 'sequencer' && voice.groupId === groupId && voice.startsAt < releaseAt && (voice.stopAt === undefined || voice.stopAt > releaseAt)) this.releaseSynthVoice(runtime, voice, releaseAt, 0.008)
    }
    for (const runtime of this.stringsRuntimes.values()) {
      for (const voice of runtime.voices) if (voice.origin === 'sequencer' && voice.groupId === groupId && voice.startsAt < releaseAt && (voice.stopAt === undefined || voice.stopAt > releaseAt)) this.releaseStringsVoice(runtime, voice, releaseAt, 0.008)
    }
  }

  previewAsset(assetId: SampleAssetId, options: TriggerSampleOptions = {}, onEnded?: () => void): void {
    const sampleBuffer = this.resolvePlaybackBuffer(assetId, options.reversed)
    if (this.status !== 'ready' || !this.context || !this.masterEffects || !sampleBuffer) return

    const when = this.context.currentTime
    const source = this.context.createBufferSource()
    const gain = this.context.createGain()
    const voice: ActiveVoice = { source, gain, cleanedUp: false, origin: 'preview', isSample: true, startsAt: when, onEnded }
    const playbackRate = this.toPlaybackRate(options.pitchSemitones)
    // Duration is identical on the reversed copy (same length/sampleRate as
    // the forward buffer it mirrors), so this is safe regardless of reversed.
    const region = this.toPlaybackRegion(sampleBuffer.duration, options.startSeconds, options.endSeconds, options.reversed)
    const outputDuration = region.durationSeconds / playbackRate
    const fadeDuration = Math.min(0.004, outputDuration / 2)
    source.buffer = sampleBuffer
    gain.gain.setValueAtTime(0, when)
    gain.gain.linearRampToValueAtTime(this.toGain(options.gain), when + fadeDuration)
    gain.gain.setValueAtTime(this.toGain(options.gain), when + Math.max(fadeDuration, outputDuration - fadeDuration))
    gain.gain.linearRampToValueAtTime(0, when + outputDuration)
    source.playbackRate.setValueAtTime(playbackRate, when)
    source.connect(gain)
    gain.connect(this.masterEffects.input)
    source.addEventListener('ended', () => this.cleanUpVoice(voice), { once: true })
    this.activeVoices.add(voice)
    this.previewVoices.add(voice)
    source.start(when, region.startSeconds, region.durationSeconds)
  }

  stopPreview(): void {
    for (const voice of [...this.previewVoices]) {
      try {
        voice.source.stop()
      } catch {
        // A preview source may already have ended before it is stopped.
      }
      this.cleanUpVoice(voice)
    }
    for (const voice of [...this.drumPreviewVoices]) voice.stop()
  }

  /**
   * Plays the current DRUM SYNTH patch straight through master, bypassing
   * channel/group routing exactly like `previewAsset` - this is an audition,
   * not a sequenced pad source. A fresh seed on every call is intentional:
   * DUST (and, for SNARE, RATTLE/SNAP too) is meant to vary hit to hit during
   * live preview - see kickVoice.ts/snareVoice.ts and DEC-025's determinism note.
   */
  previewDrumSound(patch: DrumPatch): void {
    if (this.status !== 'ready' || !this.context || !this.masterEffects) return
    const when = this.context.currentTime
    const voice: DrumVoiceHandle = patch.instrument === 'kick'
      ? playKickVoice(this.context, this.masterEffects.input, patch, when, createRandomSeed(), () => this.drumPreviewVoices.delete(voice))
      : playSnareVoice(this.context, this.masterEffects.input, patch, when, createRandomSeed(), () => this.drumPreviewVoices.delete(voice))
    this.drumPreviewVoices.add(voice)
  }

  scheduleSample(groupId: GroupId, channelId: ChannelId, assetId: SampleAssetId, when: number, options: TriggerSampleOptions = {}, origin: 'manual' | 'sequencer' = 'manual'): void {
    const sampleBuffer = this.resolvePlaybackBuffer(assetId, options.reversed)
    const channel = this.ensureChannel(groupId, channelId)

    if (this.status !== 'ready' || !this.context || !this.masterEffects || !sampleBuffer || !channel?.gain) {
      return
    }

    const source = this.context.createBufferSource()
    const gain = this.context.createGain()
    const scheduledWhen = Math.max(this.context.currentTime, when)
    const voice: ActiveVoice = { source, gain, cleanedUp: false, origin, isSample: true, startsAt: scheduledWhen, chokeGroupId: options.chokeGroupId }
    const playbackRate = this.toPlaybackRate(options.pitchSemitones)
    const region = this.toPlaybackRegion(sampleBuffer.duration, options.startSeconds, options.endSeconds, options.reversed)
    const voiceGain = this.toGain(options.gain)
    const naturalOutputDuration = region.durationSeconds / playbackRate
    const outputDuration = options.maxDurationSeconds !== undefined && options.maxDurationSeconds > 0 ? Math.min(naturalOutputDuration, options.maxDurationSeconds) : naturalOutputDuration
    source.buffer = sampleBuffer
    this.applyPadEnvelope(gain.gain, voiceGain, scheduledWhen, outputDuration, options.attackMs, options.releaseMs)
    source.playbackRate.setValueAtTime(playbackRate, scheduledWhen)
    source.connect(gain)
    gain.connect(channel.gain)
    source.addEventListener('ended', () => this.cleanUpVoice(voice), { once: true })

    this.activeVoices.add(voice)
    this.triggerPumpRoutesForChannel(channelId, scheduledWhen)
    source.start(scheduledWhen, region.startSeconds, outputDuration * playbackRate)
  }

  /**
   * TRACKS clip playback - one event per clip (unlike scheduleSample's
   * per-step calls), scheduled by TimelineScheduler. groupId/channelId are
   * both the owning AudioTrack's own id: a track is its own bus (see
   * ensureGroupBus/ensureChannel), not routed through a Pattern Group.
   *
   * Looping uses the AudioBufferSourceNode's native loop/loopStart/loopEnd
   * rather than re-triggering per repeat. Either way, an explicit stop() at
   * the timeline-slot boundary is the single source of truth for how long
   * the clip actually sounds - see ScheduleClipOptions.lengthSeconds.
   */
  scheduleClip(groupId: GroupId, channelId: ChannelId, assetId: SampleAssetId, when: number, options: ScheduleClipOptions): void {
    const sampleBuffer = this.resolvePlaybackBuffer(assetId, options.reversed)
    const channel = this.ensureChannel(groupId, channelId)

    if (this.status !== 'ready' || !this.context || !this.masterEffects || !sampleBuffer || !channel?.gain) {
      return
    }

    const source = this.context.createBufferSource()
    const gain = this.context.createGain()
    const scheduledWhen = Math.max(this.context.currentTime, when)
    const voice: ActiveVoice = { source, gain, cleanedUp: false, origin: 'timeline', isSample: true, startsAt: scheduledWhen }
    const playbackRate = this.toPlaybackRate(options.pitchSemitones) * (options.tempoRate && options.tempoRate > 0 ? options.tempoRate : 1)
    const region = this.toPlaybackRegion(sampleBuffer.duration, options.sourceOffsetSeconds, options.sourceEndSeconds, options.reversed)
    const voiceGain = this.toGain(options.gain)
    const outputDuration = Math.max(0.005, options.lengthSeconds)
    source.buffer = sampleBuffer
    source.playbackRate.setValueAtTime(playbackRate, scheduledWhen)
    if (options.loop) {
      source.loop = true
      source.loopStart = region.startSeconds
      source.loopEnd = region.startSeconds + region.durationSeconds
    }
    this.applyClipEnvelope(gain.gain, voiceGain, scheduledWhen, outputDuration, options.fadeInSeconds, options.fadeOutSeconds)
    source.connect(gain)
    gain.connect(channel.gain)
    source.addEventListener('ended', () => this.cleanUpVoice(voice), { once: true })

    this.activeVoices.add(voice)
    this.triggerPumpRoutesForChannel(channelId, scheduledWhen)
    source.start(scheduledWhen, region.startSeconds)
    // Always truncated at the timeline slot boundary: a pitched-down clip may
    // not finish its natural region, a pitched-up or non-looped short one
    // goes silent for the remainder rather than bleeding into the next clip.
    source.stop(scheduledWhen + outputDuration)
  }

  scheduleMetronome(when: number, accented: boolean): void {
    if (this.status !== 'ready' || !this.context || !this.masterGain) return

    const scheduledWhen = Math.max(this.context.currentTime, when)
    const oscillator = this.context.createOscillator()
    const gain = this.context.createGain()
    const durationSeconds = accented ? 0.045 : 0.03
    const peakGain = accented ? 0.16 : 0.1
    const voice: ActiveVoice = { source: oscillator, gain, cleanedUp: false, origin: 'sequencer', isSample: false, startsAt: scheduledWhen }
    oscillator.type = 'square'
    oscillator.frequency.setValueAtTime(accented ? 1760 : 1320, scheduledWhen)
    gain.gain.setValueAtTime(0, scheduledWhen)
    gain.gain.linearRampToValueAtTime(peakGain, scheduledWhen + 0.001)
    gain.gain.exponentialRampToValueAtTime(0.0001, scheduledWhen + durationSeconds)
    oscillator.connect(gain)
    gain.connect(this.masterGain)
    oscillator.addEventListener('ended', () => this.cleanUpVoice(voice), { once: true })
    this.activeVoices.add(voice)
    oscillator.start(scheduledWhen)
    oscillator.stop(scheduledWhen + durationSeconds)
  }

  stopAll(): void {
    for (const voice of [...this.activeVoices]) {
      try {
        voice.source.stop()
      } catch {
        // A source may already have ended before stopAll runs.
      }
      this.cleanUpVoice(voice)
    }
    for (const voice of [...this.activeSynthVoices]) this.stopSynthVoiceImmediately(voice)
    for (const voice of [...this.activeOrganicBassVoices]) this.stopOrganicBassVoiceImmediately(voice)
    for (const voice of [...this.activeStringsVoices]) this.stopStringsVoiceImmediately(voice)
    for (const voice of [...this.drumPreviewVoices]) voice.stop()
  }

  stopSequencerVoices(): void {
    for (const voice of [...this.activeVoices]) {
      if (voice.origin !== 'sequencer') continue
      try {
        voice.source.stop()
      } catch {
        // A scheduled source may have already ended before transport stop.
      }
      this.cleanUpVoice(voice)
    }
    for (const voice of [...this.activeSynthVoices]) if (voice.origin === 'sequencer') this.stopSynthVoiceImmediately(voice)
    for (const voice of [...this.activeOrganicBassVoices]) if (voice.origin === 'sequencer') this.stopOrganicBassVoiceImmediately(voice)
    for (const voice of [...this.activeStringsVoices]) if (voice.origin === 'sequencer') this.stopStringsVoiceImmediately(voice)
  }

  /** TRACKS' equivalent of stopSequencerVoices - kept separate (not folded
      into 'sequencer') so transport STOP can own both independently and so
      CHOP's choke-group logic below, which is sequencer-specific, never
      touches a clip voice. */
  stopTimelineVoices(): void {
    for (const voice of [...this.activeVoices]) {
      if (voice.origin !== 'timeline') continue
      try {
        voice.source.stop()
      } catch {
        // A scheduled clip may have already ended before transport stop.
      }
      this.cleanUpVoice(voice)
    }
  }

  stopSequencerChokeGroupAt(chokeGroupId: string, when: number): void {
    if (!this.context) return
    const stopAt = Math.max(this.context.currentTime, when)
    for (const voice of this.activeVoices) {
      // Voices scheduled for this exact timestamp are simultaneous events, not
      // predecessors. Only an earlier slice in the same CHOP session is cut.
      if (voice.origin !== 'sequencer' || !voice.isSample || voice.chokeGroupId !== chokeGroupId || voice.startsAt >= stopAt || (voice.stopAt !== undefined && voice.stopAt <= stopAt)) continue
      try {
        voice.source.stop(stopAt)
        voice.stopAt = stopAt
      } catch {
        // A sequenced slice may already have ended before the next one starts.
      }
    }
  }

  stopManualVoices(): void {
    for (const voice of [...this.activeVoices]) {
      if (voice.origin !== 'manual') continue
      try {
        voice.source.stop()
      } catch {
        // A manually triggered source may already have ended before it is cut.
      }
      this.cleanUpVoice(voice)
    }
    for (const runtime of this.synthRuntimes.values()) runtime.heldMonoNotes = []
    for (const runtime of this.organicBassRuntimes.values()) runtime.heldNotes = []
    for (const voice of [...this.activeSynthVoices]) if (voice.origin === 'manual') this.stopSynthVoiceImmediately(voice)
    for (const voice of [...this.activeOrganicBassVoices]) if (voice.origin === 'manual') this.stopOrganicBassVoiceImmediately(voice)
    for (const voice of [...this.activeStringsVoices]) if (voice.origin === 'manual') this.stopStringsVoiceImmediately(voice)
  }

  getActiveVoiceCount(): number {
    return this.activeVoices.size + this.activeSynthVoices.size + this.activeOrganicBassVoices.size + this.activeStringsVoices.size
  }

  getCurrentTime(): number {
    return this.context?.currentTime ?? 0
  }

  dispose(): void {
    this.stopAll()
    this.samples.clear()
    this.waveforms.clear()
    this.reversedSamples.clear()
    this.runtimeAssets.clear()
    for (const [key, runtime] of this.synthRuntimes) this.disposeSynthRuntime(key, runtime)
    this.synthPatches.clear()
    this.activeSynthVoices.clear()
    for (const [key, runtime] of this.organicBassRuntimes) this.disposeOrganicBassRuntime(key, runtime)
    this.organicBassPatches.clear()
    this.activeOrganicBassVoices.clear()
    this.organicBassSaturationCurve = undefined
    for (const [key, runtime] of this.stringsRuntimes) this.disposeStringsRuntime(key, runtime)
    this.stringsPatches.clear()
    this.activeStringsVoices.clear()
    try { this.stringsVibratoLfo?.stop() } catch { /* The LFO may already be stopped. */ }
    try { this.stringsEnsembleLfoA?.stop() } catch { /* The LFO may already be stopped. */ }
    try { this.stringsEnsembleLfoB?.stop() } catch { /* The LFO may already be stopped. */ }
    try { this.stringsMotionLfo?.stop() } catch { /* The LFO may already be stopped. */ }
    this.stringsVibratoLfo?.disconnect()
    this.stringsEnsembleLfoA?.disconnect()
    this.stringsEnsembleLfoB?.disconnect()
    this.stringsMotionLfo?.disconnect()
    this.stringsVibratoLfo = undefined
    this.stringsEnsembleLfoA = undefined
    this.stringsEnsembleLfoB = undefined
    this.stringsMotionLfo = undefined
    this.stringsNoiseBuffer = undefined
    for (const channel of this.channels.values()) {
      channel.gain?.disconnect()
      channel.meter?.disconnect()
      channel.gain = undefined
      channel.meter = undefined
      channel.meterSamples = undefined
    }
    for (const bus of this.groupBuses.values()) { bus.gain?.disconnect(); bus.pumpGain?.disconnect() }
    this.groupBuses.clear()
    for (const rack of this.groupEffects.values()) this.disposeRuntimeEffectRack(rack)
    this.groupEffects.clear()
    this.groupEffectStates.clear()
    this.disposeRuntimeEffectRack(this.masterEffects)
    this.masterGain?.disconnect()

    if (this.liveContext && this.liveContext.state !== 'closed') {
      void this.liveContext.close()
    }

    this.removeLifecycleRecovery()
    this.context = undefined
    this.liveContext = undefined
    this.masterEffects = undefined
    this.masterGain = undefined
    this.setStatus('inactive')
  }

  private syncContextStatus(): void {
    if (this.liveContext?.state === 'running') this.setStatus('ready')
    else if (this.liveContext?.state === 'suspended') this.setStatus('suspended')
    else if ((this.liveContext?.state as string | undefined) === 'interrupted') this.setStatus('interrupted')
    else if (this.liveContext?.state === 'closed') this.setStatus('inactive')
  }

  /**
   * Browsers may pause Web Audio when the page leaves the foreground. Resume
   * once when the page becomes visible, then retry from the next trusted input
   * because Safari can require a fresh gesture after an interruption.
   */
  private installLifecycleRecovery(): void {
    if (this.lifecycleRecoveryInstalled) return
    document.addEventListener('visibilitychange', this.handleVisibilityChange)
    document.addEventListener('pointerdown', this.handleResumeGesture, true)
    document.addEventListener('keydown', this.handleResumeGesture, true)
    this.lifecycleRecoveryInstalled = true
  }

  private removeLifecycleRecovery(): void {
    if (!this.lifecycleRecoveryInstalled) return
    document.removeEventListener('visibilitychange', this.handleVisibilityChange)
    document.removeEventListener('pointerdown', this.handleResumeGesture, true)
    document.removeEventListener('keydown', this.handleResumeGesture, true)
    this.lifecycleRecoveryInstalled = false
  }

  private requestLiveContextResume(): void {
    const context = this.liveContext
    if (!context || context.state === 'running' || context.state === 'closed') return
    void context.resume()
      .then(() => this.syncContextStatus())
      .catch(() => this.syncContextStatus())
  }

  private setStatus(status: AudioEngineStatus): void {
    if (this.status === status) return
    this.status = status
    for (const listener of this.statusListeners) listener(status)
  }

  private createMasterOutput(context: BaseAudioContext): void {
    if (this.masterEffects || this.masterGain) return
    this.masterEffects = this.createRuntimeEffectRack(this.masterEffectState)
    this.masterGain = context.createGain()
    this.masterEffects.output.connect(this.masterGain)
    this.masterGain.connect(context.destination)
    this.applyMasterGain(true)
  }

  private createChannelNodes(): void {
    const context = this.context!
    for (const channel of this.channels.values()) {
      if (channel.gain && channel.meter) continue
      channel.gain = context.createGain()
      channel.meter = context.createAnalyser()
      channel.meter.fftSize = 1024
      channel.meter.smoothingTimeConstant = 0
      channel.meterSamples = new Float32Array(channel.meter.fftSize)
      channel.gain.connect(channel.meter)
      channel.meter.connect(this.ensureGroupBus(channel.groupId).gain!)
    }
    this.applyAllChannelGains(true)
  }

  private synthPatchKey(groupId: GroupId, patchId: string): string {
    return `${groupId}:${patchId}`
  }

  private ensureAllSynthRuntimes(): void {
    for (const registration of this.synthPatches.values()) this.ensureSynthRuntime(registration.groupId, registration.patch)
  }

  private ensureSynthRuntime(groupId: GroupId, patch: SynthPatch): SynthPatchRuntime {
    const key = this.synthPatchKey(groupId, patch.id)
    this.synthPatches.set(key, { groupId, patch: cloneSynthPatch(patch) })
    let runtime = this.synthRuntimes.get(key)
    if (!runtime) {
      runtime = { groupId, patch: cloneSynthPatch(patch), voices: new Set(), heldMonoNotes: [] }
      this.synthRuntimes.set(key, runtime)
      if (this.context) this.createSynthLfo(runtime)
    } else this.updateSynthRuntime(runtime, patch)
    return runtime
  }

  private updateSynthRuntime(runtime: SynthPatchRuntime, patch: SynthPatch): void {
    const modeChanged = runtime.patch.mode !== patch.mode
    const waveformChanged = runtime.patch.lfo.waveform !== patch.lfo.waveform
    runtime.patch = cloneSynthPatch(patch)
    if (modeChanged && this.context) {
      runtime.heldMonoNotes = []
      for (const voice of [...runtime.voices]) this.releaseSynthVoice(runtime, voice, this.context.currentTime, 0.008)
    }
    if (waveformChanged && this.context) this.recreateSynthLfo(runtime)
    else this.applySynthLfo(runtime)
    for (const voice of runtime.voices) this.applyPatchToActiveSynthVoice(runtime, voice)
  }

  private createSynthLfo(runtime: SynthPatchRuntime): void {
    if (!this.context || runtime.lfo || runtime.lfoDepth) return
    const lfo = this.context.createOscillator()
    const depth = this.context.createGain()
    lfo.connect(depth)
    runtime.lfo = lfo
    runtime.lfoDepth = depth
    this.applySynthLfo(runtime, true)
    for (const voice of runtime.voices) {
      depth.connect(voice.filters[0].detune)
      depth.connect(voice.filters[1].detune)
    }
    lfo.start(this.context.currentTime)
  }

  private recreateSynthLfo(runtime: SynthPatchRuntime): void {
    if (!this.context) return
    try { runtime.lfo?.stop(this.context.currentTime) } catch { /* The LFO may already be stopped. */ }
    runtime.lfo?.disconnect()
    runtime.lfoDepth?.disconnect()
    runtime.lfo = undefined
    runtime.lfoDepth = undefined
    this.createSynthLfo(runtime)
  }

  private applySynthLfo(runtime: SynthPatchRuntime, immediately = false): void {
    if (!this.context || !runtime.lfo || !runtime.lfoDepth) return
    runtime.lfo.type = runtime.patch.lfo.waveform
    this.applyEffectParameter(runtime.lfo.frequency, lfoFrequencyHz(runtime.patch.lfo.division, this.bpm), immediately, 0.02)
    this.applyEffectParameter(runtime.lfoDepth.gain, runtime.patch.lfo.depthSemitones * 100, immediately, 0.02)
  }

  private startMonoSynthVoice(runtime: SynthPatchRuntime, groupId: GroupId, channelId: ChannelId, midiNote: number, velocity: number, when: number, origin: 'manual' | 'sequencer', manualToken?: string): ActiveSynthVoice | undefined {
    const previousMidiNote = runtime.lastMidiNote
    if (runtime.currentMonoVoice && !runtime.currentMonoVoice.cleanedUp) this.releaseSynthVoice(runtime, runtime.currentMonoVoice, when, 0.008)
    const voice = this.startSynthVoice(runtime, groupId, channelId, midiNote, velocity, when, origin, manualToken, previousMidiNote)
    runtime.currentMonoVoice = voice
    runtime.lastMidiNote = midiNote
    return voice
  }

  private startSynthVoice(runtime: SynthPatchRuntime, groupId: GroupId, channelId: ChannelId, midiNote: number, velocity: number, when: number, origin: 'manual' | 'sequencer', manualToken?: string, glideFromMidiNote?: number): ActiveSynthVoice | undefined {
    if (!this.context || !this.masterEffects) return
    const channel = this.ensureChannel(groupId, channelId)
    if (!channel.gain) return
    const scheduledWhen = Math.max(this.context.currentTime, when)
    if (runtime.patch.mode === 'poly5') this.stealOldestSynthVoice(runtime, scheduledWhen)

    const oscillators = [this.context.createOscillator(), this.context.createOscillator(), this.context.createOscillator()] as [OscillatorNode, OscillatorNode, OscillatorNode]
    const oscillatorGains = [this.context.createGain(), this.context.createGain(), this.context.createGain()] as [GainNode, GainNode, GainNode]
    const filters = [this.context.createBiquadFilter(), this.context.createBiquadFilter()] as [BiquadFilterNode, BiquadFilterNode]
    const drive = this.context.createWaveShaper()
    const amp = this.context.createGain()
    const voice: ActiveSynthVoice = {
      oscillators,
      oscillatorGains,
      filters,
      drive,
      amp,
      origin,
      groupId,
      patchKey: this.synthPatchKey(groupId, runtime.patch.id),
      channelId,
      midiNote,
      startsAt: scheduledWhen,
      serial: this.synthVoiceSerial++,
      manualToken,
      cleanedUp: false,
    }

    for (let index = 0; index < oscillators.length; index += 1) {
      oscillators[index].connect(oscillatorGains[index])
      oscillatorGains[index].connect(filters[0])
    }
    filters[0].connect(filters[1])
    filters[1].connect(drive)
    drive.connect(amp)
    amp.connect(channel.gain)
    runtime.lfoDepth?.connect(filters[0].detune)
    runtime.lfoDepth?.connect(filters[1].detune)

    this.applyPatchToActiveSynthVoice(runtime, voice, true, glideFromMidiNote)
    const attack = Math.max(0.001, runtime.patch.ampEnvelope.attackSeconds)
    const decay = Math.max(0.001, runtime.patch.ampEnvelope.decaySeconds)
    const peak = this.toGain(velocity) * (runtime.patch.mode === 'poly5' ? 0.18 : 0.45)
    const sustain = Math.max(0.0001, peak * runtime.patch.ampEnvelope.sustain)
    amp.gain.setValueAtTime(0.0001, scheduledWhen)
    amp.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), scheduledWhen + attack)
    amp.gain.exponentialRampToValueAtTime(sustain, scheduledWhen + attack + decay)
    this.applySynthFilterEnvelope(runtime.patch, filters, scheduledWhen)

    oscillators[0].addEventListener('ended', () => this.cleanUpSynthVoice(runtime, voice), { once: true })
    runtime.voices.add(voice)
    this.activeSynthVoices.add(voice)
    for (const oscillator of oscillators) oscillator.start(scheduledWhen)
    return voice
  }

  private applyPatchToActiveSynthVoice(runtime: SynthPatchRuntime, voice: ActiveSynthVoice, immediately = false, glideFromMidiNote?: number): void {
    if (!this.context) return
    const patch = runtime.patch
    const now = Math.max(this.context.currentTime, voice.startsAt)
    const oscillators = [patch.oscillator1, patch.oscillator2, patch.sub] as const
    const totalLevel = Math.max(1, oscillators.reduce((sum, oscillator) => sum + oscillator.level, 0))
    for (let index = 0; index < voice.oscillators.length; index += 1) {
      const oscillator = voice.oscillators[index]
      const config = oscillators[index]
      oscillator.type = config.waveform
      this.applySynthPitch(oscillator.frequency, voice.midiNote, config.octave, 'detuneCents' in config ? config.detuneCents : 0, now, immediately ? 0 : patch.glideSeconds, glideFromMidiNote)
      this.applyEffectParameter(voice.oscillatorGains[index].gain, config.level / totalLevel, immediately, 0.01)
    }
    for (const filter of voice.filters) {
      filter.type = 'lowpass'
      this.applyEffectParameter(filter.frequency, patch.filter.cutoffHz, immediately, 0.015)
      this.applyEffectParameter(filter.Q, patch.filter.resonance / 2, immediately, 0.015)
    }
    voice.drive.curve = this.createDriveCurve(patch.drive)
    voice.drive.oversample = '2x'
  }

  private applySynthPitch(parameter: AudioParam, midiNote: number, octave: number, detuneCents: number, when: number, glideSeconds: number, glideFromMidiNote?: number): void {
    const target = this.midiNoteToFrequency(midiNote + octave * 12 + detuneCents / 100)
    const startMidi = glideFromMidiNote === undefined ? midiNote : glideFromMidiNote
    const start = this.midiNoteToFrequency(startMidi + octave * 12 + detuneCents / 100)
    parameter.cancelScheduledValues(when)
    parameter.setValueAtTime(start, when)
    if (glideSeconds > 0 && start !== target) parameter.exponentialRampToValueAtTime(target, when + glideSeconds)
    else parameter.setValueAtTime(target, when)
  }

  private applySynthFilterEnvelope(patch: SynthPatch, filters: readonly [BiquadFilterNode, BiquadFilterNode], when: number): void {
    const attack = Math.max(0.001, patch.filter.envelopeAttackSeconds)
    const decay = Math.max(0.001, patch.filter.envelopeDecaySeconds)
    for (const filter of filters) {
      const detune = filter.detune
      detune.setValueAtTime(0, when)
      detune.linearRampToValueAtTime(patch.filter.envelopeAmountSemitones * 100, when + attack)
      detune.linearRampToValueAtTime(0, when + attack + decay)
    }
  }

  private stealOldestSynthVoice(runtime: SynthPatchRuntime, when: number): void {
    const sounding = [...runtime.voices].filter((voice) => !voice.cleanedUp && !voice.stolen && (voice.stopAt === undefined || voice.stopAt > when))
    if (sounding.length < maximumSynthVoices) return
    const oldest = sounding.sort((left, right) => left.startsAt - right.startsAt || left.serial - right.serial)[0]
    if (oldest) {
      oldest.stolen = true
      this.releaseSynthVoice(runtime, oldest, when, 0.008)
    }
  }

  private releaseSynthVoice(runtime: SynthPatchRuntime, voice: ActiveSynthVoice, when: number, releaseOverride?: number): void {
    if (!this.context || voice.cleanedUp) return
    const releaseAt = Math.max(this.context.currentTime, when)
    if (voice.stopAt !== undefined && voice.stopAt <= releaseAt) return
    const release = Math.max(0.005, releaseOverride ?? runtime.patch.ampEnvelope.releaseSeconds)
    this.holdAudioParamAtTime(voice.amp.gain, releaseAt)
    voice.amp.gain.exponentialRampToValueAtTime(0.0001, releaseAt + release)
    const stopAt = releaseAt + release + 0.01
    for (const oscillator of voice.oscillators) {
      try { oscillator.stop(stopAt) } catch { /* A stolen voice may already be stopping. */ }
    }
    voice.stopAt = stopAt
  }

  private holdAudioParamAtTime(parameter: AudioParam, when: number): void {
    if (typeof parameter.cancelAndHoldAtTime === 'function') parameter.cancelAndHoldAtTime(when)
    else {
      parameter.cancelScheduledValues(when)
      parameter.setValueAtTime(Math.max(0.0001, parameter.value), when)
    }
  }

  private stopSynthVoiceImmediately(voice: ActiveSynthVoice): void {
    for (const oscillator of voice.oscillators) {
      try { oscillator.stop() } catch { /* The oscillator may already have ended. */ }
    }
    const runtime = this.synthRuntimes.get(voice.patchKey)
    if (runtime) this.cleanUpSynthVoice(runtime, voice)
  }

  private cleanUpSynthVoice(runtime: SynthPatchRuntime, voice: ActiveSynthVoice): void {
    if (voice.cleanedUp) return
    voice.cleanedUp = true
    runtime.voices.delete(voice)
    this.activeSynthVoices.delete(voice)
    if (runtime.currentMonoVoice === voice) runtime.currentMonoVoice = undefined
    for (const oscillator of voice.oscillators) oscillator.disconnect()
    for (const gain of voice.oscillatorGains) gain.disconnect()
    for (const filter of voice.filters) {
      try { runtime.lfoDepth?.disconnect(filter.detune) } catch { /* The LFO connection may already be gone. */ }
      filter.disconnect()
    }
    voice.drive.disconnect()
    voice.amp.disconnect()
  }

  private disposeSynthRuntime(key: string, runtime: SynthPatchRuntime): void {
    for (const voice of [...runtime.voices]) this.stopSynthVoiceImmediately(voice)
    try { runtime.lfo?.stop() } catch { /* The LFO may already have ended. */ }
    runtime.lfo?.disconnect()
    runtime.lfoDepth?.disconnect()
    this.synthRuntimes.delete(key)
  }

  private organicBassPatchKey(groupId: GroupId, patchId: string): string {
    return `${groupId}:${patchId}`
  }

  private ensureAllOrganicBassRuntimes(): void {
    for (const registration of this.organicBassPatches.values()) this.ensureOrganicBassRuntime(registration.groupId, registration.patch)
  }

  private ensureOrganicBassRuntime(groupId: GroupId, patch: OrganicBassPatch): OrganicBassPatchRuntime {
    const key = this.organicBassPatchKey(groupId, patch.id)
    this.organicBassPatches.set(key, { groupId, patch: cloneOrganicBassPatch(patch) })
    let runtime = this.organicBassRuntimes.get(key)
    if (!runtime) {
      runtime = { groupId, patch: cloneOrganicBassPatch(patch), voices: new Set(), heldNotes: [] }
      this.organicBassRuntimes.set(key, runtime)
      this.createOrganicBassDrift(runtime)
    } else this.updateOrganicBassRuntime(runtime, patch)
    return runtime
  }

  private updateOrganicBassRuntime(runtime: OrganicBassPatchRuntime, patch: OrganicBassPatch): void {
    runtime.patch = cloneOrganicBassPatch(patch)
    for (const voice of runtime.voices) this.applyPatchToOrganicBassVoice(runtime, voice)
  }

  /** Two fixed, incommensurate rates make render output repeatable while avoiding a periodic unison wobble. */
  private createOrganicBassDrift(runtime: OrganicBassPatchRuntime): void {
    if (!this.context || runtime.driftLfoA || runtime.driftLfoB) return
    const now = this.context.currentTime
    const lfoA = this.context.createOscillator()
    const lfoB = this.context.createOscillator()
    const depthA = this.context.createGain()
    const depthB = this.context.createGain()
    lfoA.type = 'sine'
    lfoB.type = 'sine'
    lfoA.frequency.setValueAtTime(0.071, now)
    lfoB.frequency.setValueAtTime(0.113, now)
    depthA.gain.setValueAtTime(1.1, now)
    depthB.gain.setValueAtTime(-0.85, now)
    lfoA.connect(depthA)
    lfoB.connect(depthB)
    lfoA.start(now)
    lfoB.start(now)
    runtime.driftLfoA = lfoA
    runtime.driftLfoB = lfoB
    runtime.driftDepthA = depthA
    runtime.driftDepthB = depthB
  }

  private startOrganicBassVoice(runtime: OrganicBassPatchRuntime, groupId: GroupId, channelId: ChannelId, midiNote: number, velocity: number, when: number, origin: 'manual' | 'sequencer'): ActiveOrganicBassVoice | undefined {
    if (!this.context) return
    const scheduledWhen = Math.max(this.context.currentTime, when)
    const oscillators = [this.context.createOscillator(), this.context.createOscillator(), this.context.createOscillator()] as [OscillatorNode, OscillatorNode, OscillatorNode]
    const oscillatorGains = [this.context.createGain(), this.context.createGain(), this.context.createGain()] as [GainNode, GainNode, GainNode]
    const preDrive = this.context.createGain()
    const saturation = this.context.createWaveShaper()
    const filters = [this.context.createBiquadFilter(), this.context.createBiquadFilter()] as [BiquadFilterNode, BiquadFilterNode]
    const outputTrim = this.context.createGain()
    const amp = this.context.createGain()
    const voice: ActiveOrganicBassVoice = {
      oscillators,
      oscillatorGains,
      preDrive,
      saturation,
      filters,
      outputTrim,
      amp,
      routes: new Map(),
      origin,
      groupId,
      patchKey: this.organicBassPatchKey(groupId, runtime.patch.id),
      channelId,
      midiNote,
      velocity: this.toGain(velocity),
      startsAt: scheduledWhen,
      serial: this.organicBassVoiceSerial++,
      cleanedUp: false,
    }

    for (let index = 0; index < oscillators.length; index += 1) {
      oscillators[index].connect(oscillatorGains[index])
      oscillatorGains[index].connect(preDrive)
    }
    preDrive.connect(saturation)
    saturation.connect(filters[0])
    filters[0].connect(filters[1])
    filters[1].connect(outputTrim)
    outputTrim.connect(amp)
    this.connectOrganicBassRoute(voice, channelId, true)
    runtime.driftDepthA?.connect(oscillators[0].detune)
    runtime.driftDepthB?.connect(oscillators[1].detune)
    runtime.driftDepthA?.connect(oscillators[2].detune)

    this.applyPatchToOrganicBassVoice(runtime, voice, true)
    const envelope = organicBassEnvelopeShape(runtime.patch.decay)
    const peak = Math.max(0.0001, organicBassVelocityResponse(voice.velocity).amplitude * 0.44)
    const sustain = Math.max(0.0001, peak * envelope.sustain)
    const attack = Math.max(0.001, runtime.patch.attackSeconds)
    amp.gain.setValueAtTime(0.0001, scheduledWhen)
    amp.gain.exponentialRampToValueAtTime(peak, scheduledWhen + attack)
    amp.gain.exponentialRampToValueAtTime(sustain, scheduledWhen + attack + envelope.decaySeconds)
    this.applyOrganicBassFilterEnvelope(runtime.patch, filters, scheduledWhen)

    oscillators[0].addEventListener('ended', () => this.cleanUpOrganicBassVoice(runtime, voice), { once: true })
    runtime.voices.add(voice)
    this.activeOrganicBassVoices.add(voice)
    for (const oscillator of oscillators) oscillator.start(scheduledWhen)
    return voice
  }

  private applyPatchToOrganicBassVoice(runtime: OrganicBassPatchRuntime, voice: ActiveOrganicBassVoice, immediately = false, glideFromMidiNote?: number): void {
    if (!this.context) return
    const patch = runtime.patch
    const now = Math.max(this.context.currentTime, voice.startsAt)
    const harmonicLimit = Math.max(2, Math.min(24, Math.floor(this.context.sampleRate / 2 / this.midiNoteToFrequency(voice.midiNote))))
    const mainWave = organicBassWaveCoefficients(patch.shape, harmonicLimit)
    const bodyWave = organicBassWaveCoefficients(patch.shape * 0.72, harmonicLimit)
    voice.oscillators[0].setPeriodicWave(this.context.createPeriodicWave(mainWave.real, mainWave.imag, { disableNormalization: false }))
    voice.oscillators[1].setPeriodicWave(this.context.createPeriodicWave(bodyWave.real, bodyWave.imag, { disableNormalization: false }))
    voice.oscillators[2].type = 'sine'
    const glideSeconds = glideFromMidiNote === undefined ? 0 : organicBassGlideSeconds(patch.glide)
    this.applyOrganicBassPitch(voice.oscillators[0].frequency, voice.midiNote, 0, now, glideSeconds, glideFromMidiNote)
    this.applyOrganicBassPitch(voice.oscillators[1].frequency, voice.midiNote, -4, now, glideSeconds, glideFromMidiNote)
    this.applyOrganicBassPitch(voice.oscillators[2].frequency, voice.midiNote - 12, 0, now, glideSeconds, glideFromMidiNote === undefined ? undefined : glideFromMidiNote - 12)

    const weight = organicBassWeightMacro(patch.weight)
    const velocity = organicBassVelocityResponse(voice.velocity)
    this.applyEffectParameter(voice.oscillatorGains[0].gain, weight.mainGain, immediately, 0.015)
    this.applyEffectParameter(voice.oscillatorGains[1].gain, weight.bodyGain, immediately, 0.015)
    this.applyEffectParameter(voice.oscillatorGains[2].gain, weight.subGain, immediately, 0.015)
    this.applyEffectParameter(voice.preDrive.gain, weight.inputDrive * (1 + patch.drive * 2.2) * velocity.inputDrive, immediately, 0.02)
    this.organicBassSaturationCurve ??= this.createOrganicBassSaturationCurve()
    voice.saturation.curve = this.organicBassSaturationCurve
    voice.saturation.oversample = '2x'

    const cutoff = organicBassCutoffHz(patch.cutoff) * 2 ** (velocity.cutoffSemitones / 12)
    for (const filter of voice.filters) {
      filter.type = 'lowpass'
      this.applyEffectParameter(filter.frequency, cutoff, immediately, 0.018)
    }
    this.applyEffectParameter(voice.filters[0].Q, organicBassResonanceQ(patch.resonance), immediately, 0.018)
    this.applyEffectParameter(voice.filters[1].Q, 0.55, immediately, 0.018)
    this.applyEffectParameter(voice.outputTrim.gain, weight.outputTrim * (1 - patch.resonance * 0.12) / (1 + patch.drive * 0.18), immediately, 0.02)
  }

  private applyOrganicBassPitch(parameter: AudioParam, midiNote: number, detuneCents: number, when: number, glideSeconds: number, glideFromMidiNote?: number): void {
    const target = this.midiNoteToFrequency(midiNote + detuneCents / 100)
    const start = this.midiNoteToFrequency((glideFromMidiNote ?? midiNote) + detuneCents / 100)
    parameter.cancelScheduledValues(when)
    parameter.setValueAtTime(start, when)
    if (glideSeconds > 0 && start !== target) parameter.exponentialRampToValueAtTime(target, when + glideSeconds)
    else parameter.setValueAtTime(target, when)
  }

  private applyOrganicBassFilterEnvelope(patch: OrganicBassPatch, filters: readonly [BiquadFilterNode, BiquadFilterNode], when: number): void {
    const attack = Math.max(0.001, patch.attackSeconds)
    const decay = organicBassEnvelopeShape(patch.decay).decaySeconds
    const peakCents = organicBassContourSemitones(patch.contour) * 100
    for (const filter of filters) {
      filter.detune.setValueAtTime(0, when)
      filter.detune.linearRampToValueAtTime(peakCents, when + attack)
      filter.detune.exponentialRampToValueAtTime(0.01, when + attack + decay)
      filter.detune.setValueAtTime(0, when + attack + decay + 0.001)
    }
  }

  private glideOrganicBassVoice(runtime: OrganicBassPatchRuntime, voice: ActiveOrganicBassVoice, channelId: ChannelId, midiNote: number, velocity: number, when: number): void {
    const previousMidiNote = voice.midiNote
    voice.channelId = channelId
    voice.midiNote = midiNote
    voice.velocity = this.toGain(velocity)
    this.crossfadeOrganicBassRoute(voice, channelId, when)
    this.applyPatchToOrganicBassVoice(runtime, voice, false, previousMidiNote)
  }

  private connectOrganicBassRoute(voice: ActiveOrganicBassVoice, channelId: ChannelId, active: boolean): GainNode | undefined {
    if (!this.context) return
    const existing = voice.routes.get(channelId)
    if (existing) return existing
    const channel = this.ensureChannel(voice.groupId, channelId)
    if (!channel.gain) return
    const route = this.context.createGain()
    route.gain.setValueAtTime(active ? 1 : 0, this.context.currentTime)
    voice.amp.connect(route)
    route.connect(channel.gain)
    voice.routes.set(channelId, route)
    return route
  }

  private crossfadeOrganicBassRoute(voice: ActiveOrganicBassVoice, channelId: ChannelId, when: number): void {
    const target = this.connectOrganicBassRoute(voice, channelId, false)
    if (!target) return
    for (const [id, route] of voice.routes) {
      route.gain.cancelScheduledValues(when)
      route.gain.setValueAtTime(route.gain.value, when)
      route.gain.linearRampToValueAtTime(id === channelId ? 1 : 0, when + 0.006)
    }
  }

  private releaseOrganicBassVoice(runtime: OrganicBassPatchRuntime, voice: ActiveOrganicBassVoice, when: number, releaseOverride?: number): void {
    if (!this.context || voice.cleanedUp) return
    const releaseAt = Math.max(this.context.currentTime, when)
    if (voice.stopAt !== undefined && voice.stopAt <= releaseAt) return
    const release = Math.max(0.005, releaseOverride ?? organicBassEnvelopeShape(runtime.patch.decay).releaseSeconds)
    this.holdAudioParamAtTime(voice.amp.gain, releaseAt)
    voice.amp.gain.exponentialRampToValueAtTime(0.0001, releaseAt + release)
    const stopAt = releaseAt + release + 0.01
    for (const oscillator of voice.oscillators) {
      try { oscillator.stop(stopAt) } catch { /* A scheduled voice may already be stopping. */ }
    }
    voice.stopAt = stopAt
  }

  private stopOrganicBassVoiceImmediately(voice: ActiveOrganicBassVoice): void {
    for (const oscillator of voice.oscillators) {
      try { oscillator.stop() } catch { /* The oscillator may already have ended. */ }
    }
    const runtime = this.organicBassRuntimes.get(voice.patchKey)
    if (runtime) this.cleanUpOrganicBassVoice(runtime, voice)
  }

  private cleanUpOrganicBassVoice(runtime: OrganicBassPatchRuntime, voice: ActiveOrganicBassVoice): void {
    if (voice.cleanedUp) return
    voice.cleanedUp = true
    runtime.voices.delete(voice)
    this.activeOrganicBassVoices.delete(voice)
    if (runtime.currentVoice === voice) runtime.currentVoice = undefined
    try { runtime.driftDepthA?.disconnect(voice.oscillators[0].detune) } catch { /* Already disconnected. */ }
    try { runtime.driftDepthB?.disconnect(voice.oscillators[1].detune) } catch { /* Already disconnected. */ }
    try { runtime.driftDepthA?.disconnect(voice.oscillators[2].detune) } catch { /* Already disconnected. */ }
    for (const oscillator of voice.oscillators) oscillator.disconnect()
    for (const gain of voice.oscillatorGains) gain.disconnect()
    voice.preDrive.disconnect()
    voice.saturation.disconnect()
    for (const filter of voice.filters) filter.disconnect()
    voice.outputTrim.disconnect()
    voice.amp.disconnect()
    for (const route of voice.routes.values()) route.disconnect()
    voice.routes.clear()
  }

  private disposeOrganicBassRuntime(key: string, runtime: OrganicBassPatchRuntime): void {
    for (const voice of [...runtime.voices]) this.stopOrganicBassVoiceImmediately(voice)
    try { runtime.driftLfoA?.stop() } catch { /* Already stopped. */ }
    try { runtime.driftLfoB?.stop() } catch { /* Already stopped. */ }
    runtime.driftLfoA?.disconnect()
    runtime.driftLfoB?.disconnect()
    runtime.driftDepthA?.disconnect()
    runtime.driftDepthB?.disconnect()
    this.organicBassRuntimes.delete(key)
  }

  private stringsPatchKey(groupId: GroupId, patchId: string): string {
    return `${groupId}:${patchId}`
  }

  private ensureAllStringsRuntimes(): void {
    for (const registration of this.stringsPatches.values()) this.ensureStringsRuntime(registration.groupId, registration.patch)
  }

  private ensureStringsRuntime(groupId: GroupId, patch: StringsPatch): StringsPatchRuntime {
    const key = this.stringsPatchKey(groupId, patch.id)
    this.stringsPatches.set(key, { groupId, patch: cloneStringsPatch(patch) })
    let runtime = this.stringsRuntimes.get(key)
    if (!runtime) {
      runtime = { groupId, patch: cloneStringsPatch(patch), voices: new Set(), ensembles: new Map() }
      this.stringsRuntimes.set(key, runtime)
      if (this.context) {
        this.createStringsVibratoDepth(runtime)
        this.createStringsMotionFilterDepth(runtime)
      }
    } else this.updateStringsRuntime(runtime, patch)
    return runtime
  }

  private updateStringsRuntime(runtime: StringsPatchRuntime, patch: StringsPatch): void {
    runtime.patch = cloneStringsPatch(patch)
    if (runtime.vibratoDepth) this.applyStringsVibratoDepth(runtime, runtime.vibratoDepth, false)
    if (runtime.motionFilterDepth) this.applyStringsMotionFilterDepth(runtime, runtime.motionFilterDepth, false)
    for (const ensemble of runtime.ensembles.values()) this.applyStringsEnsemble(runtime, ensemble, false)
    for (const voice of runtime.voices) {
      this.applyPatchToActiveStringsVoice(runtime, voice)
      // Deliberately kept out of applyPatchToActiveStringsVoice, which also
      // runs at construction time with immediately=true - that would cancel
      // BOW's note-on fade-in ramp (see startStringsVoice) and snap it to a
      // flat value instead. A live update is always a smooth ramp here.
      this.applyEffectParameter(voice.bow.gain.gain, stringsBowToGain(patch.bow), false, 0.05)
    }
  }

  /** Lazily created once, ever - shared by every STRINGS patch in the app. */
  private ensureStringsGlobalLfos(): void {
    if (!this.context || this.stringsVibratoLfo) return
    const now = this.context.currentTime
    const vibrato = this.context.createOscillator()
    vibrato.type = 'sine'
    vibrato.frequency.setValueAtTime(5.3, now)
    vibrato.start(now)
    this.stringsVibratoLfo = vibrato

    // Deliberately free-running (not tempo-synced) and at non-integer-ratio
    // rates, so the two delay lines never fall into a regular, audible pulse.
    const ensembleA = this.context.createOscillator()
    ensembleA.type = 'sine'
    ensembleA.frequency.setValueAtTime(0.13, now)
    ensembleA.start(now)
    this.stringsEnsembleLfoA = ensembleA

    const ensembleB = this.context.createOscillator()
    ensembleB.type = 'sine'
    ensembleB.frequency.setValueAtTime(0.19, now)
    ensembleB.start(now)
    this.stringsEnsembleLfoB = ensembleB

    // Fourth free-running rate, incommensurate with the three above, so MOTION
    // never lines up into a regular pulse with vibrato or the ensemble.
    const motion = this.context.createOscillator()
    motion.type = 'sine'
    motion.frequency.setValueAtTime(0.071, now)
    motion.start(now)
    this.stringsMotionLfo = motion
  }

  /** Generated once, ever, and reused by every BOW voice in the app - a couple of seconds of white noise is plenty since each voice reads it back looped through its own cheap AudioBufferSourceNode. */
  private ensureStringsNoiseBuffer(): AudioBuffer | undefined {
    if (!this.context) return undefined
    if (!this.stringsNoiseBuffer) {
      const durationSeconds = 2
      const buffer = this.context.createBuffer(1, Math.round(this.context.sampleRate * durationSeconds), this.context.sampleRate)
      const data = buffer.getChannelData(0)
      for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1
      this.stringsNoiseBuffer = buffer
    }
    return this.stringsNoiseBuffer
  }

  /** A single gentle tanh curve, generated once and shared by every channel's WaveShaper - see the field doc for why it is never regenerated. */
  private ensureStringsWarmthCurve(): Float32Array<ArrayBuffer> {
    if (!this.stringsWarmthCurve) {
      const length = 1024
      const curve = new Float32Array(length)
      const drive = 2.5
      const normalizer = Math.tanh(drive)
      for (let index = 0; index < length; index += 1) {
        const x = (index / (length - 1)) * 2 - 1
        curve[index] = Math.tanh(drive * x) / normalizer
      }
      this.stringsWarmthCurve = curve
    }
    return this.stringsWarmthCurve
  }

  private createStringsVibratoDepth(runtime: StringsPatchRuntime): void {
    if (!this.context || runtime.vibratoDepth) return
    this.ensureStringsGlobalLfos()
    if (!this.stringsVibratoLfo) return
    const depth = this.context.createGain()
    this.stringsVibratoLfo.connect(depth)
    runtime.vibratoDepth = depth
    this.applyStringsVibratoDepth(runtime, depth, true)
  }

  private applyStringsVibratoDepth(runtime: StringsPatchRuntime, depth: GainNode, immediately: boolean): void {
    // Cents of peak deviation at VIBRATO = 1. Musical, not a siren: real vibrato
    // typically swings well under this even at its most pronounced.
    const bias = stringsCharacterBias(runtime.patch.character)
    this.applyEffectParameter(depth.gain, runtime.patch.vibrato * bias.vibratoScale * 16, immediately, 0.02)
  }

  /** Lazily created alongside vibratoDepth - one shared gain per runtime, fanned into every active voice's filter.frequency. */
  private createStringsMotionFilterDepth(runtime: StringsPatchRuntime): void {
    if (!this.context || runtime.motionFilterDepth) return
    this.ensureStringsGlobalLfos()
    if (!this.stringsMotionLfo) return
    const depth = this.context.createGain()
    this.stringsMotionLfo.connect(depth)
    runtime.motionFilterDepth = depth
    this.applyStringsMotionFilterDepth(runtime, depth, true)
  }

  private applyStringsMotionFilterDepth(runtime: StringsPatchRuntime, depth: GainNode, immediately: boolean): void {
    const cutoffHz = this.stringsEffectiveCutoffHz(runtime.patch)
    this.applyEffectParameter(depth.gain, stringsMotionFilterDepthHz(runtime.patch.motion, cutoffHz), immediately, 0.02)
  }

  /** BRIGHTNESS plus CHARACTER's bias plus BODY's reinforcing shift, in one place so MOTION's wobble (which needs the same live cutoff) can never drift from what the filter itself is actually set to. Uses the same character-biased BODY value as the oscillator balance, so both mechanisms always move together. */
  private stringsEffectiveCutoffHz(patch: StringsPatch): number {
    const bias = stringsCharacterBias(patch.character)
    const effectiveBody = this.clamp01(patch.body + bias.bodyBias)
    return stringsBrightnessToHz(this.clamp01(patch.brightness + bias.brightnessBias + stringsBodyToBrightnessBias(effectiveBody)))
  }

  /** Built once per (patch, channel) and never torn down until the runtime disposes - a chord's worth of voices reuses the same ensemble, matching how `ensureChannel` itself is never rebuilt mid-session. */
  private ensureStringsEnsemble(runtime: StringsPatchRuntime, channelId: ChannelId): RuntimeStringsEnsemble | undefined {
    const existing = runtime.ensembles.get(channelId)
    if (existing) return existing
    if (!this.context) return undefined
    const channel = this.ensureChannel(runtime.groupId, channelId)
    if (!channel.gain) return undefined
    this.ensureStringsGlobalLfos()
    const now = this.context.currentTime
    const input = this.context.createGain()
    const dryGain = this.context.createGain()
    const delayA = this.context.createDelay(0.05)
    const delayB = this.context.createDelay(0.05)
    const pannerA = this.context.createStereoPanner()
    const pannerB = this.context.createStereoPanner()
    const wetGainA = this.context.createGain()
    const wetGainB = this.context.createGain()
    const delayModDepthA = this.context.createGain()
    const delayModDepthB = this.context.createGain()
    const motionPanDepthA = this.context.createGain()
    const motionPanDepthB = this.context.createGain()
    const output = this.context.createGain()
    const warmthShaper = this.context.createWaveShaper()
    const warmthDry = this.context.createGain()
    const warmthWet = this.context.createGain()
    const spaceDelay = this.context.createDelay(0.1)
    const spaceDamping = this.context.createBiquadFilter()
    const spaceFeedback = this.context.createGain()
    const spaceWet = this.context.createGain()

    delayA.delayTime.setValueAtTime(0.01, now)
    delayB.delayTime.setValueAtTime(0.013, now)
    // Static WIDTH pan and MOTION's drift depth are both applied immediately
    // below by applyStringsEnsemble, before any voice can reach this ensemble.
    warmthShaper.curve = this.ensureStringsWarmthCurve()
    // Fixed, short and gently damped - a sense of distance, not a discrete echo
    // or a flanger. Only the feedback and wet amounts below move with SPACE.
    spaceDelay.delayTime.setValueAtTime(0.047, now)
    spaceDamping.type = 'lowpass'
    spaceDamping.frequency.setValueAtTime(2600, now)
    spaceDamping.Q.setValueAtTime(0.5, now)

    input.connect(dryGain)
    dryGain.connect(output)
    input.connect(delayA)
    delayA.connect(pannerA)
    pannerA.connect(wetGainA)
    wetGainA.connect(output)
    input.connect(delayB)
    delayB.connect(pannerB)
    pannerB.connect(wetGainB)
    wetGainB.connect(output)
    this.stringsEnsembleLfoA?.connect(delayModDepthA)
    delayModDepthA.connect(delayA.delayTime)
    this.stringsEnsembleLfoB?.connect(delayModDepthB)
    delayModDepthB.connect(delayB.delayTime)
    // MOTION's pan drift: one shared LFO into both panners with opposite sign,
    // so the image breathes in width around a fixed center - never autopan.
    this.stringsMotionLfo?.connect(motionPanDepthA)
    motionPanDepthA.connect(pannerA.pan)
    this.stringsMotionLfo?.connect(motionPanDepthB)
    motionPanDepthB.connect(pannerB.pan)
    // WARMTH: the shaped and dry paths run in parallel from `output`, each
    // fanning out to both the plain channel path and SPACE's send below -
    // this is the crossfade, not a swap, so it never clicks as it moves.
    output.connect(warmthShaper)
    warmthShaper.connect(warmthWet)
    output.connect(warmthDry)
    warmthDry.connect(channel.gain)
    warmthDry.connect(spaceDelay)
    warmthWet.connect(channel.gain)
    warmthWet.connect(spaceDelay)
    // SPACE: a short damped feedback delay sitting after WARMTH, summing its
    // own wet tap back into the channel alongside (never instead of) the dry
    // signal above.
    spaceDelay.connect(spaceDamping)
    spaceDamping.connect(spaceFeedback)
    spaceFeedback.connect(spaceDelay)
    spaceDamping.connect(spaceWet)
    spaceWet.connect(channel.gain)

    const ensemble: RuntimeStringsEnsemble = { input, dryGain, delayA, delayB, pannerA, pannerB, wetGainA, wetGainB, delayModDepthA, delayModDepthB, motionPanDepthA, motionPanDepthB, output, warmthShaper, warmthDry, warmthWet, spaceDelay, spaceDamping, spaceFeedback, spaceWet }
    runtime.ensembles.set(channelId, ensemble)
    this.applyStringsEnsemble(runtime, ensemble, true)
    return ensemble
  }

  private applyStringsEnsemble(runtime: StringsPatchRuntime, ensemble: RuntimeStringsEnsemble, immediately: boolean): void {
    const patch = runtime.patch
    const bias = stringsCharacterBias(patch.character)
    const amount = this.clamp01(patch.ensemble * bias.ensembleScale)
    // Dry never fully disappears - ENSEMBLE widens the sound, it does not replace it.
    this.applyEffectParameter(ensemble.dryGain.gain, 1 - amount * 0.45, immediately, 0.03)
    this.applyEffectParameter(ensemble.wetGainA.gain, amount * 0.55, immediately, 0.03)
    this.applyEffectParameter(ensemble.wetGainB.gain, amount * 0.55, immediately, 0.03)
    // A few milliseconds of delay-time wobble - chorus movement, short of flanger territory.
    this.applyEffectParameter(ensemble.delayModDepthA.gain, amount * 0.003, immediately, 0.03)
    this.applyEffectParameter(ensemble.delayModDepthB.gain, amount * 0.0035, immediately, 0.03)
    // WIDTH sets the static spread, independent of ENSEMBLE's own wet/modulation amount.
    const pan = stringsWidthToPan(patch.width)
    this.applyEffectParameter(ensemble.pannerA.pan, -pan, immediately, 0.03)
    this.applyEffectParameter(ensemble.pannerB.pan, pan, immediately, 0.03)
    // MOTION drifts on top of that static spread, opposite sign on each side.
    const motionPan = stringsMotionPanDepth(patch.motion)
    this.applyEffectParameter(ensemble.motionPanDepthA.gain, motionPan, immediately, 0.03)
    this.applyEffectParameter(ensemble.motionPanDepthB.gain, -motionPan, immediately, 0.03)
    // WARMTH crossfades into the fixed saturation curve rather than reshaping it.
    const warmthWet = stringsWarmthWetGain(patch.warmth)
    this.applyEffectParameter(ensemble.warmthDry.gain, 1 - warmthWet, immediately, 0.03)
    this.applyEffectParameter(ensemble.warmthWet.gain, warmthWet, immediately, 0.03)
    // SPACE's send and the feedback loop's decay both open up together.
    this.applyEffectParameter(ensemble.spaceFeedback.gain, stringsSpaceFeedback(patch.space), immediately, 0.03)
    this.applyEffectParameter(ensemble.spaceWet.gain, stringsSpaceWet(patch.space), immediately, 0.03)
  }

  private startStringsVoice(runtime: StringsPatchRuntime, channelId: ChannelId, midiNote: number, velocity: number, when: number, origin: 'manual' | 'sequencer', manualToken?: string): ActiveStringsVoice | undefined {
    if (!this.context) return
    const ensemble = this.ensureStringsEnsemble(runtime, channelId)
    if (!ensemble) return
    const scheduledWhen = Math.max(this.context.currentTime, when)

    // A repeated note-on for a note already sounding must not stack voices
    // indefinitely - release the old one first, and keep it out of the
    // stealing pool below so it is not "stolen" a second time for nothing.
    const duplicate = [...runtime.voices].find((voice) => !voice.cleanedUp && !voice.stolen && voice.midiNote === midiNote && (voice.stopAt === undefined || voice.stopAt > scheduledWhen))
    if (duplicate) {
      duplicate.stolen = true
      this.releaseStringsVoice(runtime, duplicate, scheduledWhen, 0.008)
    }
    this.stealStringsVoiceIfNeeded(runtime, scheduledWhen, duplicate)

    const patch = runtime.patch
    const bias = stringsCharacterBias(patch.character)
    const oscillatorA = this.context.createOscillator()
    const oscillatorB = this.context.createOscillator()
    oscillatorA.type = 'sawtooth'
    oscillatorB.type = 'sawtooth'
    // BODY's balance sits between each oscillator and the shared filter.
    const oscillatorGainA = this.context.createGain()
    const oscillatorGainB = this.context.createGain()
    const filter = this.context.createBiquadFilter()
    filter.type = 'lowpass'
    // Fixed, low Q - a gentle tone control, not a resonant subtractive filter.
    filter.Q.setValueAtTime(0.7, scheduledWhen)
    const amp = this.context.createGain()
    const vibratoOnset = this.context.createGain()
    // BOW: a cheap per-voice player reading the one shared noise buffer, mixed
    // in through the same filter as the oscillators so BRIGHTNESS/MOTION shape
    // it too. Its own gain never fades out on release - the shared `amp`
    // envelope below already does that for the whole voice.
    const bowSource = this.context.createBufferSource()
    bowSource.buffer = this.ensureStringsNoiseBuffer() ?? null
    bowSource.loop = true
    const bowGain = this.context.createGain()

    const voice: ActiveStringsVoice = {
      oscillators: [oscillatorA, oscillatorB],
      oscillatorGains: [oscillatorGainA, oscillatorGainB],
      filter,
      amp,
      vibratoOnset,
      bow: { source: bowSource, gain: bowGain },
      origin,
      groupId: runtime.groupId,
      patchKey: this.stringsPatchKey(runtime.groupId, runtime.patch.id),
      channelId,
      midiNote,
      startsAt: scheduledWhen,
      serial: this.stringsVoiceSerial++,
      manualToken,
      cleanedUp: false,
    }

    oscillatorA.connect(oscillatorGainA)
    oscillatorGainA.connect(filter)
    oscillatorB.connect(oscillatorGainB)
    oscillatorGainB.connect(filter)
    bowSource.connect(bowGain)
    bowGain.connect(filter)
    filter.connect(amp)
    amp.connect(ensemble.input)
    // MOTION's shared filter-cutoff drift fans into every voice built while it is active.
    runtime.motionFilterDepth?.connect(filter.frequency)
    // A short fixed ramp so BOW's continuous noise never steps in abruptly,
    // independent of ATTACK - the level itself comes from applyPatchToActiveStringsVoice below.
    bowGain.gain.setValueAtTime(0, scheduledWhen)
    bowGain.gain.linearRampToValueAtTime(stringsBowToGain(patch.bow), scheduledWhen + 0.05)
    // Vibrato fades in after note-on instead of being present from the attack,
    // so a fresh note starts clean and settles into its vibrato like a played
    // instrument - the shared LFO itself never stops or resets phase for this.
    // VIBRATO DELAY holds it at zero for a little longer first, if set.
    const vibratoDelaySeconds = Math.max(0, patch.vibratoDelayMs) / 1000
    vibratoOnset.gain.setValueAtTime(0, scheduledWhen)
    vibratoOnset.gain.setValueAtTime(0, scheduledWhen + vibratoDelaySeconds)
    vibratoOnset.gain.linearRampToValueAtTime(1, scheduledWhen + vibratoDelaySeconds + 0.35)
    runtime.vibratoDepth?.connect(vibratoOnset)
    vibratoOnset.connect(oscillatorA.detune)
    vibratoOnset.connect(oscillatorB.detune)

    // OCTAVE LAYER is part of voice construction, not a live-updatable signal
    // path: a layer cannot be grafted onto an already-playing voice, only built
    // fresh at its own note-on. It shares the main voice's filter and amp
    // envelope rather than duplicating them, and rides the same vibrato.
    if (patch.octaveLayer !== 'off') {
      const layerOscillator = this.context.createOscillator()
      layerOscillator.type = 'sawtooth'
      const layerGain = this.context.createGain()
      layerOscillator.connect(layerGain)
      layerGain.connect(filter)
      vibratoOnset.connect(layerOscillator.detune)
      voice.layer = { oscillator: layerOscillator, gain: layerGain }
    }

    this.applyPatchToActiveStringsVoice(runtime, voice, true)
    const attack = Math.max(0.001, patch.ampEnvelope.attackSeconds * bias.attackScale)
    const decay = Math.max(0.001, patch.ampEnvelope.decaySeconds)
    const peak = this.toGain(velocity) * patch.level * 0.14
    const sustain = Math.max(0.0001, peak * patch.ampEnvelope.sustain)
    amp.gain.setValueAtTime(0.0001, scheduledWhen)
    amp.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), scheduledWhen + attack)
    amp.gain.exponentialRampToValueAtTime(sustain, scheduledWhen + attack + decay)

    oscillatorA.addEventListener('ended', () => this.cleanUpStringsVoice(runtime, voice), { once: true })
    runtime.voices.add(voice)
    this.activeStringsVoices.add(voice)
    oscillatorA.start(scheduledWhen)
    oscillatorB.start(scheduledWhen)
    voice.layer?.oscillator.start(scheduledWhen)
    bowSource.start(scheduledWhen)
    return voice
  }

  private applyPatchToActiveStringsVoice(runtime: StringsPatchRuntime, voice: ActiveStringsVoice, immediately = false): void {
    if (!this.context) return
    const patch = runtime.patch
    const bias = stringsCharacterBias(patch.character)
    const frequency = this.midiNoteToFrequency(voice.midiNote)
    const [oscillatorA, oscillatorB] = voice.oscillators
    const [, oscillatorGainB] = voice.oscillatorGains
    this.applyEffectParameter(oscillatorA.frequency, frequency, immediately, 0.01)
    this.applyEffectParameter(oscillatorB.frequency, frequency, immediately, 0.01)
    // Static spread lives on .detune (cents) so it sums cleanly with the
    // shared vibrato signal also connected there, rather than fighting it on
    // .frequency.
    this.applyEffectParameter(oscillatorB.detune, patch.detuneCents * bias.detuneScale, immediately, 0.02)
    this.applyEffectParameter(voice.filter.frequency, this.stringsEffectiveCutoffHz(patch), immediately, 0.03)
    // BODY balances the two oscillators - oscillator A always stays at unity,
    // this is a real harmonic-structure change, not a second filter. Also
    // nudges brightness (via stringsEffectiveCutoffHz above) in the same
    // direction, so the two mechanisms reinforce one clearly audible move
    // instead of leaving BODY as a subtle balance shift alone.
    this.applyEffectParameter(oscillatorGainB.gain, stringsBodyToOscillatorBGain(this.clamp01(patch.body + bias.bodyBias)), immediately, 0.02)
    if (voice.layer) {
      const layerFrequency = patch.octaveLayer === 'down' ? frequency / 2 : frequency * 2
      this.applyEffectParameter(voice.layer.oscillator.frequency, layerFrequency, immediately, 0.01)
      // Fades to silence rather than being torn down if OCTAVE LAYER is turned
      // off while this voice is still sounding - it just cannot come back on
      // this same voice, only on the next note-on.
      const layerGain = patch.octaveLayer === 'off' ? 0 : stringsOctaveLayerMixToGain(patch.octaveLayerMix)
      this.applyEffectParameter(voice.layer.gain.gain, layerGain, immediately, 0.03)
    }
  }

  /** Prefers a voice already fading out over cutting one still fully sounding - see docs. */
  private stealStringsVoiceIfNeeded(runtime: StringsPatchRuntime, when: number, exclude?: ActiveStringsVoice): void {
    const sounding = [...runtime.voices].filter((voice) => voice !== exclude && !voice.cleanedUp && !voice.stolen && (voice.stopAt === undefined || voice.stopAt > when))
    if (sounding.length < maximumStringsVoices) return
    const releasing = sounding.filter((voice) => voice.stopAt !== undefined)
    const oldest = (releasing.length > 0 ? releasing : sounding).sort((left, right) => left.startsAt - right.startsAt || left.serial - right.serial)[0]
    if (oldest) {
      oldest.stolen = true
      this.releaseStringsVoice(runtime, oldest, when, 0.008)
    }
  }

  private releaseStringsVoice(runtime: StringsPatchRuntime, voice: ActiveStringsVoice, when: number, releaseOverride?: number): void {
    if (!this.context || voice.cleanedUp) return
    const releaseAt = Math.max(this.context.currentTime, when)
    if (voice.stopAt !== undefined && voice.stopAt <= releaseAt) return
    // A steal/duplicate override always uses its own fast release regardless
    // of CHARACTER - that release is about avoiding voice pile-up, not tone.
    const bias = stringsCharacterBias(runtime.patch.character)
    const release = Math.max(0.005, releaseOverride ?? runtime.patch.ampEnvelope.releaseSeconds * bias.releaseScale)
    this.holdAudioParamAtTime(voice.amp.gain, releaseAt)
    voice.amp.gain.exponentialRampToValueAtTime(0.0001, releaseAt + release)
    const stopAt = releaseAt + release + 0.01
    for (const oscillator of voice.oscillators) {
      try { oscillator.stop(stopAt) } catch { /* A stolen voice may already be stopping. */ }
    }
    if (voice.layer) {
      try { voice.layer.oscillator.stop(stopAt) } catch { /* A stolen voice may already be stopping. */ }
    }
    try { voice.bow.source.stop(stopAt) } catch { /* A stolen voice may already be stopping. */ }
    voice.stopAt = stopAt
  }

  private stopStringsVoiceImmediately(voice: ActiveStringsVoice): void {
    for (const oscillator of voice.oscillators) {
      try { oscillator.stop() } catch { /* The oscillator may already have ended. */ }
    }
    if (voice.layer) {
      try { voice.layer.oscillator.stop() } catch { /* The oscillator may already have ended. */ }
    }
    try { voice.bow.source.stop() } catch { /* The source may already have ended. */ }
    const runtime = this.stringsRuntimes.get(voice.patchKey)
    if (runtime) this.cleanUpStringsVoice(runtime, voice)
  }

  private cleanUpStringsVoice(runtime: StringsPatchRuntime, voice: ActiveStringsVoice): void {
    if (voice.cleanedUp) return
    voice.cleanedUp = true
    runtime.voices.delete(voice)
    this.activeStringsVoices.delete(voice)
    for (const oscillator of voice.oscillators) oscillator.disconnect()
    for (const gain of voice.oscillatorGains) gain.disconnect()
    try { runtime.motionFilterDepth?.disconnect(voice.filter.frequency) } catch { /* The motion connection may already be gone. */ }
    voice.filter.disconnect()
    try { runtime.vibratoDepth?.disconnect(voice.vibratoOnset) } catch { /* The vibrato connection may already be gone. */ }
    voice.vibratoOnset.disconnect()
    voice.amp.disconnect()
    if (voice.layer) {
      voice.layer.oscillator.disconnect()
      voice.layer.gain.disconnect()
    }
    voice.bow.source.disconnect()
    voice.bow.gain.disconnect()
  }

  private disposeStringsRuntime(key: string, runtime: StringsPatchRuntime): void {
    for (const voice of [...runtime.voices]) this.stopStringsVoiceImmediately(voice)
    try { runtime.vibratoDepth?.disconnect() } catch { /* Already disconnected. */ }
    try { runtime.motionFilterDepth?.disconnect() } catch { /* Already disconnected. */ }
    for (const ensemble of runtime.ensembles.values()) this.disposeStringsEnsemble(ensemble)
    runtime.ensembles.clear()
    this.stringsRuntimes.delete(key)
  }

  private disposeStringsEnsemble(ensemble: RuntimeStringsEnsemble): void {
    try { this.stringsEnsembleLfoA?.disconnect(ensemble.delayModDepthA) } catch { /* Already disconnected. */ }
    try { this.stringsEnsembleLfoB?.disconnect(ensemble.delayModDepthB) } catch { /* Already disconnected. */ }
    try { this.stringsMotionLfo?.disconnect(ensemble.motionPanDepthA) } catch { /* Already disconnected. */ }
    try { this.stringsMotionLfo?.disconnect(ensemble.motionPanDepthB) } catch { /* Already disconnected. */ }
    ensemble.input.disconnect()
    ensemble.dryGain.disconnect()
    ensemble.delayA.disconnect()
    ensemble.delayB.disconnect()
    ensemble.pannerA.disconnect()
    ensemble.pannerB.disconnect()
    ensemble.wetGainA.disconnect()
    ensemble.wetGainB.disconnect()
    ensemble.delayModDepthA.disconnect()
    ensemble.delayModDepthB.disconnect()
    ensemble.motionPanDepthA.disconnect()
    ensemble.motionPanDepthB.disconnect()
    ensemble.output.disconnect()
    ensemble.warmthShaper.disconnect()
    ensemble.warmthDry.disconnect()
    ensemble.warmthWet.disconnect()
    ensemble.spaceDelay.disconnect()
    ensemble.spaceDamping.disconnect()
    ensemble.spaceFeedback.disconnect()
    ensemble.spaceWet.disconnect()
  }

  private createDriveCurve(drive: number): Float32Array<ArrayBuffer> {
    const curve = new Float32Array(1024)
    const amount = Math.max(0, Math.min(1, drive)) * 12
    for (let index = 0; index < curve.length; index += 1) {
      const input = index * 2 / (curve.length - 1) - 1
      curve[index] = (1 + amount) * input / (1 + amount * Math.abs(input))
    }
    return curve
  }

  /** Fixed, gently asymmetric transfer; DRIVE and WEIGHT push into it through a smooth input gain. */
  private createOrganicBassSaturationCurve(): Float32Array<ArrayBuffer> {
    const curve = new Float32Array(2048)
    const normalization = Math.tanh(1.77)
    for (let index = 0; index < curve.length; index += 1) {
      const input = index * 2 / (curve.length - 1) - 1
      curve[index] = Math.tanh(input * 1.65 + input * input * 0.12) / normalization
    }
    return curve
  }

  private midiNoteToFrequency(midiNote: number): number {
    return 440 * 2 ** ((midiNote - 69) / 12)
  }

  private ensureGroupBus(groupId: GroupId): GroupBus {
    let bus = this.groupBuses.get(groupId)
    if (!bus) { bus = { volume: 1, muted: false, solo: false }; this.groupBuses.set(groupId, bus) }
    if (this.context && this.masterEffects && !bus.gain) {
      bus.gain = this.context.createGain()
      bus.pumpGain = this.context.createGain()
      bus.gain.connect(bus.pumpGain)
      bus.pumpGain.connect(this.ensureGroupEffects(groupId).input)
      bus.pumpGain.gain.setValueAtTime(1, this.context.currentTime)
      this.applyAllGroupGains(true)
    }
    return bus
  }

  private ensureChannel(groupId: GroupId, channelId: ChannelId): Channel {
    let channel = this.channels.get(channelId)
    if (!channel) {
      channel = { groupId, volume: 1, muted: false, solo: false }
      this.channels.set(channelId, channel)
    }
    if (this.context && this.masterEffects && !channel.gain) {
      const bus = this.ensureGroupBus(groupId)
      channel.gain = this.context.createGain()
      channel.meter = this.context.createAnalyser()
      channel.meter.fftSize = 1024
      channel.meter.smoothingTimeConstant = 0
      channel.meterSamples = new Float32Array(channel.meter.fftSize)
      channel.gain.connect(channel.meter)
      channel.meter.connect(bus.gain!)
      this.applyAllChannelGains(true)
    }
    return channel
  }

  private createWaveform(sampleBuffer: AudioBuffer): number[] {
    const bucketCount = Math.min(512, Math.max(1, Math.ceil(sampleBuffer.duration * 128)))
    const bucketSize = Math.ceil(sampleBuffer.length / bucketCount)
    const peaks: number[] = []

    for (let bucketIndex = 0; bucketIndex < bucketCount; bucketIndex += 1) {
      const start = bucketIndex * bucketSize
      const end = Math.min(sampleBuffer.length, start + bucketSize)
      let peak = 0
      for (let channelIndex = 0; channelIndex < sampleBuffer.numberOfChannels; channelIndex += 1) {
        const channelData = sampleBuffer.getChannelData(channelIndex)
        for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
          peak = Math.max(peak, Math.abs(channelData[sampleIndex]))
        }
      }
      peaks.push(peak)
    }

    return peaks
  }

  /**
   * Builds (once) and caches a whole-asset time-reversed copy of a decoded
   * buffer - never a per-slice copy, so any number of reversed slices/pads
   * sharing one asset share this same buffer. Position `t` in the reversed
   * buffer holds whatever was originally at `duration - t`, which is what
   * lets `toPlaybackRegion` below turn a forward region into a reversed one
   * with simple mirror math instead of a second, region-sized copy.
   */
  private ensureReversedBuffer(assetId: SampleAssetId, forward: AudioBuffer): AudioBuffer {
    const cached = this.reversedSamples.get(assetId)
    if (cached) return cached
    const context = this.context!
    const reversed = context.createBuffer(forward.numberOfChannels, forward.length, forward.sampleRate)
    for (let channelIndex = 0; channelIndex < forward.numberOfChannels; channelIndex += 1) {
      const source = forward.getChannelData(channelIndex)
      const destination = reversed.getChannelData(channelIndex)
      const lastIndex = source.length - 1
      for (let sampleIndex = 0; sampleIndex <= lastIndex; sampleIndex += 1) destination[sampleIndex] = source[lastIndex - sampleIndex]
    }
    this.reversedSamples.set(assetId, reversed)
    return reversed
  }

  /** Forward playback is untouched (same buffer, same math); reverse resolves
      the cached mirror copy above, building it on first use. */
  private resolvePlaybackBuffer(assetId: SampleAssetId, reversed: boolean | undefined): AudioBuffer | undefined {
    const forward = this.samples.get(assetId)
    if (!forward) return undefined
    return reversed ? this.ensureReversedBuffer(assetId, forward) : forward
  }

  private toPlaybackRegion(sampleDuration: number, startSeconds: number | undefined, endSeconds: number | undefined, reversed: boolean | undefined): { startSeconds: number; durationSeconds: number } {
    const requestedStart = typeof startSeconds === 'number' && Number.isFinite(startSeconds) ? startSeconds : 0
    const requestedEnd = typeof endSeconds === 'number' && Number.isFinite(endSeconds) ? endSeconds : sampleDuration
    // A reversed slice is still described by its forward start/end seconds
    // everywhere else in the app (persisted data, the waveform, region math);
    // only here, right before scheduling, does that flip into the mirrored
    // buffer's own coordinate space (see ensureReversedBuffer above).
    const [rangeStart, rangeEnd] = reversed ? [sampleDuration - requestedEnd, sampleDuration - requestedStart] : [requestedStart, requestedEnd]

    const minimumDuration = Math.min(0.005, sampleDuration)
    const start = Math.min(Math.max(0, rangeStart), Math.max(0, sampleDuration - minimumDuration))
    const end = Math.min(sampleDuration, Math.max(start + minimumDuration, rangeEnd))

    return { startSeconds: start, durationSeconds: end - start }
  }

  /**
   * AR is defined per voice, never on the shared channel gain. That lets a
   * pad setting affect future triggers without rewriting voices already heard.
   * The four-millisecond floor preserves the existing anti-click edge fade.
   */
  private applyPadEnvelope(gain: AudioParam, voiceGain: number, when: number, outputDuration: number, attackMs: number | undefined, releaseMs: number | undefined): void {
    const minimumEdgeFadeSeconds = 0.004
    const requestedAttackSeconds = Math.max(minimumEdgeFadeSeconds, this.toBoundedNumber(attackMs ?? 0, 0, 250, 0) / 1000)
    const requestedReleaseSeconds = this.toBoundedNumber(releaseMs ?? 4, 4, 120, 4) / 1000
    const durationScale = Math.min(1, outputDuration / (requestedAttackSeconds + requestedReleaseSeconds))
    const attackSeconds = requestedAttackSeconds * durationScale
    const releaseSeconds = requestedReleaseSeconds * durationScale
    const releaseStartsAt = when + Math.max(attackSeconds, outputDuration - releaseSeconds)

    gain.setValueAtTime(0, when)
    gain.linearRampToValueAtTime(voiceGain, when + attackSeconds)
    gain.setValueAtTime(voiceGain, releaseStartsAt)
    gain.linearRampToValueAtTime(0, when + outputDuration)
  }

  /**
   * Same ramp shape as applyPadEnvelope above, but for TRACKS clip fades:
   * stored in seconds already (not ms) and allowed up to several seconds,
   * wider than a pad's short attack/release. A separate, equally small
   * method rather than widening applyPadEnvelope's bounds, which would
   * change how every existing pad's envelope clamps.
   */
  private applyClipEnvelope(gain: AudioParam, voiceGain: number, when: number, outputDuration: number, fadeInSeconds: number | undefined, fadeOutSeconds: number | undefined): void {
    const minimumEdgeFadeSeconds = 0.004
    // 10s ceiling matches tracks/tracksOperations.ts's maximumClipFadeSeconds.
    const requestedAttackSeconds = Math.max(minimumEdgeFadeSeconds, this.toBoundedNumber(fadeInSeconds ?? 0, 0, 10, 0))
    const requestedReleaseSeconds = Math.max(minimumEdgeFadeSeconds, this.toBoundedNumber(fadeOutSeconds ?? 0, 0, 10, 0))
    const durationScale = Math.min(1, outputDuration / (requestedAttackSeconds + requestedReleaseSeconds))
    const attackSeconds = requestedAttackSeconds * durationScale
    const releaseSeconds = requestedReleaseSeconds * durationScale
    const releaseStartsAt = when + Math.max(attackSeconds, outputDuration - releaseSeconds)

    gain.setValueAtTime(0, when)
    gain.linearRampToValueAtTime(voiceGain, when + attackSeconds)
    gain.setValueAtTime(voiceGain, releaseStartsAt)
    gain.linearRampToValueAtTime(0, when + outputDuration)
  }

  private applyAllChannelGains(immediately = false): void {
    for (const channel of this.channels.values()) {
      this.applyChannelGain(channel, immediately)
    }
  }

  private applyChannelGain(channel: Channel, immediately = false): void {
    if (!channel.gain || !this.context) return
    const hasSolo = [...this.channels.values()].some((candidate) => candidate.groupId === channel.groupId && candidate.solo)
    const target = channel.muted || (hasSolo && !channel.solo) ? 0 : channel.volume
    const now = this.context.currentTime
    channel.gain.gain.cancelScheduledValues(now)
    channel.gain.gain.setValueAtTime(channel.gain.gain.value, now)
    if (immediately) channel.gain.gain.setValueAtTime(target, now)
    else channel.gain.gain.linearRampToValueAtTime(target, now + 0.01)
  }

  private applyAllGroupGains(immediately = false): void { for (const bus of this.groupBuses.values()) this.applyGroupGain(bus, immediately) }

  private applyGroupGain(bus: GroupBus, immediately = false): void {
    if (!bus.gain || !this.context) return
    const hasSolo = [...this.groupBuses.values()].some((candidate) => candidate.solo)
    const target = bus.muted || (hasSolo && !bus.solo) ? 0 : bus.volume
    const now = this.context.currentTime
    bus.gain.gain.cancelScheduledValues(now)
    bus.gain.gain.setValueAtTime(bus.gain.gain.value, now)
    if (immediately) bus.gain.gain.setValueAtTime(target, now)
    else bus.gain.gain.linearRampToValueAtTime(target, now + 0.01)
  }

  private applyMasterGain(immediately = false): void {
    if (!this.masterGain || !this.context) return
    const target = this.masterMuted ? 0 : this.masterVolume
    if (immediately) this.masterGain.gain.setValueAtTime(target, this.context.currentTime)
    else this.rampAudioParam(this.masterGain.gain, target, 0.01)
  }

  private ensureGroupEffects(groupId: GroupId): RuntimeEffectRack {
    let rack = this.groupEffects.get(groupId)
    if (!rack && this.context && this.masterEffects) {
      const state = this.groupEffectStates.get(groupId) ?? createEmptyEffectRack(groupId)
      this.groupEffectStates.set(groupId, state)
      rack = this.createRuntimeEffectRack(state)
      rack.output.connect(this.masterEffects.input)
      this.groupEffects.set(groupId, rack)
    }
    if (!rack) throw new Error('Audio effect rack is unavailable.')
    return rack
  }

  private createRuntimeEffectRack(state: EffectRackState): RuntimeEffectRack {
    const context = this.context!
    const first = this.createRuntimeEffectSlot()
    const second = this.createRuntimeEffectSlot()
    const rack = { input: context.createGain(), output: context.createGain(), slots: [first, second] as [RuntimeEffectSlot, RuntimeEffectSlot] }
    rack.input.connect(first.input)
    first.output.connect(second.input)
    second.output.connect(rack.output)
    this.applyRuntimeEffectRack(rack, state, true)
    return rack
  }

  private createRuntimeEffectSlot(): RuntimeEffectSlot {
    const context = this.context!
    const input = context.createGain()
    const output = context.createGain()
    input.connect(output)
    return { input, output, type: 'none' }
  }

  private applyRuntimeEffectRack(rack: RuntimeEffectRack | undefined, state: EffectRackState, immediately = false): void {
    if (!rack) return
    this.applyRuntimeEffectSlot(rack.slots[0], state.slots[0], immediately)
    this.applyRuntimeEffectSlot(rack.slots[1], state.slots[1], immediately)
  }

  private applyRuntimeEffectSlot(runtime: RuntimeEffectSlot, state: EffectSlotState, immediately: boolean): void {
    if (runtime.type !== state.type) this.replaceRuntimeEffect(runtime, state.type)
    runtime.effect?.applyConfig(state, immediately)
  }

  private replaceRuntimeEffect(runtime: RuntimeEffectSlot, type: EffectType): void {
    runtime.input.disconnect()
    runtime.effect?.dispose()
    runtime.effect = undefined
    runtime.type = type
    if (type === 'none') {
      runtime.input.connect(runtime.output)
      return
    }
    const effect = this.createRuntimeEffect(type)
    runtime.effect = effect
    runtime.input.connect(effect.input)
    effect.output.connect(runtime.output)
  }

  private createRuntimeEffect(type: Exclude<EffectType, 'none'>): RuntimeEffect {
    return type === 'compressor' ? this.createCompressorEffect() : type === 'delay' ? this.createDelayEffect() : type === 'eq' ? this.createEQEffect() : this.createTightRoomEffect()
  }

  private createCompressorEffect(): RuntimeEffect {
    const compressor = this.context!.createDynamicsCompressor()
    return {
      input: compressor,
      output: compressor,
      applyConfig: (slot, immediately) => {
        const config = slot.enabled ? slot.compressor : { ...defaultCompressorConfig, enabled: false }
        const values = config.enabled
          ? { threshold: config.thresholdDb, ratio: config.ratio, attack: config.attackSeconds, release: config.releaseSeconds, knee: 12 }
          : { threshold: 0, ratio: 1, attack: 0.003, release: 0.05, knee: 0 }
        this.applyEffectParameter(compressor.threshold, values.threshold, immediately, 0.02)
        this.applyEffectParameter(compressor.ratio, values.ratio, immediately, 0.02)
        this.applyEffectParameter(compressor.attack, values.attack, immediately, 0.02)
        this.applyEffectParameter(compressor.release, values.release, immediately, 0.02)
        this.applyEffectParameter(compressor.knee, values.knee, immediately, 0.02)
      },
      dispose: () => compressor.disconnect(),
    }
  }

  private createDelayEffect(): RuntimeEffect {
    const context = this.context!
    const input = context.createGain()
    const delay = context.createDelay(2)
    const dry = context.createGain()
    const wet = context.createGain()
    const feedback = context.createGain()
    const output = context.createGain()
    input.connect(dry)
    input.connect(delay)
    delay.connect(wet)
    delay.connect(feedback)
    feedback.connect(delay)
    dry.connect(output)
    wet.connect(output)
    return {
      input,
      output,
      applyConfig: (slot, immediately) => {
        const config = slot.enabled ? slot.delay : { ...defaultDelayConfig, enabled: false }
        this.applyEffectParameter(dry.gain, 1, immediately, 0.02)
        this.applyEffectParameter(wet.gain, config.enabled ? config.mix : 0, immediately, 0.02)
        this.applyEffectParameter(feedback.gain, config.enabled ? config.feedback : 0, immediately, 0.02)
        this.applyEffectParameter(delay.delayTime, getDelayTimeSeconds(config, this.bpm), immediately, 0.03)
      },
      dispose: () => {
        feedback.gain.setValueAtTime(0, context.currentTime)
        input.disconnect()
        delay.disconnect()
        dry.disconnect()
        wet.disconnect()
        feedback.disconnect()
        output.disconnect()
      },
    }
  }

  private createEQEffect(): RuntimeEffect {
    const context = this.context!
    const lowShelf = context.createBiquadFilter()
    const mid = context.createBiquadFilter()
    const highShelf = context.createBiquadFilter()
    lowShelf.type = 'lowshelf'
    mid.type = 'peaking'
    highShelf.type = 'highshelf'
    lowShelf.connect(mid)
    mid.connect(highShelf)
    return {
      input: lowShelf,
      output: highShelf,
      applyConfig: (slot, immediately) => {
        const config = slot.eq
        this.applyEffectParameter(lowShelf.frequency, config.lowShelfFreqHz, immediately, 0.02)
        this.applyEffectParameter(lowShelf.gain, slot.enabled ? config.lowShelfGainDb : 0, immediately, 0.02)
        this.applyEffectParameter(mid.frequency, config.midFreqHz, immediately, 0.02)
        this.applyEffectParameter(mid.Q, config.midQ, immediately, 0.02)
        this.applyEffectParameter(mid.gain, slot.enabled ? config.midGainDb : 0, immediately, 0.02)
        this.applyEffectParameter(highShelf.frequency, config.highShelfFreqHz, immediately, 0.02)
        this.applyEffectParameter(highShelf.gain, slot.enabled ? config.highShelfGainDb : 0, immediately, 0.02)
      },
      dispose: () => {
        lowShelf.disconnect()
        mid.disconnect()
        highShelf.disconnect()
      },
    }
  }

  /**
   * A compact stereo Schroeder/Moorer-style room reverb: a bank of damped
   * feedback combs per channel (SIZE/DECAY/TIGHT/TONE all shape these) feeds
   * two fixed series allpass stages for diffusion (this is what keeps a small
   * comb bank from ringing metallically, unlike a plain biquad allpass), then
   * a shared tone shelf and a fixed safety lowpass before the wet gain. Dry is
   * always 1 (matching DELAY's own insert convention) so AMOUNT=0 is
   * bit-for-bit transparent.
   */
  private createTightRoomEffect(): RuntimeEffect {
    const context = this.context!
    const now = context.currentTime
    const input = context.createGain()
    const dry = context.createGain()
    const preDelay = context.createDelay(0.05)
    const lowCut = context.createBiquadFilter()
    lowCut.type = 'highpass'
    lowCut.Q.setValueAtTime(0.7, now)
    const toneShelf = context.createBiquadFilter()
    toneShelf.type = 'highshelf'
    toneShelf.frequency.setValueAtTime(3500, now)
    // Fixed regardless of TONE - a ceiling, not a user control, so the
    // brightest TONE setting still cannot turn hissy or digitally harsh.
    const safetyLowpass = context.createBiquadFilter()
    safetyLowpass.type = 'lowpass'
    safetyLowpass.frequency.setValueAtTime(13000, now)
    safetyLowpass.Q.setValueAtTime(0.5, now)
    const wetSum = context.createGain()
    const wetGain = context.createGain()
    const output = context.createGain()

    // A small, slow, per-instance delay-time wobble shared by every comb -
    // without it a handful of static comb filters beat as discrete metallic
    // pitches instead of a diffuse tail. Two free-running LFOs at
    // incommensurate rates, alternated across combs (see
    // createTightRoomChannel), so neighbouring combs never wobble in
    // lockstep. Same technique STRINGS already uses for its ensemble, just
    // owned by this effect instance instead of shared engine-wide.
    const modLfoA = context.createOscillator()
    modLfoA.type = 'sine'
    modLfoA.frequency.setValueAtTime(0.9, now)
    modLfoA.start(now)
    const modLfoB = context.createOscillator()
    modLfoB.type = 'sine'
    modLfoB.frequency.setValueAtTime(1.3, now)
    modLfoB.start(now)

    input.connect(dry)
    dry.connect(output)
    input.connect(preDelay)
    preDelay.connect(lowCut)

    const channels = [this.createTightRoomChannel(context, lowCut, 0, modLfoA, modLfoB), this.createTightRoomChannel(context, lowCut, 1, modLfoA, modLfoB)]
    for (const channel of channels) channel.output.connect(wetSum)
    wetSum.connect(toneShelf)
    toneShelf.connect(safetyLowpass)
    safetyLowpass.connect(wetGain)
    wetGain.connect(output)

    return {
      input,
      output,
      applyConfig: (slot, immediately) => {
        const config = slot.tightRoom
        const bias = tightRoomModeBias(config.mode)
        const sizeMs = 9 + this.clamp01(config.size) * 39
        const effectiveTight = this.clamp01(config.tight + bias.tightBias)
        const effectiveTone = Math.min(1, Math.max(-1, config.tone + bias.toneBias))
        const dampingHz = this.tightRoomDampingHz(effectiveTone, effectiveTight, bias.dampingMultiplier)
        this.applyEffectParameter(dry.gain, 1, immediately, 0.02)
        this.applyEffectParameter(lowCut.frequency, bias.lowCutHz, immediately, 0.02)
        this.applyEffectParameter(preDelay.delayTime, config.preDelaySeconds, immediately, 0.03)
        this.applyEffectParameter(toneShelf.gain, effectiveTone * 5, immediately, 0.02)
        this.applyEffectParameter(wetGain.gain, slot.enabled ? this.tightRoomWetGain(config.amount) : 0, immediately, 0.02)
        for (const channel of channels) {
          for (const comb of channel.combs) {
            const delaySeconds = (sizeMs * comb.ratio) / 1000
            const feedback = slot.enabled ? this.tightRoomCombFeedback(delaySeconds, config.decaySeconds, effectiveTight) : 0
            this.applyEffectParameter(comb.delayTime, delaySeconds, immediately, 0.03)
            this.applyEffectParameter(comb.feedbackGain, feedback, immediately, 0.02)
            this.applyEffectParameter(comb.dampingFrequency, dampingHz, immediately, 0.02)
            // ~4.5% of the line's own delay time, at a faster (~1 Hz) rate than a first pass used - slow modulation barely moves within a short drum-length tail, so it wasn't actually decorrelating anything there.
            this.applyEffectParameter(comb.modDepthGain, delaySeconds * 0.045, immediately, 0.03)
          }
        }
      },
      dispose: () => {
        for (const channel of channels) channel.dispose()
        try { modLfoA.stop() } catch { /* May already be stopped. */ }
        try { modLfoB.stop() } catch { /* May already be stopped. */ }
        modLfoA.disconnect()
        modLfoB.disconnect()
        input.disconnect()
        dry.disconnect()
        preDelay.disconnect()
        lowCut.disconnect()
        toneShelf.disconnect()
        safetyLowpass.disconnect()
        wetSum.disconnect()
        wetGain.disconnect()
        output.disconnect()
      },
    }
  }

  /**
   * One stereo side of the reverb network. This is a small Feedback Delay
   * Network, not independent parallel combs - each of the 6 delay lines used
   * to feed back only into itself (a classic Schroeder comb bank), and even
   * with modulation and more lines that still rang as discrete, "metallic"
   * pitches rather than a diffuse tail, because each line was its own
   * isolated resonator. Here every line's decayed output is cross-mixed
   * through a Householder reflection matrix before returning to the delay
   * lines, so energy genuinely spreads between all 6 instead of each one
   * ringing alone - this is the standard modern fix for comb-bank metallic
   * character (see e.g. Jot's FDN reverb design), not a hand-tuned patch.
   * The full N x N matrix collapses to two shared nodes (`matrixSum`,
   * `matrixMix`) because a Householder matrix I - (2/N)*ones simplifies to
   * "each line's own output, minus (2/N) of the sum of all of them" - see the
   * comment at `matrixMix` below. Ratios/allpass/matrix are fixed constants,
   * not user parameters; SIZE/DECAY/TIGHT/TONE still shape delay time,
   * per-line decay and damping exactly as before.
   */
  private createTightRoomChannel(context: BaseAudioContext, source: AudioNode, channelIndex: 0 | 1, modLfoA: OscillatorNode, modLfoB: OscillatorNode): TightRoomChannel {
    const now = context.currentTime
    const ratios = channelIndex === 0 ? [1, 1.11, 1.24, 1.36, 1.51, 1.68] : [1.04, 1.15, 1.29, 1.41, 1.57, 1.74]
    const combSum = context.createGain()
    // feedbackInput_i = x_i - (2/N)*sum_all(x) is the Householder reflection
    // matrix I - (2/N)*ones applied to the 6 lines' decayed outputs x_i - the
    // orthogonal (energy-preserving) mixing matrix standard FDN reverbs use,
    // collapsed to two shared nodes instead of an N x N gain matrix.
    const matrixSum = context.createGain()
    const matrixMix = context.createGain()
    matrixMix.gain.setValueAtTime(-2 / ratios.length, now)
    matrixSum.connect(matrixMix)
    const combs: TightRoomComb[] = ratios.map((ratio, combIndex) => {
      const delay = context.createDelay(0.1)
      const damping = context.createBiquadFilter()
      damping.type = 'lowpass'
      damping.Q.setValueAtTime(0.5, now)
      const decayGain = context.createGain()
      const modDepth = context.createGain()
      modDepth.gain.setValueAtTime(0, now)
      // Alternating LFOs, not one shared by every line - otherwise all 6
      // wobble in identical phase and could reintroduce a new periodicity.
      const lfo = combIndex % 2 === 0 ? modLfoA : modLfoB
      lfo.connect(modDepth)
      modDepth.connect(delay.delayTime)
      source.connect(delay)
      matrixMix.connect(delay)
      delay.connect(damping)
      damping.connect(decayGain)
      decayGain.connect(delay)
      decayGain.connect(matrixSum)
      damping.connect(combSum)
      return {
        ratio,
        delayTime: delay.delayTime,
        feedbackGain: decayGain.gain,
        dampingFrequency: damping.frequency,
        modDepthGain: modDepth.gain,
        dispose: () => { delay.disconnect(); damping.disconnect(); decayGain.disconnect(); modDepth.disconnect() },
      }
    })
    // Coefficient nudged up from the first pass (0.6 -> 0.65) for a touch more diffusion, still well short of audible allpass coloration.
    const allpass1 = this.createTightRoomAllpass(context, channelIndex === 0 ? 0.006 : 0.0063, 0.65)
    const allpass2 = this.createTightRoomAllpass(context, channelIndex === 0 ? 0.0035 : 0.0037, 0.65)
    const panner = context.createStereoPanner()
    panner.pan.setValueAtTime(channelIndex === 0 ? -0.65 : 0.65, now)
    combSum.connect(allpass1.input)
    allpass1.output.connect(allpass2.input)
    allpass2.output.connect(panner)
    return {
      combs,
      output: panner,
      dispose: () => {
        combSum.disconnect()
        matrixSum.disconnect()
        matrixMix.disconnect()
        for (const comb of combs) comb.dispose()
        allpass1.dispose()
        allpass2.dispose()
        panner.disconnect()
      },
    }
  }

  /** A single-multiplier Schroeder allpass (w[n]=x[n]+g*w[n-D], y[n]=-g*w[n]+w[n-D]) - the delay-line diffuser that keeps a small comb bank from ringing metallically, unlike a plain biquad allpass. Delay time and coefficient are fixed for the lifetime of the effect. */
  private createTightRoomAllpass(context: BaseAudioContext, delaySeconds: number, coefficient: number): { input: AudioNode; output: AudioNode; dispose: () => void } {
    const now = context.currentTime
    const sum = context.createGain()
    const delay = context.createDelay(0.02)
    delay.delayTime.setValueAtTime(delaySeconds, now)
    const feedback = context.createGain()
    feedback.gain.setValueAtTime(coefficient, now)
    const forward = context.createGain()
    forward.gain.setValueAtTime(-coefficient, now)
    const output = context.createGain()
    sum.connect(delay)
    delay.connect(output)
    delay.connect(feedback)
    feedback.connect(sum)
    sum.connect(forward)
    forward.connect(output)
    return {
      input: sum,
      output,
      dispose: () => { sum.disconnect(); delay.disconnect(); feedback.disconnect(); forward.disconnect(); output.disconnect() },
    }
  }

  /** AMOUNT's own curve: a mild power taper (the same reasoning as the STRINGS OCTAVE MIX fix) so the first third of the knob stays subtle instead of becoming audible immediately. Dry is always 1, so this only ever adds to the signal - see createTightRoomEffect. */
  private tightRoomWetGain(amount: number): number {
    return this.clamp01(amount) ** 1.4
  }

  /** Classic RT60 comb-feedback formula (feedback = 10^(-3*delay/decay)), then TIGHT further shortens it on top of whatever DECAY alone would produce, capped well under unity regardless of the inputs - the same "never trust the formula alone" caution as DELAY's own 0.85 feedback ceiling. */
  private tightRoomCombFeedback(delaySeconds: number, decaySeconds: number, tight: number): number {
    const raw = 10 ** ((-3 * delaySeconds) / Math.max(0.05, decaySeconds))
    return Math.min(0.88, Math.max(0, raw * (1 - this.clamp01(tight) * 0.4)))
  }

  /** The comb feedback loop's damping lowpass: TONE sets the base brightness, TIGHT closes it further (faster high-frequency decay reads as "tighter"), and the mode bias nudges the whole thing without a separate code path per mode. */
  private tightRoomDampingHz(tone: number, tight: number, dampingMultiplier: number): number {
    const toneFactor = (Math.min(1, Math.max(-1, tone)) + 1) / 2
    const base = 2500 + toneFactor * 7500
    const tightened = base * (1 - this.clamp01(tight) * 0.5)
    return Math.min(12000, Math.max(800, tightened * dampingMultiplier))
  }

  private applySynchronizedDelayTimes(): void {
    for (const [groupId, state] of this.groupEffectStates) this.applyRuntimeEffectRack(this.groupEffects.get(groupId), state)
    this.applyRuntimeEffectRack(this.masterEffects, this.masterEffectState)
  }

  private disposeRuntimeEffectRack(rack: RuntimeEffectRack | undefined): void {
    if (!rack) return
    for (const slot of rack.slots) {
      slot.input.disconnect()
      slot.effect?.dispose()
      slot.output.disconnect()
    }
    rack.input.disconnect()
    rack.output.disconnect()
  }

  private applyEffectParameter(parameter: AudioParam, target: number, immediately: boolean, durationSeconds: number): void {
    if (!this.context) return
    if (immediately) {
      parameter.cancelScheduledValues(this.context.currentTime)
      parameter.setValueAtTime(target, this.context.currentTime)
    } else this.rampAudioParam(parameter, target, durationSeconds)
  }

  private rampAudioParam(parameter: AudioParam, target: number, durationSeconds = 0.02): void {
    if (!this.context) return
    const now = this.context.currentTime
    parameter.cancelScheduledValues(now)
    parameter.setValueAtTime(parameter.value, now)
    parameter.linearRampToValueAtTime(target, now + durationSeconds)
  }


  private triggerPumpRoutesForChannel(channelId: ChannelId, when: number): void {
    for (const route of this.pumpRoutes) if (route.sourceChannelId === channelId) this.triggerPumpRoute(route, when)
  }

  private triggerPumpRoute(route: PumpRoute, when: number): void {
    const pumpGain = this.groupBuses.get(route.targetGroupId)?.pumpGain
    if (!pumpGain) return

    const low = Math.max(0.0001, 1 - this.toGain(route.depth))
    const recoveryTime = Math.max(0.01, route.lengthSeconds)
    const gain = pumpGain.gain
    gain.cancelScheduledValues(when)
    gain.setValueAtTime(gain.value, when)
    gain.linearRampToValueAtTime(low, when + 0.005)
    if (route.curve === 'snap') {
      gain.exponentialRampToValueAtTime(1, when + Math.max(0.01, recoveryTime * 0.45))
      gain.setValueAtTime(1, when + recoveryTime)
    } else if (route.curve === 'smooth') {
      gain.exponentialRampToValueAtTime(1, when + recoveryTime)
    } else {
      gain.setValueAtTime(low, when + recoveryTime * 0.65)
      gain.linearRampToValueAtTime(1, when + recoveryTime)
    }
  }

  private cleanUpVoice(voice: ActiveVoice): void {
    if (voice.cleanedUp) {
      return
    }

    voice.cleanedUp = true
    this.activeVoices.delete(voice)
    this.previewVoices.delete(voice)
    voice.source.disconnect()
    voice.gain.disconnect()
    voice.onEnded?.()
  }

  private isWavAsset(blob: Blob, filename: string): boolean {
    return blob.type === 'audio/wav' || blob.type === 'audio/x-wav' || /\.wav$/i.test(filename)
  }

  private toGain(gain: number | undefined): number {
    return typeof gain === 'number' && Number.isFinite(gain) ? Math.min(1, Math.max(0, gain)) : 1
  }

  private clamp01(value: number): number {
    return Math.min(1, Math.max(0, value))
  }

  private toBoundedNumber(value: unknown, minimum: number, maximum: number, fallback: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
    return Math.min(maximum, Math.max(minimum, value))
  }

  private toPlaybackRate(pitchSemitones: number | undefined): number {
    const semitones = typeof pitchSemitones === 'number' && Number.isFinite(pitchSemitones) ? pitchSemitones : 0
    return 2 ** (semitones / 12)
  }

  private toError(error: unknown, fallbackMessage: string): Error {
    if (error instanceof Error && error.message) {
      return new Error(`${fallbackMessage} ${error.message}`)
    }

    return new Error(fallbackMessage)
  }
}

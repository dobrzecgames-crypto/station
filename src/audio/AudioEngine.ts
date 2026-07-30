import { createDefaultMasterEffectRack, createEmptyEffectRack, defaultCompressorConfig, defaultDelayConfig, getDelayTimeSeconds, normalizeEffectRackState } from './effects'
import type { EffectRackState, EffectSlotState, EffectType } from './effects'
import { cloneSynthPatch, lfoFrequencyHz, maximumSynthVoices } from '../synth/synthOperations'
import type { SynthPatch } from '../synth/synthTypes'

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
  origin: 'manual' | 'sequencer' | 'preview'
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
  private runtimeAssets = new Map<SampleAssetId, RuntimeSampleAsset>()
  private activeVoices = new Set<ActiveVoice>()
  private previewVoices = new Set<ActiveVoice>()
  private readonly synthPatches = new Map<string, SynthPatchRegistration>()
  private readonly synthRuntimes = new Map<string, SynthPatchRuntime>()
  private activeSynthVoices = new Set<ActiveSynthVoice>()
  private synthVoiceSerial = 0
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
    for (const route of this.pumpRoutes) if (route.sourceChannelId === channelId) this.triggerPumpRoute(route, when)
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
    for (const route of this.pumpRoutes) if (route.sourceChannelId === channelId) this.triggerPumpRoute(route, scheduledWhen)
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

  previewAsset(assetId: SampleAssetId, options: TriggerSampleOptions = {}, onEnded?: () => void): void {
    const sampleBuffer = this.samples.get(assetId)
    if (this.status !== 'ready' || !this.context || !this.masterEffects || !sampleBuffer) return

    const when = this.context.currentTime
    const source = this.context.createBufferSource()
    const gain = this.context.createGain()
    const voice: ActiveVoice = { source, gain, cleanedUp: false, origin: 'preview', isSample: true, startsAt: when, onEnded }
    const playbackRate = this.toPlaybackRate(options.pitchSemitones)
    const region = this.toPlaybackRegion(sampleBuffer.duration, options.startSeconds, options.endSeconds)
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
  }

  scheduleSample(groupId: GroupId, channelId: ChannelId, assetId: SampleAssetId, when: number, options: TriggerSampleOptions = {}, origin: 'manual' | 'sequencer' = 'manual'): void {
    const sampleBuffer = this.samples.get(assetId)
    const channel = this.ensureChannel(groupId, channelId)

    if (this.status !== 'ready' || !this.context || !this.masterEffects || !sampleBuffer || !channel?.gain) {
      return
    }

    const source = this.context.createBufferSource()
    const gain = this.context.createGain()
    const scheduledWhen = Math.max(this.context.currentTime, when)
    const voice: ActiveVoice = { source, gain, cleanedUp: false, origin, isSample: true, startsAt: scheduledWhen, chokeGroupId: options.chokeGroupId }
    const playbackRate = this.toPlaybackRate(options.pitchSemitones)
    const region = this.toPlaybackRegion(sampleBuffer.duration, options.startSeconds, options.endSeconds)
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
    for (const route of this.pumpRoutes) if (route.sourceChannelId === channelId) this.triggerPumpRoute(route, scheduledWhen)
    source.start(scheduledWhen, region.startSeconds, outputDuration * playbackRate)
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
    for (const voice of [...this.activeSynthVoices]) if (voice.origin === 'manual') this.stopSynthVoiceImmediately(voice)
  }

  getActiveVoiceCount(): number {
    return this.activeVoices.size + this.activeSynthVoices.size
  }

  getCurrentTime(): number {
    return this.context?.currentTime ?? 0
  }

  dispose(): void {
    this.stopAll()
    this.samples.clear()
    this.waveforms.clear()
    this.runtimeAssets.clear()
    for (const [key, runtime] of this.synthRuntimes) this.disposeSynthRuntime(key, runtime)
    this.synthPatches.clear()
    this.activeSynthVoices.clear()
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

  private createDriveCurve(drive: number): Float32Array<ArrayBuffer> {
    const curve = new Float32Array(1024)
    const amount = Math.max(0, Math.min(1, drive)) * 12
    for (let index = 0; index < curve.length; index += 1) {
      const input = index * 2 / (curve.length - 1) - 1
      curve[index] = (1 + amount) * input / (1 + amount * Math.abs(input))
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

  private toPlaybackRegion(sampleDuration: number, startSeconds: number | undefined, endSeconds: number | undefined): { startSeconds: number; durationSeconds: number } {
    const minimumDuration = Math.min(0.005, sampleDuration)
    const requestedStart = typeof startSeconds === 'number' && Number.isFinite(startSeconds) ? startSeconds : 0
    const start = Math.min(Math.max(0, requestedStart), Math.max(0, sampleDuration - minimumDuration))
    const requestedEnd = typeof endSeconds === 'number' && Number.isFinite(endSeconds) ? endSeconds : sampleDuration
    const end = Math.min(sampleDuration, Math.max(start + minimumDuration, requestedEnd))

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
    return type === 'compressor' ? this.createCompressorEffect() : type === 'delay' ? this.createDelayEffect() : this.createEQEffect()
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

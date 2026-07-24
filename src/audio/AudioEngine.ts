import { createDefaultMasterEffectRack, createEmptyEffectRack, defaultCompressorConfig, defaultDelayConfig, getDelayTimeSeconds, normalizeEffectRackState } from './effects'
import type { EffectRackState, EffectSlotState, EffectType } from './effects'

export type SampleId = string
export type SampleAssetId = string
export type ChannelId = string
export type GroupId = string

export type AudioEngineStatus = 'inactive' | 'starting' | 'ready' | 'suspended' | 'error'

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
}

export type PumpCurve = 'snap' | 'smooth' | 'swell'

export interface PumpConfig {
  sourceChannelId: ChannelId | null
  targetChannelIds: readonly ChannelId[]
  depth: number
  lengthSeconds: number
  curve: PumpCurve
}

interface ActiveVoice {
  source: AudioScheduledSourceNode
  gain: GainNode
  cleanedUp: boolean
  origin: 'manual' | 'sequencer' | 'preview'
  isSample: boolean
  startsAt: number
  stopAt?: number
  onEnded?: () => void
}

interface Channel {
  groupId: GroupId
  volume: number
  muted: boolean
  solo: boolean
  gain?: GainNode
  pumpGain?: GainNode
}

interface GroupBus { volume: number; muted: boolean; solo: boolean; gain?: GainNode }

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
  private context: AudioContext | undefined
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
  private pumpConfig: PumpConfig = { sourceChannelId: null, targetChannelIds: [], depth: 0, lengthSeconds: 0.2, curve: 'smooth' }
  private samples = new Map<SampleId, AudioBuffer>()
  private waveforms = new Map<SampleId, number[]>()
  private runtimeAssets = new Map<SampleAssetId, RuntimeSampleAsset>()
  private activeVoices = new Set<ActiveVoice>()
  private previewVoices = new Set<ActiveVoice>()
  private status: AudioEngineStatus = 'inactive'
  private readonly statusListeners = new Set<(status: AudioEngineStatus) => void>()

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
    if (this.context?.state === 'running') {
      this.setStatus('ready')
      return
    }

    this.setStatus('starting')

    try {
      const AudioContextConstructor = window.AudioContext
      this.context ??= new AudioContextConstructor()
      this.context.onstatechange = () => this.syncContextStatus()
      this.createMasterOutput(this.context)
      this.createChannelNodes()
      await this.context.resume()

      if (this.context.state !== 'running') {
        throw new Error('Audio is still suspended. Try START AUDIO again.')
      }

      this.setStatus('ready')
    } catch (error) {
      this.setStatus('error')
      throw this.toError(error, 'Unable to start Web Audio.')
    }
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

  setPumpConfig(config: PumpConfig): void {
    this.pumpConfig = config
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
  }

  triggerSample(groupId: GroupId, channelId: ChannelId, assetId: SampleAssetId, options: TriggerSampleOptions = {}): void {
    if (!this.context) {
      return
    }

    this.scheduleSample(groupId, channelId, assetId, this.context.currentTime, options)
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
    const voice: ActiveVoice = { source, gain, cleanedUp: false, origin, isSample: true, startsAt: scheduledWhen }
    const playbackRate = this.toPlaybackRate(options.pitchSemitones)
    const region = this.toPlaybackRegion(sampleBuffer.duration, options.startSeconds, options.endSeconds)
    const voiceGain = this.toGain(options.gain)
    const outputDuration = region.durationSeconds / playbackRate
    const fadeDuration = Math.min(0.004, outputDuration / 2)
    source.buffer = sampleBuffer
    gain.gain.setValueAtTime(0, scheduledWhen)
    gain.gain.linearRampToValueAtTime(voiceGain, scheduledWhen + fadeDuration)
    gain.gain.setValueAtTime(voiceGain, scheduledWhen + Math.max(fadeDuration, outputDuration - fadeDuration))
    gain.gain.linearRampToValueAtTime(0, scheduledWhen + outputDuration)
    source.playbackRate.setValueAtTime(playbackRate, scheduledWhen)
    source.connect(gain)
    gain.connect(channel.gain)
    source.addEventListener('ended', () => this.cleanUpVoice(voice), { once: true })

    this.activeVoices.add(voice)
    if (channelId === this.pumpConfig.sourceChannelId) this.triggerPump(scheduledWhen)
    source.start(scheduledWhen, region.startSeconds, region.durationSeconds)
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
  }

  stopSequencerVoicesAt(when: number): void {
    if (!this.context) return
    const stopAt = Math.max(this.context.currentTime, when)
    for (const voice of this.activeVoices) {
      if (voice.origin !== 'sequencer' || !voice.isSample || voice.startsAt > stopAt || (voice.stopAt !== undefined && voice.stopAt <= stopAt)) continue
      try {
        voice.source.stop(stopAt)
        voice.stopAt = stopAt
      } catch {
        // A sequenced source may already have ended before the next step cuts it.
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
  }

  getActiveVoiceCount(): number {
    return this.activeVoices.size
  }

  getCurrentTime(): number {
    return this.context?.currentTime ?? 0
  }

  dispose(): void {
    this.stopAll()
    this.samples.clear()
    this.waveforms.clear()
    this.runtimeAssets.clear()
    for (const channel of this.channels.values()) {
      channel.gain?.disconnect()
      channel.pumpGain?.disconnect()
      channel.gain = undefined
      channel.pumpGain = undefined
    }
    for (const bus of this.groupBuses.values()) bus.gain?.disconnect()
    this.groupBuses.clear()
    for (const rack of this.groupEffects.values()) this.disposeRuntimeEffectRack(rack)
    this.groupEffects.clear()
    this.groupEffectStates.clear()
    this.disposeRuntimeEffectRack(this.masterEffects)
    this.masterGain?.disconnect()

    if (this.context && this.context.state !== 'closed') {
      void this.context.close()
    }

    this.context = undefined
    this.masterEffects = undefined
    this.masterGain = undefined
    this.setStatus('inactive')
  }

  private syncContextStatus(): void {
    if (this.context?.state === 'running') this.setStatus('ready')
    else if (this.context?.state === 'suspended') this.setStatus('suspended')
    else if (this.context?.state === 'closed') this.setStatus('inactive')
  }

  private setStatus(status: AudioEngineStatus): void {
    if (this.status === status) return
    this.status = status
    for (const listener of this.statusListeners) listener(status)
  }

  private createMasterOutput(context: AudioContext): void {
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
      if (channel.gain && channel.pumpGain) continue
      channel.gain = context.createGain()
      channel.pumpGain = context.createGain()
      channel.gain.connect(channel.pumpGain)
      channel.pumpGain.connect(this.ensureGroupBus(channel.groupId).gain!)
      channel.pumpGain.gain.setValueAtTime(1, context.currentTime)
    }
    this.applyAllChannelGains(true)
  }

  private ensureGroupBus(groupId: GroupId): GroupBus {
    let bus = this.groupBuses.get(groupId)
    if (!bus) { bus = { volume: 1, muted: false, solo: false }; this.groupBuses.set(groupId, bus) }
    if (this.context && this.masterEffects && !bus.gain) {
      bus.gain = this.context.createGain()
      bus.gain.connect(this.ensureGroupEffects(groupId).input)
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
      channel.pumpGain = this.context.createGain()
      channel.gain.connect(channel.pumpGain)
      channel.pumpGain.connect(bus.gain!)
      channel.pumpGain.gain.setValueAtTime(1, this.context.currentTime)
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
    if (immediately) parameter.setValueAtTime(target, this.context.currentTime)
    else this.rampAudioParam(parameter, target, durationSeconds)
  }

  private rampAudioParam(parameter: AudioParam, target: number, durationSeconds = 0.02): void {
    if (!this.context) return
    const now = this.context.currentTime
    parameter.cancelScheduledValues(now)
    parameter.setValueAtTime(parameter.value, now)
    parameter.linearRampToValueAtTime(target, now + durationSeconds)
  }


  private triggerPump(when: number): void {
    const { depth, lengthSeconds, curve, targetChannelIds } = this.pumpConfig
    const low = Math.max(0.0001, 1 - this.toGain(depth))
    const recoveryTime = Math.max(0.01, lengthSeconds)

    for (const channelId of targetChannelIds) {
      if (channelId === this.pumpConfig.sourceChannelId) continue
      const pumpGain = this.channels.get(channelId)?.pumpGain
      if (!pumpGain) continue
      const gain = pumpGain.gain
      gain.cancelScheduledValues(when)
      gain.setValueAtTime(gain.value, when)
      gain.linearRampToValueAtTime(low, when + 0.005)
      if (curve === 'snap') {
        gain.exponentialRampToValueAtTime(1, when + Math.max(0.01, recoveryTime * 0.45))
        gain.setValueAtTime(1, when + recoveryTime)
      } else if (curve === 'smooth') {
        gain.exponentialRampToValueAtTime(1, when + recoveryTime)
      } else {
        gain.setValueAtTime(low, when + recoveryTime * 0.65)
        gain.linearRampToValueAtTime(1, when + recoveryTime)
      }
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

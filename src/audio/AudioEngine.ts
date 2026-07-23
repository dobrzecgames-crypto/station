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
  source: AudioBufferSourceNode
  gain: GainNode
  cleanedUp: boolean
  origin: 'manual' | 'sequencer' | 'preview'
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

export class AudioEngine {
  private context: AudioContext | undefined
  private masterGain: GainNode | undefined
  private readonly channels = new Map<ChannelId, Channel>()
  private readonly groupBuses = new Map<GroupId, GroupBus>()
  private masterVolume = 1
  private masterMuted = false
  private pumpConfig: PumpConfig = { sourceChannelId: null, targetChannelIds: [], depth: 0, lengthSeconds: 0.2, curve: 'smooth' }
  private samples = new Map<SampleId, AudioBuffer>()
  private waveforms = new Map<SampleId, number[]>()
  private runtimeAssets = new Map<SampleAssetId, RuntimeSampleAsset>()
  private activeVoices = new Set<ActiveVoice>()
  private previewVoices = new Set<ActiveVoice>()
  private status: AudioEngineStatus = 'inactive'
  private readonly statusListeners = new Set<(status: AudioEngineStatus) => void>()

  constructor(channelIds: readonly ChannelId[] = []) {
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
      this.masterGain ??= this.createMasterGain(this.context)
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

  triggerSample(groupId: GroupId, channelId: ChannelId, assetId: SampleAssetId, options: TriggerSampleOptions = {}): void {
    if (!this.context) {
      return
    }

    this.scheduleSample(groupId, channelId, assetId, this.context.currentTime, options)
  }

  previewAsset(assetId: SampleAssetId, options: TriggerSampleOptions = {}, onEnded?: () => void): void {
    const sampleBuffer = this.samples.get(assetId)
    if (this.status !== 'ready' || !this.context || !this.masterGain || !sampleBuffer) return

    const when = this.context.currentTime
    const source = this.context.createBufferSource()
    const gain = this.context.createGain()
    const voice: ActiveVoice = { source, gain, cleanedUp: false, origin: 'preview', onEnded }
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
    gain.connect(this.masterGain)
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

    if (this.status !== 'ready' || !this.context || !this.masterGain || !sampleBuffer || !channel?.gain) {
      return
    }

    const source = this.context.createBufferSource()
    const gain = this.context.createGain()
    const voice: ActiveVoice = { source, gain, cleanedUp: false, origin }
    const scheduledWhen = Math.max(this.context.currentTime, when)
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
    this.masterGain?.disconnect()

    if (this.context && this.context.state !== 'closed') {
      void this.context.close()
    }

    this.context = undefined
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

  private createMasterGain(context: AudioContext): GainNode {
    const masterGain = context.createGain()
    masterGain.gain.setValueAtTime(this.masterMuted ? 0 : this.masterVolume, context.currentTime)
    masterGain.connect(context.destination)
    return masterGain
  }

  private createChannelNodes(): void {
    const context = this.context!
    for (const channel of this.channels.values()) {
      if (channel.gain && channel.pumpGain) continue
      channel.gain = context.createGain()
      channel.pumpGain = context.createGain()
      channel.gain.connect(channel.pumpGain)
      channel.pumpGain.connect(this.masterGain!)
      channel.pumpGain.gain.setValueAtTime(1, context.currentTime)
    }
    this.applyAllChannelGains(true)
  }

  private ensureGroupBus(groupId: GroupId): GroupBus {
    let bus = this.groupBuses.get(groupId)
    if (!bus) { bus = { volume: 1, muted: false, solo: false }; this.groupBuses.set(groupId, bus) }
    if (this.context && this.masterGain && !bus.gain) {
      bus.gain = this.context.createGain()
      bus.gain.connect(this.masterGain)
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
    if (this.context && this.masterGain && !channel.gain) {
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

  private applyMasterGain(): void {
    if (!this.masterGain || !this.context) return
    const now = this.context.currentTime
    const target = this.masterMuted ? 0 : this.masterVolume
    this.masterGain.gain.cancelScheduledValues(now)
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now)
    this.masterGain.gain.linearRampToValueAtTime(target, now + 0.01)
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

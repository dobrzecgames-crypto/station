export type SampleId = string
export type SampleAssetId = string

export type AudioEngineStatus = 'inactive' | 'starting' | 'ready' | 'error'

export interface LoadedSampleInfo {
  filename: string
  durationSeconds: number
}

export interface TriggerSampleOptions {
  gain?: number
  pitchSemitones?: number
  startSeconds?: number
  endSeconds?: number
}

export type PumpCurve = 'snap' | 'smooth' | 'swell'

export interface PumpConfig {
  sourceSampleId: SampleId | null
  targetSampleIds: readonly SampleId[]
  depth: number
  lengthSeconds: number
  curve: PumpCurve
}

interface ActiveVoice {
  source: AudioBufferSourceNode
  gain: GainNode
  cleanedUp: boolean
}

interface Channel {
  volume: number
  muted: boolean
  solo: boolean
  gain?: GainNode
  pumpGain?: GainNode
}

export class AudioEngine {
  private context: AudioContext | undefined
  private masterGain: GainNode | undefined
  private readonly channels = new Map<SampleId, Channel>()
  private pumpConfig: PumpConfig = { sourceSampleId: null, targetSampleIds: [], depth: 0, lengthSeconds: 0.2, curve: 'smooth' }
  private samples = new Map<SampleId, AudioBuffer>()
  private waveforms = new Map<SampleId, number[]>()
  private activeVoices = new Set<ActiveVoice>()
  private status: AudioEngineStatus = 'inactive'

  constructor(channelIds: readonly SampleId[]) {
    for (const channelId of channelIds) {
      this.channels.set(channelId, { volume: 1, muted: false, solo: false })
    }
  }

  getStatus(): AudioEngineStatus {
    return this.status
  }

  async initialize(): Promise<void> {
    if (this.context?.state === 'running') {
      this.status = 'ready'
      return
    }

    this.status = 'starting'

    try {
      const AudioContextConstructor = window.AudioContext
      this.context ??= new AudioContextConstructor()
      this.masterGain ??= this.createMasterGain(this.context)
      this.createChannelNodes()
      await this.context.resume()

      if (this.context.state !== 'running') {
        throw new Error('Audio is still suspended. Try START AUDIO again.')
      }

      this.status = 'ready'
    } catch (error) {
      this.status = 'error'
      throw this.toError(error, 'Unable to start Web Audio.')
    }
  }

  async loadSample(assetId: SampleAssetId, file: File): Promise<LoadedSampleInfo> {
    if (this.status !== 'ready' || !this.context) {
      throw new Error('Start audio before loading a sample.')
    }

    if (!this.isWavFile(file)) {
      throw new Error('Select a WAV file.')
    }

    try {
      const audioData = await file.arrayBuffer()
      const decodedBuffer = await this.context.decodeAudioData(audioData)

      this.samples.set(assetId, decodedBuffer)
      this.waveforms.set(assetId, this.createWaveform(decodedBuffer))
      return {
        filename: file.name,
        durationSeconds: decodedBuffer.duration,
      }
    } catch (error) {
      throw this.toError(error, `Could not decode "${file.name}" as WAV audio.`)
    }
  }

  hasSampleAsset(assetId: SampleAssetId): boolean {
    return this.samples.has(assetId)
  }

  removeSampleAsset(assetId: SampleAssetId): boolean {
    this.waveforms.delete(assetId)
    return this.samples.delete(assetId)
  }

  getWaveformPeaks(assetId: SampleAssetId): number[] | undefined {
    return this.waveforms.get(assetId)?.slice()
  }

  setChannelVolume(sampleId: SampleId, volume: number): void {
    const channel = this.channels.get(sampleId)
    if (!channel) return
    channel.volume = this.toGain(volume)
    this.applyChannelGain(channel)
  }

  setChannelMuted(sampleId: SampleId, muted: boolean): void {
    const channel = this.channels.get(sampleId)
    if (!channel) return
    channel.muted = muted
    this.applyAllChannelGains()
  }

  setChannelSolo(sampleId: SampleId, solo: boolean): void {
    const channel = this.channels.get(sampleId)
    if (!channel) return
    channel.solo = solo
    this.applyAllChannelGains()
  }

  setPumpConfig(config: PumpConfig): void {
    this.pumpConfig = config
  }

  triggerSample(padId: SampleId, assetId: SampleAssetId, options: TriggerSampleOptions = {}): void {
    if (!this.context) {
      return
    }

    this.scheduleSample(padId, assetId, this.context.currentTime, options)
  }

  scheduleSample(padId: SampleId, assetId: SampleAssetId, when: number, options: TriggerSampleOptions = {}): void {
    const sampleBuffer = this.samples.get(assetId)
    const channel = this.channels.get(padId)

    if (this.status !== 'ready' || !this.context || !this.masterGain || !sampleBuffer || !channel?.gain) {
      return
    }

    const source = this.context.createBufferSource()
    const gain = this.context.createGain()
    const voice: ActiveVoice = { source, gain, cleanedUp: false }
    const playbackRate = this.toPlaybackRate(options.pitchSemitones)
    const region = this.toPlaybackRegion(sampleBuffer.duration, options.startSeconds, options.endSeconds)
    const voiceGain = this.toGain(options.gain)
    const outputDuration = region.durationSeconds / playbackRate
    const fadeDuration = Math.min(0.004, outputDuration / 2)
    source.buffer = sampleBuffer
    gain.gain.setValueAtTime(0, when)
    gain.gain.linearRampToValueAtTime(voiceGain, when + fadeDuration)
    gain.gain.setValueAtTime(voiceGain, when + Math.max(fadeDuration, outputDuration - fadeDuration))
    gain.gain.linearRampToValueAtTime(0, when + outputDuration)
    source.playbackRate.setValueAtTime(playbackRate, when)
    source.connect(gain)
    gain.connect(channel.gain)
    source.addEventListener('ended', () => this.cleanUpVoice(voice), { once: true })

    this.activeVoices.add(voice)
    if (padId === this.pumpConfig.sourceSampleId) this.triggerPump(when)
    source.start(when, region.startSeconds, region.durationSeconds)
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
    for (const channel of this.channels.values()) {
      channel.gain?.disconnect()
      channel.pumpGain?.disconnect()
      channel.gain = undefined
      channel.pumpGain = undefined
    }
    this.masterGain?.disconnect()

    if (this.context && this.context.state !== 'closed') {
      void this.context.close()
    }

    this.context = undefined
    this.masterGain = undefined
    this.status = 'inactive'
  }

  private createMasterGain(context: AudioContext): GainNode {
    const masterGain = context.createGain()
    masterGain.gain.setValueAtTime(1, context.currentTime)
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
    const hasSolo = [...this.channels.values()].some((candidate) => candidate.solo)
    const target = channel.muted || (hasSolo && !channel.solo) ? 0 : channel.volume
    const now = this.context.currentTime
    channel.gain.gain.cancelScheduledValues(now)
    channel.gain.gain.setValueAtTime(channel.gain.gain.value, now)
    if (immediately) channel.gain.gain.setValueAtTime(target, now)
    else channel.gain.gain.linearRampToValueAtTime(target, now + 0.01)
  }

  private triggerPump(when: number): void {
    const { depth, lengthSeconds, curve, targetSampleIds } = this.pumpConfig
    const low = Math.max(0.0001, 1 - this.toGain(depth))
    const recoveryTime = Math.max(0.01, lengthSeconds)

    for (const sampleId of targetSampleIds) {
      if (sampleId === this.pumpConfig.sourceSampleId) continue
      const pumpGain = this.channels.get(sampleId)?.pumpGain
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
    voice.source.disconnect()
    voice.gain.disconnect()
  }

  private isWavFile(file: File): boolean {
    return file.type === 'audio/wav' || file.type === 'audio/x-wav' || /\.wav$/i.test(file.name)
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

export type SampleId = string

export type AudioEngineStatus = 'inactive' | 'starting' | 'ready' | 'error'

export interface LoadedSampleInfo {
  filename: string
  durationSeconds: number
}

export interface TriggerSampleOptions {
  gain?: number
  pitchSemitones?: number
}

export type PumpCurve = 'snap' | 'smooth' | 'swell'
export interface PumpConfig { sourceSampleId: SampleId | null; targetSampleIds: readonly SampleId[]; depth: number; lengthSeconds: number; curve: PumpCurve }

interface ActiveVoice {
  source: AudioBufferSourceNode
  gain: GainNode
  cleanedUp: boolean
}

export class AudioEngine {
  private context: AudioContext | undefined
  private masterGain: GainNode | undefined
  private padGains = new Map<SampleId, GainNode>()
  private pumpConfig: PumpConfig = { sourceSampleId: null, targetSampleIds: [], depth: 0, lengthSeconds: 0.2, curve: 'smooth' }
  private samples = new Map<SampleId, AudioBuffer>()
  private activeVoices = new Set<ActiveVoice>()
  private status: AudioEngineStatus = 'inactive'

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

  async loadSample(sampleId: SampleId, file: File): Promise<LoadedSampleInfo> {
    if (this.status !== 'ready' || !this.context) {
      throw new Error('Start audio before loading a sample.')
    }

    if (!this.isWavFile(file)) {
      throw new Error('Select a WAV file.')
    }

    try {
      const audioData = await file.arrayBuffer()
      const decodedBuffer = await this.context.decodeAudioData(audioData)

      this.samples.set(sampleId, decodedBuffer)
      return {
        filename: file.name,
        durationSeconds: decodedBuffer.duration,
      }
    } catch (error) {
      throw this.toError(error, `Could not decode “${file.name}” as WAV audio.`)
    }
  }

  hasSample(sampleId: SampleId): boolean {
    return this.samples.has(sampleId)
  }

  removeSample(sampleId: SampleId): boolean {
    return this.samples.delete(sampleId)
  }

  setPumpConfig(config: PumpConfig): void { this.pumpConfig = config }

  triggerSample(sampleId: SampleId, options: TriggerSampleOptions = {}): void {
    if (!this.context) {
      return
    }

    this.scheduleSample(sampleId, this.context.currentTime, options)
  }

  scheduleSample(sampleId: SampleId, when: number, options: TriggerSampleOptions = {}): void {
    const sampleBuffer = this.samples.get(sampleId)

    if (this.status !== 'ready' || !this.context || !this.masterGain || !sampleBuffer) {
      return
    }

    const source = this.context.createBufferSource()
    const gain = this.context.createGain()
    const voice: ActiveVoice = { source, gain, cleanedUp: false }
    source.buffer = sampleBuffer
    gain.gain.setValueAtTime(this.toGain(options.gain), when)
    source.playbackRate.setValueAtTime(this.toPlaybackRate(options.pitchSemitones), when)
    source.connect(gain)
    gain.connect(this.getPadGain(sampleId))
    source.addEventListener('ended', () => this.cleanUpVoice(voice), { once: true })

    this.activeVoices.add(voice)
    if (sampleId === this.pumpConfig.sourceSampleId) this.triggerPump(when)
    source.start(when)
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
    for (const padGain of this.padGains.values()) padGain.disconnect()
    this.padGains.clear()
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

  private getPadGain(sampleId: SampleId): GainNode {
    const existing = this.padGains.get(sampleId)
    if (existing) return existing
    const padGain = this.context!.createGain()
    padGain.gain.setValueAtTime(1, this.context!.currentTime)
    padGain.connect(this.masterGain!)
    this.padGains.set(sampleId, padGain)
    return padGain
  }

  private triggerPump(when: number): void {
    const { depth, lengthSeconds, curve, targetSampleIds } = this.pumpConfig
    for (const sampleId of targetSampleIds) {
      if (sampleId === this.pumpConfig.sourceSampleId) continue
      const gain = this.getPadGain(sampleId).gain
      const low = Math.max(0, 1 - depth)
      gain.cancelScheduledValues(when)
      gain.setValueAtTime(gain.value, when)
      gain.linearRampToValueAtTime(low, when + 0.005)
      if (curve === 'snap') gain.setValueAtTime(1, when + lengthSeconds)
      else if (curve === 'smooth') gain.exponentialRampToValueAtTime(1, when + lengthSeconds)
      else gain.linearRampToValueAtTime(1, when + lengthSeconds)
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
    return typeof gain === 'number' && Number.isFinite(gain) ? Math.max(0, gain) : 1
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

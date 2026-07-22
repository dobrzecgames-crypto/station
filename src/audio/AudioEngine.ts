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

interface ActiveVoice {
  source: AudioBufferSourceNode
  gain: GainNode
  cleanedUp: boolean
}

export class AudioEngine {
  private context: AudioContext | undefined
  private masterGain: GainNode | undefined
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

  triggerSample(sampleId: SampleId, options: TriggerSampleOptions = {}): void {
    const sampleBuffer = this.samples.get(sampleId)

    if (this.status !== 'ready' || !this.context || !this.masterGain || !sampleBuffer) {
      return
    }

    const source = this.context.createBufferSource()
    const gain = this.context.createGain()
    const voice: ActiveVoice = { source, gain, cleanedUp: false }
    const now = this.context.currentTime

    source.buffer = sampleBuffer
    gain.gain.setValueAtTime(this.toGain(options.gain), now)
    source.playbackRate.setValueAtTime(this.toPlaybackRate(options.pitchSemitones), now)
    source.connect(gain)
    gain.connect(this.masterGain)
    source.addEventListener('ended', () => this.cleanUpVoice(voice), { once: true })

    this.activeVoices.add(voice)
    source.start(now)
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

  dispose(): void {
    this.stopAll()
    this.samples.clear()
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

export type AudioEngineStatus = 'inactive' | 'starting' | 'ready' | 'error'

export interface LoadedSampleInfo {
  filename: string
  durationSeconds: number
}

export class AudioEngine {
  private context: AudioContext | undefined
  private sampleBuffer: AudioBuffer | undefined
  private activeSources = new Set<AudioBufferSourceNode>()
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

  async loadSample(file: File): Promise<LoadedSampleInfo> {
    if (this.status !== 'ready' || !this.context) {
      throw new Error('Start audio before loading a sample.')
    }

    if (!this.isWavFile(file)) {
      throw new Error('Select a WAV file.')
    }

    try {
      const audioData = await file.arrayBuffer()
      const decodedBuffer = await this.context.decodeAudioData(audioData)

      this.sampleBuffer = decodedBuffer
      return {
        filename: file.name,
        durationSeconds: decodedBuffer.duration,
      }
    } catch (error) {
      throw this.toError(error, `Could not decode “${file.name}” as WAV audio.`)
    }
  }

  triggerSample(): void {
    if (this.status !== 'ready' || !this.context || !this.sampleBuffer) {
      return
    }

    const source = this.context.createBufferSource()
    const gain = this.context.createGain()
    source.buffer = this.sampleBuffer
    source.connect(gain)
    gain.connect(this.context.destination)

    const cleanUp = () => {
      this.activeSources.delete(source)
      source.disconnect()
      gain.disconnect()
    }

    source.addEventListener('ended', cleanUp, { once: true })
    this.activeSources.add(source)
    source.start(this.context.currentTime)
  }

  dispose(): void {
    for (const source of this.activeSources) {
      try {
        source.stop()
      } catch {
        // A source may already have ended before cleanup runs.
      }
      source.disconnect()
    }
    this.activeSources.clear()
    this.sampleBuffer = undefined

    if (this.context && this.context.state !== 'closed') {
      void this.context.close()
    }
    this.context = undefined
    this.status = 'inactive'
  }

  private isWavFile(file: File): boolean {
    return file.type === 'audio/wav' || file.type === 'audio/x-wav' || /\.wav$/i.test(file.name)
  }

  private toError(error: unknown, fallbackMessage: string): Error {
    if (error instanceof Error && error.message) {
      return new Error(`${fallbackMessage} ${error.message}`)
    }

    return new Error(fallbackMessage)
  }
}

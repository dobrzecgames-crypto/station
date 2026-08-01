export interface MicrophoneRecorderOptions {
  onLevel: (level: number) => void
}

const microphoneMimeTypes = [
  'audio/webm;codecs=opus',
  'audio/mp4',
  'audio/ogg;codecs=opus',
] as const

export const maximumMicrophoneRecordingSeconds = 120

export function chooseMicrophoneMimeType(isSupported: (mimeType: string) => boolean): string | undefined {
  return microphoneMimeTypes.find(isSupported)
}

export function createMicrophoneFilename(now: Date = new Date()): string {
  const date = [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((part, index) => String(part).padStart(index === 0 ? 4 : 2, '0')).join('')
  const time = [now.getHours(), now.getMinutes(), now.getSeconds()].map((part) => String(part).padStart(2, '0')).join('')
  return `MIC-${date}-${time}.wav`
}

/**
 * Owns the browser microphone stream, recorder and the analyser used only for
 * the presentation meter. React receives level snapshots and the final Blob;
 * it never owns MediaStream or AudioNode instances.
 */
export class MicrophoneRecorder {
  private readonly context: AudioContext
  private mediaRecorder: MediaRecorder | null = null
  private stream: MediaStream | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private analyser: AnalyserNode | null = null
  private silentOutput: GainNode | null = null
  private meterFrame: number | null = null
  private meterSamples: Float32Array<ArrayBuffer> | null = null
  private chunks: BlobPart[] = []
  private onLevel: ((level: number) => void) | null = null

  constructor(context: AudioContext) {
    this.context = context
  }

  get active(): boolean {
    return this.mediaRecorder?.state === 'recording'
  }

  async start({ onLevel }: MicrophoneRecorderOptions): Promise<void> {
    if (this.mediaRecorder) throw new Error('Microphone recording is already active.')
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      throw new Error('Microphone recording is not supported in this browser.')
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: { ideal: 1 },
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })
      this.stream = stream
      const mimeType = chooseMicrophoneMimeType((candidate) => MediaRecorder.isTypeSupported(candidate))
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      const source = this.context.createMediaStreamSource(stream)
      const analyser = this.context.createAnalyser()
      const silentOutput = this.context.createGain()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.65
      silentOutput.gain.value = 0
      source.connect(analyser)
      analyser.connect(silentOutput)
      silentOutput.connect(this.context.destination)

      this.mediaRecorder = recorder
      this.source = source
      this.analyser = analyser
      this.silentOutput = silentOutput
      this.meterSamples = new Float32Array(analyser.fftSize)
      this.onLevel = onLevel
      this.chunks = []
      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) this.chunks.push(event.data)
      })
      recorder.start(250)
      this.updateMeter()
    } catch (error) {
      this.cleanUp()
      throw microphoneError(error)
    }
  }

  stop(): Promise<Blob> {
    const recorder = this.mediaRecorder
    if (!recorder || recorder.state !== 'recording') return Promise.reject(new Error('Microphone recording is not active.'))

    return new Promise<Blob>((resolve, reject) => {
      const finish = () => {
        const blob = new Blob(this.chunks, { type: recorder.mimeType || 'application/octet-stream' })
        this.cleanUp()
        if (blob.size === 0) reject(new Error('The microphone recording was empty.'))
        else resolve(blob)
      }
      const fail = () => {
        this.cleanUp()
        reject(new Error('Microphone recording was interrupted.'))
      }
      recorder.addEventListener('stop', finish, { once: true })
      recorder.addEventListener('error', fail, { once: true })
      recorder.stop()
    })
  }

  cancel(): void {
    const recorder = this.mediaRecorder
    if (recorder?.state === 'recording') {
      recorder.addEventListener('dataavailable', () => undefined, { once: true })
      try { recorder.stop() } catch { /* The recorder may already be ending. */ }
    }
    this.cleanUp()
  }

  private updateMeter(): void {
    const analyser = this.analyser
    const samples = this.meterSamples
    if (!analyser || !samples) return
    analyser.getFloatTimeDomainData(samples)
    let sum = 0
    for (const sample of samples) sum += sample * sample
    const rms = Math.sqrt(sum / samples.length)
    this.onLevel?.(Math.min(1, rms * 5))
    this.meterFrame = window.requestAnimationFrame(() => this.updateMeter())
  }

  private cleanUp(): void {
    if (this.meterFrame !== null) window.cancelAnimationFrame(this.meterFrame)
    this.meterFrame = null
    this.meterSamples = null
    this.onLevel?.(0)
    this.onLevel = null
    this.source?.disconnect()
    this.analyser?.disconnect()
    this.silentOutput?.disconnect()
    for (const track of this.stream?.getTracks() ?? []) track.stop()
    this.mediaRecorder = null
    this.stream = null
    this.source = null
    this.analyser = null
    this.silentOutput = null
    this.chunks = []
  }
}

function microphoneError(error: unknown): Error {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') return new Error('Microphone access was denied. Allow it in the browser and try again.')
    if (error.name === 'NotFoundError') return new Error('No microphone was found on this device.')
    if (error.name === 'NotReadableError' || error.name === 'AbortError') return new Error('The microphone is busy or unavailable.')
  }
  return error instanceof Error ? error : new Error('Unable to start microphone recording.')
}

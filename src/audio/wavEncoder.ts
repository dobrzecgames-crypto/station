const bitsPerSample = 16
const bytesPerSample = bitsPerSample / 8
const headerBytes = 44
const pcmFormatTag = 1

export interface WavEncodeOptions {
  /** Skips leading frames, used to drop a render's silent processing latency. */
  startFrame?: number
  /**
   * Stops before this frame. Together with startFrame this exports a raw
   * source region without rendering or copying it into a second AudioBuffer.
   */
  endFrame?: number
  /**
   * Linear scale applied while quantising. A render that passed full scale is
   * brought under it by one multiplication — no dynamics, no colour, and no
   * second copy of the buffer.
   */
  gain?: number
}

/**
 * Writes a rendered buffer as 16-bit PCM at the buffer's own sample rate. The
 * depth is a deliberate choice: the material is imported WAV files plus gain
 * and effects, quantisation noise sits near -96 dBFS, and half-size files
 * matter on a phone. See `docs/DECISIONS.md`.
 */
export function encodeWav(buffer: AudioBuffer, { startFrame = 0, endFrame = buffer.length, gain = 1 }: WavEncodeOptions = {}): Blob {
  const channelCount = buffer.numberOfChannels
  const firstFrame = Math.min(Math.max(0, Math.floor(startFrame)), buffer.length)
  const lastFrame = Math.min(buffer.length, Math.max(firstFrame, Math.floor(endFrame)))
  const frameCount = lastFrame - firstFrame
  const dataBytes = frameCount * channelCount * bytesPerSample
  const arrayBuffer = new ArrayBuffer(headerBytes + dataBytes)
  const view = new DataView(arrayBuffer)

  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, headerBytes - 8 + dataBytes, true)
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, pcmFormatTag, true)
  view.setUint16(22, channelCount, true)
  view.setUint32(24, buffer.sampleRate, true)
  view.setUint32(28, buffer.sampleRate * channelCount * bytesPerSample, true)
  view.setUint16(32, channelCount * bytesPerSample, true)
  view.setUint16(34, bitsPerSample, true)
  writeAscii(view, 36, 'data')
  view.setUint32(40, dataBytes, true)

  const channels = Array.from({ length: channelCount }, (_unused, index) => buffer.getChannelData(index))
  let offset = headerBytes
  for (let frame = firstFrame; frame < lastFrame; frame += 1) {
    for (const channel of channels) {
      view.setInt16(offset, toPcm16(channel[frame] * gain), true)
      offset += bytesPerSample
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' })
}

/**
 * The render graph is float and can pass full scale; PCM cannot. Clamping makes
 * an over-hot mix distort the way the live output already distorts it instead
 * of wrapping around into noise.
 */
function toPcm16(sample: number): number {
  const clamped = Math.max(-1, Math.min(1, sample))
  return Math.round(clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff)
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index))
}

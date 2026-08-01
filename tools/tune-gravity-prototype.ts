import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { noteNames, scaleIds } from '../src/music/scales.ts'
import type { NoteName, ScaleId } from '../src/music/scales.ts'
import { analyzePitch, processTuneGravityOffline } from '../src/audio/tuneGravity/index.ts'

interface WavData {
  samples: Float32Array
  sampleRate: number
  channels: number
}

interface CliOptions {
  inputPath: string
  outputPrefix: string
  key: NoteName
  scale: ScaleId
  gravity: number
  speed: number
  humanize: number
}

const options = parseArguments(process.argv.slice(2))
const input = decodeWav(await readFile(options.inputPath))
const durationSeconds = input.samples.length / input.sampleRate

const yinStarted = performance.now()
const yinFrames = analyzePitch(input.samples, input.sampleRate, { detector: 'yin' })
const yinAnalysisMs = performance.now() - yinStarted
const mpmStarted = performance.now()
const mpmFrames = analyzePitch(input.samples, input.sampleRate, { detector: 'mpm' })
const mpmAnalysisMs = performance.now() - mpmStarted

const common = {
  projectKey: { root: options.key, scale: options.scale },
  parameters: { gravity: options.gravity, speed: options.speed, humanize: options.humanize },
} as const

const psolaStarted = performance.now()
const psola = processTuneGravityOffline(input.samples, input.sampleRate, { ...common, detector: 'yin', shifter: 'tdPsola' })
const psolaMs = performance.now() - psolaStarted
const granularStarted = performance.now()
const granular = processTuneGravityOffline(input.samples, input.sampleRate, { ...common, detector: 'yin', shifter: 'granular' })
const granularMs = performance.now() - granularStarted

const psolaPath = resolve(`${options.outputPrefix}-td-psola.wav`)
const granularPath = resolve(`${options.outputPrefix}-granular.wav`)
const reportPath = resolve(`${options.outputPrefix}-report.json`)
await writeFile(psolaPath, encodeMonoPcm16Wav(psola.output, input.sampleRate))
await writeFile(granularPath, encodeMonoPcm16Wav(granular.output, input.sampleRate))

const report = {
  status: 'prototype-only-not-listening-accepted',
  input: {
    path: resolve(options.inputPath),
    durationSeconds,
    sampleRate: input.sampleRate,
    sourceChannelsDownmixedToMono: input.channels,
  },
  key: common.projectKey,
  parameters: common.parameters,
  detectors: {
    yin: summarizePitch(yinFrames, yinAnalysisMs, durationSeconds),
    mpm: summarizePitch(mpmFrames, mpmAnalysisMs, durationSeconds),
    voicedAgreement: detectorAgreement(yinFrames, mpmFrames),
  },
  shifters: {
    tdPsola: summarizeProcessing(psolaMs, durationSeconds, psola.algorithmicLookaheadSamples, input.sampleRate, psolaPath),
    granularBaseline: summarizeProcessing(granularMs, durationSeconds, granular.algorithmicLookaheadSamples, input.sampleRate, granularPath),
  },
  requiredManualEvaluation: [
    'Listen for octave errors, note chatter and consonant/breath artifacts.',
    'Compare formant identity and syllable clarity between TD-PSOLA and the granular baseline.',
    'Do not accept the effect from these numerical diagnostics alone.',
  ],
}
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
process.stdout.write(`${JSON.stringify({ psolaPath, granularPath, reportPath }, null, 2)}\n`)

function parseArguments(args: string[]): CliOptions {
  const positional = args.filter((argument) => !argument.startsWith('--'))
  if (positional.length < 2) {
    throw new Error('Usage: pnpm tune-gravity:prototype <input.wav> <output-prefix> [--key=A] [--scale=naturalMinor] [--gravity=0.65] [--speed=0.55] [--humanize=0.5]')
  }
  const flags = new Map(args.filter((argument) => argument.startsWith('--')).map((argument) => {
    const separator = argument.indexOf('=')
    return separator < 0 ? [argument.slice(2), ''] : [argument.slice(2, separator), argument.slice(separator + 1)]
  }))
  const key = flags.get('key') ?? 'C'
  const scale = flags.get('scale') ?? 'naturalMinor'
  if (!noteNames.includes(key as NoteName)) throw new Error(`Unknown project key: ${key}`)
  if (!scaleIds.includes(scale as ScaleId)) throw new Error(`Unknown project scale: ${scale}`)
  return {
    inputPath: resolve(positional[0]!),
    outputPrefix: resolve(positional[1]!),
    key: key as NoteName,
    scale: scale as ScaleId,
    gravity: boundedFlag(flags, 'gravity', 0.65),
    speed: boundedFlag(flags, 'speed', 0.55),
    humanize: boundedFlag(flags, 'humanize', 0.5),
  }
}

function boundedFlag(flags: ReadonlyMap<string, string>, name: string, fallback: number): number {
  const raw = flags.get(name)
  if (raw === undefined) return fallback
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`--${name} must be between 0 and 1.`)
  return value
}

function decodeWav(buffer: Buffer): WavData {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') throw new Error('Prototype input must be a RIFF/WAVE file.')
  let formatOffset = -1
  let formatSize = 0
  let dataOffset = -1
  let dataSize = 0
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const id = buffer.toString('ascii', offset, offset + 4)
    const size = buffer.readUInt32LE(offset + 4)
    const body = offset + 8
    if (id === 'fmt ') { formatOffset = body; formatSize = size }
    if (id === 'data') { dataOffset = body; dataSize = Math.min(size, buffer.length - body) }
    offset = body + size + (size % 2)
  }
  if (formatOffset < 0 || formatSize < 16 || dataOffset < 0) throw new Error('WAV is missing fmt or data chunks.')
  const format = buffer.readUInt16LE(formatOffset)
  const channels = buffer.readUInt16LE(formatOffset + 2)
  const sampleRate = buffer.readUInt32LE(formatOffset + 4)
  const bitsPerSample = buffer.readUInt16LE(formatOffset + 14)
  if (channels < 1 || sampleRate < 8000) throw new Error('WAV channel count or sample rate is invalid.')
  if (!((format === 1 && bitsPerSample === 16) || (format === 3 && bitsPerSample === 32))) throw new Error('Prototype currently accepts PCM16 or Float32 WAV files.')
  const bytesPerSample = bitsPerSample / 8
  const frameCount = Math.floor(dataSize / bytesPerSample / channels)
  const samples = new Float32Array(frameCount)
  for (let frame = 0; frame < frameCount; frame += 1) {
    let sum = 0
    for (let channel = 0; channel < channels; channel += 1) {
      const offset = dataOffset + (frame * channels + channel) * bytesPerSample
      sum += format === 1 ? buffer.readInt16LE(offset) / 32768 : buffer.readFloatLE(offset)
    }
    samples[frame] = sum / channels
  }
  return { samples, sampleRate, channels }
}

function encodeMonoPcm16Wav(samples: Float32Array, sampleRate: number): Buffer {
  const output = Buffer.alloc(44 + samples.length * 2)
  output.write('RIFF', 0)
  output.writeUInt32LE(output.length - 8, 4)
  output.write('WAVE', 8)
  output.write('fmt ', 12)
  output.writeUInt32LE(16, 16)
  output.writeUInt16LE(1, 20)
  output.writeUInt16LE(1, 22)
  output.writeUInt32LE(sampleRate, 24)
  output.writeUInt32LE(sampleRate * 2, 28)
  output.writeUInt16LE(2, 32)
  output.writeUInt16LE(16, 34)
  output.write('data', 36)
  output.writeUInt32LE(samples.length * 2, 40)
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.min(1, Math.max(-1, samples[index]!))
    output.writeInt16LE(Math.round(sample < 0 ? sample * 32768 : sample * 32767), 44 + index * 2)
  }
  return output
}

function summarizePitch(frames: ReturnType<typeof analyzePitch>, elapsedMs: number, durationSeconds: number): object {
  const voiced = frames.filter((frame) => frame.voiced)
  return {
    frameCount: frames.length,
    voicedFrameFraction: frames.length > 0 ? voiced.length / frames.length : 0,
    medianConfidence: median(voiced.map((frame) => frame.confidence)),
    medianFrequencyHz: median(voiced.flatMap((frame) => frame.frequencyHz === null ? [] : [frame.frequencyHz])),
    elapsedMs,
    realtimeFactor: elapsedMs / 1000 / Math.max(durationSeconds, 1e-9),
  }
}

function summarizeProcessing(elapsedMs: number, durationSeconds: number, lookaheadSamples: number, sampleRate: number, outputPath: string): object {
  return {
    outputPath,
    elapsedMs,
    realtimeFactor: elapsedMs / 1000 / Math.max(durationSeconds, 1e-9),
    estimatedRealtimeLookaheadMs: lookaheadSamples / sampleRate * 1000,
  }
}

function detectorAgreement(first: ReturnType<typeof analyzePitch>, second: ReturnType<typeof analyzePitch>): number {
  const count = Math.min(first.length, second.length)
  if (count === 0) return 1
  let matches = 0
  for (let index = 0; index < count; index += 1) if (first[index]!.voiced === second[index]!.voiced) matches += 1
  return matches / count
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((first, second) => first - second)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!
}

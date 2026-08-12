import { generatePolyWavetable, polyWavetableMipHarmonics } from './polyWavetables'
import { clampPolyPatch, polyLfoFrequencyHz, polyModulationDestinationDepth } from './polyOperations'
import { polyModDestinations, polyModSources } from './polyTypes'
import type { GeneratedPolyWavetable } from './polyWavetables'
import type { PolyEnvelopeState, PolyLfoState, PolyPatch } from './polyTypes'

declare const sampleRate: number
declare const currentFrame: number
declare class AudioWorkletProcessor {
  readonly port: MessagePort
  constructor(options?: AudioWorkletNodeOptions)
}
declare function registerProcessor(name: string, processorCtor: typeof AudioWorkletProcessor): void

interface VoiceOptions {
  patch: PolyPatch
  midiNote: number
  velocity: number
  bpm: number
  startTime: number
  noteOffTime?: number
  serial: number
}

interface CompiledRoute { source: number; destination: number; amount: number }

class StationPolyVoiceProcessor extends AudioWorkletProcessor {
  private patch: PolyPatch
  private table1: GeneratedPolyWavetable
  private table2: GeneratedPolyWavetable
  private readonly midiNote: number
  private readonly velocity: number
  private bpm: number
  private readonly startTime: number
  private releaseTime = Infinity
  private releaseOverride?: number
  private ended = false
  private readonly serial: number
  private readonly phase1 = new Float64Array(8)
  private readonly phase2 = new Float64Array(8)
  private lfo1Phase = 0
  private lfo2Phase = 0
  private lfo1Hold = 0
  private lfo2Hold = 0
  private lfo1Cycle = -1
  private lfo2Cycle = -1
  private routes: CompiledRoute[] = []
  private readonly sourceValues = new Float64Array(polyModSources.length)
  private readonly destinationValues = new Float64Array(polyModDestinations.length)
  private readonly osc1Out = new Float64Array(3)
  private readonly osc2Out = new Float64Array(3)
  private readonly smoothed = new Float64Array(8)
  private readonly filter1L = new SvfState()
  private readonly filter1R = new SvfState()
  private readonly filter2L = new SvfState()
  private readonly filter2R = new SvfState()

  constructor(options?: AudioWorkletNodeOptions) {
    super(options)
    const voice = options?.processorOptions as VoiceOptions
    this.patch = clampPolyPatch(voice.patch)
    this.table1 = generatePolyWavetable(this.patch.oscillator1.tableId)
    this.table2 = generatePolyWavetable(this.patch.oscillator2.tableId)
    this.midiNote = voice.midiNote
    this.velocity = clamp(voice.velocity, 0, 1)
    this.bpm = voice.bpm
    this.startTime = voice.startTime
    this.releaseTime = voice.noteOffTime ?? Infinity
    this.serial = voice.serial
    this.seedPhases()
    this.compileRoutes()
    this.smoothed[0] = this.patch.oscillator1.position
    this.smoothed[1] = this.patch.oscillator2.position
    this.smoothed[2] = this.patch.oscillatorMix
    this.smoothed[3] = this.patch.fmAmount
    this.smoothed[4] = this.patch.filter.cutoffHz
    this.smoothed[5] = this.patch.filter.resonance
    this.smoothed[6] = this.patch.filter.drive
    this.smoothed[7] = this.patch.pan
    this.port.onmessage = (event: MessageEvent) => this.receive(event.data)
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const output = outputs[0]
    const left = output?.[0]
    const right = output?.[1] ?? left
    if (!left || !right || this.ended) return false
    const blockStart = currentFrame / sampleRate
    const smoothing = 1 - Math.exp(-1 / (sampleRate * .012))
    for (let index = 0; index < left.length; index += 1) {
      const time = blockStart + index / sampleRate
      if (time < this.startTime) { left[index] = 0; right[index] = 0; continue }
      const elapsed = time - this.startTime
      const ampEnvelope = envelopeValue(this.patch.ampEnvelope, elapsed, time, this.releaseTime, this.releaseOverride)
      if (ampEnvelope <= 1e-5 && time > this.releaseTime) {
        left[index] = 0; right[index] = 0; this.finish(); continue
      }
      const filterEnvelope = envelopeValue(this.patch.filterEnvelope, elapsed, time, this.releaseTime)
      const modEnvelope = envelopeValue(this.patch.modEnvelope, elapsed, time, this.releaseTime)
      this.fillModulation(elapsed, modEnvelope)
      const position1 = this.smooth(0, clamp(this.patch.oscillator1.position + this.destination('osc1Position'), 0, 1), smoothing)
      const position2 = this.smooth(1, clamp(this.patch.oscillator2.position + this.destination('osc2Position'), 0, 1), smoothing)
      const mix = this.smooth(2, clamp(this.patch.oscillatorMix + this.destination('oscMix'), 0, 1), smoothing)
      const fmAmount = this.smooth(3, clamp(this.patch.fmAmount + this.destination('fmAmount'), 0, 1), smoothing)
      const widthMod = this.destination('width')
      const detuneMod = this.destination('unisonDetune')
      const frequency2 = midiFrequency(this.midiNote + this.patch.oscillator2.octave * 12 + this.patch.oscillator2.semitone + (this.patch.oscillator2.fineCents + this.destination('osc2Fine') + this.destination('osc2Pitch')) / 100)
      this.renderOscillator(this.patch.oscillator2, this.table2, this.phase2, frequency2, position2, widthMod, detuneMod, 0, this.osc2Out)
      const frequency1 = midiFrequency(this.midiNote + this.patch.oscillator1.octave * 12 + this.patch.oscillator1.semitone + (this.patch.oscillator1.fineCents + this.destination('osc1Fine') + this.destination('osc1Pitch')) / 100)
      this.renderOscillator(this.patch.oscillator1, this.table1, this.phase1, frequency1, position1, widthMod, detuneMod, this.osc2Out[2] * fmAmount * frequency1 * .42, this.osc1Out)
      const gain1 = Math.cos(mix * Math.PI * .5) * this.patch.oscillator1.level
      const gain2 = Math.sin(mix * Math.PI * .5) * this.patch.oscillator2.level
      let sampleL = this.osc1Out[0] * gain1 + this.osc2Out[0] * gain2
      let sampleR = this.osc1Out[1] * gain1 + this.osc2Out[1] * gain2
      const drive = this.smooth(6, clamp(this.patch.filter.drive + this.destination('filterDrive'), 0, 1), smoothing)
      const driveGain = 1 + drive * 5
      const driveNorm = Math.tanh(driveGain)
      sampleL = Math.tanh(sampleL * driveGain) / driveNorm
      sampleR = Math.tanh(sampleR * driveGain) / driveNorm
      const cutoffSemitones = this.patch.filter.envelopeAmountSemitones * filterEnvelope + this.destination('filterEnvAmount') * filterEnvelope + this.destination('filterCutoff') + (this.midiNote - 60) * this.patch.filter.keytrack
      const cutoffTarget = clamp(this.patch.filter.cutoffHz * 2 ** (cutoffSemitones / 12), 20, sampleRate * .45)
      const cutoff = this.smooth(4, cutoffTarget, smoothing)
      const resonance = this.smooth(5, clamp(this.patch.filter.resonance + this.destination('filterResonance'), .5, 20), smoothing)
      sampleL = filterSample(this.patch.filter.mode, sampleL, cutoff, resonance, this.filter1L, this.filter2L)
      sampleR = filterSample(this.patch.filter.mode, sampleR, cutoff, resonance, this.filter1R, this.filter2R)
      const ampMod = clamp(1 + this.destination('ampLevel'), 0, 2)
      const level = this.patch.level * (.35 + this.velocity * .65) * ampEnvelope * ampMod * .18 / (1 + drive * .22)
      const pan = this.smooth(7, clamp(this.patch.pan + this.destination('pan'), -1, 1), smoothing)
      left[index] = sampleL * level * Math.cos((pan + 1) * Math.PI * .25) * Math.SQRT2
      right[index] = sampleR * level * Math.sin((pan + 1) * Math.PI * .25) * Math.SQRT2
    }
    return !this.ended
  }

  private receive(message: { type?: string; patch?: PolyPatch; bpm?: number; when?: number; releaseSeconds?: number }): void {
    if (message.type === 'patch' && message.patch) {
      const previous1 = this.patch.oscillator1.tableId
      const previous2 = this.patch.oscillator2.tableId
      this.patch = clampPolyPatch(message.patch)
      if (previous1 !== this.patch.oscillator1.tableId) this.table1 = generatePolyWavetable(this.patch.oscillator1.tableId)
      if (previous2 !== this.patch.oscillator2.tableId) this.table2 = generatePolyWavetable(this.patch.oscillator2.tableId)
      if (Number.isFinite(message.bpm)) this.bpm = message.bpm!
      this.compileRoutes()
    } else if (message.type === 'bpm' && Number.isFinite(message.bpm)) this.bpm = message.bpm!
    else if (message.type === 'release') {
      this.releaseTime = Math.min(this.releaseTime, Math.max(this.startTime, message.when ?? currentFrame / sampleRate))
      this.releaseOverride = message.releaseSeconds
    } else if (message.type === 'stop') this.finish()
  }

  private fillModulation(elapsed: number, modEnvelope: number): void {
    const lfo2Frequency = this.lfoFrequency(this.patch.lfo2)
    const lfo2 = this.lfoValue(this.patch.lfo2, elapsed, lfo2Frequency, false)
    this.sourceValues[1] = lfo2
    this.sourceValues[2] = modEnvelope
    this.sourceValues[3] = this.velocity
    this.sourceValues[4] = clamp((this.midiNote - 60) / 48, -1, 1)
    this.destinationValues.fill(0)
    for (const route of this.routes) this.destinationValues[route.destination] += route.amount * this.sourceValues[route.source]
    const rateMod = clamp(this.destination('lfo1Rate'), -4, 4)
    const lfo1Frequency = this.lfoFrequency(this.patch.lfo1) * 2 ** rateMod
    this.sourceValues[0] = this.lfoValue(this.patch.lfo1, elapsed, lfo1Frequency, true)
    this.destinationValues.fill(0)
    for (const route of this.routes) this.destinationValues[route.destination] += route.amount * this.sourceValues[route.source]
  }

  private lfoFrequency(lfo: PolyLfoState): number { return lfo.mode === 'sync' ? polyLfoFrequencyHz(lfo.division, this.bpm) : clamp(lfo.rateHz, .01, 30) }

  private lfoValue(lfo: PolyLfoState, elapsed: number, frequency: number, first: boolean): number {
    const phaseIncrement = frequency / sampleRate
    let phase = first ? this.lfo1Phase : this.lfo2Phase
    if (!lfo.retrigger) phase = ((currentFrame / sampleRate) * frequency + lfo.phase) % 1
    else phase = (phase + phaseIncrement) % 1
    if (first) this.lfo1Phase = phase; else this.lfo2Phase = phase
    let value = 0
    if (lfo.shape === 'sine') value = Math.sin(Math.PI * 2 * phase)
    else if (lfo.shape === 'triangle') value = 1 - 4 * Math.abs(phase - .5)
    else if (lfo.shape === 'saw') value = phase * 2 - 1
    else if (lfo.shape === 'ramp') value = 1 - phase * 2
    else if (lfo.shape === 'square') value = phase < .5 ? 1 : -1
    else {
      const cycle = Math.floor(elapsed * frequency)
      if (first && cycle !== this.lfo1Cycle) { this.lfo1Cycle = cycle; this.lfo1Hold = hashBipolar(this.serial * 97 + cycle * 31 + 1) }
      if (!first && cycle !== this.lfo2Cycle) { this.lfo2Cycle = cycle; this.lfo2Hold = hashBipolar(this.serial * 113 + cycle * 37 + 2) }
      value = first ? this.lfo1Hold : this.lfo2Hold
    }
    return value * (lfo.fadeInSeconds <= 0 ? 1 : clamp(elapsed / lfo.fadeInSeconds, 0, 1))
  }

  private renderOscillator(config: PolyPatch['oscillator1'], table: GeneratedPolyWavetable, phases: Float64Array, frequency: number, position: number, widthMod: number, detuneMod: number, fmHz: number, output: Float64Array): void {
    output.fill(0)
    const count = config.unison
    const width = clamp(config.width + widthMod, 0, 1)
    const detune = clamp(config.detuneCents + detuneMod, 0, 70)
    const normalization = 1 / Math.sqrt(count)
    for (let voice = 0; voice < count; voice += 1) {
      const spread = count === 1 ? 0 : voice / (count - 1) * 2 - 1
      const voiceFrequency = Math.max(1, (frequency + fmHz) * 2 ** (spread * detune / 1200))
      phases[voice] = (phases[voice] + voiceFrequency / sampleRate) % 1
      const sample = sampleBandlimited(table, phases[voice], position, voiceFrequency)
      const pan = spread * width
      output[0] += sample * Math.cos((pan + 1) * Math.PI * .25) * normalization
      output[1] += sample * Math.sin((pan + 1) * Math.PI * .25) * normalization
      output[2] += sample / count
    }
  }

  private destination(name: typeof polyModDestinations[number]): number {
    const index = polyModDestinations.indexOf(name)
    return clamp(this.destinationValues[index], -1, 1) * polyModulationDestinationDepth[name]
  }

  private smooth(index: number, target: number, coefficient: number): number { this.smoothed[index] += (target - this.smoothed[index]) * coefficient; return this.smoothed[index] }
  private compileRoutes(): void { this.routes = this.patch.modulation.map((route) => ({ source: polyModSources.indexOf(route.source), destination: polyModDestinations.indexOf(route.destination), amount: clamp(route.amount, -1, 1) })).filter((route) => route.source >= 0 && route.destination >= 0) }
  private seedPhases(): void { for (let i = 0; i < 8; i += 1) { this.phase1[i] = hash01(this.serial * 41 + i * 17 + 1); this.phase2[i] = hash01(this.serial * 43 + i * 19 + 2) } this.lfo1Phase = this.patch.lfo1.phase; this.lfo2Phase = this.patch.lfo2.phase }
  private finish(): void { if (this.ended) return; this.ended = true; this.port.postMessage({ type: 'ended' }) }
}

class SvfState { ic1 = 0; ic2 = 0 }

function filterSample(mode: PolyPatch['filter']['mode'], input: number, cutoff: number, resonance: number, first: SvfState, second: SvfState): number {
  const firstOut = svf(input, cutoff, resonance, first)
  if (mode === 'LP24') return svf(firstOut[0], cutoff, Math.max(.5, resonance * .72), second)[0]
  if (mode === 'HP12') return firstOut[2]
  if (mode === 'BP12') return firstOut[1]
  if (mode === 'NOTCH') return firstOut[0] + firstOut[2]
  return firstOut[0]
}

const svfOut = new Float64Array(3)
function svf(input: number, cutoff: number, resonance: number, state: SvfState): Float64Array {
  const g = Math.tan(Math.PI * cutoff / sampleRate)
  const r = 1 / (2 * Math.max(.5, resonance))
  const high = (input - (2 * r + g) * state.ic1 - state.ic2) / (1 + 2 * r * g + g * g)
  const band = g * high + state.ic1
  const low = g * band + state.ic2
  state.ic1 = g * high + band
  state.ic2 = g * band + low
  svfOut[0] = low; svfOut[1] = band; svfOut[2] = high
  return svfOut
}

function sampleBandlimited(table: GeneratedPolyWavetable, phase: number, position: number, frequency: number): number {
  const safeHarmonics = Math.max(1, Math.floor(sampleRate * .5 / Math.max(1, frequency)))
  let upperIndex = 0
  for (let index = 0; index < polyWavetableMipHarmonics.length; index += 1) if (polyWavetableMipHarmonics[index] <= safeHarmonics) upperIndex = index
  const lowerIndex = Math.max(0, upperIndex - 1)
  const upperHarmonics = polyWavetableMipHarmonics[upperIndex]
  const blend = upperIndex === 0 ? 1 : clamp(Math.log2(safeHarmonics / upperHarmonics) + 1, 0, 1)
  const lower = sampleLevel(table.levels[lowerIndex].frames, phase, position)
  const upper = sampleLevel(table.levels[upperIndex].frames, phase, position)
  return lower + (upper - lower) * blend
}

function sampleLevel(frames: readonly Float32Array[], phase: number, position: number): number {
  const frameIndex = clamp(position, 0, 1) * (frames.length - 1)
  const firstFrame = Math.floor(frameIndex)
  const secondFrame = Math.min(frames.length - 1, firstFrame + 1)
  const frameMix = frameIndex - firstFrame
  const sampleIndex = phase * frames[0].length
  const firstSample = Math.floor(sampleIndex) % frames[0].length
  const secondSample = (firstSample + 1) % frames[0].length
  const sampleMix = sampleIndex - Math.floor(sampleIndex)
  const a0 = frames[firstFrame][firstSample] + (frames[firstFrame][secondSample] - frames[firstFrame][firstSample]) * sampleMix
  const a1 = frames[secondFrame][firstSample] + (frames[secondFrame][secondSample] - frames[secondFrame][firstSample]) * sampleMix
  return a0 + (a1 - a0) * frameMix
}

function envelopeValue(envelope: PolyEnvelopeState, elapsed: number, absoluteTime: number, releaseTime: number, releaseOverride?: number): number {
  const beforeRelease = adsValue(envelope, Math.min(elapsed, Math.max(0, releaseTime - (absoluteTime - elapsed))))
  if (absoluteTime < releaseTime) return adsValue(envelope, elapsed)
  const release = Math.max(.005, releaseOverride ?? envelope.releaseSeconds)
  const progress = (absoluteTime - releaseTime) / release
  return progress >= 1 ? 0 : beforeRelease * (1 - progress) ** 2
}

function adsValue(envelope: PolyEnvelopeState, elapsed: number): number {
  const attack = Math.max(.0001, envelope.attackSeconds)
  const decay = Math.max(.0001, envelope.decaySeconds)
  if (elapsed < attack) return elapsed / attack
  if (elapsed < attack + decay) return 1 + (envelope.sustain - 1) * ((elapsed - attack) / decay)
  return envelope.sustain
}

function midiFrequency(note: number): number { return 440 * 2 ** ((note - 69) / 12) }
function hash01(value: number): number { const x = Math.sin(value * 12.9898) * 43758.5453; return x - Math.floor(x) }
function hashBipolar(value: number): number { return hash01(value) * 2 - 1 }
function clamp(value: number, minimum: number, maximum: number): number { return Math.min(maximum, Math.max(minimum, value)) }

registerProcessor('station-poly-voice', StationPolyVoiceProcessor)

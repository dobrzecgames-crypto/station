import {
  kickBodyToMainGain,
  kickBodyToSubGain,
  kickClickToGain,
  kickDecayToSeconds,
  kickDriveCompensationGain,
  kickDriveCurve,
  kickDustDurationSeconds,
  kickDustToShape,
  kickPunchToPitchEnvelope,
  kickToneToShape,
  kickTuneToHz,
} from './drumSynthOperations'
import type { DrumKickPatch } from './drumSynthTypes'
import { createSeededRandom } from './seededRandom'

export interface KickVoiceHandle {
  /** Stops every scheduled node at or after `when` and disconnects the graph. Idempotent - safe to call again after the voice has already ended naturally. */
  stop(when?: number): void
}

/**
 * Final safety trim. `kickDriveCurve` always evaluates to exactly +/-1 at its
 * domain edges for any drive amount, and a WaveShaper holds any input beyond
 * [-1, 1] at that boundary sample (a spec guarantee, not a property of this
 * particular curve) - so the signal reaching this trim is already hard-bounded
 * to +/-1 no matter how BODY/CLICK/DUST are set. This constant is what turns
 * that bound into actual headroom, not a second line of defence against it.
 */
const outputHeadroomGain = 0.7
const bodyAmpPeak = 0.7
const bodyAttackSeconds = 0.002
const clickDurationSeconds = 0.015
const dustHighpassHz = 1500
const dustHighpassQ = 1.3

/**
 * Builds and schedules one kick hit against any BaseAudioContext (live or
 * offline) and connects it to `destination`. This is the only place that
 * touches Web Audio nodes for the kick - both live preview (AudioEngine) and
 * the offline bounce (renderKick.ts) call this same function so they can
 * never drift apart in sound.
 */
export function playKickVoice(context: BaseAudioContext, destination: AudioNode, patch: DrumKickPatch, when: number, seed: number, onEnded?: () => void): KickVoiceHandle {
  const tuneHz = kickTuneToHz(patch.tune)
  const pitchEnvelope = kickPunchToPitchEnvelope(patch.punch)
  const decaySeconds = kickDecayToSeconds(patch.decay)
  const tone = kickToneToShape(patch.tone)
  const bodyStartHz = tuneHz * pitchEnvelope.startMultiplier

  // Body: a touch of triangle character (not a pure sine) so TONE's low-pass
  // has real harmonic content to shape across the whole decay, not only
  // during the pitch sweep.
  const body = context.createOscillator()
  body.type = 'triangle'
  body.frequency.setValueAtTime(bodyStartHz, when)
  body.frequency.exponentialRampToValueAtTime(tuneHz, when + pitchEnvelope.dropSeconds)
  const bodyGain = context.createGain()
  bodyGain.gain.value = kickBodyToMainGain(patch.body)

  // Sub: one octave below, kept a pure sine, crossfaded against the body
  // layer via BODY rather than summed outright.
  const sub = context.createOscillator()
  sub.type = 'sine'
  sub.frequency.setValueAtTime(bodyStartHz / 2, when)
  sub.frequency.exponentialRampToValueAtTime(tuneHz / 2, when + pitchEnvelope.dropSeconds)
  const subGain = context.createGain()
  subGain.gain.value = kickBodyToSubGain(patch.body)

  const bodyFilter = context.createBiquadFilter()
  bodyFilter.type = 'lowpass'
  bodyFilter.frequency.value = tone.bodyLowpassHz
  bodyFilter.Q.value = 0.7

  const bodyAmp = context.createGain()
  bodyAmp.gain.setValueAtTime(0.0001, when)
  bodyAmp.gain.exponentialRampToValueAtTime(bodyAmpPeak, when + bodyAttackSeconds)
  bodyAmp.gain.exponentialRampToValueAtTime(0.0001, when + bodyAttackSeconds + decaySeconds)

  const bodyTrim = context.createGain()
  bodyTrim.gain.value = 1 - Math.max(0, tone.bodyClickBalance) * 0.4

  body.connect(bodyGain)
  sub.connect(subGain)
  bodyGain.connect(bodyFilter)
  subGain.connect(bodyFilter)
  bodyFilter.connect(bodyAmp)
  bodyAmp.connect(bodyTrim)

  const sum = context.createGain()
  bodyTrim.connect(sum)

  // Click: a short, independently-enveloped filtered-noise burst. Never tied
  // to DECAY or to a sustained noise source - it is only ever a few
  // milliseconds long, deliberately not reproducible/seeded (see DUST below).
  const clickPeakGain = kickClickToGain(patch.click)
  let click: AudioBufferSourceNode | undefined
  let clickFilter: BiquadFilterNode | undefined
  let clickAmp: GainNode | undefined
  if (clickPeakGain > 0.001) {
    const clickBuffer = context.createBuffer(1, Math.max(1, Math.ceil(context.sampleRate * clickDurationSeconds)), context.sampleRate)
    const clickData = clickBuffer.getChannelData(0)
    for (let index = 0; index < clickData.length; index += 1) clickData[index] = Math.random() * 2 - 1
    click = context.createBufferSource()
    click.buffer = clickBuffer
    clickFilter = context.createBiquadFilter()
    clickFilter.type = 'bandpass'
    clickFilter.frequency.value = tone.clickBandpassHz
    clickFilter.Q.value = tone.clickBandwidthQ
    clickAmp = context.createGain()
    clickAmp.gain.setValueAtTime(clickPeakGain, when)
    clickAmp.gain.exponentialRampToValueAtTime(0.0001, when + clickDurationSeconds)
    const clickTrim = context.createGain()
    clickTrim.gain.value = 1 - Math.max(0, -tone.bodyClickBalance) * 0.4
    click.connect(clickFilter)
    clickFilter.connect(clickAmp)
    clickAmp.connect(clickTrim)
    clickTrim.connect(sum)
  }

  // Dust: only built when audible, so DUST=0 is bit-identical to no dust at
  // all rather than "gain set to zero". The buffer is filled by the seeded
  // PRNG so the algorithm is reproducible given a seed, while each live
  // trigger is free to pick a fresh one (see seededRandom.ts).
  let dustSource: AudioBufferSourceNode | undefined
  let dustFilter: BiquadFilterNode | undefined
  let dustAmp: GainNode | undefined
  let dustDurationSeconds = 0
  if (patch.dust > 0.001) {
    const dust = kickDustToShape(patch.dust)
    const random = createSeededRandom(seed)
    dustDurationSeconds = kickDustDurationSeconds(decaySeconds)
    const dustBuffer = context.createBuffer(1, Math.max(1, Math.ceil(context.sampleRate * dustDurationSeconds)), context.sampleRate)
    const dustData = dustBuffer.getChannelData(0)
    // Surface noise floor: continuous and low-level, with its own gentle taper
    // baked directly into the samples, so it fades with the hit without
    // dragging the crackle layer's prominence down with it (see below).
    for (let index = 0; index < dustData.length; index += 1) {
      const floorEnvelope = 1 - index / dustData.length
      dustData[index] = (random() * 2 - 1) * dust.noiseFloorGain * floorEnvelope
    }
    // Crackle: short, percussive ticks written at full target amplitude
    // wherever they land, deliberately NOT subject to a duration-wide decay -
    // a pop near the end of the window has to read as present as one near the
    // start, the way a run of actual vinyl surface noise does. Each tick gets
    // its own fast exponential decay rather than a linear one, closer to a
    // real needle-in-groove click than a soft-edged blip.
    for (let crackle = 0; crackle < dust.crackleCount; crackle += 1) {
      const crackleLength = 12 + Math.floor(random() * 60)
      const position = Math.floor(random() * Math.max(1, dustData.length - crackleLength))
      const crackleAmplitude = dust.crackleGain * (0.5 + random() * 0.5)
      for (let offset = 0; offset < crackleLength; offset += 1) {
        const tickShape = Math.exp(-(offset / crackleLength) * 5)
        dustData[position + offset] += (random() * 2 - 1) * crackleAmplitude * tickShape
      }
    }
    dustSource = context.createBufferSource()
    dustSource.buffer = dustBuffer
    dustFilter = context.createBiquadFilter()
    dustFilter.type = 'highpass'
    dustFilter.frequency.value = dustHighpassHz
    dustFilter.Q.value = dustHighpassQ
    dustAmp = context.createGain()
    // A flat gain with a click-safe fade at each edge, not a decay - every
    // time-varying shape the layer needs is already baked into the buffer.
    const edgeFadeSeconds = Math.min(0.003, dustDurationSeconds / 4)
    dustAmp.gain.setValueAtTime(0, when)
    dustAmp.gain.linearRampToValueAtTime(dust.outputGain, when + edgeFadeSeconds)
    dustAmp.gain.setValueAtTime(dust.outputGain, when + dustDurationSeconds - edgeFadeSeconds)
    dustAmp.gain.linearRampToValueAtTime(0, when + dustDurationSeconds)
    dustSource.connect(dustFilter)
    dustFilter.connect(dustAmp)
    dustAmp.connect(sum)
  }

  const drive = context.createWaveShaper()
  drive.curve = kickDriveCurve(patch.drive)
  drive.oversample = '2x'
  const outputTrim = context.createGain()
  outputTrim.gain.value = outputHeadroomGain * kickDriveCompensationGain(patch.drive)
  sum.connect(drive)
  drive.connect(outputTrim)
  outputTrim.connect(destination)

  const stopAt = when + bodyAttackSeconds + decaySeconds + 0.05
  const scheduledSources: AudioScheduledSourceNode[] = [body, sub]
  const allNodes: AudioNode[] = [body, bodyGain, sub, subGain, bodyFilter, bodyAmp, bodyTrim, sum, drive, outputTrim]
  if (click && clickFilter && clickAmp) {
    scheduledSources.push(click)
    allNodes.push(click, clickFilter, clickAmp)
    click.start(when)
    click.stop(when + clickDurationSeconds + 0.01)
  }
  if (dustSource && dustFilter && dustAmp) {
    scheduledSources.push(dustSource)
    allNodes.push(dustSource, dustFilter, dustAmp)
    dustSource.start(when)
    dustSource.stop(when + dustDurationSeconds + 0.01)
  }

  let cleanedUp = false
  const cleanUp = () => {
    if (cleanedUp) return
    cleanedUp = true
    for (const node of allNodes) {
      try { node.disconnect() } catch { /* A node fed by a shared upstream may already be disconnected. */ }
    }
    onEnded?.()
  }

  body.addEventListener('ended', cleanUp, { once: true })
  body.start(when)
  sub.start(when)
  body.stop(stopAt)
  sub.stop(stopAt)

  return {
    stop(stopWhen = context.currentTime) {
      for (const source of scheduledSources) {
        try { source.stop(stopWhen) } catch { /* A source may already be stopped or past its natural end. */ }
      }
      cleanUp()
    },
  }
}

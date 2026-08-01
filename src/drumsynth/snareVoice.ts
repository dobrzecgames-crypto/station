import {
  dustDurationSeconds as sharedDustDurationSeconds,
  dustToShape,
  saturatorCurve,
  snareBodyDecayToSeconds,
  snareBodyMutualTrim,
  snareBodyToneRatio,
  snareBodyToShape,
  snareRattleDecayToSeconds,
  snareRattleMutualTrim,
  snareRattleToShape,
  snareSnapToShape,
  snareToneToShape,
  snareTuneLevelCompensation,
  snareTuneToHz,
} from './drumSynthOperations'
import type { DrumSnarePatch, DrumVoiceHandle } from './drumSynthTypes'
import { createSeededRandom } from './seededRandom'

/** Same headroom argument as kickVoice.ts: the internal saturator always clamps to +/-1 at its curve edges regardless of amount, so this is real headroom on a hard-bounded signal, not a guess. */
const outputHeadroomGain = 0.72
/** Fixed, not user-facing (the brief deliberately omits a SNARE DRIVE knob) - "controlled saturation... to give character and bound peaks" without a ninth parameter. */
const internalSaturationAmount = 3.5
const bodyAttackSeconds = 0.0015
const snapDurationSeconds = 0.01
/** Large, distinct offsets so RATTLE/SNAP/DUST draw from independent-looking streams derived from one seed, rather than three generators that happen to start in lockstep. */
const snapSeedOffset = 104729
const dustSeedOffset = 215299
const dustHighpassHz = 1500
const dustHighpassQ = 1.3

/**
 * Builds and schedules one snare hit against any BaseAudioContext (live or
 * offline) and connects it to `destination`, mirroring kickVoice.ts's shape.
 * Renders in stereo (unlike the kick, which stays mono): the tonal body and
 * SNAP sum as mono and up-mix identically to both channels by construction,
 * while RATTLE alone is built from a genuinely 2-channel noise buffer, so it
 * is the only source of width and the mix always stays mono-safe.
 *
 * Determinism note: RATTLE, SNAP and DUST are ALL seeded here, unlike KICK's
 * CLICK, which was deliberately left non-deterministic. The brief requires a
 * placed SNARE to be bit-for-bit reproducible from (patch, seed) - TRIGGER
 * and the ADD TO PAD render must never audibly differ. See docs/DECISIONS.md
 * DEC-025.
 */
export function playSnareVoice(context: BaseAudioContext, destination: AudioNode, patch: DrumSnarePatch, when: number, seed: number, onEnded?: () => void): DrumVoiceHandle {
  const tuneHz = snareTuneToHz(patch.tune)
  const bodyDecaySeconds = snareBodyDecayToSeconds(patch.bodyDecay)
  const rattleDecaySeconds = snareRattleDecayToSeconds(patch.rattleDecay)
  const tone = snareToneToShape(patch.tone)
  const bodyShape = snareBodyToShape(patch.body)
  const snapShape = snareSnapToShape(patch.snap)
  const rattleShape = snareRattleToShape(patch.rattle, patch.tune)

  const sum = context.createGain()

  // --- Tonal body: two oscillators a fixed interval apart (not one pure
  // tone, which would read as a tom/mini-kick) through a short internal
  // saturator for harmonic complexity, then BODY DECAY's own envelope. ---
  const bodyA = context.createOscillator()
  bodyA.type = 'sine'
  bodyA.frequency.setValueAtTime(tuneHz, when)
  const bodyB = context.createOscillator()
  bodyB.type = 'triangle'
  bodyB.frequency.setValueAtTime(tuneHz * snareBodyToneRatio, when)

  const bodyAGain = context.createGain()
  bodyAGain.gain.value = 0.7 + bodyShape.lowToneBias
  const bodyBGain = context.createGain()
  bodyBGain.gain.value = 1 - bodyShape.lowToneBias * 0.5

  const bodySaturator = context.createWaveShaper()
  bodySaturator.curve = saturatorCurve(internalSaturationAmount)
  bodySaturator.oversample = '2x'

  const bodyFilter = context.createBiquadFilter()
  bodyFilter.type = 'lowpass'
  bodyFilter.frequency.value = tone.bodyLowpassHz
  bodyFilter.Q.value = 0.7

  const bodyAmp = context.createGain()
  bodyAmp.gain.setValueAtTime(0.0001, when)
  bodyAmp.gain.exponentialRampToValueAtTime(bodyShape.gain, when + bodyAttackSeconds)
  bodyAmp.gain.exponentialRampToValueAtTime(0.0001, when + bodyAttackSeconds + bodyDecaySeconds)

  const bodyTrim = context.createGain()
  bodyTrim.gain.value = Math.max(0.35, snareBodyMutualTrim(patch.rattle, patch.snap)) * snareTuneLevelCompensation(patch.tune)

  bodyA.connect(bodyAGain)
  bodyB.connect(bodyBGain)
  bodyAGain.connect(bodySaturator)
  bodyBGain.connect(bodySaturator)
  bodySaturator.connect(bodyFilter)
  bodyFilter.connect(bodyAmp)
  bodyAmp.connect(bodyTrim)
  bodyTrim.connect(sum)

  // --- Noise / rattle: the central layer, seeded and genuinely stereo.
  // Broadband (highpass, the "szsz" hiss) and resonant (bandpass, the
  // metallic "spring") components are mixed independently per RATTLE, with a
  // slow seeded gain wobble baked into the buffer so the texture reads as
  // busier/irregular rather than a smooth, static hiss. ---
  const rattleRandom = createSeededRandom(seed)
  const rattleFrameCount = Math.max(1, Math.ceil(context.sampleRate * rattleDecaySeconds))
  const rattleBuffer = context.createBuffer(2, rattleFrameCount, context.sampleRate)
  const wobbleStepFrames = Math.max(1, Math.floor(context.sampleRate * 0.004))
  for (let channel = 0; channel < 2; channel += 1) {
    const data = rattleBuffer.getChannelData(channel)
    let wobble = 1
    for (let index = 0; index < data.length; index += 1) {
      if (index % wobbleStepFrames === 0) wobble = 1 - rattleShape.irregularityDepth * rattleRandom()
      data[index] = (rattleRandom() * 2 - 1) * wobble
    }
  }
  const rattleSource = context.createBufferSource()
  rattleSource.buffer = rattleBuffer

  const rattleBroadband = context.createBiquadFilter()
  rattleBroadband.type = 'highpass'
  rattleBroadband.frequency.value = tone.rattleBrightnessHz
  const rattleBroadbandGain = context.createGain()
  rattleBroadbandGain.gain.value = rattleShape.broadbandGain

  const rattleResonant = context.createBiquadFilter()
  rattleResonant.type = 'bandpass'
  rattleResonant.frequency.value = rattleShape.resonantHz
  rattleResonant.Q.value = rattleShape.resonantQ
  const rattleResonantGain = context.createGain()
  rattleResonantGain.gain.value = rattleShape.resonantGain

  const rattleAmp = context.createGain()
  rattleAmp.gain.setValueAtTime(1, when)
  rattleAmp.gain.exponentialRampToValueAtTime(0.0001, when + rattleDecaySeconds)

  const rattleTrim = context.createGain()
  rattleTrim.gain.value = Math.max(0.4, snareRattleMutualTrim(patch.body))

  rattleSource.connect(rattleBroadband)
  rattleSource.connect(rattleResonant)
  rattleBroadband.connect(rattleBroadbandGain)
  rattleResonant.connect(rattleResonantGain)
  rattleBroadbandGain.connect(rattleAmp)
  rattleResonantGain.connect(rattleAmp)
  rattleAmp.connect(rattleTrim)
  rattleTrim.connect(sum)

  // --- Attack / snap: a short, seeded, wideband impulse fused with RATTLE's
  // own onset - never tied to either DECAY. ---
  const snapShapeGain = snapShape.gain
  let snap: AudioBufferSourceNode | undefined
  let snapFilter: BiquadFilterNode | undefined
  let snapAmp: GainNode | undefined
  if (snapShapeGain > 0.001) {
    const snapRandom = createSeededRandom(seed + snapSeedOffset)
    const snapBuffer = context.createBuffer(1, Math.max(1, Math.ceil(context.sampleRate * snapDurationSeconds)), context.sampleRate)
    const snapData = snapBuffer.getChannelData(0)
    for (let index = 0; index < snapData.length; index += 1) snapData[index] = snapRandom() * 2 - 1
    snap = context.createBufferSource()
    snap.buffer = snapBuffer
    snapFilter = context.createBiquadFilter()
    snapFilter.type = 'bandpass'
    snapFilter.frequency.value = tone.snapBandpassHz
    snapFilter.Q.value = 0.6
    snapAmp = context.createGain()
    snapAmp.gain.setValueAtTime(snapShapeGain, when)
    snapAmp.gain.exponentialRampToValueAtTime(0.0001, when + snapDurationSeconds)
    snap.connect(snapFilter)
    snapFilter.connect(snapAmp)
    snapAmp.connect(sum)
  }

  // --- Dust: identical mechanism to KICK (see kickVoice.ts), own seed,
  // length tied to RATTLE DECAY rather than a kick's single decay. ---
  let dustSource: AudioBufferSourceNode | undefined
  let dustFilter: BiquadFilterNode | undefined
  let dustAmp: GainNode | undefined
  let dustDurationSeconds = 0
  if (patch.dust > 0.001) {
    const dust = dustToShape(patch.dust)
    const dustRandom = createSeededRandom(seed + dustSeedOffset)
    dustDurationSeconds = sharedDustDurationSeconds(rattleDecaySeconds)
    const dustBuffer = context.createBuffer(1, Math.max(1, Math.ceil(context.sampleRate * dustDurationSeconds)), context.sampleRate)
    const dustData = dustBuffer.getChannelData(0)
    for (let index = 0; index < dustData.length; index += 1) {
      const floorEnvelope = 1 - index / dustData.length
      dustData[index] = (dustRandom() * 2 - 1) * dust.noiseFloorGain * floorEnvelope
    }
    for (let crackle = 0; crackle < dust.crackleCount; crackle += 1) {
      const crackleLength = 12 + Math.floor(dustRandom() * 60)
      const position = Math.floor(dustRandom() * Math.max(1, dustData.length - crackleLength))
      const crackleAmplitude = dust.crackleGain * (0.5 + dustRandom() * 0.5)
      for (let offset = 0; offset < crackleLength; offset += 1) {
        const tickShape = Math.exp(-(offset / crackleLength) * 5)
        dustData[position + offset] += (dustRandom() * 2 - 1) * crackleAmplitude * tickShape
      }
    }
    dustSource = context.createBufferSource()
    dustSource.buffer = dustBuffer
    dustFilter = context.createBiquadFilter()
    dustFilter.type = 'highpass'
    dustFilter.frequency.value = dustHighpassHz
    dustFilter.Q.value = dustHighpassQ
    dustAmp = context.createGain()
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
  drive.curve = saturatorCurve(internalSaturationAmount)
  drive.oversample = '2x'
  const outputTrim = context.createGain()
  outputTrim.gain.value = outputHeadroomGain * tone.levelCompensation
  sum.connect(drive)
  drive.connect(outputTrim)
  outputTrim.connect(destination)

  const stopAt = when + bodyAttackSeconds + Math.max(bodyDecaySeconds, rattleDecaySeconds) + 0.05
  const scheduledSources: AudioScheduledSourceNode[] = [bodyA, bodyB, rattleSource]
  const allNodes: AudioNode[] = [bodyA, bodyAGain, bodyB, bodyBGain, bodySaturator, bodyFilter, bodyAmp, bodyTrim, rattleSource, rattleBroadband, rattleBroadbandGain, rattleResonant, rattleResonantGain, rattleAmp, rattleTrim, sum, drive, outputTrim]
  if (snap && snapFilter && snapAmp) {
    scheduledSources.push(snap)
    allNodes.push(snap, snapFilter, snapAmp)
    snap.start(when)
    snap.stop(when + snapDurationSeconds + 0.01)
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

  // bodyA's stop time already covers max(bodyDecay, rattleDecay), so it is
  // always the last unconditional source to end - a safe, always-present
  // anchor for cleanup regardless of which layer happens to be longer.
  bodyA.addEventListener('ended', cleanUp, { once: true })
  bodyA.start(when)
  bodyB.start(when)
  bodyA.stop(stopAt)
  bodyB.stop(stopAt)
  rattleSource.start(when)
  rattleSource.stop(when + rattleDecaySeconds + 0.01)

  return {
    stop(stopWhen = context.currentTime) {
      for (const source of scheduledSources) {
        try { source.stop(stopWhen) } catch { /* A source may already be stopped or past its natural end. */ }
      }
      cleanUp()
    },
  }
}

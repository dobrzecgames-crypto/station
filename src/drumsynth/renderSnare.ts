import { estimateSnareRenderSeconds } from './drumSynthOperations'
import type { DrumSnarePatch } from './drumSynthTypes'
import { playSnareVoice } from './snareVoice'
import { createRandomSeed } from './seededRandom'

/** Stereo, unlike renderKick.ts's mono - RATTLE is the only source of width and needs two real channels to render into. */
const renderChannelCount = 2

/**
 * Renders one snare hit to a standalone stereo AudioBuffer for ADD TO PAD.
 * Same shape and reasoning as renderKick.ts: a throwaway OfflineAudioContext
 * rather than a second AudioEngine, since a single short voice needs none of
 * AudioEngine's channels, groups, master FX or Pump - and the same
 * `playSnareVoice` live preview uses, so the two can never sound different.
 */
export async function renderSnareToBuffer(patch: DrumSnarePatch, sampleRate: number): Promise<AudioBuffer> {
  const durationSeconds = estimateSnareRenderSeconds(patch)
  const context = new OfflineAudioContext(renderChannelCount, Math.ceil(durationSeconds * sampleRate), sampleRate)
  playSnareVoice(context, context.destination, patch, 0, createRandomSeed())
  return context.startRendering()
}

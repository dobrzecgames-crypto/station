import { estimateKickRenderSeconds } from './drumSynthOperations'
import type { DrumKickPatch } from './drumSynthTypes'
import { playKickVoice } from './kickVoice'
import { createRandomSeed } from './seededRandom'

const renderChannelCount = 1

/**
 * Renders one kick hit to a standalone AudioBuffer for ADD TO PAD. Deliberately
 * not a second AudioEngine over an OfflineAudioContext the way the whole-song
 * render is (`project/renderSong.ts`) - a single short voice needs none of
 * AudioEngine's channels, groups, master FX or Pump, so this builds the kick's
 * own graph directly against a throwaway context via the same `playKickVoice`
 * live preview uses, so the two can never sound different from each other.
 */
export async function renderKickToBuffer(patch: DrumKickPatch, sampleRate: number): Promise<AudioBuffer> {
  const durationSeconds = estimateKickRenderSeconds(patch)
  const context = new OfflineAudioContext(renderChannelCount, Math.ceil(durationSeconds * sampleRate), sampleRate)
  playKickVoice(context, context.destination, patch, 0, createRandomSeed())
  return context.startRendering()
}

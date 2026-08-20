import type { PadState } from '../pads/types'
import { getCenteredScalePitchOffsets, getScalePitchOffsets } from './scales.ts'
import type { ProjectKey } from './scales'
import type { PatternGroup } from '../patterns/patternTypes'

export interface ScaleMapResult {
  pads: PadState[]
  mappedPadCount: number
}

export function findProjectScaleMapConflicts(pads: readonly PadState[], sourcePadId: PadState['id']): PadState[] {
  const sourceIndex = pads.findIndex((pad) => pad.id === sourcePadId)
  return sourceIndex < 0 ? [] : pads.slice(sourceIndex + 1).filter((pad) => pad.assetId !== null || pad.synthPatchId !== null || pad.organicBassPatchId !== null || pad.polyPatchId !== null)
}

export function mapPadBankToProjectScale(pads: readonly PadState[], sourcePadId: PadState['id'], projectKey: ProjectKey): ScaleMapResult {
  const sourceIndex = pads.findIndex((pad) => pad.id === sourcePadId)
  const sourcePad = pads[sourceIndex]
  if (sourceIndex < 0 || !sourcePad || (!sourcePad.assetId && !sourcePad.synthPatchId && !sourcePad.organicBassPatchId && !sourcePad.polyPatchId)) {
    throw new Error('Choose a pad with a sample or synth patch before mapping it to the project scale.')
  }
  if (sourcePad.assetId && (!sourcePad.fileName || sourcePad.durationSeconds === null)) {
    throw new Error('The selected sample is missing its playback metadata.')
  }

  const pitchOffsets = getScalePitchOffsets(projectKey.scale, pads.length - sourceIndex)
  return {
    pads: pads.map((pad, index) => {
      if (index < sourceIndex) return pad
      if (sourcePad.organicBassPatchId) {
        return {
          ...pad,
          assetId: null,
          fileName: null,
          durationSeconds: null,
          region: { startSeconds: 0, endSeconds: 0 },
          reversed: false,
          slices: [],
          chopSessionId: null,
          synthPatchId: null,
          organicBassPatchId: sourcePad.organicBassPatchId,
          polyPatchId: null,
          chordIntervals: [0],
          pitchSemitones: pitchOffsets[index - sourceIndex],
        }
      }
      if (sourcePad.polyPatchId) {
        return {
          ...pad, assetId: null, fileName: null, durationSeconds: null, region: { startSeconds: 0, endSeconds: 0 }, reversed: false, slices: [], chopSessionId: null,
          synthPatchId: null, organicBassPatchId: null, polyPatchId: sourcePad.polyPatchId,
          chordIntervals: [...sourcePad.chordIntervals], pitchSemitones: pitchOffsets[index - sourceIndex],
        }
      }
      return sourcePad.synthPatchId
        ? {
            ...pad,
            assetId: null,
            fileName: null,
            durationSeconds: null,
            region: { startSeconds: 0, endSeconds: 0 },
            reversed: false,
            slices: [],
            chopSessionId: null,
            synthPatchId: sourcePad.synthPatchId,
            organicBassPatchId: null,
            polyPatchId: null,
            chordIntervals: [...sourcePad.chordIntervals],
            pitchSemitones: pitchOffsets[index - sourceIndex],
          }
        : {
            ...pad,
            assetId: sourcePad.assetId,
            fileName: sourcePad.fileName,
            durationSeconds: sourcePad.durationSeconds,
            region: { ...sourcePad.region },
            reversed: sourcePad.reversed,
            slices: [],
            chopSessionId: null,
            synthPatchId: null,
            organicBassPatchId: null,
            polyPatchId: null,
            chordIntervals: [0],
            volume: sourcePad.volume,
            pitchSemitones: pitchOffsets[index - sourceIndex],
            attackMs: sourcePad.attackMs,
            releaseMs: sourcePad.releaseMs,
          }
    }),
    mappedPadCount: pads.length - sourceIndex,
  }
}

/** Re-map a complete one-instrument SMART CHORDS bank around a useful central
    tonic. Mixed or partially populated banks stay untouched. */
export function remapScalarChordBank(group: PatternGroup, projectKey: ProjectKey): PatternGroup {
  const pads = group.bank.pads
  const source = pads[0]
  if (!source) return group
  const sourceKind = source.synthPatchId ? 'synth' : 'poly'
  const sourceId = source.synthPatchId ?? source.polyPatchId
  if (!sourceId) return group
  const canRemap = pads.every((pad) => {
    return sourceKind === 'synth'
      ? pad.assetId === null && pad.synthPatchId === sourceId && pad.organicBassPatchId == null && pad.polyPatchId == null
      : pad.assetId === null && pad.polyPatchId === sourceId && pad.synthPatchId === null && pad.organicBassPatchId == null
  })
  if (!canRemap) return group
  const pitchOffsets = getCenteredScalePitchOffsets(projectKey.scale, pads.length)
  return { ...group, bank: { ...group.bank, pads: pads.map((pad, index) => ({ ...pad, pitchSemitones: pitchOffsets[index] })) } }
}

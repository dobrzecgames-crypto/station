import type { PadState } from '../pads/types.ts'
import type { PatternGroup } from '../patterns/patternTypes.ts'
import { getScalePitchOffsets } from './scales.ts'
import type { ProjectKey } from './scales.ts'

export interface ScaleMapResult {
  pads: PadState[]
  mappedPadCount: number
}

export function findProjectScaleMapConflicts(pads: readonly PadState[], sourcePadId: PadState['id']): PadState[] {
  const sourceIndex = pads.findIndex((pad) => pad.id === sourcePadId)
  return sourceIndex < 0 ? [] : pads.slice(sourceIndex + 1).filter((pad) => pad.assetId !== null || pad.synthPatchId !== null || pad.stringsPatchId !== null)
}

export function mapPadBankToProjectScale(pads: readonly PadState[], sourcePadId: PadState['id'], projectKey: ProjectKey): ScaleMapResult {
  const sourceIndex = pads.findIndex((pad) => pad.id === sourcePadId)
  const sourcePad = pads[sourceIndex]
  if (sourceIndex < 0 || !sourcePad || (!sourcePad.assetId && !sourcePad.synthPatchId && !sourcePad.stringsPatchId)) {
    throw new Error('Choose a pad with a sample, MONOPOLY or STRINGS patch before mapping it to the project scale.')
  }
  if (sourcePad.assetId && (!sourcePad.fileName || sourcePad.durationSeconds === null)) {
    throw new Error('The selected sample is missing its playback metadata.')
  }

  const pitchOffsets = getScalePitchOffsets(projectKey.scale, pads.length - sourceIndex)
  return {
    pads: pads.map((pad, index) => {
      if (index < sourceIndex) return pad
      if (sourcePad.stringsPatchId) {
        return {
          ...pad,
          assetId: null,
          fileName: null,
          durationSeconds: null,
          region: { startSeconds: 0, endSeconds: 0 },
          slices: [],
          chopSessionId: null,
          synthPatchId: null,
          stringsPatchId: sourcePad.stringsPatchId,
          chordIntervals: [...sourcePad.chordIntervals],
          pitchSemitones: pitchOffsets[index - sourceIndex],
        }
      }
      return sourcePad.synthPatchId
        ? {
            ...pad,
            assetId: null,
            fileName: null,
            durationSeconds: null,
            region: { startSeconds: 0, endSeconds: 0 },
            slices: [],
            chopSessionId: null,
            synthPatchId: sourcePad.synthPatchId,
            stringsPatchId: null,
            chordIntervals: [...sourcePad.chordIntervals],
            pitchSemitones: pitchOffsets[index - sourceIndex],
          }
        : {
            ...pad,
            assetId: sourcePad.assetId,
            fileName: sourcePad.fileName,
            durationSeconds: sourcePad.durationSeconds,
            region: { ...sourcePad.region },
            slices: [],
            chopSessionId: null,
            synthPatchId: null,
            stringsPatchId: null,
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

/** CHORDS follows Project Key even though NOTES scale maps are intentionally
    static. Reuse the existing mapper only for a coherent scalar-instrument run;
    mixed banks are left untouched rather than overwriting unrelated sounds. */
export function remapScalarChordBank(group: PatternGroup, projectKey: ProjectKey): PatternGroup {
  const pads = group.bank.pads
  const sourceIndex = pads.findIndex((pad) => pad.synthPatchId !== null || pad.stringsPatchId !== null)
  const source = pads[sourceIndex]
  if (!source) return group
  const sourceKind = source.synthPatchId ? 'synth' : 'strings'
  const sourceId = source.synthPatchId ?? source.stringsPatchId
  const canRemap = pads.slice(sourceIndex).every((pad) => {
    const isEmpty = pad.assetId === null && pad.synthPatchId === null && pad.stringsPatchId === null
    const matches = sourceKind === 'synth'
      ? pad.assetId === null && pad.synthPatchId === sourceId && pad.stringsPatchId === null
      : pad.assetId === null && pad.stringsPatchId === sourceId && pad.synthPatchId === null
    return isEmpty || matches
  })
  if (!canRemap) return group
  try {
    const mapped = mapPadBankToProjectScale(pads, source.id, projectKey)
    return { ...group, bank: { ...group.bank, pads: mapped.pads } }
  } catch {
    return group
  }
}

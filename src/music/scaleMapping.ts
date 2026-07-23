import type { PadState } from '../pads/types'
import { getScalePitchOffsets } from './scales'
import type { ProjectKey } from './scales'

export interface ScaleMapResult {
  pads: PadState[]
  mappedPadCount: number
}

export function findProjectScaleMapConflicts(pads: readonly PadState[], sourcePadId: PadState['id']): PadState[] {
  const sourceIndex = pads.findIndex((pad) => pad.id === sourcePadId)
  return sourceIndex < 0 ? [] : pads.slice(sourceIndex + 1).filter((pad) => pad.assetId !== null)
}

export function mapPadBankToProjectScale(pads: readonly PadState[], sourcePadId: PadState['id'], projectKey: ProjectKey): ScaleMapResult {
  const sourceIndex = pads.findIndex((pad) => pad.id === sourcePadId)
  const sourcePad = pads[sourceIndex]
  if (sourceIndex < 0 || !sourcePad?.assetId || !sourcePad.fileName || sourcePad.durationSeconds === null) {
    throw new Error('Choose a pad with a sample before mapping it to the project scale.')
  }

  const pitchOffsets = getScalePitchOffsets(projectKey.scale, pads.length - sourceIndex)
  return {
    pads: pads.map((pad, index) => index < sourceIndex ? pad : {
      ...pad,
      assetId: sourcePad.assetId,
      fileName: sourcePad.fileName,
      durationSeconds: sourcePad.durationSeconds,
      region: { ...sourcePad.region },
      slices: [],
      chopSessionId: null,
      volume: sourcePad.volume,
      pitchSemitones: pitchOffsets[index - sourceIndex],
    }),
    mappedPadCount: pads.length - sourceIndex,
  }
}

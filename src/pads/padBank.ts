import type { PadDefinition, PadState, ChopSessionState } from './types'

export interface PadBankState {
  pads: PadState[]
  chopSession: ChopSessionState
}

const padKeys = [
  ['Digit1', '1'],
  ['Digit2', '2'],
  ['Digit3', '3'],
  ['Digit4', '4'],
  ['KeyQ', 'Q'],
  ['KeyW', 'W'],
  ['KeyE', 'E'],
  ['KeyR', 'R'],
  ['KeyA', 'A'],
  ['KeyS', 'S'],
  ['KeyD', 'D'],
  ['KeyF', 'F'],
  ['KeyZ', 'Z'],
  ['KeyX', 'X'],
  ['KeyC', 'C'],
  ['KeyV', 'V'],
] as const

export const padDefinitions: PadDefinition[] = padKeys.map(([keyCode, keyLabel], index) => {
  const number = String(index + 1).padStart(2, '0')
  return {
    id: `pad-${number}`,
    keyCode,
    keyLabel,
    label: `PAD ${number}`,
  }
})

export const padIdByKeyCode = new Map(padDefinitions.map((pad) => [pad.keyCode, pad.id]))

export function createPadBank(): PadState[] {
  return padDefinitions.map((pad) => ({
    id: pad.id,
    label: pad.label,
    assetId: null,
    fileName: null,
    durationSeconds: null,
    region: { startSeconds: 0, endSeconds: 0 },
    slices: [],
    chopSessionId: null,
    volume: 1,
    muted: false,
    solo: false,
    pitchSemitones: 0,
    attackMs: 0,
    // Matches the existing per-voice edge fade, preserving the sound of a new
    // pad bank and of projects written before the AR envelope existed.
    releaseMs: 4,
    synthPatchId: null,
    stringsPatchId: null,
    chordIntervals: [0],
  }))
}

export function createEmptyChopSession(): ChopSessionState {
  return { id: '', assetId: null, fileName: null, durationSeconds: null, slices: [], activeSliceId: null, pitchSemitones: 0 }
}

export function createPadBankState(): PadBankState {
  return { pads: createPadBank(), chopSession: createEmptyChopSession() }
}

export function clonePadBank(bank: PadBankState): PadBankState {
  // Only an absent field is migrated - a project saved before the CHOP source
  // pitch existed has no pitchSemitones on its chopSession at all.
  const legacySession = bank.chopSession as ChopSessionState & { pitchSemitones?: unknown }
  return {
    pads: bank.pads.map((pad) => {
      const legacyPad = pad as PadState & { synthPatchId?: unknown; stringsPatchId?: unknown; chordIntervals?: unknown }
      return {
        ...pad,
        region: { ...pad.region },
        slices: pad.slices.map((slice) => ({ ...slice })),
        synthPatchId: legacyPad.synthPatchId === undefined ? null : legacyPad.synthPatchId as PadState['synthPatchId'],
        stringsPatchId: legacyPad.stringsPatchId === undefined ? null : legacyPad.stringsPatchId as PadState['stringsPatchId'],
        chordIntervals: legacyPad.chordIntervals === undefined ? [0] : [...legacyPad.chordIntervals as number[]],
      }
    }),
    chopSession: {
      ...bank.chopSession,
      pitchSemitones: legacySession.pitchSemitones === undefined ? 0 : legacySession.pitchSemitones as number,
      slices: bank.chopSession.slices.map((slice) => ({ ...slice })),
    },
  }
}

export function findPadInBank(bank: PadBankState, padId: string): PadState | undefined {
  return bank.pads.find((pad) => pad.id === padId)
}

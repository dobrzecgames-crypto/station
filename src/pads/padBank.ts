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
  }))
}

export function createEmptyChopSession(): ChopSessionState {
  return { id: '', assetId: null, fileName: null, durationSeconds: null, slices: [], activeSliceId: null }
}

export function createPadBankState(): PadBankState {
  return { pads: createPadBank(), chopSession: createEmptyChopSession() }
}

export function clonePadBank(bank: PadBankState): PadBankState {
  return {
    pads: bank.pads.map((pad) => ({ ...pad, region: { ...pad.region }, slices: pad.slices.map((slice) => ({ ...slice })) })),
    chopSession: { ...bank.chopSession, slices: bank.chopSession.slices.map((slice) => ({ ...slice })) },
  }
}

export function findPadInBank(bank: PadBankState, padId: string): PadState | undefined {
  return bank.pads.find((pad) => pad.id === padId)
}

import type { PadDefinition, PadState } from './types'

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

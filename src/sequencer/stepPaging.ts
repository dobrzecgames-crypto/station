export const sequencerStepPageSize = 8

export interface StepCellBounds {
  left: number
  right: number
  top: number
  bottom: number
}

/**
 * Crossing the outer edge of the current row advances the still-active paint
 * gesture by one musical step. The one-pixel inset keeps the transition
 * reachable even when the matrix sits flush against the viewport edge.
 */
export function getStepPageEdgeTarget(
  page: 0 | 1,
  clientX: number,
  clientY: number,
  firstCell: StepCellBounds,
  lastCell: StepCellBounds,
): number | null {
  const rowTop = Math.min(firstCell.top, lastCell.top)
  const rowBottom = Math.max(firstCell.bottom, lastCell.bottom)
  if (clientY < rowTop || clientY > rowBottom) return null
  if (page === 0 && clientX >= lastCell.right - 1) return sequencerStepPageSize
  if (page === 1 && clientX <= firstCell.left + 1) return sequencerStepPageSize - 1
  return null
}

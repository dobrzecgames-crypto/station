export interface StepEventRange {
  headIndex: number
  endIndex: number
  length: number
  merged: boolean
}

function storedStepLength(length: number | undefined, headIndex: number, stepCount: number): number {
  if (!Number.isInteger(length) || (length ?? 0) <= 1) return 1
  return Math.min(length!, stepCount - headIndex)
}

/**
 * Resolves any active cell to the event that owns it. A merged event is
 * represented by an active head with a length greater than one; its following
 * active cells remain visible grid cells but are owned by that head.
 */
export function getStepEventRange(steps: readonly number[], lengths: readonly number[], stepIndex: number): StepEventRange | null {
  if (stepIndex < 0 || stepIndex >= steps.length || steps[stepIndex] <= 0) return null
  for (let headIndex = 0; headIndex <= stepIndex; headIndex += 1) {
    if (steps[headIndex] <= 0) continue
    const length = storedStepLength(lengths[headIndex], headIndex, steps.length)
    const endIndex = headIndex + length - 1
    if (stepIndex <= endIndex) return { headIndex, endIndex, length, merged: length > 1 }
  }
  return { headIndex: stepIndex, endIndex: stepIndex, length: 1, merged: false }
}

export function getStepEventOwners(steps: readonly number[], lengths: readonly number[]): (number | null)[] {
  return steps.map((_velocity, stepIndex) => getStepEventRange(steps, lengths, stepIndex)?.headIndex ?? null)
}

/** No wrap: step 16 and step 1 are deliberately never part of one run. */
export function getContiguousActiveStepRange(steps: readonly number[], stepIndex: number): { startIndex: number; endIndex: number; length: number } | null {
  if (stepIndex < 0 || stepIndex >= steps.length || steps[stepIndex] <= 0) return null
  let startIndex = stepIndex
  let endIndex = stepIndex
  while (startIndex > 0 && steps[startIndex - 1] > 0) startIndex -= 1
  while (endIndex + 1 < steps.length && steps[endIndex + 1] > 0) endIndex += 1
  return { startIndex, endIndex, length: endIndex - startIndex + 1 }
}

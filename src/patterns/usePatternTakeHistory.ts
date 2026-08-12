import { useState } from 'react'
import type { PatternTakeCommit } from './patternRecording'

const maximumHistoryDepth = 50

/** TAKE-only history. Manual grid/structure edits clear it in App so undo can
 * never roll those later edits back as collateral damage. */
export function usePatternTakeHistory() {
  const [past, setPast] = useState<PatternTakeCommit[]>([])
  const [future, setFuture] = useState<PatternTakeCommit[]>([])

  const record = (commit: PatternTakeCommit): void => {
    setPast((current) => [...current.slice(-(maximumHistoryDepth - 1)), commit])
    setFuture([])
  }

  const undo = (): PatternTakeCommit | undefined => {
    const commit = past.at(-1)
    if (!commit) return undefined
    setPast((current) => current.slice(0, -1))
    setFuture((current) => [...current, commit])
    return commit
  }

  const redo = (): PatternTakeCommit | undefined => {
    const commit = future.at(-1)
    if (!commit) return undefined
    setFuture((current) => current.slice(0, -1))
    setPast((current) => [...current, commit])
    return commit
  }

  const clear = (): void => { setPast([]); setFuture([]) }

  return { canUndo: past.length > 0, canRedo: future.length > 0, record, undo, redo, clear }
}

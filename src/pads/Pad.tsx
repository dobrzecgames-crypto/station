import type { PadState } from './types'

interface PadProps {
  pad: PadState
  isSelected: boolean
  isActive: boolean
  audioReady: boolean
  dropSampleName: string | null
  onTrigger: (padId: PadState['id']) => void
  onRelease: (padId: PadState['id']) => void
  onDropSample: (padId: PadState['id']) => void
  onFeedbackEnd: (padId: PadState['id']) => void
  chordName?: string
  chordRoot?: string
}

export function Pad({
  pad,
  isSelected,
  isActive,
  audioReady,
  dropSampleName,
  onTrigger,
  onRelease,
  onDropSample,
  onFeedbackEnd,
  chordName,
  chordRoot,
}: PadProps) {
  const isSynth = pad.synthPatchId !== null
  const isStrings = pad.stringsPatchId !== null
  const isLoaded = pad.fileName !== null || isSynth || isStrings
  const sourceLabel = isSynth ? 'MONOPOLY' : isStrings ? 'STRINGS' : pad.fileName
  const statusLabel = dropSampleName ? 'DROP' : isSynth || isStrings ? (audioReady ? (isSynth ? 'SYNTH' : 'STRINGS') : 'LOCKED') : isLoaded ? (audioReady ? 'READY' : 'LOCKED') : 'EMPTY'

  return (
    <button
      type="button"
      className={`pad ${isLoaded ? 'pad-loaded' : 'pad-empty'} ${isSelected ? `pad-selected${chordName ? ' pad-chord-selected' : ''}` : ''} ${isActive ? `pad-active${chordName ? ' pad-chord-playing' : ''}` : ''} ${dropSampleName ? 'pad-drop-target' : ''}`}
      aria-pressed={isSelected}
      aria-label={dropSampleName ? `Drop ${dropSampleName} to ${pad.label}` : `${pad.label}, ${isLoaded ? `loaded: ${sourceLabel}` : 'empty'}`}
      onAnimationEnd={() => onFeedbackEnd(pad.id)}
      onPointerDown={(event) => {
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        if (dropSampleName) onDropSample(pad.id)
        else onTrigger(pad.id)
      }}
      onPointerUp={() => onRelease(pad.id)}
      onPointerCancel={() => onRelease(pad.id)}
      onLostPointerCapture={() => onRelease(pad.id)}
    >
      <span className="pad-number">{pad.label}</span>
      {(isLoaded || chordName) && (
        <span className={`pad-file${chordName ? ' pad-chord-name' : ''}`} title={chordName ?? sourceLabel ?? undefined}>{chordName ?? sourceLabel}</span>
      )}
      <span className="pad-footer">{chordRoot ?? statusLabel}</span>
    </button>
  )
}

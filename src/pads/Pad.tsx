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
}: PadProps) {
  const isSynth = pad.synthPatchId !== null
  const isStrings = pad.stringsPatchId !== null
  const isLoaded = pad.fileName !== null || isSynth || isStrings
  const sourceLabel = isSynth ? 'MONOPOLY' : isStrings ? 'STRINGS' : pad.fileName
  const statusLabel = dropSampleName ? 'DROP' : isSynth || isStrings ? (audioReady ? (isSynth ? 'SYNTH' : 'STRINGS') : 'LOCKED') : isLoaded ? (audioReady ? 'READY' : 'LOCKED') : 'EMPTY'

  return (
    <button
      type="button"
      className={`pad ${isLoaded ? 'pad-loaded' : 'pad-empty'} ${isSelected ? 'pad-selected' : ''} ${isActive ? 'pad-active' : ''} ${dropSampleName ? 'pad-drop-target' : ''}`}
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
      {isLoaded && (
        <span className="pad-file" title={sourceLabel ?? undefined}>{sourceLabel}</span>
      )}
      <span className="pad-footer">{statusLabel}</span>
    </button>
  )
}

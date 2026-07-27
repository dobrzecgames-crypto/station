import type { PadState } from './types'

interface PadProps {
  pad: PadState
  isSelected: boolean
  isActive: boolean
  audioReady: boolean
  dropSampleName: string | null
  onTrigger: (padId: PadState['id']) => void
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
  onDropSample,
  onFeedbackEnd,
}: PadProps) {
  const isLoaded = pad.fileName !== null
  const statusLabel = dropSampleName ? 'DROP' : isLoaded ? (audioReady ? 'READY' : 'LOCKED') : 'EMPTY'

  return (
    <button
      type="button"
      className={`pad ${isLoaded ? 'pad-loaded' : 'pad-empty'} ${isSelected ? 'pad-selected' : ''} ${isActive ? 'pad-active' : ''} ${dropSampleName ? 'pad-drop-target' : ''}`}
      aria-pressed={isSelected}
      aria-label={dropSampleName ? `Drop ${dropSampleName} to ${pad.label}` : `${pad.label}, ${isLoaded ? `loaded: ${pad.fileName}` : 'empty'}`}
      onAnimationEnd={() => onFeedbackEnd(pad.id)}
      onPointerDown={(event) => {
        event.preventDefault()
        if (dropSampleName) onDropSample(pad.id)
        else onTrigger(pad.id)
      }}
    >
      <span className="pad-number">{pad.label}</span>
      {isLoaded && (
        <span className="pad-file" title={pad.fileName ?? undefined}>{pad.fileName}</span>
      )}
      <span className="pad-footer">{statusLabel}</span>
    </button>
  )
}

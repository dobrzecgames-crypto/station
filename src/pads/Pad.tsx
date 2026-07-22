import type { PadState } from './types'

interface PadProps {
  pad: PadState
  keyLabel: string
  isSelected: boolean
  isActive: boolean
  audioReady: boolean
  onTrigger: (padId: PadState['id']) => void
  onFeedbackEnd: (padId: PadState['id']) => void
}

export function Pad({
  pad,
  keyLabel,
  isSelected,
  isActive,
  audioReady,
  onTrigger,
  onFeedbackEnd,
}: PadProps) {
  const isLoaded = pad.fileName !== null

  return (
    <button
      type="button"
      className={`pad ${isLoaded ? 'pad-loaded' : 'pad-empty'} ${isSelected ? 'pad-selected' : ''} ${isActive ? 'pad-active' : ''}`}
      aria-pressed={isSelected}
      aria-label={`${pad.label}, ${isLoaded ? `loaded: ${pad.fileName}` : 'empty'}, key ${keyLabel}`}
      onAnimationEnd={() => onFeedbackEnd(pad.id)}
      onPointerDown={(event) => {
        event.preventDefault()
        onTrigger(pad.id)
      }}
    >
      <span className="pad-number">{pad.label}</span>
      <span className="pad-file" title={pad.fileName ?? undefined}>
        {isLoaded ? pad.fileName : 'EMPTY'}
      </span>
      <span className="pad-footer">
        <kbd>{keyLabel}</kbd>
        <span>{audioReady && isLoaded ? 'READY' : isLoaded ? 'LOCKED' : 'EMPTY'}</span>
      </span>
    </button>
  )
}

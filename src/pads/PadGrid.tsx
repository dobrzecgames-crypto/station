import { Pad } from './Pad'
import type { PadState } from './types'
import './padDrop.css'

interface PadGridProps {
  pads: PadState[]
  selectedPadId: PadState['id']
  activePadId: PadState['id'] | null
  keyboardPressedPadIds?: ReadonlySet<PadState['id']>
  audioReady: boolean
  dropSampleName?: string | null
  onTrigger: (padId: PadState['id']) => void
  onRelease?: (padId: PadState['id']) => void
  onDropSample?: (padId: PadState['id']) => void
  onFeedbackEnd: (padId: PadState['id']) => void
  chordLabels?: Record<string, { name: string; root: string }>
}

export function PadGrid({ pads, selectedPadId, activePadId, keyboardPressedPadIds, audioReady, dropSampleName = null, onTrigger, onRelease = () => undefined, onDropSample = () => undefined, onFeedbackEnd, chordLabels }: PadGridProps) {
  return (
    <div className="pad-grid" aria-label="16 pad bank">
      {pads.map((pad) => (
        <Pad
          key={pad.id}
          pad={pad}
          isSelected={pad.id === selectedPadId}
          isPlaying={pad.id === activePadId}
          isKeyboardPressed={keyboardPressedPadIds?.has(pad.id) ?? false}
          audioReady={audioReady}
          dropSampleName={dropSampleName}
          onTrigger={onTrigger}
          onRelease={onRelease}
          onDropSample={onDropSample}
          onFeedbackEnd={onFeedbackEnd}
          chordName={chordLabels?.[pad.id]?.name}
          chordRoot={chordLabels?.[pad.id]?.root}
        />
      ))}
    </div>
  )
}

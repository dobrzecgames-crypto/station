import { Pad } from './Pad'
import type { PadState } from './types'
import type { LibrarySample } from '../library/builtInLibrary'
import './padDrop.css'

interface PadGridProps {
  pads: PadState[]
  selectedPadId: PadState['id']
  activePadId: PadState['id'] | null
  audioReady: boolean
  dropSample?: LibrarySample | null
  onTrigger: (padId: PadState['id']) => void
  onDropSample?: (padId: PadState['id']) => void
  onFeedbackEnd: (padId: PadState['id']) => void
}

export function PadGrid({ pads, selectedPadId, activePadId, audioReady, dropSample = null, onTrigger, onDropSample = () => undefined, onFeedbackEnd }: PadGridProps) {
  return (
    <div className="pad-grid" aria-label="16 pad bank">
      {pads.map((pad) => (
        <Pad
          key={pad.id}
          pad={pad}
          isSelected={pad.id === selectedPadId}
          isActive={pad.id === activePadId}
          audioReady={audioReady}
          dropSampleName={dropSample?.filename ?? null}
          onTrigger={onTrigger}
          onDropSample={onDropSample}
          onFeedbackEnd={onFeedbackEnd}
        />
      ))}
    </div>
  )
}

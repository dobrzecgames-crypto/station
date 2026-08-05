import { Pad } from './Pad'
import type { PadState } from './types'
import './padDrop.css'

interface PadGridProps {
  pads: PadState[]
  selectedPadId: PadState['id']
  activePadId: PadState['id'] | null
  audioReady: boolean
  dropSampleName?: string | null
  onTrigger: (padId: PadState['id']) => void
  onRelease?: (padId: PadState['id']) => void
  onDropSample?: (padId: PadState['id']) => void
  onFeedbackEnd: (padId: PadState['id']) => void
  chordLabels?: Readonly<Record<string, { name: string; root: string }>>
}

export function PadGrid({ pads, selectedPadId, activePadId, audioReady, dropSampleName = null, onTrigger, onRelease = () => undefined, onDropSample = () => undefined, onFeedbackEnd, chordLabels = {} }: PadGridProps) {
  return (
    <div className="pad-grid" aria-label="16 pad bank">
      {pads.map((pad) => (
        <Pad
          key={pad.id}
          pad={pad}
          isSelected={pad.id === selectedPadId}
          isActive={pad.id === activePadId}
          audioReady={audioReady}
          dropSampleName={dropSampleName}
          onTrigger={onTrigger}
          onRelease={onRelease}
          onDropSample={onDropSample}
          onFeedbackEnd={onFeedbackEnd}
          chordName={chordLabels[pad.id]?.name}
          chordRoot={chordLabels[pad.id]?.root}
        />
      ))}
    </div>
  )
}

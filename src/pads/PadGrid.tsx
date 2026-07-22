import { padDefinitions } from './padBank'
import { Pad } from './Pad'
import type { PadState } from './types'

interface PadGridProps {
  pads: PadState[]
  selectedPadId: PadState['id']
  activePadId: PadState['id'] | null
  audioReady: boolean
  onTrigger: (padId: PadState['id']) => void
  onFeedbackEnd: (padId: PadState['id']) => void
}

export function PadGrid({ pads, selectedPadId, activePadId, audioReady, onTrigger, onFeedbackEnd }: PadGridProps) {
  return (
    <div className="pad-grid" aria-label="16 pad bank">
      {pads.map((pad, index) => (
        <Pad
          key={pad.id}
          pad={pad}
          keyLabel={padDefinitions[index].keyLabel}
          isSelected={pad.id === selectedPadId}
          isActive={pad.id === activePadId}
          audioReady={audioReady}
          onTrigger={onTrigger}
          onFeedbackEnd={onFeedbackEnd}
        />
      ))}
    </div>
  )
}

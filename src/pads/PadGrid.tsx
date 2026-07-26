import { padDefinitions } from './padBank'
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
  // The instrument follows the physical pad convention: PAD 01 starts in the
  // lower-left corner. This is display order only; pad IDs and key bindings
  // stay in their original, stable order for audio and saved patterns.
  const displayPads = Array.from(
    { length: Math.ceil(pads.length / 4) },
    (_, row) => pads.slice(row * 4, (row + 1) * 4),
  ).reverse().flat()

  return (
    <div className="pad-grid" aria-label="16 pad bank">
      {displayPads.map((pad) => (
        <Pad
          key={pad.id}
          pad={pad}
          keyLabel={padDefinitions.find((definition) => definition.id === pad.id)?.keyLabel ?? ''}
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

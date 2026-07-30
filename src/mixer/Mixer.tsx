import { useState } from 'react'
import type { AudioEngine } from '../audio/AudioEngine'
import { createChannelId } from '../audio/channelIdentity'
import type { PadState } from '../pads/types'
import { ChannelMeter } from './ChannelMeter'
import './mixer.css'

interface MixerProps {
  audioEngine: AudioEngine
  patternGroupId: string
  pads: readonly PadState[]
  /** Pad IDs (within this Pattern Group) that trigger at least one Pump route. Set on the PUMP screen. */
  pumpSourcePadIds: readonly string[]
  onVolumeChange: (padId: PadState['id'], volume: number) => void
  onMutedChange: (padId: PadState['id'], muted: boolean) => void
  onSoloChange: (padId: PadState['id'], solo: boolean) => void
}

export function Mixer({ audioEngine, patternGroupId, pads, pumpSourcePadIds, onVolumeChange, onMutedChange, onSoloChange }: MixerProps) {
  const channelsPerPage = 4
  const pageCount = Math.ceil(pads.length / channelsPerPage)
  const [pageIndex, setPageIndex] = useState(0)
  const firstChannel = pageIndex * channelsPerPage
  const visiblePads = pads.slice(firstChannel, firstChannel + channelsPerPage)

  return (
    <section className="mixer mixer-channels" aria-labelledby="mixer-title">
      <div className="mixer-channel-heading">
        <p className="eyebrow" id="mixer-title">CHANNELS</p>
        <div className="mixer-page-controls" role="group" aria-label="Channel pages">
          {Array.from({ length: pageCount }, (_, index) => {
            const start = index * channelsPerPage + 1
            const end = Math.min(start + channelsPerPage - 1, pads.length)
            return (
              <button
                className={index === pageIndex ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'}
                key={start}
                type="button"
                aria-pressed={index === pageIndex}
                aria-label={`Show channels ${start} through ${end}`}
                onClick={() => setPageIndex(index)}
              >
                {start}–{end}
              </button>
            )
          })}
        </div>
      </div>
      <div className="mixer-meter-legend" aria-hidden="true">
        <span>LEVEL / dBFS</span>
        <span>0 · −12 · −24 · −36 · −48</span>
      </div>
      <div className="mixer-strips">
        {visiblePads.map((pad) => {
          const isPumpSource = pumpSourcePadIds.includes(pad.id)
          return (
            <article className="mixer-strip" key={pad.id}>
              <strong className="mixer-strip-label">{pad.label.replace('PAD ', '')}</strong>
              <span
                className={pad.fileName || pad.synthPatchId || pad.stringsPatchId ? 'mixer-strip-status mixer-strip-status-loaded' : 'mixer-strip-status'}
                title={pad.synthPatchId ? 'MONOPOLY' : pad.stringsPatchId ? 'STRINGS' : pad.fileName ?? undefined}
                aria-label={pad.synthPatchId ? 'MONOPOLY loaded' : pad.stringsPatchId ? 'STRINGS loaded' : pad.fileName ? `${pad.fileName} loaded` : 'Empty'}
              />
              <span
                className={isPumpSource ? 'mixer-strip-pump mixer-strip-pump-source' : 'mixer-strip-pump'}
                aria-hidden={!isPumpSource}
                aria-label={isPumpSource ? 'Pump source' : undefined}
              />
              <div className="mixer-strip-level">
                <ChannelMeter
                  audioEngine={audioEngine}
                  channelId={createChannelId({ patternGroupId, padId: pad.id })}
                  label={pad.label}
                />
                <div className="mixer-strip-fader">
                  <input aria-label={`${pad.label} volume`} type="range" min="0" max="1" step="0.01" value={pad.volume} onChange={(event) => onVolumeChange(pad.id, Number(event.target.value))} />
                </div>
              </div>
              <output>{pad.volume.toFixed(2)}</output>
              <div className="mixer-strip-buttons">
                <button className={pad.muted ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" aria-pressed={pad.muted} aria-label={`${pad.label} mute`} onClick={() => onMutedChange(pad.id, !pad.muted)}>M</button>
                <button className={pad.solo ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" aria-pressed={pad.solo} aria-label={`${pad.label} solo`} onClick={() => onSoloChange(pad.id, !pad.solo)}>S</button>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

import { useState } from 'react'
import type { AudioEngine } from '../audio/AudioEngine'
import { createChannelId } from '../audio/channelIdentity'
import type { PadState } from '../pads/types'
import { useDragSlider } from '../shell/useDragSlider'
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
  const channelsPerPage = 8
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
        {visiblePads.map((pad) => (
          <MixerStrip
            key={pad.id}
            audioEngine={audioEngine}
            patternGroupId={patternGroupId}
            pad={pad}
            isPumpSource={pumpSourcePadIds.includes(pad.id)}
            onVolumeChange={onVolumeChange}
            onMutedChange={onMutedChange}
            onSoloChange={onSoloChange}
          />
        ))}
      </div>
    </section>
  )
}

interface MixerStripProps {
  audioEngine: AudioEngine
  patternGroupId: string
  pad: PadState
  isPumpSource: boolean
  onVolumeChange: (padId: PadState['id'], volume: number) => void
  onMutedChange: (padId: PadState['id'], muted: boolean) => void
  onSoloChange: (padId: PadState['id'], solo: boolean) => void
}

/** One channel strip - split out from Mixer's own render loop because the
    fader's useDragSlider has to be called once per rendered strip, and a hook
    cannot be called from inside a .map() callback. */
function MixerStrip({ audioEngine, patternGroupId, pad, isPumpSource, onVolumeChange, onMutedChange, onSoloChange }: MixerStripProps) {
  const drag = useDragSlider({
    value: pad.volume,
    min: 0,
    max: 1,
    step: 0.01,
    orientation: 'vertical',
    onChange: (volume) => onVolumeChange(pad.id, volume),
    focusLabel: `${pad.label} VOL`,
    formatValue: (value) => value.toFixed(2),
  })

  return (
    <article className="mixer-strip">
      <strong className="mixer-strip-label">{pad.label.replace('PAD ', '')}</strong>
      <span
        className={pad.fileName || pad.synthPatchId || pad.stringsPatchId || pad.organicBassPatchId || pad.polyPatchId ? 'mixer-strip-status mixer-strip-status-loaded' : 'mixer-strip-status'}
        title={pad.synthPatchId ? 'BASSIC' : pad.stringsPatchId ? 'STRINGS' : pad.organicBassPatchId ? 'MONOGORG' : pad.polyPatchId ? 'ZOLA-X' : pad.fileName ?? undefined}
        aria-label={pad.synthPatchId ? 'MONOPOLY loaded' : pad.stringsPatchId ? 'STRINGS loaded' : pad.organicBassPatchId ? 'MONOGORG loaded' : pad.polyPatchId ? 'POLY loaded' : pad.fileName ? `${pad.fileName} loaded` : 'Empty'}
      />
      <span
        className={isPumpSource ? 'mixer-strip-pump mixer-strip-pump-source' : 'mixer-strip-pump'}
        aria-hidden={!isPumpSource}
        aria-label={isPumpSource ? 'Sidechain source' : undefined}
      />
      <div className="mixer-strip-level">
        <ChannelMeter
          audioEngine={audioEngine}
          channelId={createChannelId({ patternGroupId, padId: pad.id })}
          label={pad.label}
        />
        <div className="mixer-strip-fader">
          <input aria-label={`${pad.label} volume`} type="range" min="0" max="1" step="0.01" value={pad.volume} onChange={(event) => onVolumeChange(pad.id, Number(event.target.value))} onPointerDown={drag.onPointerDown} />
        </div>
      </div>
      <output>{pad.volume.toFixed(2)}</output>
      <div className="mixer-strip-buttons">
        <button className={pad.muted ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" aria-pressed={pad.muted} aria-label={`${pad.label} mute`} onClick={() => onMutedChange(pad.id, !pad.muted)}>M</button>
        <button className={pad.solo ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" aria-pressed={pad.solo} aria-label={`${pad.label} solo`} onClick={() => onSoloChange(pad.id, !pad.solo)}>S</button>
      </div>
    </article>
  )
}

import type { DisplayTenant } from './SystemDisplay'

interface TempoPanelProps {
  bpm: number
  swing: number
  mode: 'pattern' | 'song'
  loopSong: boolean
  metronomeEnabled: boolean
  onBpmChange: (bpm: number) => void
  onSwingChange: (swing: number) => void
  onLoopSongChange: (loopSong: boolean) => void
  onMetronomeEnabledChange: (enabled: boolean) => void
}

/** The display's default tenant, and today its only one. Tempo holds the slot
 *  the same way any other context will, and it is what the line falls back to
 *  when nothing else has claimed it - the floor is never empty. */
export function tempoTenant(props: TempoPanelProps): DisplayTenant {
  return {
    id: 'tempo',
    label: 'Tempo and playback',
    // Formatted here, by the owner, and handed over ready to print.
    readout: `${props.bpm} BPM · ${Math.round(props.swing * 100)}% SWING`,
    panel: <TempoPanel {...props} />,
  }
}

/* Renders straight into the display, so every row here is one more line of the
   same screen rather than a panel stacked under it. Toggles use the same row as
   parameters - name on the left, value on the right - because a checkbox in
   here would read as a control parked on the glass, and its accent colour would
   repaint the screen from module to module.

   A switch rather than a hidden checkbox behind a label: hiding the box means
   shrinking it to a pixel, and an input that small is at the mercy of whether
   the browser still considers it rendered. The switch has nothing to hide - the
   row is the control and ON/OFF is aria-checked drawn out in full.

   aria-label rather than letting the name come from the row's own text: the
   name would otherwise be assembled from a span, which is correct per spec but
   is exactly the case tooling gets wrong, and the visible ON/OFF is next to it
   waiting to be swept into the same string. Two constants, three lines apart. */
function TempoPanel({ bpm, swing, mode, loopSong, metronomeEnabled, onBpmChange, onSwingChange, onLoopSongChange, onMetronomeEnabledChange }: TempoPanelProps) {
  return <>
    <button className="display-toggle" type="button" role="switch" aria-label="LOOP SONG" aria-checked={loopSong} disabled={mode !== 'song'} onClick={() => onLoopSongChange(!loopSong)}>
      <span className="display-param-label">LOOP SONG</span>
      {/* Hidden from the reader: aria-checked already carries the state, so this
          would be the same word twice. */}
      <span className="display-toggle-value" aria-hidden="true">{loopSong ? 'ON' : 'OFF'}</span>
    </button>
    <button className="display-toggle" type="button" role="switch" aria-label="METRONOME" aria-checked={metronomeEnabled} onClick={() => onMetronomeEnabledChange(!metronomeEnabled)}>
      <span className="display-param-label">METRONOME</span>
      <span className="display-toggle-value" aria-hidden="true">{metronomeEnabled ? 'ON' : 'OFF'}</span>
    </button>
    <label className="display-param" htmlFor="bpm">
      <span className="display-param-label">BPM</span>
      <output htmlFor="bpm">{bpm}</output>
      <input id="bpm" type="range" min="60" max="200" value={bpm} onChange={(event) => onBpmChange(Number(event.target.value))} />
    </label>
    <label className="display-param" htmlFor="swing">
      <span className="display-param-label">SWING</span>
      <output htmlFor="swing">{Math.round(swing * 100)}%</output>
      <input id="swing" type="range" min="0" max="0.5" step="0.01" value={swing} onChange={(event) => onSwingChange(Number(event.target.value))} />
    </label>
  </>
}

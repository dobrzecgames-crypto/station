interface TransportBarProps {
  bpm: number
  swing: number
  isPlaying: boolean
  mode: 'pattern' | 'song'
  loopSong: boolean
  metronomeEnabled: boolean
  recording: boolean
  onBpmChange: (bpm: number) => void
  onSwingChange: (swing: number) => void
  onModeChange: (mode: 'pattern' | 'song') => void
  onLoopSongChange: (loopSong: boolean) => void
  onMetronomeEnabledChange: (enabled: boolean) => void
  onRecordingChange: (recording: boolean) => void
  onPlay: () => void
  onStop: () => void
}

export function TransportBar({ bpm, swing, isPlaying, mode, loopSong, metronomeEnabled, recording, onBpmChange, onSwingChange, onModeChange, onLoopSongChange, onMetronomeEnabledChange, onRecordingChange, onPlay, onStop }: TransportBarProps) {
  return <section className="transport-bar" aria-label="Transport">
    <button className="transport-button" type="button" disabled={isPlaying} onClick={onPlay}>PLAY</button>
    <button className="mixer-toggle" type="button" disabled={!isPlaying} onClick={onStop}>STOP</button>
    <button className={recording ? 'mixer-toggle mixer-toggle-active transport-recording' : 'mixer-toggle'} type="button" disabled={mode === 'song'} aria-pressed={recording} title={mode === 'song' ? 'Recording targets one Pattern, so select PATTERN mode first.' : 'Record pad hits into the current Pattern Group and variant.'} onClick={() => onRecordingChange(!recording)}>REC</button>
    <div className="transport-modes" aria-label="Transport mode"><button className={mode === 'pattern' ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" onClick={() => onModeChange('pattern')}>PATTERN</button><button className={mode === 'song' ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" onClick={() => onModeChange('song')}>SONG</button></div>
    <label className="loop-song-toggle"><input type="checkbox" checked={loopSong} disabled={mode !== 'song'} onChange={(event) => onLoopSongChange(event.target.checked)} /> LOOP SONG</label>
    <label className="loop-song-toggle"><input type="checkbox" checked={metronomeEnabled} onChange={(event) => onMetronomeEnabledChange(event.target.checked)} /> METRONOME</label>
    <label className="transport-control" htmlFor="bpm">BPM <output>{bpm}</output><input id="bpm" type="range" min="60" max="200" value={bpm} onChange={(event) => onBpmChange(Number(event.target.value))} /></label>
    <label className="transport-control" htmlFor="swing">SWING <output>{Math.round(swing * 100)}%</output><input id="swing" type="range" min="0" max="0.5" step="0.01" value={swing} onChange={(event) => onSwingChange(Number(event.target.value))} /></label>
  </section>
}

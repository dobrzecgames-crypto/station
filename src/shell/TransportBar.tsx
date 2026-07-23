interface TransportBarProps {
  bpm: number
  swing: number
  isPlaying: boolean
  onBpmChange: (bpm: number) => void
  onSwingChange: (swing: number) => void
  onPlay: () => void
  onStop: () => void
}

export function TransportBar({ bpm, swing, isPlaying, onBpmChange, onSwingChange, onPlay, onStop }: TransportBarProps) {
  return <section className="transport-bar" aria-label="Transport">
    <button className="transport-button" type="button" disabled={isPlaying} onClick={onPlay}>PLAY</button>
    <button className="mixer-toggle" type="button" disabled={!isPlaying} onClick={onStop}>STOP</button>
    <label className="transport-control" htmlFor="bpm">BPM <output>{bpm}</output><input id="bpm" type="range" min="60" max="200" value={bpm} onChange={(event) => onBpmChange(Number(event.target.value))} /></label>
    <label className="transport-control" htmlFor="swing">SWING <output>{Math.round(swing * 100)}%</output><input id="swing" type="range" min="0" max="0.5" step="0.01" value={swing} onChange={(event) => onSwingChange(Number(event.target.value))} /></label>
  </section>
}

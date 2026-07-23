import { patternVariantNames } from '../patterns/patternTypes'
import type { PatternGroup, PatternVariantName } from '../patterns/patternTypes'

interface TransportBarProps {
  bpm: number
  swing: number
  isPlaying: boolean
  mode: 'pattern' | 'song'
  loopSong: boolean
  metronomeEnabled: boolean
  groups: readonly PatternGroup[]
  selectedGroupId: string
  selectedVariant: PatternVariantName
  onBpmChange: (bpm: number) => void
  onSwingChange: (swing: number) => void
  onModeChange: (mode: 'pattern' | 'song') => void
  onLoopSongChange: (loopSong: boolean) => void
  onMetronomeEnabledChange: (enabled: boolean) => void
  onGroupChange: (groupId: string) => void
  onVariantChange: (variant: PatternVariantName) => void
  onPlay: () => void
  onStop: () => void
}

export function TransportBar({ bpm, swing, isPlaying, mode, loopSong, metronomeEnabled, groups, selectedGroupId, selectedVariant, onBpmChange, onSwingChange, onModeChange, onLoopSongChange, onMetronomeEnabledChange, onGroupChange, onVariantChange, onPlay, onStop }: TransportBarProps) {
  const groupIndex = groups.findIndex((group) => group.id === selectedGroupId)
  const selectedGroup = groups[groupIndex]

  return <section className="transport-bar" aria-label="Transport">
    <div className="transport-controls">
      <button className="transport-button" type="button" disabled={isPlaying} onClick={onPlay}>PLAY</button>
      <button className="mixer-toggle" type="button" disabled={!isPlaying} onClick={onStop}>STOP</button>
      <div className="transport-modes" aria-label="Transport mode"><button className={mode === 'pattern' ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" onClick={() => onModeChange('pattern')}>PATTERN</button><button className={mode === 'song' ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" onClick={() => onModeChange('song')}>SONG</button></div>
      <label className="loop-song-toggle"><input type="checkbox" checked={loopSong} disabled={mode !== 'song'} onChange={(event) => onLoopSongChange(event.target.checked)} /> LOOP SONG</label>
      <label className="loop-song-toggle"><input type="checkbox" checked={metronomeEnabled} onChange={(event) => onMetronomeEnabledChange(event.target.checked)} /> METRONOME</label>
      <label className="transport-control" htmlFor="bpm">BPM <output>{bpm}</output><input id="bpm" type="range" min="60" max="200" value={bpm} onChange={(event) => onBpmChange(Number(event.target.value))} /></label>
      <label className="transport-control" htmlFor="swing">SWING <output>{Math.round(swing * 100)}%</output><input id="swing" type="range" min="0" max="0.5" step="0.01" value={swing} onChange={(event) => onSwingChange(Number(event.target.value))} /></label>
    </div>
    <div className="music-context" aria-label="Current music context">
      <div className="group-selector"><button className="mixer-toggle" type="button" aria-label="Previous pattern group" disabled={groupIndex <= 0} onClick={() => onGroupChange(groups[groupIndex - 1].id)}>‹</button><strong>{selectedGroup.name}</strong><button className="mixer-toggle" type="button" aria-label="Next pattern group" disabled={groupIndex >= groups.length - 1} onClick={() => onGroupChange(groups[groupIndex + 1].id)}>›</button></div>
      <div className="variant-selector" aria-label="Pattern variant">{patternVariantNames.map((variant) => <button className={selectedVariant === variant ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} key={variant} type="button" disabled={!selectedGroup.variants[variant]} aria-pressed={selectedVariant === variant} onClick={() => onVariantChange(variant)}>{variant}</button>)}</div>
    </div>
  </section>
}

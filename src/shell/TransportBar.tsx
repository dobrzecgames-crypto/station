import type { CSSProperties, ReactNode } from 'react'
import { patternVariantNames, maximumPatternGroups } from '../patterns/patternTypes'
import type { PatternGroup, PatternVariantName } from '../patterns/patternTypes'
import type { PatternRecordingMode } from '../patterns/patternRecording'
import { SystemDisplay } from './SystemDisplay'
import type { DisplayTenant } from './SystemDisplay'
import { BankSelect } from './BankSelect'
import { tempoTenant } from './TempoPanel'
import type { AudioEngineStatus } from '../audio/AudioEngine'

interface TransportBarProps {
  bpm: number
  swing: number
  isPlaying: boolean
  /** Armed and writing pad hits into the current pattern. */
  recording: boolean
  /** The four metronome clicks before recording arms. Nothing is written yet. */
  countingIn: boolean
  recordingMode: PatternRecordingMode
  canUndoTake: boolean
  canRedoTake: boolean
  mode: 'pattern' | 'song'
  loopSong: boolean
  metronomeEnabled: boolean
  settingsOpen: boolean
  /** Confirmation shown on the display; clears itself after a few seconds. */
  statusMessage?: string
  /** Failure or blocked action; holds the display until the next action. */
  errorMessage?: string
  /** A slider's live value while it is being dragged - see SystemDisplay's own
      focusReadout doc comment. */
  focusReadout?: string | null
  /** Whoever has claimed the display, or null when nobody has and tempo holds
      the floor. */
  displayOwner: DisplayTenant | null
  audioStatus: AudioEngineStatus
  audioDisabled: boolean
  /** Audio may already be ready while the display finishes the visual wake-up. */
  controlsAwake: boolean
  onStartAudio: () => void
  onSettingsOpenChange: (open: boolean) => void
  groups: readonly PatternGroup[]
  selectedGroupId: string
  selectedVariant: PatternVariantName
  onBpmChange: (bpm: number) => void
  onSwingChange: (swing: number) => void
  onModeChange: (mode: 'pattern' | 'song') => void
  onLoopSongChange: (loopSong: boolean) => void
  onMetronomeEnabledChange: (enabled: boolean) => void
  /** Starts the count-in, punches in on a running transport, or punches out. */
  onRecordToggle: () => void
  onRecordingModeChange: (mode: PatternRecordingMode) => void
  onUndoTake: () => void
  onRedoTake: () => void
  onGroupChange: (groupId: string) => void
  onGroupRename: (groupId: string, name: string) => void
  onVariantChange: (variant: PatternVariantName) => void
  onGroupCreate: () => void
  /** Fills an empty slot in the pattern row and switches to it. */
  onVariantCreate: (variant: PatternVariantName) => void
  onVariantDuplicate: (target: PatternVariantName) => void
  onVariantClear: () => void
  onGroupDelete: () => void
  /** Global project actions live in the display but keep a permanent way in
      beside the bank and pattern context. */
  projectControl: ReactNode
  onPlay: () => void
  onStop: () => void
}

export function TransportBar({ bpm, swing, isPlaying, recording, countingIn, recordingMode, canUndoTake, canRedoTake, mode, loopSong, metronomeEnabled, settingsOpen, onSettingsOpenChange, groups, selectedGroupId, selectedVariant, statusMessage, errorMessage, focusReadout, displayOwner, audioStatus, audioDisabled, controlsAwake, onStartAudio, onBpmChange, onSwingChange, onModeChange, onLoopSongChange, onMetronomeEnabledChange, onRecordToggle, onRecordingModeChange, onUndoTake, onRedoTake, onGroupChange, onGroupRename, onVariantChange, onGroupCreate, onVariantCreate, onGroupDelete, projectControl, onPlay, onStop }: TransportBarProps) {
  const groupIndex = groups.findIndex((group) => group.id === selectedGroupId)
  const selectedGroup = groups[groupIndex]
  const audioRecovering = audioStatus === 'suspended' || audioStatus === 'interrupted'

  return <section className="transport-bar" aria-label="Transport">
    <div className="transport-controls">
      <button
        className="system-power-switch"
        type="button"
        data-mechanism="power"
        data-engaged={audioStatus === 'ready'}
        data-audio-status={audioStatus}
        disabled={audioDisabled}
        aria-busy={audioStatus === 'starting'}
        aria-label={audioStatus === 'ready' ? 'Audio on' : audioRecovering ? 'Audio interrupted, tap to resume' : audioStatus === 'starting' ? 'Starting audio' : 'Start audio'}
        onClick={onStartAudio}
      >
        <span className="system-power-face" data-mechanism-face>
          <span className={`status-dot status-${audioStatus}`} aria-hidden="true" />
          <span className="system-power-label">{audioStatus === 'ready' ? 'ON' : audioRecovering ? 'WAIT' : 'OFF'}</span>
        </span>
      </button>
      <button className="transport-button transport-icon-button transport-play-button" type="button" disabled={!controlsAwake || isPlaying} aria-label="Play" onClick={onPlay} />
      <button className="mixer-toggle transport-icon-button transport-stop-button" type="button" disabled={!isPlaying && !countingIn} aria-label="Stop" onClick={onStop} />
      {/* Recording writes pad hits into the current pattern as steps - it is a way of
          filling the same grid SEQ edits by hand, never an audio capture. It therefore
          targets one bank and variant, which is why SONG mode locks it out. */}
      <button
        className={`mixer-toggle transport-icon-button transport-record-button${recording ? ' transport-record-active' : ''}${countingIn ? ' transport-record-counting' : ''}`}
        type="button"
        disabled={!controlsAwake || mode === 'song'}
        aria-pressed={recording || countingIn}
        aria-label={countingIn ? 'Counting in, tap to cancel' : recording ? 'Stop recording' : 'Record'}
        title={mode === 'song' ? 'Recording targets one pattern, so switch to PATTERN mode first.' : undefined}
        // The lamp beats the count-in, so its period is the beat itself rather than a
        // fixed rate - at 70 BPM and at 180 the blink is what you are counting along to.
        style={countingIn ? { '--count-in-beat': `${60 / bpm}s` } as CSSProperties : undefined}
        onClick={onRecordToggle}
      />
      <div className="transport-modes" aria-label="Transport mode"><button className={mode === 'pattern' ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" disabled={!controlsAwake} onClick={() => onModeChange('pattern')}>PATTERN</button><button className={mode === 'song' ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" disabled={!controlsAwake} onClick={() => onModeChange('song')}>SONG</button></div>
      <div className="recording-workflow" aria-label="Pattern recording workflow">
        <div className="recording-mode-selector" role="group" aria-label="Recording mode">
          <button className={recordingMode === 'overdub' ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" aria-pressed={recordingMode === 'overdub'} disabled={!controlsAwake || recording || countingIn} onClick={() => onRecordingModeChange('overdub')}>OVERDUB</button>
          <button className={recordingMode === 'replace' ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" aria-pressed={recordingMode === 'replace'} disabled={!controlsAwake || recording || countingIn} onClick={() => onRecordingModeChange('replace')}>REPLACE</button>
        </div>
        <button className="mixer-toggle take-history-button" type="button" disabled={!controlsAwake || recording || countingIn || !canUndoTake} onClick={onUndoTake}>UNDO</button>
        <button className="mixer-toggle take-history-button" type="button" disabled={!controlsAwake || recording || countingIn || !canRedoTake} onClick={onRedoTake}>REDO</button>
      </div>
      {/* The system display. Every message in the app lands here rather than in
          whichever panel raised it, so there is one place to look. The panel is
          a slot, and tempo is only its floor: any context can claim it, and
          when one does its readout and its controls take the screen. Tempo
          comes back the moment it releases. See docs/SYSTEM_DISPLAY.md. */}
      <SystemDisplay
        owner={displayOwner ?? tempoTenant({ bpm, swing, mode, loopSong, metronomeEnabled, onBpmChange, onSwingChange, onLoopSongChange, onMetronomeEnabledChange })}
        statusMessage={statusMessage}
        errorMessage={errorMessage}
        focusReadout={focusReadout}
        open={settingsOpen}
        onOpenChange={onSettingsOpenChange}
      />
    </div>
    {/* "Pattern" used to name both of these rows at once: the container was
        called Pattern 1 and the things holding the actual steps were called
        variants. The steps are the pattern; what holds them, along with the
        pads, the bus and the effects, is a bank. The number comes from the
        position in the list rather than the stored name, which still says
        "Pattern 1" inside saved projects. SONG has always labelled its clips
        1A and 2B - now the transport says the same thing. */}
    <div className="music-context" aria-label="Current music context">
      {projectControl}
      <div className="group-selector">
        <BankSelect groups={groups} selectedGroupId={selectedGroupId} onSelect={onGroupChange} onRename={onGroupRename} />
        <button className="mixer-toggle bank-delete" type="button" aria-label={`Delete bank ${groupIndex + 1}`} disabled={groups.length <= 1} onClick={() => onGroupDelete()}>−</button>
        <button className="mixer-toggle" type="button" aria-label="New bank" disabled={groups.length >= maximumPatternGroups} onClick={onGroupCreate}>+</button>
      </div>
      {/* An empty slot is something you can make, not something that is broken.
          It used to be disabled, which meant the obvious move - tap B to get a
          second pattern - did nothing, and the only way through was a DUPLICATE
          row parked in the PROJECT tab. */}
      <div className="variant-selector" data-pattern-group={groupIndex + 1} aria-label="Pattern">
        {patternVariantNames.map((variant) => {
          const exists = Boolean(selectedGroup.variants[variant])
          const className = selectedVariant === variant ? 'mixer-toggle mixer-toggle-active' : exists ? 'mixer-toggle' : 'mixer-toggle variant-empty'
          return <button
            className={className}
            key={variant}
            type="button"
            data-pattern-variant={variant}
            aria-pressed={selectedVariant === variant}
            aria-label={exists ? `Pattern ${variant}` : `Create pattern ${variant}`}
            disabled={!controlsAwake}
            onClick={() => exists ? onVariantChange(variant) : onVariantCreate(variant)}
          >{variant}</button>
        })}
      </div>
    </div>
  </section>
}

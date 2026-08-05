import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { patternVariantNames, maximumPatternGroups } from '../patterns/patternTypes'
import type { PatternGroup, PatternVariantName } from '../patterns/patternTypes'
import { SystemDisplay } from './SystemDisplay'
import type { DisplayTenant } from './SystemDisplay'
import { tempoTenant } from './TempoPanel'
import { bankTenant } from './BankPanel'
import { useSystemDisplay } from './systemDisplayContext'
import type { AudioEngineStatus } from '../audio/AudioEngine'
import { RecordControl } from './RecordControl'
import type { MicrophoneRecordState, RecordMode } from './RecordControl'

interface TransportBarProps {
  bpm: number
  swing: number
  isPlaying: boolean
  /** Armed and writing pad hits into the current pattern. */
  recording: boolean
  /** The four metronome clicks before recording arms. Nothing is written yet. */
  countingIn: boolean
  recordMode: RecordMode
  microphoneState: MicrophoneRecordState
  microphoneElapsedSeconds: number
  microphoneLevel: number
  mode: 'pattern' | 'song'
  loopSong: boolean
  metronomeEnabled: boolean
  settingsOpen: boolean
  /** Confirmation shown on the display; clears itself after a few seconds. */
  statusMessage?: string
  /** Persistent non-live readout while an operation is active. */
  activityMessage?: string
  /** Failure or blocked action; holds the display until the next action. */
  errorMessage?: string
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
  onRecordModeChange: (mode: RecordMode) => void
  onGroupChange: (groupId: string) => void
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

export function TransportBar({ bpm, swing, isPlaying, recording, countingIn, recordMode, microphoneState, microphoneElapsedSeconds, microphoneLevel, mode, loopSong, metronomeEnabled, settingsOpen, onSettingsOpenChange, groups, selectedGroupId, selectedVariant, statusMessage, activityMessage, errorMessage, displayOwner, audioStatus, audioDisabled, controlsAwake, onStartAudio, onBpmChange, onSwingChange, onModeChange, onLoopSongChange, onMetronomeEnabledChange, onRecordToggle, onRecordModeChange, onGroupChange, onVariantChange, onGroupCreate, onVariantCreate, onVariantDuplicate, onVariantClear, onGroupDelete, projectControl, onPlay, onStop }: TransportBarProps) {
  const groupIndex = groups.findIndex((group) => group.id === selectedGroupId)
  const selectedGroup = groups[groupIndex]
  const audioRecovering = audioStatus === 'suspended' || audioStatus === 'interrupted'
  const { claim, release, ownerId } = useSystemDisplay()
  const [managingBank, setManagingBank] = useState(false)
  const latestBankActionsRef = useRef({ onVariantDuplicate, onVariantClear, onGroupDelete })
  latestBankActionsRef.current = { onVariantDuplicate, onVariantClear, onGroupDelete }
  const bankActions = useMemo(() => ({
    onDuplicate: (target: PatternVariantName) => latestBankActionsRef.current.onVariantDuplicate(target),
    onClear: () => latestBankActionsRef.current.onVariantClear(),
    onDelete: () => latestBankActionsRef.current.onGroupDelete(),
  }), [])

  /* The panel is kept current rather than claimed once as a snapshot. Changing
     bank or pattern while it is open - tapping + or an arrow - would otherwise
     leave the heading naming BANK 1 while the buttons acted on whatever is
     selected now, because the handlers read the selection when they fire. */
  useEffect(() => {
    if (!managingBank) return
    claim(bankTenant({
      bankNumber: groupIndex + 1,
      group: selectedGroup,
      variant: selectedVariant,
      canDelete: groups.length > 1,
      ...bankActions,
    }))
    return () => release('bank-manage')
  }, [managingBank, groupIndex, selectedGroup, selectedVariant, groups.length, claim, release, bankActions])

  /* Somebody else took the display - stop refreshing a panel that is no longer
     on screen, or the next data change would snatch it back from them. */
  useEffect(() => {
    if (managingBank && ownerId !== null && ownerId !== 'bank-manage') setManagingBank(false)
  }, [managingBank, ownerId])

  return <section className="transport-bar" aria-label="Transport">
    <div className="transport-controls">
      <button
        className="system-power-switch"
        type="button"
        disabled={audioDisabled}
        aria-busy={audioStatus === 'starting'}
        aria-label={audioStatus === 'ready' ? 'Audio on' : audioRecovering ? 'Audio interrupted, tap to resume' : audioStatus === 'starting' ? 'Starting audio' : 'Start audio'}
        onClick={onStartAudio}
      >
        <span className={`status-dot status-${audioStatus}`} aria-hidden="true" />
        <span className="system-power-label">{audioStatus === 'ready' ? 'ON' : audioRecovering ? 'WAIT' : 'OFF'}</span>
      </button>
      <button className="transport-button transport-icon-button transport-play-button" type="button" disabled={!controlsAwake || isPlaying || microphoneState !== 'idle'} aria-label="Play" onClick={onPlay} />
      <button className="mixer-toggle transport-icon-button transport-stop-button" type="button" disabled={!isPlaying && !countingIn && microphoneState !== 'recording'} aria-label="Stop" onClick={onStop} />
      {/* Recording writes pad hits into the current pattern as steps - it is a way of
          filling the same grid SEQ edits by hand, never an audio capture. It therefore
          targets one bank and variant, which is why SONG mode locks it out. */}
      <RecordControl
        mode={recordMode}
        bpm={bpm}
        patternActive={recording}
        countingIn={countingIn}
        microphoneState={microphoneState}
        microphoneElapsedSeconds={microphoneElapsedSeconds}
        microphoneLevel={microphoneLevel}
        patternModeAvailable={mode === 'pattern'}
        toggleDisabled={!controlsAwake || (recordMode === 'pattern' && mode === 'song')}
        onToggle={onRecordToggle}
        onModeChange={onRecordModeChange}
      />
      <div className="transport-modes" aria-label="Transport mode"><button className={mode === 'pattern' ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" disabled={!controlsAwake} onClick={() => onModeChange('pattern')}>PATTERN</button><button className={mode === 'song' ? 'mixer-toggle mixer-toggle-active' : 'mixer-toggle'} type="button" disabled={!controlsAwake} onClick={() => onModeChange('song')}>SONG</button></div>
      {/* The system display. Every message in the app lands here rather than in
          whichever panel raised it, so there is one place to look. The panel is
          a slot, and tempo is only its floor: any context can claim it, and
          when one does its readout and its controls take the screen. Tempo
          comes back the moment it releases. See docs/SYSTEM_DISPLAY.md. */}
      <SystemDisplay
        owner={displayOwner ?? tempoTenant({ bpm, swing, mode, loopSong, metronomeEnabled, onBpmChange, onSwingChange, onLoopSongChange, onMetronomeEnabledChange })}
        statusMessage={statusMessage}
        activityMessage={activityMessage}
        errorMessage={errorMessage}
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
        <span className="context-label">BANK</span>
        <button className="mixer-toggle" type="button" aria-label="Previous bank" disabled={groupIndex <= 0} onClick={() => onGroupChange(groups[groupIndex - 1].id)}>‹</button>
        {/* The name is the way in to everything else you can do to a bank. */}
        <button
          className="bank-name"
          type="button"
          aria-expanded={managingBank}
          aria-label={`Bank ${groupIndex + 1} actions`}
          onClick={() => setManagingBank((open) => !open)}
        >{groupIndex + 1}</button>
        <button className="mixer-toggle" type="button" aria-label="Next bank" disabled={groupIndex >= groups.length - 1} onClick={() => onGroupChange(groups[groupIndex + 1].id)}>›</button>
        <button className="mixer-toggle" type="button" aria-label="New bank" disabled={groups.length >= maximumPatternGroups} onClick={onGroupCreate}>+</button>
      </div>
      {/* An empty slot is something you can make, not something that is broken.
          It used to be disabled, which meant the obvious move - tap B to get a
          second pattern - did nothing, and the only way through was a DUPLICATE
          row parked in the PROJECT tab. */}
      <div className="variant-selector" aria-label="Pattern">
        <span className="context-label">PAT</span>
        {patternVariantNames.map((variant) => {
          const exists = Boolean(selectedGroup.variants[variant])
          const className = selectedVariant === variant ? 'mixer-toggle mixer-toggle-active' : exists ? 'mixer-toggle' : 'mixer-toggle variant-empty'
          return <button
            className={className}
            key={variant}
            type="button"
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

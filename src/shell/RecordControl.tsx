import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import './recordControl.css'

export type RecordMode = 'pattern' | 'microphone'
export type MicrophoneRecordState = 'idle' | 'starting' | 'recording' | 'processing'

interface RecordControlProps {
  mode: RecordMode
  bpm: number
  patternActive: boolean
  countingIn: boolean
  microphoneState: MicrophoneRecordState
  microphoneElapsedSeconds: number
  microphoneLevel: number
  patternModeAvailable: boolean
  toggleDisabled: boolean
  onToggle: () => void
  onModeChange: (mode: RecordMode) => void
}

const longPressMilliseconds = 500

export function RecordControl({ mode, bpm, patternActive, countingIn, microphoneState, microphoneElapsedSeconds, microphoneLevel, patternModeAvailable, toggleDisabled, onToggle, onModeChange }: RecordControlProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const selectedOptionRef = useRef<HTMLButtonElement>(null)
  const longPressTimerRef = useRef<number | null>(null)
  const longPressTriggeredRef = useRef(false)
  const microphoneActive = microphoneState === 'recording'
  const microphoneBusy = microphoneState === 'starting' || microphoneState === 'processing'
  const active = patternActive || countingIn || microphoneActive
  const canChooseMode = !active && !microphoneBusy
  const label = mode === 'microphone'
    ? microphoneActive ? `Stop microphone recording, ${formatRecordingDuration(microphoneElapsedSeconds)}` : microphoneBusy ? 'Processing microphone recording' : 'Record with microphone, hold to choose recording mode'
    : countingIn ? 'Counting in, tap to cancel' : patternActive ? 'Stop pattern recording' : 'Record pattern, hold to choose recording mode'

  const clearLongPress = () => {
    if (longPressTimerRef.current !== null) window.clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = null
  }
  const openSheet = () => {
    if (!canChooseMode) return
    longPressTriggeredRef.current = true
    setSheetOpen(true)
  }
  const startLongPress = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!canChooseMode || event.button !== 0) return
    clearLongPress()
    longPressTriggeredRef.current = false
    longPressTimerRef.current = window.setTimeout(openSheet, longPressMilliseconds)
  }
  const closeSheet = () => {
    setSheetOpen(false)
    window.requestAnimationFrame(() => buttonRef.current?.focus())
  }
  const selectMode = (nextMode: RecordMode) => {
    onModeChange(nextMode)
    closeSheet()
  }

  useEffect(() => {
    if (!sheetOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    selectedOptionRef.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeSheet()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('keydown', closeOnEscape)
      document.body.style.overflow = previousOverflow
    }
  }, [sheetOpen])

  useEffect(() => () => clearLongPress(), [])

  return <>
    <button
      ref={buttonRef}
      className={`mixer-toggle transport-icon-button transport-record-button${active ? ' transport-record-active' : ''}${countingIn ? ' transport-record-counting' : ''}${microphoneBusy ? ' transport-record-busy' : ''}${toggleDisabled ? ' transport-record-disabled' : ''}`}
      type="button"
      aria-label={label}
      aria-pressed={active}
      aria-disabled={toggleDisabled || microphoneBusy}
      aria-haspopup="dialog"
      aria-expanded={sheetOpen}
      title="Tap to record · Hold or press Arrow Down to choose PATTERN / MICROPHONE"
      style={{ '--microphone-level': microphoneActive ? microphoneLevel : 0, '--count-in-beat': `${60 / bpm}s` } as CSSProperties}
      onPointerDown={startLongPress}
      onPointerUp={clearLongPress}
      onPointerCancel={clearLongPress}
      onPointerLeave={clearLongPress}
      onContextMenu={(event) => { event.preventDefault(); openSheet() }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowDown') { event.preventDefault(); openSheet() }
      }}
      onClick={(event) => {
        if (longPressTriggeredRef.current) {
          event.preventDefault()
          longPressTriggeredRef.current = false
          return
        }
        if (!toggleDisabled && !microphoneBusy) onToggle()
      }}
    >
      <span className="transport-record-mode" aria-hidden="true">{mode === 'pattern' ? 'PAT' : 'MIC'}</span>
      {microphoneActive && <span className="transport-record-meter" aria-hidden="true"><span /></span>}
    </button>
    {sheetOpen && createPortal(
      <div className="record-mode-layer">
        <button className="record-mode-backdrop" type="button" aria-label="Close recording mode menu" onClick={closeSheet} />
        <section className="record-mode-sheet" role="dialog" aria-modal="true" aria-labelledby="record-mode-title">
          <div className="record-mode-handle" aria-hidden="true" />
          <p id="record-mode-title" className="record-mode-title">RECORDING MODE</p>
          <button
            ref={mode === 'pattern' ? selectedOptionRef : undefined}
            className={`record-mode-option${mode === 'pattern' ? ' record-mode-option-selected' : ''}`}
            type="button"
            disabled={!patternModeAvailable}
            onClick={() => selectMode('pattern')}
          >
            <span className="record-mode-check" aria-hidden="true">{mode === 'pattern' ? '✓' : ''}</span>
            <span><strong>PATTERN</strong><small>{patternModeAvailable ? 'Record pad performance into the current pattern' : 'Available in PATTERN transport mode'}</small></span>
          </button>
          <button
            ref={mode === 'microphone' ? selectedOptionRef : undefined}
            className={`record-mode-option${mode === 'microphone' ? ' record-mode-option-selected' : ''}`}
            type="button"
            onClick={() => selectMode('microphone')}
          >
            <span className="record-mode-check" aria-hidden="true">{mode === 'microphone' ? '✓' : ''}</span>
            <span><strong>MICROPHONE</strong><small>Capture audio and open it directly in CHOP</small></span>
          </button>
          <button className="record-mode-cancel" type="button" onClick={closeSheet}>CANCEL</button>
        </section>
      </div>,
      document.body,
    )}
  </>
}

export function formatRecordingDuration(seconds: number): string {
  const wholeSeconds = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(wholeSeconds / 60)
  return `${minutes}:${String(wholeSeconds % 60).padStart(2, '0')}`
}

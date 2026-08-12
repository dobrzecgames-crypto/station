import { useEffect, useRef, useState } from 'react'
import type { PadState } from './types'

const touchReleaseSlopPx = 18
const penReleaseSlopPx = 8

function pointerReleaseSlop(pointerType: string) {
  if (pointerType === 'touch') return touchReleaseSlopPx
  if (pointerType === 'pen') return penReleaseSlopPx
  return 0
}

function isOutsidePad(bounds: DOMRect, clientX: number, clientY: number, slop: number) {
  return clientX < bounds.left - slop
    || clientX > bounds.right + slop
    || clientY < bounds.top - slop
    || clientY > bounds.bottom + slop
}

interface PadProps {
  pad: PadState
  isSelected: boolean
  isPlaying: boolean
  isKeyboardPressed: boolean
  audioReady: boolean
  dropSampleName: string | null
  onTrigger: (padId: PadState['id']) => void
  onRelease: (padId: PadState['id']) => void
  onDropSample: (padId: PadState['id']) => void
  onFeedbackEnd: (padId: PadState['id']) => void
  chordName?: string
  chordRoot?: string
}

export function Pad({
  pad,
  isSelected,
  isPlaying,
  isKeyboardPressed,
  audioReady,
  dropSampleName,
  onTrigger,
  onRelease,
  onDropSample,
  onFeedbackEnd,
  chordName,
  chordRoot,
}: PadProps) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const pointerReleaseSlops = useRef(new Map<number, number>())
  const activationKey = useRef<' ' | 'Enter' | null>(null)
  const [isPointerPressed, setIsPointerPressed] = useState(false)
  const [isActivationKeyPressed, setIsActivationKeyPressed] = useState(false)
  const isSynth = pad.synthPatchId !== null
  const isStrings = pad.stringsPatchId !== null
  const isOrganicBass = pad.organicBassPatchId !== null
  const isPoly = pad.polyPatchId !== null
  const isLoaded = pad.fileName !== null || isSynth || isStrings || isOrganicBass || isPoly
  const sourceLabel = isSynth ? 'MONOPOLY' : isStrings ? 'STRINGS' : isOrganicBass ? 'MONOGORG' : isPoly ? 'POLY' : pad.fileName
  const statusLabel = dropSampleName ? 'DROP' : isSynth || isStrings || isOrganicBass || isPoly ? (audioReady ? (isSynth ? 'SYNTH' : isStrings ? 'STRINGS' : isOrganicBass ? 'BASS' : 'POLY') : 'LOCKED') : isLoaded ? (audioReady ? 'READY' : 'LOCKED') : 'EMPTY'
  const isPressed = isPointerPressed || isActivationKeyPressed || isKeyboardPressed

  const trigger = () => {
    if (dropSampleName) onDropSample(pad.id)
    else onTrigger(pad.id)
  }

  const releasePointer = (pointerId: number) => {
    if (!pointerReleaseSlops.current.delete(pointerId)) return
    const hasHeldPointer = pointerReleaseSlops.current.size > 0
    setIsPointerPressed(hasHeldPointer)
    if (!hasHeldPointer) onRelease(pad.id)
  }

  const releaseAllPointers = () => {
    if (pointerReleaseSlops.current.size === 0) return
    pointerReleaseSlops.current.clear()
    setIsPointerPressed(false)
    onRelease(pad.id)
  }

  const releaseActivationKey = () => {
    if (!activationKey.current) return
    activationKey.current = null
    setIsActivationKeyPressed(false)
    onRelease(pad.id)
  }

  useEffect(() => {
    if (!isPointerPressed) return
    const releaseTrackedPointer = (event: PointerEvent) => releasePointer(event.pointerId)
    const releasePointerOutside = (event: PointerEvent) => {
      const slop = pointerReleaseSlops.current.get(event.pointerId)
      if (slop === undefined) return
      const bounds = buttonRef.current?.getBoundingClientRect()
      if (bounds && isOutsidePad(bounds, event.clientX, event.clientY, slop)) releasePointer(event.pointerId)
    }
    const clearOnVisibilityLoss = () => { if (document.visibilityState !== 'visible') releaseAllPointers() }
    window.addEventListener('pointerup', releaseTrackedPointer, true)
    window.addEventListener('pointercancel', releaseTrackedPointer, true)
    window.addEventListener('pointermove', releasePointerOutside, true)
    window.addEventListener('blur', releaseAllPointers)
    document.addEventListener('visibilitychange', clearOnVisibilityLoss)
    return () => {
      window.removeEventListener('pointerup', releaseTrackedPointer, true)
      window.removeEventListener('pointercancel', releaseTrackedPointer, true)
      window.removeEventListener('pointermove', releasePointerOutside, true)
      window.removeEventListener('blur', releaseAllPointers)
      document.removeEventListener('visibilitychange', clearOnVisibilityLoss)
    }
  }, [isPointerPressed])

  return (
    <button
      ref={buttonRef}
      type="button"
      className={`pad ${isLoaded ? 'pad-loaded' : 'pad-empty'} ${isSelected ? 'pad-selected' : ''} ${isPlaying ? 'pad-playing' : ''} ${dropSampleName ? 'pad-drop-target' : ''} ${chordName ? 'pad-chord' : ''} ${chordName && isSelected ? 'pad-chord-selected' : ''} ${chordName && isPlaying ? 'pad-chord-playing' : ''}`}
      data-mechanism="pad"
      data-pressed={isPressed}
      data-playing={isPlaying}
      data-selected={isSelected}
      data-loaded={isLoaded}
      aria-pressed={isSelected}
      aria-label={dropSampleName ? `Drop ${dropSampleName} to ${pad.label}` : `${pad.label}, ${isLoaded ? `loaded: ${sourceLabel}` : 'empty'}`}
      onAnimationEnd={(event) => {
        if (event.animationName === 'pad-feedback') onFeedbackEnd(pad.id)
      }}
      onPointerDown={(event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        pointerReleaseSlops.current.set(event.pointerId, pointerReleaseSlop(event.pointerType))
        setIsPointerPressed(true)
        trigger()
      }}
      onPointerMove={(event) => {
        const slop = pointerReleaseSlops.current.get(event.pointerId)
        if (slop === undefined) return
        const bounds = event.currentTarget.getBoundingClientRect()
        if (isOutsidePad(bounds, event.clientX, event.clientY, slop)) releasePointer(event.pointerId)
      }}
      onPointerUp={(event) => releasePointer(event.pointerId)}
      onPointerCancel={(event) => releasePointer(event.pointerId)}
      onLostPointerCapture={(event) => releasePointer(event.pointerId)}
      onKeyDown={(event) => {
        if ((event.key !== ' ' && event.key !== 'Enter') || event.repeat || activationKey.current) return
        event.preventDefault()
        activationKey.current = event.key
        setIsActivationKeyPressed(true)
        trigger()
      }}
      onKeyUp={(event) => {
        if (event.key !== activationKey.current) return
        event.preventDefault()
        releaseActivationKey()
      }}
      onBlur={releaseActivationKey}
    >
      <span className="pad-number">{pad.label}</span>
      {chordName
        ? <span className="pad-file pad-chord-name" title={`${chordName} · ${chordRoot ?? ''}`}>{chordName}</span>
        : isLoaded && <span className="pad-file" title={sourceLabel ?? undefined}>{sourceLabel}</span>}
      <span className="pad-footer">{chordName ? chordRoot : statusLabel}</span>
    </button>
  )
}

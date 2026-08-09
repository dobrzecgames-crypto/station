import { useEffect, useRef, useState } from 'react'
import type { PadState } from './types'

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
  const pointerIds = useRef(new Set<number>())
  const activationKey = useRef<' ' | 'Enter' | null>(null)
  const [isPointerPressed, setIsPointerPressed] = useState(false)
  const [isActivationKeyPressed, setIsActivationKeyPressed] = useState(false)
  const isSynth = pad.synthPatchId !== null
  const isStrings = pad.stringsPatchId !== null
  const isOrganicBass = pad.organicBassPatchId !== null
  const isLoaded = pad.fileName !== null || isSynth || isStrings || isOrganicBass
  const sourceLabel = isSynth ? 'MONOPOLY' : isStrings ? 'STRINGS' : isOrganicBass ? 'MONOGORG' : pad.fileName
  const statusLabel = dropSampleName ? 'DROP' : isSynth || isStrings || isOrganicBass ? (audioReady ? (isSynth ? 'SYNTH' : isStrings ? 'STRINGS' : 'BASS') : 'LOCKED') : isLoaded ? (audioReady ? 'READY' : 'LOCKED') : 'EMPTY'
  const isPressed = isPointerPressed || isActivationKeyPressed || isKeyboardPressed

  const trigger = () => {
    if (dropSampleName) onDropSample(pad.id)
    else onTrigger(pad.id)
  }

  const releasePointer = (pointerId: number) => {
    if (!pointerIds.current.delete(pointerId)) return
    setIsPointerPressed(pointerIds.current.size > 0)
    onRelease(pad.id)
  }

  const releaseAllPointers = () => {
    if (pointerIds.current.size === 0) return
    pointerIds.current.clear()
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
    const releasePointerOutside = (event: PointerEvent | MouseEvent) => {
      const bounds = buttonRef.current?.getBoundingClientRect()
      if (bounds && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) releaseAllPointers()
    }
    const clearOnVisibilityLoss = () => { if (document.visibilityState !== 'visible') releaseAllPointers() }
    window.addEventListener('pointerup', releaseTrackedPointer, true)
    window.addEventListener('pointercancel', releaseTrackedPointer, true)
    window.addEventListener('pointermove', releasePointerOutside, true)
    window.addEventListener('mouseup', releaseAllPointers, true)
    window.addEventListener('mousemove', releasePointerOutside, true)
    window.addEventListener('blur', releaseAllPointers)
    document.addEventListener('visibilitychange', clearOnVisibilityLoss)
    return () => {
      window.removeEventListener('pointerup', releaseTrackedPointer, true)
      window.removeEventListener('pointercancel', releaseTrackedPointer, true)
      window.removeEventListener('pointermove', releasePointerOutside, true)
      window.removeEventListener('mouseup', releaseAllPointers, true)
      window.removeEventListener('mousemove', releasePointerOutside, true)
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
        pointerIds.current.add(event.pointerId)
        setIsPointerPressed(true)
        trigger()
      }}
      onPointerMove={(event) => {
        if (!pointerIds.current.has(event.pointerId)) return
        const bounds = event.currentTarget.getBoundingClientRect()
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) releasePointer(event.pointerId)
      }}
      onPointerUp={(event) => releasePointer(event.pointerId)}
      onPointerLeave={(event) => releasePointer(event.pointerId)}
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

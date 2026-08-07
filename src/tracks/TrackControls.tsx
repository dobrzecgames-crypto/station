import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ChangeEvent } from 'react'
import type { AudioClip, AudioTrack } from './tracksTypes'
import { useOutsideDismiss } from './useOutsideDismiss'

interface TrackControlsProps {
  track: AudioTrack
  audioReady: boolean
  /** The clip currently selected IN THIS TRACK, or null when this track
      holds no part of the current selection (nothing selected at all, or
      the selection belongs to a different track). The menu's clip-scoped
      section (split/duplicate/loop/delete) only renders when this is set -
      computed by the caller from the shared TracksSelection, the same
      selection the old .tracks-clip-actions bar used to key off of. */
  selectedClip: AudioClip | null
  /** Whether SPLIT AT PLAYHEAD is valid right now for `selectedClip` -
      mirrors the canSplitSelected the caller already computes today. */
  canSplitSelectedClip: boolean
  onSetTrackMuted: (trackId: string, muted: boolean) => void
  onSetTrackSolo: (trackId: string, solo: boolean) => void
  onMoveTrackOrder: (trackId: string, direction: 'up' | 'down') => void
  onImportClipToTrack: (trackId: string, file: File) => void
  onRequestRemoveTrack: (trackId: string) => void
  onSplitClipAtPlayhead: (trackId: string, clipId: string) => void
  onDuplicateClip: (trackId: string, clipId: string) => void
  onToggleClipLoop: (trackId: string, clipId: string) => void
  onRequestRemoveClip: (trackId: string, clipId: string) => void
  /** Opens the fullscreen single-track editor. Previously its own always-
      visible "⤢" icon button in the row (a 4th control beside M/S/⋮) - now
      one more menu item, since double-tapping the timeline already opens
      the same editor and the wide arranger's own track name is already a
      button that does this too (TracksArranger.tsx). */
  onOpenTrackEditor: (trackId: string) => void
}

interface MenuPosition { top: number; left: number }

const menuViewportMargin = 10
const menuTriggerGap = 6

/**
 * Per-track control cluster, shared by the compact TracksWorkspace row and
 * the wide TracksArranger rail. M and S stay put - they're what's reached
 * mid-playback - but every other track- or clip-scoped action lives behind
 * a single "•••" popover: open editor, reorder, import, remove track, plus
 * (only when this track owns the current clip selection) split/duplicate/
 * loop/delete clip. See docs/DECISIONS.md for the TRACKS visual-cleanup
 * pass this belongs to.
 *
 * The row itself is always exactly M/S/•••, at a fixed width, whether the
 * menu is open or not - no in-place expansion, no width jump.
 *
 * The popover itself is portaled to document.body rather than positioned in
 * place: its trigger lives inside a row that clips overflow in the compact
 * view, and inside .tracks-arranger-rail (overflow-y:auto) in the wide
 * view - an in-place absolutely positioned menu would be clipped by either
 * ancestor the moment it extended past them, which a dropdown opening
 * below/above its trigger always does. Position is measured from the
 * trigger via getBoundingClientRect and clamped to the viewport in a layout
 * effect - see below. Menu items are flat text rows (.track-menu-row), not
 * a second .mixer-toggle each - a real popover list, not a stack of
 * buttons; see tracksWorkspace.css for that reasoning.
 */
export function TrackControls({ track, audioReady, selectedClip, canSplitSelectedClip, onSetTrackMuted, onSetTrackSolo, onMoveTrackOrder, onImportClipToTrack, onRequestRemoveTrack, onSplitClipAtPlayhead, onDuplicateClip, onToggleClipLoop, onRequestRemoveClip, onOpenTrackEditor }: TrackControlsProps) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<MenuPosition | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const addClipInputRef = useRef<HTMLInputElement>(null)

  useOutsideDismiss([triggerRef, menuRef], open, () => setOpen(false))

  /** Two-pass position, same idea as any floating tooltip/menu: the panel
      first renders invisibly (visibility:hidden, still in the layout so it
      has a real offsetWidth/offsetHeight) so this effect can measure it,
      then places it and reveals it. useLayoutEffect (not useEffect) is what
      makes this flicker-free - it runs before the browser paints, so the
      "invisible at 0,0" frame is never actually shown. Only depends on
      `open`: a scroll/resize while it's open closes the menu instead of
      re-measuring (see the effect below), so this never needs to run again
      mid-session. */
  useLayoutEffect(() => {
    if (!open) { setPosition(null); return }
    const trigger = triggerRef.current
    const menu = menuRef.current
    if (!trigger || !menu) return
    const triggerRect = trigger.getBoundingClientRect()
    const menuWidth = menu.offsetWidth
    const menuHeight = menu.offsetHeight
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    // Right-aligned under the trigger by default (the trigger sits near the
    // right edge of its own row already, after M/S) - clamped so it never
    // crosses either edge of the viewport.
    let left = triggerRect.right - menuWidth
    left = Math.max(menuViewportMargin, Math.min(left, viewportWidth - menuWidth - menuViewportMargin))

    // Opens below the trigger; flips above it if there isn't room below -
    // e.g. a track near the bottom of the list. Not exact safe-area-inset
    // geometry (env(safe-area-inset-*), as .tracks-arranger/.track-editor
    // use) - the trigger itself is always already inset from the physical
    // screen edge by the shell's own safe-area padding (App.css) or the
    // arranger's (tracksArranger.css), so a popover opened a few px from it
    // never actually reaches a notch or home-indicator in practice. A flat
    // viewport margin is enough.
    let top = triggerRect.bottom + menuTriggerGap
    if (top + menuHeight > viewportHeight - menuViewportMargin) top = triggerRect.top - menuHeight - menuTriggerGap
    top = Math.max(menuViewportMargin, top)

    setPosition({ top, left })
  }, [open])

  /** A popover positioned once, from the trigger's screen coordinates at
      open time, would silently detach from it the instant the page (or
      either of TRACKS' own scroll containers - the arranger rail, the
      compact row list) scrolls. Closing on scroll is simpler than
      continuously re-measuring, and just as correct - the same tradeoff
      useOutsideDismiss already makes for an outside click. Capture phase on
      document is what catches scroll on any inner scroll container: the
      native `scroll` event does not bubble, but a capture-phase listener
      still sees it on the way down to whichever element actually scrolled. */
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    document.addEventListener('scroll', close, { capture: true })
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('scroll', close, { capture: true })
      window.removeEventListener('resize', close)
    }
  }, [open])

  const handleAddClipFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) onImportClipToTrack(track.id, file)
  }

  const runAndClose = (action: () => void) => {
    action()
    setOpen(false)
  }

  return (
    <div className="tracks-controls-row">
      <button type="button" className={track.muted ? 'mixer-toggle tracks-mini-toggle mixer-toggle-active' : 'mixer-toggle tracks-mini-toggle'} aria-pressed={track.muted} aria-label={`${track.name} mute`} onClick={() => onSetTrackMuted(track.id, !track.muted)}>M</button>
      <button type="button" className={track.solo ? 'mixer-toggle tracks-mini-toggle mixer-toggle-active' : 'mixer-toggle tracks-mini-toggle'} aria-pressed={track.solo} aria-label={`${track.name} solo`} onClick={() => onSetTrackSolo(track.id, !track.solo)}>S</button>
      <button type="button" ref={triggerRef} className={open ? 'mixer-toggle tracks-mini-toggle mixer-toggle-active' : 'mixer-toggle tracks-mini-toggle'} aria-label={`More actions for ${track.name}`} aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((current) => !current)}>•••</button>

      {open && createPortal(
        <div ref={menuRef} className="track-menu-panel" role="group" aria-label={`${track.name} actions`} style={{ top: position?.top ?? 0, left: position?.left ?? 0, visibility: position ? 'visible' : 'hidden' }}>
          {selectedClip && (
            <>
              <button type="button" className="track-menu-row" disabled={!canSplitSelectedClip} onClick={() => runAndClose(() => onSplitClipAtPlayhead(track.id, selectedClip.id))}>Split at playhead</button>
              <button type="button" className="track-menu-row" onClick={() => runAndClose(() => onDuplicateClip(track.id, selectedClip.id))}>Duplicate clip</button>
              <button type="button" className={selectedClip.loop ? 'track-menu-row track-menu-row-value track-menu-row-value-active' : 'track-menu-row track-menu-row-value'} aria-pressed={selectedClip.loop} onClick={() => runAndClose(() => onToggleClipLoop(track.id, selectedClip.id))}>
                <span>Loop</span><span className="track-menu-row-value-text">{selectedClip.loop ? 'On' : 'Off'}</span>
              </button>
            </>
          )}

          <button type="button" className={selectedClip ? 'track-menu-row track-menu-row-divider' : 'track-menu-row'} onClick={() => runAndClose(() => onOpenTrackEditor(track.id))}>Open track editor</button>
          <button type="button" className="track-menu-row" onClick={() => runAndClose(() => onMoveTrackOrder(track.id, 'up'))}>Move track up</button>
          <button type="button" className="track-menu-row" onClick={() => runAndClose(() => onMoveTrackOrder(track.id, 'down'))}>Move track down</button>
          <label className="track-menu-row track-menu-file-item">
            Import clip…
            <input type="file" accept="audio/wav,.wav" disabled={!audioReady} onChange={handleAddClipFile} onClick={() => setOpen(false)} ref={addClipInputRef} />
          </label>

          {selectedClip && (
            <button type="button" className="track-menu-row track-menu-row-divider track-menu-row-danger" onClick={() => runAndClose(() => onRequestRemoveClip(track.id, selectedClip.id))}>Delete clip</button>
          )}
          <button type="button" className={selectedClip ? 'track-menu-row track-menu-row-danger' : 'track-menu-row track-menu-row-divider track-menu-row-danger'} onClick={() => runAndClose(() => onRequestRemoveTrack(track.id))}>Remove track</button>
        </div>,
        document.body,
      )}
    </div>
  )
}

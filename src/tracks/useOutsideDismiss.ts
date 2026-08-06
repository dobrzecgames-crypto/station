import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

/**
 * Closes an open popover/menu on a pointerdown outside `ref`'s subtree, or
 * on Escape - the same outside-pointerdown pattern shell/SliderMagnifier.tsx
 * already uses at the app root (capture phase, so it fires before the
 * target's own click handler and works for touch as well as mouse), just
 * scoped to one popover's own ref instead of a single global listener.
 * Shared by SnapGridSelect and TracksArranger's own overflow menu.
 *
 * Only subscribes while `active` is true, so a closed menu costs nothing.
 * `onDismiss` is read through a ref (the same always-current-ref shape
 * useTrackClipDrag.ts's dragRef already uses) so the effect only
 * re-subscribes when `active` actually toggles, not on every render.
 */
export function useOutsideDismiss(ref: RefObject<HTMLElement | null>, active: boolean, onDismiss: () => void): void {
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss

  useEffect(() => {
    if (!active) return
    const handlePointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onDismissRef.current()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismissRef.current()
    }
    document.addEventListener('pointerdown', handlePointerDown, { capture: true })
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, { capture: true })
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [active, ref])
}

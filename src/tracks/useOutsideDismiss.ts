import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

type DismissRef = RefObject<HTMLElement | null>

/**
 * Closes an open popover/menu on a pointerdown outside every given ref's
 * subtree, or on Escape - the same outside-pointerdown pattern shell/SliderMagnifier.tsx
 * already uses at the app root (capture phase, so it fires before the
 * target's own click handler and works for touch as well as mouse), just
 * scoped to one popover's own ref(s) instead of a single global listener.
 * Shared by SnapGridSelect, TracksArranger's own overflow menu, and
 * TrackControls' track-actions menu.
 *
 * Accepts one ref or a list. A portaled popover (see TrackControls.tsx)
 * needs two - its trigger and its panel are no longer DOM descendants of
 * one another once the panel renders into document.body via createPortal,
 * so a single ref's .contains() check would treat a click inside the
 * (portaled) panel itself as "outside" and self-dismiss before the item's
 * own onClick ever ran. "Outside" here means outside all of them at once.
 *
 * Only subscribes while `active` is true, so a closed menu costs nothing.
 * `onDismiss` and `refs` are both read through a ref (the same
 * always-current-ref shape useTrackClipDrag.ts's dragRef already uses) so
 * the effect only re-subscribes when `active` actually toggles, not on
 * every render - important for `refs` specifically, since a caller passing
 * an inline array literal (`[triggerRef, menuRef]`) hands this a new array
 * identity on every render even though the refs themselves are stable.
 */
export function useOutsideDismiss(refs: DismissRef | DismissRef[], active: boolean, onDismiss: () => void): void {
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss
  const refsRef = useRef(refs)
  refsRef.current = refs

  useEffect(() => {
    if (!active) return
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      const list = Array.isArray(refsRef.current) ? refsRef.current : [refsRef.current]
      const isInside = list.some((ref) => ref.current?.contains(target))
      if (!isInside) onDismissRef.current()
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
  }, [active])
}

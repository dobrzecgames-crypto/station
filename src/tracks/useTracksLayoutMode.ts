import { useEffect, useState } from 'react'

/**
 * Short axis below this is treated as "phone-class", regardless of which way
 * it is held - a phone's narrow physical dimension rarely exceeds this even
 * at its largest (a big phone in landscape is still only ~930x430); a small
 * tablet in portrait is already past it (~768x1024). Orientation-invariant
 * on purpose: this is what lets the same rule tell a landscape phone apart
 * from a portrait tablet instead of guessing from `orientation` alone. See
 * docs/DECISIONS.md DEC-027.
 */
const phoneClassMaxShortAxisPx = 500

export type TracksLayoutMode = 'compact' | 'wide'

function computeMode(): TracksLayoutMode {
  if (typeof window === 'undefined') return 'compact'
  const isPhoneClass = Math.min(window.innerWidth, window.innerHeight) < phoneClassMaxShortAxisPx
  const isLandscape = window.innerWidth > window.innerHeight
  // Phone portrait is the only case that stays compact - phone landscape,
  // any tablet orientation and any desktop window all get the wide arranger.
  return !isPhoneClass || isLandscape ? 'wide' : 'compact'
}

/**
 * TRACKS' own layout switch. Listens continuously (matchMedia + change, the
 * same shape the historical claude/desktop-layout-foundation branch's
 * useIsDesktopLayout already used - not a resize-event poll) regardless of
 * which tab is active, because it is cheap and side-effect-free to compute.
 * The caller is responsible for only acting on the result while
 * mainView === 'tracks': rotation must never switch tabs on its own (see
 * DEC-027) - this hook only ever answers "which TRACKS layout", never
 * "should TRACKS be open".
 */
export function useTracksLayoutMode(): TracksLayoutMode {
  const [mode, setMode] = useState<TracksLayoutMode>(() => computeMode())

  useEffect(() => {
    const widthQuery = window.matchMedia(`(max-width: ${phoneClassMaxShortAxisPx - 1}px)`)
    const heightQuery = window.matchMedia(`(max-height: ${phoneClassMaxShortAxisPx - 1}px)`)
    // Either query changing (or a plain resize/orientationchange) is just a
    // wake-up signal - the handler always recomputes the full mode from
    // live window dimensions, so it stays correct regardless of which
    // signal actually fired. Belt-and-suspenders on purpose: matchMedia
    // 'change' is the standards-track signal, but mobile browsers have a
    // history of inconsistent timing between resize/orientationchange/
    // matchMedia around real device rotation, which is exactly why the
    // brief itself calls out "browser może różnie raportować zmianę
    // orientacji" - see docs/DECISIONS.md DEC-027's addendum.
    const onChange = () => setMode(computeMode())
    onChange()
    widthQuery.addEventListener('change', onChange)
    heightQuery.addEventListener('change', onChange)
    window.addEventListener('resize', onChange)
    window.addEventListener('orientationchange', onChange)
    return () => {
      widthQuery.removeEventListener('change', onChange)
      heightQuery.removeEventListener('change', onChange)
      window.removeEventListener('resize', onChange)
      window.removeEventListener('orientationchange', onChange)
    }
  }, [])

  return mode
}

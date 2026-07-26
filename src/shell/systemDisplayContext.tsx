import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { DisplayTenant } from './SystemDisplay'

/** What a context does to the display. Step 2 of docs/SYSTEM_DISPLAY.md. */
export interface SystemDisplayApi {
  /** Take the display. Claiming under an id that already owns it updates what
      is shown rather than handing ownership over again - the document calls a
      repeat claim a no-op, which is true of ownership but cannot be true of the
      content, or a readout could never change while its owner held the screen. */
  claim: (tenant: DisplayTenant) => void
  /** Give it back, but only if `id` still owns it. Without the guard a context
      unmounting late - after a newer one has already claimed - would blank a
      display that had stopped being its own. */
  release: (id: string) => void
  /** Who holds it, so a context that keeps its claim up to date can tell when
      it has been taken over and stop pushing. Without this, a context that
      re-claims whenever its data changes quietly steals the display back from
      whoever replaced it. */
  ownerId: string | null
}

const SystemDisplayContext = createContext<SystemDisplayApi | null>(null)

/** Claim and release from anywhere in the tree. Safe to call from a workspace
    that is nowhere near the transport. */
export function useSystemDisplay(): SystemDisplayApi {
  const api = useContext(SystemDisplayContext)
  if (!api) throw new Error('useSystemDisplay must be used inside SystemDisplayProvider')
  return api
}

/** Held by App, which owns the display's state and hands the winner to the
    transport. Returns the current owner - null when nothing has claimed, which
    is when the transport falls back to tempo so the floor is never empty. */
export function useSystemDisplayHost(onClaimedChange: (claimed: boolean) => void) {
  const [owner, setOwner] = useState<DisplayTenant | null>(null)
  /* The guard reads a ref rather than the state it mirrors. Two releases in one
     tick both see the same stale state value, and putting the check inside the
     updater would mean firing onClaimedChange from there - an effect in a
     function React is free to call twice. */
  const ownerIdRef = useRef<string | null>(null)

  const claim = useCallback((tenant: DisplayTenant) => {
    const isNewOwner = ownerIdRef.current !== tenant.id
    ownerIdRef.current = tenant.id
    setOwner(tenant)
    // Context changes must never move the workspace under the pointer. A claim
    // updates the display line only; opening its panel is always the user's
    // explicit tap on the display.
    if (isNewOwner) onClaimedChange(false)
  }, [onClaimedChange])

  const release = useCallback((id: string) => {
    if (ownerIdRef.current !== id) return
    ownerIdRef.current = null
    setOwner(null)
    onClaimedChange(false)
  }, [onClaimedChange])

  const api = useMemo<SystemDisplayApi>(() => ({ claim, release, ownerId: owner?.id ?? null }), [claim, release, owner])
  return { owner, api }
}

export function SystemDisplayProvider({ api, children }: { api: SystemDisplayApi; children: ReactNode }) {
  return <SystemDisplayContext.Provider value={api}>{children}</SystemDisplayContext.Provider>
}

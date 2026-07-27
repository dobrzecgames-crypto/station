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
export function useSystemDisplayHost() {
  const [owner, setOwner] = useState<DisplayTenant | null>(null)
  /* The guard reads a ref rather than the state it mirrors. Two releases in one
     tick both see the same stale state value, and the check cannot live inside
     the updater - React is free to call that twice. */
  const ownerIdRef = useRef<string | null>(null)

  /* Neither claim nor release touches whether the panel is open. They used to
     force it shut on every change of owner, on the reasoning that a context
     must not move the workspace under the pointer - but shutting it moves the
     workspace just as far as opening it would, and it fires on something the
     user did not ask for. Changing tabs with the panel open now leaves the
     display exactly as tall as it was, so the navigation under your thumb does
     not slide. Open is the user's state and nothing else writes it. */
  const claim = useCallback((tenant: DisplayTenant) => {
    ownerIdRef.current = tenant.id
    setOwner(tenant)
  }, [])

  const release = useCallback((id: string) => {
    if (ownerIdRef.current !== id) return
    ownerIdRef.current = null
    setOwner(null)
  }, [])

  const api = useMemo<SystemDisplayApi>(() => ({ claim, release, ownerId: owner?.id ?? null }), [claim, release, owner])
  return { owner, api }
}

export function SystemDisplayProvider({ api, children }: { api: SystemDisplayApi; children: ReactNode }) {
  return <SystemDisplayContext.Provider value={api}>{children}</SystemDisplayContext.Provider>
}

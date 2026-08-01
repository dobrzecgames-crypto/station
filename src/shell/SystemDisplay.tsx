import type { ReactNode } from 'react'

/** Whatever owns the display. One at a time.
 *
 *  Step 2 of docs/SYSTEM_DISPLAY.md turns this into something contexts claim
 *  and release. Today the owner is handed in directly and tempo is the only
 *  one there is, but the shape is already the contract, so what changes then
 *  is where the tenant comes from - not what a tenant is. */
export interface DisplayTenant {
  /** Stable identity. Nothing arbitrates on it yet; the release-by-id guard
      will, once contexts can claim. */
  id: string
  /** Pre-formatted, units included. The display never formats values itself -
      it cannot know that 0.01 is 10 ms and not 1%. */
  readout: string
  /** Names the panel and its tap target, e.g. "Tempo and playback". */
  label: string
  /** Rendered into the panel while this tenant owns the display. null means a
      line-only context such as the resting MIX readout. */
  panel: ReactNode
}

interface SystemDisplayProps {
  /** The current tenant: what the line falls back to, and what the panel holds. */
  owner: DisplayTenant
  /** Confirmation shown on the line; clears itself after a few seconds. */
  statusMessage?: string
  /** Ongoing non-live activity such as a recording timer. */
  activityMessage?: string
  /** Failure or blocked action; holds the line until the next action. */
  errorMessage?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/* The one place messages appear, and the only thing on screen that emits light
   rather than reflecting it. A line plus a panel, both inside the same glass.

   The line runs four channels in priority order - error, confirmation, focus
   (not built yet), then the owner's readout as the floor. Higher always wins,
   so a readout can never push a failure off the line.

   The tappable surface is a sibling of the text, not its parent: a live region
   nested inside a button is unreliable, because assistive tech may flatten a
   button's contents to its label and never announce the change. */
export function SystemDisplay({ owner, statusMessage, activityMessage, errorMessage, open, onOpenChange }: SystemDisplayProps) {
  // An error always wins. While a take is running its clock then outranks old
  // confirmations, so the musician never loses the only proof of recording.
  const message = errorMessage ?? activityMessage ?? statusMessage
  const tone = errorMessage ? 'error' : activityMessage ? 'activity' : statusMessage ? 'status' : 'idle'
  /* A line-only tenant - the resting MIX readout, the library's drop prompt -
     has nothing behind the line. The chevron and the tap target used to render
     for it anyway, so tapping the display in MIX toggled state that produced no
     panel: an affordance promising a screen that never arrives.

     While the panel is open they render regardless of the tenant, for two
     reasons: an open panel must always have a way shut, and a line-only tenant
     taking over must not collapse the display and drag the whole workspace up
     with it. It holds the height and shows unlit glass instead. */
  const expandable = owner.panel != null
  const showsControls = expandable || open

  return <div className={`system-display system-display-${tone}`}>
    <div className="system-display-line">
      {/* The tap target covers the line only. It used to span the whole
          display, which was harmless while the display was one row - now it
          would sit on top of the panel and swallow every slider drag. */}
      {showsControls && <button
        className="system-display-surface"
        type="button"
        aria-expanded={open}
        aria-label={`${owner.label} settings`}
        onClick={() => onOpenChange(!open)}
      />}
      {/* Only the message channels are live. The readout channel carries
          parameter values, and a value that moves as a slider is dragged must
          not be announced - a screen reader would read out every intermediate
          step of the drag. Keying on tone remounts the region so a message
          that arrives while an old one is showing still gets read out. */}
      <p
        key={tone}
        className="system-display-text"
        role={tone === 'error' ? 'alert' : tone === 'status' ? 'status' : undefined}
        aria-live={tone === 'idle' || tone === 'activity' ? 'off' : undefined}
      >
        {message ?? owner.readout}
      </p>
      {showsControls && <span className="system-display-chevron" aria-hidden="true">{open ? '▲' : '▾'}</span>}
    </div>
    {open && (
      /* The second strip, and the slot: the owner renders its own controls in
         here. Inside the same glass, so opening the panel grows the screen
         rather than spilling controls into the transport grid around it. A
         line-only owner renders nothing into it and the glass stays dark at
         full height, which is what keeps the tabs below from moving. */
      <div className="system-display-panel" aria-label={owner.label}>{owner.panel}</div>
    )}
  </div>
}

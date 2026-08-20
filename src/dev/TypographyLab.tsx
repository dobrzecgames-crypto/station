import { useEffect, useState } from 'react'
import './TypographyLab.css'

/** Temporary developer tool — see docs/TYPOGRAPHY_AUDIT.md and the typography
 * casting conversation it came out of. Not a Station feature: gated out of
 * every production build by `import.meta.env.DEV`, so `pnpm build` (what
 * Vercel runs) never ships it regardless of whether this file is still
 * imported. Delete this file, TypographyLab.css, and its one mount line in
 * App.tsx once font casting is done - nothing else in the app depends on it.
 *
 * How it works: three independent CSS custom properties -
 * `--type-module-face` / `--type-station-face` / `--type-display-face` -
 * are the only thing this component ever touches, written directly onto
 * `documentElement.style`. Every real consumer (`--station-nav-font`,
 * `--station-display-font`, `--station-control-font`, the base `:root`
 * font-family, `--system-display-font`, and the one instrument-name site in
 * SynthPicker.css) was changed at its *definition*, not its call sites, to
 * read `var(--type-X-face, <original value>)` - see index.css and
 * SynthPicker.css. Unset (the default, and what a reload always returns to)
 * falls through to exactly today's real value with zero visual change. This
 * is why flipping a role here immediately moves every real, already-on-
 * screen instance of that role at once, without a CSS rename anywhere else.
 *
 * POLY's own local display is a deliberate, permanent exception (per the
 * casting conversation) and was never wired to `--type-display-face` - it
 * keeps using `--station-mono-font` directly, untouched by this tool. */

const NONE = 'DEFAULT'

/** Local/system fonts only - nothing downloaded, nothing self-hosted for
 * this pass. Several are already real fallback links in today's stacks
 * (Bahnschrift/Trebuchet MS/Franklin Gothic Medium/Consolas), so they are a
 * safe bet to actually be present; Georgia is included purely as a
 * deliberately different character class (serif) to prove the mechanism
 * handles a real contrast, not as a candidate anyone expects to win. */
const SYSTEM_FONT_CANDIDATES: readonly string[] = [
  NONE,
  '"Segoe UI", sans-serif',
  '"Segoe UI Variable Display", sans-serif',
  '"Bahnschrift", sans-serif',
  '"Trebuchet MS", sans-serif',
  '"Franklin Gothic Medium", "Arial Narrow", sans-serif',
  '"Tahoma", sans-serif',
  '"Consolas", monospace',
  '"Georgia", serif',
  '"Arial Narrow", Arial, sans-serif',
]

type Role = 'module' | 'station' | 'display'

const ROLE_PROPERTY: Record<Role, string> = {
  module: '--type-module-face',
  station: '--type-station-face',
  display: '--type-display-face',
}

function useFaceCycle(role: Role): { index: number; name: string; next: () => void; prev: () => void } {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const property = ROLE_PROPERTY[role]
    const candidate = SYSTEM_FONT_CANDIDATES[index]
    if (candidate === NONE) document.documentElement.style.removeProperty(property)
    else document.documentElement.style.setProperty(property, candidate)
    // Reset on unmount so a Lab that gets removed mid-session (fast refresh,
    // navigating away in dev) never leaves a stray override behind.
    return () => { document.documentElement.style.removeProperty(property) }
  }, [role, index])

  const count = SYSTEM_FONT_CANDIDATES.length
  return {
    index,
    name: SYSTEM_FONT_CANDIDATES[index],
    next: () => setIndex((current) => (current + 1) % count),
    prev: () => setIndex((current) => (current - 1 + count) % count),
  }
}

function FaceRow({ label, role }: { label: string; role: Role }) {
  const face = useFaceCycle(role)
  return (
    <div className="type-lab-row">
      <span className="type-lab-row-label">{label}</span>
      <div className="type-lab-cycle">
        <button type="button" onClick={face.prev} aria-label={`${label} previous font`}>‹</button>
        <span className="type-lab-cycle-name">{face.name}</span>
        <button type="button" onClick={face.next} aria-label={`${label} next font`}>›</button>
      </div>
    </div>
  )
}

/** Font-only: reads the same var()-with-fallback chain the real component
 * would, without adopting its full visual chrome (borders/backgrounds/
 * padding) - kept deliberately plain so the panel stays small on a phone.
 * The real, fully-styled components elsewhere on screen respond live at
 * the same time this renders. */
function Specimen({ role, text, sample }: { role: Role; text: string; sample?: boolean }) {
  const family = role === 'module'
    ? 'var(--type-module-face, var(--station-nav-font))'
    : role === 'display'
      ? 'var(--type-display-face, var(--system-display-font))'
      : 'var(--type-station-face, var(--station-display-font))'
  return <span className="type-lab-specimen" style={{ fontFamily: family }} title={sample ? 'No live non-Display instance today - shown as specimen text using the real token chain.' : undefined}>
    {text}{sample && <sup>*</sup>}
  </span>
}

export function TypographyLab() {
  const [open, setOpen] = useState(false)
  // Closed by default even when the panel is open - the 3 rows are the whole
  // point (they drive every real, already-on-screen instance); the specimen
  // block is a convenience for the handful of words that have no live
  // non-Display instance today, not something that needs to sit open and
  // eat half the screen on a phone. See feedback: the first version covered
  // most of Station at 86vw/70vh.
  const [showSpecimens, setShowSpecimens] = useState(false)
  if (!import.meta.env.DEV) return null

  return <div className="type-lab" data-open={open}>
    {open ? (
      <div className="type-lab-panel" role="dialog" aria-label="Typography Lab">
        <div className="type-lab-header">
          <strong>TYPE LAB</strong>
          <button type="button" className="type-lab-close" onClick={() => setOpen(false)} aria-label="Close Typography Lab">✕</button>
        </div>

        <FaceRow label="MODULE" role="module" />
        <FaceRow label="STATION" role="station" />
        <FaceRow label="DISPLAY" role="display" />

        <button
          type="button"
          className="type-lab-specimens-toggle"
          onClick={() => setShowSpecimens((value) => !value)}
          aria-expanded={showSpecimens}
        >
          {showSpecimens ? '▴ HIDE SPECIMENS' : '▾ SPECIMENS (FILTER, TUNE, dB…)'}
        </button>

        {showSpecimens && <div className="type-lab-specimens">
          <p className="type-lab-specimens-heading">MODULE <span>(also live in the nav bar above)</span></p>
          <div className="type-lab-specimen-line">
            {['LASER', 'PADS', 'SYNTH', 'SEQ', 'SONG', 'WAVES', 'MIX'].map((word) => <Specimen key={word} role="module" text={word} />)}
          </div>

          <p className="type-lab-specimens-heading">STATION <span>(most are also live elsewhere on screen)</span></p>
          <div className="type-lab-specimen-line">
            {['PROJECT', 'BANK', 'PAT', 'MONOGORG', 'BASSIC', 'ZOLA-X'].map((word) => <Specimen key={word} role="station" text={word} />)}
          </div>
          <div className="type-lab-specimen-line">
            <Specimen role="station" text="FILTER" sample />
            <Specimen role="station" text="PARAMETERS" sample />
            <Specimen role="station" text="TUNE" sample />
            <Specimen role="station" text="DECAY" sample />
          </div>
          <div className="type-lab-specimen-line"><Specimen role="station" text="Choose an instrument" /></div>

          <p className="type-lab-specimens-heading">DISPLAY <span>(also live on the transport line by default)</span></p>
          <div className="type-lab-specimen-line">
            <Specimen role="display" text="120 BPM · 0% SWING" />
          </div>
          <div className="type-lab-specimen-line">
            <Specimen role="display" text="BANK 08" />
            <Specimen role="display" text="PAD 01" />
            <Specimen role="display" text="-18.0 dB" sample />
            <Specimen role="display" text="READY" />
          </div>
          <p className="type-lab-note"><sup>*</sup> no live non-Display instance today — see docs/TYPOGRAPHY_AUDIT.md §2</p>
        </div>}
      </div>
    ) : null}
    <button type="button" className="type-lab-toggle" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={open ? 'Close Typography Lab' : 'Open Typography Lab'}>
      TYPE
    </button>
  </div>
}

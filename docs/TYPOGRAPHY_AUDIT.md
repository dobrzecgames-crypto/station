# Station Typography Audit — Claude, 2026-08-12

Read-only audit performed against `main` at commit `11979f7` ("docs: define
Station typography architecture"), the commit that introduced
`TYPOGRAPHY_BIBLE.md`. No code was changed to produce this document. This is
a snapshot, not a source of truth — `TYPOGRAPHY_BIBLE.md` remains that. Treat
this as input for the next staged prompt, not as a decision.

---

## 1. Current font inventory

Three fonts are genuinely self-hosted via `@font-face` in `src/index.css`,
with real `.woff2` files in `public/fonts/` (latin + latin-ext, for Polish
diacritics):

| Font | Loaded weight | File |
| --- | --- | --- |
| Inter | **400 only** | `inter-400-latin(-ext).woff2` |
| Rajdhani | **600 only** | `rajdhani-600-latin(-ext).woff2` |
| IBM Plex Mono | **400 only** | `ibm-plex-mono-400-latin(-ext).woff2` |

`:root` sets `font-synthesis: none` — no fake-bold, anywhere.

Five CSS custom properties currently carry font stacks, none mapping 1:1 to
MODULE/STATION/DISPLAY:

| Token | Value | Self-hosted? |
| --- | --- | --- |
| `font-family` (base, on `:root`) | `"Inter", "Segoe UI Variable", "Segoe UI", ui-sans-serif, system-ui, sans-serif` | yes (Inter@400) |
| `--station-nav-font` | `"Trebuchet MS", Tahoma, "Segoe UI", sans-serif` | no — system stack |
| `--station-display-font` | `"Rajdhani", "Bahnschrift", "Arial Narrow", "Segoe UI", sans-serif` | yes (Rajdhani@600) |
| `--station-control-font` | `"Franklin Gothic Medium", "Arial Narrow", "Segoe UI", sans-serif` | no — system stack |
| `--station-mono-font` | `"IBM Plex Mono", ui-monospace, "Cascadia Mono", Consolas, monospace` | yes (Plex@400) |
| `--system-display-font` | `Consolas, "DejaVu Sans Mono", var(--station-mono-font)` | no — Consolas wins first, Plex Mono is rarely reached on Windows |

**Naming trap:** `--station-display-font` (Rajdhani) is **not** the
TYPOGRAPHY_BIBLE.md "DISPLAY FACE". It is a legacy token from the old
DESIGN_SYSTEM.md scheme ("Headings = Rajdhani SemiBold"), used as a general
heading font across the machine — not scoped to System Display. The real,
correctly-scoped Display font is the confusingly similar `--system-display-font`
(Consolas). One word apart, unrelated concepts.

---

## 2. Typography role map (grouped)

| Element | File | Font | Size | Weight | Tracking | Transform | Target role | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MODULE keys LASER/PADS/SYNTH/SEQ/SONG/WAVES/MIX | `MainNavigation.tsx` + `vinyl-dust.css:83-95` | `--station-nav-font` (Trebuchet MS) | `.58rem` | 600 | `.045em` | none (literal uppercase in JSX) | **MODULE** | Already isolated to nav only; engraved `text-shadow` already implemented |
| Transport: PLAY/STOP/REC, PAT/SONG, bank +/−, variant A-D, UNDO/REDO menu | `TransportBar.tsx` + **`App.css` legacy rule** | `--station-display-font` (Rajdhani) | `.5–.61rem` | unset (~inherit 400) | `.07em` | none (literal caps) | STATION | See Conflict #1 — surprising cascade winner |
| `.eyebrow` — section heading (LIBRARY, DRUM SYNTH, BUS & FX, CHANNELS, SAMPLE, PROJECT KEY, MANUAL SLICES, SYNTH, LIVE SLICE MAP, MONOGORG/POLY/STRINGS "/ {pad}") | 12+ TSX files + `App.css` (font-family) + `lab-interface.css:358-363` | `--station-display-font` (Rajdhani) | `.6rem` | **800 requested, only 600 loaded** | `.16em` | uppercase | **SECTION/GROUP** | Most-used heading pattern in the app (~20 sites) |
| System Display — compact line | `SystemDisplay.tsx` (`.system-display-text`) | `--system-display-font` (Consolas) | not captured | — | — | — | DISPLAY | Correctly scoped |
| System Display — expanded panel param rows (FILTER/ATTACK/DECAY for MONOPOLY/STRINGS/FX) | `SynthDisplay.tsx`, `EffectDisplay.tsx`, `StringsDisplay.tsx`, `PadDisplay.tsx` → `.display-param-label`/`output` | `--system-display-font` | `.64rem` (label) | inherit | `.05em` | uppercase (label) | DISPLAY | All 4 checked adopters correctly claim `DisplayTenant` |
| System Display tenant — **POLY** readout (OSC/FILTER/ENVELOPE/MOD) | `PolyWorkspace.tsx:141-146` (`.poly-display-readout`) | `--station-mono-font` — **not** `--system-display-font` | `.57rem` | **700 requested, only 400 loaded** | `.045em` | none | should be DISPLAY | **Confirmed encapsulation exception — see §4** |
| SYNTH picker — instrument names MONOPOLY/MONOGORG/STRINGS/POLY | `SynthPicker.css:80-85` | `--station-mono-font` | `.78rem` | **700 requested, only 400 loaded** | `.06em` | none (literal caps) | **IDENTITY → STATION** | The bible names these exact instruments as the Level C example and says they belong to Station Face |
| SYNTH picker — instrument descriptions | `SynthPicker.css:87-91` | inherit (Inter) | `.64rem` | inherit (400) | none | none | READING TEXT | Closest existing match to target already |
| MIX — routing/FX disclosure header | `mixer.css:246-253` (`.mix-routing > summary`) | `--station-display-font` (Rajdhani) | not captured | — | — | none | STATION | Another Rajdhani leak |
| MIX — SMART PUMP source name | `mixer.css:387-390` (`.pump-source-control > strong`) | `--station-display-font` (Rajdhani) | — | — | — | — | STATION | Another leak |
| MIX — pump entry text | `mixer.css:527-530` | `--station-display-font` (Rajdhani) | — | — | — | — | STATION | Another leak |
| MIX — channel fader values, meter ticks | `mixer.css` mono-font sites | `--station-mono-font` | — | — | — | — | CONTROL (numeric) | **Legitimate use** — real measurement |
| BANK select (trigger/options/rename) | `BankSelect.tsx` + `lab-interface.css:173-242` | `--station-control-font` (Franklin Gothic Medium, system-only) | — | — | — | — | STATION | 4th font role, unmapped to the new architecture — see Conflict #7 |
| Mono beyond numbers: all of POLY's labels, `library-heading span`, `chord-display-summary`, `pad-browser`, `project-display`, `strings-workspace`, `tracks-arranger/workspace` | many files | `--station-mono-font` | `.49–.78rem` | mostly **700, only 400 loaded** | `.04–.06em` | mixed | mostly STATION | Widest single conflict — mono spread far past "measurement" |
| Body / reading text | base `:root` + scattered | Inter | varies | mostly 400, some 800 on small captions | varies | mixed | READING TEXT | OK as placeholder |
| h1/h2/h3 (legacy) | `lab-interface.css:366` | `--station-display-font` (Rajdhani) | `1–2.5rem` | inherit | inherit | none | possibly dead | Worth a live check — may not render in current UI at all |

---

## 3. Conflicts with TYPOGRAPHY_BIBLE.md

1. **App.css's "dead" rule isn't dead.** `lab-interface.css` claims to load
   last and win over App.css — true for background/border/shadow, **false
   for `font-family`** on `.transport-button`, `.mixer-toggle`, `.step`,
   `.group-strip-button`, `.group-strip-master`. Neither `lab-interface.css`
   nor `vinyl-dust.css` ever redeclares `font-family` for those selectors
   (`.main-nav-button` is the one exception, overridden by
   `vinyl-dust.css:91`). Confirmed via live cascade inspection, not just
   source reading. Transport therefore renders in Rajdhani today.
2. **Rajdhani is explicitly blacklisted** (`TYPOGRAPHY_BIBLE.md §11`) and
   leaks into ~7 non-Display places: transport, all `.eyebrow` instances
   (~20 sites), `.mix-routing summary`, `.pump-source-control`,
   `.mix-pump-entry`, h1/h2/h3.
3. **Weight requested that doesn't exist.** 59× `font-weight: 800`, 15×
   `700` across the repo; only Inter@400, Rajdhani@600, Plex Mono@400 are
   loaded, and `font-synthesis: none` blocks fake-bold. ~74 sites likely
   render at their nearest real loaded weight instead of the requested one
   — not visually confirmed live yet (browser session dropped mid-audit),
   flagged as a spec-derived deduction to verify.
4. **Instrument names (MONOPOLY/MONOGORG/STRINGS/POLY) render in the mono
   font** instead of Station Face, despite being the bible's own Level C —
   IDENTITY example.
5. **Mono spread far past "measurement"** — POLY's entire label vocabulary,
   instrument names, several workspace headings.
6. **Two similarly-named tokens, unrelated jobs:** `--station-display-font`
   (Rajdhani, general heading) vs `--system-display-font` (Consolas, the
   real Display). One word apart.
7. **`--station-control-font`** (Franklin Gothic Medium) — 3 usages, all on
   BANK select. Doesn't map to MODULE/STATION/DISPLAY at all; smallest,
   most isolated of the current font roles.
8. **Letter-spacing has no system** — 20+ distinct tracking values in use,
   `-.02em` to `.16em`, including duplicate values differing only in
   `.04em` vs `0.04em` formatting.
9. **Cultural-association risk:** Rajdhani + pervasive uppercase + wide
   tracking (`.16em` on `.eyebrow`) is close to the exact "futuristic
   dashboard" combination §2 of `INTERFACE_BIBLE.md` and §11 of
   `TYPOGRAPHY_BIBLE.md` name as the thing to avoid.

---

## 4. MODULE key typography findings

Style lives in `src/vinyl-dust.css:83-104`. Structure:
`<button data-mechanism="selector"><span data-mechanism-face>LABEL</span></button>`.

Font on the `<button>` itself (`--station-nav-font`, `.58rem`, `600`,
`.045em`); colour/background/shadow on the inner `[data-mechanism-face]`.

**An engraved text effect already exists** — this directly answers whether
one can be added without a rebuild:

```css
/* A shallow engraved legend: the upper cut stays dark and the lower edge
   catches a trace of panel light. No bloom - this is pigment in a groove. */
text-shadow: 0 -1px 0 rgb(0 0 0 / 34%), 0 1px 0 rgb(255 247 238 / 9%);
```

No `::before`/`::after` on the label text. Casing is literal uppercase in
`MainNavigation.tsx` (`label: 'LASER'`), not CSS `text-transform`.

**Conclusion: yes, without a rebuild** — the mechanism is already in place.
Once a final MODULE FACE lands, this is a tuning pass on the shadow
offsets/colours for the new typeface's stroke weight, not new work.

---

## 5. System Display typography findings

Checked 4 real adopters — `SynthDisplay`, `EffectDisplay`, `StringsDisplay`,
`PadDisplay` — all correctly import `DisplayTenant`/`useSystemDisplay` from
`shell/SystemDisplay.tsx` and render through `.display-param-label` /
`.display-param output` / `.display-toggle`, all on `--system-display-font`.
Properly encapsulated.

**One confirmed exception: POLY.** `PolyWorkspace.tsx` does not import
`SystemDisplay`/`DisplayTenant`/`useSystemDisplay` at all. It has its own
local `PolyDisplay` component (line 141-146) that builds a **separate
imitation screen**: its own glass (`.poly-display-glass`), its own phosphor
colour token (`--poly-phosphor-dim`, not `--display-light`), its own SVG
oscilloscope grid, its own font (`--station-mono-font`, not
`--system-display-font`) — rendered directly in POLY's own workspace body,
not inside the real Display panel.

---

## 6. Proposed semantic typography tokens (relative, not final px)

| Level | Relative size | Relative weight | Tracking | Casing | Current closest equivalent |
| --- | --- | --- | --- | --- | --- |
| **SECTION / GROUP** | largest in Station Face | medium/semibold, clearly heavier than CONTROL but lighter than MODULE | moderate, consistent app-wide (today's `.eyebrow` is the widest in the whole audit — candidate to narrow) | UPPERCASE | `.eyebrow` |
| **CONTROL / PARAMETER** | smallest practical for dense panels | regular/medium — never bold just to be bold | tight, minimal | UPPERCASE where it reads as an equipment label | TUNE/DECAY/ATTACK — correctly in Display today via `.display-param-label` where applicable |
| **IDENTITY** | clearly larger than CONTROL, smaller than SECTION | medium/semibold | moderate | UPPERCASE | MONOGORG/MONOPOLY/STRINGS — currently wrong (mono font), target Station Face |
| **READING TEXT** | base legibility size | regular | minimal/none | Sentence case | "Choose an instrument" — already closest to target |

MODULE vs STATION relation per the bible: MODULE = "strong character" (only
7 labels, can be heavier/more distinctive), STATION = "controlled character"
(carries more information, needs restraint). Today's `.58rem/600` (nav) vs
`.6rem/800-requested-but-600-real` (eyebrow) already sits close to that
relationship — worth keeping deliberately, not by accident, once real fonts
land.

---

## 7. Recommended next step

Per `TYPOGRAPHY_BIBLE.md` Phase 5 Step 2 the natural next move is a
Typography Lab — explicitly out of scope for this pass, not started.

Decisions that don't require a font choice and could go first:

1. Whether to remove the `App.css` legacy Rajdhani rule now (§3.1) — no
   visual change either way since no final font is chosen yet, but it stops
   new work from inheriting dead/misleading code.
2. Resolve the `--station-display-font` vs `--system-display-font` naming
   collision as a decision (not code) before the next prompt references
   either name.
3. Decide POLY's fate — join the real `DisplayTenant`, or stay a documented,
   deliberate exception in `SYSTEM_DISPLAY.md`.
4. Then: Typography Lab + the real MODULE/STATION/DISPLAY font choice.

Nothing above has been implemented. Working tree was clean before and after
this audit.

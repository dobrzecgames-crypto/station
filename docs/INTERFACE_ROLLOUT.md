# Station Interface Rollout

This document turns `INTERFACE_BIBLE.md` into an implementation sequence. It exists to prevent a single broad "restyle the app" pass.

## Sources of truth

For UI work use this precedence:

1. `docs/COLOR_BIBLE.md` — colour roles and Vinyl Dust palette.
2. `docs/INTERFACE_BIBLE.md` — physical interaction, material and motion direction.
3. `docs/TYPOGRAPHY_BIBLE.md` — typography architecture, font roles, hierarchy and font-selection rules.
4. `docs/SYSTEM_DISPLAY.md` — display ownership/content behaviour.
5. Feature-specific documents.
6. `docs/DESIGN_SYSTEM.md` — useful historical/current implementation context only where it does not conflict with the sources above.

Do not reinterpret the palette during this rollout.

---

## Phase 1 — Physical foundation + main selectors

### Goal

Prove the Station physical language on the main workspace selector row before spreading it elsewhere.

### Scope

- introduce a small set of reusable CSS custom properties/classes for physical hard-key states;
- convert the main workspace navigation into an interlocked selector-key visual model;
- selected key remains mechanically depressed;
- selecting another key releases the previous one while depressing the new one;
- preserve existing navigation behaviour and workspace colours;
- remove active-state decorative bloom if it conflicts with the physical model;
- keep keyboard focus/accessibility intact;
- add reduced-motion handling where motion is introduced.

### Out of scope

- pads;
- sliders/faders;
- System Display redesign;
- final typography replacement;
- palette changes;
- feature logic changes;
- broad cleanup of unrelated CSS.

### Acceptance

- the current workspace is obvious from depth/light even in greyscale;
- clicking the already selected workspace does not visually release it;
- switching workspace reads as one cassette-radio-style key engaging and the other releasing;
- no `scale(...)` press effect;
- no essential hover dependency;
- no layout shift under the pointer/touch;
- existing workspace accent semantics survive.

Pause for human visual/touch acceptance before Phase 2.

---

## Phase 2 — Rubber performance pads

### Goal

Make playable pads feel like a distinct soft material rather than a repeated generic button.

### Scope

- shared pad material styling;
- resting shallow volume;
- held/pressed compression;
- quick soft elastic release;
- separate visual states for pressed, playing and selected/editing;
- preserve loaded-sample colour semantics;
- pointer cancel / lost pointer must restore the resting physical state;
- reduced-motion fallback.

### Out of scope

- velocity redesign;
- audio trigger logic unless a bug blocks correct visual state;
- pad layout changes;
- new colours;
- final fonts.

### Acceptance

- pad visibly feels softer than a main selector key;
- sample playback does not leave the pad physically depressed after release;
- selection/edit state cannot be mistaken for a held pad;
- rapid tapping does not leave stuck visual state;
- no cartoon bounce or glossy/neon treatment.

Pause for human visual/touch acceptance before Phase 3.

---

## Phase 3 — Control classification audit

### Goal

Map remaining button-like controls to the correct Station physical family.

### Work

Create a short inventory in the implementation report (or a temporary task note) classifying touched controls as:

- SELECTOR,
- LATCH,
- MOMENTARY,
- PAD,
- CONTINUOUS CONTROL.

Then update only the approved batch. Do not restyle every screen automatically.

Recommended batches:

1. transport/performance actions;
2. toggles such as mute/reverse/bypass;
3. destructive/utility actions;
4. secondary selectors.

Acceptance is behavioural clarity first, visual consistency second.

---

## Phase 4 — Continuous controls

### Goal

Give sliders/faders/knobs a deliberate physical control language while preserving immediate musical response.

### Principles

- direct visual response;
- no smoothing that creates latency;
- no generic Material slider thumb;
- no neon VST-ring default;
- touch ergonomics outrank decorative detail;
- keep the current smart touch interaction if it performs better than literal hardware behaviour.

Tune dimensions in the real UI; do not freeze arbitrary measurements from design prose.

---

## Phase 5 — Typography selection (requires human design choice)

### Goal

Replace generic typography with the deliberate three-face Station architecture defined in `TYPOGRAPHY_BIBLE.md`:

- `MODULE FACE` — only the seven main physical workspace selector keys;
- `STATION FACE` — the rest of the physical machine's working language;
- `DISPLAY FACE` — only the System Display's internal computer language.

This is **two fonts belonging to the machine plus one font belonging to its internal computer**, not three competing visual identities.

### Important

**Codex must not select the final fonts autonomously.**

Before implementation, the human design pass must approve all three families and their relationship.

A fourth numeric face should not be introduced unless a concrete functional problem cannot be solved by the chosen Display Face.

Current planned replacements/evaluation:

- Inter -> replace; it is not the intended Station panel identity;
- Rajdhani -> replace; it carries too much generic futuristic/AI UI association;
- IBM Plex Mono -> evaluate rather than automatically retain as a separate face.

### Step 1 — Typography audit

Before choosing fonts, inventory current typography in the real application and classify each exposed text element as:

- MODULE,
- STATION,
- DISPLAY.

Also identify current local font overrides, arbitrary weights, unnecessary bold parameter labels, excessive uppercase tracking and any Display-style typography leaking outside the System Display.

### Step 2 — Typography Lab

Prefer a temporary developer-only Typography Lab inside the real Station interface rather than judging fonts from catalogue specimens.

The lab should let the human designer compare shortlisted candidates in the actual UI without changing product behaviour.

Do not turn the lab into a permanent user-facing feature.

### Font evaluation specimen

Every candidate should be compared using real Station strings including at least:

`STATION`

`LASER`
`PADS`
`SYNTH`
`SEQ`
`SONG`
`WAVES`
`MIX`

`PARAMETERS`
`FILTER`
`DECAY`
`TUNE`
`MASS`

`MONOGORG`
`MONOPOLY`
`STRINGS`

`Choose an instrument`

`120 BPM · 0% SWING`
`BANK 08 · PAT A`
`PAD 01`
`-18.0 dB`
`0123456789`

Also verify Polish diacritics where required.

Evaluate small-size legibility on the actual phone/browser size, density, numeral stability, weight range, cultural association and whether the faces read as deliberate Station choices rather than fashionable web defaults.

Pause for human typography acceptance before implementation spreads the selected faces across the app.

---

## Phase 6 — System Display type/layout refinement

### Goal

Make the existing System Display feel like Station's internal computer without faking obsolete technology.

Preserve `SYSTEM_DISPLAY.md` ownership and behaviour.

Allowed:

- typography;
- hierarchy;
- line/indicator treatment;
- modern high-resolution visualisation;
- restrained light behaviour consistent with the existing display model.

Avoid:

- fake scanline/VHS damage;
- forced pixelation;
- Matrix terminal cliché;
- generic cards and pills inside the glass;
- changes to display ownership just to achieve a visual effect.

---

## Phase 7 — Consistency audit

Only after Phases 1–6 have been accepted.

Audit every workspace for:

- wrong physical family;
- stuck/ambiguous pressed state;
- hover-dependent information;
- decorative glow violating Vinyl Dust semantics;
- old generic typography surviving in exposed UI;
- inconsistent depth/light;
- `transition: all`;
- broad `scale(...)` button press patterns;
- playing/selected/pressed conflation;
- unnecessary new colours;
- accessibility regressions.

The audit should fix inconsistencies, not redesign features.

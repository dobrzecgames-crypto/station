# Station Interface Rollout

This document turns `INTERFACE_BIBLE.md` into an implementation sequence. It exists to prevent a single broad "restyle the app" pass.

## Sources of truth

For UI work use this precedence:

1. `docs/COLOR_BIBLE.md` — colour roles and Vinyl Dust palette.
2. `docs/INTERFACE_BIBLE.md` — physical interaction, material, motion and typography direction.
3. `docs/SYSTEM_DISPLAY.md` — display ownership/content behaviour.
4. Feature-specific documents.
5. `docs/DESIGN_SYSTEM.md` — useful historical/current implementation context only where it does not conflict with the sources above.

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

Replace generic typography with two deliberate Station faces.

### Important

**Codex must not select the final fonts autonomously.**

Before implementation, the human design pass must approve:

- `PANEL FACE` — non-digital physical instrument lettering;
- `DISPLAY FACE` — device/computer/digital lettering;
- whether a separate numeric mono face is still needed.

Current planned replacements:

- Inter -> replace as panel identity;
- Rajdhani -> replace as display/headline identity;
- IBM Plex Mono -> evaluate rather than automatically retain.

### Font evaluation specimen

Every candidate should be compared in the actual Station UI using at least:

`STATION`
`LASER`
`PADS`
`SYNTH`
`SEQ`
`MIX`
`GRAVITY`
`MASS`
`DUST`
`FIRE`
`PATTERN 04`
`120 BPM`
`-18.0 dB`
`0123456789`

Evaluate small-size legibility, Polish diacritics where required, numeral stability, and whether the face reads as a deliberate Station choice rather than a fashionable web default.

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

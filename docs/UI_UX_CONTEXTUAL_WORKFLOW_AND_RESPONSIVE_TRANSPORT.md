# Station — contextual workflow and responsive transport plan

## Status

- Scope: UI hierarchy, spacing, responsive behavior and contextual workflow
- Product: browser-based sampler groovebox
- Target: desktop, tablet and mobile browsers
- Out of scope: DSP, audio routing, new DAW features, data-model changes and full navigation redesign

## 1. Goal

Station should guide the user through a natural groovebox workflow without locking navigation or turning the app into a step-by-step wizard.

The default path should be visible in the interface:

```text
Load sample → chop → assign slices to pads → edit pad behavior → program pattern → shape mix and FX
```

The user must still be free to switch manually between all existing workspaces at any time.

The reorganization should solve two related problems:

1. global transport controls, especially BPM and Swing sliders, consume too much vertical space;
2. important existing actions are not always visible in the workspace where the user expects them.

The interface should answer three questions in every workspace:

1. What am I working on?
2. What is the main action here?
3. What is the logical next step?

## 2. Core UX principle

Do not expose every control at the same visual priority.

Use three levels:

1. **Always available:** Play/Pause, Stop, REC and current musical context.
2. **Easy to open:** BPM, Swing, metronome, Loop Song and project-level transport settings.
3. **Contextual:** pad behavior, slice actions, step parameters, channel controls, Pump and FX parameters.

Station should guide by hierarchy, empty states and contextual calls to action, not by blocking the user behind a wizard.

## 3. Recommended global layout

### 3.1 Desktop

Use two compact top rows.

#### Global header

```text
STATION | LIBRARY CHOP PADS SEQ SONG MIX | AUDIO | PROJECT
```

Recommended height: `48–52 px`.

Contains:

- application identity;
- main workspace navigation;
- compact audio status;
- Project menu.

#### Music context bar

```text
[PLAY/PAUSE] [STOP] [REC] | PATTERN/SONG | GROUP 1 | A B C D | 124 BPM ▾ | SETTINGS
```

Recommended height: `44–48 px`.

Always visible:

- Play/Pause;
- Stop;
- REC;
- Pattern/Song mode;
- current Pattern Group;
- current Variant;
- compact BPM value;
- button opening Transport / Project settings.

Do not render BPM and Swing as permanently visible full-width sliders.

Clicking the BPM value or settings button opens a compact popover or side panel:

```text
BPM
Swing
Metronome
Loop Song
```

Recommended width: `280–320 px`.

### 3.2 Mobile

Use a compact top header and a bottom mini-transport.

#### Top header

```text
MENU | STATION | G1 · A | SETTINGS
```

Recommended height: `44–48 px`.

Contains:

- application identity or menu access;
- abbreviated current group and variant;
- settings entry point.

#### Bottom mini-transport

```text
[STOP] [PLAY/PAUSE] [REC]
```

Recommended height: `52–60 px`.

Only these actions remain permanently visible.

A very small BPM readout may be shown near Play/Pause, but not as a slider.

Tapping BPM or Settings opens a bottom sheet:

```text
TRANSPORT

Pattern / Song
BPM
Swing
Metronome
Loop Song
Group
Variant
```

The bottom sheet should:

- occupy no more than about `55–65%` of screen height;
- close by tapping outside, using Escape or dragging down;
- return the user to the same scroll and workspace position.

### 3.3 Tablet

Use a compact single-row transport where possible:

```text
[PLAY] [STOP] [REC] | G1 | A | 124 BPM | SETTINGS
```

Rules:

- abbreviate `GROUP 1` to `G1` when space is limited;
- collapse Variant A–D into a compact selector when necessary;
- keep Swing, metronome and Loop Song inside settings;
- portrait tablets may use the mobile bottom transport;
- landscape tablets may use the desktop top transport.

## 4. What stays visible and what collapses

### Always visible

Desktop:

- Play/Pause;
- Stop;
- REC;
- Pattern/Song mode;
- current Pattern Group;
- current Variant;
- compact BPM value.

Mobile:

- Play/Pause;
- Stop;
- REC;
- abbreviated current Group and Variant.

### Collapsed into Transport / Project settings

- full BPM control;
- Swing;
- metronome;
- Loop Song;
- secondary transport options;
- Project Key if still present;
- other project-level settings not needed during normal pad, chop, sequence or mix work.

### Contextual controls

Show only when relevant:

- selected pad playback behavior;
- sample start/end editing;
- slice editing and assignment;
- selected step parameters;
- selected mixer channel;
- Pump controls;
- Group FX slot;
- Master FX slot.

Use one shared contextual panel rather than adding full parameter blocks below every section.

## 5. Responsive breakpoints and spacing

### Mobile: `0–599 px`

- single-column layout;
- workspace horizontal padding: `12 px`;
- gap between major sections: `16 px`;
- gap inside control groups: `8 px`;
- minimum touch target: `44 × 44 px`;
- sticky bottom transport: `52–60 px`;
- no permanent global sliders;
- main workspace tool appears before descriptive text and secondary controls;
- contextual parameter panels use one column;
- no horizontal scroll for the entire page;
- local horizontal scroll is acceptable for the sequencer grid.

### Tablet: `600–1023 px`

- workspace padding: `16 px`;
- major section gap: `20 px`;
- use two columns only for controls of equal priority;
- compact one-row transport where possible;
- contextual panel may be bottom or side-based depending on orientation;
- portrait behaves closer to mobile;
- landscape behaves closer to desktop.

### Desktop: `1024 px+`

- workspace padding: `20–24 px`;
- major section gap: `24 px`;
- card padding: `12–16 px`;
- global header: approximately `50 px`;
- music context bar: approximately `46 px`;
- two-column parameter layouts are allowed;
- prefer local workspace scroll over a long document-style page.

The layout must be explicitly tested at `1366 × 768`.

## 6. Workspace information priority

## 6.1 Library

### Empty/default priority

Primary message:

```text
CHOOSE A SAMPLE
```

Order:

1. sample list or browser;
2. preview;
3. destination pad or Pattern Group context;
4. primary action.

Primary action:

```text
LOAD TO PAD
```

Secondary action:

```text
OPEN IN CHOP
```

Do not hide these operations in small trailing buttons.

Optional lightweight progress copy:

```text
1. Choose sample
2. Preview
3. Load to a pad or open in CHOP
```

## 6.2 CHOP

### Empty state

When no sample is loaded, show:

```text
LOAD A SAMPLE TO START CHOPPING
[OPEN LIBRARY]
```

Do not prioritize an empty waveform and many disabled controls.

### Loaded state order

1. sample name and current Group context;
2. waveform as the largest element;
3. Add Slice or current chop mode;
4. slice list;
5. assignment action.

Primary completion action:

```text
ASSIGN SLICES TO PADS
```

After assignment:

```text
8 SLICES ASSIGNED TO PADS
[GO TO PADS]
```

The transition is suggested, not forced.

## 6.3 PADS

The selected pad must immediately show:

```text
PAD 3
Sample name
```

The control determining how the sample plays or stops must be placed high in the selected-pad editor.

Examples of this class of control include the existing behavior equivalent to:

```text
ONE SHOT / GATE
```

or another existing Station label controlling whether the sample is cut, held or allowed to finish.

This setting belongs in PADS because it describes the behavior of the selected pad. It must not be hidden in an unrelated global or later-stage screen.

Recommended order:

1. selected pad identity;
2. playback/stop behavior;
3. volume and pitch;
4. start/end or sample region;
5. other existing pad-level controls;
6. Edit Sample action;
7. source slice information.

After pads are ready, show:

```text
PADS READY
[PROGRAM PATTERN]
```

## 6.4 SEQ

Always show the current musical scope first:

```text
GROUP 1 · VARIANT A
```

Priority:

1. step grid;
2. currently playing step;
3. selected pad or row;
4. selected step parameters in the shared context panel.

Empty state:

```text
TAP STEPS TO BUILD YOUR PATTERN
```

Active state may show a compact summary such as:

```text
PATTERN A · 7 ACTIVE STEPS
```

Do not keep large instructional text visible once the pattern contains data.

## 6.5 SONG

Priority:

1. current playback position;
2. Pattern Group and Variant sequence;
3. add, duplicate and arrange actions;
4. Loop Song.

Loop Song remains available globally in Transport settings, but may also appear locally in SONG because this is its strongest context.

## 6.6 MIX

Order information from scope to detail:

1. current Pattern Group;
2. channels in that group;
3. Pump / sidechain;
4. Group FX Rack;
5. Master;
6. Master FX Rack.

Do not render complete parameters for every effect at once.

FX cards should stay compact:

```text
FX 1
COMPRESSOR
ON
```

or:

```text
FX 2
ADD EFFECT
```

Clicking a channel, Pump or FX slot opens the shared contextual panel.

Mobile uses a bottom sheet. Desktop uses a bottom or right-side panel.

## 7. Shared contextual panel

Use one active context at a time.

Supported contexts may include:

- pad;
- sample;
- slice;
- sequencer step;
- mixer channel;
- Pump;
- Group FX slot;
- Master FX slot;
- Master bus.

Rules:

- selecting another compatible item replaces panel content;
- it must not append another long section to the page;
- changing workspace may close the panel;
- the panel header must state the exact scope being edited;
- mobile panel controls use one column;
- desktop may use two columns;
- no manual resizing is required.

## 8. Concrete UI changes

### P0 — required small reorganization

1. Replace permanent BPM and Swing sliders with a compact BPM value and settings button.
2. Keep only Play/Pause, Stop and REC permanently visible on mobile.
3. Move full BPM, Swing, metronome and Loop Song controls into Transport / Project settings.
4. Keep Group and Variant visible on desktop.
5. Show Group and Variant as a compact `G1 · A` context on mobile.
6. Add a clear empty state to Library and CHOP.
7. Show `Assign slices to pads` after slice creation.
8. Show `Go to Pads` after successful assignment.
9. Place the selected pad playback/stop behavior high in PADS.
10. Show `Program Pattern` after pads are configured.
11. Preserve manual access to every workspace.
12. Do not automatically switch workspaces without explicit user action.

### P1 — hierarchy and spacing cleanup

1. Standardize card padding.
2. Reduce unnecessary nested borders.
3. Use one primary CTA per screen or major section.
4. Lower the contrast of secondary actions.
5. Use mobile bottom sheets for contextual parameters.
6. Do not render inactive parameter panels solely to advertise functionality.
7. Replace inactive panels with a clear state message and one relevant action.
8. Prefer local workspace scrolling over full-page scrolling.

## 9. Acceptance criteria — mobile

### Transport

- Play/Pause, Stop and REC are available from every workspace with one tap.
- Permanent global UI occupies no more than about `108 px` total: top header plus bottom transport.
- BPM and Swing are not permanently displayed as sliders.
- BPM can be opened and changed within at most two taps.
- Metronome and Loop Song are available in the same Transport settings panel.
- Closing Transport settings returns the user to the same workspace and scroll position.

### Workspace visibility

- In CHOP, the waveform is visible without scrolling past global sliders.
- In PADS, at least the first pad row is visible without scrolling on a typical phone.
- In SEQ, the step grid begins as high as practical.
- All primary touch targets are at least `44 × 44 px`.
- No essential action depends on hover.
- The layout works at `360 px` width without whole-page horizontal scrolling.
- Local horizontal scrolling is allowed for the sequencer matrix.

### Guided workflow

- A new user sees `Load sample` in an empty project.
- After loading a sample, the next chop or pad action is visible.
- After creating slices, assignment to pads is clearly exposed.
- After assignment, selected-pad playback behavior is visible in PADS.
- After configuring pads, the route to SEQ is visible.
- Every suggested transition remains optional.

## 10. Acceptance criteria — desktop

- Global Header and Music Context Bar occupy no more than about `100 px` total.
- At `1366 × 768`, the primary tool of each workspace is visible without full-page scrolling.
- BPM is always readable but full BPM adjustment does not dominate the bar.
- Swing, metronome and Loop Song do not compete visually with transport, Group and Variant.
- Play/Pause, Stop and REC remain visible in every workspace.
- Current Pattern Group and Variant are always unambiguous.
- Only one contextual parameter scope is expanded at a time.
- Selecting another pad, step, channel or FX slot updates the same context panel.
- MIX does not become a long document when several effects are active.
- Keyboard focus remains visible and predictable.
- No DSP, audio-routing or data-model behavior changes.

## 11. Product boundary

This is not a full redesign and not a navigation rewrite.

Do not add:

- a blocking onboarding wizard;
- a DAW-style infinite timeline;
- new audio features;
- new routing systems;
- automatic forced transitions between workspaces;
- large modal editors for every function.

The intended result is a small reorganization of the existing Station UI so that the application feels like a coherent groovebox:

```text
Take a sound.
Shape it.
Put it on pads.
Build a pattern.
Then refine the mix.
```

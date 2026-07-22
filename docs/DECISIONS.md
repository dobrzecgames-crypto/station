# Station Decision Log

This document records product and architecture decisions that should not be reopened casually. Each new decision should include status, rationale and consequences.

## DEC-001 — Browser is the primary platform

**Status:** Accepted

Station is designed first for desktop and mobile web browsers. The web version is not a disposable prototype for a future JUCE application.

Consequences:

- browser constraints are product constraints,
- real mobile-browser testing begins with the first audio milestone,
- native portability does not justify premature abstraction,
- PWA is a natural later extension,
- Capacitor and JUCE remain optional future paths.

## DEC-002 — Station is a sampler groovebox, not a DAW

**Status:** Accepted

The core workflow is sample -> pad -> pattern -> Pump -> saved musical sketch.

Consequences:

- no infinite timeline in the MVP,
- no plugin hosting,
- no general-purpose mixer or routing system,
- future arrangement remains pattern/scene based.

## DEC-003 — MVP has one bank and one pattern

**Status:** Accepted

The MVP contains one 16-pad bank and one 16-step pattern.

Consequences:

- multiple banks, patterns and scenes are post-MVP,
- data structures should be clean but must not simulate unsupported complexity,
- the first workflow can be tested end to end without navigation bloat.

## DEC-004 — React does not own audio timing

**Status:** Accepted

React renders the UI and edits state. Audio timing uses AudioContext time through the audio-engine boundary.

Consequences:

- React effects and renders cannot trigger sequencer timing,
- `setTimeout`, `setInterval` and animation frames are not timing authorities,
- the visual playhead is derived from transport/audio time.

## DEC-005 — Audio engine is independent from UI components

**Status:** Accepted

AudioNodes, active voices and scheduling internals remain in the audio layer.

Consequences:

- components use a typed engine API,
- project state remains serializable,
- UI refactors should not rewrite the engine.

## DEC-006 — Basic Pump precedes Smart Kick Analysis

**Status:** Accepted

The first Pump uses user-selected source, musical length, depth and three curve profiles. It does not analyze kick duration.

Consequences:

- Pump's musical value is tested before DSP analysis work,
- automatic transient/body/sub-tail analysis is post-MVP,
- no analysis metadata is required in project schema v1.

## DEC-007 — WAV is the guaranteed MVP import format

**Status:** Accepted

Other formats may decode in some browsers but are not part of the guaranteed first scope.

Consequences:

- tests and error messages focus on WAV,
- no custom MP3/FLAC decoder is added to the MVP.

## DEC-008 — Pitch changes playback speed

**Status:** Accepted

Pitch is shown to users in semitones and implemented through playback-rate conversion.

Consequences:

- sample duration changes with pitch,
- time-stretching is explicitly out of scope.

## Open decisions required before M1

### OPEN-001 — Initial project license

Choose whether the repository is private/proprietary for now or receives an open-source license.

### OPEN-002 — Supported minimum browser versions

Define the practical target versions after the first compatibility tests.

### OPEN-003 — Tone.js evaluation

Default recommendation: do not adopt it automatically. Compare a minimal native Web Audio approach only if Tone.js would materially reduce M1/M4 risk.

### OPEN-004 — Initial visual direction

Define a small palette, typography and interaction character for the prototype without committing to a heavy virtual-hardware skin.

## Open decisions required before persistence milestone

### OPEN-005 — IndexedDB and OPFS split

Decide after a compatibility spike on real iPhone Safari and Android Chrome.

### OPEN-006 — Storage quota and sample-size policy

Define initial project limits, quota warnings and behavior when local storage is unavailable.

## Open decisions required before Basic Pump

### OPEN-007 — Exact LENGTH choices

Choose the smallest useful set through listening tests.

### OPEN-008 — Retrigger rule

Compare restart-from-current-value and other click-safe behaviors.

### OPEN-009 — Pump target model

Current recommendation: one source pad with Pump enabled independently on any number of target tracks.
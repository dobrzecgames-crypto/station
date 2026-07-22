# Station Decision Log

This document records product and architecture decisions that should not be reopened casually. Each new decision should include status, rationale and consequences.

## DEC-001 — Desktop browser is the primary product platform

**Status:** Accepted

Station is designed first as a desktop-browser instrument. The web version is not a disposable prototype for a future native application, but mobile browsers are not part of the required MVP scope.

Consequences:

- Chrome and Edge on Windows are the first required validation environment,
- mobile-browser testing does not block M1 or the browser MVP,
- phone and tablet UX may later become a separate product track,
- PWA, Capacitor and native packaging are optional future topics,
- native portability does not justify premature abstraction.

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

Choose whether the repository remains without an open-source license for now or receives one.

### OPEN-002 — Supported minimum browser versions

Initial validation targets current Chrome and Edge on Windows. Practical minimum versions may be defined after M1 compatibility testing.

### OPEN-003 — Tone.js evaluation

Default recommendation: do not adopt it automatically. M1 should use native Web Audio unless a concrete blocker appears.

### OPEN-004 — Initial visual direction

Define a small palette, typography and interaction character for the prototype without committing to a heavy virtual-hardware skin.

## Open decisions required before persistence milestone

### OPEN-005 — IndexedDB and OPFS split

Decide after a focused desktop-browser compatibility and storage spike. Mobile compatibility is not a prerequisite for the browser MVP.

### OPEN-006 — Storage quota and sample-size policy

Define initial project limits, quota warnings and behavior when local storage is unavailable.

## Open decisions required before Basic Pump

### OPEN-007 — Exact LENGTH choices

Choose the smallest useful set through listening tests.

### OPEN-008 — Retrigger rule

Compare restart-from-current-value and other click-safe behaviors.

### OPEN-009 — Pump target model

Current recommendation: one source pad with Pump enabled independently on any number of target tracks.

## DEC-010 — Sample regions are non-destructive playback settings

**Status:** Accepted

Start and end points belong to each pad's playback state. Decoded audio remains engine-owned and is not copied or physically cropped when a region changes. The engine also caches reduced waveform peaks after decoding, exposing only serializable peak snapshots to the UI.

Consequences:

- pads may use different regions of the same future SampleAsset without duplicating audio data,
- region edits affect only future voices,
- waveform drawing does not perform per-render or scheduler-time analysis,
- chop and slicing remain separate future workflows.

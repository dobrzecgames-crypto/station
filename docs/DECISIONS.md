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

## DEC-011 — Shared sample assets are separate from pad configuration

**Status:** Accepted

AudioEngine stores decoded buffers and waveform peaks by `SampleAssetId`. A pad holds an optional asset reference plus its own playback region, pitch, channel state and pattern. Every trigger passes the requesting pad ID for routing and the asset ID for buffer lookup.

Consequences:

- slice assignment can distribute one decoded asset to several pads without copying or decoding it again,
- each assigned pad has an independent region and musical settings,
- replacing a source pad's asset clears pads that depended on its prior asset rather than guessing how to remap old slice boundaries,
- AudioBuffer ownership remains entirely in the engine.

## DEC-012 — Station uses one main application shell

**Status:** Accepted

The application exposes CHOP, PAD, SEQ, SAMPLE and MIX as mutually exclusive main views with one permanent transport.

Consequences:

- changing view preserves the active pad, engine state, patterns, mixer state, Pump settings and Chop Session,
- large workspaces are not rendered as one long vertical screen,
- no URL router is required for this fixed local navigation.

## DEC-013 — Chop has an independent source asset and live pad mapping

**Status:** Accepted

CHOP loads one independent source SampleAsset. Adding or moving manual markers live-maps slice 1–16 to pad 1–16, with every mapped pad referencing the same decoded asset and retaining its own musical settings.

Consequences:

- source import does not occupy a pad, pattern, mixer channel or Pump target,
- current-session pad ownership is tracked by `chopSessionId`, allowing only its surplus pads to be cleared,
- occupied pads are never replaced silently: the first live mapping asks for confirmation,
- loading another Chop source detaches prior mapped pads as playable snapshots,
- an asset may be removed only when neither the current source nor any pad references it.

## DEC-014 — ProjectState separates persisted musical data from runtime caches

**Status:** Accepted

The first persistence-ready schema contains only serializable musical state and asset references. Waveform peaks are regenerated runtime cache; audio objects, active voices, transport timestamps and preview UI state are never persisted.

Consequences:

- schema validation can run before a future storage implementation,
- asset bytes and decoded AudioBuffers remain separate concerns,
- save/load UI and storage are deferred to a dedicated persistence task.

## DEC-015 — Transport STOP owns sequencer-created voices only

**Status:** Accepted

STOP stops the scheduler and voices it created for pattern playback. Manual pad voices remain independent, and Chop source preview is controlled only by its separate STOP SOURCE action.

Consequences:

- stopping the transport also cancels already scheduled long pattern voices,
- manually played pads are not unintentionally silenced by a transport action,
- preview voice cleanup remains independent from transport cleanup.

## DEC-016 — Persistence v1 uses one IndexedDB project with raw WAV Blobs

**Status:** Accepted

Persistence v1 stores one local `default-project` in IndexedDB. Its manifest is schema-versioned ProjectState, its source WAV files are separate Blob records keyed by stable UUID-derived asset IDs, and last-project metadata is stored in the same database. SAVE writes these records transactionally; OPEN validates the manifest, reads all required assets and re-decodes them before replacing React project state.

Consequences:

- a shared pad/CHOP asset is saved only once,
- waveform peaks are regenerated and transport remains stopped after OPEN,
- no AudioBuffer, AudioNode, voice, timer, preview or playback position is persisted,
- unsupported versions, corrupt manifests, missing assets, storage failures and decode errors are reported without guessing,
- v1 has no autosave, project browser, multiple projects, delete, rename or export/import,
- browser-managed IndexedDB quota can prevent saving large sample sets.

## DEC-017 — Project Key maps future pads without a runtime tuning link

**Status:** Accepted

Project Key is one persisted project preference containing a chromatic root name and a selected scale. It affects only a future explicit map action: the source pad is degree zero and later pads through PAD 16 receive consecutive scale pitch offsets while sharing the source SampleAsset and playback region.

Consequences:

- mapping creates ordinary independent pad snapshots; their patterns, mute/solo state, Pump assignments, Chop ownership and UI state are not copied from the source,
- a Project Key change never retunes or otherwise changes existing pads, regions, patterns or Chop Sessions,
- source pitch is user-declared; Station performs no pitch detection, tuning, FFT analysis or correction,
- pitch continues to use playback-rate, so pitch changes sample duration and no time-stretching is introduced,
- pre-Project-Key schema-v1 manifests safely load with C Minor / Aeolian while malformed present values fail validation.

## DEC-018 — Pattern Groups use four constrained variants and a reference Playlist

**Status:** Accepted

A Pattern Group represents one musical idea and has one required A pattern plus optional B, C and D variations. Each variation remains exactly 16 steps across the fixed 16 pads. A Playlist clip stores only a Pattern Group ID, variant and positive start slot; it does not duplicate pattern data. Multiple clips may share a slot and therefore schedule independent overlapping triggers.

Consequences:

- Station supports at most eight Pattern Groups and has no arbitrary pattern lengths,
- editing a referenced variant affects every one of its Playlist clips,
- deleting or clearing a referenced variant/group requires confirmation and removes the affected clips instead of leaving broken references,
- Playlist length grows with its clips and is not capped at 32 or 64 slots,
- PATTERN mode loops the selected variant; SONG mode changes slots only at 16-step boundaries and may loop after the last occupied slot,
- this is a constrained groovebox arrangement system, not a full DAW timeline, audio-clip system or scene framework.

## DEC-019 — Per-step velocity and bounded SHIFT remain part of the pattern

**Status:** Accepted

Every 16-step pad pattern stores a manual velocity and a SHIFT value per step. SHIFT is limited to half a 16th-note early or late and is applied by the audio scheduler to the individual Web Audio event timestamp.

Consequences:

- velocity and SHIFT are copied when duplicating a variant and persisted with the project,
- SHIFT does not alter BPM, swing, Playlist slots or the audio clock,
- a negative SHIFT too close to the current scheduling time is safely clamped by the audio engine rather than causing React-driven timing.

## DEC-020 — Auto-chop offers equal-division and transient-detection modes

**Status:** Accepted

CHOP gained two automatic slicing modes alongside manual slicing. EQUAL divides the loaded source into an even number of slices (4/8/16 presets). SMART detects transient candidates from the existing cached waveform peaks — no new AudioEngine analysis was added — ranks them by amplitude rise, and lets the user preview and adjust the resulting slice count (from 1 up to the number of detected candidates, capped at 16) before committing.

Consequences:

- transient detection reuses the peaks cache already exposed for waveform drawing rather than requiring a new audio-engine method or raw AudioBuffer access,
- detection precision is bounded by the peaks cache resolution (128 buckets/second up to 4 seconds, capped at 512 buckets total for longer sources), so very fast/close hits on long sources may merge into one candidate,
- SMART previews locally before commit and disables manual slice editing while a preview is pending, so a rejected or cancelled preview never touches committed Chop Session data,
- both modes produce ordinary SampleSlice arrays and commit through the existing live slice-to-pad mapping; re-running either mode within the same Chop Session re-maps pads without an occupied-pad confirmation, matching existing manual re-slicing behavior, while pads outside the current session still trigger it.

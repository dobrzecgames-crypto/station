# Station Roadmap

## Current implementation status

- M5 implementation is present; acceptance is pending.
- M6 Persistence v1 is implemented locally; Chrome/Edge and listening acceptance is pending.
- M7 Basic Pump implementation is present; listening and hardening are pending.
- The approved M9 Chop foundation was implemented early.
- The current approved task is Pattern Groups A–D + Pattern Playlist / Song Mode. It is implemented locally; acceptance, listening and Chrome/Edge validation remain pending.

## M0 — Project Definition

Goal: freeze the first product direction before application code exists.

Deliverables:

- product definition,
- MVP inclusion and exclusion list,
- architecture boundaries,
- conceptual data model,
- Basic Pump specification,
- open decisions,
- Codex collaboration rules.

Exit criteria:

- Damian approves the direction,
- unresolved decisions needed for M1 are answered,
- no implementation has begun prematurely.

## M1 — Audio Viability Spike

Question: can the selected browser stack play a sample reliably enough to justify the product?

Scope:

- minimal TypeScript/React/Vite application,
- explicit audio start interaction,
- one WAV file input,
- one playable pad,
- mouse, keyboard and touch trigger,
- repeated rapid triggers,
- basic context state display for development,
- real desktop and phone testing.

Not included:

- 16 pads,
- sequencer,
- save system,
- Pump,
- styled machine interface.

Exit criteria:

- reliable playback without obvious clicks in the basic scenario,
- acceptable subjective response on target devices,
- AudioContext suspend/resume behavior documented,
- risks reported before expanding scope.

## M2 — Audio Engine Skeleton

Question: can the engine remain independent from React and manage several voices safely?

Scope:

- typed AudioEngine boundary,
- sample registration,
- one-shot voice creation,
- gain and semitone pitch,
- overlapping triggers,
- node cleanup,
- master output,
- development diagnostics.

Exit criteria:

- React components do not own AudioNodes,
- repeated triggers do not leak active voices,
- multiple samples can play concurrently.

## M3 — Pad Instrument

Question: does Station feel playable as a 16-pad browser instrument?

Scope:

- one 4 x 4 bank,
- WAV assignment,
- multitouch,
- desktop keyboard mapping,
- per-pad volume and pitch,
- clear trigger feedback,
- responsive touch-first interface.

Exit criteria:

- simultaneous touches work on real phones,
- the page does not scroll or select text during pad performance,
- pad settings remain separate from sample assets,
- basic manual performance is stable.

## M4 — Sequencer Timing

Question: can a browser scheduler maintain musical timing independently from UI rendering?

Scope:

- minimal 16-step clock,
- one or two tracks,
- BPM,
- start and stop,
- look-ahead scheduling based on AudioContext time,
- timing diagnostics,
- UI stress test during playback,
- approved scoped extension: Project Key + Scale Map v1, with a persisted global root/scale preference and explicit one-bank shared-asset mapping; no piano roll or MIDI system.

Exit criteria:

- audio timing remains stable during ordinary UI activity,
- scheduling strategy and parameters are documented,
- resume and restart semantics are defined.

## M5 — Playable Sequencer

Scope:

- 16 tracks mapped to 16 pads,
- one 16-step pattern,
- editable steps,
- simple velocity,
- BPM and transport,
- visual playhead derived from audio time,
- editing during playback.

Exit criteria:

- pattern playback is repeatable,
- play/stop does not create duplicate schedules,
- normal edits do not destabilize timing.

## M6 — Local Project Persistence

Scope:

- project schema v1,
- sample asset storage,
- pad, pattern, BPM and Pump-ready settings serialization,
- save and reopen,
- failure states and validation,
- IndexedDB compatibility verification in current Chrome and Edge on Windows.

Exit criteria:

- a representative project survives browser close and reopen,
- missing/corrupt data fails clearly,
- schema versioning is present.

## M7 — Basic Pump

Question: is Pump musically valuable before automatic kick analysis exists?

Scope:

- one selected kick source,
- per-track targets,
- full-band gain shaping,
- DEPTH,
- tempo-relative LENGTH,
- SNAP, SMOOTH and SWELL,
- click-safe retrigger behavior,
- listening tests on several source materials.

Exit criteria:

- profiles are distinct and useful,
- timing follows the sequencer clock,
- rapid triggers remain stable,
- no automatic analysis has been added.

## M8 — MVP Integration and Hardening

Scope:

- complete sample -> pad -> pattern -> Pump -> save flow,
- intentional start/init screen,
- coherent minimal Station identity,
- responsive layout,
- audio interruption recovery,
- error handling,
- real-device regression pass,
- example project and usage notes.

Exit criteria:

- all criteria in `MVP_SCOPE.md` pass,
- known limitations are documented,
- no post-MVP feature blocks release.

## First post-MVP milestones

### M9 — Chop

- The explicitly approved Unified Chop Workspace foundation is available earlier: independent source asset, manual live slice 1–16 mapping and shared-asset pad regions.
- reverse and gate/loop decisions,
- equal auto-chop,
- further chop workflows only after a dedicated approval.

### M10 — Resampling

- capture master and selected tracks,
- create a new SampleAsset,
- assign result to a pad or send to Chop,
- preserve a clear resample history.

### M11 — Further pattern performance and scenes

- performance-level pattern changes beyond the current limited A–D variants,
- quantized scene changes beyond the current fixed Playlist slots,
- performance mute workflow,
- limited scene-based arrangement.

### M12 — Smart Kick Analysis

- transient/body/sub-tail analysis,
- low-band energy envelope,
- recommended Pump length,
- analysis metadata and versioning,
- listening evaluation over a diverse kick test set.

### M13 — PWA and Offline Productization

- service worker and application cache,
- installability,
- offline startup,
- storage quota handling,
- mobile browser hardening.

## Roadmap rule

A milestone does not begin because it is exciting. It begins only after the previous milestone's question has been answered and its exit criteria have been reviewed.

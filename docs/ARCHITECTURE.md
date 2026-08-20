# Station Architecture

## Status

This document defines architectural boundaries, not a final implementation. Details must be validated through small browser audio spikes before they become permanent decisions.

## Primary rule

React renders and edits application state. React does not schedule audio and is never the source of truth for musical time.

## Initial layers

### 1. UI layer

Responsibilities:

- screens, pads, controls and visual feedback,
- user gestures,
- editing project state,
- displaying transport and engine status,
- accessibility and responsive touch behavior.

Expected technology:

- React,
- TypeScript,
- CSS,
- Canvas only where it provides a measured benefit.

The UI may request an audio action through a typed engine API. It must not directly construct arbitrary Web Audio graphs inside components.

### 2. Application/domain layer

Responsibilities:

- project model,
- pad and pattern editing rules,
- validation,
- commands such as assign sample, set step, set BPM and configure Pump,
- serialization-ready state,
- mapping user intent to engine operations.

This layer must not depend on React components.

### 3. Audio engine layer

Responsibilities:

- AudioContext lifecycle,
- sample decoding and registration,
- voice creation and cleanup,
- gain and pitch playback,
- master output,
- transport clock,
- look-ahead scheduling,
- Pump trigger and gain-envelope behavior,
- audio interruption and resume handling,
- diagnostics relevant to timing and voice count.

The audio engine exposes a small typed API. UI components do not own AudioNodes.

### 4. Persistence layer

Responsibilities:

- project manifests,
- schema versioning,
- sample asset storage,
- load/save transactions,
- migration between supported schema versions,
- recovery and user-facing errors.

Local persistence uses IndexedDB only: `projects` stores any number of named, versioned manifests keyed by an identity independent of the name; `assets` stores original WAV `Blob`s by stable asset ID; and `metadata` stores `lastProjectId` plus one-time legacy-recovery state. A project's first explicit SAVE creates its identity and enables debounced autosave. Local create/update/replace operations write only newly introduced stable asset IDs while keeping those writes, manifest changes, metadata, and asset garbage collection in one transaction; an ordinary parameter autosave does not rewrite existing WAV blobs. After a successful explicit save, Station makes one best-effort `navigator.storage.persist()` request for the page session and exposes `estimate()`/persisted state to internal diagnostics; it never makes that request at startup or treats denial as save failure. OPEN validates and migrates the manifest and reads every required asset before asking the audio engine to re-decode it. The former single `default-project` record is read only through the legacy-recovery path and is never silently renamed or overwritten.

User presets for BASSIC, MONOGORG, STRINGS and ZOLA-X live in a separate versioned IndexedDB database rather than in project manifests. Each instrument kind has an isolated library, and applying a preset preserves the destination patch ID so existing pad references and patch sharing remain intact. This library is device/browser-profile local, contains no audio blobs or runtime nodes, and is deliberately independent from project SAVE/OPEN.

Portable `.station` serialization is a separate layer over the same validated `ProjectState`. Its outer file schema is versioned independently from the musical-state schema. Portable v1 records stable Station-library references and contains no WAV blobs; export fails clearly when any referenced audio has no portable Station resource identity. Import validates the envelope, migrates/validates its state through the same decoder used by local loads, resolves its built-in resources, and requires an explicit OPEN AS COPY or REPLACE decision on a local `projectId` conflict. OPFS remains a future option only if measured asset-library needs justify it.

## Suggested module boundaries

```text
src/
  app/
  ui/
  domain/
  audio/
  storage/
  shared/
```

This is a direction, not permission to scaffold files before the implementation task is approved.

## State ownership

- Persisted musical state belongs to the project/domain model.
- Ephemeral AudioNode instances belong only to the audio engine.
- Visual pressed/hover states belong to the UI.
- Audio time belongs to AudioContext.
- The visual playhead is a projection of audio time, never the timing authority.

## Current UI shell and Chop Workspace

Station renders one main workspace at a time: CHOP, PAD, SYNTH, SEQ, SONG, SAMPLE or MIX. MONOPOLY, MONOGORG, STRINGS, POLY and DRUM SYNTH are selected inside SYNTH rather than becoming top-level workspaces. The transport remains outside those views, so changing views does not recreate audio, Pattern Groups, Playlist, mixer settings, the active pad, synth patches or the current Chop Session.

CHOP owns a source-asset reference and serializable slice boundaries; pads own their playback and musical state. A live map applies slice 1–16 to pad 1–16 without placing an AudioBuffer in React. The workspace tracks the pads it currently manages so that shrinking the slice set clears only its own surplus assignments.

## Persistence runtime boundary

At import time, AudioEngine retains the original WAV `Blob` alongside its decoded AudioBuffer and generated waveform peaks. The Blob is available only through a small engine API for persistence; the audio graph, scheduling, voices and waveform cache remain runtime-only. On OPEN, the engine decodes stored Blobs again and recreates waveform peaks before React receives the replacement project state.

## Event flow example

1. User presses a pad.
2. React receives the pointer event.
3. A typed command requests `audioEngine.triggerPad(padId, options)`.
4. The audio engine resolves the pad's sample and creates/schedules the voice using AudioContext time.
5. The UI receives or derives non-authoritative visual feedback.

## Sequencer scheduling

The initial sequencer should use a look-ahead scheduling approach:

- the scheduler periodically plans a short window into the future,
- actual source starts are scheduled against `AudioContext.currentTime`,
- UI timers may wake the scheduler but may not define event timestamps,
- the schedule window and wake interval must be measured on target browsers,
- background throttling and resumed contexts must be handled explicitly.

No implementation should assume that a visually smooth playhead proves stable audio timing.

## MONO-3 source boundary

MONO-3 is a second mutually exclusive pad source, not a second sequencer. Serializable `SynthPatch` objects belong to Pattern Groups and pads reference them by ID; per-pad chord intervals and pitch stay on the pad. Oscillators, filters, LFOs, envelopes, voice allocation and cleanup remain AudioEngine-owned.

Live PATTERN/SONG playback and offline WAV rendering both resolve a pad to sample or synth events through `songTracks`, then use the same `StepSequencer` and `AudioEngine`. Synth timing, GATE and SHIFT are stamped against AudioContext time. React sends manual note-on/note-off commands and edits patches but never owns a voice or musical clock.

Pattern Mode asks the scheduler for the next existing 16-step section of the selected Pattern Group and loops its complete 16/32/48/64-step A–D chain. A first take on an empty pattern may temporarily schedule through all four section positions; sections become persisted only when a hit actually reaches them. Song Mode asks for every clip active in the current 16-step slot, so all referenced sections are scheduled independently and may trigger the same pad at the same timestamp. Section and slot changes occur only after the sixteenth scheduled local step. The UI receives a display-only playhead projection; it never controls the scheduler clock.

Each scheduled step may have a persisted velocity and a local SHIFT expressed as a fraction of the 16th-note duration (−50% to +50%). The scheduler adds this offset to that event's Web Audio timestamp; React only edits the value and is never the timing authority.

## STRINGS source boundary

STRINGS is a third mutually exclusive pad source, sharing the MONO-3 source boundary's shape rather than introducing a new one: serializable `StringsPatch` objects belong to Pattern Groups, pads reference them by ID, and per-pad chord intervals and pitch stay on the pad. A pad may hold at most one of `assetId`, `synthPatchId`, `stringsPatchId` or `organicBassPatchId`. Oscillators, the shared lowpass, the per-channel ensemble, the engine-wide vibrato/ensemble LFOs, voice allocation and cleanup remain AudioEngine-owned, deliberately not shared node-for-node with MONO-3's own voice - the instruments have different DSP needs and different voice shapes on purpose.

STRINGS reuses MONO-3's established boundary for everything generic: it resolves to `songTracks` events the same way, schedules through the same `StepSequencer`/`AudioEngine`, stamps GATE/SHIFT against AudioContext time the same way, and gets render-length and offline-render parity through the same registration pattern (`syncStringsPatches` alongside `syncSynthPatches`). It does not reuse MONO-3's mono/glide handling, its cascaded filter, its filter envelope or its tempo-synced LFO - STRINGS has no MONO mode, and its vibrato/ensemble modulation is deliberately free-running rather than tempo-synced.

## MONOGORG source boundary

MONOGORG follows the same serializable-patch/runtime-voice split. Pattern Groups own `organicBassPatches`; pads reference one through `organicBassPatchId`; the audio engine alone owns its active mono voice, routing crossfades, oscillator periodic waves, filter nodes, envelopes and fixed-rate drift LFOs. Generic scheduling, mixer, Pump, FX, Scale Map and offline rendering are shared. Its DSP and legato runtime are separate from MONO-3 so the focused nine-control macro design does not alter or constrain the older general-purpose synth.

## POLY source boundary

POLY is another mutually exclusive pad source, but its oscillator, unison, envelopes, LFOs, modulation and multimode filter run in a dedicated AudioWorklet processor. Pattern Groups own serializable `polyPatches`; pads reference one through `polyPatchId`; immutable procedural wavetable data is cached at worklet-module scope. `AudioEngine` owns patch registration, eight-note voice allocation, note/release timestamps, cleanup and the connection from each worklet voice into the requesting pad channel. Realtime and offline paths load the same worklet module and use the same scheduler entry point.

## AudioWorklet policy

AudioWorklet is allowed when it solves a demonstrated problem, especially for:

- sample-accurate custom gain shaping,
- DSP not expressible reliably with existing AudioParams,
- later custom processors.

It is not a requirement that the entire engine live inside an AudioWorklet. Do not move decoding, project state, React state or unrelated application logic into the worklet.

## Dependency policy

The initial core should prefer browser primitives. Major dependencies require an explicit decision recorded in `DECISIONS.md`.

Not approved by default:

- Tone.js,
- state-management frameworks,
- WebAssembly DSP frameworks,
- Capacitor,
- JUCE,
- WebGL engines,
- large component libraries.

## Browser-first constraints

- Audio must start or resume from a valid user gesture.
- Pointer interactions must support multitouch and prevent accidental scrolling where appropriate.
- Memory use must account for decoded audio buffers.
- Page suspension, visibility changes and audio interruptions must be treated as normal lifecycle events.
- Browser support must be tested on real devices rather than inferred from desktop emulation.

## Non-goals of the architecture

The architecture is not required to support:

- VST/AU hosting,
- a native desktop port,
- server rendering,
- real-time multiplayer,
- cloud project sync,
- an infinite timeline,
- arbitrary plugin routing.

Good separation is required for maintainability in the browser, not as speculative preparation for every future platform.

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

The exact IndexedDB/OPFS split remains an open decision until a compatibility spike is completed.

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

Station renders one main workspace at a time: CHOP, PAD, SEQ, SAMPLE or MIX. The transport remains outside those views, so changing views does not recreate audio, patterns, mixer settings, the active pad or the current Chop Session.

CHOP owns a source-asset reference and serializable slice boundaries; pads own their playback and musical state. A live map applies slice 1–16 to pad 1–16 without placing an AudioBuffer in React. The workspace tracks the pads it currently manages so that shrinking the slice set clears only its own surplus assignments.

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

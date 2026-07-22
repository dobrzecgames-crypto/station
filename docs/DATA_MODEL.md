# Station Data Model

## Purpose

The data model must separate audio files from their musical use. A sample asset is not a pad, a pad is not a track, and a pattern event is not an AudioNode.

This document defines conceptual entities. Exact TypeScript interfaces will be created only in an approved implementation task.

## Core entities

### Project

Represents one saved Station project.

Suggested fields:

- project ID,
- schema version,
- name,
- created and modified timestamps,
- one pad bank,
- one pattern,
- transport settings,
- Pump configuration,
- references to sample assets.

### SampleAsset

Represents imported audio data and its reusable metadata.

Suggested fields:

- stable asset ID,
- original filename,
- MIME type,
- byte size,
- duration after decoding,
- sample rate and channel count when available,
- local storage reference,
- import timestamp,
- future analysis metadata.

The same SampleAsset may be used by more than one pad with different settings.

### Pad

Represents the playable configuration assigned to one of the 16 slots.

Suggested fields:

- stable pad ID,
- pad index 0-15,
- optional SampleAsset ID,
- display name,
- channel volume,
- pitch in semitones,
- mute and solo state,
- future playback mode and choke-group fields.

A Pad must not contain decoded AudioBuffer objects in persisted state.

### ChannelState

Each of the 16 stable pad IDs also identifies one fixed runtime mixer channel. The UI state contains `id`, `volume`, `muted` and `solo`; the matching Web Audio GainNodes remain engine-owned runtime state and are never placed in React state or serialized as nodes.

### Track

For the MVP, each pad maps to one sequencer track. The track remains conceptually separate so future track-specific settings do not have to be stored on the pad.

Suggested fields:

- stable track ID,
- pad ID,
- Pump enabled state,
- future mute/solo or sequencing configuration.

### Pattern

Represents the single MVP pattern.

Suggested fields:

- pattern ID,
- name,
- step count fixed at 16 for MVP,
- events grouped by track or step,
- future pattern version metadata.

### StepEvent

Represents a trigger inside the pattern.

Suggested fields:

- step index 0-15,
- track ID,
- enabled state or existence,
- velocity normalized to a documented range,
- future microtiming, probability, ratchet and parameter-lock fields.

Do not add future fields until they are needed, but reserve clean extension points through schema versioning.

### TransportSettings

Suggested fields:

- BPM,
- future swing amount.

Playback position and AudioContext timestamps are runtime state and must not be persisted as musical project state.

### PumpConfig

Suggested fields:

- source pad ID,
- target track IDs or per-track enabled state,
- depth,
- length mode/value,
- curve: SNAP, SMOOTH or SWELL,
- enabled state.

Automatic kick-analysis results do not belong in the MVP PumpConfig.

## Runtime-only entities

The following must not be serialized into the project:

- AudioContext,
- AudioBufferSourceNode,
- GainNode,
- AudioWorkletNode,
- active voices,
- scheduled browser callbacks,
- current visual playhead animation state,
- object URLs that cannot be restored reliably.

## Persistence rules

- Every saved project includes a schema version.
- Imported sample bytes are stored locally under stable IDs or storage handles managed by Station.
- The project manifest references assets by Station IDs, not by fragile temporary browser URLs.
- Saving metadata and sample assets should behave transactionally where practical.
- Loading must validate required fields before passing data to the audio engine.
- Unsupported future schema versions must fail clearly instead of being guessed.

## Initial constraints

- Exactly one bank.
- Exactly 16 pads.
- Exactly one pattern.
- Exactly 16 steps.
- One track associated with each pad.
- WAV is the only guaranteed import format.

These constraints are intentional product limits for the MVP, not accidental implementation shortcuts.

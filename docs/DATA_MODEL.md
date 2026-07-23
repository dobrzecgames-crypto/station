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
- up to eight Pattern Groups, each with a private 16-pad bank and A–D variants,
- a Pattern Playlist,
- transport settings,
- Pump configuration,
- global Project Key preference (`root` and `scale`) used only for future scale maps,
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

### SamplePlaybackRegion

Each loaded pad has one non-destructive playback region:

- start seconds,
- end seconds.

The region is bounded by the decoded sample duration and has a small positive minimum length. Importing a replacement sample resets the region to the new file's full duration. The region is a playback setting, not a copied or cropped SampleAsset.

### SampleSlice

A manual slice is another non-destructive region of one shared SampleAsset. It has a stable ID, source asset ID, start seconds and end seconds. Slice boundaries are ordered, do not overlap and are capped at 16 slices per source pad. Assigning slices to pads copies only the asset reference and per-pad region settings.

### ChopSession

The active Chop Workspace has one independent source asset, filename, duration, cached waveform peaks, ordered slices and an active slice selection. The source asset is not assigned to a pad merely by loading it. Live mapping assigns slice 1–16 to pad 1–16 by sharing that source asset and updating only each mapped pad's region.

Each pad has an optional `chopSessionId`. It marks a pad currently managed by the active session; it is not an audio object or a copy of source data. When the slice count shrinks, only pads bearing the current session ID are cleared. Loading a new source detaches existing mapped pads into ordinary working snapshots, preserving their old asset references. A manually occupied target pad requires user confirmation before live mapping replaces it.

### ChannelState

Each Pattern Group bank has 16 stable pad IDs. Runtime mixer channels use the group-and-pad identity, so the same pad ID in different groups receives an independent channel. The UI state contains `id`, `volume`, `muted` and `solo`; matching Web Audio GainNodes remain engine-owned runtime state and are never placed in React state or serialized as nodes.

### Track

For the MVP, each pad maps to one sequencer track. The track remains conceptually separate so future track-specific settings do not have to be stored on the pad.

Suggested fields:

- stable track ID,
- pad ID,
- Pump enabled state,
- future mute/solo or sequencing configuration.

### Pattern Group and variants

A Pattern Group is one musical idea. It owns one private 16-pad bank and has an always-present A variant with optional B, C and D variants. Each existing variant is a complete 16-pad, 16-step pattern with a velocity and a SHIFT value for each step. SHIFT is constrained to −50% through +50% of one 16th-note duration. Creating a variation copies steps, velocity and SHIFT only; it never copies or changes the group's bank. The A–D limit is intentional.

### Pattern Clip / Playlist

A Pattern Clip contains `patternGroupId`, `variant` and a positive `startSlot`. One slot always means one 16-step pass. Clips point to the live variant data rather than copying it, and any number of clips may share a slot. The Playlist grows with its clips and has no user-visible short length cap. It is not a general DAW timeline: clips cannot be stretched, cut, audio-based or automated.

### StepEvent

Represents a trigger inside the pattern.

Suggested fields:

- step index 0-15,
- track ID,
- enabled state or existence,
- velocity normalized to 0–1,
- manual SHIFT microtiming normalized to −0.5 through +0.5 of a 16th-note duration,
- future probability, ratchet and parameter-lock fields.

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

## Pre-persistence ProjectState

ProjectState schema v3 is a serializable boundary. Each Pattern Group contains its private bank: 16 pad configurations and that group's CHOP session. It contains shared asset references and durations, Pattern Groups and their 16-step velocities, selected Pattern Group/variant, Pattern Clips, persisted transport mode and Loop Song, BPM, swing, group-and-pad Pump references, and the global Project Key (`root`, `scale`). Waveform peaks are runtime cache regenerated after decoding; they are not part of schema v3.

Project Key is a preference for future Project Scale mappings. A mapping writes normal independent pad configurations that reference one shared SampleAsset and contain their calculated pitch offsets. Existing mapped pads have no runtime link to Project Key and are not retuned when it changes.

It intentionally excludes AudioContext, buffers, nodes, active voices, transport playback state, preview state and timestamps. Validation rejects unsupported schema versions, invalid pad/pattern counts, malformed regions or slices, invalid transport/Pump values and references to missing pads or assets.

## Persistence v1 records

The one saved local project has ID `default-project`. Its manifest contains `ProjectState` with `schemaVersion: 3`; a separate asset record contains each referenced asset ID, filename, MIME type, byte size and original WAV Blob. A shared asset is represented by one asset record even when referenced by many group banks. `lastProjectId` points to the most recently saved project. Schema-v1 manifests migrate to Pattern 1A. Schema-v2's single global bank and CHOP session migrate exactly to Pattern Group 1; all pre-existing later Pattern Groups receive empty banks, so no ambiguous sound assignment is guessed.

Only assets used by pads or by the active CHOP source are included in a save. Waveform peaks, AudioBuffers, transport playback state, preview state and UI-only Chop editing state are rebuilt or reset on OPEN.

The already-written schema-v1 manifest remains compatible with pre-Project-Key saves: a missing `projectKey` is normalized to C Minor / Aeolian during load. A present but malformed key remains invalid and fails manifest validation.

## Persistence rules

- Every saved project includes a schema version.
- Imported sample bytes are stored locally under stable IDs or storage handles managed by Station.
- The project manifest references assets by Station IDs, not by fragile temporary browser URLs.
- Saving metadata and sample assets should behave transactionally where practical.
- Loading must validate required fields before passing data to the audio engine.
- Unsupported future schema versions must fail clearly instead of being guessed.

## Initial constraints

- Exactly one 16-pad bank per Pattern Group.
- One to eight Pattern Groups, each with A and optional B–D variants.
- Exactly 16 steps.
- One track associated with each pad.
- WAV is the only guaranteed import format.

These constraints are intentional product limits for the MVP, not accidental implementation shortcuts.

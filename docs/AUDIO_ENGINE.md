# Station Audio Engine

## Goal

Build a browser audio engine that feels like an instrument: immediate pad response, stable pattern timing, predictable lifecycle behavior and enough control to support Basic Pump.

## Facts and assumptions

### Facts

- Browser audio must be initialized or resumed through an allowed user gesture.
- React rendering and ordinary JavaScript timers are not reliable audio clocks.
- Scheduled Web Audio events should use AudioContext time.
- Mobile browsers can suspend or interrupt audio contexts.

### Assumptions requiring prototypes

- The acceptable pad latency on target phones.
- The best look-ahead scheduler window and wake interval.
- Whether Basic Pump needs an AudioWorklet in the first implementation.
- The practical decoded-sample memory limit for the first project size.
- The safest persistence technology mix on current iPhone Safari and Android Chrome.

## AudioContext lifecycle

The engine must expose clear states such as:

- unavailable,
- locked,
- initializing,
- running,
- suspended,
- interrupted,
- failed.

The application must never pretend that audio is ready before the context is actually running.

Expected lifecycle behavior:

1. User presses an explicit start control.
2. AudioContext is created or resumed.
3. Required engine nodes are initialized.
4. The UI reports readiness.
5. Visibility changes, interruptions and suspend/resume events are observed.
6. Recovery requires a clear user action when browser policy demands it.

## Sample playback

Initial playback requirements:

- decoded WAV sample registered under a stable sample asset identifier,
- one-shot playback,
- per-channel volume shared by all voices for a pad,
- semitone pitch converted to playback rate,
- repeated triggers,
- overlapping voices by default,
- deterministic cleanup after playback,
- no AudioNode ownership in React.

Time-stretching is explicitly outside the MVP.

### Playback regions and waveform snapshots

Each pad supplies a non-destructive start and end time for new voices. The engine starts a voice with `source.start(when, offset, duration)` and does not alter the decoded `AudioBuffer`; already-playing voices keep their original region. The existing per-voice gain applies a short edge fade, scaled down for short regions, before routing to the channel gain.

After WAV decoding, the engine reduces the decoded buffer to cached amplitude peaks per stable sample ID. React receives only a copied peak snapshot for canvas drawing, never an `AudioBuffer` or an audio node. The cache is removed with its sample and is not rebuilt during triggers or scheduling.

### Shared sample assets

Decoded buffers and waveform caches are keyed by `SampleAssetId`, while channel routing and Pump source events use a group-aware channel identity (`patternGroupId:padId`). A trigger supplies both IDs: the engine reads the shared asset while routing the resulting voice through the requesting group pad channel. Several pads can therefore use different regions of one decoded asset without duplicating the `AudioBuffer`.

The Chop Workspace may also hold a source `SampleAssetId` which is not routed through a pad channel. Its preview uses the normal voice fade and master path, while mapped pad playback continues to use the requesting pad's channel and Pump routing. Source assets remain registered while the active Chop Session or any pad references them; replacement source loading never removes an asset still used by pads.

## Voice management

The engine should maintain enough internal information to:

- track active voices,
- stop or clean up voices safely,
- avoid leaking disconnected nodes,
- later support mono/choke behavior without redesigning the entire engine.

Do not build a complex voice allocator before measurements justify it.

## Gain staging

The engine defines a predictable path:

```text
AudioBufferSourceNode -> voice gain -> channel gain -> Pump gain -> master gain -> destination
```

There are 16 channels per Pattern Group bank, keyed by a stable group-and-pad identity. Channel volume, mute and solo act at the channel gain, so they affect active as well as future voices. Mute takes precedence over solo. Pump has a dedicated gain after the channel gain, so its envelope remains active when a target is muted and source-trigger events still fire even when the source channel is not audible.

The MVP should leave sensible headroom. Avoid adding saturation, soft clipping or machine-character processing until the clean engine is stable and measured.

## Sequencer timing

The scheduler must:

- calculate musical step times from BPM,
- schedule events ahead using AudioContext timestamps,
- tolerate UI rendering work,
- support edits during playback without corrupting already scheduled events,
- define what happens when BPM changes,
- define start and stop semantics,
- recover cleanly after context suspension.

The visual playhead may use animation frames, but it reads transport position; it does not trigger sound.

## Current scheduler and transport status

The current implementation schedules all loaded pad tracks against one 16-step timeline, not only the selected pad. It wakes every 25 ms and uses a 100 ms look-ahead window; each voice receives an absolute AudioContext.currentTime timestamp.

Transport STOP cancels further scheduling and stops voices created by the sequencer. Manual pad voices and source-preview voices remain separate; source preview has its own STOP SOURCE control. The engine reports a suspended context to the UI, which stops the transport and its voices; START AUDIO resumes the context. Suspend/resume and timing behavior still require acceptance testing in current Chrome and Edge.

### M4 implementation history

The original M4 scheduler established the 25 ms wake interval and 100 ms look-ahead strategy. Its current extension schedules every loaded pad track, and the wake timer only invokes planning; it does not provide musical time.

## Basic Pump

Basic Pump is gain shaping triggered by sequenced or manually triggered kick events.

Initial requirements:

- full-band target gain only,
- one source pad identifier,
- one Pump configuration reusable by target tracks,
- depth, musical length and curve profile,
- a tiny safe transition to avoid clicks,
- deterministic retrigger behavior,
- timestamps based on the same audio clock as the sequencer.

The first version should prefer scheduled AudioParam automation if it provides stable and controllable results. Use an AudioWorklet only if tests show that standard automation cannot meet the behavior or retrigger requirements.

## Diagnostics

Audio milestones should expose development-only diagnostics for:

- AudioContext state,
- current time,
- base/output latency when available,
- active voice count,
- scheduled-event count,
- scheduler wake delay or missed windows,
- sample decode failures,
- interruption/resume events.

Diagnostics must not become part of the normal product interface.

## Test scenarios

Every audio milestone should manually test:

- first launch and audio unlock,
- repeated rapid pad presses,
- two or more simultaneous touches,
- pattern playback while interacting with the UI,
- start/stop repeatedly,
- changing BPM where supported,
- switching tab/app and returning,
- locking and unlocking a phone where practical,
- interruption by another audio source,
- loading an unsupported or damaged file,
- long enough playback to reveal leaks or timing degradation.

## Deferred engine work

- automatic kick analysis,
- transient detection,
- low-band envelope analysis,
- resampling capture,
- granular processing,
- custom filters and saturation,
- multiple buses,
- per-band Pump,
- time-stretching,
- native low-latency audio APIs.

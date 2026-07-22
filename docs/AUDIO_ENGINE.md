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
- per-pad gain,
- semitone pitch converted to playback rate,
- repeated triggers,
- overlapping voices by default,
- deterministic cleanup after playback,
- no AudioNode ownership in React.

Time-stretching is explicitly outside the MVP.

## Voice management

The engine should maintain enough internal information to:

- track active voices,
- stop or clean up voices safely,
- avoid leaking disconnected nodes,
- later support mono/choke behavior without redesigning the entire engine.

Do not build a complex voice allocator before measurements justify it.

## Gain staging

The first engine must define a predictable path:

```text
sample voice -> pad/track gain -> optional Pump gain -> master gain -> destination
```

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

### M4 implementation

The initial sequencer schedules a single 16-step pattern for the selected pad. It wakes every 25 ms and schedules into a 100 ms look-ahead window. The wake timer only invokes planning; each sample is started with an absolute `AudioContext.currentTime` timestamp.

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

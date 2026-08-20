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

A separate, finer RMS envelope for CHOP's own transient/tempo analysis is available on demand (`getAnalysisEnvelope`) from the real decoded buffer rather than this drawing cache, and is not itself cached - CHOP analyzes one loaded source at a time.

### Reverse playback

A trigger may ask for its region played back to front. `AudioBufferSourceNode.playbackRate` has no reliable negative-rate support in any browser, so the engine instead lazily builds and caches one whole-asset time-reversed `AudioBuffer` per sample ID the first time any reversed playback is requested for it - never a second buffer per region - and mirrors the requested start/end into that buffer's own coordinate space before scheduling. Non-reversed playback is unaffected: same buffer, same region math.

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
AudioBufferSourceNode -> voice gain -> channel gain -> Pump gain -> Pattern Group bus -> Group FX slot 1 -> Group FX slot 2 -> Master FX slot 1 -> Master FX slot 2 -> master gain -> destination
```

There are 16 channels per Pattern Group bank, keyed by a stable group-and-pad identity. Channel volume, mute and solo act at the channel gain, so they affect active as well as future voices. Mute takes precedence over solo. Pump has a dedicated gain after the channel gain, so its envelope remains active when a target is muted and source-trigger events still fire even when the source channel is not audible. Every group has two independent serial insert slots; group outputs and source previews then pass through the two serial master slots before the final master gain.

The MVP should leave sensible headroom. Avoid adding saturation, soft clipping or machine-character processing until the clean engine is stable and measured.

## MONO-3 synthesis

MONO-3 voices are created and cleaned up inside AudioEngine. A voice contains OSC 1, OSC 2, SUB, two cascaded low-pass biquads, a soft-drive waveshaper and an amp envelope before the normal pad channel. Synth sound therefore follows the same channel, Group Bus, Pump, Group FX, Master FX and master output as a sample.

Each Pattern Group registers serializable patches with the engine. A patch owns a tempo-synced filter LFO whose phase is shared by its voices; `setBpm` updates its frequency without restarting transport. MONO uses last-note priority and pitch glide. POLY 5 limits each patch to five voices and steals the oldest voice deterministically with a short release. Manual note-off releases only the matching held pad token. Transport STOP releases/stops sequencer-created synth voices and leaves independent manual voices alone.

The sequencer supplies resolved MIDI notes, velocity, SHIFT-adjusted note-on time and `eventSpan * patch.gate * stepDuration` note-off time. An ordinary event span is one; an explicitly merged event spans its exact number of grid cells and its tail cells never retrigger. Offline rendering registers the same patches and schedules the same events through the same engine class. Render length includes synth GATE and amp release in addition to sample and delay tails.

## STRINGS synthesis

STRINGS voices are created and cleaned up inside AudioEngine, alongside but separate from MONO-3's voice code - the two do not share a voice shape, since a wide, slowly-modulated ensemble pad has different DSP needs than a mono/poly5 bass-lead voice. A STRINGS voice is two sawtooth oscillators (the second statically detuned by the patch's DETUNE, in cents, on `.detune` rather than `.frequency`, so it sums cleanly with vibrato on the same AudioParam) into one lowpass biquad (BRIGHTNESS, fixed low Q, no filter envelope) and an amp envelope, before a per-channel ensemble insert.

STRINGS is always polyphonic - there is no MONO mode or glide. Each patch is capped at `maximumStringsVoices` (8) voices, scoped per patch-runtime like MONO-3. Voice stealing prefers a voice already in its release phase over the oldest still-sounding voice, and a repeated note-on for an already-sounding note force-releases the old voice first (excluded from that same call's stealing pool, so it cannot be selected twice).

Vibrato and the ensemble's delay-time modulation are driven by three free-running (not tempo-synced) oscillators created once, engine-wide, and shared by every STRINGS patch in the app - only the depth downstream of them is per-patch. The ensemble itself (two short modulated delay lines, panned wide, mixed with a dry signal that never fully disappears) is a signal-path insert and is therefore keyed by `(patch-runtime, channelId)`, not by patch alone: a patch shared across pads by Scale Map gets an independent ensemble per pad, so two pads playing the same shared patch do not sum into one pad's channel and do not break each other's volume/mute/solo/Pump. Vibrato depth, in contrast, modulates each voice's own oscillators directly and stays per-runtime.

The sequencer and offline render integration mirrors MONO-3's exactly: resolved MIDI notes, velocity, SHIFT-adjusted note-on and `eventSpan * patch.gate * stepDuration` note-off, the same `syncStringsPatches` registration call, and a `getStringsTailSeconds` render-length term alongside the synth one.

## MONOGORG synthesis

MONOGORG is always monophonic. Three cheap oscillators (harmonically morphed main, quieter body and sine sub) are normalized by WEIGHT, pushed through one fixed gently asymmetric waveshaper, then through two cascaded low-pass biquads (four poles total), output compensation and the amp envelope. DRIVE and WEIGHT change the level entering the fixed transfer rather than rebuilding a WaveShaper curve while audio is live. RESO raises Q only on the first filter stage and applies modest output compensation, avoiding two stacked high-Q peaks.

Manual last-note legato retunes the existing oscillators and leaves their amp/filter envelopes running. A six-millisecond route crossfade moves that continuing voice between Scale-Mapped pad channels without bypassing per-pad volume, mute, solo, meters or Pump. Releasing the newest held note glides back to the previous held note; releasing the last note uses a DECAY-derived release with a five-millisecond safety floor. Sequenced notes retrigger the envelopes and use the normal AudioContext timestamps, event span, velocity, SHIFT and offline render path.

Micro-drift uses two per-patch-runtime sine oscillators at fixed incommensurate rates (0.071 Hz and 0.113 Hz), with depths of +1.1 and -0.85 cents. Their rates and phases are not randomized, so offline renders remain repeatable. Velocity scales amplitude from 0.56 to 1, opens the filter by 0.5-4 semitones and adds up to 18% extra pressure into saturation.

## POLY synthesis

POLY voices are AudioWorkletNodes whose stereo output connects directly to the ordinary requesting pad channel. Each processor runs two continuously morphable wavetable oscillators, normalized deterministic unison, restrained phase modulation from OSC 2 into OSC 1, three envelopes, two LFOs, a typed bipolar modulation routing list and a state-variable multimode filter. Wavetable sample and frame positions are interpolated per sample. Eight harmonic-limited mip levels cap partials below Nyquist for the current oscillator fundamental.

POLY is capped at eight simultaneous musical notes per patch runtime, separate from oscillator unison. Repeated notes fast-release their predecessor. Allocation prefers an already-releasing voice, then the oldest active voice. Patch edits are posted to active processors, modulation remains on the audio thread, and STOP disconnects sequenced processors through the same lifecycle used by other Station synth voices. Offline rendering loads the same worklet and includes AMP release in its measured tail.

The POLY OSC display reuses the ordinary channel meter analyser as a read-only oscilloscope source. The UI pulls copied post-fader time-domain samples only while the OSC page is mounted, draws at no more than 30 fps and falls back to the selected static wavetable during silence. No AudioNode crosses into React and visualization timing does not participate in synthesis or scheduling.

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

The current implementation schedules all loaded pad tracks against the selected Pattern Group's complete A–D section chain: 16, 32, 48 or 64 steps. Each section remains a local 16-step scheduler page, and the audio-clock scheduler advances or loops the section index only at its boundary. It wakes every 25 ms and uses a 100 ms look-ahead window; each voice receives an absolute AudioContext.currentTime timestamp.

Transport STOP cancels further scheduling and stops voices created by the sequencer. Manual pad voices and source-preview voices remain separate; source preview has its own STOP SOURCE control. The engine reports a suspended or interrupted context to the UI, which stops the transport and its voices. After an explicit initial START AUDIO, it requests a resume when the page becomes visible again and retries from the next pointer or keyboard gesture when browser policy requires fresh interaction. START AUDIO remains the explicit fallback. Suspend/resume and timing behavior still require acceptance testing in current Chrome and Edge, and interruption recovery requires a real iPhone Safari check.

### M4 implementation history

The original M4 scheduler established the 25 ms wake interval and 100 ms look-ahead strategy. Its current extension schedules every loaded pad track, and the wake timer only invokes planning; it does not provide musical time. Before scheduling a step, the scheduler resolves its event owner: an ordinary active cell owns itself, while every tail cell in an explicitly merged run belongs to the run's first cell and is skipped. Sample events are capped to the stored span (apart from migrated legacy unbounded one-shots), and synth event gates scale from the same span. Natural SONG completion reports the final audio-clock grid boundary rather than treating the earlier planning callback as completion: TRACKS continues planning the remaining pre-boundary starts, stamps every current/new source to stop at that boundary, rejects starts beyond it, and the UI changes state from an audio-clock marker while pattern release tails remain audible. Manual STOP remains immediate and cancels the marker.

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

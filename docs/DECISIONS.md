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

## DEC-021 — WAV export renders the song offline through the live audio path

**Status:** Accepted

RENDER in the PROJECT System Display panel writes the SONG playlist to a 16-bit stereo WAV file. The render is a second `AudioEngine` built over an `OfflineAudioContext` and driven by the same `StepSequencer` that drives live playback: the sequencer's wake-up is injected, so live playback wakes on a timer and a render wakes on the render clock through `OfflineAudioContext.suspend()`. Real-time capture through `MediaRecorder` was rejected because Chrome offers no WAV container, so every export would pass through Opus, and because a render taking as long as the song cannot survive a phone locking its screen.

Consequences:

- the render is faster than real time, deterministic and sample-accurate, and live playback keeps its own context and engine instance untouched,
- swing, per-step SHIFT, CHOP choke groups, Pump and both effect racks keep their live behaviour because the context clock genuinely advances between scheduling passes, rather than the whole song being stamped out against a frozen clock,
- the transport and the render both read `getSongTracksForSlot`, so a file cannot drift from what the sequencer plays,
- a render is always one pass of the playlist from slot 1 to the last occupied slot; LOOP SONG is a monitoring preference and PATTERN mode is not exported, since bouncing a loop belongs to M10 resampling, which returns to a pad instead of leaving as a file,
- the render length is computed rather than guessed: the longest sample that actually plays, a delay's decay to -60 dB capped at twelve seconds, and a safety margin, with a ten-minute ceiling that fails with a message instead of exhausting a phone's memory,
- mute and solo are honoured exactly as monitored and the panel warns when SOLO is latched, the metronome is structurally absent because `ProjectState` does not carry it,
- there is no limiter and no normalisation. A limiter present only in the render would make the file quieter and denser than the monitor, and one present in both paths is a master-bus decision rather than an export feature. Instead the peak is measured and an over-hot render offers a single scalar trim to -0.3 dBFS, which changes level and nothing else,
- 16-bit is not a character choice. Sampler character comes from 12-bit machines and lower rates, and it belongs in an effect where it can be heard while playing, not in a file header,
- the sample rate follows the live context, so decoded buffers are reused with no resampling and no second decode,
- the file drops the leading bit-exact silence that the master rack's compressor lookahead produces, so a render lands on the grid without hard-coding any browser's latency,
- `renderSongToBuffer` returns an audio buffer and the WAV encoder is separate, so M10 resampling can reuse both without an export path in the way.

## DEC-022 — MONO-3 is a constrained pad source

**Status:** Accepted

MONO-3 is an explicitly approved oscillator-synth exception. A Pattern Group owns serializable patches and its pads may reference one instead of a sample. It uses the existing pads, 16-step patterns, A–D variants, Playlist, Pump and FX routing; it does not introduce a Piano Roll or another sequencer.

Consequences:

- sample and synth sources are mutually exclusive on a pad and cross-type replacement requires confirmation,
- Scale Map shares one patch ID while keeping pitch and chord voicing on each pad,
- MONO provides last-note priority and glide; POLY 5 is capped at five voices per patch with deterministic oldest-voice stealing,
- oscillators, filters, shared-phase tempo LFO, envelopes, drive and voice cleanup remain inside AudioEngine,
- PATTERN, SONG and offline WAV use the same pad resolver, scheduler and engine path,
- schema v10 stores patches, pad references and chord intervals; v1–v9 migrate with neutral synth defaults,
- MIDI, Piano Roll, note lengths per step, automation, mod matrix, wavetable, presets, resampling and unbounded polyphony remain out of scope.

## DEC-023 — STRINGS is a second, deliberately different constrained pad source

**Status:** Accepted

STRINGS is a second oscillator-synth pad source alongside MONO-3, sharing its constrained-pad-source shape (DEC-022) rather than introducing a new architecture, but deliberately different in DSP and character: a wide, slow, always-polyphonic analog string-machine/ensemble pad rather than a mono/poly5 bass-lead voice. Station's audit before implementation found no on-screen keyboard or MIDI input anywhere in the app - STRINGS plugs into the same pad + `chordIntervals` note system MONO-3 already uses, not a new one.

Consequences:

- a pad's source is mutually exclusive across sample, MONO-3 and STRINGS (`assetId` / `synthPatchId` / `stringsPatchId`), never more than one at a time, and cross-type replacement requires confirmation in both directions,
- Scale Map shares one STRINGS patch ID across pads while keeping pitch and chord voicing on each pad, identically to MONO-3,
- STRINGS is always polyphonic - there is no MONO mode or glide - capped at eight voices per patch with stealing that prefers an already-releasing voice over the oldest still-sounding one, and a repeated note-on force-releases a duplicate note first,
- the ensemble (two modulated delay lines feeding a per-channel insert) is keyed by `(patch-runtime, channelId)`, not by patch alone, so a patch shared across pads by Scale Map does not break per-pad volume/mute/solo/Pump,
- vibrato and ensemble modulation are driven by free-running, non-tempo-synced, engine-wide shared LFOs rather than MONO-3's tempo-synced filter LFO,
- oscillators, the shared lowpass, envelopes, the ensemble and voice cleanup remain inside AudioEngine, as a separate voice shape from MONO-3's - the two are not node-for-node shared,
- PATTERN, SONG and offline WAV use the same pad resolver, scheduler and engine path as MONO-3,
- schema v11 stores STRINGS patches, pad references and chord intervals; v1–v10 migrate with neutral defaults and unchanged existing sound,
- six presets (WARM STRINGS, SLOW ORCHESTRA, DISCO STRINGS, DARK PAD, SYNTH BRASS, SOFT CHOIR) apply parameter values on the same engine, not separate hidden instruments,
- MIDI, an on-screen keyboard, sampled/multisampled strings, physical modeling, legato/round-robin/velocity layers, MPE, convolution reverb, mod matrix, a separate full Brass Synth, oscillator waveform choice, a filter envelope and a third oscillator layer remain out of scope for the first version.

## DEC-024 — DRUM SYNTH is a sample-generating instrument, not a pad source

**Status:** Accepted

Unlike MONO-3 (DEC-022) and STRINGS (DEC-023), DRUM SYNTH is not a third constrained live pad source. It holds one editable, project-persisted KICK patch - not a Pattern-Group-owned collection referenced by id - and pads never hold a `drumSynthPatchId`. ADD TO PAD renders the current patch offline to a WAV and assigns it through the same `loadSampleBlob` path the built-in library and CHOP already use; the result is an ordinary sample-bearing pad from that point on, indistinguishable from one loaded any other way, and later panel edits do not retroactively change it. This is architecturally closer to the not-yet-built M10 Resampling milestone than to MONO-3/STRINGS: the source is on-the-fly synthesis rather than master-bus capture, but the destination and mechanism (render to buffer, encode WAV, assign to pad) are the same shape.

The picker in SYNTH gained a third card alongside MONOPOLY and STRINGS. Selecting it does not create a Pattern Group or touch any pad - it only opens `DrumSynthWorkspace`, a pad-independent panel gated by its own `drumSynthPanelOpen` flag rather than by the selected pad's patch id, unlike the other two instruments' pickers.

The first version implements only a KICK sound, behind a `DrumInstrumentType` union sized for SNARE, CLAP, HAT, TOM and PERC to follow later without a rewrite: one more member in the union, one more `DrumXPatch` interface, one more DSP module mirroring `kickVoice.ts`, one more sub-panel - with no change to the picker, ADD TO PAD, or persistence plumbing, all of which are already generic over "whichever instrument is selected."

DUST, the layer tying the Vinyl Dust identity to this instrument's sound, uses a small seeded PRNG (`drumsynth/seededRandom.ts`) rather than raw `Math.random()` - the first such utility in the codebase. The algorithm is deterministic given a seed; the seed itself is not, so live preview retriggers vary hit to hit as intended while a rendered-and-placed kick is a frozen WAV and therefore trivially stable across reload and export - nothing about its reproducibility needs to be persisted.

Consequences:

- no new `PadState` field, no new `StepSequencerTrack` union arm, no `songTracks.ts` change - the sequencer, mixer, Pump routing (keyed by `channelId`/`groupId`, not source type) and WAV export handle a kick-bearing pad exactly like any other sample, at no extra cost,
- schema v15 adds one top-level `drumSynth: DrumSynthState` field to `ProjectState`; v1-v14 migrate with a default KICK patch,
- the kick's Web Audio graph is built by a standalone module (`drumsynth/kickVoice.ts`), not as `AudioEngine` methods alongside MONOPOLY/STRINGS, because it has to run identically in two contexts that share no other state: a live preview voice (routed through `AudioEngine`'s master effects, for a consistent preview/mixer path) and a throwaway `OfflineAudioContext` bounce (`drumsynth/renderKick.ts`) that needs none of `AudioEngine`'s channels, groups or master rack,
- no `DynamicsCompressorNode` or limiter in the kick voice; level safety comes from a bounded per-layer gain budget and one fixed output trim, so the full parameter range stays clip-safe without flattening its own dynamics,
- ADD TO PAD reuses the existing occupied-pad confirmation (`StationConfirm`) and the library's "arm an item, then tap a pad" mechanism (`PadGrid`'s drop-target affordance, generalized from a library-sample-specific prop to a plain filename),
- LFO/mod matrix, multi-operator FM, user-sample layering, effect sends, a global Vinyl Bed, full vinyl emulation, an internal sequencer, multiple simultaneous DRUM SYNTH tracks, automatic Pump sidechain wiring and SNARE/CLAP/HAT/TOM/PERC's own UI and DSP remain out of scope for the first version.

## DEC-025 — SNARE is DRUM SYNTH's second voice; kick-specific plumbing generalized

**Status:** Accepted

SNARE joins KICK behind the `DrumInstrumentType` union DEC-024 sized for exactly this: `drumInstrumentTypes = ['kick', 'snare']`, a `DrumSnarePatch` alongside `DrumKickPatch` in the `DrumPatch` union, and a second field on `DrumSynthState`. `DrumSynthWorkspace` now holds both patches at once and switches which controls render via a KICK/SNARE segmented control - switching is non-destructive, nothing is lost - rather than the picker gaining a fourth card; DRUM SYNTH is still one entry in the SYNTH picker.

Adding the second voice required generalizing a handful of places that were only ever exercised by one instrument and so had no reason yet to be instrument-agnostic: `AudioEngine.previewDrumKick` became `previewDrumSound(patch: DrumPatch)`, dispatching on `patch.instrument`; `KickVoiceHandle` moved to `drumSynthTypes.ts` as the shared `DrumVoiceHandle`; `App.tsx`'s `pendingDrumKick`/`addDrumKickToPad`/`dropDrumKickOnPad` became `pendingDrumSound`/`addDrumSoundToPad`/`dropDrumSoundOnPad`, each dispatching the render function and output filename (`KICK.wav`/`SNARE.wav`) off `drumSynth.selectedInstrument`. None of this touched the picker, ADD TO PAD's confirm-before-overwrite flow, or persistence - they were already generic over "whichever instrument is selected," exactly as DEC-024 intended.

SNARE's own DSP (`drumsynth/snareVoice.ts`) is a three-layer model (tonal body, seeded noise/rattle, a short attack/snap), not a kick with noise added: two oscillators a fixed interval apart stand in for a physical membrane rather than one pure tone, RATTLE is the identity-defining layer rather than a garnish, and BODY/RATTLE/SNAP mutually and mildly duck each other rather than summing unchecked. Unlike KICK, SNARE has no user-facing DRIVE - saturation is present but fixed/internal, freeing the parameter budget for independent BODY DECAY and RATTLE DECAY instead. It is also the first DRUM SYNTH voice to render in stereo (`renderSnare.ts`, 2 channels vs. KICK's 1): the tonal body and SNAP stay mono (built from mono sources, which Web Audio up-mixes identically to both channels once summed with RATTLE), while RATTLE alone is built from a genuinely 2-channel seeded noise buffer, so width has exactly one source and the mix stays mono-safe by construction rather than by care.

**Determinism is deliberately stricter than KICK's.** KICK's CLICK layer was intentionally left on raw, unseeded `Math.random()` - a short transient with no reproducibility requirement. SNARE's brief requires the opposite: RATTLE, SNAP and DUST are all seeded, from three sub-streams derived from one `seed` (`seed`, `seed + snapSeedOffset`, `seed + dustSeedOffset`), so TRIGGER and the ADD TO PAD render never meaningfully differ and a saved SNARE is reproducible from `(patch, seed)`. In practice this holds down to inaudible, sub-quantization floating-point noise (confirmed present in KICK too under similarly extreme all-parameters-maxed settings) rather than bit-exact Float32 output - an OfflineAudioContext rendering characteristic of the browser's audio graph, not a property either voice's code controls, and well below the ±1 LSB level that would matter after 16-bit PCM encoding.

Consequences:

- schema v16 adds `snare: DrumSnarePatch` to `DrumSynthState`; v1-v15 migrate with a default SNARE patch, KICK unchanged,
- `saturatorCurve(amount)` in `drumSynthOperations.ts` is now the shared rational-saturator generator behind both KICK's user-facing DRIVE and SNARE's fixed internal amount; `dustToShape`/`dustDurationSeconds` are likewise shared, unprefixed, and used identically by both voices,
- adding a third voice (CLAP, per the original DEC-024 sizing) repeats this shape: one more patch type, one more `drumsynth/<name>Voice.ts` + `render<Name>.ts` pair, one more segmented-control entry and controls section, zero changes to the picker, ADD TO PAD, or the persistence ladder beyond the routine schema bump,
- CLAP, HAT, TOM, PERC, a SNARE-specific stereo width control, and any cross-voice layering (e.g. kick+snare in one hit) remain out of scope for this version.

## DEC-026 — Microphone recording is field capture into CHOP, not a track type

**Status:** Accepted

Holding the transport REC control opens a non-layout-shifting action sheet that selects PATTERN or MICROPHONE. A short tap keeps the existing PATTERN count-in/punch workflow when PATTERN is selected. In MICROPHONE mode it acquires the device input, records at most two minutes, displays a presentation-only level meter, and sends the stopped take directly to the selected Bank's CHOP source.

The input path uses the browser's `MediaRecorder` because field capture is necessarily real-time and must follow the device's supported input codec. This does not reverse DEC-021's rejection of MediaRecorder for SONG export: the completed microphone Blob is immediately decoded and encoded to the same 16-bit WAV asset shape as every other Station sample, whereas offline SONG rendering remains deterministic and never passes through a lossy real-time recording.

Consequences:

- microphone takes use the existing CHOP session, waveform, slicing, pad mapping, IndexedDB asset and project-save paths; there is no new persisted track type or schema version,
- `AudioEngine` owns the `MediaStream`, recorder, analyser and silent monitoring nodes, while React owns only action-sheet state, elapsed presentation time and meter snapshots,
- input requests mono and disables echo cancellation, noise suppression and automatic gain where browsers honour those preferences; the actual device channel layout remains acceptable,
- WebM/Opus is preferred, with MP4 and Ogg fallbacks, then the browser default; the take is converted to WAV before becoming a project asset,
- capture is capped at 120 seconds to bound mobile memory, and all tracks/nodes are stopped on completion, cancellation or engine disposal,
- the first version has no overdubbing, multitrack audio, input monitoring, punch editing, denoising, automatic gain, cloud upload or background/locked-screen guarantee.

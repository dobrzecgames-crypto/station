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

## DEC-026 — Per-slice REVERSE, a 32-slice ceiling decoupled from the pad grid, real-buffer autoslicing and onset-based tempo detection

**Status:** Accepted

CHOP gains four things at once, all scoped to the existing Unified Chop Workspace foundation rather than a new workflow: a per-slice REVERSE toggle, a higher and pad-count-independent slice ceiling, finer/cleaner SMART autoslicing, and a tempo reading confirmed by onset spacing instead of guessed from duration alone.

**REVERSE** is a boolean on `SampleSlice` and `PadState`, not a second copy of the source file. `AudioEngine` lazily builds and caches one whole-asset time-reversed `AudioBuffer` per asset the first time any slice/pad on it is played reversed (`ensureReversedBuffer`/`resolvePlaybackBuffer`) - never one copy per slice - and `toPlaybackRegion` mirrors the requested start/end into that buffer's coordinate space (`reversedStart = duration - forwardEnd`, `reversedEnd = duration - forwardStart`) before the existing clamp math runs unchanged. `scheduleSample` and `previewAsset` both resolve through this; `triggerSample`, the sequencer (`songTracks.ts`'s shared `toTracks`) and offline render all reach it for free since they already funnel through `scheduleSample`/its `TriggerSampleOptions`. A slice's reverse flag overwrites its mapped pad's unconditionally on every re-slice, the same as region (not preserved-across-re-slice the way `pitchSemitones` is, since reverse has a definite per-slice source value to inherit from and pitch didn't); toggling reverse directly on an already-mapped pad in the Sample Editor is a standalone one-way override, exactly matching how manual region edits there already behave.

**The slice ceiling rises from 16 to `maxChopSliceCount` (32)** and is no longer assumed to equal the pad grid size. `applyChopMapping`'s existing `pads.map((pad, index) => nextSlices[index] ...)` already silently leaves any slice index beyond `pads.length` unassigned, so slices 17-32 simply stay editable/previewable in the Chop Workspace's slice list with no pad of their own - no pagination or banking system was needed. This surfaced two places that had quietly assumed slice count could never exceed pad count: `validateSlices` in `ProjectState.ts` (now takes an explicit `maxCount`, `padCount` for `pad.slices` and `maxChopSliceCount` for `chop.slices`), and `App.tsx`'s `selectChopSlice` (now guards `index < pads.length` before indexing the pad array).

**SMART autoslicing** now analyzes the real decoded buffer instead of the coarse, UI-drawing-only waveform peaks cache (`AudioEngine.getWaveformPeaks`, capped at 512 buckets total - 20-50ms/bucket on a 20-25s source). A new `AudioEngine.getAnalysisEnvelope` computes an RMS envelope at a much finer, still-cheap resolution (~5ms/bucket, its own bucket-count safety cap) on demand. `detectTransientCandidates` (extended in place, not forked) keeps its existing rise-is-a-local-maximum-of-the-rise-curve shape and `minimumGapSeconds` debounce, but replaces the old fixed `minimumAmplitude` floor with one relative to the clip's own 10th-percentile-to-peak range, so a quiet melodic take and a hot drum loop are each judged against their own dynamics; each surviving candidate is then nudged to the nearest zero-crossing (or, failing that, the quietest nearby sample) within an 8ms window, reducing clicks without touching the fixed first/last slice boundaries. This same real-buffer analysis is computed once per loaded source in a `useEffect` in `App.tsx` (`requestIdleCallback`, `setTimeout` fallback for Safari), not in `ChopWorkspace`'s render - the workspace now receives `candidates` as a prop.

**Tempo detection** (`chop/tempoDetection.ts`, new) shares that same onset detector rather than adding a second one. `detectTempo` builds a weighted inter-onset-interval histogram over every onset pair (weighted by both onsets' strength, robust to an occasional missed/spurious onset), folding each implied tempo by octave into the project's existing 60-200 BPM range - which lets a half-time/double-time pair (e.g. 70 and 140) each accumulate their own votes rather than being merged or clamped. A plausible duration-implied bar count (1/2/4/8/16 bars) is consulted only afterward, only to raise confidence on close agreement, never to produce the number or to lower confidence on disagreement. The result is `{ bpm: number | null; confidence: 'certain' | 'probable' | 'uncertain' }`; nothing calls `setBpm` automatically - the reading surfaces in `ChopDisplay.tsx`'s existing display-panel tenant next to SOURCE PITCH, and only an explicit APPLY BPM click commits it, mirroring SMART's own preview-then-apply pattern.

Consequences:

- schema v17 adds `reversed: boolean` to `SampleSlice` and `PadState`; v1-v16 migrate with `reversed: false` everywhere, reproducing prior playback exactly. `src/storage/ProjectRepository.ts` hand-maintains its own version-dispatch table independent of `ProjectState.ts`'s migration functions and needed its own new `v15ProjectSchemaVersion` constant, dispatch branch and validity-guard term - easy to miss, since every earlier schema bump in this file's history required the identical three-part edit there too,
- `PadState.slices` remains dead/vestigial (every pad-construction site sets it to `[]`; nothing reads it for behavior) and keeps the old 16-item cap for schema continuity, which costs nothing since it is never populated,
- non-reversed playback is byte-for-byte unchanged - same buffer, same math, `reversed` simply falsy - and no existing ≤16-slice project's behavior changes,
- EQUAL's boundaries and manual add/move-cut placement are deliberately never snapped, only SMART's transient-derived cuts are - "don't reduce boundary precision" applies to the two placement modes that are explicit user intent, snapping is only ever a few-sample click-safety nudge on the mode that's inferring the cut point itself,
- CHOP's finer analysis introduced no Web Worker - none existed anywhere in this repo, and the realistic data sizes (a few thousand envelope buckets, at most a few dozen onsets) stay comfortably cheap for a `useEffect` + idle-callback off the render path,
- a further-raised ceiling, per-slice pitch, slice banks/paging, gate/loop decisions and any time-stretching remain out of scope for this version.

## DEC-027 — TRACKS adds a real linear timeline, a deliberate, scoped extension of DEC-002/DEC-018

**Status:** Accepted

DEC-002 declared Station "a sampler groovebox, not a DAW" with "no infinite timeline... no general-purpose mixer or routing system," and DEC-018 called the Pattern Playlist "a constrained groovebox arrangement system, not a full DAW timeline, audio-clip system or scene framework." TRACKS is a conscious, scoped exception to both: a normal linear multitrack audio timeline, added as a seventh main view alongside CHOP/PADS/SYNTH/SEQ/SONG/MIX rather than replacing or restructuring any of them. The existing pattern/pad/Pump/FX workflow is unchanged; every touch point below is additive.

**Naming.** `AudioTrack`/`AudioClip` (new, `src/tracks/tracksTypes.ts`) are deliberately not called `Track`/`Clip` bare: `StepSequencerTrack` (`src/audio/StepSequencer.ts`) already names something else - an ephemeral, never-persisted "this pad plays this pattern" instruction built per scheduling pass by `song/songTracks.ts`. The two never reference each other's types.

**Data model.** `ProjectState.audioTracks: AudioTrack[]` (schema v18) sits beside `patternGroups`/`playlist` as an independent top-level collection. An `AudioClip` references the same shared `SampleAssetId` pool pads and CHOP already draw from - no separate asset system - and stores a *non-destructive* source region (`sourceOffsetSeconds`/`sourceEndSeconds`, mirroring `SamplePlaybackRegion`) plus a *timeline* placement (`startBeat`/`lengthBeats`, in beats at the project BPM, not wall-clock seconds - the same units `StepSequencer`'s `stepDuration = 60/bpm/4` already uses, so TRACKS and the pattern/song grid share one clock and one snap vocabulary: `1 bar` = 4 beats = 16 steps). For a non-looped clip, `lengthBeats` is kept in sync with the natural (rate-1) duration of the source region by the trim operations (`src/tracks/tracksOperations.ts`); for a looped clip the two become independent, since looping tiles the region to fill however much timeline space it is given. Selection is UI-only component state, never persisted, matching how Pad/Chop selection already works.

**Routing.** Each `AudioTrack` is its own independent mixer bus - `effects: EffectRackState`, `gain`/`muted`/`solo` - structurally identical to a Pattern Group's bus+FX, not a new engine concept. `AudioEngine.ensureGroupBus`/`ensureGroupEffects`/`ensureChannel` were already generic over any string id; a track's own id does double duty as both `groupId` and `channelId` (one channel per track, not 16 like a pad bank, since a track's clips share one fader). `MixTargetSelector` (`src/mixer/GroupMixPanel.tsx`) gained track buttons (`T1, T2…`) alongside `G1…G8`/`MASTER`, and `BusDisplayLauncher`/`EffectDisplayLauncher` - already generic on `BusState`/`EffectRackState` - needed no changes to serve them. Global SOLO is therefore genuinely global by construction: soloing a track silences Pattern Groups too and vice versa, because both live in the engine's one `groupBuses` map and `applyGroupGain`'s solo check already scans it unscoped.

**Scheduling.** `TimelineScheduler` (`src/audio/TimelineScheduler.ts`) is a sibling to `StepSequencer`, not a modification of it: linear one-shot clip events from a start position, not a looped 16-step pattern. It reuses `StepSequencer.ts`'s `SequencerTicker`/`createTimeoutTicker` directly and defines its own minimal `TimelineSchedulerClip` shape rather than depending on `AudioTrack`/`AudioClip` - the same layering `song/songTracks.ts` already provides between `PatternGroup` and `StepSequencerTrack`. `AudioEngine.scheduleClip` (new, beside `scheduleSample`) always truncates actual playback at the clip's own timeline-slot boundary via an explicit `source.stop()`, regardless of loop/pitch/tempo-match rate - the single rule that keeps a pitched-down clip from running short and a pitched-up or looped one from bleeding into the next clip, and what lets a clip's on-screen width always equal what you hear. Looping uses the native `AudioBufferSourceNode.loop`/`loopStart`/`loopEnd` rather than manual re-triggering. Starting playback with the chosen position already mid-clip (resume, or a scrubbed playhead) is handled once at `start()`, computing the correct in-progress source offset rather than waiting for a `startBeat` that has already passed. A new `'timeline'` `ActiveVoice` origin and `stopTimelineVoices()` keep transport STOP symmetric with `stopSequencerVoices()` without engaging CHOP's sequencer-specific choke-group logic. Pitch is playback-rate, exactly like a Pad (DEC-008 still holds - no time-stretching engine-wide); an optional rate-based tempo-match (`resolveTempoMatchRate`, stacking with pitch) reuses `chop/tempoDetection.ts`'s onset detector rather than adding a second one, and is documented as changing pitch too, not a real stretch.

**UI split.** The compact `TracksWorkspace` (all tracks, low, simplified) and the fullscreen `TrackEditor` (one track, precise, pinch-zoomable) are two different components over the same `audioTracks` data, not one component at two zoom levels. `TrackEditor` renders as a `position: fixed` sibling of `.station-panel`, not a replacement for it, so `TracksWorkspace` never unmounts while the editor is open - its scroll/zoom/selection survive automatically when the editor closes, with nothing to save and restore by hand. Entry is both an explicit header button and a double-tap, reusing the `lastTapRef`/`doubleTapThresholdMs`/`touch-action: manipulation` shape `sequencer/SequencerControls.tsx` already established (including the `touch-action` guard from the start, learned from that feature's own follow-up fix for the browser's native double-tap-zoom). Drag-vs-scroll in the compact view is disambiguated by touch target, not gesture heuristics: a clip carries `touch-action: none` and owns its pointer drag; empty lane space keeps the container's native `pan-x` scroll. The editor's pinch-zoom needs full pointer control instead, so its lane is `touch-action: none` throughout and implements single-finger pan and two-finger pinch itself. Every slider (GAIN, FADE IN/OUT, PITCH) is a plain `<input type="range">`, so `SliderMagnifier` upgrades it for free.

Consequences:

- schema v18 adds `audioTracks: AudioTrack[]`; v1-v17 migrate with an empty list, reproducing existing CHOP/PADS/SEQ/SONG/SYNTH/MIX projects exactly. `ProjectRepository.ts`'s hand-maintained dispatch table needed the same three-part edit DEC-026 already flagged as easy to miss (new `v16ProjectSchemaVersion` constant, new dispatch branch, new validity-guard term),
- `collectReferencedAssetIds`/`assetIsReferencedByGroups` were extended to include track clip assets - an asset used only by a clip must not be evicted as a pad/CHOP orphan, and vice versa,
- eight tracks maximum (`maximumAudioTracks`), matching the existing eight-Pattern-Group cap - a first-version limit, not a technical ceiling,
- TRACKS plays independently of PATTERN/SONG transport mode - it is arrangement content that always runs linearly from its own playhead alongside whichever pattern content is active, not a third mode to choose,
- WAV export (`RENDER`, DEC-021) does **not** yet include TRACKS audio - `renderSongToBuffer` still renders only patterns/SONG, a known limitation of this version, not an oversight,
- cross-track clip drag, track rename, per-clip choke groups, a tempo-match UI control (the engine and data support it; no per-asset BPM detection is wired up to feed it yet), and copy/paste beyond in-place duplicate remain out of scope for this version.

### Addendum — orientation is a TRACKS layout switch, not a Station navigation system

Phone rotation was added as a second way to reach the wide layout, alongside (never instead of) manual tab selection. It changes presentation only, gated entirely behind `mainView === 'tracks'`; nothing about it can select the TRACKS tab from elsewhere or touch the audio engine, the scheduler or `audioTracks`.

**Detection.** `useTracksLayoutMode` (`src/tracks/useTracksLayoutMode.ts`) does not key off `orientation: landscape` alone - a tablet in portrait is already wide enough for the arranger, and a desktop window has no meaningful orientation at all. It instead classifies the viewport by its *short axis* (`Math.min(innerWidth, innerHeight) < 500px` = phone-class), which stays the same physical value whichever way a phone is held: `!isPhoneClass || isLandscape` is `'wide'`, otherwise `'compact'`. That single rule produces all four required cases (phone portrait → compact; phone landscape, any tablet orientation, and desktop → wide) without a third layout or a device sniff. Listened for via `matchMedia('(max-width/max-height: 499px)')` `change` listeners (the same shape the historical `claude/desktop-layout-foundation` branch's `useIsDesktopLayout` already used, not a resize poll), plus `resize`/`orientationchange` as a deliberate second signal - real mobile browsers have a documented history of inconsistent timing between these three, which is exactly why the brief itself calls out unreliable orientation reporting as a reason TRACKS must stay manually reachable too.

**Two components, one dataset, one view-state.** `TracksWorkspace` (compact) and the new `TracksArranger` (wide, `src/tracks/TracksArranger.tsx`) are alternately mounted by `App.tsx`, never both at once - unlike `TrackEditor`, which stays under whichever of the two is active and needs no orientation awareness of its own, since it already fills whatever fixed-viewport space it is given. Because rotation now swaps *which component* is mounted, the selection/zoom/scroll state that used to live inside `TracksWorkspace`'s own `useState` was lifted to `useTracksViewState` (`src/tracks/useTracksViewState.ts`), called once in `App.tsx` and passed to both; scroll position specifically uses a plain ref rather than state, since it only needs to be re-applied once on mount, not re-rendered per pixel scrolled. The pointer-drag/trim/double-tap/ruler-seek logic both components share - including the exact fix for a real bug caught during the original TRACKS verification pass (`event.currentTarget` read inside a `setState` updater, already null by then per native `Event` semantics, not React pooling) - was extracted once into `useTrackClipDrag` (`src/tracks/useTrackClipDrag.ts`) instead of risking a second, independent copy of the same mistake.

**Escaping the phone-width cap.** `TracksArranger` mounts as a `position: fixed` sibling of `.station-panel`, the same mechanism `TrackEditor` already used to escape `--station-app-width`'s 430px cap (`src/App.css`, "Mobile-only lock") - confirmed directly in the browser at 768px (tablet) and 1440px (desktop) viewports: the arranger fills the real width while `.station-panel` itself, hidden behind it, stays capped at 430px for every other tab.

**Undo/redo.** `useTracksHistory` (`src/tracks/useTracksHistory.ts`) holds plain `AudioTrack[]` snapshots (past/future, depth 50) behind `App.tsx`'s new `updateAudioTracks`, which every clip/track *arrangement* edit (move, trim, split, duplicate, loop, reverse, gain, fade, pitch, mute, solo, gain, reorder) now calls instead of `setAudioTracks` directly. Import and delete deliberately do not: delete already frees the clip's decoded asset in the engine (`evictUnusedTrackAssets`), so undoing it would restore clip data pointing at an asset the engine no longer holds: the existing `StationConfirm` prompt remains delete's only safety net, by design, not by omission. `updateAudioTracks` reads the pre-edit value from an always-current ref (`audioTracksRef`, assigned fresh every render, the same shape `sequenceConfigRef` already used) rather than a `setAudioTracks` functional updater, specifically so recording history is a plain top-level call rather than one `setState` nested inside another's updater callback. A shared `syncTrackBusToEngine(track)` re-pushes volume/mute/solo/effects to the engine after both undo/redo and `openProject` restore a snapshot, replacing what used to be an inline loop only in the latter.

Consequences:

- verified directly in-browser (not just read from the code): a live, in-page rotation (viewport resize plus a dispatched `resize` event, since the automated browser tool's own `resize_window` changes `window.innerWidth`/`innerHeight` without dispatching a `resize`/`matchMedia change` event - real device rotation does) correctly swapped compact↔wide, kept the same clip selected, and **kept transport playback running without interruption or a scheduler restart** across both directions of the swap,
- the live listener firing on a genuine device rotation could not be exercised through this tool beyond the manual-dispatch proxy above and needs confirmation on the user's real phone, consistent with how every other gesture-gated behavior in this app has been signed off,
- `TracksArranger`'s toolbar exceeds the brief's minimum list by two buttons (a LOOP toggle, kept for parity with the compact view's per-clip actions so landscape is never less capable than portrait; a manual exit button, since a locked-orientation phone, a tablet or a desktop has no "rotate back" - it returns to whichever tab was active before TRACKS, tracked by a small ref rather than a fixed default),
- a third, tablet-specific layout was deliberately not built - a tablet receives the same `TracksArranger` a desktop does, differentiated only by ordinary responsive CSS, not a separate component.

### Addendum — the compact view's per-track header became a full-width card, not a fixed-width column

A real, deployed session surfaced a layout bug the emulated-viewport testing that shipped the previous compact-view pass (M/S/⋮ collapse, per-track accent color) never caught: `.tracks-headers` was `flex: 0 0 128px` with no `min-width: 0`, and a flex item's automatic minimum size is its content's min-content size unless that is overridden - an untruncated long track name (a timestamped recording filename, `STATION-20260802-2201-87BPM`, well past what any of the earlier session's own short test names like `CHOP-SAMPLE-1` happened to need) forced the column to roughly 70% of a 390px viewport instead of the intended 128px, since ellipsis truncation never got a constrained width to truncate against in the first place.

Rather than patch the same fixed-width-column shape with a `min-width: 0` and call it done, the compact view was restructured to what the user's own brief asked for directly: one card per track, a slim header bar *above* a timeline instead of a column *beside* one, so the header is small by construction and the clip/waveform gets nearly the full card width. This is a deliberate departure from `TracksArranger`'s side-rail shape (kept as-is, per the brief - "don't force identical layouts for portrait and landscape"), not a shared component: `TracksWorkspace` now renders one independent horizontally-scrolling strip per card (each with its own ruler), not one shared scroll region under one shared ruler.

**Why independent strips, not one shared scroll region under stacked headers.** A card's header must never scroll horizontally while its timeline strip below it does - impossible if both are descendants of the same `overflow-x: auto` element, since that ancestor's scroll moves everything inside it, headers included. `position: sticky` was considered and rejected for the header instead: it would likely work, but iOS Safari's sticky-inside-a-scroll-container behavior has a real history of quirks, and this genuinely is the user's own phone (per the screenshot that reported the original bug) - not worth the risk over a synced-scroll implementation that is already a known-simple pattern.

**Keeping N containers scrolled as one.** `TracksViewState.scrollLeftRef` (unchanged) is still the single source of truth; `TracksWorkspace` now writes/reads it from every strip instead of one. `registerStrip(trackId)` seeds a newly-(re)mounted strip's `scrollLeft` from that ref; `handleStripScroll(trackId)` fans a scroll on any one strip out to every other via a plain `Map<string, HTMLDivElement>` of live strip refs - no debouncing or feedback-loop guard beyond a same-value check, since the app is capped at `maximumAudioTracks` (8) and a `scrollLeft` write is cheap even during momentum scroll. `useTrackClipDrag`'s single `scrollContainerRef` (used only by `handleRulerPointerDown`'s tap-to-seek - drag/trim already work from pointer deltas, not absolute container geometry) is fed whichever strip mounted most recently - correct regardless of which one, since by construction every strip sits at the same `scrollLeft` and the same on-screen horizontal position.

**The one deliberate `min-width: 0`.** Everything else in the new card markup is plain block layout, specifically so no *other* element needs the fix that caused this bug in the first place - only `.tracks-track-name`, the actual flex item competing for space against `TrackControls`/the expand button inside `.tracks-card-header`'s one flex row, carries `min-width: 0`. `TracksArranger`'s own rail (`.tracks-arranger-rail`, `.tracks-arranger-rail-name`) got the same one-line fix defensively - the identical bug shape, just far less visible at 160px inside a wide viewport than 128px inside a phone-width one - without otherwise touching its side-rail structure.

Consequences:

- `.tracks-headers`/`.tracks-body`/`.tracks-track-header`/`.tracks-track-header-top`/`.tracks-ruler-corner` (the old fixed-column classes) are gone from the compact view; `TracksArranger` never referenced them, so nothing outside `TracksWorkspace.tsx`/`tracksWorkspace.css` needed to change,
- each card now pays its own ~22px mini-ruler (scoped shorter than `TracksArranger`'s shared 28px one via `.tracks-card .tracks-ruler`, since it is now a per-track cost instead of a one-time page cost) rather than sharing one ruler across the whole page - a deliberate height-for-width tradeoff the user's own mockup already implied by showing bar numbers inside every card,
- verified in-browser at 390×844 with a deliberately long track name (reproducing the reported bug): the name now elides, the header stays small, scroll position stays in sync across cards (scrolled one strip via script, confirmed the others followed), and the wide arranger is visually and functionally unchanged at 844×390 - not yet confirmed on the user's own phone.

### Addendum — the wide arranger's toolbar became one compact control per concept, and its vertical scroll got fixed

The wide `TracksArranger` toolbar had grown to one button per snap division (`1 BAR`/`1/2`/`1/4`/`1/8`/`1/16`/`OFF`, six buttons wide though only one is ever active) plus the rest of the transport/history/zoom/add-track controls in a single row - workable at desktop width, cramped everywhere narrower. Two changes landed together: a compact SNAP selector replacing the six-button row, and a new, separate track-height control - four discrete visual sizes for a lane/waveform/clip (MINI/SMALL/MEDIUM/LARGE), never a continuous CSS scale.

**SNAP became a closed-by-default selector, not a smaller version of the same six buttons.** `SnapGridSelect` (`src/tracks/SnapGridSelect.tsx`) shows only the active division (`SNAP 1/4 ▾`) and opens a single-column popover on demand; `useOutsideDismiss` (`src/tracks/useOutsideDismiss.ts`) closes it on an outside pointerdown or Escape, a scoped-to-one-popover version of the same capture-phase pattern `shell/SliderMagnifier.tsx` already runs globally at the app root. The existing horizontal time-zoom (`pixelsPerBeat`, unchanged in every other respect) moved into a second, always-collapsed `⋯` popover built the same way - the one control the toolbar's own priority order left out, and not worth a responsive width-measurement show/hide system for a single group of two buttons.

**Track height is a UI preference, not project data - deliberately given the exact lifetime `pixelsPerBeat` already has.** `TrackHeightLevel` (`src/tracks/tracksTypes.ts`) and its state live in `useTracksViewState`, the same lifted, non-persisted hook `pixelsPerBeat`/selection/scroll already use - surviving a Station tab switch or a Track Editor open/close, resetting on a full reload, because nothing in this app persists any UI-only preference today (everything that is persisted goes through the versioned `ProjectState`/`ProjectRepository` schema, reserved for audio/project data). Each level's row height is a CSS custom property (`--tracks-row-height`) rather than a hardcoded number, specifically so the existing `@media (max-height: 420px)` safety net could keep working as a *cap* ("never taller than 88px") instead of a *forced value*: a plain per-level selector on `height` directly would have outranked that media query by specificity regardless of source order, wrongly pulling MINI/SMALL - already shorter than 88px by design - back up to it on exactly the short viewports where a shorter level matters most. Every other per-level property (padding, gap, name font size, `TrackControls`' M/S/⋮ button size, clip vertical inset, and MINI's header flipping from a stacked column to one row) is a plain compound selector scoped under `.tracks-arranger[data-track-height="…"]`, with no MEDIUM rule at all - MEDIUM *is* today's unscoped defaults, so the default level is byte-identical to the pre-level-system layout.

**The vertical scroll fix.** `.tracks-arranger-scroll` had silently inherited `overflow-y: hidden` from the compact view's own `.tracks-timeline-scroll` base rule (correct there - one lane per card - wrong here, where one pane holds every track's lane stacked), with nothing in `tracksArranger.css` overriding it, while `.tracks-arranger-rail` beside it had its own independent, unsynced `overflow-y: auto`. A project with enough tracks to exceed the pane's flex-stretched height already had its lower lanes silently clipped before this change, not merely scrolled out of sync - LARGE's taller rows would only have made that worse. Both containers now scroll together: the rail gained a spacer pixel-identical to the real ruler (same class, `aria-hidden`), giving both containers the same content height at every level, and `handleTimelineScroll`/`handleRailScroll` keep their `scrollTop` equal, the same two-way idea `TracksWorkspace.tsx` already applies horizontally across its N per-card strips, just vertical and between exactly these 2 elements. Changing the height level itself preserves the visible vertical position, not just prevents the clip - `changeTrackHeightLevel` measures the actually-rendered row height immediately before a level change (rather than trusting a second, hardcodable copy of the CSS ladder) to compute which row was topmost and how far into it, then a `useLayoutEffect` re-applies the equivalent scroll position once the new heights have committed; it touches only `scrollTop` on these two elements - playhead, horizontal scroll/zoom, selection and the audio engine are all untouched by a height-level change.

Consequences:

- `TracksWorkspace` (compact) and `TrackEditor` needed zero changes - every new selector is written under `.tracks-arranger[data-track-height="…"]`, structurally unreachable outside `TracksArranger`, and `TrackClipWaveform`'s existing `ResizeObserver` redraw already repaints a resized clip from the same cached peaks with no re-decode, so a height-level change was free there too,
- the toolbar's target order (`PLAY STOP POSITION BPM SNAP▾ UNDO REDO TRACK SIZE +TRACK`) omits the relocated time-zoom entirely by design, not oversight - it is one tap deeper behind `⋯` rather than gone,
- not yet confirmed on the user's own device - the new interactions here are single taps (open/select/dismiss a popover, +/-), not new drag gestures, a smaller gap than most of this app's other gesture-gated features carry into their first review.

## DEC-028 — Home screen install: manifest + iOS meta tags, and an icon redrawn from reference art rather than shipped as a resized bitmap

**Status:** Accepted

Station can be added to an iOS/Android home screen and launches standalone (no browser chrome): `public/manifest.webmanifest` (`display: "standalone"`, relative `start_url`/`scope` of `"."` since production sometimes ships with `--base=/station/` - an absolute `start_url` would point at the wrong subpath), the `apple-mobile-web-app-*` meta tags and `viewport-fit=cover` in `index.html`, and `body`'s `100dvh` (with a `100vh` fallback for browsers that don't support the newer unit) plus `env(safe-area-inset-*)` padding on the two `position: fixed; inset: 0` layers that already escape `.station-shell`'s own padding (`.tracks-arranger`, `.track-editor` - each needs its *own* safe-area padding, not inherited; see the App.css cascade note in DEC-027 for a related gotcha hit while fixing `.station-shell` itself). The existing POWER button / `audioEngine.initialize()` / off→display→on sequence is completely untouched by any of this - no auto-init, no new button.

**The icon went through two shipped designs.** The first was a single lit orange-red diode (radial-gradient sphere + soft glow via a layered radial-gradient div - a plain CSS `box-shadow` blur has a Chromium headless-rendering artifact) on a Vinyl Dust navy background, inside a thick terracotta ring, reached after roughly nine rounds of iteration and deliberately carrying no "STATION" wordmark. Its build pipeline (master HTML/CSS + headless-Chrome rasterization + a GDI+ resize pass) lived only in that session's temp scratchpad and was never committed - a real gap, since revising the icon again meant rebuilding the whole pipeline from a text description instead of running a script. The second, current design replaces it with a 16×16 grid of lit "pads" forming a gradient wave (reading as a stylised "S") on the same navy ground - a deliberate move from "one lit control" to "the pad grid itself, lit" as the mark, produced externally by the user and handed back as a reference PNG.

**Redrawn, not resized.** The reference PNG was not used directly as icon source. Its grid geometry and every lit cell's exact colour were measured pixel-by-pixel (`tools/icon/build-icon.ps1`'s own header documents the numbers: 16×16 cells, each row a single flat colour rather than a per-cell gradient) rather than eyeballed - an earlier by-eye count of the same artwork read 15×15, off by exactly one in each dimension, which is the specific failure mode pixel-measurement was worth doing to avoid. The icon is then *redrawn* from that data with GDI+ (`System.Drawing`) at whatever resolution is needed, not resized from the one 1024px reference bitmap - crisp cell edges at every shipped size (32/180/192/512) instead of resampling artifacts, and precise control over reproducing Apple's "flat, edge-to-edge, alpha-free square" convention the first icon already established: iOS (and Android adaptive icons) apply their own corner mask on top of whatever ships, so a source that is itself pre-rounded or carries transparency reads as "a square inside a square" once that mask lands. `tools/icon/build-icon.ps1` is committed (with a checked-in `tools/icon/icon-master-1024.png` reference render) specifically so this does not repeat the first icon's scratchpad-only mistake - revising the design again means editing the row/colour data in one script and rerunning it, not reconstructing a pipeline from prose.

**Addendum — the reference artwork's own margin and internal ring were dropped after a real-device check, in two rounds.** The pixel-measured reproduction above (originally: grid filling ~81% of the canvas, plus a thin double ring drawn well inside that) matched the reference PNG faithfully and looked correct reviewed in isolation - but installed on the user's actual iPhone home screen, next to full-bleed sibling icons (WhatsApp, Instagram, Claude, none of which carry an internal frame), it read as "a square inside a square": iOS's own corner mask on the icon's true edge, plus a second, visible rounded edge from the ring sitting well inside it. This is exactly the class of problem DEC-027 and this decision's own device-confirmation gaps keep flagging as a real risk of browser-tool-only verification - a static 1024px preview and an approximated-corner-mask size chart (the "Consequences" bullet below) both looked fine; only seeing it at true size, in true context, surfaced it.

Round 1 dropped the ring and widened `$pitch`/`$cell` (52px pitch/46px cell against a 1024px reference → 59px pitch/52px cell, ~92% fill). Round 2, after the user zoomed into a second on-device screenshot and still saw "a square in a circle": the ring was gone, but the plain canvas background (`--station-bg`-ish, `#0b0c14`) was a visibly different, slightly darker tone than the unlit cells' own fill (`#1d1b27`) - so the margin band between the grid's own bounding box and the icon's true edge was still a second, distinct rectangle in its own right, just a subtler one than a drawn ring. Fixed two ways at once, either of which likely would have been enough alone: pushed further to ~97% fill (`$pitch`/`$cell` → 62px/55px), and the plain background colour itself changed to `$unlitColor` rather than a separate hex - with the margin band and the unlit cells now literally the same colour, there is no second tone left anywhere on the canvas for a boundary to form between. `$origin` is derived from `$pitch`/`$gridSize` rather than a separately hand-set number in both rounds, so the geometry can't drift out of its centred relationship as these numbers keep changing.

Consequences:

- verified at realistic display sizes (180/120/76/60/40/29px, each through an approximated iOS corner mask) before first shipping - the 16×16 grid's fine detail was a real legibility concern going in, and held up better than expected even at 29px, so the design was not simplified further; this check did *not* catch the margin/ring problem above, since an approximated corner mask on an isolated preview has no sibling icons to look wrong next to,
- confirmed wrong twice, each round, via the user's own real iPhone home screen - not by Claude directly (browser-tool checks only, same limitation this decision already carries elsewhere) - fixed as of round 2 above, pending the user's own re-confirmation,
- service worker remains explicitly out of scope, as it was for the first pass - manifest + standalone config alone satisfies the install/full-screen behaviour asked for,
- if the pattern, colours or fill amount need to change again, edit `$rows` (colour/pattern) or `$pitch`/`$cell`/`$gridSize` (fill amount - `$origin` follows automatically) in `tools/icon/build-icon.ps1` and rerun it - it overwrites all four shipped sizes plus the reference render in one pass.

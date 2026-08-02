# Station

Station is a desktop-browser sampler groovebox for turning audio samples into playable pads, patterns and musical sketches without the complexity of a full DAW.

## Current status

The repository contains a playable 16-track sequencer with Pattern Groups A–D and a Pattern Playlist / Song Mode, Basic Pump and mixer foundations, non-destructive sample regions, the Unified Chop Workspace with microphone field capture, MONO-3 pad synthesis, STRINGS pad synthesis, per-Pattern NOTES / CHORDS pad modes, local persistence, offline SONG rendering, and Project Key + Scale Map. Browser audio lifecycle and listening acceptance still require testing in current Chrome and Edge on Windows.

## Product principles

- Station is a sampler groovebox, not a DAW.
- The desktop browser is the primary product platform, not a temporary prototype target.
- Chrome and Edge on Windows are the first supported development and validation environment.
- Mobile browsers, phone UX, PWA packaging and Capacitor are separate future topics and do not block the browser MVP.
- Each Pattern Group has its own 16-pad bank, up to eight Pattern Groups are supported, and each group has always-16-step pattern variants A–D.
- Pattern Clips point to a Pattern Group variant and can run in parallel on a Playlist; Station still has no general DAW timeline.
- React owns the user interface, never audio timing.
- The audio engine must remain independent from React components.
- Smart Pump starts as a manual, musical volume-shaping tool.
- Automatic kick analysis comes only after Basic Pump is proven useful.
- Chop, resampling and scenes are the first major post-MVP systems.
- Visual identity may develop alongside the engine, but never at the cost of timing, stability or input response.

## Documentation

- [Product vision](docs/PRODUCT_VISION.md)
- [MVP scope](docs/MVP_SCOPE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Audio engine](docs/AUDIO_ENGINE.md)
- [Data model](docs/DATA_MODEL.md)
- [Smart Pump](docs/SMART_PUMP.md)
- [Roadmap](docs/ROADMAP.md)
- [Decision log](docs/DECISIONS.md)
- [Codex task template](docs/CODEX_TASK_TEMPLATE.md)
- [M1 Codex task](docs/tasks/M1_AUDIO_PROOF_OF_CONCEPT.md)
- [Agent rules](AGENTS.md)

## Planned stack

- TypeScript
- React
- Vite
- Web Audio API
- AudioWorklet where justified by measured needs
- IndexedDB and/or OPFS for local project storage

Tone.js, WebAssembly, PWA packaging, Capacitor and any native implementation are optional future tools or products, not default architectural commitments.

## Working model

- Damian: product owner and final decision-maker.
- ChatGPT: project manager, product designer and audio systems designer.
- Codex: implementation agent working from small, explicit tasks with acceptance criteria.

No implementation phase begins until its scope and acceptance criteria are approved.

## M4 sequencer timing

### Prerequisites

- Node.js 22.12 or later
- pnpm 11.15 or later
- Current Chrome or Edge on Windows

### Commands

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm build
```

Open the local URL printed by `pnpm dev`. Select **START AUDIO**, choose a pad, then assign a WAV in the selected-pad editor. Play loaded pads by pointer or with this fixed keyboard layout:

```text
1  2  3  4
Q  W  E  R
A  S  D  F
Z  X  C  V
```

The fixed shell provides **CHOP**, **PAD**, **SEQ**, **SONG**, **SAMPLE** and **MIX** views, plus a permanent transport. In SEQ, a Pattern Group represents one musical idea and its A–D buttons select deliberately limited 16-step variations. Create B–D by duplicating an existing variant; use **NEW PATTERN** for up to eight groups. SONG supplies a simple slot Playlist: clips such as `1A` reference their pattern rather than copying it, may overlap in the same slot, and may be placed at any positive slot. Select **PATTERN** to loop the current variant or **SONG** to play the Playlist; **LOOP SONG** restarts after its last occupied slot. Hold **REC** to open the non-moving `PATTERN / MICROPHONE` action sheet; a short tap then starts or stops the selected mode. PATTERN records pad hits into the current pattern. MICROPHONE captures up to two minutes of mono-focused device input, shows a live level meter and a persistent elapsed-time readout on the Station display, converts the take to WAV and opens it directly in CHOP. In CHOP, load or record a source, enable **ADD SLICE**, then click the waveform: slice 1 maps live to PAD 01, slice 2 to PAD 02, and so on. The source itself does not occupy a pad and all mapped pads share one decoded asset. The selected-pad editor provides per-channel volume and per-pad pitch controls, plus **CLEAR PAD**. SAMPLE provides start/end playback-region editing, preview and reset for the current pad. MIX controls channel volume, mute and multi-solo for all 16 pads; mute takes precedence over solo. Audio events are scheduled from the Web Audio clock, not React timing.

In **SEQ**, each active step has a manual **VELOCITY** value (0–100%) and a per-step **SHIFT** from −50% to +50% of a 16th-note duration. SHIFT moves only that scheduled trigger; the AudioContext clock, BPM and slot boundaries remain unchanged.

**SYNTH** sits between PADS and SEQ. Select a pad, create a MONO-3 source, then shape its two oscillators, sub oscillator, 24 dB low-pass filter, amp/filter envelopes, tempo-synced filter LFO, drive, glide and sequencer gate. MONO uses last-note priority and glide; POLY 5 plays a per-pad chord of up to five notes. Scale Map shares one Pattern Group patch across later pads while keeping their mixer, pattern, Pump and FX state independent. Pointer and computer-keyboard releases send note-off for synth pads; sample pads remain one-shots.

**STRINGS** sits next to SYNTH and is a deliberately different-sounding instrument: a wide, slow, polyphonic analog string-machine pad, not a MONO-3 clone with different defaults. Each voice is two detuned sawtooths through a single gentle low-pass (BRIGHTNESS) and an amp envelope (ATTACK/RELEASE); ENSEMBLE runs the voice through a per-pad two-line modulated-delay chorus fed by free-running (not tempo-synced) engine-wide LFOs, and VIBRATO adds a shared, delayed-onset pitch wobble. STRINGS is always polyphonic (up to 8 voices per patch, no MONO mode), steals the oldest already-releasing voice before an oldest-sounding one, and force-releases a duplicate note before restacking it. Six presets (WARM STRINGS, SLOW ORCHESTRA, DISCO STRINGS, DARK PAD, SYNTH BRASS, SOFT CHOIR) apply parameter values on the same engine. A pad's source is one of sample, MONO-3 or STRINGS, never more than one at a time.

**PROJECT KEY** sets a global root and scale for future mappings. In PAD view, select a loaded pad and use **MAP TO PROJECT SCALE** to fill that pad through PAD 16 with the same asset and playback region at consecutive scale degrees. The selected pad is degree zero; map targets retain their own patterns, mute/solo state and Pump settings. Mapping never wraps to PAD 01, does not retune earlier mappings after a key change, and asks once before replacing occupied target pads.

In **PADS**, each Pattern Group stores its own **NOTES / CHORDS** mode. NOTES preserves the normal polyphonic pad-note behavior. CHORDS turns all 16 scale-mapped MONOPOLY or STRINGS pads into last-pad-priority chords: pressing a new pad releases the previous chord, and sequenced pad events use the same monophonic chord rule. Select a chord pad, then open the Station display manually to edit its diatonic assignment; playing pads never opens the panel or moves the grid. Suggestions are generated from the Project Key and contain no pitch class outside the selected scale; changing root or scale preserves compatible chord types and replaces incompatible ones deterministically.

### Local project persistence

**SAVE PROJECT** stores one local project in IndexedDB: its schema-v19 manifest and each referenced source WAV, including microphone takes used by CHOP, under a stable asset ID. **OPEN PROJECT** restores the last saved project after **START AUDIO**; it re-decodes WAV data, regenerates waveform caches, restores samples, MONO-3 and STRINGS patches, per-pad voicings, NOTES / CHORDS modes and chord assignments, all Pattern Group banks, Playlist, mixer, Pump, FX racks and Project Key settings, and leaves transport stopped. Schema-v1 through v18 projects migrate safely with neutral defaults for fields and effect configs introduced later; every older Pattern opens in NOTES so its existing sound is unchanged.

There is no autosave, project browser, rename, duplicate, delete or export/import. IndexedDB quota is browser-managed, so saving large WAV projects can fail when local storage is full.

### Current limitations

**TUNE** is a deliberately simple QUALITY workspace for short monophonic vocals. Record a take or load WAV/M4A, choose Project Key and Scale, press **AUTOTUNE**, then compare the labelled **ORIGINAL** and **AUTOTUNE** players or download the tuned WAV. The screen uses one fixed hard-tune YIN + TD-PSOLA path; blind A–D variants, rating forms, benchmark controls and diagnostic JSON are no longer exposed in the user workflow. It is not yet an accepted Station rack effect: Tune Gravity remains absent from the FX Rack, project schema, SONG render and realtime audio path. See [Tune Gravity DSP prototype](docs/TUNE_GRAVITY_DSP_PROTOTYPE.md).

Only one local project is available and it must be opened explicitly after each page reload. Each Pattern Group and the master have four serial insert FX slots, supporting NONE, compressor, BPM-synced delay, three-band EQ, TIGHT ROOM and the one-knob TAPE effect. TAPE is a live rack effect and participates in offline SONG rendering; Station still has no separate per-pad effect-resampling workflow. MONO-3 is intentionally limited to one shared patch source per assigned pad, one filter LFO and five voices per patch; it has no Piano Roll, MIDI, modulation matrix, presets or wavetable import. STRINGS is intentionally limited to one shared patch source per assigned pad, sawtooth-only oscillators, a fixed-Q filter, no filter envelope, no MONO mode and eight voices per patch; it has no Piano Roll, MIDI, sampled/multisampled strings, physical modeling or mod matrix. Audio must be explicitly started after each page reload. If a browser suspends or interrupts Web Audio after a tab or app switch, Station attempts to resume when the page becomes visible and retries on the next pointer or keyboard gesture; browser policy may still require pressing **START AUDIO**.

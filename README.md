# Station

Station is a desktop-browser sampler groovebox for turning audio samples into playable pads, patterns and musical sketches without the complexity of a full DAW.

## Current status

The repository contains a playable 16-track sequencer with Pattern Groups A–D and a Pattern Playlist / Song Mode, Basic Pump and mixer foundations, non-destructive sample regions, the Unified Chop Workspace, MONO-3, MONOGORG, STRINGS and POLY pad synthesis, local persistence, offline SONG rendering, and Project Key + Scale Map. Browser audio lifecycle and listening acceptance still require testing in current Chrome and Edge on Windows.

## Product principles

- Station is a sampler groovebox, not a DAW.
- The desktop browser is the primary product platform, not a temporary prototype target.
- Chrome and Edge on Windows are the first supported development and validation environment.
- Mobile browsers, phone UX, PWA packaging and Capacitor are separate future topics and do not block the browser MVP.
- Each Pattern Group has its own 16-pad bank, starts with the 16-step A section, and may grow in complete sections through B, C and D for a maximum of 64 steps.
- Pattern Clips point to a Pattern Group section and can run in parallel on a Playlist; Station still has no general DAW timeline.
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

In **WAVES**, select an imported clip and open the Track Editor. Drag directly across **TRIM / SELECT FOR LASER** to mark a new non-destructive source fragment, then grab its large orange START/END grips or use the sliders for fine adjustment. The bright bordered area is the exact fragment sent to LASER; discarded source on either side is visibly dimmed. Clip-edge trim grips are also always visible on the timeline. **SEND TO LASER** turns the selected raw region into a new short LASER source, while **EXPORT WAV** downloads the same region as 16-bit PCM WAV. Timeline placement, loop length, gain, fades, pitch, reverse and track effects are deliberately not baked into this source-material export.

The fixed shell provides **CHOP**, **PAD**, **SEQ**, **SONG**, **SAMPLE** and **MIX** views, plus a permanent transport. In SEQ, a Pattern Group represents one musical idea and its A–D buttons select consecutive 16-step sections: A is steps 1–16, B is 17–32, C is 33–48 and D is 49–64. Empty sections may be created directly; the first live recording on an empty pattern also extends through them automatically as the take continues. Existing patterns keep their established 16/32/48/64-step length and loop at that boundary. SONG supplies a simple slot Playlist: clips such as `1A` reference a section rather than copying it, may overlap in the same slot, and may be placed at any positive slot. Select **PATTERN** to loop the full existing A–D section chain or **SONG** to play the Playlist; **LOOP SONG** restarts after its last occupied slot. In CHOP, load a separate source WAV, enable **ADD SLICE**, then click the waveform: slice 1 maps live to PAD 01, slice 2 to PAD 02, and so on. The source itself does not occupy a pad and all mapped pads share one decoded asset. The selected-pad editor provides per-channel volume and per-pad pitch controls, plus **CLEAR PAD**. SAMPLE provides start/end playback-region editing, preview and reset for the current pad. MIX controls channel volume, mute and multi-solo for all 16 pads; mute takes precedence over solo. Audio events are scheduled from the Web Audio clock, not React timing.

In **SEQ**, tapping an empty square creates one independent one-step event. Dragging from an empty square across its pad row explicitly paints one longer event: only its first square triggers, every crossed square extends its span, and the whole gesture shares one **VELOCITY** value (0–100%) and one **SHIFT** from −50% to +50% of a 16th-note duration. Crossing and holding at the outer edge of step 8 or 9 turns the matrix page and continues painting one step at a time without ending the gesture, so one event can be painted across the 01–08 / 09–16 boundary and released at the intended length. Separate taps remain separate triggers even when their squares touch. Dragging from an active square erases the event(s) crossed by the gesture. SHIFT moves only the event's scheduled trigger; the AudioContext clock, BPM and slot boundaries remain unchanged.

**SYNTH** sits between PADS and SEQ. Select a pad, create a MONO-3 source, then shape its two oscillators, sub oscillator, 24 dB low-pass filter, amp/filter envelopes, tempo-synced filter LFO, drive, glide and sequencer gate. MONO uses last-note priority and glide; POLY 5 plays a per-pad chord of up to five notes. Scale Map shares one Pattern Group patch across later pads while keeping their mixer, pattern, Pump and FX state independent. Pointer and computer-keyboard releases send note-off for synth pads; sample pads remain one-shots.

**STRINGS** sits next to SYNTH and is a deliberately different-sounding instrument: a wide, slow, polyphonic analog string-machine pad, not a MONO-3 clone with different defaults. Each voice is two detuned sawtooths through a single gentle low-pass (BRIGHTNESS) and an amp envelope (ATTACK/RELEASE); ENSEMBLE runs the voice through a per-pad two-line modulated-delay chorus fed by free-running (not tempo-synced) engine-wide LFOs, and VIBRATO adds a shared, delayed-onset pitch wobble. STRINGS is always polyphonic (up to 8 voices per patch, no MONO mode), steals the oldest already-releasing voice before an oldest-sounding one, and force-releases a duplicate note before restacking it. Six presets (WARM STRINGS, SLOW ORCHESTRA, DISCO STRINGS, DARK PAD, SYNTH BRASS, SOFT CHOIR) apply parameter values on the same engine. A pad's source is one of sample, MONO-3, MONOGORG, STRINGS or POLY, never more than one at a time.

**MONOGORG** is a deliberately focused mono synth for bass under sampled beats. Its nine controls are SHAPE, WEIGHT, CUTOFF, RESO, CONTOUR, ATTACK, DECAY, DRIVE and GLIDE. A harmonic morph source plus internally balanced body/sub layers feeds gentle asymmetric saturation and a cascaded 4-pole low-pass. Last-note legato keeps the current envelope alive and glides the existing voice; two fixed sub-cent LFOs add deterministic micro-drift. It shares Station's normal channel, Pump, FX, scheduling, Scale Map and offline render paths.

**POLY** is Station's deep modern polyphonic wavetable instrument. Two continuously morphable wavetable oscillators draw from 40 original 16-frame tables, with 1/2/4/8-voice normalized stereo unison, restrained OSC 2 → OSC 1 FM, multimode filtering, three envelopes, two audio-thread LFOs and bipolar source-to-destination modulation. Its AudioWorklet oscillator uses stable phase, sample/frame interpolation and harmonic-limited mip levels selected against Nyquist. Each patch supports eight musical voices independently of unison and follows the normal pad channel, Pump, Group/Master FX, scheduler, Project Scale and offline render paths.

**PROJECT KEY** sets a global root and scale for future mappings. In PAD view, select a loaded pad and use **MAP TO PROJECT SCALE** to fill that pad through PAD 16 with the same asset and playback region at consecutive scale degrees. The selected pad is degree zero; map targets retain their own patterns, mute/solo state and Pump settings. Mapping never wraps to PAD 01, does not retune earlier mappings after a key change, and asks once before replacing occupied target pads.

### Local project persistence

**SAVE PROJECT** stores one local project in IndexedDB: its schema-v22 manifest and each referenced source WAV under a stable asset ID. **OPEN PROJECT** restores the last saved project after **START AUDIO**; it re-decodes WAV data, regenerates waveform caches, restores samples, MONO-3, MONOGORG, STRINGS and POLY patches and chord assignments, Smart Chords performance settings, all Pattern Group banks, Playlist, mixer, Pump, FX racks and Project Key settings, and leaves transport stopped. Older projects migrate safely; schema-v21 projects receive safe Smart Chords performance defaults without changing their existing assignments, while schema-v20 and earlier projects retain their established migrations.

There is no autosave, project browser, rename, duplicate, delete or export/import. IndexedDB quota is browser-managed, so saving large WAV projects can fail when local storage is full.

### Current limitations

Only one local project is available and it must be opened explicitly after each page reload. Each Pattern Group and the master have two serial insert FX slots, supporting NONE, compressor, BPM-synced delay and a three-band EQ (low shelf, mid peak, high shelf). MONO-3 is intentionally limited to one shared patch source per assigned pad, one filter LFO and five voices per patch; it has no Piano Roll, MIDI, modulation matrix, presets or wavetable import. MONOGORG is always mono and intentionally exposes only its nine bass-focused controls, with no presets, chord mode or modulation matrix. STRINGS is intentionally limited to one shared patch source per assigned pad, sawtooth-only oscillators, a fixed-Q filter, no filter envelope, no MONO mode and eight voices per patch; it has no Piano Roll, MIDI, sampled/multisampled strings, physical modeling or mod matrix. POLY ships with a fixed procedural bank and factory starting patches; user wavetable import, MPE and macros remain out of scope. Audio must be explicitly started after each page reload. If a browser suspends or interrupts Web Audio after a tab or app switch, Station attempts to resume when the page becomes visible and retries on the next pointer or keyboard gesture; browser policy may still require pressing **START AUDIO**.

# Station

Station is a desktop-browser sampler groovebox for turning audio samples into playable pads, patterns and musical sketches without the complexity of a full DAW.

## Current status

The repository contains a playable 16-track sequencer with Pattern Groups A–D and a Pattern Playlist / Song Mode, Basic Pump and mixer foundations, non-destructive sample regions, the Unified Chop Workspace, Persistence v2 (with v1 migration), and Project Key + Scale Map v1. Browser audio lifecycle and listening acceptance still require testing in current Chrome and Edge on Windows.

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

The fixed shell provides **CHOP**, **PAD**, **SEQ**, **SONG**, **SAMPLE** and **MIX** views, plus a permanent transport. In SEQ, a Pattern Group represents one musical idea and its A–D buttons select deliberately limited 16-step variations. Create B–D by duplicating an existing variant; use **NEW PATTERN** for up to eight groups. SONG supplies a simple slot Playlist: clips such as `1A` reference their pattern rather than copying it, may overlap in the same slot, and may be placed at any positive slot. Select **PATTERN** to loop the current variant or **SONG** to play the Playlist; **LOOP SONG** restarts after its last occupied slot. In CHOP, load a separate source WAV, enable **ADD SLICE**, then click the waveform: slice 1 maps live to PAD 01, slice 2 to PAD 02, and so on. The source itself does not occupy a pad and all mapped pads share one decoded asset. The selected-pad editor provides per-channel volume and per-pad pitch controls, plus **CLEAR PAD**. SAMPLE provides start/end playback-region editing, preview and reset for the current pad. MIX controls channel volume, mute and multi-solo for all 16 pads; mute takes precedence over solo. Audio events are scheduled from the Web Audio clock, not React timing.

In **SEQ**, each active step has a manual **VELOCITY** value (0–100%) and a per-step **SHIFT** from −50% to +50% of a 16th-note duration. SHIFT moves only that scheduled trigger; the AudioContext clock, BPM and slot boundaries remain unchanged.

**PROJECT KEY** sets a global root and scale for future mappings. In PAD view, select a loaded pad and use **MAP TO PROJECT SCALE** to fill that pad through PAD 16 with the same asset and playback region at consecutive scale degrees. The selected pad is degree zero; map targets retain their own patterns, mute/solo state and Pump settings. Mapping never wraps to PAD 01, does not retune earlier mappings after a key change, and asks once before replacing occupied target pads.

### Local project persistence

**SAVE PROJECT** stores one local project in IndexedDB: its schema-v6 manifest and each referenced source WAV under a stable asset ID. **OPEN PROJECT** restores the last saved project after **START AUDIO**; it re-decodes WAV data, regenerates waveform caches, restores all Pattern Group banks, Playlist, mixer, Pump, FX racks and Project Key settings, and leaves transport stopped. Schema-v1 through v5 projects migrate safely: their global pad bank and CHOP source become Pattern Group 1 where applicable, while existing later Pattern Groups receive empty banks rather than guessed copies. Projects saved before the FX Rack preserve the prior master delay → compressor order in master slots.

There is no autosave, project browser, rename, duplicate, delete or export/import. IndexedDB quota is browser-managed, so saving large WAV projects can fail when local storage is full.

### Current limitations

Only one local project is available and it must be opened explicitly after each page reload. Each Pattern Group and the master have two serial insert FX slots, supporting only NONE, compressor and BPM-synced delay. Audio must be explicitly started after each page reload; switching tabs may cause a browser to suspend audio, in which case use **START AUDIO** again.

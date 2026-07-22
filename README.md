# Station

Station is a desktop-browser sampler groovebox for turning audio samples into playable pads, patterns and musical sketches without the complexity of a full DAW.

## Current status

The repository is in **M4 — Sequencer Timing**. The 16-pad instrument includes one 16-step sequence per pad, BPM, audio-clock-based play/stop, Basic Pump and a compact 16-channel MIX foundation.

## Product principles

- Station is a sampler groovebox, not a DAW.
- The desktop browser is the primary product platform, not a temporary prototype target.
- Chrome and Edge on Windows are the first supported development and validation environment.
- Mobile browsers, phone UX, PWA packaging and Capacitor are separate future topics and do not block the browser MVP.
- The MVP contains one 16-pad bank, one 16-step pattern and one Basic Pump system.
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

The selected-pad editor provides per-channel volume and per-pad pitch controls, plus **CLEAR PAD**. Use the 16-step panel to edit the selected pad's own pattern; **PLAY** runs all loaded pad patterns together. The MIX panel controls channel volume, mute and multi-solo for all 16 pads; mute takes precedence over solo. Audio events are scheduled from the Web Audio clock, not React timing.

### Current limitations

The bank, sequences and BPM are non-persistent and reset on page reload. There are no saved patterns, effects, master-volume control or sample editing. Audio must be explicitly started after each page reload; switching tabs may cause a browser to suspend audio, in which case use **START AUDIO** again.

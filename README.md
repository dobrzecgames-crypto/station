# Station

Station is a desktop-browser sampler groovebox for turning audio samples into playable pads, patterns and musical sketches without the complexity of a full DAW.

## Current status

The repository is in **M2 — Audio Engine Foundation**. M1 validated the desktop Web Audio path; M2 hardens the internal engine while retaining the same one-pad proof-of-concept interface.

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

## M1–M2 audio proof of concept

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

Open the local URL printed by `pnpm dev`. Select **START AUDIO**, choose one WAV file, then trigger it with the visible pad or the `A` key. Hold `A` to verify that browser keyboard repeat does not create additional triggers.

### Current limitations

The interface remains deliberately limited to one non-persistent WAV sample and one pad. M2 internally supports a sample registry, overlapping voices, per-trigger gain and semitone pitch, and a master output, but exposes no additional controls yet. There is no sequencer, transport, project saving, effects, volume or pitch UI. Audio must be explicitly started after each page reload; switching tabs may cause a browser to suspend audio, in which case use **START AUDIO** again.

# Station

Station is a browser-first sampler groovebox for turning audio samples into playable pads, patterns and musical sketches without the complexity of a full DAW.

## Current status

The repository is in **M0 — Project Definition**. There is no application code yet. The current goal is to freeze the product direction, MVP scope, technical boundaries and collaboration workflow before implementation begins.

## Product principles

- Station is a sampler groovebox, not a DAW.
- The browser is the primary platform, not a temporary prototype target.
- The MVP contains one 16-pad bank, one 16-step pattern and one Basic Pump system.
- React owns the user interface, never audio timing.
- The audio engine must remain independent from React components.
- Smart Pump starts as a manual, musical volume-shaping tool.
- Automatic kick analysis comes only after Basic Pump is proven useful.
- Chop, resampling and scenes are the first major post-MVP systems.
- Visual identity may develop alongside the engine, but never at the cost of timing, stability or touch response.

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
- [Agent rules](AGENTS.md)

## Planned stack

- TypeScript
- React
- Vite
- Web Audio API
- AudioWorklet where justified by measured needs
- IndexedDB and/or OPFS for local project storage
- PWA after the browser MVP is stable

Tone.js, WebAssembly and Capacitor are optional future tools, not default architectural commitments.

## Working model

- Damian: product owner and final decision-maker.
- ChatGPT: project manager, product designer and audio systems designer.
- Codex: implementation agent working from small, explicit tasks with acceptance criteria.

No implementation phase begins until its scope and acceptance criteria are approved.
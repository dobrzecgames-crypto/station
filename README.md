# Station

Station is a desktop-browser sampler groovebox for turning audio samples into playable pads, patterns and musical sketches without the complexity of a full DAW.

## Current status

The repository is moving from **M0 — Project Definition** into **M1 — Audio Proof of Concept**. M1 is intentionally minimal: start Web Audio after a user gesture, import one WAV file and trigger it from one pad using mouse or keyboard.

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
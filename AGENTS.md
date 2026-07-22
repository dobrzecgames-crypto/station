# AGENTS.md

This file defines the working rules for coding agents in the Station repository.

## Product boundary

Station is a desktop-browser sampler groovebox. It is not a general-purpose DAW.

Do not add features merely because they are common in Ableton Live, FL Studio, Logic, MPC software or other production tools. Every implementation must support the core path:

> sample -> pad -> pattern -> pump -> saved musical sketch

## Current phase

The project is currently in M1 — Audio Proof of Concept. The only approved implementation scope is `docs/tasks/M1_AUDIO_PROOF_OF_CONCEPT.md`.

Do not begin M2 or add product functionality beyond that task until M1 has been explicitly accepted. Project code, dependencies and a React/Vite scaffold are permitted only where the approved M1 task requires them.

## Agent behavior

Before changing files:

1. Read `README.md` and all documents relevant to the task.
2. Inspect the current repository state and recent commits.
3. Restate the exact scope internally.
4. Do not broaden the task.

During implementation:

- Make the smallest coherent change that satisfies the task.
- Do not refactor unrelated files.
- Do not introduce speculative abstractions for native ports, plugins or future DSP.
- Keep audio-engine logic independent from React components.
- Never use React rendering, animation frames, `setTimeout` or `setInterval` as the source of truth for audio timing.
- Use `AudioContext.currentTime` and an approved scheduling strategy for audio events.
- Do not add Tone.js, WebAssembly, Capacitor, JUCE or another major dependency without an explicit architectural decision.
- Preserve desktop-browser compatibility for current Chrome and Edge on Windows.
- Prefer clear TypeScript types and small modules over clever patterns.

## Required completion report

Every implementation task must finish with:

1. Summary of what changed.
2. Exact list of changed files.
3. How to run the result.
4. Tests performed and their results.
5. Manual checks still required.
6. Risks, limitations or browser-specific concerns.
7. Confirmation that no out-of-scope work was performed.

Do not begin the next milestone without an explicit instruction.

## Prohibited scope unless explicitly requested

- Infinite DAW timeline
- Piano roll
- VST/AU hosting
- Multitrack recording and comping
- Cloud accounts or collaboration
- Native JUCE application
- Advanced Smart Pump kick analysis
- Chop, resampling or scenes before their roadmap phase
- Decorative 3D interface work that compromises usability or performance

## Testing priority

For M1, the required browser matrix is:

- Current Chrome on Windows
- Current Edge on Windows

Do not claim that the WAV import and playback path was tested unless a real WAV was manually loaded and triggered with both mouse and keyboard in each required browser. Mobile-browser testing is outside the approved M1 scope.

# Codex Task — M1 Audio Proof of Concept

## Status

Approved for implementation.

## Goal

Create the smallest possible desktop-browser proof of concept that verifies the basic Station audio path:

1. the application starts in Chrome and Edge on Windows,
2. Web Audio starts only after an intentional user gesture,
3. the user can import one WAV file,
4. one visible pad can trigger the loaded sample with mouse or keyboard,
5. repeated triggers remain responsive and do not produce obvious stuck playback or uncontrolled resource growth.

This task is an audio viability test, not the beginning of the full product interface.

## Repository context

- Repository: `dobrzecgames-crypto/station`
- Branch: `main`
- Product: desktop-browser sampler groovebox
- Primary validation browsers: current Chrome and Edge on Windows
- Read before changing anything:
  - `README.md`
  - `AGENTS.md`
  - `docs/PRODUCT_VISION.md`
  - `docs/MVP_SCOPE.md`
  - `docs/ARCHITECTURE.md`
  - `docs/AUDIO_ENGINE.md`
  - `docs/DECISIONS.md`

## Required implementation

### Project setup

- Scaffold a minimal React + TypeScript + Vite application inside the existing repository.
- Use `pnpm` and commit the lockfile.
- Pin dependencies locally in the project; do not install project tools globally.
- Add only the dependencies required for this task.
- Prefer native Web Audio API. Do not add Tone.js.

### Audio initialization

- The application must begin with audio inactive.
- Provide one clear action such as `START AUDIO`.
- Create or resume `AudioContext` only as a direct result of that user gesture.
- Show a simple visible state: audio inactive, starting, ready, or error.
- Handle a rejected or suspended AudioContext without crashing.

### WAV import

- Provide one file input accepting WAV files.
- Decode the selected file with Web Audio API.
- Keep the decoded `AudioBuffer` outside React render state where practical.
- Display the selected filename and a clear decode error if loading fails.
- Do not add waveform rendering, sample editing, drag-and-drop or a sample library.

### One pad

- Provide one large visible pad.
- Trigger it with:
  - mouse or pointer press,
  - keyboard key `A`.
- Ignore repeated keyboard auto-repeat events so holding `A` does not create uncontrolled triggers.
- Each valid trigger should create a fresh `AudioBufferSourceNode`, connect it through a simple gain stage and start it immediately.
- Clean up finished source nodes.
- Repeated valid presses should be able to overlap naturally.
- Disable or clearly mark the pad before audio is ready or before a sample is loaded.

### Minimal architecture boundary

Create a small audio-layer abstraction so React components do not directly manage live AudioNodes.

A minimal API may resemble:

```ts
interface AudioEngine {
  initialize(): Promise<void>;
  loadSample(file: File): Promise<LoadedSampleInfo>;
  triggerSample(): void;
  getStatus(): AudioEngineStatus;
  dispose(): void;
}
```

The exact names may differ, but these boundaries are mandatory:

- React owns UI state and user interactions,
- the audio layer owns `AudioContext`, decoded buffer and active source nodes,
- no sequencer timing is introduced,
- do not place live AudioNodes in serializable application state.

## Explicitly out of scope

Do not implement any of the following:

- 16 pads,
- sequencer or transport,
- BPM,
- look-ahead scheduling,
- Pump or any effects,
- volume or pitch controls,
- waveform,
- chop or slicing,
- project save,
- IndexedDB or OPFS,
- PWA or service worker,
- mobile-specific layout or multitouch testing,
- MIDI,
- microphone recording,
- Tone.js,
- AudioWorklet,
- WebAssembly,
- elaborate visual identity, animations, boot sequence or virtual-hardware skin.

Do not create placeholder systems for excluded features.

## Required scripts

Provide working project scripts for at least:

- development server,
- production build,
- type checking or an equivalent build-time TypeScript check,
- linting if ESLint is included.

Do not add a test framework only to satisfy this task unless a small automated test provides clear value.

## Acceptance criteria

The task is complete only when all of the following are true:

1. `pnpm install` succeeds from a clean checkout.
2. The development server starts with the documented command.
3. The production build succeeds.
4. The application opens in current Chrome and Edge on Windows.
5. No audio starts before the user presses the audio initialization control.
6. A valid WAV file loads and its filename is shown.
7. Pressing the pad or key `A` triggers the sample.
8. Ten quick manual triggers work without a stuck voice, crash or obvious resource leak.
9. Selecting an invalid or undecodable file produces a readable error and does not break later valid imports.
10. The audio implementation is outside React components behind a small typed boundary.
11. No out-of-scope feature has been added.

## Manual validation checklist

Perform and report these checks in both Chrome and Edge:

- fresh page load,
- press pad before starting audio,
- start audio,
- press pad before loading a sample,
- load a short WAV,
- trigger with mouse,
- trigger with `A`,
- trigger rapidly at least ten times,
- hold `A` and confirm keyboard repeat is ignored,
- load a second valid WAV and confirm it replaces the first,
- attempt to load an invalid file,
- load a valid WAV again after the error,
- switch tab and return, then verify whether audio still works or requires resume,
- reload the page and confirm no sample is persisted.

Document any browser-specific behavior instead of hiding it.

## Documentation changes

Update `README.md` only as needed to include:

- prerequisites,
- install command,
- development command,
- production build command,
- manual M1 usage instructions,
- known limitations.

Do not rewrite product-direction documents unless implementation reveals a real contradiction. Report contradictions instead.

## Expected Codex report

After implementation, stop and provide:

1. concise summary of what changed,
2. full list of changed and added files,
3. dependency list and why each dependency is needed,
4. commands used for install, validation and build,
5. results of Chrome and Edge manual tests,
6. known limitations or browser differences,
7. architecture notes about the audio boundary,
8. any deviations from this task and the reason,
9. current `git status`,
10. commit SHA if a commit was created.

Do not begin M2 or add additional pads after completing this task.
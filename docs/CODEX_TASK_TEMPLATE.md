# Codex Task Template

Use this template for every implementation task. Replace all bracketed fields and remove irrelevant sections before giving the task to Codex.

---

## Role

You are implementing one narrowly scoped task in the Station repository.

Station is a browser-first sampler groovebox, not a general-purpose DAW. Read `README.md`, `AGENTS.md` and the documents listed under Context before making changes.

## Task title

[Short, specific title]

## Goal

[One paragraph describing the observable result.]

## Context to read

- `README.md`
- `AGENTS.md`
- `[relevant document]`

## Allowed scope

- [Exact functionality]
- [Allowed folders/files]
- [Approved dependencies, if any]

## Out of scope

- [Nearby feature that must not be added]
- [Refactors not needed for this task]
- [Future milestone systems]

Do not broaden the implementation beyond the allowed scope even if an adjacent improvement appears useful.

## Technical constraints

- Use TypeScript.
- Preserve browser-first and mobile-browser compatibility.
- React must not be the source of truth for audio timing.
- AudioNodes and scheduling internals must remain outside React components.
- Do not add major dependencies unless they are explicitly approved in this task.
- Do not use `setTimeout`, `setInterval`, animation frames or React rendering as authoritative audio timing.
- Follow the current project architecture and data model documents.

## Acceptance criteria

The task is complete only when:

1. [Observable criterion]
2. [Observable criterion]
3. [Failure/edge-case criterion]
4. [Architecture boundary criterion]
5. [No regression criterion]

## Tests required

### Automated

- [Test command or expected unit/integration coverage]

### Manual

- [Desktop scenario]
- [Mobile scenario where relevant]
- [Failure scenario]

Do not claim a device/browser was tested unless it was actually tested. Clearly separate automated results from manual checks still required by Damian.

## Documentation

Update only the documentation made inaccurate by this task. Do not rewrite product direction or expand the roadmap without explicit permission.

## Required final report

Return:

1. Concise summary of changes.
2. Exact changed-file list.
3. Commands to install/run/test.
4. Automated test results.
5. Manual tests performed.
6. Manual tests still required.
7. Risks, limitations and browser-specific concerns.
8. Explicit confirmation that no out-of-scope work was performed.

Do not begin another task after completing this one.

---

## Example: M1 one-pad audio spike

### Goal

Create the smallest browser application that can initialize Web Audio after a user gesture, import one WAV file and trigger it from one visible pad by pointer or keyboard input.

### Allowed scope

- Minimal React + TypeScript + Vite scaffold.
- Explicit `START AUDIO` action.
- One WAV file picker.
- One pad.
- Keyboard key `A`.
- Minimal development status for AudioContext state and load errors.

### Out of scope

- 16 pads.
- Sequencer.
- Pump.
- Project persistence.
- AudioWorklet.
- Tone.js.
- PWA.
- Styled hardware interface.

### Acceptance criteria

1. AudioContext is not started before the user action.
2. A valid WAV can be selected and decoded.
3. Pressing the pad or `A` triggers the sample.
4. Rapid repeated triggers create intentional overlapping one-shots without obvious clicks in the tested browser.
5. Loading failure is shown clearly.
6. React does not store AudioNode instances in component state.
7. No out-of-scope feature is implemented.
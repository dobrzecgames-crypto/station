# Release Hardening Findings

Findings are recorded only after source inspection or a reproducible test.

## Confirmed findings

### P0 — SONG completion and lifecycle shutdown left TRACKS running — FIXED

Evidence:

- `StepSequencer` stopped itself at non-looping SONG completion, then
  `App.tsx` only cleared React `isPlaying`/playhead state.
- `TimelineScheduler.stop()` and `AudioEngine.stopTimelineVoices()` were not
  called from SONG completion.
- AudioContext suspended/interrupted handling and App unmount stopped only
  `StepSequencer` and sequencer-owned voices.

Impact: Station could display a stopped transport while TRACKS scheduling or
already scheduled timeline voices continued. A project switch happened to use
the complete manual-stop path, but the same responsibility was duplicated and
inconsistent elsewhere.

Root cause: normal transport start/stop was coordinated ad hoc inside
`App.tsx`; no runtime boundary owned both schedulers and both voice origins.

Fix: `TransportCoordinator` now starts both schedulers at one AudioContext
timestamp and owns idempotent shutdown of both schedulers and both owned voice
sets. SONG completion, manual STOP, AudioContext interruption/suspension,
project replacement, and App unmount use that boundary. A failed or inconsistent
partial start is rolled back before playback can proceed.

Musical behavior decision: manual pad voices and CHOP/source preview voices
remain independent, preserving DEC-015. Pattern-recording count-in remains the
one intentional StepSequencer-only path.

Verification: four deterministic lifecycle regression tests; full gate passed
with 114/114 tests, typecheck PASS, build PASS.

## Open audits

- Scheduler behavior after late wakeups from 25 ms through 2000 ms.
- Active sample/synth/timeline voice and reverse-cache lifecycle under stress.
- Optional POLY/ZOLA-X AudioWorklet failure isolation.
- IndexedDB rejected-open caching, blocked upgrades, and `versionchange` cleanup.
- Autosave ordering and unnecessary rewrites of unchanged WAV blobs.
- Quota error classification, storage diagnostics, and dirty/save-error state.
- Offline render parity with live TRACKS playback and release-tail handling.
- Fatal React render recovery and unhandled-error diagnostics.
- Real Chromium startup/save/reload/play/stop coverage and CI enforcement.

## Baseline observations

### P2 — Main production chunk exceeds 500 kB

Evidence: Vite produced a 615.78 kB minified main JavaScript chunk and emitted
its standard chunk-size warning.

Impact: startup/download and parse cost may be higher than ideal. This is not
currently evidence of a correctness or release-safety failure, so code splitting
is deferred while P0/P1 audits are open.

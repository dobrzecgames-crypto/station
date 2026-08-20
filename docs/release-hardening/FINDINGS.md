# Release Hardening Findings

Findings are recorded only after source inspection or a reproducible test.

## Confirmed findings

None confirmed yet. The untouched automated baseline is green.

## Open audits

- Transport shutdown consistency across manual STOP, SONG completion, project
  replacement, AudioContext state changes, and component disposal.
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

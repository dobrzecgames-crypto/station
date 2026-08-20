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

### P1 — Late scheduler wakes restarted patterns and burst stale TRACKS starts — FIXED

Evidence:

- When `StepSequencer.nextStepTime` was more than its look-ahead behind
  `AudioContext.currentTime`, it reset `nextStepIndex` and the pattern section
  to zero. A browser stall therefore changed musical position.
- `TimelineScheduler` marked every newly visible clip as scheduled even when
  its calculated `when` was already in the past. Web Audio clamps such starts
  to the present, so several expired clips could begin together after a stall.
- Resuming inside a pitched/tempo-matched clip advanced its source position by
  wall-clock seconds rather than rate-adjusted audible source seconds. Loop
  bounds were also coupled to the resume offset.

Root cause: both schedulers had independent implicit late-wake behavior rather
than an explicit catch-up rule.

Fix:

- Both schedulers allow 12.5 ms of bounded late-start grace (half the normal
  ticker interval), then preserve the audio-clock transport position.
- StepSequencer advances its step/section/SONG cursor without firing expired
  step events. It never resets to the beginning because JavaScript woke late.
- TimelineScheduler skips fully expired clips, resumes a still-active clip at
  `now`, and supplies a rate-correct offset without moving the clip's original
  loop region.
- Both schedulers expose cumulative late-wake/max-lateness/skip diagnostics.

Musical behavior decision: transient starts that are more than 12.5 ms late are
skipped. Sustained TRACKS audio resumes only while its fixed timeline slot and
its non-looped audible source are both still active. Small ordinary wake jitter
retains the established immediate-start behavior.

Verification: six deterministic recovery tests cover 25, 70, 150, 500, and
2000 ms wake delays, coherent SONG-slot advancement, expired transient
suppression, rate-correct sustained-clip recovery, and absence of past timeline
timestamps. Full gate passed with 120/120 tests, typecheck PASS, build PASS.

### P1 — Project replacement retained old routing graphs — FIXED

Evidence: sample assets, waveform caches, reverse buffers, and instrument patch
runtimes had explicit removal paths, but `channels`, `groupBuses`,
`groupEffects`, `groupEffectStates`, and chord-performance occurrence keys did
not. Pattern Group and TRACKS IDs are project-owned, so repeatedly opening
projects with different IDs monotonically grew those maps and retained their
Web Audio nodes/effect feedback graphs until page teardown.

Root cause: project replacement synchronized assets and instrument patches but
had no equivalent synchronization boundary for group/track routing resources.

Fix: after a replacement project has decoded successfully and transport/manual/
preview voices are stopped, `syncRuntimeRouting` disposes every channel, bus,
effect rack, state, Pump route, and occurrence key outside the loaded project's
group/channel set. Low-cost `AudioEngine.getDiagnostics()` snapshots now expose
voice counts by origin/type, asset/reverse-cache counts, routing-map sizes, and
AudioContext latency/state without continuous polling.

Verification: a deterministic 100-project-cycle registry stress test remains
bounded at the two active resources and proves exactly-once/idempotent disposal.
Full gate passed with 122/122 tests, typecheck PASS, build PASS.

### Investigated — active voice and reverse-cache ownership

No additional automatic eviction policy was added. Sample and timeline sources
clean themselves on `ended`; every STOP path catches already-ended/double-stop
conditions and cleanup guards are idempotent. Synth/organic-bass/strings/POLY
runtime disposal stops and disconnects owned voices. The reverse cache is one
whole buffer per loaded asset, is replaced on same-ID sample replacement, and
is cleared on asset removal/project replacement/dispose. Audible click/glitch
quality and browser memory behavior remain manual checks.

## Open audits

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

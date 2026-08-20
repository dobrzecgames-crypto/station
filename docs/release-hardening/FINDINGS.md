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

### P0 — Optional ZOLA-X worklet failure disabled core audio — FIXED

Evidence: `AudioEngine.initialize()` awaited `audioWorklet.addModule()` inside
the same failure boundary as core AudioContext and master-bus setup. A browser,
deployment, or processor-registration failure therefore set the complete audio
engine to `error`, even though sample playback, the transport, BASSIC,
MONOGORG, ORGANIC BASS, and STRINGS do not depend on that processor.

Root cause: the optional instrument had no independent availability state and
its rejected initialization promise was part of the mandatory startup path.

Fix: optional module registration now has an isolated `idle` / `initializing` /
`ready` / `unavailable` lifecycle. Failures are captured as diagnostics and
core startup continues. An explicit later START AUDIO retries a failed load
without reusing a poisoned rejected promise. Concurrent attempts share one
load, and disposal invalidates an in-flight result. Opening ZOLA-X is blocked
with a specific recovery message while its module is unavailable; other audio
paths remain usable.

Verification: five deterministic tests cover asynchronous rejection,
synchronous throw, recovery on retry, concurrent initialization, and disposal
during load. Full gate passed with 127/127 tests, typecheck PASS, build PASS.

### P1 — A failed main IndexedDB open poisoned storage until reload — FIXED

Evidence: `StationDatabase` cached the first open promise indefinitely.
`onerror` and `onblocked` rejected that promise without clearing it, so every
later project operation received the same rejection. Successful connections
also had no `versionchange` handler and could keep a schema upgrade in another
tab blocked.

Root cause: connection ownership consisted only of a memoized promise; it had
no failed-attempt release or live-connection lifecycle.

Fix: failed and blocked attempts now release the cache, a late success from an
already rejected/stale attempt is immediately closed, and successful
connections close and release themselves on `versionchange` or an unexpected
`close`. A normal close API and low-cost connection diagnostics expose the
current state without opening the database.

Verification: deterministic request/connection doubles prove retry after
`onerror`, close/reopen after `versionchange`, and recovery after `onblocked`
including a late stale success. Full gate passed with 130/130 tests, typecheck
PASS, build PASS.

### Investigated — project manifest/asset transaction atomicity

Create, update, replace, delete, and their asset/metadata mutations already use
one IndexedDB `readwrite` transaction. Repository methods wait for transaction
completion and surface abort/error, so IndexedDB either commits the manifest
and its asset mutations together or retains the previous committed state.
Corrupt or missing project assets fail load explicitly. Browser integration
coverage for real IndexedDB transaction-abort behavior remains pending.

### P1 — Autosave rewrote every WAV and could misreport a newer edit — FIXED

Evidence: every create/update/replace called `put()` for every referenced asset
record, even when a synth parameter was the only changed value. The App also
treated each queued completion as current: an older snapshot completing after a
new edit updated the project summary with no revision check, while there was no
persistent SAVED/SAVING/DIRTY/ERROR state.

Impact: ordinary slider work caused repeated multi-megabyte IndexedDB writes,
increasing save latency, quota pressure, and failure exposure. A tab closed
inside the 1.5 second debounce window had no warning, and the UI could imply a
save was current while a newer revision was still pending.

Root cause: stable asset identity was not used as an immutability boundary, and
the serialized promise queue had no edit/save revision model.

Fix:

- Asset writes first query stable IDs and write a Blob only when its ID is not
  already stored. New asset writes, the manifest, metadata, and garbage
  collection remain in the same transaction.
- A small revision tracker exposes SAVED/SAVING/DIRTY/ERROR plus queue depth.
  Completion of an older queued revision cannot mark a newer edit saved, and a
  failed latest save remains dirty and in ERROR until a retry succeeds.
- The Project System Display shows the save state. Dirty named projects request
  the browser's normal unload confirmation. When the document becomes hidden,
  the current debounce is flushed opportunistically while the page is still
  alive; no asynchronous save is started from `beforeunload`.

Stable-ID decision: replacing audio creates a fresh asset ID; an existing ID is
an immutable Blob identity. Current sample, drum-render, CHOP, and TRACKS import
paths already follow that rule, while built-in IDs intentionally refer to the
same bundled content.

Verification: two asset-write tests prove zero Blob writes for a manifest-only
save and exactly one write for one new asset. Three revision tests prove latest
state wins, error remains dirty through failure/retry, and a late completion
from a replaced project is ignored. Full gate passed with 135/135 tests,
typecheck PASS, build PASS.

### P1 — Storage quota failures were indistinguishable — FIXED

Evidence: IndexedDB request/transaction helpers replaced the browser error with
a generic `Error`, discarding `QuotaExceededError`. The UI could report only
that a save failed, with no way to distinguish capacity pressure from an
invalid operation or database lifecycle failure.

Fix: storage errors now preserve an explicit quota/blocked/unavailable/
operation classification and retain the browser cause. Quota failure states
that the transaction was not committed and existing projects are unchanged;
the revision tracker remains DIRTY/ERROR so success is never implied. An
on-demand monitor exposes `navigator.storage.estimate()` usage/quota ratio and
persisted state. Station makes at most one best-effort persistence request per
page session, only after a successful explicit save; denial does not make that
already completed save fail.

Browser limitation: estimates are approximate and browser-managed, persistence
may be denied without explanation, and neither API guarantees protection from
user-initiated site-data deletion. Station does not request persistence at
startup and does not send storage data externally.

Verification: four deterministic tests cover nested quota classification,
transaction-abort propagation, usage/quota/persisted diagnostics with a
single persistence request, and unsupported-API degradation. Full gate passed
with 139/139 tests, typecheck PASS, build PASS.

## Open audits

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

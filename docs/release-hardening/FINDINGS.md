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

### P0 — Look-ahead SONG completion cut the final scheduled step — FIXED

Evidence: `StepSequencer` invokes its completion hook when planning advances
past step 16, up to the 100 ms look-ahead before the audio clock reaches the
song boundary. The initial paired-lifecycle fix correctly routed that hook to
global STOP, but global STOP immediately removed the final events that had just
been scheduled. The UI also changed to stopped before the boundary.

Root cause: a scheduling-complete notification was treated as if it meant
audio-time completion. This regression was exposed while comparing live SONG
boundaries with offline render duration.

Fix: the sequencer now supplies the exact final grid-boundary timestamp.
`TransportCoordinator` gives TRACKS that boundary; it continues planning the
remaining valid pre-boundary starts, stamps every existing/new source to stop
at the audio time, and rejects starts beyond it. A zero-gain one-frame Web
Audio marker finishes UI state at the boundary. Manual STOP cancels the marker
and still removes both voice origins immediately. Natural completion does not
invoke the manual sequencer-voice cut, so valid sample/synth release and FX
tails can ring as they did before the lifecycle centralization.

Verification: four deterministic regressions prove the boundary timestamp,
continued last-window TRACKS planning without post-boundary starts,
audio-clock-delayed completion without sequencer-tail stop, and cancellation
by manual STOP. Full gate passed with 143/143 tests, typecheck PASS, build PASS.

### P0 — Offline WAV render omitted all TRACKS audio — FIXED

Evidence: live normal transport starts both `StepSequencer` and
`TimelineScheduler`, but `renderSongToBuffer` constructed only the step
scheduler. It loaded only pad-owned buffers and applied only Pattern Group/master
buses. A project could therefore monitor TRACKS, press RENDER, and receive a
fundamentally different file with that entire supported subsystem absent.

Product decision: RENDER remains a bounded SONG export—slot 1 through the last
occupied Pattern Clip slot—not an infinite timeline or PATTERN-loop bounce.
Every TRACKS clip whose start intersects that interval is included. A clip that
crosses the final SONG boundary is stamped to stop there; clips starting at or
after it are excluded, matching live non-looping SONG completion.

Fix: the offline engine now loads every project asset, applies track gain/
mute/solo/effect buses, and schedules the bounded clip list through the same
`toTimelineSchedulerClips` → `TimelineScheduler` → `AudioEngine.scheduleClip`
path as live playback. Missing decoded material fails before graph creation.
An unavailable optional worklet fails explicitly only when rendered SONG
material uses ZOLA-X; it does not produce a partial file or disable live core
audio. Tail allocation now includes TRACKS racks and TIGHT ROOM as well as
delay, sums serial upstream/master paths conservatively, and retains the
twelve-second cap.

Verification: two deterministic render-plan tests prove interval inclusion/
exclusion while preserving clip gain/fades/reverse/pitch, plus delay/TIGHT ROOM
serial-tail calculation. Full gate passed with 145/145 tests, typecheck PASS,
build PASS. Real OfflineAudioContext waveform verification remains assigned to
the Chromium smoke stage; live/render A/B listening remains a manual check.

### P1 — A fatal React render had no in-app recovery path — FIXED

Evidence: the root mounted `App` directly inside `StrictMode`. Station had no
React error boundary, no local record of uncaught errors or unhandled promise
rejections, and no truthful guidance separating a committed browser save from
newer unsaved edits. A fatal render could therefore leave only a blank or
partially mounted interface and console output.

Fix: a top-level boundary now replaces a failed component tree with a small
Vinyl Dust recovery surface. It states that the last successfully saved local
project remains in browser storage while DIRTY/SAVING edits may be lost, and
offers RELOAD, viewable diagnostic details, and explicit copy. A bounded
in-memory log captures React errors, `window.error`, and
`unhandledrejection`; it records only error metadata and never sends telemetry
or project content. A development-only `?stationCrash=render` hook makes the
fatal path reproducible without shipping a production crash switch.

Verification: two deterministic tests prove bounded capture and safe report
formatting. A real local Chromium page forced the render error, displayed the
recovery copy/actions, exposed the intentional error with React source in the
details, and confirmed COPY DETAILS. Full gate passed with 147/147 tests,
typecheck PASS, build PASS.

### Investigated — opt-in runtime diagnostics are sufficient for torture tests

Station now exposes a read-only `?diagnostics=1` panel and renders no
diagnostics DOM without that exact opt-in. The panel samples existing counters
at 1 Hz and refreshes browser storage estimates every 30 seconds; it does not
instrument audio callbacks, scheduler hot paths, or React animation frames.

Visible state includes the build SHA; AudioContext state/rate/latencies and
optional-worklet availability; paired scheduler state, musical position,
late-wake maxima and skipped events; voice counts by origin/type; asset/cache
and routing counts; project ID, revision-aware save status and queue; IndexedDB
connection state plus approximate usage/quota/persistence; and render activity.
The SHA comes from an explicit build environment value when supplied, then a
local Git fallback, and degrades to `unknown` rather than failing the build.

Verification: two formatting/opt-in tests plus real local Chromium checks prove
the panel is absent on the normal URL, complete on the opt-in URL, carries the
current SHA, and refreshes at the documented cadence. Full gate passed with
149/149 tests, typecheck PASS, build PASS.

### Investigated — release-critical browser behavior now has a product smoke

A minimal Playwright test now executes one continuous, user-visible workflow:
page startup, a real click on START AUDIO, built-in WAV loading and pad
triggering, ten PLAY/STOP cycles, an explicit named-project save, page reload,
audio restart, library reopen, project restore, stable project identity, saved
state, restored pad material, and playback after restore. It also waits for
sequencer/timeline voice counts to return to zero and fails on uncaught page
errors. The selectors use roles, labels, and state rather than pixels.

The same workflow passed headlessly in current installed Chrome and Microsoft
Edge on Windows. The Chromium project can use Playwright's pinned browser in
CI; `STATION_CHROMIUM_EXECUTABLE` is an optional local override for an already
installed Chromium-family executable. There are no retries, so a failure is
not hidden by a later attempt. Trace and screenshot artifacts are retained
only on failure.

Automation verified AudioContext reached RUNNING after a genuine UI gesture and
that both built-in Chop and pad-library WAV fetch/decode paths did not error.
Headless execution is not proof
of audible output, click/glitch quality, hardware routing, or device lifecycle;
those stay on the manual Chrome/Edge checklist.

### P1 — Built-in Chop test buttons referenced missing WAV files — FIXED

Evidence: all four entries in `src/chop/chopTestSamples.ts` targeted
`public/library/chop-sample-1.wav` through `chop-sample-4.wav`, but none of
those files existed in the starting tree. Selecting any of the four visible
`OR TRY A SAMPLE` controls therefore produced an HTTP 404 and left the Chop
workspace empty.

Fix: the four controls now reference four existing, non-empty WAV files from
the bundled breaks library. A static regression test extracts every Chop test
asset reference and requires each corresponding public file to exist.

Verification: the logic suite passes 150/150. The zero-retry release smoke now
opens LASER, loads test sample 1 through the real control, waits for the decoded
source workspace, and then continues through its pad, transport, save, reload,
and restore checks. That full flow passed in installed Chrome and Microsoft
Edge on Windows.

### Investigated — CI now enforces the release validation commands

There was no GitHub Actions configuration. A single non-deploying Ubuntu job
now runs on pushes and pull requests with read-only repository permissions. It
installs the package-manager version declared by `packageManager`, installs
dependencies with `--frozen-lockfile`, and runs the logic suite, typecheck,
production build, a pinned Playwright Chromium install, and the release browser
smoke as separate fail-fast steps. The job has a 20-minute ceiling and the
browser smoke retains its zero-retry policy.

The workflow uses the current official action majors (`actions/checkout@v7`,
`actions/setup-node@v7`, and `pnpm/action-setup@v6`) and Node 24, matching the
local hardening baseline. It has no deployment, publishing, Vercel, domain,
secret-write, or repository-write step.

Local equivalents are green. The first hosted Actions result remains unchecked
because this branch has deliberately not been pushed.

## Open audits

- First hosted GitHub Actions result after the owner chooses to push.

## Baseline observations

### P2 — Main production chunk exceeds 500 kB

Evidence: Vite produced a 615.78 kB minified main JavaScript chunk and emitted
its standard chunk-size warning.

Impact: startup/download and parse cost may be higher than ideal. This is not
currently evidence of a correctness or release-safety failure, so code splitting
is deferred while P0/P1 audits are open.

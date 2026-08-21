# Final independent red-team review

## Scope of this pass

This was not a QA repeat. Automated hardening, an exploratory Chrome pass and a
mobile preflight had already run, so this review assumed the cheap defects were
gone and went looking for cross-system, lifecycle, timing and
sequence-of-actions failures instead. Prior findings were treated as hypotheses
to re-verify, not as facts.

Every defect below was reproduced against the running product before any code
was changed, and every fix was re-verified against the same reproduction.

## Provenance

- Starting branch: `release/station-hardening`
- Starting SHA: `682e7d5c5d64d7d869992d682fc239e91efb2259` (`fix: stabilize mixer faders on mobile`)
- Working tree at start: clean (`nothing to commit, working tree clean`)
- Review branch: `qa/claude-final-redteam`, created from that SHA
- Not merged, not pushed, not deployed. No reset, no discarded work.

## Test environment

| Item | Value |
| --- | --- |
| OS | Windows 11 Pro 10.0.22631 |
| Node | v24.14.1 |
| pnpm | 11.15.1 |
| Playwright | 1.62.1 |
| Google Chrome | 151.0.7922.139 |
| Microsoft Edge | 151.0.4129.93 |
| App under test | Vite dev server on `http://127.0.0.1:4173`, `?diagnostics=1` |
| Mobile profiles | iPhone 13 and Pixel 7 device emulation in Chrome, CDP touch input |

Everything was driven through real browsers with trusted input (Playwright
clicks, taps, and CDP `Input.dispatchTouchEvent`). No claim below rests on a
synthetic `dispatchEvent` unless it says so.

## Effort

- Duration: one continuous working session.
- Roughly 60 distinct attack scenarios, executed across ~40 automated browser
  runs plus manual driving of a dev server.
- Counted interactions inside those runs: 200 PLAY/STOP cycles with double-STOP,
  10 graduated main-thread stalls (5 ms → 5000 ms), 137 library auditions,
  23 touch sliders × 3 gestures each × 2 device profiles (138 touch drags),
  6 offline renders, 8 project open/save/new/delete cycles, 4 orientation
  changes during playback, 2 injected subsystem failures. Well over 1000
  individual input events.

## Systems reviewed

`src/App.tsx` in full; `src/audio/` (AudioEngine, StepSequencer,
TimelineScheduler, TransportCoordinator, OptionalAudioSubsystem,
runtimeLifecycle, effects, wavEncoder); `src/storage/` (StationDatabase,
ProjectRepository, ProjectSaveState, assetWriteStrategy, storageErrors);
`src/project/` (ProjectState, renderSong, renderPlan, stationProjectFile,
codec, library/name/conflict dialogs); `src/tracks/`; `src/song/`;
`src/shell/` (useDragSlider, useRotaryDrag, SystemDisplay, systemDisplayContext,
TransportBar, ApplicationErrorBoundary); `src/pads/`; `src/mixer/`;
`src/sequencer/`; `src/diagnostics/`; `src/library/`; `src/main.tsx`;
plus the existing test suites and `docs/release-hardening/*`.

---

## P0 findings

### P0-1 — A cancelled unload destroyed the audio runtime and made the project permanently unsavable — FIXED

`src/main.tsx:38` disposed the whole `AudioEngine` on `beforeunload`. `beforeunload`
is cancellable, and `src/App.tsx` deliberately *asks the user to cancel it*
whenever a named project is dirty. So Station warned "you have unsaved
changes", the user chose **Stay** specifically in order to save them — and by
then the AudioContext was closed, `samples`, `waveforms` and `runtimeAssets`
were cleared, and the save could never complete.

Reproduction (3/3, Chrome):

1. Load a library sound onto PAD 01, save the project, wait for `SAVED`.
2. Paint a step so the project is `DIRTY`.
3. Reload the tab; the browser shows the unsaved-changes prompt.
4. Choose **Stay on this page**.

Measured, before the fix:

```
[unload] before:            READY RUNNING  samples=1
[unload] prompt:            beforeunload
[unload] navigation cancelled
[unload] after staying:     INACTIVE UNAVAILABLE  samples=0
[unload] after trying to save: ERROR | Project cannot be saved because a referenced WAV is unavailable.
```

Root cause: `beforeunload` means "the page *may* be going away". The event that
means the document really is being discarded is `pagehide` with
`persisted === false`; a bfcache-persisted hide may come back and must keep its
runtime.

Fix (`120ebb3`): move the teardown to `pagehide`, guarded on `!event.persisted`.

After the fix the same reproduction ends `READY RUNNING samples=1` and the save
succeeds (`SAVED`).

---

## P1 findings

### P1-1 — PLAY during the REC count-in lit the REC lamp and silently dropped every hit — FIXED

The count-in started `StepSequencer` directly rather than through
`TransportCoordinator`. PLAY stays enabled during the count-in because
`isPlaying` is still `false`, so pressing it made the coordinator "repair" a
partially running transport by restarting the step sequencer at a fresh
timestamp — while `recordingTakeClockRef` still pointed at the original
count-in downbeat, up to four beats in the future. `pendingRecordingStartRef`
then armed recording at the new step 0, so REC went solid and the pattern
played, but every hit resolved to a negative take step and was discarded by
`recordPadHit`.

Reproduction (3/3, Chrome): pre-paint one step, press REC, wait 250 ms, press
PLAY, tap the pad four times, STOP.

| | control (PLAY then REC) | attack (REC then PLAY) |
| --- | --- | --- |
| steps before | 1 | 1 |
| steps after | 5 | **1** |

### P1-2 — A recording take never started TRACKS — FIXED

Same root cause. During a count-in take the transport reported RUNNING while
`TRANSPORT/TIMELINE` stayed `STOPPED`, `TRACK BEAT` stayed `0.00` and
`VOICES/TIMELINE` stayed `0` — the WAVES arrangement was silent and its
playhead frozen for the whole take. That contradicts DEC-027 and App's own
comment that "both schedulers always start together from the same audio-clock
instant".

Fix for both (`cfaae78`): `TransportCoordinator.start` gained an explicit shared
`startAt`, so the count-in starts *both* schedulers on its own downbeat. PLAY
during a count-in now finds both running and correctly returns `null`.

Verified after: `step = RUNNING | timeline = RUNNING | track beat = 3.44 | timeline voices = 1`,
and the attack case records 4 of 4 hits.

### P1-3 — Auditioning the sound library retained every decoded buffer for the session — FIXED

`previewLibrarySample` loaded each audition under its own `library-preview-*`
asset id. Auditions are not project material, so `removeAssetIfUnused` never saw
them and only opening a different project pruned them.

Measured before the fix, auditioning 137 library sounds:

```
samples 0 -> 132 | runtime blobs 0 -> 132 | JS heap 26 MB -> 156 MB
```

…for a project referencing one sample, and it stayed at 132 when idle. Browsing
the sounds is the first thing a new user does, and this is a mobile-first build,
so +130 MB of unreferenced decoded audio is a realistic tab-reload on a phone.

Fix (`7b5dbea`): only one audition can sound at a time, so only one is kept.
After: `samples 0 -> 2 | blobs 0 -> 2 | heap 23 -> 35 MB` for 137 auditions.

### P1-4 — A live tempo change teleported the WAVES playhead — FIXED

`TimelineScheduler` derives its position from elapsed seconds, so a new bpm was
applied to the *whole elapsed span* at once: every second already played got
re-read at the new rate. The jump is proportional to how long playback has been
running, clips between the old and new position are skipped, and the pattern —
which carries its own step cursor — does not move, so the two schedulers
disagree about where the transport is.

Measured, 120 → 200 bpm after ~2 s of playback: the playhead advanced **8.84
beats** where 6.67 was the entire plausible forward advance.

Fix (`f053168`): `TimelineScheduler.rebaseTempo` re-anchors the beat/time origin
so beats already played keep their positions and only the rate ahead changes —
the invariant `StepSequencer` already keeps. App re-anchors the UI playhead from
the same origin. After: 5.62 beats, pure forward advance.

### P1-5 — An edit made while a project operation was busy was silently lost under a "SAVED" display — FIXED

The autosave effect bailed out entirely while `projectBusy` was true, and
`projectBusy` was not one of its dependencies — so an edit landing between
tapping a PROJECT action and its async work finishing (the workspace stays live
until the dialog appears) was neither marked dirty nor queued, and nothing
re-ran the effect when the window closed. The display went on reporting SAVED,
no unload warning was armed, and the edit vanished on the next reload.

Reproduction: save a project, tap LIBRARY and paint a step in the same task,
close the dialog, reload, reopen.

```
[busy] after edit inside the busy window: SAVED 1 / 1
[busy] steps live in the app before reload = ["step 1", "step 5"]
[busy] steps restored after reload        = ["step 1"]
```

The guard existed only to stop a project *load* — which replaces every value the
effect watches — from registering as an edit. Removing it naively regresses that.

Fix (`2fde039`): the save tracker already bumps a `generation` on every `reset`,
which happens exactly once per load, so the re-baseline keys off that instead of
off `projectBusy`. Both sides now have regressions: a freshly opened project
still reports SAVED, and an edit inside a busy window survives a reload
(`SAVED 3 / 3`, both steps restored).

---

## P2 observations

| # | Observation | Status |
| --- | --- | --- |
| P2-1 | The `?diagnostics=1` overlay was read-only but intercepted pointer input over the wide arranger's exit control (QA-CHROME-P2-001). It also blocked automated passes driven through the diagnostics URL. | **Fixed** (`66e65b9`) — `pointer-events: none`. Deliberate trade-off: the panel can no longer be scrolled by pointer; both suites read it from the DOM. |
| P2-2 | Two library auditions can overlap: `previewLibrarySample` calls `stopPreview()` *before* its `await fetch(...)`, so two slow-starting previews both reach `previewAsset`, and the first `onEnded` clears the flag while the other is still audible. | Reported, not fixed. Bounded and self-correcting; tapping the row again recovers. |
| P2-3 | After using the PROJECT display tenant, the pad browser does not re-claim the display until the selected pad id changes, so returning to the same pad leaves the tempo readout showing. | Reported, not fixed. Arguably correct arbitration; recovers on any other pad tap. |
| P2-4 | `src/audio/AudioEngine.ts` carries a complete STRINGS runtime (~500 lines: `stringsRuntimes`, ensembles, shared LFOs, `syncStringsPatches`) that nothing reaches — `stringsPatches` is stripped at load in `ProjectState.ts` and no caller exists. | Reported, not fixed. Dead weight in the largest file, not a defect. |
| P2-5 | The Vite main-chunk >500 kB advisory persists (639 kB / 181 kB gzip). | Pre-existing, out of scope. |

---

## Suspected issues investigated and disproven

These were real hypotheses with a plausible mechanism. Each was tested against
the running product and did **not** reproduce. Recording them matters as much as
the findings.

| Hypothesis | Verdict | Evidence |
| --- | --- | --- |
| Opening a saved project immediately marks it DIRTY and rewrites it (bumping `modifiedAt` on mere opening). | **Disproven** | `SAVED 1 / 1` immediately after OPEN and 2.5 s later. |
| An edit inside the 1.5 s autosave debounce is lost when the user switches project, because `prepareForProjectSwitch` clears the pending timer. | **Disproven** | `openProjectLibrary` flushes via `persistCurrentProjectSilently()` first; both edits survived an A→B→A round trip. |
| A stale SONG-completion marker can fire after a fresh PLAY and stop the new playback. | **Disproven** | `finishNaturalSongPlayback` nulls the marker before `setIsPlaying(false)`, PLAY is disabled while `isPlaying`, and `TransportCoordinator.stop` cancels it. Covered by existing tests. |
| Deleting the currently open project leaves the runtime or storage in a broken state. | **Disproven** | Ends `UNSAVED / DIRTY`, IndexedDB `OPEN`, samples retained; playback and a fresh save both work afterwards. |
| The arranger's own STOP is unreachable after selecting a clip (Playwright kept failing on it). | **Disproven** | Hit test at the button centre resolves to the button itself, enabled and on-screen. Harness "stability" artifact. |
| Repeated renders leak resources or leave a permanent rendering state. | **Disproven** | 4 renders of an unchanged project produced byte-identical 491,004-byte WAVs; routing stayed `1 / 1 / 1`, voices 0, `RENDER/ACTIVE = NO`, playback fine afterwards. |
| A shared drag primitive leaves some slider dead after a cancelled touch (the class of bug that shipped in the MIX faders). | **Disproven** | 23 sliders across TEMPO / PADS / MIX / SYNTH, on iPhone 13 and Pixel 7 profiles: all respond to the first drag, survive `touchCancel`, and answer the next gesture. Zero dead controls. |

---

## Torture and stress results

**Transport — 200 PLAY/STOP cycles** with mixed same-tick / 30 ms / 140 ms stop
timing and a double-STOP on every cycle:

```
cycle  50: STOPPED STOPPED | voices 0 | late 0 | expired 0/0/0 | routing 1/1/1
cycle 100: STOPPED STOPPED | voices 0 | late 0 | expired 0/0/0 | routing 1/1/1
cycle 150: STOPPED STOPPED | voices 0 | late 0 | expired 0/0/0 | routing 1/1/1
cycle 200: STOPPED STOPPED | voices 0 | late 0 | expired 0/0/0 | routing 1/1/1
final: engine READY, context RUNNING, samples 1, reverse/waveform 0/1
```

No page errors. This is the strongest single piece of evidence in the review.

**Main-thread stalls** injected while playing, 5 ms → 5000 ms:

| stall | scheduler | late wakes / max | expired steps |
| ---: | --- | --- | ---: |
| 5–70 ms | RUNNING | 0 / 0.0 ms | 0 |
| 150 ms | RUNNING | 1 / 50.7 ms | 1 |
| 300 ms | RUNNING | 2 / 145.7 ms | 3 |
| 500 ms | RUNNING | 3 / 305.0 ms | 6 |
| 1000 ms | RUNNING | 4 / 851.3 ms | 13 |
| 2000 ms | RUNNING | 5 / 1887.0 ms | 28 |
| 5000 ms | RUNNING | 6 / 4816.3 ms | 67 |

Expired steps were *skipped and counted*, never fired as a burst; clip expiry
stayed 0; voices returned to 0 after STOP. The deterministic catch-up rule holds
under stalls an order of magnitude larger than the look-ahead.

**Storage failure and recovery** — first `indexedDB.open` forced to error:

```
after injected failure: INDEXEDDB = ERROR | "Could not open project storage. injected open failure"
after retry:            INDEXEDDB = OPEN  | SAVE = SAVED | id = project-d3914cfa-...
page errors: []
```

No poisoned promise; the next project operation recovered on its own.

**Optional subsystem failure** — `AudioWorklet.addModule` forced to reject:

```
engine = READY | context = RUNNING | zola = UNAVAILABLE
ZOLA-X refusal: "ZOLA-X is unavailable. Press START AUDIO to retry its audio module."
after explicit retry: engine = READY | zola = READY
page errors: []
```

Core audio, sample loading and the transport all remained fully usable while the
optional instrument was down, and the retry recovered without inheriting a
rejected promise.

**Render** — tiny SONG, render after 12 PLAY/STOP cycles, render after a project
switch, four consecutive renders: all produced valid RIFF/WAVE files with
non-silent PCM, identical length for identical input, no resource growth, no
stuck `RENDER/ACTIVE`, live playback intact afterwards.

**Recruiter cold session** — first-time-user path (tab tour, load a sound, tap
pads, paint steps, play, save with a name, reload, find it in the library):
**zero console errors, zero page errors**.

## Resource-growth observations

| Scenario | Before | After | Verdict |
| --- | --- | --- | --- |
| 200 PLAY/STOP cycles | routing 1/1/1, voices 0 | routing 1/1/1, voices 0 | Flat |
| 4 consecutive renders | routing 1/1/1, samples 1 | routing 1/1/1, samples 1 | Flat |
| 137 library auditions (before fix) | 0 samples, 26 MB heap | 132 samples, 156 MB heap | **Monotonic — fixed** |
| 137 library auditions (after fix) | 0 samples, 23 MB heap | 2 samples, 35 MB heap | Bounded |
| Project switches (new/open/delete) | — | routing follows project size | Follows content, no growth |

No garbage-collector noise was treated as leak evidence; every number above is a
Station-owned counter except the JS heap figures, which are directional only.

---

## TOP 10 WAYS I TRIED TO BREAK STATION

| # | Attack | Result |
| ---: | --- | --- |
| 1 | Take the unsaved-changes warning at its word: dirty the project, try to leave, then choose **Stay**. | **BROKE IT — P0.** The audio engine was already destroyed and the save the warning asked for became permanently impossible. Fixed. |
| 2 | Press PLAY during the REC count-in, then play a take. | **BROKE IT — P1.** REC lit, pattern audible, every hit silently discarded. Fixed. |
| 3 | Record a take over a WAVES arrangement. | **BROKE IT — P1.** TRACKS never started; silent arrangement, frozen playhead, transport reporting RUNNING. Fixed. |
| 4 | Audition my way through the sound library like a first-time visitor. | **BROKE IT — P1.** 132 decoded buffers and +130 MB retained for the session. Fixed. |
| 5 | Change tempo while a WAVES arrangement is playing. | **BROKE IT — P1.** Playhead teleported 8.84 beats; the two schedulers disagreed about the transport position. Fixed. |
| 6 | Edit in the gap between tapping a PROJECT action and its dialog appearing. | **BROKE IT — P1.** Edit lost on reload while the display reported SAVED. Fixed. |
| 7 | 200 PLAY/STOP cycles with double-STOP and mixed timing, then inspect every counter. | Held. Schedulers stopped, voices 0, routing flat, no expired events, no errors. |
| 8 | Freeze the main thread for 5 ms → 5000 ms at ten points during playback. | Held. Position preserved, expired steps skipped and counted, no burst, no reset. |
| 9 | Kill IndexedDB on first open, and kill the ZOLA-X worklet load, then try to keep working. | Held. Truthful error states, core audio unaffected, both recovered on retry with no poisoned singleton. |
| 10 | Drag, cancel and re-drag every touch slider on four screens across two phone profiles; rotate the device four times mid-playback. | Held. 23/23 sliders alive after cancellation; transport survived every rotation. |

---

## Fixes made

| Commit | Severity | Change |
| --- | --- | --- |
| `120ebb3` | P0 | Keep the audio runtime alive when an unload is cancelled (`pagehide` + `!persisted`). |
| `cfaae78` | P1 ×2 | Start the recording count-in through the transport boundary. |
| `7b5dbea` | P1 | Bound library auditions to the sound currently playing. |
| `f053168` | P1 | Re-anchor the WAVES timeline on a live tempo change. |
| `2fde039` | P1 | Track edits made while a project operation is busy. |
| `66e65b9` | P2 | Stop the diagnostics overlay intercepting product input (it blocked QA). |
| `6c60018` | — | Red-team regression suite. |

Total product change: 12 files, ~110 net lines of source. No feature, no
redesign, no rename, no architectural rewrite, no dependency change.

## Regression tests added

Deterministic (`pnpm test`, 151 → 155):

- a recording count-in starts both schedulers on its own future downbeat;
- PLAY during a running count-in is a no-op instead of restarting the step sequencer;
- a live tempo change re-anchors the timeline instead of teleporting the playhead;
- `rebaseTempo` is inert while the timeline is stopped.

Browser (`pnpm test:redteam`, new suite, 11 tests):

- a cancelled unload leaves the audio runtime and the pending save intact;
- PLAY pressed during the REC count-in still records the take;
- a REC count-in take starts WAVES on the same downbeat;
- a live tempo change does not teleport the WAVES playhead;
- an edit made while a project operation is busy is tracked and persisted;
- opening a saved project does not report it as carrying unsaved edits;
- auditioning the sound library does not retain every decoded buffer;
- every shared drag slider survives cancel and answers the next gesture (iPhone + Android);
- orientation changes during playback keep the transport coherent (iPhone + Android).

### Why a separate config

`playwright.config.ts` and `playwright.mobile-rc.config.ts` both set
`reducedMotion: 'reduce'`. That skips Station's power-on animation — and that
animation's `animationend` is the only thing that sets `powerVisualPhase` to
`on`, which is what enables PLAY, REC, PAT/SONG, the pattern row and the bank
row. **Until this pass, no automated test had ever exercised the real code path
that enables the transport.** The red-team suite deliberately runs without
reduced motion and therefore covers it.

## Final automated gates

| Gate | Result |
| --- | --- |
| `pnpm test` | **PASS** — 155/155, 0 failed, 0 skipped |
| `pnpm typecheck` | **PASS** |
| `pnpm build` | **PASS** — 172 modules; pre-existing >500 kB chunk advisory only |
| `pnpm test:browser:chrome` | **PASS** — 1/1 (Chrome 151) |
| `pnpm test:browser:edge` | **PASS** — 1/1 (Edge 151, Tier 3 best effort) |
| `pnpm test:mobile-rc` | **PASS** — 14 passed, 2 intentionally skipped |
| `pnpm test:redteam` | **PASS** — 11/11 |
| `git diff --check` | **PASS** |

## Long-session evidence, stated honestly

A continuous 60-minute single-session soak was **not** run. What was run instead,
across many shorter sessions, was the workload that soak was meant to expose:
200 transport cycles, 137 auditions, repeated project open/save/new/delete,
6 renders, ten main-thread stalls up to 5 seconds, and injected storage and
worklet failures — each with before/after resource counters. The one monotonic
growth curve found by that workload (auditions) is fixed. A real multi-hour soak
on a physical phone remains outstanding.

## Remaining untestable physical-device items

None of the following were executed, and no claim is made about them:

- real iPhone Safari / WebKit (all "iPhone" evidence here is Chrome device
  emulation, not WebKit);
- real Android hardware (Pixel 7 profile is emulation);
- OS sleep/wake, app switching, screen lock, phone calls;
- headphone connect/disconnect and audio output-device changes;
- audible quality: clicks, pops, perceived latency, musical balance, and
  live-versus-render A/B. Every WAV in this review was validated structurally
  and for non-silence, **never auditioned**;
- thermal throttling, memory pressure and process eviction on a real phone;
- browser quota exhaustion under genuine storage pressure (only injected
  failures were tested);
- multi-hour continuous use.

## Known release limitations

- The transport's enabled state depends on a CSS `animationend`
  (`system-display-power-on`). It is now covered by an automated test in a real
  browser, and `prefers-reduced-motion` has an explicit bypass, but making core
  controls depend on a cosmetic animation event remains a fragile coupling.
- The opt-in diagnostics panel is no longer pointer-scrollable (see P2-1).
- Two library auditions can briefly overlap (P2-2).
- The main JS chunk exceeds Vite's 500 kB advisory.
- `AudioEngine` contains an unreachable STRINGS runtime (P2-4).

---

## FINAL VERDICT

**READY FOR PHYSICAL DEVICE ACCEPTANCE**

Not "ready for release candidate closeout": one P0 and five P1 defects were
found and fixed *in this pass*, which means the pre-existing evidence was not as
complete as it looked, and the fixes themselves have only been verified on
desktop Chrome, desktop Edge, and phone *emulation*. The Tier 1 targets — real
iPhone Safari and real Android Chrome — still have zero physical coverage, and
this build is mobile-first. Two of the six fixes (the transport boundary and the
autosave baseline) touch load-bearing lifecycle code and deserve a human pass on
real hardware before closeout.

Not "not ready" either: every defect found was reproducible, root-caused, fixed
with a small change, and covered by a regression, and all eight automated gates
are green.

## Answers

**1. As a senior engineer reviewing this as a junior/AI-assisted portfolio
project, what technical issue would concern me most?**

That the two worst defects both came from the same failure mode: a subsystem
handling its own lifecycle instead of going through the boundary that was built
for exactly that purpose. `TransportCoordinator` exists precisely so both
schedulers start and stop as one unit — and the count-in reached around it and
called `sequencerRef.current.start()` directly, which produced two P1s. `main.tsx`
disposed the engine from a lifecycle event that means "maybe", which produced the
P0. The architecture is right; the discipline of routing everything through it is
what slipped. That is a review-process concern more than a code concern, and it
is the thing most likely to reintroduce a defect after this pass.

Second, `src/App.tsx` at 2,947 lines is where every one of those boundary
crossings lives. It is not unmaintainable, but it is the one file where a
reviewer cannot hold the whole state machine in their head, and every finding in
this review touched it.

**2. Any evidence that Station is held together by fragile generated-code
patches rather than coherent system ownership?**

No — and I looked for it specifically. The evidence points the other way. The
late-wake catch-up rule, the paired transport boundary, the revision-aware save
tracker, the optional-subsystem isolation, the IndexedDB connection lifecycle
and the shared drag primitive are each a single owned mechanism with the
reasoning written down at the call site, not a pile of special cases. The
comments explain *why*, including rejected alternatives, which is the opposite
of generated patchwork. The stall table and the 200-cycle result are what a
coherently owned scheduler looks like under pressure.

The genuine smells are narrower: ~500 lines of unreachable STRINGS runtime
inside `AudioEngine`, and `App.tsx`'s size. Both are accumulation, not fragility.

**3. Single highest remaining release risk?**

Real iOS Safari. Every mobile claim in this project — including mine — rests on
Chrome device emulation, and WebKit is where this app's hardest dependencies
diverge: AudioContext interruption and gesture-gated resumption, AudioWorklet
availability, IndexedDB behaviour under storage pressure, and the native
touch-gesture layer that synthetic pointer events cannot reproduce. A defect
there would be invisible to everything run so far.

**4. Single best engineering decision visible in the project?**

Making the AudioContext clock the only source of musical time, and making the
schedulers' late-wake behaviour an *explicit, diagnosable rule* rather than
implicit. That is why a 5-second main-thread freeze advances the musical cursor
by exactly 67 skipped steps, counts them, refuses to fire them, and keeps
playing — instead of resetting, bursting, or drifting. Almost every browser
sequencer gets this wrong; this one instruments it.

Honourable mention: `?diagnostics=1`. Without those counters most of this review
would have been guesswork.

**5. Anything that would make me uncomfortable letting an external recruiter use
this build unsupervised?**

Not any more. Before this pass, yes — twice over: they could have lost work by
answering the app's own save warning correctly (P0-1), and they could have grown
the tab to ~156 MB just by browsing the sounds (P1-3), which on a phone is a
crash. Both are fixed and covered by regressions.

What remains is honest and bounded: a first-time cold session produced zero
console and zero page errors, the app recovers from a forced storage failure and
a forced worklet failure without help, and every render was structurally valid.
The one caveat I would still attach is that nobody has *listened* to this build
against a rendered WAV, and nobody has run it on a real iPhone. I would let a
recruiter use it unsupervised on desktop Chrome today; I would want the physical
Tier 1 pass before treating a phone demo as safe.

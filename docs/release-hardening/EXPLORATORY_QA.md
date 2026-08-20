# Exploratory release-candidate QA

Date: 2026-08-20
Branch: `release/station-hardening`
Candidate commit: `b6ebe5b9e163091798f2bbcd9dbaeae3e6fdae20`
Primary runtime: headed Google Chrome on Windows, controlled through the Codex browser extension
Required URL: `http://127.0.0.1:4173/?diagnostics=1`

## Acceptance status

> **Superseded release-target note (2026-08-20):** this run was executed and
> originally judged under the former desktop Chrome + Edge blocking matrix.
> The current target is mobile-first: iOS Safari and Android Chrome are Tier 1,
> desktop Chrome is Tier 2, and Edge is Tier 3 / best effort. Therefore the
> unavailable Edge pass below is no longer a release NO-GO. The Chrome results
> remain valid Tier 2 evidence, but this desktop run does not satisfy either
> physical Tier 1 acceptance requirement.

**Chrome result: conditional PASS.** No P0 or P1 product defect was confirmed in the exercised Chrome scope. One P2 issue was reproduced in the opt-in internal diagnostics layout and intentionally left unfixed because this acceptance task authorized fixes only for confirmed P0/P1 defects.

**Current mobile-first interpretation: INCOMPLETE pending physical Tier 1
acceptance.** The reason is the absence of real iPhone Safari and Android Chrome
passes, not the unavailable Edge bridge. File-upload-dependent import and
TRACKS cases were also blocked because the Chrome extension did not have access
to `file://` URLs. These are coverage gaps, not product failures.

The run contained 58 executed scenario rows and 11 explicitly blocked/not-run rows. Deliberately counted repetition loops produced at least 464 real mouse/keyboard/transport input events; one-off setup, editing, navigation, persistence, render, and multi-tab actions take the total above 500.

No audible-quality claim is made. Automation could inspect browser state, generated files, diagnostics, and errors, but could not listen for clicks, pops, perceived latency, or musical balance.

## Diagnostic acceptance criteria

The following values were sampled throughout the run and at all major boundaries:

- audio engine `READY`, context `RUNNING`, sample rate `48000 Hz`, ZOLA-X `READY`;
- schedulers `STOPPED` after stop, natural completion, render, project replacement, and tab lifecycle tests;
- active voices returned to `0` after bounded release time;
- expired steps/events/clips remained `0 / 0 / 0` in final samples;
- IndexedDB remained `OPEN`, database error remained `—`, save queue returned to `0`, and projects reached `SAVED`;
- resource counts followed project contents instead of growing monotonically (for example, `96 / 6 / 6` channels/buses/FX for the six-bank project and `32 / 2 / 2` for the two-bank synth project);
- the final long-session sample showed approximately `5.4 MiB / 10.01 GiB`, `0.1%` pressure, persistence `YES`, both schedulers stopped, and all voice counters at zero.

## Scenario record

`—` in the issue, severity, or fix columns means that no product defect was found for that scenario. `NOT RUN` is never counted as PASS.

| ID | Scenario | Browser | Repetitions | Result | Observations / evidence | Issue | Severity | Fix commit |
|---:|---|---|---:|---|---|---|---|---|
| 01 | Development build boot with diagnostics | Chrome | 5 loads | PASS | Build SHA displayed `b6ebe5b9e163`; diagnostics updated at 1 Hz. | — | — | — |
| 02 | Start audio from a real gesture | Chrome | 5 contexts | PASS | Engine READY, context RUNNING, 48 kHz; observed base latency 10 ms and output latency 32-48 ms. | — | — | — |
| 03 | Reload while storage contains saved projects | Chrome | 3 reloads | PASS | App returned safely, IndexedDB reopened, and saved projects remained available. | — | — | — |
| 04 | Console/page error checkpoints | Chrome | 25+ checkpoints | PASS | No unexpected warning/error entries. Expected errors occurred only in the intentional crash case. | — | — | — |
| 05 | Load bundled real WAV samples | Chrome | 4 files | PASS | Kick, snare, hat, and A1 break decoded and became READY. | — | — | — |
| 06 | Sample-pad mouse triggering | Chrome | 24 triggers | PASS | Voices rose while triggering and returned to zero. | — | — | — |
| 07 | Sample-pad keyboard triggering | Chrome | 24 triggers | PASS | Keyboard pad path worked; no stuck voices. | — | — | — |
| 08 | Sample-pad hammer release check | Chrome | 2 checkpoints | PASS | 18 manual voices during stress, 0 after the release window. | — | — | — |
| 09 | LASER fixed chop | Chrome | 4 slices | PASS | A1 break was cut into four playable slices. | — | — | — |
| 10 | LASER preview | Chrome | 1 preview sequence | PASS | Preview voice was created and released; preview counter returned to 0. | — | — | — |
| 11 | LASER reverse | Chrome | 1 slice | PASS | Reverse buffer count rose to 1 while used; no stuck voice remained. | — | — | — |
| 12 | Create BASSIC bank and map pads | Chrome | 1 bank / 16 pads | PASS | New bank contained the synth across all pads. | — | — | — |
| 13 | BASSIC extreme controls | Chrome | 3 controls | PASS | Waveform, octave, and cutoff changed without runtime error. | — | — | — |
| 14 | BASSIC preset save/reload | Chrome | 1 round trip | PASS | User preset `QA Bass Extreme` saved and reloaded. | — | — | — |
| 15 | BASSIC trigger stress | Chrome | 57 inputs | PASS | Mouse, keyboard, and chord-style input all released to 0 synth voices. | — | — | — |
| 16 | Create and edit MONOGORG bank | Chrome | 9 rapid controls | PASS | Parameter changes remained responsive. | — | — | — |
| 17 | MONOGORG trigger stress | Chrome | 16 pads | PASS | Synth voice count returned to 0. | — | — | — |
| 18 | Create and edit ZOLA-X bank | Chrome | 1 bank / extremes | PASS | AGGRESSIVE/RAZOR, unison 8, oscillator and filter extremes remained usable. | — | — | — |
| 19 | ZOLA-X trigger stress | Chrome | 49 inputs | PASS | Eight voices were active at an intermediate checkpoint and all reached 0 within the bounded release window. | — | — | — |
| 20 | Drum Synth preview and render-to-pad | Chrome | 24 previews / 1 render | PASS | Twelve kick and twelve snare previews released; rendered `SNARE.wav` was placed on a new pad. | — | — | — |
| 21 | Create Pattern A and Pattern B | Chrome | 2 patterns | PASS | Steps were added to both patterns and remained selectable. | — | — | — |
| 22 | Build mixed SONG arrangement | Chrome | 8 filled slots | PASS | Sample, synth, and two-pattern sections were arranged across multiple banks. | — | — | — |
| 23 | Natural SONG completion | Chrome | 3 completions | PASS | Step and timeline schedulers stopped; position cleared; voices returned to 0. | — | — | — |
| 24 | Full PLAY/STOP torture loop | Chrome | 100 cycles | PASS | Four batches of 25 across SONG and PATTERN modes; clean diagnostics after every batch. | — | — | — |
| 25 | STOP while already stopped | Chrome | 10 presses | PASS | No error or state corruption. | — | — | — |
| 26 | Rapid PLAY→STOP→PLAY→STOP | Chrome | 15 sequences | PASS | Sixty transport inputs; both schedulers and all voices ended stopped/zero. | — | — | — |
| 27 | BPM change during playback | Chrome | 1 rapid sequence | PASS | Playback remained coherent; project ended at 110 BPM. | — | — | — |
| 28 | Pattern switching during playback | Chrome | 1 sequence | PASS | A/B switches did not strand scheduler state or voices. | — | — | — |
| 29 | Bank switching during playback | Chrome | 1 sequence / 4 banks | PASS | Banks 6→2→5→6 switched without errors or lingering voices. | — | — | — |
| 30 | Manual stop before SONG completion | Chrome | 1 | PASS | Both schedulers stopped and position cleared. | — | — | — |
| 31 | Stop after a section boundary | Chrome | 1 | PASS | Section transition and stop remained coherent. | — | — | — |
| 32 | Group FX routing | Chrome | 2 effects | PASS | Delay and EQ were assigned to group 6 and survived playback. | — | — | — |
| 33 | Master FX activation and extremes | Chrome | 2 effects | PASS | Delay and compressor activated; delay feedback/mix extremes did not leave active voices. | — | — | — |
| 34 | Pump routing and styles | Chrome | 3 styles | PASS | Bank 1 pad 1 pumped group 6 at 99%, 1/4; PUNCH, SMASH, and GLIDE were exercised. | — | — | — |
| 35 | Combined sample+synth+FX+Pump SONG | Chrome | 1 completion | PASS | Three sample voices observed during playback; all runtime counters settled correctly. | — | — | — |
| 36 | Open empty wide TRACKS arranger | Chrome | 1 | PASS | Wide arranger opened and remained responsive without a clip. | — | — | — |
| 37 | Exit wide TRACKS arranger by mouse | Chrome | 3 clicks | FAIL | `?diagnostics=1` panel covered the far-right exit button and intercepted pointer hits. | QA-CHROME-P2-001 | P2 | Not fixed by scope |
| 38 | Exit wide TRACKS arranger by keyboard | Chrome | 1 | PASS | Focus plus Enter exited successfully, confirming the underlying action still worked. | QA-CHROME-P2-001 workaround | P2 | Not fixed by scope |
| 39 | First save of complex project | Chrome | 1 | PASS | Project ID assigned; storage became persistent; sample assets were present after reopen. | — | — | — |
| 40 | Autosave after rapid edits | Chrome | 4 revisions | PASS | Observed SAVED 3/3 → DIRTY 3/4 → SAVED 4/4; queue returned to 0. | — | — | — |
| 41 | Save/reload/restore complex project | Chrome | 2 round trips | PASS | Root, scale, song, pads, assets, and project ID restored. | — | — | — |
| 42 | Rename project | Chrome | 1 | PASS | Renamed to `Station Exploratory Chrome Renamed` with the same ID. | — | — | — |
| 43 | Duplicate project | Chrome | 1 | PASS | `Station Exploratory Chrome Copy` received a distinct project ID. | — | — | — |
| 44 | Reject non-portable complex export | Chrome | 1 | PASS | Export was truthfully blocked because generated/imported/chop audio was not portable; app remained usable. | — | — | — |
| 45 | Export portable synth project | Chrome | 1 | PASS | `.station` JSON had envelope schema 1, state schema 23, expected ID/name, and empty assets object. | — | — | — |
| 46 | Rapid switch/save isolation | Chrome | 1 race | PASS | Copy retained F# Dorian while original remained D Dorian; later edits did not overwrite the other project. | — | — | — |
| 47 | Two-tab independent project edit/autosave | Chrome | 2 tabs / 4 edits | PASS | Portable saved A Blues and original saved E Mixolydian; both reopened with their own values. | — | — | — |
| 48 | Two-tab concurrent playback and reload/reopen | Chrome | 2 tabs | PASS | Both projects played to clean completion; simultaneous reload reopened IndexedDB and both saved states. | — | — | — |
| 49 | Complex render with safety trim | Chrome | 1 render | PASS | Clip report showed peak +0.9 dBFS / 65 clipped samples; trim path produced a valid non-empty WAV. | — | — | — |
| 50 | Complex render at 1:1 | Chrome | 1 render | PASS | 18.858 s, stereo, 48 kHz, 16-bit, 3,620,664 data bytes, non-zero audio. | — | — | — |
| 51 | Short BASSIC render | Chrome | 1 render | PASS | 2.588 s, stereo, 48 kHz, 16-bit, 496,828 data bytes, non-zero audio; reported peak -7.9 dBFS. | — | — | — |
| 52 | Playback after render | Chrome | 2 starts | PASS | Live playback worked after both complex and short renders; stop released all voices. | — | — | — |
| 53 | Intentional React render crash | Chrome | 1 | PASS | Recovery screen showed truthful saved/dirty warning, reload/copy controls, and local diagnostic disclosure. | — | — | — |
| 54 | Recovery reload and saved-data survival | Chrome | 1 | PASS | Crash reproduced while switch remained set; navigating back to normal app showed all three saved projects. | — | — | — |
| 55 | Close and reopen an application tab | Chrome | 1 | PASS | Fresh tab reopened IndexedDB and restored the expected project ID and E Mixolydian state. | — | — | — |
| 56 | Switch project while transport is running | Chrome | 1 | PASS | Before switch: both schedulers RUNNING and two voices; after switch: both STOPPED, voices 0, old resources released. | — | — | — |
| 57 | Resource stabilization across project replacement | Chrome | 4 snapshots | PASS | Routing moved between 16/1/1, 32/2/2, and 96/6/6 according to project size; no monotonic growth was observed. | — | — | — |
| 58 | Long-session final health sample | Chrome | ~51 minutes | PASS | Two live tabs, storage open/persistent, queue 0, saved projects, schedulers stopped, voices 0, no unexpected console errors. | — | — | — |
| 59 | Delete project | Chrome | 0 | NOT RUN | Browser-control policy requires action-time confirmation for deletion; no project data was removed. | Coverage gap | — | — |
| 60 | Import a user-selected WAV and trigger it by mouse/keyboard | Chrome/Edge | 0 | NOT RUN | Chrome extension lacked `file://` access; Edge was unavailable. Bundled real WAVs were exercised in Chrome instead. | Environment block | — | — |
| 61 | TRACKS clip playback plus simultaneous SONG+TRACKS render | Chrome/Edge | 0 | NOT RUN | Creating the clip required the blocked file upload path. Empty arranger coverage is recorded above. | Environment block | — | — |
| 62 | Malformed `.station` import | Chrome/Edge | 0 | NOT RUN | File chooser could not receive a local test fixture because the extension lacked file URL access. | Environment block | — | — |
| 63 | Missing-WAV recovery from an imported project | Chrome/Edge | 0 | NOT RUN | Depends on the same blocked import path. | Environment block | — | — |
| 64 | IndexedDB upgrade/open blocked by another tab | Chrome/Edge | 0 | NOT RUN | Normal multi-tab opens passed; no safe headed-browser control was available to force a schema-version block. | Coverage gap | — | — |
| 65 | Quota/storage write failure | Chrome/Edge | 0 | NOT RUN | Storage pressure stayed near 0.1%; deliberately exhausting the browser profile was not safe or realistic here. | Coverage gap | — | — |
| 66 | Forced optional AudioWorklet/ZOLA-X failure | Chrome/Edge | 0 | NOT RUN | No headed-runtime failure switch or safe request interception was exposed. Existing deterministic automated coverage is outside this manual result. | Coverage gap | — | — |
| 67 | True background/foreground transition and main-thread stall | Chrome/Edge | 0 | NOT RUN | The extension exposed both controlled Chrome documents as `visible` and provided no safe activation/stall control. | Environment block | — | — |
| 68 | Sleep/wake, headphones, and physical output-device change | Chrome/Edge | 0 | NOT RUN | Requires human/OS hardware interaction. | Manual-only gap | — | — |
| 69 | Edge critical-path matrix | Edge | 0 | NOT RUN | Browser bridge returned `Browser is not available: edge`; no alternate engine was substituted. | Environment block | — | — |

## Confirmed issue

### QA-CHROME-P2-001 — diagnostics panel blocks the TRACKS exit button

**Severity: P2.** This affects only the development/internal `?diagnostics=1` view, not the normal product URL.

In wide TRACKS mode, the fixed diagnostics panel occupies the right side at a high stacking level and intercepts pointer input above the `✕ STATION` exit control. Three semantic mouse clicks had no effect. A hit test at the exit button center resolved to the diagnostics heading. Keyboard focus plus Enter still invoked the exit action.

Likely root cause: `.internal-diagnostics` is fixed at the right edge with `z-index: 1000`, a 390 px width, and normal pointer handling, while the TRACKS exit control is aligned at the far right beneath it.

No fix was made: this is not a P0/P1 release blocker and the acceptance instruction prohibited unrelated UI changes.

## Render artifacts inspected

- `station-20260820-1915-110bpm.wav`: complex, safety-trimmed render; RIFF/WAVE, stereo, 48 kHz, 16-bit, 18.858 s, non-zero audio.
- `station-20260820-1917-110bpm.wav`: complex 1:1 render; RIFF/WAVE, stereo, 48 kHz, 16-bit, 18.858 s, non-zero audio; SHA-256 `73C398A7DF890DAF82DDF9AB3CFF47DA28DA4C13AEDD3FE877FB82D232836643`.
- `station-20260820-1921-120bpm.wav`: short BASSIC render; RIFF/WAVE, stereo, 48 kHz, 16-bit, 2.588 s, non-zero audio.
- `Station Portable QA.station`: `station-project` envelope schema 1, state schema 23, expected project ID/name, no non-portable assets.

These files were validated structurally and for non-zero sample data. They were not auditioned.

## Final automated gate

- `pnpm test`: PASS — 150/150 tests, 0 failed, 0 skipped.
- `pnpm typecheck`: PASS.
- `pnpm build`: PASS — 172 modules transformed. Vite retained its non-failing warning about a minified chunk larger than 500 kB.

The initial sandboxed typecheck/build attempt was blocked by a local `EPERM` read error on the TypeScript executable in `node_modules`. Re-running the same commands outside the filesystem sandbox passed; this was an execution-environment restriction, not a Station failure.

## Manual checks still required

Before final release acceptance, a human should complete:

1. the Tier 1 critical path on a physical iPhone in Safari and a physical
   Android phone in Chrome, including real touch, orientation, safe areas,
   background/foreground, lock/unlock, AudioContext recovery, and audible output;
2. actual user-WAV import, rapid pad touch, slider dragging, TRACKS gestures,
   simultaneous SONG+TRACKS playback, save/reload, and combined render on both
   Tier 1 devices;
3. malformed project, missing WAV, forced worklet failure, IndexedDB blocked,
   and quota/storage-failure recovery where a safe fixture is available;
4. audible comparison of live playback and rendered WAV, including clicks/pops,
   delay tails, Pump behavior, perceived latency, and clipping choices;
5. project deletion after action-time confirmation.

Edge may still be checked as best effort, but missing Edge coverage cannot block
the mobile-first release status.

## Scope confirmation

No feature, refactor, UI change, dependency change, push, merge, or deployment was performed. No product code was changed during exploratory testing.

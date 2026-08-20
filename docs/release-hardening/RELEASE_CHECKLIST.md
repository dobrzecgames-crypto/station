# Station Release Candidate Checklist

Current status: **WAITING FOR PHYSICAL TIER 1 MOBILE RC ACCEPTANCE** — local
automated hardening gates and desktop evidence do not substitute for iOS Safari
and Android Chrome on physical phones. Edge coverage is best effort and cannot
make this status NO-GO by itself.

Record for each physical mobile pass: Station build SHA, phone model, OS
version, browser version, orientation, audio route, test WAV filenames, date,
tester, and any console or diagnostic evidence. A checkbox without that session
record is not release evidence.

## Automated release gate

- [x] Untouched `pnpm test` baseline passes (110/110).
- [x] Untouched `pnpm typecheck` baseline passes.
- [x] Untouched `pnpm build` baseline passes.
- [x] Hardening regression suite passes (150/150).
- [x] Intentional render crash shows local recovery and view/copy diagnostics.
- [x] Opt-in diagnostics expose release-torture state without hot-path polling.
- [x] Chromium/Chrome browser smoke suite passes on Windows as Tier 2 evidence.
- [x] Edge-channel smoke suite passes on Windows as non-blocking Tier 3 evidence.
- [x] Desktop browser smoke produces a structurally valid, non-silent offline WAV.
- [x] MOBILE RC automatic/emulated preflight is recorded in `MOBILE_RC_QA.md` — PASS, with physical-device limitations explicit.
- [ ] Physical iPhone Safari Tier 1 pass is complete.
- [ ] Physical Android Chrome Tier 1 pass is complete.
- [x] GitHub Actions release-validation workflow covers frozen install, tests, types, build, and pinned Chromium smoke.
- [ ] First hosted GitHub Actions validation run passes after owner-authorized push.

## Tier 1 — iPhone Safari physical RC

- [ ] Start audio from a fresh page with a touch gesture.
- [ ] Import a real WAV and rapidly tap pads without stuck audio or obvious clicks.
- [ ] Drag representative sample, mixer, Pump, and synth sliders.
- [ ] Exercise PLAY/STOP, synth controls, TRACKS gestures, and scrolling boundaries.
- [ ] Exercise intentional multitouch, including overlapping pad touches and a TRACKS pinch where supported.
- [ ] Save, reload, reopen, and verify critical project state.
- [ ] Render a short mixed project and confirm the file is valid and audible.
- [ ] Rotate portrait → landscape → portrait during editing and playback.
- [ ] Background/foreground and lock/unlock during playback; verify AudioContext recovery.
- [ ] Confirm no critical control is hidden by safe areas, browser chrome, or the virtual keyboard.

## Tier 1 — Android Chrome physical RC

- [ ] Start audio from a fresh page with a touch gesture.
- [ ] Import a real WAV and rapidly tap pads without stuck audio or obvious clicks.
- [ ] Drag representative sample, mixer, Pump, and synth sliders.
- [ ] Exercise PLAY/STOP, synth controls, TRACKS gestures, and scrolling boundaries.
- [ ] Exercise intentional multitouch, including overlapping pad touches and a TRACKS pinch where supported.
- [ ] Save, reload, reopen, and verify critical project state.
- [ ] Render a short mixed project and confirm the file is valid and audible.
- [ ] Rotate portrait → landscape → portrait during editing and playback.
- [ ] Background/foreground and lock/unlock during playback; verify AudioContext recovery.
- [ ] Confirm no critical control is hidden by cutouts, system bars, browser chrome, or the virtual keyboard.

## Tier 2 — desktop Chrome on Windows

- [ ] Start Audio from a fresh page.
- [ ] Import a real WAV and trigger it by mouse.
- [ ] Trigger the imported WAV by keyboard.
- [ ] Rapidly retrigger pads without stuck audio or obvious clicks.
- [ ] Exercise BASSIC across its useful range.
- [ ] Exercise MONOGORG across its useful range.
- [ ] Exercise ZOLA-X and confirm an unavailable worklet does not disable core audio.
- [ ] Exercise DRUM SYNTH playback and rendered pad placement.
- [ ] Exercise several simultaneous group/master FX.
- [ ] Exercise Pump with repeated source triggers.
- [ ] Exercise reverse sample playback.
- [ ] Exercise high sample and synth polyphony.
- [ ] PLAY/STOP 100 times.
- [ ] Start SONG and let it complete.
- [ ] Play TRACKS with pattern/SONG content.
- [ ] Switch patterns and banks during playback.
- [ ] Change BPM during playback.
- [ ] Interact heavily with UI during playback.
- [ ] Alt-tab away and back during playback.
- [ ] Minimize, background, foreground, and recover browser audio interruption.
- [ ] Sleep/wake the laptop.
- [ ] Change audio output where possible.
- [ ] Disconnect/reconnect headphones.

## Tier 3 — Edge on Windows, best effort

This section preserves useful compatibility coverage. Unchecked Edge items do
not block the mobile-first release.

- [ ] Start Audio from a fresh page.
- [ ] Import a real WAV and trigger it by mouse.
- [ ] Trigger the imported WAV by keyboard.
- [ ] Rapidly retrigger pads without stuck audio or obvious clicks.
- [ ] Exercise BASSIC across its useful range.
- [ ] Exercise MONOGORG across its useful range.
- [ ] Exercise ZOLA-X and confirm an unavailable worklet does not disable core audio.
- [ ] Exercise DRUM SYNTH playback and rendered pad placement.
- [ ] Exercise several simultaneous group/master FX.
- [ ] Exercise Pump with repeated source triggers.
- [ ] Exercise reverse sample playback.
- [ ] Exercise high sample and synth polyphony.
- [ ] PLAY/STOP 100 times.
- [ ] Start SONG and let it complete.
- [ ] Play TRACKS with pattern/SONG content.
- [ ] Switch patterns and banks during playback.
- [ ] Change BPM during playback.
- [ ] Interact heavily with UI during playback.
- [ ] Alt-tab away and back during playback.
- [ ] Minimize, background, foreground, and recover browser audio interruption.
- [ ] Sleep/wake the laptop.
- [ ] Change audio output where possible.
- [ ] Disconnect/reconnect headphones.

## Projects and storage — both Tier 1 browsers

- [ ] Create a new project.
- [ ] Explicitly save and observe SAVING → SAVED.
- [ ] Make another edit and observe DIRTY → autosave → SAVED.
- [ ] Reload and reopen the same project with its critical state intact.
- [ ] Duplicate a project and confirm independent IDs/state.
- [ ] Rename a project without changing its identity.
- [ ] Delete a disposable project and confirm the target only is removed.
- [ ] Export and import portable project metadata/state.
- [ ] Repeat project switching/opening while transport and voices are active.
- [ ] Exercise many large samples and inspect usage/quota/persistence diagnostics.
- [ ] Attempt to open a project with a missing or corrupt asset and confirm explicit failure.
- [ ] Simulate quota pressure/failure where feasible and confirm ERROR/DIRTY remains visible.
- [ ] Confirm a failed save leaves the previous valid project recoverable.

## Long session — both Tier 1 browsers

- [ ] Run a continuous transport session.
- [ ] Repeatedly switch projects.
- [ ] Repeatedly render files.
- [ ] Confirm voice, cache, routing, and storage diagnostics do not grow monotonically.
- [ ] Confirm no unexplained console errors or unhandled rejections.

## Offline render A/B — both Tier 1 browsers

- [ ] Short SONG.
- [ ] Long SONG.
- [ ] Samples plus BASSIC, MONOGORG, ZOLA-X, and DRUM SYNTH-derived pads.
- [ ] Swing and SHIFT.
- [ ] Group and master FX.
- [ ] Pump, mute, and solo.
- [ ] TRACKS material under the final documented export semantics.
- [ ] Release and effect tails.
- [ ] Live-versus-render listening comparison.

## Failure protocol

- [ ] Every observed failure has reproduction steps and evidence in `FINDINGS.md`.
- [ ] Every observed failure is classified P0, P1, or P2 before acceptance continues.
- [ ] No P0/P1 failure is waived by a headless pass or an unrelated successful check.
- [ ] Every P0/P1 failure is fixed, regression-tested, and rechecked in both Tier 1 browsers.

## Final review

- [x] No P0 findings remain.
- [x] No accepted P1 findings remain.
- [x] No temporary debug code, test bypass, or release hack remains.
- [x] Remaining P2 findings and browser limitations are documented.
- [ ] Product owner has completed physical iPhone Safari and Android Chrome RC acceptance.
- [x] Edge is explicitly non-blocking for the release decision.

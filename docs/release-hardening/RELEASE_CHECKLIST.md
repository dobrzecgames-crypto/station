# Station Release Candidate Checklist

Current status: **NOT READY** — hardening audits and target-browser acceptance
are incomplete.

## Automated release gate

- [x] Untouched `pnpm test` baseline passes (110/110).
- [x] Untouched `pnpm typecheck` baseline passes.
- [x] Untouched `pnpm build` baseline passes.
- [ ] Hardening regression suite passes.
- [x] Intentional render crash shows local recovery and view/copy diagnostics.
- [x] Opt-in diagnostics expose release-torture state without hot-path polling.
- [x] Chromium/Chrome browser smoke suite passes on Windows.
- [x] Edge-channel smoke suite passes on Windows.
- [x] GitHub Actions release-validation workflow covers frozen install, tests, types, build, and pinned Chromium smoke.
- [ ] First hosted GitHub Actions validation run passes after owner-authorized push.

## Chrome on Windows — real audio

- [ ] Start Audio from a fresh page.
- [ ] Import a real WAV and trigger it by mouse.
- [ ] Trigger the imported WAV by keyboard.
- [ ] Rapidly retrigger pads without stuck audio or obvious clicks.
- [ ] Exercise MONO-3, MONOGORG, STRINGS, and POLY/ZOLA-X.
- [ ] Exercise several active FX and Pump.
- [ ] Exercise reverse playback and high polyphony.
- [ ] PLAY/STOP 100 times.
- [ ] Start SONG and let it complete.
- [ ] Play TRACKS with pattern/SONG content.
- [ ] Switch patterns/banks and change BPM during playback.
- [ ] Interact heavily with UI during playback.
- [ ] Alt-tab, minimize, background, and foreground the app.
- [ ] Sleep/wake the laptop.
- [ ] Change audio output where possible.
- [ ] Disconnect/reconnect headphones.

## Edge on Windows — real audio

- [ ] Start Audio from a fresh page.
- [ ] Import a real WAV and trigger it by mouse.
- [ ] Trigger the imported WAV by keyboard.
- [ ] Rapidly retrigger pads without stuck audio or obvious clicks.
- [ ] Exercise MONO-3, MONOGORG, STRINGS, and POLY/ZOLA-X.
- [ ] Exercise several active FX and Pump.
- [ ] Exercise reverse playback and high polyphony.
- [ ] PLAY/STOP 100 times.
- [ ] Start SONG and let it complete.
- [ ] Play TRACKS with pattern/SONG content.
- [ ] Switch patterns/banks and change BPM during playback.
- [ ] Interact heavily with UI during playback.
- [ ] Alt-tab, minimize, background, and foreground the app.
- [ ] Sleep/wake the laptop.
- [ ] Change audio output where possible.
- [ ] Disconnect/reconnect headphones.

## Projects and storage — both browsers

- [ ] Create, explicitly save, autosave, reload, and reopen a project.
- [ ] Duplicate, rename, delete, export, and import projects.
- [ ] Repeat project switching/opening while transport and voices are active.
- [ ] Exercise many large samples and inspect storage diagnostics.
- [ ] Exercise missing/corrupt assets and a simulated quota failure.
- [ ] Confirm a failed save leaves the previous valid project recoverable.

## Long session — both browsers

- [ ] Run a continuous transport session.
- [ ] Repeatedly switch projects and render files.
- [ ] Confirm voice/cache/storage diagnostics do not grow monotonically.
- [ ] Confirm no unexplained console errors or unhandled rejections.

## Offline render A/B — both browsers

- [ ] Short SONG.
- [ ] Long SONG.
- [ ] Samples and all supported synth sources.
- [ ] Swing and SHIFT.
- [ ] Group and master FX.
- [ ] Pump, mute, and solo.
- [ ] TRACKS material under the final documented export semantics.
- [ ] Release and effect tails.
- [ ] Live-versus-render listening comparison.

## Final review

- [ ] No P0 findings remain.
- [ ] No accepted P1 findings remain.
- [ ] No temporary debug code, test bypass, or release hack remains.
- [ ] Remaining P2 findings and browser limitations are documented.
- [ ] Product owner has completed manual RC acceptance.

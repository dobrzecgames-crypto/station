# Station MOBILE RC QA

Date: 2026-08-20, re-validated 2026-08-21 after red-team integration
Branch: `release/station-hardening`
Candidate product commit: `6681558cb6e4bf63b83e19fd5c6589373d1570a1`
Re-validated at: `afa7219022b37196dfea333d23c9467958e8a0aa`

## Status

**Automatic/emulated mobile preflight: PASS.** No new P0 or P1 product defect
was confirmed by this preflight.

**Mobile-first release status: READY FOR PHYSICAL DEVICE ACCEPTANCE.** A real
iPhone Safari pass and a real Android Chrome pass are still release blocking.
Edge is Tier 3 / best effort and cannot block this status.

## Red-team integration re-validation (2026-08-21)

The final independent red-team pass (`FINAL_RED_TEAM.md`) found and fixed one P0
and five P1 defects. Those fixes are now integrated into this branch, and the
whole mobile matrix below was re-run against the integrated tree:
`pnpm test:mobile-rc` → **14 passed, 2 intentionally skipped**, unchanged.

Two of the fixed defects are directly mobile-relevant and are the reason this
preflight alone still cannot close the release:

- **P1 — library auditions retained every decoded buffer.** Auditioning 137
  library sounds grew the JS heap from 26 MB to 156 MB and held 132 decoded
  buffers plus 132 source blobs for the rest of the session. Browsing the sounds
  is the first thing a new user does, and on a real phone that growth is a
  plausible tab reload. Now bounded to the audition currently sounding
  (137 auditions → 2 retained assets, 23 → 35 MB). **This was never going to
  surface on a desktop emulation profile and needs a real-device memory check.**
- **P0 — a cancelled unload destroyed the audio runtime.** Mobile browsers fire
  page-lifecycle events far more aggressively than desktop, so the corrected
  `pagehide`/`persisted` handling needs a real app-switch, lock/unlock and
  bfcache-restore pass on hardware.

A new suite, `pnpm test:redteam`, adds a shared-drag-slider audit that drags,
cancels, and re-drags every visible range control across four screens on both
the iPhone 13 and Pixel 7 profiles: **23/23 sliders responded, survived
`touchCancel`, and answered the next gesture; zero dead controls.** It also
re-checks that four orientation changes during playback leave the transport
running. This is still Chromium device emulation with CDP touch, not capacitive
hardware and not WebKit.

No physical phone was tested. The iPhone profile used installed desktop Chrome
with iPhone 13 metrics, mobile user agent, device scale, `isMobile`, and
`hasTouch`; it was not Safari or iOS WebKit. The Android profile used installed
desktop Chrome with Pixel 7 metrics and the same emulated mobile/touch features;
it was not a physical Android device.

## Automated and emulated matrix

| Area | iPhone-like emulation | Android-like Chrome emulation | Result |
| --- | --- | --- | --- |
| Viewports | iPhone 13 portrait + landscape | Pixel 7 portrait + landscape | PASS |
| Orientation | live portrait ↔ landscape resize without reload; TRACKS compact ↔ wide | same | PASS |
| Touch capability | `maxTouchPoints > 0`, coarse pointer, `PointerEvent`, captured `pointerType: touch` | same | PASS |
| `touch-action` | pad `none`, normal key `manipulation`, SEQ label/step `pan-y`, slider `none`, TRACKS strip `pan-x`, clip `none` | same | PASS |
| `pointercancel` | pad, synth audition, and slider cancellation released cleanly | same | PASS |
| Rapid pads | 32 CDP touch tap sequences; voices returned to zero | 32 CDP touch tap sequences; voices returned to zero | PASS |
| Multitouch | two pads held simultaneously and released with no stuck state | same | PASS |
| Slider dragging | BASSIC touch drag changed value after a cancelled first drag | same | PASS |
| PLAY/STOP | 12 touch cycles; both schedulers stopped cleanly | 12 touch cycles; both schedulers stopped cleanly | PASS |
| Synth controls | created BASSIC bank, dragged control, cancelled audition, synth voices returned to zero | same | PASS |
| TRACKS gestures | real WAV import, native horizontal pan, touch clip drag, state survived orientation changes | same | PASS |
| Scrolling conflicts | no shell horizontal overflow; SEQ vertical-pan contract and TRACKS native pan verified | same | PASS |
| Save/reload | saved project with sample bank, BASSIC bank, SONG and TRACKS; reloaded and reopened both bank assets plus TRACKS clip | same | PASS |
| Render | combined SONG + TRACKS download had RIFF/WAVE headers and non-zero PCM payload | same | PASS |
| Background/foreground | synthetic hidden/visible transition plus direct AudioContext suspend/resume; context returned to RUNNING | same | PASS — simulation only |
| Runtime health | no page errors or console errors; voice/scheduler/render diagnostics settled | same | PASS |

`pnpm test:mobile-rc` result: **6 passed, 2 intentionally skipped** in about
1.2 minutes. The skipped rows are duplicate full-workflow executions assigned
to the two landscape-only projects. Each landscape profile ran its dedicated
layout/orientation test, and both portrait full workflows rotated into landscape
and back while preserving TRACKS state.

The gesture input was sent as Chromium touch events, including `touchCancel`
and two simultaneous touch points. This is stronger than mouse clicks but still
desktop-engine emulation, not capacitive hardware evidence.

## Supporting gates

- `pnpm test`: PASS — 150/150.
- `pnpm typecheck`: PASS.
- `pnpm build`: PASS — 172 modules; existing non-blocking chunk-size warning.
- `pnpm test:browser:chrome`: PASS — 1/1 Tier 2 release smoke.
- Edge was not rerun because it is non-blocking Tier 3; its previous hardening
  evidence remains recorded separately.

## Limits and manual-only gaps

- Mobile Safari/WebKit policies, safe-area behavior, browser chrome, virtual
  keyboard, memory pressure, thermal throttling, and real touch latency were not
  reproduced.
- Android OS lifecycle, Chrome process eviction, system navigation gestures,
  cutouts, and device-specific audio routing were not reproduced.
- Hidden/visible and AudioContext recovery were simulated in-page. App switch,
  screen lock, OS interruption, phone call, headphones, and route changes need
  physical devices.
- Rendered WAVs were validated structurally and for non-zero samples but were
  not auditioned.
- The opt-in diagnostics panel retains the previously documented P2 overlay
  issue. The harness moved it off-screen while keeping its values readable;
  normal product-URL layout checks ran without diagnostics.

## Minimum physical Tier 1 gate

1. **Real iPhone / Safari:** import one WAV; rapid/multitouch pads; drag one
   slider and a TRACKS clip; PLAY/STOP; save/reload; render and listen; rotate;
   app-switch + lock/unlock and confirm audio recovery.
2. **Real Android / Chrome:** repeat the same path, including system back/scroll
   gestures and background/foreground recovery.

### Added by the red-team integration — must be covered on both devices

3. **Cancelled unload (P0-1 regression).** Edit a saved project so it is DIRTY,
   then try to close or reload the tab and choose *Stay*. Audio must still work,
   pads must still play, and the project must still save.
4. **Page lifecycle (P0-1 mechanism).** App-switch away and back, lock/unlock,
   and let the tab be restored from bfcache. Audio must recover and no sample
   may be lost.
5. **Recording take (P1-1 / P1-2 regression).** Press REC from stopped, press
   PLAY during the four-beat count-in, then play a take over a WAVES clip.
   Every hit must land on the grid, and the WAVES clip must be audible with a
   moving playhead.
6. **Live tempo change (P1-4 regression).** Change BPM while a WAVES
   arrangement is playing. The playhead must keep moving forward, not jump.
7. **Project-busy edit (P1-5 regression).** Tap PROJECT → LIBRARY and
   immediately edit a step before the dialog appears; close it, reload, reopen.
   The edit must survive.
8. **Audition memory (P1-3 regression).** Audition a large number of library
   sounds and watch device memory / tab stability. Retention must stay bounded.
9. **Audible check.** Render a short mixed project and listen to it against live
   playback. No automated pass in this project has ever auditioned a WAV.

## Scope confirmation

**For the original 2026-08-20 preflight:** no product source file was changed.
Only release documentation and reusable QA automation/configuration were added
or updated. No P2 product fix, dependency change, push, merge, deployment,
reset, or commit rollback was performed.

**For the 2026-08-21 re-validation:** product source *was* changed, by the
red-team fixes listed above and detailed in `FINAL_RED_TEAM.md`. They were
integrated into `release/station-hardening` by fast-forward from
`qa/claude-final-redteam`; no history was squashed or rewritten, `main` was not
touched, and nothing was pushed or deployed.

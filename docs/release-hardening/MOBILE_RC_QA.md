# Station MOBILE RC QA

Date: 2026-08-20
Branch: `release/station-hardening`
Candidate product commit: `6681558cb6e4bf63b83e19fd5c6589373d1570a1`

## Status

**Automatic/emulated mobile preflight: PASS.** No new P0 or P1 product defect
was confirmed.

**Mobile-first release status: WAITING FOR PHYSICAL TIER 1 ACCEPTANCE.** A real
iPhone Safari pass and a real Android Chrome pass are still release blocking.
Edge is Tier 3 / best effort and cannot block this status.

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

## Scope confirmation

No product source file was changed. Only release documentation and reusable QA
automation/configuration were added or updated. No P2 product fix, dependency
change, push, merge, deployment, reset, or commit rollback was performed.
